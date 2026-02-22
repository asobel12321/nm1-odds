import { remainingGames } from "@/lib/data";
import { simulateSeason } from "@/lib/simulate";
import type {
  DataFile,
  ForcedOutcomes,
  Game,
  MatchdayImpactGame,
  MatchdayImpact,
  SimParams,
  TeamId,
} from "@/lib/types";

function dateKey(date: string): string {
  return date.split(" ")[0] ?? date;
}

function nextRoundGames(games: Game[]) {
  if (games.length === 0) {
    return null;
  }
  const sorted = [...games].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
  const targetKey = dateKey(sorted[0].date);
  return { roundDate: sorted[0].date, games: sorted.filter((g) => dateKey(g.date) === targetKey) };
}

export function buildMatchdayImpact(
  data: DataFile,
  teamId: TeamId,
  params: SimParams,
): MatchdayImpact | null {
  const rem = remainingGames(data.games);
  const round = nextRoundGames(rem);
  if (!round) {
    return null;
  }

  const impacts: MatchdayImpactGame[] = round.games.map((game) => {
    const baseForced = params.forcedOutcomes ?? {};
    const homeForced: ForcedOutcomes = { ...baseForced, [game.id]: "home" };
    const awayForced: ForcedOutcomes = { ...baseForced, [game.id]: "away" };
    const seed = params.seed ?? 1;
    const homeResult = simulateSeason(data, {
      ...params,
      forcedOutcomes: homeForced,
      seed,
    });
    const awayResult = simulateSeason(data, {
      ...params,
      forcedOutcomes: awayForced,
      seed,
    });
    const homeOdds = homeResult.playoffOdds[teamId] ?? 0;
    const awayOdds = awayResult.playoffOdds[teamId] ?? 0;
    const better: MatchdayImpactGame["better"] =
      homeOdds >= awayOdds ? "home" : "away";
    return {
      game,
      homeWinOdds: homeOdds,
      awayWinOdds: awayOdds,
      better,
      delta: homeOdds - awayOdds,
    };
  });

  return {
    roundDate: round.roundDate,
    games: impacts,
  };
}
