import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { buildTeamContext, type TeamContext } from "../lib/teamContext";
import {
  gameRowSchema,
  teamGameBoxScoreRowSchema,
  teamRowSchema,
  type GameRow,
} from "../lib/schemas/db";

export interface GameDetailData {
  game: GameRow;
  home: TeamContext;
  away: TeamContext;
}

export function useGameDetail(gameId: number | undefined) {
  return useQuery({
    queryKey: ["game-detail", gameId],
    enabled: gameId != null,
    queryFn: async (): Promise<GameDetailData> => {
      if (gameId == null) throw new Error("gameId is required");

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();
      if (gameError) throw gameError;
      const game = gameRowSchema.parse(gameData);

      if (game.home_team_id == null || game.away_team_id == null) {
        throw new Error("Game is missing a home or away team");
      }
      const homeTeamId = game.home_team_id;
      const awayTeamId = game.away_team_id;

      const [teamsResult, homeGamesResult, awayGamesResult] = await Promise.all([
        supabase.from("teams").select("*").in("id", [homeTeamId, awayTeamId]),
        supabase
          .from("games")
          .select("*")
          .eq("season", game.season)
          .or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`),
        supabase
          .from("games")
          .select("*")
          .eq("season", game.season)
          .or(`home_team_id.eq.${awayTeamId},away_team_id.eq.${awayTeamId}`),
      ]);
      if (teamsResult.error) throw teamsResult.error;
      if (homeGamesResult.error) throw homeGamesResult.error;
      if (awayGamesResult.error) throw awayGamesResult.error;

      const teams = z.array(teamRowSchema).parse(teamsResult.data ?? []);
      const homeTeamGames = z.array(gameRowSchema).parse(homeGamesResult.data ?? []);
      const awayTeamGames = z.array(gameRowSchema).parse(awayGamesResult.data ?? []);

      const homeTeam = teams.find((t) => t.id === homeTeamId);
      const awayTeam = teams.find((t) => t.id === awayTeamId);
      if (!homeTeam || !awayTeam) throw new Error("Home or away team not found");

      const relevantGameIds = Array.from(new Set([...homeTeamGames, ...awayTeamGames].map((g) => g.id)));
      const { data: boxScoresData, error: boxScoresError } = await supabase
        .from("team_game_box_scores")
        .select("*")
        .in("game_id", relevantGameIds);
      if (boxScoresError) throw boxScoresError;
      const boxScores = z.array(teamGameBoxScoreRowSchema).parse(boxScoresData ?? []);

      return {
        game,
        home: buildTeamContext(homeTeam, homeTeamId, homeTeamGames, game, boxScores),
        away: buildTeamContext(awayTeam, awayTeamId, awayTeamGames, game, boxScores),
      };
    },
  });
}
