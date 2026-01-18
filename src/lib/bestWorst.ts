import { simulateSeason } from "@/lib/simulate";
import { teamsById, remainingGames } from "@/lib/data";
import type {
  BestWorstResult,
  DataFile,
  ForcedOutcomes,
  Game,
  SimParams,
  TeamId,
} from "@/lib/types";

function dateValue(date: string): number {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function nextRoundGames(games: Game[]): { roundDate: string; games: Game[] } | null {
  if (games.length === 0) {
    return null;
  }
  const sorted = [...games].sort((a, b) => dateValue(a.date) - dateValue(b.date));
  const target = sorted[0];
  const targetValue = dateValue(target.date);
  const round = sorted.filter(
    (game) => dateValue(game.date) === targetValue || game.date === target.date,
  );
  return { roundDate: target.date, games: round };
}

function formatOutcomeLabel(
  scenarioOutcomes: ForcedOutcomes,
  games: Game[],
  teamLookup: Record<string, { name: string }>,
): string {
  const parts: string[] = [];
  for (const game of games) {
    const outcome = scenarioOutcomes[game.id];
    if (!outcome) {
      continue;
    }
    const winnerId = outcome === "home" ? game.home : game.away;
    const loserId = outcome === "home" ? game.away : game.home;
    const winner = teamLookup[winnerId]?.name ?? winnerId;
    const loser = teamLookup[loserId]?.name ?? loserId;
    parts.push(`${winner} over ${loser}`);
  }
  return parts.length > 0 ? parts.join("; ") : "All forced";
}

export function bestWorstNextRound(
  data: DataFile,
  teamId: TeamId,
  params: SimParams,
): BestWorstResult | null {
  const rem = remainingGames(data.games);
  const round = nextRoundGames(rem);
  if (!round) {
    return null;
  }

  const forcedBase = params.forcedOutcomes ?? {};
  const unforced = round.games.filter((game) => !forcedBase[game.id]);
  const scenarios = Math.max(1, 2 ** unforced.length);
  const teamLookup = teamsById(data.teams);

  let best: BestWorstResult["best"] | null = null;
  let worst: BestWorstResult["worst"] | null = null;

  for (let mask = 0; mask < scenarios; mask += 1) {
    const scenarioOutcomes: ForcedOutcomes = { ...forcedBase };
    for (let i = 0; i < unforced.length; i += 1) {
      const game = unforced[i];
      const bit = (mask >> i) & 1;
      scenarioOutcomes[game.id] = bit === 1 ? "home" : "away";
    }

    const result = simulateSeason(data, {
      ...params,
      forcedOutcomes: scenarioOutcomes,
      seed: (params.seed ?? 1) + mask,
    });
    const odds = result.top7Odds[teamId] ?? 0;
    const label = formatOutcomeLabel(scenarioOutcomes, unforced, teamLookup);

    if (!best || odds > best.odds) {
      best = { label, odds, outcomes: scenarioOutcomes };
    }
    if (!worst || odds < worst.odds) {
      worst = { label, odds, outcomes: scenarioOutcomes };
    }
  }

  if (!best || !worst) {
    return null;
  }

  return {
    roundDate: round.roundDate,
    scenarios,
    best,
    worst,
  };
}
