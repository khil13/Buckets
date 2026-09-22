import { useParams, useSearchParams } from "react-router-dom";
import { usePlayerDetail } from "../hooks/usePlayerDetail";
import { isPropStatKey, type PropStatKey } from "../lib/playerContext";
import { formatPercent, formatPropStat } from "../lib/format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-bucket-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

// Simple CSS bar trend, not a Recharts chart yet -- Recharts is reserved
// for Phase 3's line-movement chart per CLAUDE.md's stack, and pulling it
// in just for these small trends would be premature for Phase 2.
function TrendPanel({ title, values }: { title: string; values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="rounded-lg border border-bucket-border bg-bucket-surface p-4">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-bucket-muted">{title}</h2>
      {values.length === 0 ? (
        <p className="text-sm text-bucket-muted">—</p>
      ) : (
        <div className="flex h-16 items-end gap-1">
          {values.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-bucket-orange"
              style={{ height: `${Math.max((v / max) * 100, 4)}%` }}
              title={v.toFixed(1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayerDetail() {
  const { playerId } = useParams();
  const [searchParams] = useSearchParams();

  const statParam = searchParams.get("stat");
  const statKey: PropStatKey = statParam && isPropStatKey(statParam) ? statParam : "points";
  const lineParam = searchParams.get("line");
  const line = lineParam ? Number(lineParam) : null;
  const opponentTeamId = searchParams.get("opponent");

  const { data, isLoading, isError, error } = usePlayerDetail(playerId, { statKey, line, opponentTeamId });

  if (isLoading) {
    return <p className="text-sm text-bucket-muted">Loading player…</p>;
  }

  if (isError || !data) {
    return (
      <p className="rounded-lg border border-bucket-border bg-bucket-surface p-4 text-sm text-bucket-loss">
        Couldn't load this player: {error instanceof Error ? error.message : "unknown error"}
      </p>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">{data.player.name}</h1>
      <p className="mb-4 text-sm text-bucket-muted">
        {formatPropStat(statKey)}
        {line != null ? ` — line ${line}` : ""}
      </p>

      <div className="rounded-lg border border-bucket-border bg-bucket-surface p-4">
        <dl className="space-y-2 text-sm">
          <Row label="Games played" value={String(data.gamesPlayed)} />
          <Row label="Season avg" value={data.seasonAvg != null ? data.seasonAvg.toFixed(1) : "—"} />
          <Row label="Last 5 avg" value={data.last5Avg != null ? data.last5Avg.toFixed(1) : "—"} />
          <Row label="Last 10 avg" value={data.last10Avg != null ? data.last10Avg.toFixed(1) : "—"} />
          <Row label="Hit rate vs. line" value={data.hitRate != null ? formatPercent(data.hitRate) : "—"} />
          <Row label="Home avg" value={data.homeAvg != null ? data.homeAvg.toFixed(1) : "—"} />
          <Row label="Away avg" value={data.awayAvg != null ? data.awayAvg.toFixed(1) : "—"} />
          {opponentTeamId && (
            <Row label="Vs this opponent" value={data.vsOpponentAvg != null ? data.vsOpponentAvg.toFixed(1) : "—"} />
          )}
        </dl>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TrendPanel title="Minutes trend" values={data.minutesTrend} />
        <TrendPanel title="Usage trend" values={data.usageTrend} />
      </div>

      <p className="mt-4 text-xs text-bucket-muted">
        Usage trend is a simple shot/possession-involvement count (FGA + 0.44×FTA + TOV), not a normalized
        usage-rate percentage — that needs on/off-court possession data this app doesn't have.
      </p>
    </div>
  );
}
