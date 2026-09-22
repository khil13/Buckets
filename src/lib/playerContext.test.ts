import { describe, expect, it } from "vitest";
import { buildPlayerContext, type PlayerGameEntry } from "./playerContext";
import type { GameRow, PlayerGameStatRow, PlayerRow } from "./schemas/db";

const player: PlayerRow = {
  id: "JAYSON_TATUM_1_NBA",
  name: "Jayson Tatum",
  team_id: "BOSTON_CELTICS_NBA",
};

function game(overrides: Partial<GameRow>): GameRow {
  return {
    id: "game-1",
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

function stat(overrides: Partial<PlayerGameStatRow>): PlayerGameStatRow {
  return {
    id: 1,
    game_id: "game-1",
    player_id: "JAYSON_TATUM_1_NBA",
    team_id: "BOSTON_CELTICS_NBA",
    minutes: 34,
    points: 25,
    rebounds: 8,
    assists: 4,
    steals: 1,
    blocks: 1,
    turnovers: 2,
    three_pointers_made: 3,
    field_goals_made: 9,
    field_goals_attempted: 18,
    free_throws_attempted: 5,
    ...overrides,
  };
}

function entry(gameOverrides: Partial<GameRow>, statOverrides: Partial<PlayerGameStatRow>): PlayerGameEntry {
  return { game: game(gameOverrides), stat: stat(statOverrides) };
}

describe("buildPlayerContext", () => {
  it("computes season/last5/last10 averages and hit rate for a simple stat", () => {
    const entries: PlayerGameEntry[] = [
      entry({ id: "g1", game_date: "2025-01-01" }, { game_id: "g1", points: 20 }),
      entry({ id: "g2", game_date: "2025-01-03" }, { game_id: "g2", points: 30 }),
      entry({ id: "g3", game_date: "2025-01-05" }, { game_id: "g3", points: 25 }),
    ];

    const ctx = buildPlayerContext(player, entries, "points", { line: 24.5 });

    expect(ctx.gamesPlayed).toBe(3);
    expect(ctx.seasonAvg).toBeCloseTo(25);
    expect(ctx.last5Avg).toBeCloseTo(25);
    expect(ctx.last10Avg).toBeCloseTo(25);
    expect(ctx.hitRate).toBeCloseTo(2 / 3);
  });

  it("computes additive combo stats (points+rebounds+assists)", () => {
    const entries: PlayerGameEntry[] = [
      entry({ id: "g1", game_date: "2025-01-01" }, { game_id: "g1", points: 20, rebounds: 5, assists: 3 }),
    ];

    const ctx = buildPlayerContext(player, entries, "points_rebounds_assists");
    expect(ctx.seasonAvg).toBe(28);
  });

  it("returns null for combo stats when a component is missing", () => {
    const entries: PlayerGameEntry[] = [
      entry({ id: "g1", game_date: "2025-01-01" }, { game_id: "g1", points: 20, assists: null }),
    ];

    const ctx = buildPlayerContext(player, entries, "points_assists");
    expect(ctx.seasonAvg).toBeNull();
    expect(ctx.gamesPlayed).toBe(0);
  });

  it("splits home vs away and computes a vs-opponent average", () => {
    const entries: PlayerGameEntry[] = [
      entry(
        { id: "g1", game_date: "2025-01-01", home_team_id: "BOSTON_CELTICS_NBA", away_team_id: "KNICKS_NBA" },
        { game_id: "g1", points: 20, team_id: "BOSTON_CELTICS_NBA" },
      ),
      entry(
        { id: "g2", game_date: "2025-01-03", home_team_id: "LAKERS_NBA", away_team_id: "BOSTON_CELTICS_NBA" },
        { game_id: "g2", points: 30, team_id: "BOSTON_CELTICS_NBA" },
      ),
      entry(
        { id: "g3", game_date: "2025-01-05", home_team_id: "BOSTON_CELTICS_NBA", away_team_id: "KNICKS_NBA" },
        { game_id: "g3", points: 40, team_id: "BOSTON_CELTICS_NBA" },
      ),
    ];

    const ctx = buildPlayerContext(player, entries, "points", { opponentTeamId: "KNICKS_NBA" });
    expect(ctx.homeAvg).toBe(30); // (20 + 40) / 2
    expect(ctx.awayAvg).toBe(30);
    expect(ctx.vsOpponentAvg).toBe(30); // games 1 and 3, both vs Knicks
  });

  it("orders minutes/usage trends oldest to newest and caps at 10", () => {
    const entries: PlayerGameEntry[] = [
      entry({ id: "g1", game_date: "2025-01-01" }, { game_id: "g1", minutes: 20, field_goals_attempted: 10, free_throws_attempted: 0, turnovers: 1 }),
      entry({ id: "g2", game_date: "2025-01-03" }, { game_id: "g2", minutes: 30, field_goals_attempted: 15, free_throws_attempted: 5, turnovers: 2 }),
    ];

    const ctx = buildPlayerContext(player, entries, "points");
    expect(ctx.minutesTrend).toEqual([20, 30]);
    expect(ctx.usageTrend[0]).toBeCloseTo(10 + 0.44 * 0 + 1);
    expect(ctx.usageTrend[1]).toBeCloseTo(15 + 0.44 * 5 + 2);
  });

  it("returns nulls and zero games played for an empty log", () => {
    const ctx = buildPlayerContext(player, [], "points", { line: 20 });
    expect(ctx.gamesPlayed).toBe(0);
    expect(ctx.seasonAvg).toBeNull();
    expect(ctx.hitRate).toBeNull();
    expect(ctx.minutesTrend).toEqual([]);
  });
});
