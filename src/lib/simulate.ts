import { createRng } from "@/lib/rng";
import { winProb } from "@/lib/model";
import { rankTeams } from "@/lib/rank";
import type { DataFile, SimParams, SimResult, TeamId } from "@/lib/types";

function buildWpctMap(data: DataFile): Record<TeamId, number> {
  const map: Record<TeamId, number> = {};
  for (const team of data.teams) {
    const games = team.wins + team.losses;
    map[team.id] = games > 0 ? team.wins / games : 0.5;
  }
  return map;
}

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

export function simulateSeason(data: DataFile, params: SimParams): SimResult {
  const simulations = Math.max(1, params.simulations);
  const rng = createRng(params.seed ?? Date.now());
  const wpct = buildWpctMap(data);
  const remaining = data.games.filter((game) => !game.played);
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
    for (const game of remaining) {
      const forced = params.forcedOutcomes?.[game.id];
      let winner: "home" | "away";
      if (forced) {
        winner = forced;
      } else {
        const pHome = winProb(
          wpct[game.home],
          wpct[game.away],
          params.k,
          params.homeAdv,
        );
        winner = rng() < pHome ? "home" : "away";
      }
      const winnerId = winner === "home" ? game.home : game.away;
      wins[winnerId] += 1;
    }

    const ranked = rankTeams(
      data.teams,
      wins,
      params.sombId ?? "SOMB",
      totalGames,
    );
    for (let i = 0; i < ranked.length; i += 1) {
      const id = ranked[i];
      rankHist[id][i] += 1;
    }
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

  const top7Odds: Record<TeamId, number> = {};
  for (const id of teamIds) {
    rankHist[id] = rankHist[id].map((count) => count / simulations);
    winHist[id] = winHist[id].map((count) => count / simulations);
    top7Odds[id] = rankHist[id].slice(0, 7).reduce((a, b) => a + b, 0);
  }

  return { top7Odds, rankHist, winHist };
}
