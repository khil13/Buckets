import { describe, expect, it } from "vitest";
import { buildTeamContext } from "./teamContext";
import type { GameRow, TeamGameBoxScoreRow, TeamRow } from "./schemas/db";

const team: TeamRow = {
  id: "BOSTON_CELTICS_NBA",
  abbreviation: "BOS",
  name: "Celtics",
  full_name: "Boston Celtics",
  conference: null,
  division: null,
};

function game(overrides: Partial<GameRow>): GameRow {
  return {
    id: "game-100",
    season: 2025,
    game_date: "2025-01-10",
    tip_time: null,
    home_team_id: "BOSTON_CELTICS_NBA",
    away_team_id: "OTHER_TEAM_NBA",
    status: "final",
    home_score: 100,
    away_score: 90,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildTeamContext", () => {
  it("computes record, last10, splits and rest from other games", () => {
    const target = game({
      id: "game-5",
      game_date: "2025-01-10",
      status: "scheduled",
      home_score: null,
      away_score: null,
    });
    const otherGames = [
      // Win at home, 3 days before target
      game({
        id: "game-1",
        game_date: "2025-01-07",
        home_team_id: "BOSTON_CELTICS_NBA",
        away_team_id: "OTHER_TEAM_NBA",
        home_score: 110,
        away_score: 100,
      }),
      // Loss on the road, day before target (back-to-back)
      game({
        id: "game-2",
        game_date: "2025-01-09",
        home_team_id: "THIRD_TEAM_NBA",
        away_team_id: "BOSTON_CELTICS_NBA",
        home_score: 120,
        away_score: 100,
      }),
    ];

    const ctx = buildTeamContext(team, "BOSTON_CELTICS_NBA", [...otherGames, target], target, []);

    expect(ctx.record).toEqual({ wins: 1, losses: 1 });
    expect(ctx.last10).toEqual(["W", "L"]);
    expect(ctx.homeSplit).toEqual({ wins: 1, losses: 0 });
    expect(ctx.awaySplit).toEqual({ wins: 0, losses: 1 });
    expect(ctx.rest).toEqual({ restDays: 0, isBackToBack: true });
  });

  it("ignores unfinished games when computing record", () => {
    const target = game({ id: "game-5", game_date: "2025-01-10" });
    const scheduled = game({
      id: "game-6",
      game_date: "2025-01-08",
      status: "scheduled",
      home_score: null,
      away_score: null,
    });

    const ctx = buildTeamContext(team, "BOSTON_CELTICS_NBA", [scheduled, target], target, []);
    expect(ctx.record).toEqual({ wins: 0, losses: 0 });
  });

  it("averages box score stats for the team only", () => {
    const target = game({ id: "game-5" });
    const boxScores: TeamGameBoxScoreRow[] = [
      {
        id: 1,
        game_id: "game-1",
        team_id: "BOSTON_CELTICS_NBA",
        pts: 110,
        opp_pts: 100,
        possessions_est: null,
        pace_est: 98,
        off_rating_est: null,
        def_rating_est: null,
      },
      {
        id: 2,
        game_id: "game-2",
        team_id: "BOSTON_CELTICS_NBA",
        pts: 90,
        opp_pts: 105,
        possessions_est: null,
        pace_est: 100,
        off_rating_est: null,
        def_rating_est: null,
      },
      {
        id: 3,
        game_id: "game-1",
        team_id: "OTHER_TEAM_NBA",
        pts: 100,
        opp_pts: 110,
        possessions_est: null,
        pace_est: 98,
        off_rating_est: null,
        def_rating_est: null,
      },
    ];

    const ctx = buildTeamContext(team, "BOSTON_CELTICS_NBA", [target], target, boxScores);
    expect(ctx.avgPtsFor).toBe(100);
    expect(ctx.avgPtsAgainst).toBe(102.5);
    expect(ctx.paceEst).toBe(99);
  });

  it("returns nulls for averages with no box scores", () => {
    const target = game({ id: "game-5" });
    const ctx = buildTeamContext(team, "BOSTON_CELTICS_NBA", [target], target, []);
    expect(ctx.avgPtsFor).toBeNull();
    expect(ctx.avgPtsAgainst).toBeNull();
    expect(ctx.paceEst).toBeNull();
  });
});
