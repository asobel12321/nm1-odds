import { createRng } from "@/lib/rng";
import { PLAYOFF_CUTOFF } from "@/lib/competition";
import { createProjectionModel } from "@/lib/projectionModel";
import { resolveTeamStandings } from "@/lib/rank";
import type { DataFile, SimParams, SimResult, TeamId, Game } from "@/lib/types";

function remainingCounts(data: DataFile): Record<TeamId, number> {
  const counts: Record<TeamId, number> = {};
  for (const team of data.teams) {
    counts[team.id] = 0;
  }
  for (const game of data.games) {
    if (!game.played) {
      counts[game.home] += 1;
      counts[game.away] += 1;
    }
  }
  return counts;
}

function addResolutionToRankHist(
  rankHist: Record<TeamId, number[]>,
  rankedIds: TeamId[],
  unresolvedGroups: TeamId[][],
) {
  const unresolved = new Set(unresolvedGroups.flat());
  for (let rank = 0; rank < rankedIds.length; rank += 1) {
    const teamId = rankedIds[rank];
    if (!unresolved.has(teamId)) {
      rankHist[teamId][rank] += 1;
    }
  }

  for (const group of unresolvedGroups) {
    const positions = group
      .map((teamId) => rankedIds.indexOf(teamId))
      .filter((position) => position >= 0);
    if (positions.length === 0) {
      continue;
    }
    const share = 1 / group.length;
    for (const teamId of group) {
      for (const position of positions) {
        rankHist[teamId][position] += share;
      }
    }
  }
}

export function simulateSeason(
  data: DataFile,
  params: SimParams,
  homeProbability?: (game: Game) => number,
): SimResult {
  const simulations = Math.max(1, params.simulations);
  const rng = createRng(params.seed ?? Date.now());
  const predict =
    homeProbability ?? createProjectionModel(data, params).homeProbability;
  const remaining = data.games.filter((game) => !game.played);
  const probabilities = new Map(remaining.map((g) => [g.id, predict(g)]));
  const baseWins: Record<TeamId, number> = {};
  for (const team of data.teams) {
    baseWins[team.id] = team.wins;
  }

  const counts = remainingCounts(data);
  const maxWins = Math.max(
    ...data.teams.map((team) => team.wins + counts[team.id]),
  );
  const totalGames: Record<TeamId, number> = {};
  for (const team of data.teams) {
    totalGames[team.id] = team.wins + team.losses + counts[team.id];
  }

  const rankHist: Record<TeamId, number[]> = {};
  const winHist: Record<TeamId, number[]> = {};
  const teamIds = data.teams.map((team) => team.id);
  for (const id of teamIds) {
    rankHist[id] = Array(teamIds.length).fill(0);
    winHist[id] = Array(maxWins + 1).fill(0);
  }

  for (let sim = 0; sim < simulations; sim += 1) {
    const wins: Record<TeamId, number> = { ...baseWins };
    const simOutcomes: Record<string, "home" | "away"> = {};
    for (const game of remaining) {
      const draw = rng(); // Consume one draw per fixture so scenarios share comparable randomness.
      const forced = params.forcedOutcomes?.[game.id];
      let winner: "home" | "away";
      if (forced) {
        winner = forced;
      } else {
        const pHome = probabilities.get(game.id)!;
        winner = draw < pHome ? "home" : "away";
      }
      const winnerId = winner === "home" ? game.home : game.away;
      wins[winnerId] += 1;
      simOutcomes[game.id] = winner;
    }

    const resolution = resolveTeamStandings(
      data.teams,
      wins,
      params.focusId ?? "AVB",
      totalGames,
      data.games,
      simOutcomes,
    );
    addResolutionToRankHist(
      rankHist,
      resolution.rankedIds,
      resolution.unresolvedGroups,
    );
    for (const id of teamIds) {
      const totalWins = wins[id];
      if (totalWins >= winHist[id].length) {
        const prevLength = winHist[id].length;
        winHist[id].length = totalWins + 1;
        winHist[id].fill(0, prevLength);
      }
      winHist[id][totalWins] += 1;
    }
  }

  const playoffOdds: Record<TeamId, number> = {};
  for (const id of teamIds) {
    rankHist[id] = rankHist[id].map((count) => count / simulations);
    winHist[id] = winHist[id].map((count) => count / simulations);
    playoffOdds[id] = rankHist[id]
      .slice(0, PLAYOFF_CUTOFF)
      .reduce((a, b) => a + b, 0);
  }

  return { playoffOdds, rankHist, winHist };
}
