import { z } from "zod";

/**
 * Shapes for balldontlie's /games endpoint (schedule + final scores).
 * Written from public API docs, not a live response — this sandbox's
 * network egress blocks docs.balldontlie.io. Verify field names against a
 * real response once an API key is added, and adjust only this file.
 */
export const bdlTeamSchema = z.object({
  id: z.number(),
  abbreviation: z.string(),
  city: z.string(),
  conference: z.string(),
  division: z.string(),
  full_name: z.string(),
  name: z.string(),
});
export type BdlTeam = z.infer<typeof bdlTeamSchema>;

export const bdlGameSchema = z.object({
  id: z.number(),
  date: z.string(),
  season: z.number(),
  status: z.string(),
  postseason: z.boolean(),
  home_team_score: z.number(),
  visitor_team_score: z.number(),
  home_team: bdlTeamSchema,
  visitor_team: bdlTeamSchema,
});
export type BdlGame = z.infer<typeof bdlGameSchema>;

export const bdlGamesResponseSchema = z.object({
  data: z.array(bdlGameSchema),
  meta: z
    .object({
      next_cursor: z.number().nullable().optional(),
      per_page: z.number().optional(),
    })
    .optional(),
});
export type BdlGamesResponse = z.infer<typeof bdlGamesResponseSchema>;

/** balldontlie's "Final" is the only status string we treat as game-over. */
export function isFinal(status: string): boolean {
  return status.trim().toLowerCase() === "final";
}
