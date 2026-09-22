import { describe, expect, it } from "vitest";
import { computeBestPlayerProps } from "./propAggregation";
import type { PlayerPropSnapshotRow } from "./schemas/db";

function snapshot(overrides: Partial<PlayerPropSnapshotRow>): PlayerPropSnapshotRow {
  return {
    id: 1,
    game_id: "game-1",
    player_id: "JAYSON_TATUM_1_NBA",
    stat: "points",
    book: "draftkings",
    side: "over",
    line: 24.5,
    price: -110,
    fair_price: 100,
    captured_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeBestPlayerProps", () => {
  it("picks the best price at the consensus line for a player/stat/side", () => {
    const snapshots = [
      snapshot({ id: 1, book: "draftkings", line: 24.5, price: -110 }),
      snapshot({ id: 2, book: "fanduel", line: 24.5, price: -105, captured_at: "2025-01-01T00:01:00Z" }),
      snapshot({ id: 3, book: "caesars", line: 25, price: 100, captured_at: "2025-01-01T00:02:00Z" }),
    ];

    const result = computeBestPlayerProps(snapshots);
    expect(result).toEqual([
      {
        gameId: "game-1",
        playerId: "JAYSON_TATUM_1_NBA",
        stat: "points",
        side: "over",
        line: 24.5,
        price: -105,
        fairPrice: 100,
        book: "fanduel",
      },
    ]);
  });

  it("keeps games, players, stats, and sides independent", () => {
    const snapshots = [
      snapshot({ id: 1, game_id: "game-1", player_id: "PLAYER_A", stat: "points", side: "over" }),
      snapshot({ id: 2, game_id: "game-2", player_id: "PLAYER_A", stat: "points", side: "over" }),
      snapshot({ id: 3, game_id: "game-1", player_id: "PLAYER_B", stat: "points", side: "over" }),
      snapshot({ id: 4, game_id: "game-1", player_id: "PLAYER_A", stat: "rebounds", side: "over" }),
      snapshot({ id: 5, game_id: "game-1", player_id: "PLAYER_A", stat: "points", side: "under" }),
    ];

    const result = computeBestPlayerProps(snapshots);
    expect(result).toHaveLength(5);
  });

  it("only uses the latest snapshot per book", () => {
    const snapshots = [
      snapshot({ id: 1, book: "draftkings", price: -120, captured_at: "2025-01-01T00:00:00Z" }),
      snapshot({ id: 2, book: "draftkings", price: -105, captured_at: "2025-01-01T01:00:00Z" }),
    ];

    const result = computeBestPlayerProps(snapshots);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(-105);
  });

  it("returns an empty array for no snapshots", () => {
    expect(computeBestPlayerProps([])).toEqual([]);
  });
});
