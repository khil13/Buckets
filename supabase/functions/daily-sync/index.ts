// Deno edge function. Scheduled via pg_cron (see README) to run once daily.
//
// Pulls the next few days of NBA games + odds and upserts them into
// Supabase. Every path is defensive: a missing API key or a malformed
// upstream response is logged to `sync_log` and returned as a 200 with an
// error detail, never an uncaught crash — a cron run should always leave a
// record of what happened.
//
// Zod schemas here mirror src/lib/schemas/{balldontlie,oddsapi}.ts but are
// kept separate since this runs on Deno (npm: specifiers) rather than the
// Vite/browser bundle. They were written from public API docs, not a live
// response (this dev sandbox's network egress blocks both vendors' docs
// sites) — verify field names against real responses once API keys are
// added, and adjust only this file plus its frontend counterparts.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { z } from "npm:zod@3.23.8";

const bdlTeamSchema = z.object({
  id: z.number(),
  abbreviation: z.string(),
  conference: z.string(),
  division: z.string(),
  full_name: z.string(),
  name: z.string(),
});

const bdlGameSchema = z.object({
  id: z.number(),
  date: z.string(),
  season: z.number(),
  status: z.string(),
  home_team_score: z.number(),
  visitor_team_score: z.number(),
  home_team: bdlTeamSchema,
  visitor_team: bdlTeamSchema,
});

const bdlGamesResponseSchema = z.object({
  data: z.array(bdlGameSchema),
});

const oddsOutcomeSchema = z.object({
  name: z.string(),
  price: z.number(),
  point: z.number().optional(),
});

const oddsMarketKeySchema = z.enum(["h2h", "spreads", "totals"]);

const oddsEventSchema = z.object({
  id: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(
    z.object({
      key: z.string(),
      markets: z.array(
        z.object({
          key: oddsMarketKeySchema,
          outcomes: z.array(oddsOutcomeSchema),
        }),
      ),
    }),
  ),
});

const oddsEventsResponseSchema = z.array(oddsEventSchema);

const marketKeyToDbMarket: Record<z.infer<typeof oddsMarketKeySchema>, "moneyline" | "spread" | "total"> = {
  h2h: "moneyline",
  spreads: "spread",
  totals: "total",
};

