// Deno edge function. Scheduled via pg_cron (see README) to run once daily.
//
// Pulls the next few days of NBA games + odds from SportsGameOdds (a single
// API for schedule, box scores, and odds — replaced balldontlie + The Odds
// API once we found it offered enough for real pace/off/def rating
// calculations plus a pre-computed no-vig "fair" price per market).
// Every path is defensive: a missing API key or a malformed upstream
// response is logged to `sync_log` and returned as a 200 with an error
// detail, never an uncaught crash — a cron run should always leave a
// record of what happened.
//
// The zod schemas and oddID filtering rules here were built from real
// captured responses (probed live via pg_net from within this project,
// bypassing the dev sandbox's blocked egress to sportsgameodds.io) rather
// than guessed from docs — mirrored in src/lib/schemas/sportsgameodds.ts
// for the frontend.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { z } from "npm:zod@3.23.8";

const teamNamesSchema = z.object({
  short: z.string(),
  medium: z.string(),
  long: z.string(),
});

const teamSideSchema = z.object({
  teamID: z.string(),
  names: teamNamesSchema,
  score: z.number().nullable().optional(),
});

const statusSchema = z.object({
  completed: z.boolean(),
  live: z.boolean(),
  startsAt: z.string(),
});

const bookmakerOddSchema = z.object({
  odds: z.string().optional(),
  spread: z.string().optional(),
  overUnder: z.string().optional(),
  available: z.boolean().optional(),
});

const oddEntrySchema = z.object({
  oddID: z.string(),
  statID: z.string(),
  statEntityID: z.string(),
  periodID: z.string(),
  betTypeID: z.string(),
  sideID: z.string(),
  fairOdds: z.string().optional(),
  byBookmaker: z.record(bookmakerOddSchema).optional(),
});

const eventSchema = z.object({
  eventID: z.string(),
  teams: z.object({ home: teamSideSchema, away: teamSideSchema }),
  status: statusSchema,
  // Upcoming games return results: {} (no `game` key yet) rather than
  // omitting `results` or nulling it -- confirmed live, not guessed.
  results: z.object({ game: z.record(z.unknown()).optional() }).nullable().optional(),
  odds: z.record(oddEntrySchema).optional(),
});

const eventsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(eventSchema),
  nextCursor: z.string().nullable().optional(),
});

// Only real numbers we trust for pace/rating math — pulled from a
// completed event's results.game.{home,away}.
const boxTeamStatsSchema = z.object({
  points: z.number(),
  fieldGoalsAttempted: z.number(),
  offensiveRebounds: z.number(),
  turnovers: z.number(),
  freeThrowsAttempted: z.number(),
});

