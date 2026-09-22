import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { computeBestPlayerProps, type BestPlayerProp } from "../lib/propAggregation";
import { getPropStatValue, isPropStatKey } from "../lib/playerContext";
import {
  gameRowSchema,
  playerGameStatRowSchema,
  playerPropSnapshotRowSchema,
  playerRowSchema,
  teamRowSchema,
  type GameRow,
  type PlayerGameStatRow,
  type PlayerRow,
  type TeamRow,
} from "../lib/schemas/db";

export interface PropBoardRow {
  best: BestPlayerProp;
  player: PlayerRow;
  game: GameRow;
  opponent: TeamRow | null;
  isHome: boolean;
  /** Season average for the row's stat, or null for yes/no props (double/triple-double). */
  seasonAvg: number | null;
  /** Fraction of this season's games where the stat landed on the row's side of the line. */
  hitRate: number | null;
  /** seasonAvg - line: positive means the player's average clears an "over" line. Not a model edge. */
  gap: number | null;
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function usePropBoard() {
  return useQuery({
    queryKey: ["prop-board"],
    queryFn: async (): Promise<PropBoardRow[]> => {
      const date = todayIsoDate();

      const { data: gamesData, error: gamesError } = await supabase.from("games").select("*").eq("game_date", date);
      if (gamesError) throw gamesError;
      const games = z.array(gameRowSchema).parse(gamesData ?? []);
      if (games.length === 0) return [];
      const gamesById = new Map(games.map((g) => [g.id, g]));

      const { data: propsData, error: propsError } = await supabase
        .from("player_prop_snapshots")
        .select("*")
        .in(
          "game_id",
          games.map((g) => g.id),
        );
      if (propsError) throw propsError;
      const propSnapshots = z.array(playerPropSnapshotRowSchema).parse(propsData ?? []);
      if (propSnapshots.length === 0) return [];

      const best = computeBestPlayerProps(propSnapshots);
      const playerIds = Array.from(new Set(best.map((b) => b.playerId)));

      const teamIds = Array.from(new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter((id): id is string => id != null)));

      const [playersResult, statsResult, teamsResult] = await Promise.all([
        supabase.from("players").select("*").in("id", playerIds),
        supabase.from("player_game_stats").select("*").in("player_id", playerIds),
        supabase.from("teams").select("*").in("id", teamIds),
      ]);
      if (playersResult.error) throw playersResult.error;
      if (statsResult.error) throw statsResult.error;
      if (teamsResult.error) throw teamsResult.error;

      const players = z.array(playerRowSchema).parse(playersResult.data ?? []);
      const playersById = new Map(players.map((p) => [p.id, p]));
      const teams = z.array(teamRowSchema).parse(teamsResult.data ?? []);
      const teamsById = new Map(teams.map((t) => [t.id, t]));
      const stats = z.array(playerGameStatRowSchema).parse(statsResult.data ?? []);
      const statsByPlayer = new Map<string, PlayerGameStatRow[]>();
      for (const s of stats) {
        const arr = statsByPlayer.get(s.player_id) ?? [];
        arr.push(s);
        statsByPlayer.set(s.player_id, arr);
      }

      return best.flatMap((b) => {
        const player = playersById.get(b.playerId);
        const game = gamesById.get(b.gameId);
        if (!player || !game) return [];

        let seasonAvg: number | null = null;
        let hitRate: number | null = null;
        let gap: number | null = null;

        const stat = b.stat;
        if (isPropStatKey(stat) && (b.side === "over" || b.side === "under")) {
          const values = (statsByPlayer.get(b.playerId) ?? [])
            .map((s) => getPropStatValue(s, stat))
            .filter((v): v is number => v != null);

          if (values.length > 0) {
            seasonAvg = values.reduce((a, v) => a + v, 0) / values.length;
            if (b.line != null) {
              const hits =
                b.side === "over" ? values.filter((v) => v > b.line!).length : values.filter((v) => v < b.line!).length;
              hitRate = hits / values.length;
              gap = seasonAvg - b.line;
            }
          }
        }

        const isHome = game.home_team_id === player.team_id;
        const opponentTeamId = isHome ? game.away_team_id : game.home_team_id;
        const opponent = opponentTeamId != null ? (teamsById.get(opponentTeamId) ?? null) : null;

        return [{ best: b, player, game, opponent, isHome, seasonAvg, hitRate, gap }];
      });
    },
  });
}
