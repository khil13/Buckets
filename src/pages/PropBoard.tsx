import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePropBoard, type PropBoardRow } from "../hooks/usePropBoard";
import { formatAmericanOdds, formatPercent, formatPropStat } from "../lib/format";

type SortKey = "hitRate" | "gap";

function sortRows(rows: PropBoardRow[], sortKey: SortKey): PropBoardRow[] {
  return [...rows].sort((a, b) => {
    const av = sortKey === "hitRate" ? a.hitRate : a.gap;
    const bv = sortKey === "hitRate" ? b.hitRate : b.gap;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return Math.abs(bv) - Math.abs(av);
  });
}

function PropRow({ row }: { row: PropBoardRow }) {
  const { best, player, opponent, isHome, seasonAvg, hitRate, gap } = row;

  return (
    <Link
      to={`/player/${player.id}?stat=${best.stat}${best.line != null ? `&line=${best.line}` : ""}${opponent ? `&opponent=${opponent.id}` : ""}`}
      className="block rounded-lg border border-bucket-border bg-bucket-surface p-4 transition-colors hover:border-bucket-orange-dim"
    >
      <div className="mb-1 flex items-center justify-between text-sm font-semibold">
        <span>{player.name}</span>
        <span className="text-bucket-muted">{formatPropStat(best.stat)}</span>
      </div>
      <div className="mb-2 text-xs text-bucket-muted">
        {isHome ? "vs" : "@"} {opponent?.abbreviation ?? "—"}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-medium">
          {best.side} {best.line ?? ""} ({formatAmericanOdds(best.price)})
        </span>
        <span className="text-bucket-muted">Avg: {seasonAvg != null ? seasonAvg.toFixed(1) : "—"}</span>
        <span className="text-bucket-muted">Hit rate: {hitRate != null ? formatPercent(hitRate) : "—"}</span>
        <span className="text-bucket-muted">Gap: {gap != null ? gap.toFixed(1) : "—"}</span>
      </div>
    </Link>
  );
}

export function PropBoard() {
  const { data, isLoading, isError, error } = usePropBoard();
  const [sortKey, setSortKey] = useState<SortKey>("hitRate");

  const sorted = useMemo(() => sortRows(data ?? [], sortKey), [data, sortKey]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Prop Board</h1>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setSortKey("hitRate")}
            className={`rounded px-2 py-1 ${sortKey === "hitRate" ? "bg-bucket-orange text-black" : "bg-bucket-surface text-bucket-muted"}`}
          >
            Hit rate
          </button>
          <button
            onClick={() => setSortKey("gap")}
            className={`rounded px-2 py-1 ${sortKey === "gap" ? "bg-bucket-orange text-black" : "bg-bucket-surface text-bucket-muted"}`}
          >
            Gap
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-bucket-muted">Loading props…</p>}

      {isError && (
        <p className="rounded-lg border border-bucket-border bg-bucket-surface p-4 text-sm text-bucket-loss">
          Couldn't load props: {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <p className="rounded-lg border border-bucket-border bg-bucket-surface p-4 text-sm text-bucket-muted">
          No props synced for today yet.
        </p>
      )}

      {!isLoading && !isError && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((row) => (
            <PropRow key={`${row.best.gameId}-${row.best.playerId}-${row.best.stat}-${row.best.side}`} row={row} />
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-bucket-muted">
        "Gap" is season average minus the line — a simple directional signal, not a model edge (that's Phase 3).
        Hit rate is over this season's sample so far.
      </p>
    </div>
  );
}