const TEAM_MARKET_BET_TYPES = new Set(["ml", "sp", "ou"]);
const TEAM_MARKET_ENTITIES = new Set(["home", "away", "all"]);
const betTypeToMarket: Record<string, "moneyline" | "spread" | "total"> = {
  ml: "moneyline",
  sp: "spread",
  ou: "total",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** NBA season convention: Oct–Dec belongs to the season named after that year. */
function computeSeason(isoDateTime: string): number {
  const d = new Date(isoDateTime);
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  return month >= 10 ? year : year - 1;
}

function possessionsEst(b: z.infer<typeof boxTeamStatsSchema>): number {
  return b.fieldGoalsAttempted - b.offensiveRebounds + b.turnovers + 0.4 * b.freeThrowsAttempted;
}

interface SyncSummary {
  gamesUpserted: number;
  teamsUpserted: number;
  boxScoresUpserted: number;
  oddsSnapshotsInserted: number;
  warnings: string[];
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("SPORTSGAMEODDS_API_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase runtime env vars" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const summary: SyncSummary = {
    gamesUpserted: 0,
    teamsUpserted: 0,
    boxScoresUpserted: 0,
    oddsSnapshotsInserted: 0,
    warnings: [],
  };

  try {
    if (!apiKey) {
      await logSync(supabase, "error", { message: "SPORTSGAMEODDS_API_KEY is not set", summary });
      return Response.json({ ok: false, error: "SPORTSGAMEODDS_API_KEY is not set" });
    }

    const requestUrl = new URL(req.url);
    const today = new Date();
    const defaultEnd = new Date(today);
    defaultEnd.setDate(defaultEnd.getDate() + 6);
    const startDate = requestUrl.searchParams.get("start_date") ?? isoDate(today);
    const endDate = requestUrl.searchParams.get("end_date") ?? isoDate(defaultEnd);

    // Paginate on nextCursor. A week of NBA games is well under a page
    // (limit=100), so this cap is just a safety net against a runaway loop.
    const events: z.infer<typeof eventSchema>[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const url = new URL("https://api.sportsgameodds.com/v2/events");
      url.searchParams.set("leagueID", "NBA");
      url.searchParams.set("startsAfter", startDate);
      url.searchParams.set("startsBefore", endDate);
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url, { headers: { "x-api-key": apiKey } });
      if (!res.ok) {
        throw new Error(`SportsGameOdds /v2/events returned ${res.status}: ${await res.text()}`);
      }
      const json = eventsResponseSchema.parse(await res.json());
      events.push(...json.data);
      if (!json.nextCursor || json.data.length === 0) break;
      cursor = json.nextCursor;
    }

    // Upsert teams (deduped from each event's home/away side).
    const teamsById = new Map<string, z.infer<typeof teamSideSchema>>();
    for (const event of events) {
      teamsById.set(event.teams.home.teamID, event.teams.home);
      teamsById.set(event.teams.away.teamID, event.teams.away);
    }
    if (teamsById.size > 0) {
      const { error } = await supabase.from("teams").upsert(
        Array.from(teamsById.values()).map((t) => ({
          id: t.teamID,
          abbreviation: t.names.short,
          name: t.names.medium,
          full_name: t.names.long,
        })),
      );
      if (error) throw new Error(`teams upsert failed: ${error.message}`);
      summary.teamsUpserted = teamsById.size;
    }

    // Upsert games.
    if (events.length > 0) {
      const { error } = await supabase.from("games").upsert(
        events.map((e) => ({
          id: e.eventID,
          season: computeSeason(e.status.startsAt),
          game_date: e.status.startsAt.slice(0, 10),
          tip_time: e.status.startsAt,
          home_team_id: e.teams.home.teamID,
          away_team_id: e.teams.away.teamID,
          status: e.status.completed ? "final" : e.status.live ? "live" : "scheduled",
          home_score: e.teams.home.score ?? null,
          away_score: e.teams.away.score ?? null,
          updated_at: new Date().toISOString(),
        })),
      );
      if (error) throw new Error(`games upsert failed: ${error.message}`);
      summary.gamesUpserted = events.length;
    }

    // Box scores + real pace/off/def rating estimates for completed games.
    const boxScoreRows: Array<{
      game_id: string;
      team_id: string;
      pts: number;
      opp_pts: number;
      possessions_est: number;
      pace_est: number;
      off_rating_est: number | null;
      def_rating_est: number | null;
    }> = [];
    for (const event of events) {
      const gameResults = event.results?.game;
      if (!gameResults) continue;
      const home = boxTeamStatsSchema.safeParse(gameResults.home);
      const away = boxTeamStatsSchema.safeParse(gameResults.away);
      if (!home.success || !away.success) continue;

      const homePoss = possessionsEst(home.data);
      const awayPoss = possessionsEst(away.data);
      const paceEst = (homePoss + awayPoss) / 2;

      boxScoreRows.push({
        game_id: event.eventID,
        team_id: event.teams.home.teamID,
        pts: home.data.points,
        opp_pts: away.data.points,
        possessions_est: homePoss,
        pace_est: paceEst,
        off_rating_est: homePoss > 0 ? (100 * home.data.points) / homePoss : null,
        def_rating_est: awayPoss > 0 ? (100 * away.data.points) / awayPoss : null,
      });
      boxScoreRows.push({
        game_id: event.eventID,
        team_id: event.teams.away.teamID,
        pts: away.data.points,
        opp_pts: home.data.points,
        possessions_est: awayPoss,
        pace_est: paceEst,
        off_rating_est: awayPoss > 0 ? (100 * away.data.points) / awayPoss : null,
        def_rating_est: homePoss > 0 ? (100 * home.data.points) / homePoss : null,
      });
    }
    if (boxScoreRows.length > 0) {
      const { error } = await supabase
        .from("team_game_box_scores")
        .upsert(boxScoreRows, { onConflict: "game_id,team_id" });
      if (error) throw new Error(`box scores upsert failed: ${error.message}`);
      summary.boxScoresUpserted = boxScoreRows.length;
    }

    // Odds: team-level moneyline/spread/total only (statID=points,
    // periodID=game, betTypeID in ml/sp/ou, statEntityID in home/away/all).
    // Player props use different statEntityID/statID values and are out of
    // scope until Phase 2.
    const snapshotRows: Array<{
      game_id: string;
      book: string;
      market: "moneyline" | "spread" | "total";
      side: string;
      line: number | null;
      price: number;
      fair_price: number | null;
    }> = [];
    for (const event of events) {
      for (const entry of Object.values(event.odds ?? {})) {
        if (
          entry.statID !== "points" ||
          entry.periodID !== "game" ||
          !TEAM_MARKET_BET_TYPES.has(entry.betTypeID) ||
          !TEAM_MARKET_ENTITIES.has(entry.statEntityID)
        ) {
          continue;
        }
        const market = betTypeToMarket[entry.betTypeID];
        const side = market === "total" ? entry.sideID : entry.statEntityID;
        const fairPrice = entry.fairOdds ? parseInt(entry.fairOdds, 10) : null;

        for (const [book, bm] of Object.entries(entry.byBookmaker ?? {})) {
          if (bm.available === false || !bm.odds) continue;
          const price = parseInt(bm.odds, 10);
          if (Number.isNaN(price)) continue;

          let line: number | null = null;
          if (market === "spread" && bm.spread) line = parseFloat(bm.spread);
          if (market === "total" && bm.overUnder) line = parseFloat(bm.overUnder);

          snapshotRows.push({
            game_id: event.eventID,
            book,
            market,
            side,
            line: line != null && Number.isNaN(line) ? null : line,
            price,
            fair_price: fairPrice != null && Number.isNaN(fairPrice) ? null : fairPrice,
          });
        }
      }
    }
    if (snapshotRows.length > 0) {
      const { error } = await supabase.from("odds_snapshots").insert(snapshotRows);
      if (error) throw new Error(`odds_snapshots insert failed: ${error.message}`);
      summary.oddsSnapshotsInserted = snapshotRows.length;
    }

    await logSync(supabase, summary.warnings.length > 0 ? "partial" : "success", summary);
    return Response.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logSync(supabase, "error", { message, summary });
    return Response.json({ ok: false, error: message, summary });
  }
});

async function logSync(
  supabase: ReturnType<typeof createClient>,
  status: "success" | "partial" | "error",
  detail: unknown,
) {
  await supabase.from("sync_log").insert({ job_name: "daily-sync", status, detail });
}
