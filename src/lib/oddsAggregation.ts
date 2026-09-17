import type { OddsMarket, OddsSnapshotRow } from "./schemas/db";

export interface BestLine {
  market: OddsMarket;
  side: string | null;
  line: number | null;
  price: number;
  fairPrice: number | null;
  book: string;
}

interface GroupKeyed {
  key: string;
  market: OddsMarket;
  side: string | null;
  book: string;
  line: number | null;
  price: number;
  fairPrice: number | null;
  capturedAt: number;
}

/**
 * Reduces a game's raw odds snapshots down to one "best available line" per
 * market/side: the consensus line (the value most books are offering) at
 * the best price found for it. Only the most recent snapshot per
 * book/market/side is considered, since snapshots are append-only history.
 */
export function computeBestLines(snapshots: OddsSnapshotRow[]): BestLine[] {
  const latestByBookMarketSide = new Map<string, GroupKeyed>();

  for (const s of snapshots) {
    const key = `${s.book}::${s.market}::${s.side ?? ""}`;
    const capturedAt = new Date(s.captured_at).getTime();
    const existing = latestByBookMarketSide.get(key);
    if (!existing || capturedAt > existing.capturedAt) {
      latestByBookMarketSide.set(key, {
        key,
        market: s.market,
        side: s.side,
        book: s.book,
        line: s.line,
        price: s.price ?? 0,
        fairPrice: s.fair_price,
        capturedAt,
      });
    }
  }

  const byMarketSide = new Map<string, GroupKeyed[]>();
  for (const entry of latestByBookMarketSide.values()) {
    const groupKey = `${entry.market}::${entry.side ?? ""}`;
    const group = byMarketSide.get(groupKey) ?? [];
    group.push(entry);
    byMarketSide.set(groupKey, group);
  }

  const results: BestLine[] = [];
  for (const group of byMarketSide.values()) {
    const consensusLine = modeLine(group.map((g) => g.line));
    const atConsensus = group.filter((g) => g.line === consensusLine);
    const best = atConsensus.reduce((a, b) => (b.price > a.price ? b : a));
    results.push({
      market: best.market,
      side: best.side,
      line: best.line,
      price: best.price,
      fairPrice: best.fairPrice,
      book: best.book,
    });
  }

  return results;
}

/** Most frequent line value in the group; ties broken by the smallest value. */
function modeLine(lines: Array<number | null>): number | null {
  const counts = new Map<number | null, number>();
  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  let bestLine: number | null = null;
  let bestCount = -1;
  for (const [line, count] of counts) {
    if (count > bestCount || (count === bestCount && (line ?? -Infinity) < (bestLine ?? -Infinity))) {
      bestLine = line;
      bestCount = count;
    }
  }
  return bestLine;
}
