import { predictEfficiency, type EfficiencyFit } from "./efficiency";
import { createRng } from "./rng";
import { resolveTeamStandings } from "./rank";
import { PLAYOFF_CUTOFF } from "./competition";
import type { DataFile, SimResult, TeamId } from "./types";

/** Experimental only: shares production ranking and synthetic tiebreak conventions. */
export function simulateEfficiencySeason(
  data: DataFile,
  fit: EfficiencyFit,
  simulations = 20000,
  seed = 20261022,
): SimResult {
  if (!Number.isInteger(simulations) || simulations < 1 || simulations > 250000)
    throw new Error("Invalid simulation count");
  const ids = data.teams.map((t) => t.id),
    future = data.games.filter((g) => !g.played),
    rng = createRng(seed);
  const base = Object.fromEntries(data.teams.map((t) => [t.id, t.wins]));
  const total = Object.fromEntries(
    data.teams.map((t) => [
      t.id,
      t.wins +
        t.losses +
        future.filter((g) => g.home === t.id || g.away === t.id).length,
    ]),
  );
  const maxWins = Math.max(...Object.values(total));
  const rankHist: Record<TeamId, number[]> = {},
    winHist: Record<TeamId, number[]> = {};
  for (const id of ids) {
    if (!fit.teams[id]) throw new Error("Missing team efficiency");
    rankHist[id] = Array(ids.length).fill(0);
    winHist[id] = Array(maxWins + 1).fill(0);
  }
  const probabilities = future.map(
    (g) => predictEfficiency(fit, g.home, g.away).homeWinProbability,
  );
  for (let i = 0; i < simulations; i++) {
    const wins = { ...base },
      outcomes: Record<string, "home" | "away"> = {};
    future.forEach((g, j) => {
      const winner = rng() < probabilities[j] ? "home" : "away";
      wins[winner === "home" ? g.home : g.away]++;
      outcomes[g.id] = winner;
    });
    const resolution = resolveTeamStandings(
      data.teams,
      wins,
      "269",
      total,
      data.games,
      outcomes,
    );
    const tied = new Set(resolution.unresolvedGroups.flat());
    resolution.rankedIds.forEach((id, rank) => {
      if (!tied.has(id)) rankHist[id][rank]++;
    });
    for (const group of resolution.unresolvedGroups) {
      const positions = group.map((id) => resolution.rankedIds.indexOf(id));
      for (const id of group)
        for (const rank of positions) rankHist[id][rank] += 1 / group.length;
    }
    for (const id of ids) winHist[id][wins[id]]++;
  }
  const playoffOdds: Record<TeamId, number> = {};
  for (const id of ids) {
    rankHist[id] = rankHist[id].map((n) => n / simulations);
    winHist[id] = winHist[id].map((n) => n / simulations);
    playoffOdds[id] = rankHist[id]
      .slice(0, PLAYOFF_CUTOFF)
      .reduce((a, b) => a + b, 0);
  }
  return { playoffOdds, rankHist, winHist };
}
