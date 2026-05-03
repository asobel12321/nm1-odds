import { createRng } from "@/lib/rng";
import { PLAYOFF_CUTOFF } from "@/lib/competition";
import { winProb } from "@/lib/model";
import { resolveTeamStandings } from "@/lib/rank";
import { remainingGames } from "@/lib/data";
import type { DataFile, SimParams, TeamId, WinTable } from "@/lib/types";

function buildWpctMap(data: DataFile): Record<TeamId, number> {
  const map: Record<TeamId, number> = {};
  for (const team of data.teams) {
    const games = team.wins + team.losses;
    map[team.id] = games > 0 ? team.wins / games : 0.5;
  }
  return map;
}

export function buildWinTable(
  data: DataFile,
  teamId: TeamId,
  params: SimParams,
): WinTable {
  const simulations = Math.max(1, params.simulations);
  const rng = createRng(params.seed ?? Date.now());
  const wpct = buildWpctMap(data);
  const remaining = remainingGames(data.games);
  const teamIds = data.teams.map((team) => team.id);
  const baseWins: Record<TeamId, number> = {};
  const baseLosses: Record<TeamId, number> = {};
  const remainingByTeam: Record<TeamId, number> = {};
  for (const team of data.teams) {
    baseWins[team.id] = team.wins;
    baseLosses[team.id] = team.losses;
    remainingByTeam[team.id] = 0;
  }
  for (const game of remaining) {
    remainingByTeam[game.home] += 1;
    remainingByTeam[game.away] += 1;
  }
  const totalGames: Record<TeamId, number> = {};
  for (const team of data.teams) {
    totalGames[team.id] = team.wins + team.losses + remainingByTeam[team.id];
  }

  const sombRemaining = remaining.filter(
    (game) => game.home === teamId || game.away === teamId,
  );
  const remainingCount = sombRemaining.length;
  const rankCounts: number[][] = Array.from({ length: remainingCount + 1 }, () =>
    Array(teamIds.length).fill(0),
  );
  const rowTotals: number[] = Array(remainingCount + 1).fill(0);

  for (let sim = 0; sim < simulations; sim += 1) {
    const wins: Record<TeamId, number> = { ...baseWins };
    let sombWins = 0;
    const simOutcomes: Record<string, "home" | "away"> = {};
    for (const game of remaining) {
      const pHome = winProb(
        wpct[game.home],
        wpct[game.away],
        params.k,
        params.homeAdv,
      );
      const winner = rng() < pHome ? "home" : "away";
      const winnerId = winner === "home" ? game.home : game.away;
      wins[winnerId] += 1;
      simOutcomes[game.id] = winner;
      if (winnerId === teamId) {
        sombWins += 1;
      }
    }

    const resolution = resolveTeamStandings(
      data.teams,
      wins,
      params.sombId ?? "SOMB",
      totalGames,
      data.games,
      simOutcomes,
    );
    if (sombWins <= remainingCount) {
      const unresolvedGroup = resolution.unresolvedGroups.find((group) =>
        group.includes(teamId),
      );
      if (unresolvedGroup) {
        const positions = unresolvedGroup
          .map((id) => resolution.rankedIds.indexOf(id))
          .filter((position) => position >= 0);
        const share = positions.length > 0 ? 1 / unresolvedGroup.length : 0;
        for (const position of positions) {
          rankCounts[sombWins][position] += share;
        }
      } else {
        const sombRank = resolution.rankedIds.indexOf(teamId);
        if (sombRank >= 0) {
          rankCounts[sombWins][sombRank] += 1;
        }
      }
      rowTotals[sombWins] += 1;
    }
  }

  const rows = rankCounts.map((counts, remainingWins) => {
    const total = rowTotals[remainingWins] || 1;
    const rankProbs = counts.map((count) => count / total);
    const remainingLosses = remainingCount - remainingWins;
    const noPlayoffs = rankProbs.slice(PLAYOFF_CUTOFF).reduce((a, b) => a + b, 0);
    return {
      remainingWins,
      remainingLosses,
      wins: baseWins[teamId] + remainingWins,
      losses: baseLosses[teamId] + remainingLosses,
      winPct: remainingCount > 0 ? remainingWins / remainingCount : 0,
      rankProbs,
      noPlayoffs,
    };
  });

  return { remainingGames: remainingCount, rows };
}
