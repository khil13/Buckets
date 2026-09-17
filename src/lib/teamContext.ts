import { getRestContext, type RestContext } from "./restDays";
import type { GameRow, TeamGameBoxScoreRow, TeamRow } from "./schemas/db";

export interface Record_ {
  wins: number;
  losses: number;
}

export interface TeamContext {
  team: TeamRow;
  record: Record_;
  /** Most recent up to 10 results, oldest first. */
  last10: Array<"W" | "L">;
  homeSplit: Record_;
  awaySplit: Record_;
  rest: RestContext;
  avgPtsFor: number | null;
  avgPtsAgainst: number | null;
  paceEst: number | null;
}

/**
 * Builds a team's context (record, form, splits, rest, rating proxies) for
 * an upcoming/target game, from that team's other games this season.
 *
 * @param teamGames all of this team's games (any status), excluding the target game
 * @param boxScores this team's box score rows across those games
 */
export function buildTeamContext(
  team: TeamRow,
  teamId: number,
  teamGames: GameRow[],
  targetGame: GameRow,
  boxScores: TeamGameBoxScoreRow[],
): TeamContext {
  const finished = teamGames
    .filter((g) => g.id !== targetGame.id && g.status === "final")
    .map((g) => {
      const isHome = g.home_team_id === teamId;
      const teamScore = isHome ? g.home_score : g.away_score;
      const oppScore = isHome ? g.away_score : g.home_score;
      return { game: g, isHome, win: (teamScore ?? 0) > (oppScore ?? 0) };
    })
    .sort((a, b) => (a.game.game_date < b.game.game_date ? 1 : -1)); // newest first

  const tally = (rows: typeof finished): Record_ => ({
    wins: rows.filter((r) => r.win).length,
    losses: rows.filter((r) => !r.win).length,
  });

  const last10 = [...finished]
    .slice(0, 10)
    .reverse()
    .map((r) => (r.win ? "W" : "L") as "W" | "L");

  const rest = getRestContext(
    teamGames.filter((g) => g.id !== targetGame.id).map((g) => g.game_date),
    targetGame.game_date,
  );

  const teamBoxScores = boxScores.filter((b) => b.team_id === teamId);

  return {
    team,
    record: tally(finished),
    last10,
    homeSplit: tally(finished.filter((r) => r.isHome)),
    awaySplit: tally(finished.filter((r) => !r.isHome)),
    rest,
    avgPtsFor: average(teamBoxScores.map((b) => b.pts)),
    avgPtsAgainst: average(teamBoxScores.map((b) => b.opp_pts)),
    paceEst: average(teamBoxScores.map((b) => b.pace_est)),
  };
}

function average(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
