import { useParams } from "react-router-dom";
import { useGameDetail } from "../hooks/useGameDetail";
import type { TeamContext } from "../lib/teamContext";
import { formatGameDate } from "../lib/format";

function TeamPanel({ ctx }: { ctx: TeamContext }) {
  return (
    <div className="rounded-lg border border-bucket-border bg-bucket-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{ctx.team.full_name}</h2>

      <dl className="space-y-2 text-sm">
        <Row label="Record" value={`${ctx.record.wins}-${ctx.record.losses}`} />
        <Row
          label="Last 10"
          value={ctx.last10.length > 0 ? ctx.last10.join(" ") : "—"}
        />
        <Row label="Home" value={`${ctx.homeSplit.wins}-${ctx.homeSplit.losses}`} />
        <Row label="Away" value={`${ctx.awaySplit.wins}-${ctx.awaySplit.losses}`} />
        <Row
          label="Rest"
          value={
            ctx.rest.restDays == null
              ? "—"
              : ctx.rest.isBackToBack
                ? "Back-to-back"
                : `${ctx.rest.restDays} day${ctx.rest.restDays === 1 ? "" : "s"}`
          }
        />
        <Row label="Pts for (avg, est.)" value={ctx.avgPtsFor != null ? ctx.avgPtsFor.toFixed(1) : "—"} />
        <Row label="Pts against (avg, est.)" value={ctx.avgPtsAgainst != null ? ctx.avgPtsAgainst.toFixed(1) : "—"} />
        <Row label="Pace (est.)" value={ctx.paceEst != null ? ctx.paceEst.toFixed(1) : "—"} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-bucket-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function GameDetail() {
  const { gameId } = useParams();
  const { data, isLoading, isError, error } = useGameDetail(gameId);

  if (isLoading) {
    return <p className="text-sm text-bucket-muted">Loading matchup…</p>;
  }

  if (isError || !data) {
    return (
      <p className="rounded-lg border border-bucket-border bg-bucket-surface p-4 text-sm text-bucket-loss">
        Couldn't load this game: {error instanceof Error ? error.message : "unknown error"}
      </p>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">
        {data.away.team.abbreviation} @ {data.home.team.abbreviation}
      </h1>
      <p className="mb-4 text-sm text-bucket-muted">{formatGameDate(data.game.game_date)}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TeamPanel ctx={data.away} />
        <TeamPanel ctx={data.home} />
      </div>

      <p className="mt-4 text-xs text-bucket-muted">
        Ratings and pace are rough estimates from box scores, not vendor advanced stats — treat them as
        directional, not precise.
      </p>
    </div>
  );
}
