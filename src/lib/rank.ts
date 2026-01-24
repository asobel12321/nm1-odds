import type { TeamRecord, TeamId } from "@/lib/types";

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
      if (a.id === sombId && b.id !== sombId) {
        return -1;
      }
      if (b.id === sombId && a.id !== sombId) {
        return 1;
      }
      return a.id.localeCompare(b.id);
    })
    .map((team) => team.id);
}
