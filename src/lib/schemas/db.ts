import { z } from "zod";

export const teamRowSchema = z.object({
  id: z.string(),
  abbreviation: z.string(),
  name: z.string(),
  full_name: z.string(),
  conference: z.string().nullable(),
  division: z.string().nullable(),
});
export type TeamRow = z.infer<typeof teamRowSchema>;

export const gameStatusSchema = z.enum(["scheduled", "live", "final"]);
export type GameStatus = z.infer<typeof gameStatusSchema>;

export const gameRowSchema = z.object({
  id: z.string(),
  season: z.number(),
  game_date: z.string(),
  tip_time: z.string().nullable(),
  home_team_id: z.string().nullable(),
  away_team_id: z.string().nullable(),
  status: gameStatusSchema,
  home_score: z.number().nullable(),
  away_score: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type GameRow = z.infer<typeof gameRowSchema>;

export const teamGameBoxScoreRowSchema = z.object({
  id: z.number(),
  game_id: z.string(),
  team_id: z.string(),
  pts: z.number().nullable(),
  opp_pts: z.number().nullable(),
  possessions_est: z.number().nullable(),
  pace_est: z.number().nullable(),
  off_rating_est: z.number().nullable(),
  def_rating_est: z.number().nullable(),
});
export type TeamGameBoxScoreRow = z.infer<typeof teamGameBoxScoreRowSchema>;

export const oddsMarketSchema = z.enum(["spread", "total", "moneyline"]);
export type OddsMarket = z.infer<typeof oddsMarketSchema>;

export const oddsSnapshotRowSchema = z.object({
  id: z.number(),
  game_id: z.string(),
  book: z.string(),
  market: oddsMarketSchema,
  side: z.string().nullable(),
  line: z.number().nullable(),
  price: z.number().nullable(),
  fair_price: z.number().nullable(),
  captured_at: z.string(),
});
export type OddsSnapshotRow = z.infer<typeof oddsSnapshotRowSchema>;

export const playerRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  team_id: z.string().nullable(),
});
export type PlayerRow = z.infer<typeof playerRowSchema>;

export const playerGameStatRowSchema = z.object({
  id: z.number(),
  game_id: z.string(),
  player_id: z.string(),
  team_id: z.string().nullable(),
  minutes: z.number().nullable(),
  points: z.number().nullable(),
  rebounds: z.number().nullable(),
  assists: z.number().nullable(),
  steals: z.number().nullable(),
  blocks: z.number().nullable(),
  turnovers: z.number().nullable(),
  three_pointers_made: z.number().nullable(),
  field_goals_made: z.number().nullable(),
  field_goals_attempted: z.number().nullable(),
  free_throws_attempted: z.number().nullable(),
});
export type PlayerGameStatRow = z.infer<typeof playerGameStatRowSchema>;

export const playerPropStatSchema = z.enum([
  "points",
  "rebounds",
  "assists",
  "three_pointers_made",
  "points_assists",
  "points_rebounds",
  "rebounds_assists",
  "points_rebounds_assists",
  "double_double",
  "triple_double",
]);
export type PlayerPropStat = z.infer<typeof playerPropStatSchema>;

export const playerPropSnapshotRowSchema = z.object({
  id: z.number(),
  game_id: z.string(),
  player_id: z.string(),
  stat: playerPropStatSchema,
  book: z.string(),
  side: z.string(),
  line: z.number().nullable(),
  price: z.number().nullable(),
  fair_price: z.number().nullable(),
  captured_at: z.string(),
});
export type PlayerPropSnapshotRow = z.infer<typeof playerPropSnapshotRowSchema>;

export const syncLogStatusSchema = z.enum(["success", "partial", "error"]);

export const syncLogRowSchema = z.object({
  id: z.number(),
  job_name: z.string(),
  run_at: z.string(),
  status: syncLogStatusSchema,
  detail: z.unknown().nullable(),
});
export type SyncLogRow = z.infer<typeof syncLogRowSchema>;

/** Minimal hand-written schema covering the tables this app queries. */
export interface Database {
  public: {
    Tables: {
      teams: {
        Row: TeamRow;
        Insert: TeamRow;
        Update: Partial<TeamRow>;
      };
      games: {
        Row: GameRow;
        Insert: Omit<GameRow, "created_at" | "updated_at">;
        Update: Partial<GameRow>;
      };
      team_game_box_scores: {
        Row: TeamGameBoxScoreRow;
        Insert: Omit<TeamGameBoxScoreRow, "id">;
        Update: Partial<TeamGameBoxScoreRow>;
      };
      odds_snapshots: {
        Row: OddsSnapshotRow;
        Insert: Omit<OddsSnapshotRow, "id" | "captured_at"> & { captured_at?: string };
        Update: Partial<OddsSnapshotRow>;
      };
      players: {
        Row: PlayerRow;
        Insert: PlayerRow;
        Update: Partial<PlayerRow>;
      };
      player_game_stats: {
        Row: PlayerGameStatRow;
        Insert: Omit<PlayerGameStatRow, "id">;
        Update: Partial<PlayerGameStatRow>;
      };
      player_prop_snapshots: {
        Row: PlayerPropSnapshotRow;
        Insert: Omit<PlayerPropSnapshotRow, "id" | "captured_at"> & { captured_at?: string };
        Update: Partial<PlayerPropSnapshotRow>;
      };
      sync_log: {
        Row: SyncLogRow;
        Insert: Omit<SyncLogRow, "id" | "run_at"> & { run_at?: string };
        Update: Partial<SyncLogRow>;
      };
    };
  };
}
