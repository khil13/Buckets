import { z } from "zod";

/**
 * Shapes for The Odds API v4 `/sports/basketball_nba/odds` endpoint
 * (h2h/spreads/totals only in Phase 1 — player props are Phase 2).
 * Written from public API docs, not a live response — this sandbox's
 * network egress blocks the-odds-api.com. Verify field names against a
 * real response once an API key is added, and adjust only this file.
 */
export const oddsOutcomeSchema = z.object({
  name: z.string(),
  price: z.number(),
  point: z.number().optional(),
});
export type OddsOutcome = z.infer<typeof oddsOutcomeSchema>;

export const oddsMarketKeySchema = z.enum(["h2h", "spreads", "totals"]);
export type OddsMarketKey = z.infer<typeof oddsMarketKeySchema>;

export const oddsBookMarketSchema = z.object({
  key: oddsMarketKeySchema,
  last_update: z.string(),
  outcomes: z.array(oddsOutcomeSchema),
});

export const oddsBookmakerSchema = z.object({
  key: z.string(),
  title: z.string(),
  last_update: z.string(),
  markets: z.array(oddsBookMarketSchema),
});

export const oddsEventSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(oddsBookmakerSchema),
});
export type OddsEvent = z.infer<typeof oddsEventSchema>;

export const oddsEventsResponseSchema = z.array(oddsEventSchema);

/** Maps our internal market names to The Odds API's market keys. */
export const marketKeyToDbMarket: Record<OddsMarketKey, "moneyline" | "spread" | "total"> = {
  h2h: "moneyline",
  spreads: "spread",
  totals: "total",
};
