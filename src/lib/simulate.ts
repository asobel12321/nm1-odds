import { PLAYOFF_CUTOFF } from "./competition";
import type { GameForecast } from "./projectionModel";
import { createSeasonSampler } from "./seasonSampler";
import type { DataFile, SimParams, SimResult, TeamId, Game } from "./types";

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
  forecast?: (game: Game) => GameForecast,
): SimResult {
  const simulations = Math.max(1, Math.floor(params.simulations));
  const sampler = createSeasonSampler(data, params, forecast);
  const maxWins = Math.max(
    ...data.teams.map((team) => team.wins + sampler.remainingCounts[team.id]),
  );
  const teamIds = data.teams.map((team) => team.id);
  const rankHist: Record<TeamId, number[]> = {};
  const winHist: Record<TeamId, number[]> = {};
  for (const id of teamIds) {
    rankHist[id] = Array(teamIds.length).fill(0);
    winHist[id] = Array(maxWins + 1).fill(0);
  }
  for (let sim = 0; sim < simulations; sim++) {
    const wins = sampler.sampleWins();
    const { rankedIds, unresolvedGroups } = sampler.rank(wins);
    addResolutionToRankHist(rankHist, rankedIds, unresolvedGroups);
    for (const id of teamIds) winHist[id][wins[id]]++;
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

/** Focus-only equivalent of simulateSeason, skipping ties away from the cutoff. */
export function simulateQualificationOdds(
  data: DataFile,
  teamId: TeamId,
  params: SimParams,
  forecast?: (game: Game) => GameForecast,
): number {
  if (!data.teams.some((team) => team.id === teamId))
    throw new Error("Unknown focus team");
  const simulations = Math.max(1, Math.floor(params.simulations));
  const sampler = createSeasonSampler(data, params, forecast);
  let qualified = 0;
  for (let sim = 0; sim < simulations; sim++) {
    const wins = sampler.sampleWins();
    const focusPoints = sampler.pointsFor(teamId, wins);
    let above = 0;
    const tied: DataFile["teams"] = [];
    for (const team of data.teams) {
      const points = sampler.pointsFor(team.id, wins);
      if (points > focusPoints) above++;
      else if (points === focusPoints) tied.push(team);
    }
    if (above >= PLAYOFF_CUTOFF) continue;
    if (above + tied.length <= PLAYOFF_CUTOFF) {
      qualified++;
      continue;
    }
    const spots = PLAYOFF_CUTOFF - above;
    const { rankedIds, unresolvedGroups } = sampler.rank(wins, tied);
    const group = unresolvedGroups.find((g) => g.includes(teamId));
    if (group)
      qualified +=
        group.filter((id) => rankedIds.indexOf(id) < spots).length /
        group.length;
    else if (rankedIds.indexOf(teamId) < spots) qualified++;
  }
  return qualified / simulations;
}