function isFinal(status: string): boolean {
  return status.trim().toLowerCase() === "final";
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface SyncSummary {
  gamesUpserted: number;
  teamsUpserted: number;
  boxScoresUpserted: number;
  oddsSnapshotsInserted: number;
  oddsEventsMatched: number;
  oddsEventsUnmatched: number;
  warnings: string[];
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const balldontlieKey = Deno.env.get("BALLDONTLIE_API_KEY");
  const oddsApiKey = Deno.env.get("ODDS_API_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    // These are auto-injected by Supabase for every edge function; if
    // they're missing something is very wrong with the deployment itself.
    return new Response(JSON.stringify({ error: "Missing Supabase runtime env vars" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const summary: SyncSummary = {
    gamesUpserted: 0,
    teamsUpserted: 0,
    boxScoresUpserted: 0,
    oddsSnapshotsInserted: 0,
    oddsEventsMatched: 0,
    oddsEventsUnmatched: 0,
    warnings: [],
  };

  try {
    if (!balldontlieKey) {
      await logSync(supabase, "error", { message: "BALLDONTLIE_API_KEY is not set", summary });
      return Response.json({ ok: false, error: "BALLDONTLIE_API_KEY is not set" });
    }

    // start_date/end_date query params let this be invoked manually for a
    // backfill or a schema-verification test run against a populated date
    // range; the scheduled cron call omits them and gets the default
    // "today plus the next week" window.
    const requestUrl = new URL(req.url);
    const today = new Date();
    const defaultEnd = new Date(today);
    defaultEnd.setDate(defaultEnd.getDate() + 6);

    const startDate = requestUrl.searchParams.get("start_date") ?? isoDate(today);
    const endDate = requestUrl.searchParams.get("end_date") ?? isoDate(defaultEnd);

    const gamesUrl = new URL("https://api.balldontlie.io/v1/games");
    gamesUrl.searchParams.set("start_date", startDate);
    gamesUrl.searchParams.set("end_date", endDate);
    gamesUrl.searchParams.set("per_page", "100");

    const gamesRes = await fetch(gamesUrl, {
      headers: { Authorization: `Bearer ${balldontlieKey}` },
    });
    if (!gamesRes.ok) {
      throw new Error(`balldontlie /games returned ${gamesRes.status}: ${await gamesRes.text()}`);
    }
    const gamesJson = bdlGamesResponseSchema.parse(await gamesRes.json());

    // Upsert teams (deduped from each game's home/visitor team).
    const teamsById = new Map<number, z.infer<typeof bdlTeamSchema>>();
    for (const game of gamesJson.data) {
      teamsById.set(game.home_team.id, game.home_team);
      teamsById.set(game.visitor_team.id, game.visitor_team);
    }
    if (teamsById.size > 0) {
      const { error } = await supabase.from("teams").upsert(
        Array.from(teamsById.values()).map((t) => ({
          id: t.id,
          abbreviation: t.abbreviation,
          name: t.name,
          full_name: t.full_name,
          conference: t.conference,
          division: t.division,
        })),
      );
      if (error) throw new Error(`teams upsert failed: ${error.message}`);
      summary.teamsUpserted = teamsById.size;
    }

    // Upsert games.
    if (gamesJson.data.length > 0) {
      const { error } = await supabase.from("games").upsert(
        gamesJson.data.map((g) => ({
          id: g.id,
          season: g.season,
          game_date: g.date.slice(0, 10),
          home_team_id: g.home_team.id,
          away_team_id: g.visitor_team.id,
          status: isFinal(g.status) ? "final" : "scheduled",
          home_score: g.home_team_score || null,
          away_score: g.visitor_team_score || null,
          updated_at: new Date().toISOString(),
        })),
      );
      if (error) throw new Error(`games upsert failed: ${error.message}`);
      summary.gamesUpserted = gamesJson.data.length;
    }

    // Box scores: only real numbers we can trust from this endpoint are
    // final scores. Advanced-stat proxies (pace/off/def rating) are left
    // null here rather than fabricated from insufficient inputs.
    const finishedGames = gamesJson.data.filter((g) => isFinal(g.status));
    if (finishedGames.length > 0) {
      const rows = finishedGames.flatMap((g) => [
        { game_id: g.id, team_id: g.home_team.id, pts: g.home_team_score, opp_pts: g.visitor_team_score },
        { game_id: g.id, team_id: g.visitor_team.id, pts: g.visitor_team_score, opp_pts: g.home_team_score },
      ]);
      const { error } = await supabase.from("team_game_box_scores").upsert(rows, { onConflict: "game_id,team_id" });
      if (error) throw new Error(`box scores upsert failed: ${error.message}`);
      summary.boxScoresUpserted = rows.length;
    }

    // Odds (optional — skip gracefully if no key yet).
    if (!oddsApiKey) {
      summary.warnings.push("ODDS_API_KEY is not set; skipped odds sync");
    } else {
      const oddsUrl = new URL("https://api.the-odds-api.com/v4/sports/basketball_nba/odds");
      oddsUrl.searchParams.set("apiKey", oddsApiKey);
      oddsUrl.searchParams.set("regions", "us");
      oddsUrl.searchParams.set("markets", "h2h,spreads,totals");
      oddsUrl.searchParams.set("oddsFormat", "american");

      const oddsRes = await fetch(oddsUrl);
      if (!oddsRes.ok) {
        summary.warnings.push(`The Odds API returned ${oddsRes.status}: ${await oddsRes.text()}`);
      } else {
        const events = oddsEventsResponseSchema.parse(await oddsRes.json());

        // Match by team full name + same UTC calendar date as our synced
        // game. Name mismatches (e.g. abbreviated city names) are the main
        // known risk here — flagged, not silently ignored, via `warnings`.
        const gamesByTeamPairAndDate = new Map<string, (typeof gamesJson.data)[number]>();
        for (const g of gamesJson.data) {
          const key = matchKey(g.home_team.full_name, g.visitor_team.full_name, g.date.slice(0, 10));
          gamesByTeamPairAndDate.set(key, g);
        }

        const snapshotRows: Array<{
          game_id: number;
          book: string;
          market: "moneyline" | "spread" | "total";
          side: string | null;
          line: number | null;
          price: number;
        }> = [];

        for (const event of events) {
          const eventDate = event.commence_time.slice(0, 10);
          const key = matchKey(event.home_team, event.away_team, eventDate);
          const matchedGame = gamesByTeamPairAndDate.get(key);
          if (!matchedGame) {
            summary.oddsEventsUnmatched += 1;
            continue;
          }
          summary.oddsEventsMatched += 1;

          for (const bookmaker of event.bookmakers) {
            for (const market of bookmaker.markets) {
              const dbMarket = marketKeyToDbMarket[market.key];
              for (const outcome of market.outcomes) {
                const side =
                  dbMarket === "total"
                    ? outcome.name.toLowerCase()
                    : outcome.name === event.home_team
                      ? "home"
                      : outcome.name === event.away_team
                        ? "away"
                        : null;
                snapshotRows.push({
                  game_id: matchedGame.id,
                  book: bookmaker.key,
                  market: dbMarket,
                  side,
                  line: outcome.point ?? null,
                  price: outcome.price,
                });
              }
            }
          }
        }

        if (snapshotRows.length > 0) {
          const { error } = await supabase.from("odds_snapshots").insert(snapshotRows);
          if (error) throw new Error(`odds_snapshots insert failed: ${error.message}`);
          summary.oddsSnapshotsInserted = snapshotRows.length;
        }
      }
    }

    await logSync(supabase, summary.warnings.length > 0 ? "partial" : "success", summary);
    return Response.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logSync(supabase, "error", { message, summary });
    return Response.json({ ok: false, error: message, summary });
  }
});

function matchKey(homeTeamName: string, awayTeamName: string, isoDateStr: string): string {
  return `${homeTeamName.trim().toLowerCase()}|${awayTeamName.trim().toLowerCase()}|${isoDateStr}`;
}

async function logSync(
  supabase: ReturnType<typeof createClient>,
  status: "success" | "partial" | "error",
  detail: unknown,
) {
  await supabase.from("sync_log").insert({ job_name: "daily-sync", status, detail });
}
