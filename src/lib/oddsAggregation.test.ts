import { describe, expect, it } from "vitest";
import { computeBestLines } from "./oddsAggregation";
import type { OddsSnapshotRow } from "./schemas/db";

function snapshot(overrides: Partial<OddsSnapshotRow>): OddsSnapshotRow {
  return {
    id: 1,
    game_id: "game-1",
    book: "draftkings",
    market: "spread",
    side: "home",
    line: -3.5,
    price: -110,
    fair_price: 100,
    captured_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeBestLines", () => {
  it("picks the best price at the consensus line", () => {
    const snapshots = [
      snapshot({ id: 1, book: "draftkings", line: -3.5, price: -110, captured_at: "2025-01-01T00:00:00Z" }),
      snapshot({ id: 2, book: "fanduel", line: -3.5, price: -105, captured_at: "2025-01-01T00:01:00Z" }),
      snapshot({ id: 3, book: "caesars", line: -4, price: 100, captured_at: "2025-01-01T00:02:00Z" }),
    ];

    const result = computeBestLines(snapshots);
    expect(result).toEqual([
      { market: "spread", side: "home", line: -3.5, price: -105, fairPrice: 100, book: "fanduel" },
    ]);
  });

  it("only uses the latest snapshot per book/market/side", () => {
    const snapshots = [
      snapshot({ id: 1, book: "draftkings", line: -3.5, price: -120, captured_at: "2025-01-01T00:00:00Z" }),
      snapshot({ id: 2, book: "draftkings", line: -3, price: -110, captured_at: "2025-01-01T01:00:00Z" }),
    ];

    const result = computeBestLines(snapshots);
    expect(result).toEqual([
      { market: "spread", side: "home", line: -3, price: -110, fairPrice: 100, book: "draftkings" },
    ]);
  });

  it("groups markets and sides independently", () => {
    const snapshots = [
      snapshot({ id: 1, market: "moneyline", side: "home", line: null, price: -150, book: "draftkings" }),
      snapshot({ id: 2, market: "moneyline", side: "away", line: null, price: 130, book: "draftkings" }),
      snapshot({ id: 3, market: "total", side: "over", line: 220.5, price: -105, book: "fanduel" }),
    ];

    const result = computeBestLines(snapshots);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({
      market: "moneyline",
      side: "home",
      line: null,
      price: -150,
      fairPrice: 100,
      book: "draftkings",
    });
    expect(result).toContainEqual({
      market: "moneyline",
      side: "away",
      line: null,
      price: 130,
      fairPrice: 100,
      book: "draftkings",
    });
    expect(result).toContainEqual({
      market: "total",
      side: "over",
      line: 220.5,
      price: -105,
      fairPrice: 100,
      book: "fanduel",
    });
  });

  it("returns an empty array for no snapshots", () => {
    expect(computeBestLines([])).toEqual([]);
  });
});
