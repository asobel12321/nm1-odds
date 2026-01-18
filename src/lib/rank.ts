import type { TeamRecord, TeamId } from "@/lib/types";

export function rankTeams(
  teams: TeamRecord[],
  wins: Record<TeamId, number>,
  sombId: TeamId = "SOMB",
): TeamId[] {
  return [...teams]
    .sort((a, b) => {
      const diff = wins[b.id] - wins[a.id];
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
