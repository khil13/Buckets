import type { GameRow, PlayerGameStatRow, PlayerRow } from "./schemas/db";

/** Single-stat and additive-combo prop markets Phase 2 covers (excludes yes/no markets like double-double). */
export type PropStatKey =
  | "points"
  | "rebounds"
  | "assists"
  | "three_pointers_made"
  | "points_assists"
  | "points_rebounds"
  | "rebounds_assists"
  | "points_rebounds_assists";

export interface PlayerGameEntry {
  game: GameRow;
  stat: PlayerGameStatRow;
}

export interface PlayerContext {
  player: PlayerRow;
  gamesPlayed: number;
  seasonAvg: number | null;
  last5Avg: number | null;
  last10Avg: number | null;
  /** Fraction of games where the stat value was strictly over the given line. */
  hitRate: number | null;
  /** Minutes per game, oldest to newest, most recent 10. */
  minutesTrend: number[];
  /**
   * A simple shot/possession-involvement count (FGA + 0.44*FTA + TOV) per
   * game, oldest to newest, most recent 10 -- not a normalized usage-rate
   * percentage, which needs on/off-court possession data this app doesn't
   * have. Labeled as a trend, not a rate, wherever it's shown.
   */
  usageTrend: number[];
  vsOpponentAvg: number | null;
  homeAvg: number | null;
  awayAvg: number | null;
}

/**
 * Builds a player's prop context (averages, hit rate, minutes/usage trend,
 * home/away and vs-opponent splits) for a given stat from their game log.
 */
export function buildPlayerContext(
  player: PlayerRow,
  entries: PlayerGameEntry[],
  statKey: PropStatKey,
  options: { line?: number | null; opponentTeamId?: string | null } = {},
): PlayerContext {
  const newestFirst = [...entries].sort((a, b) => (a.game.game_date < b.game.game_date ? 1 : -1));

  const valueOf = (e: PlayerGameEntry) => statValue(e.stat, statKey);
  const values = newestFirst.map(valueOf).filter((v): v is number => v != null);

  const last5 = values.slice(0, 5);
  const last10 = values.slice(0, 10);

  const hitRate =
    options.line != null && values.length > 0
      ? values.filter((v) => v > options.line!).length / values.length
      : null;

  const oldestFirst = [...newestFirst].reverse();
  const recentOldestFirst = oldestFirst.slice(-10);
  const minutesTrend = recentOldestFirst.map((e) => e.stat.minutes ?? 0);
  const usageTrend = recentOldestFirst.map((e) => possessionInvolvement(e.stat));

  const homeEntries = newestFirst.filter(isHomeEntry);
  const awayEntries = newestFirst.filter((e) => !isHomeEntry(e));
  const opponentEntries = options.opponentTeamId
    ? newestFirst.filter((e) => opponentOf(e) === options.opponentTeamId)
    : [];

  return {
    player,
    gamesPlayed: values.length,
    seasonAvg: average(values),
    last5Avg: average(last5),
    last10Avg: average(last10),
    hitRate,
    minutesTrend,
    usageTrend,
    vsOpponentAvg: options.opponentTeamId
      ? average(opponentEntries.map(valueOf).filter((v): v is number => v != null))
      : null,
    homeAvg: average(homeEntries.map(valueOf).filter((v): v is number => v != null)),
    awayAvg: average(awayEntries.map(valueOf).filter((v): v is number => v != null)),
  };
}

export const PROP_STAT_KEYS: PropStatKey[] = [
  "points",
  "rebounds",
  "assists",
  "three_pointers_made",
  "points_assists",
  "points_rebounds",
  "rebounds_assists",
  "points_rebounds_assists",
];

export function isPropStatKey(value: string): value is PropStatKey {
  return (PROP_STAT_KEYS as string[]).includes(value);
}

/** Exported for the prop board, which computes hit rate per row directly rather than via buildPlayerContext. */
export function getPropStatValue(stat: PlayerGameStatRow, key: PropStatKey): number | null {
  return statValue(stat, key);
}

function statValue(stat: PlayerGameStatRow, key: PropStatKey): number | null {
  switch (key) {
    case "points":
      return stat.points;
    case "rebounds":
      return stat.rebounds;
    case "assists":
      return stat.assists;
    case "three_pointers_made":
      return stat.three_pointers_made;
    case "points_assists":
      return sumOrNull([stat.points, stat.assists]);
    case "points_rebounds":
      return sumOrNull([stat.points, stat.rebounds]);
    case "rebounds_assists":
      return sumOrNull([stat.rebounds, stat.assists]);
    case "points_rebounds_assists":
      return sumOrNull([stat.points, stat.rebounds, stat.assists]);
  }
}

function sumOrNull(values: Array<number | null>): number | null {
  if (values.some((v) => v == null)) return null;
  return values.reduce((a: number, b) => a + (b as number), 0);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function possessionInvolvement(stat: PlayerGameStatRow): number {
  return (stat.field_goals_attempted ?? 0) + 0.44 * (stat.free_throws_attempted ?? 0) + (stat.turnovers ?? 0);
}

function isHomeEntry(e: PlayerGameEntry): boolean {
  return e.game.home_team_id === e.stat.team_id;
}

function opponentOf(e: PlayerGameEntry): string | null {
  if (e.stat.team_id == null) return null;
  return e.game.home_team_id === e.stat.team_id ? e.game.away_team_id : e.game.home_team_id;
}
