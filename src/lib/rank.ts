import type { TeamRecord, TeamId } from "@/lib/types";

const SOMB_WINS_TIEBREAKER_VS = new Set<TeamId>(["253", "14914", "26"]);
const SOMB_LOSES_TIEBREAKER_VS = new Set<TeamId>(["278", "13367", "1851"]);

function compareSombTieBreak(
  a: TeamRecord,
  b: TeamRecord,
  sombId: TeamId,
): number | null {
  if (a.id === sombId && b.id !== sombId) {
    if (SOMB_WINS_TIEBREAKER_VS.has(b.id)) {
      return -1;
    }
    if (SOMB_LOSES_TIEBREAKER_VS.has(b.id)) {
      return 1;
    }
    return null;
  }
  if (b.id === sombId && a.id !== sombId) {
    if (SOMB_WINS_TIEBREAKER_VS.has(a.id)) {
      return 1;
    }
    if (SOMB_LOSES_TIEBREAKER_VS.has(a.id)) {
      return -1;
    }
    return null;
  }
  return null;
}

export function rankTeams(
  teams: TeamRecord[],
  wins: Record<TeamId, number>,
  sombId: TeamId = "SOMB",
  totalGames?: Record<TeamId, number>,
): TeamId[] {
  return [...teams]
    .sort((a, b) => {
      const aGames = totalGames?.[a.id];
      const bGames = totalGames?.[b.id];
      const aPct =
        aGames && aGames > 0 ? wins[a.id] / aGames : wins[a.id];
      const bPct =
        bGames && bGames > 0 ? wins[b.id] / bGames : wins[b.id];
      const diff = bPct - aPct;
      if (diff !== 0) {
        return diff;
      }

      const sombTieBreak = compareSombTieBreak(a, b, sombId);
      if (sombTieBreak !== null) {
        return sombTieBreak;
      }

      return a.name.localeCompare(b.name);
    })
    .map((team) => team.id);
}
