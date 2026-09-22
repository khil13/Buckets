import { z } from "zod";

/**
 * Shapes for SportsGameOdds' `/v2/events` endpoint (schedule, box scores,
 * and odds in one call). Unlike the balldontlie/Odds API schemas this
 * replaced, these were built from real responses captured live via pg_net
 * during development (bypassing this sandbox's blocked egress), not
 * guessed from docs. Mirrored in supabase/functions/daily-sync/index.ts
 * since the edge function runs on Deno and can't import from src/.
 */
export const sgoTeamNamesSchema = z.object({
  short: z.string(),
  medium: z.string(),
  long: z.string(),
});

export const sgoTeamSideSchema = z.object({
  teamID: z.string(),
  names: sgoTeamNamesSchema,
  score: z.number().nullable().optional(),
});
export type SgoTeamSide = z.infer<typeof sgoTeamSideSchema>;

export const sgoStatusSchema = z.object({
  completed: z.boolean(),
  live: z.boolean(),
  startsAt: z.string(),
});

export const sgoBookmakerOddSchema = z.object({
  odds: z.string().optional(),
  spread: z.string().optional(),
  overUnder: z.string().optional(),
  available: z.boolean().optional(),
});

export const sgoOddEntrySchema = z.object({
  oddID: z.string(),
  statID: z.string(),
  statEntityID: z.string(),
  periodID: z.string(),
  betTypeID: z.string(),
  sideID: z.string(),
  fairOdds: z.string().optional(),
  byBookmaker: z.record(sgoBookmakerOddSchema).optional(),
});
export type SgoOddEntry = z.infer<typeof sgoOddEntrySchema>;

export const sgoEventSchema = z.object({
  eventID: z.string(),
  teams: z.object({ home: sgoTeamSideSchema, away: sgoTeamSideSchema }),
  status: sgoStatusSchema,
  // Upcoming games return results: {} (no `game` key yet) rather than
  // omitting `results` or nulling it -- confirmed live, not guessed.
  results: z.object({ game: z.record(z.unknown()).optional() }).nullable().optional(),
  odds: z.record(sgoOddEntrySchema).optional(),
});
export type SgoEvent = z.infer<typeof sgoEventSchema>;

export const sgoEventsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(sgoEventSchema),
  nextCursor: z.string().nullable().optional(),
});

/** Real numbers trusted for pace/rating math, from a completed event's results.game.{home,away}. */
export const sgoBoxTeamStatsSchema = z.object({
  points: z.number(),
  fieldGoalsAttempted: z.number(),
  offensiveRebounds: z.number(),
  turnovers: z.number(),
  freeThrowsAttempted: z.number(),
});

/** Team-level moneyline/spread/total oddIDs; player props use other statEntityID/statID values. */
export const TEAM_MARKET_BET_TYPES = new Set(["ml", "sp", "ou"]);
export const TEAM_MARKET_ENTITIES = new Set(["home", "away", "all"]);
export const betTypeToMarket: Record<string, "moneyline" | "spread" | "total"> = {
  ml: "moneyline",
  sp: "spread",
  ou: "total",
};
