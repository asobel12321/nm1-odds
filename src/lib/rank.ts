import type { TeamRecord, TeamId } from "@/lib/types";

const SOMB_WINS_TIEBREAKER_VS = new Set<TeamId>(["253", "14914", "26", "14016", "13305"]);
const SOMB_LOSES_TIEBREAKER_VS = new Set<TeamId>(["278", "13367", "1851", "3", "247"]);
export type SombTiebreakStatus = "won" | "lost" | "undecided";

export function getSombTiebreakStatus(
  teamId: TeamId,
  sombId: TeamId = "SOMB",
): SombTiebreakStatus | null {
  if (teamId === sombId) {
    return null;
  }
  if (SOMB_WINS_TIEBREAKER_VS.has(teamId)) {
    return "won";
  }
  if (SOMB_LOSES_TIEBREAKER_VS.has(teamId)) {
    return "lost";
  }
  return "undecided";
}

function compareSombTieBreak(
  a: TeamRecord,
  b: TeamRecord,
  sombId: TeamId,
): number | null {
  if (a.id === sombId && b.id !== sombId) {
    const status = getSombTiebreakStatus(b.id, sombId);
    if (status === "won") {
      return -1;
    }
    if (status === "lost") {
      return 1;
    }
    return null;
  }
  if (b.id === sombId && a.id !== sombId) {
    const status = getSombTiebreakStatus(a.id, sombId);
    if (status === "won") {
      return 1;
    }
    if (status === "lost") {
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
