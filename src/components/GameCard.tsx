import { Link } from "react-router-dom";
import type { SlateGame } from "../hooks/useTodaysGames";
import { formatAmericanOdds, formatLine, formatTipTime } from "../lib/format";

function lineFor(game: SlateGame, market: "spread" | "total" | "moneyline", side: string) {
  return game.bestLines.find((l) => l.market === market && l.side === side);
}

export function GameCard({ game }: { game: SlateGame }) {
  const spread = lineFor(game, "spread", "home");
  const total = lineFor(game, "total", "over");
  const homeMl = lineFor(game, "moneyline", "home");
  const awayMl = lineFor(game, "moneyline", "away");

  return (
    <Link
      to={`/game/${game.game.id}`}
      className="block rounded-lg border border-bucket-border bg-bucket-surface p-4 transition-colors hover:border-bucket-orange-dim"
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-bucket-muted">
        {game.game.tip_time ? formatTipTime(game.game.tip_time) : "TBD"}
      </div>
      <div className="mb-3 flex items-center justify-between text-sm font-semibold">
        <span>
          {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-bucket-muted">
        <span>
          Spread: {spread ? `${formatLine(spread.line ?? 0)} (${formatAmericanOdds(spread.price)})` : "—"}
        </span>
        <span>Total: {total ? `${total.line} (${formatAmericanOdds(total.price)})` : "—"}</span>
        <span>
          ML: {awayMl ? formatAmericanOdds(awayMl.price) : "—"} / {homeMl ? formatAmericanOdds(homeMl.price) : "—"}
        </span>
      </div>
    </Link>
  );
}
