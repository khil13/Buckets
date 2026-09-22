import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { buildPlayerContext, type PlayerContext, type PropStatKey } from "../lib/playerContext";
import { gameRowSchema, playerGameStatRowSchema, playerRowSchema } from "../lib/schemas/db";

export interface UsePlayerDetailOptions {
  statKey?: PropStatKey;
  line?: number | null;
  opponentTeamId?: string | null;
}

export function usePlayerDetail(playerId: string | undefined, options: UsePlayerDetailOptions = {}) {
  const statKey = options.statKey ?? "points";
  const line = options.line ?? null;
  const opponentTeamId = options.opponentTeamId ?? null;

  return useQuery({
    queryKey: ["player-detail", playerId, statKey, line, opponentTeamId],
    enabled: playerId != null,
    queryFn: async (): Promise<PlayerContext> => {
      if (playerId == null) throw new Error("playerId is required");

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("*")
        .eq("id", playerId)
        .single();
      if (playerError) throw playerError;
      const player = playerRowSchema.parse(playerData);

      const { data: statsData, error: statsError } = await supabase
        .from("player_game_stats")
        .select("*")
        .eq("player_id", playerId);
      if (statsError) throw statsError;
      const stats = z.array(playerGameStatRowSchema).parse(statsData ?? []);

      const gameIds = Array.from(new Set(stats.map((s) => s.game_id)));
      const gamesResult =
        gameIds.length > 0
          ? await supabase.from("games").select("*").in("id", gameIds)
          : { data: [] as unknown[], error: null };
      if (gamesResult.error) throw gamesResult.error;
      const games = z.array(gameRowSchema).parse(gamesResult.data ?? []);
      const gamesById = new Map(games.map((g) => [g.id, g]));

      const entries = stats.flatMap((s) => {
        const game = gamesById.get(s.game_id);
        return game ? [{ game, stat: s }] : [];
      });

      return buildPlayerContext(player, entries, statKey, { line, opponentTeamId });
    },
  });
}
