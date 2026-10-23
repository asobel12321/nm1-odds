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
/** Focus-only equivalent of simulateSeason, skipping tiebreak work away from the cutoff. */
export function simulateQualificationOdds(
  data: DataFile,
  teamId: TeamId,
  params: SimParams,
  homeProbability?: (game: Game) => number,
): number {
  const simulations = Math.max(1, Math.floor(params.simulations)),
    rng = createRng(params.seed ?? Date.now());
  const predict =
    homeProbability ?? createProjectionModel(data, params).homeProbability;
  const remaining = data.games.filter((g) => !g.played),
    probabilities = remaining.map(predict);
  const base = Object.fromEntries(data.teams.map((t) => [t.id, t.wins]));
  const total = Object.fromEntries(
    data.teams.map((t) => [
      t.id,
      t.wins +
        t.losses +
        remaining.filter((g) => g.home === t.id || g.away === t.id).length,
    ]),
  );
  if (!(teamId in base)) throw new Error("Unknown focus team");
  let qualified = 0;
  for (let sim = 0; sim < simulations; sim++) {
    const wins = { ...base },
      outcomes: Record<string, "home" | "away"> = {};
    remaining.forEach((g, i) => {
      const draw = rng(),
        winner =
          params.forcedOutcomes?.[g.id] ??
          (draw < probabilities[i] ? "home" : "away");
      wins[winner === "home" ? g.home : g.away]++;
      outcomes[g.id] = winner;
    });
    let above = 0,
      tied = 0;
    for (const team of data.teams) {
      const difference =
        wins[team.id] * (total[teamId] || 1) -
        wins[teamId] * (total[team.id] || 1);
      if (difference > 0) above++;
      else if (difference === 0) tied++;
    }
    if (above >= PLAYOFF_CUTOFF) continue;
    if (above + tied <= PLAYOFF_CUTOFF) {
      qualified++;
      continue;
    }
    const resolution = resolveTeamStandings(
      data.teams,
      wins,
      params.focusId ?? teamId,
      total,
      data.games,
      outcomes,
    );
    const group = resolution.unresolvedGroups.find((g) => g.includes(teamId));
    if (group)
      qualified +=
        group.filter((id) => resolution.rankedIds.indexOf(id) < PLAYOFF_CUTOFF)
          .length / group.length;
    else if (resolution.rankedIds.indexOf(teamId) < PLAYOFF_CUTOFF) qualified++;
  }
  return qualified / simulations;
}
