import {
  resolveStandingsByTiebreaks,
  type StandingsResolution,
} from "@/lib/tiebreak";
import type { ForcedOutcomes, Game, TeamRecord, TeamId } from "@/lib/types";

export function rankTeams(
  teams: TeamRecord[],
  wins: Record<TeamId, number>,
  focusId: TeamId = "AVB",
  totalGames?: Record<TeamId, number>,
  games?: Game[],
  forcedOutcomes?: ForcedOutcomes,
): TeamId[] {
  return resolveTeamStandings(
    teams,
    wins,
    focusId,
    totalGames,
    games,
    forcedOutcomes,
  ).rankedIds;
}

export function resolveTeamStandings(
  teams: TeamRecord[],
  wins: Record<TeamId, number>,
  _focusId: TeamId = "AVB",
  totalGames?: Record<TeamId, number>,
  games?: Game[],
  forcedOutcomes?: ForcedOutcomes,
): StandingsResolution {
  void _focusId;
  return resolveStandingsByTiebreaks(teams, wins, {
    totalGames,
    games,
    forcedOutcomes,
  });
}
