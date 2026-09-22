import { modeLine } from "./oddsAggregation";
import type { PlayerPropSnapshotRow, PlayerPropStat } from "./schemas/db";

export interface BestPlayerProp {
  gameId: string;
  playerId: string;
  stat: PlayerPropStat;
  side: string;
  line: number | null;
  price: number;
  fairPrice: number | null;
  book: string;
}

interface GroupKeyed {
  gameId: string;
  playerId: string;
  stat: PlayerPropStat;
  side: string;
  book: string;
  line: number | null;
  price: number;
  fairPrice: number | null;
  capturedAt: number;
}

/**
 * Reduces a set of player-prop snapshots down to one "best available line"
 * per game/player/stat/side, same approach as `computeBestLines` for team
 * odds: the consensus line at the best price, using only the most recent
 * snapshot per book.
 */
export function computeBestPlayerProps(snapshots: PlayerPropSnapshotRow[]): BestPlayerProp[] {
  const latestByBookGroup = new Map<string, GroupKeyed>();

  for (const s of snapshots) {
    const key = `${s.book}::${s.game_id}::${s.player_id}::${s.stat}::${s.side}`;
    const capturedAt = new Date(s.captured_at).getTime();
    const existing = latestByBookGroup.get(key);
    if (!existing || capturedAt > existing.capturedAt) {
      latestByBookGroup.set(key, {
        gameId: s.game_id,
        playerId: s.player_id,
        stat: s.stat,
        side: s.side,
        book: s.book,
        line: s.line,
        price: s.price ?? 0,
        fairPrice: s.fair_price,
        capturedAt,
      });
    }
  }

  const byGroup = new Map<string, GroupKeyed[]>();
  for (const entry of latestByBookGroup.values()) {
    const groupKey = `${entry.gameId}::${entry.playerId}::${entry.stat}::${entry.side}`;
    const group = byGroup.get(groupKey) ?? [];
    group.push(entry);
    byGroup.set(groupKey, group);
  }

  const results: BestPlayerProp[] = [];
  for (const group of byGroup.values()) {
    const consensusLine = modeLine(group.map((g) => g.line));
    const atConsensus = group.filter((g) => g.line === consensusLine);
    const best = atConsensus.reduce((a, b) => (b.price > a.price ? b : a));
    results.push({
      gameId: best.gameId,
      playerId: best.playerId,
      stat: best.stat,
      side: best.side,
      line: best.line,
      price: best.price,
      fairPrice: best.fairPrice,
      book: best.book,
    });
  }

  return results;
}
