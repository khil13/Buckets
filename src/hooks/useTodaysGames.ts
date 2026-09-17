import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { computeBestLines, type BestLine } from "../lib/oddsAggregation";
import { gameRowSchema, oddsSnapshotRowSchema, teamRowSchema, type GameRow, type TeamRow } from "../lib/schemas/db";

export interface SlateGame {
  game: GameRow;
  homeTeam: TeamRow;
  awayTeam: TeamRow;
  bestLines: BestLine[];
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useTodaysGames() {
  return useQuery({
    queryKey: ["todays-games"],
    queryFn: async (): Promise<SlateGame[]> => {
      const date = todayIsoDate();

      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("*")
        .eq("game_date", date)
        .order("tip_time", { ascending: true });
      if (gamesError) throw gamesError;

      const games = z.array(gameRowSchema).parse(gamesData ?? []);
      if (games.length === 0) return [];

      const teamIds = Array.from(
        new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter((id): id is string => id != null)),
      );
      const gameIds = games.map((g) => g.id);

      const [teamsResult, oddsResult] = await Promise.all([
        supabase.from("teams").select("*").in("id", teamIds),
        supabase.from("odds_snapshots").select("*").in("game_id", gameIds),
      ]);
      if (teamsResult.error) throw teamsResult.error;
      if (oddsResult.error) throw oddsResult.error;

      const teams = z.array(teamRowSchema).parse(teamsResult.data ?? []);
      const odds = z.array(oddsSnapshotRowSchema).parse(oddsResult.data ?? []);

      const teamsById = new Map(teams.map((t) => [t.id, t]));
      const oddsByGame = new Map<string, typeof odds>();
      for (const snapshot of odds) {
        const arr = oddsByGame.get(snapshot.game_id) ?? [];
        arr.push(snapshot);
        oddsByGame.set(snapshot.game_id, arr);
      }

      return games.flatMap((game) => {
        const homeTeam = game.home_team_id != null ? teamsById.get(game.home_team_id) : undefined;
        const awayTeam = game.away_team_id != null ? teamsById.get(game.away_team_id) : undefined;
        if (!homeTeam || !awayTeam) return [];
        return [
          {
            game,
            homeTeam,
            awayTeam,
            bestLines: computeBestLines(oddsByGame.get(game.id) ?? []),
          },
        ];
      });
    },
  });
}
