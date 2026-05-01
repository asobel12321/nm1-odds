import { PLAYOFF_CUTOFF } from "@/lib/competition";
import { findSombId, remainingGames, teamsById } from "@/lib/data";
import { rankTeams } from "@/lib/rank";
import type {
  ClinchResult,
  ClinchScenario,
  DataFile,
  ForcedOutcomes,
  Game,
  TeamId,
} from "@/lib/types";

const MAX_DISPLAY_SCENARIOS = 12;

function dateValue(date: string): number {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function dateKey(date: string): string {
  return date.split(" ")[0] ?? date;
}

function nextRoundGames(games: Game[]): { roundDate: string; games: Game[] } | null {
  if (games.length === 0) {
    return null;
  }
  const sorted = [...games].sort((a, b) => dateValue(a.date) - dateValue(b.date));
  const target = sorted[0];
  const targetKey = dateKey(target.date);
  return {
    roundDate: target.date,
    games: sorted.filter((game) => dateKey(game.date) === targetKey),
  };
}

function finalTotalGames(data: DataFile): Record<TeamId, number> {
  const totals: Record<TeamId, number> = {};
  for (const team of data.teams) {
    totals[team.id] = team.wins + team.losses;
  }
  for (const game of data.games) {
    if (!game.played) {
      totals[game.home] += 1;
      totals[game.away] += 1;
    }
  }
  return totals;
}

function formatOutcomeLabel(
  outcomes: ForcedOutcomes,
  games: Game[],
  teamLookup: Record<string, { name: string }>,
): string {
  return games
    .map((game) => {
      const outcome = outcomes[game.id];
      const winnerId = outcome === "home" ? game.home : game.away;
      const loserId = outcome === "home" ? game.away : game.home;
      const winner = teamLookup[winnerId]?.name ?? winnerId;
      const loser = teamLookup[loserId]?.name ?? loserId;
      return `${winner} over ${loser}`;
    })
    .join("; ");
}

function canStillMissPlayoffs(
  data: DataFile,
  teamId: TeamId,
  sombId: TeamId,
  nextRoundOutcomes: ForcedOutcomes,
): boolean {
  const wins: Record<TeamId, number> = {};
  for (const team of data.teams) {
    wins[team.id] = team.wins;
  }

  const variableGames: Game[] = [];
  for (const game of remainingGames(data.games)) {
    const forced = nextRoundOutcomes[game.id];
    if (forced) {
      const winnerId = forced === "home" ? game.home : game.away;
      wins[winnerId] += 1;
      continue;
    }

    if (game.home === teamId || game.away === teamId) {
      const opponentId = game.home === teamId ? game.away : game.home;
      wins[opponentId] += 1;
      continue;
    }

    variableGames.push(game);
  }

  const totals = finalTotalGames(data);

  function search(index: number): boolean {
    if (index >= variableGames.length) {
      const ranked = rankTeams(data.teams, wins, sombId, totals);
      return ranked.indexOf(teamId) >= PLAYOFF_CUTOFF;
    }

    const game = variableGames[index];

    wins[game.home] += 1;
    if (search(index + 1)) {
      wins[game.home] -= 1;
      return true;
    }
    wins[game.home] -= 1;

    wins[game.away] += 1;
    if (search(index + 1)) {
      wins[game.away] -= 1;
      return true;
    }
    wins[game.away] -= 1;

    return false;
  }

  return search(0);
}

export function buildClinchScenarios(
  data: DataFile,
  teamId: TeamId,
): ClinchResult | null {
  const sombId = findSombId(data) ?? "SOMB";
  const round = nextRoundGames(remainingGames(data.games));
  if (!round) {
    return null;
  }

  const scenarios = Math.max(1, 2 ** round.games.length);
  const teamLookup = teamsById(data.teams);
  const clinchingScenarios: ClinchScenario[] = [];
  let totalClinchingScenarios = 0;

  for (let mask = 0; mask < scenarios; mask += 1) {
    const outcomes: ForcedOutcomes = {};
    for (let i = 0; i < round.games.length; i += 1) {
      const game = round.games[i];
      const bit = (mask >> i) & 1;
      outcomes[game.id] = bit === 1 ? "home" : "away";
    }

    if (!canStillMissPlayoffs(data, teamId, sombId, outcomes)) {
      totalClinchingScenarios += 1;
      if (clinchingScenarios.length < MAX_DISPLAY_SCENARIOS) {
        clinchingScenarios.push({
          label: formatOutcomeLabel(outcomes, round.games, teamLookup),
          outcomes,
        });
      }
    }
  }

  return {
    roundDate: round.roundDate,
    scenarios,
    totalClinchingScenarios,
    clinchingScenarios,
  };
}
