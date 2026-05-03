import { resolveStandingsByTiebreaks, type StandingsResolution } from "@/lib/tiebreak";
import type { ForcedOutcomes, Game, TeamRecord, TeamId } from "@/lib/types";

export function rankTeams(
  teams: TeamRecord[],
  wins: Record<TeamId, number>,
  sombId: TeamId = "SOMB",
  totalGames?: Record<TeamId, number>,
  games?: Game[],
  forcedOutcomes?: ForcedOutcomes,
): TeamId[] {
  return resolveTeamStandings(
    teams,
    wins,
    sombId,
    totalGames,
    games,
    forcedOutcomes,
  ).rankedIds;
}

export function resolveTeamStandings(
  teams: TeamRecord[],
  wins: Record<TeamId, number>,
  _sombId: TeamId = "SOMB",
  totalGames?: Record<TeamId, number>,
  games?: Game[],
  forcedOutcomes?: ForcedOutcomes,
): StandingsResolution {
  void _sombId;
  return resolveStandingsByTiebreaks(teams, wins, {
    totalGames,
    games,
    forcedOutcomes,
  });
}
