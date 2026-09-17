import { useTodaysGames } from "../hooks/useTodaysGames";
import { GameCard } from "../components/GameCard";
import { SkeletonCard } from "../components/SkeletonCard";

export function Slate() {
  const { data: games, isLoading, isError, error } = useTodaysGames();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Today's Slate</h1>

      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {isError && (
        <p className="rounded-lg border border-bucket-border bg-bucket-surface p-4 text-sm text-bucket-loss">
          Couldn't load today's games: {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}

      {!isLoading && !isError && games?.length === 0 && (
        <p className="rounded-lg border border-bucket-border bg-bucket-surface p-4 text-sm text-bucket-muted">
          No games synced for today yet. The daily sync job populates this once it runs.
        </p>
      )}

      {!isLoading && !isError && games && games.length > 0 && (
        <div className="space-y-3">
          {games.map((g) => (
            <GameCard key={g.game.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
