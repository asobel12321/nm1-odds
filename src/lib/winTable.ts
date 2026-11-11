import { createSeasonSampler } from "@/lib/seasonSampler";
import { PLAYOFF_CUTOFF } from "@/lib/competition";
import type { DataFile, SimParams, TeamId, WinTable } from "@/lib/types";

export function buildWinTable(
  data: DataFile,
  teamId: TeamId,
  params: SimParams,
): WinTable {
  const simulations = Math.max(1, Math.floor(params.simulations));
  const sampler = createSeasonSampler(data, params);
  const team = data.teams.find((t) => t.id === teamId);
  if (!team) throw new Error("Unknown focus team");
  const remainingCount = sampler.remainingCounts[teamId];
  const rankCounts: number[][] = Array.from(
    { length: remainingCount + 1 },
    () => Array(data.teams.length).fill(0),
  );
  const rowTotals: number[] = Array(remainingCount + 1).fill(0);

  for (let sim = 0; sim < simulations; sim += 1) {
    const wins = sampler.sampleWins();
    const focusWins = wins[teamId] - team.wins;
    const resolution = sampler.rank(wins);
    if (focusWins <= remainingCount) {
      const unresolvedGroup = resolution.unresolvedGroups.find((group) =>
        group.includes(teamId),
      );
      if (unresolvedGroup) {
        const positions = unresolvedGroup
          .map((id) => resolution.rankedIds.indexOf(id))
          .filter((position) => position >= 0);
        const share = positions.length > 0 ? 1 / unresolvedGroup.length : 0;
        for (const position of positions) {
          rankCounts[focusWins][position] += share;
        }
      } else {
        const focusRank = resolution.rankedIds.indexOf(teamId);
        if (focusRank >= 0) {
          rankCounts[focusWins][focusRank] += 1;
        }
      }
      rowTotals[focusWins] += 1;
    }
  }

  const rows = rankCounts.map((counts, remainingWins) => {
    const total = rowTotals[remainingWins] || 1;
    const rankProbs = counts.map((count) => count / total);
    const remainingLosses = remainingCount - remainingWins;
    const noPlayoffs = rankProbs
      .slice(PLAYOFF_CUTOFF)
      .reduce((a, b) => a + b, 0);
    return {
      remainingWins,
      remainingLosses,
      wins: team.wins + remainingWins,
      losses: team.losses + remainingLosses,
      winPct: remainingCount > 0 ? remainingWins / remainingCount : 0,
      rankProbs,
      noPlayoffs,
      samples: rowTotals[remainingWins],
    };
  });

  return { remainingGames: remainingCount, rows };
}

/** Smallest supported final-record row reaching the requested qualification probability. */
export function selectWinTarget(
  table: WinTable | undefined,
  threshold = 0.9,
  minimumSamples = 100,
) {
  return table?.rows
    .filter(
      (row) =>
        row.samples >= minimumSamples &&
        Number.isFinite(row.noPlayoffs) &&
        1 - row.noPlayoffs >= threshold,
    )
    .sort((a, b) => a.remainingWins - b.remainingWins)[0];
}
