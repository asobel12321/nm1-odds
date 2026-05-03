import type { ForcedOutcomes, Game, TeamId, TeamRecord } from "@/lib/types";

export interface StandingsResolution {
  rankedIds: TeamId[];
  unresolvedGroups: TeamId[][];
}

export type TiebreakStatus = "won" | "lost";

interface ResolvedGame {
  home: TeamId;
  away: TeamId;
  winner: TeamId | null;
  homeScore: number | null;
  awayScore: number | null;
  scoreKnown: boolean;
}

const SYNTHETIC_WINNER_SCORE = 75;
const SYNTHETIC_LOSER_SCORE = 74;

interface TeamTieStats {
  wins: number;
  games: number;
  pointDiff: number;
  pointsFor: number;
}

interface ResolveOptions {
  games?: Game[];
  forcedOutcomes?: ForcedOutcomes;
  fallbackCompare?: (a: TeamRecord, b: TeamRecord) => number | null;
  totalGames?: Record<TeamId, number>;
}

interface TieResolution {
  rankedIds: TeamId[];
  unresolvedGroups: TeamId[][];
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function buildResolvedGames(
  games: Game[],
  forcedOutcomes?: ForcedOutcomes,
): ResolvedGame[] {
  return games.map((game) => {
    if (game.played) {
      const homeScore = game.homeScore ?? null;
      const awayScore = game.awayScore ?? null;
      const winner =
        homeScore !== null && awayScore !== null
          ? homeScore > awayScore
            ? game.home
            : game.away
          : null;
      return {
        home: game.home,
        away: game.away,
        winner,
        homeScore,
        awayScore,
        scoreKnown: homeScore !== null && awayScore !== null,
      };
    }

    const forced = forcedOutcomes?.[game.id];
    if (forced === "home") {
      return {
        home: game.home,
        away: game.away,
        winner: game.home,
        homeScore: SYNTHETIC_WINNER_SCORE,
        awayScore: SYNTHETIC_LOSER_SCORE,
        scoreKnown: true,
      };
    }
    if (forced === "away") {
      return {
        home: game.home,
        away: game.away,
        winner: game.away,
        homeScore: SYNTHETIC_LOSER_SCORE,
        awayScore: SYNTHETIC_WINNER_SCORE,
        scoreKnown: true,
      };
    }
    return {
      home: game.home,
      away: game.away,
      winner: null,
      homeScore: null,
      awayScore: null,
      scoreKnown: false,
    };
  });
}

export function getTwoTeamTiebreakStatus(
  teamId: TeamId,
  opponentId: TeamId,
  games: Game[],
): TiebreakStatus | null {
  const headToHead = buildResolvedGames(games).filter(
    (game) =>
      (game.home === teamId && game.away === opponentId) ||
      (game.home === opponentId && game.away === teamId),
  );
  if (headToHead.length === 0 || headToHead.some((game) => game.winner === null)) {
    return null;
  }

  const teamWins = headToHead.filter((game) => game.winner === teamId).length;
  const opponentWins = headToHead.filter((game) => game.winner === opponentId).length;
  if (teamWins !== opponentWins) {
    return teamWins > opponentWins ? "won" : "lost";
  }

  if (headToHead.some((game) => !game.scoreKnown)) {
    return null;
  }

  const pointDiff = headToHead.reduce((sum, game) => {
    if (game.homeScore === null || game.awayScore === null) {
      return sum;
    }
    if (game.home === teamId) {
      return sum + game.homeScore - game.awayScore;
    }
    return sum + game.awayScore - game.homeScore;
  }, 0);
  if (pointDiff === 0) {
    return null;
  }
  return pointDiff > 0 ? "won" : "lost";
}

function fallbackSort(
  ids: TeamId[],
  teamLookup: Record<TeamId, TeamRecord>,
  fallbackCompare?: (a: TeamRecord, b: TeamRecord) => number | null,
): TeamId[] {
  return [...ids].sort((leftId, rightId) => {
    const left = teamLookup[leftId];
    const right = teamLookup[rightId];
    const fallback = fallbackCompare?.(left, right) ?? null;
    if (fallback !== null && fallback !== 0) {
      return fallback;
    }
    return left.name.localeCompare(right.name);
  });
}

function buildGroupStats(teamIds: TeamId[], games: ResolvedGame[]): Record<TeamId, TeamTieStats> {
  const teamSet = new Set(teamIds);
  const stats: Record<TeamId, TeamTieStats> = {};
  for (const id of teamIds) {
    stats[id] = { wins: 0, games: 0, pointDiff: 0, pointsFor: 0 };
  }

  for (const game of games) {
    if (!teamSet.has(game.home) || !teamSet.has(game.away)) {
      continue;
    }
    if (game.winner) {
      stats[game.home].games += 1;
      stats[game.away].games += 1;
      stats[game.winner].wins += 1;
    }
    if (game.scoreKnown && game.homeScore !== null && game.awayScore !== null) {
      stats[game.home].pointDiff += game.homeScore - game.awayScore;
      stats[game.away].pointDiff += game.awayScore - game.homeScore;
      stats[game.home].pointsFor += game.homeScore;
      stats[game.away].pointsFor += game.awayScore;
    }
  }

  return stats;
}

function allEqual(values: number[]): boolean {
  if (values.length <= 1) {
    return true;
  }
  const [first, ...rest] = values;
  return rest.every((value) => value === first);
}

function groupByMetric(
  teamIds: TeamId[],
  metric: (teamId: TeamId) => number,
): TeamId[][] {
  const buckets = new Map<number, TeamId[]>();
  for (const teamId of teamIds) {
    const value = metric(teamId);
    const bucket = buckets.get(value);
    if (bucket) {
      bucket.push(teamId);
    } else {
      buckets.set(value, [teamId]);
    }
  }
  return Array.from(buckets.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([, ids]) => ids);
}

function buildOverallStats(
  teamIds: TeamId[],
  games: ResolvedGame[],
): { stats: Record<TeamId, TeamTieStats>; complete: boolean } {
  const teamSet = new Set(teamIds);
  const stats: Record<TeamId, TeamTieStats> = {};
  for (const teamId of teamIds) {
    stats[teamId] = { wins: 0, games: 0, pointDiff: 0, pointsFor: 0 };
  }

  let complete = true;

  for (const game of games) {
    const homeTracked = teamSet.has(game.home);
    const awayTracked = teamSet.has(game.away);
    if (!homeTracked && !awayTracked) {
      continue;
    }

    if (!game.scoreKnown || game.homeScore === null || game.awayScore === null) {
      complete = false;
      continue;
    }

    if (homeTracked) {
      stats[game.home].games += 1;
      stats[game.home].pointDiff += game.homeScore - game.awayScore;
      stats[game.home].pointsFor += game.homeScore;
      if (game.homeScore > game.awayScore) {
        stats[game.home].wins += 1;
      }
    }
    if (awayTracked) {
      stats[game.away].games += 1;
      stats[game.away].pointDiff += game.awayScore - game.homeScore;
      stats[game.away].pointsFor += game.awayScore;
      if (game.awayScore > game.homeScore) {
        stats[game.away].wins += 1;
      }
    }
  }

  return { stats, complete };
}

function tryFallbackResolution(
  teamIds: TeamId[],
  teamLookup: Record<TeamId, TeamRecord>,
  fallbackCompare?: (a: TeamRecord, b: TeamRecord) => number | null,
): TieResolution {
  const rankedIds = fallbackSort(teamIds, teamLookup, fallbackCompare);
  if (teamIds.length === 2) {
    const [leftId, rightId] = rankedIds;
    const left = teamLookup[leftId];
    const right = teamLookup[rightId];
    const fallback = fallbackCompare?.(left, right) ?? null;
    if (fallback !== null && fallback !== 0) {
      return { rankedIds, unresolvedGroups: [] };
    }
  }
  return { rankedIds, unresolvedGroups: [rankedIds] };
}

function flattenResolutions(
  groups: TeamId[][],
  resolveGroup: (teamIds: TeamId[]) => TieResolution,
): TieResolution {
  const rankedIds: TeamId[] = [];
  const unresolvedGroups: TeamId[][] = [];
  for (const group of groups) {
    const resolution = resolveGroup(group);
    rankedIds.push(...resolution.rankedIds);
    unresolvedGroups.push(...resolution.unresolvedGroups);
  }
  return { rankedIds, unresolvedGroups };
}

function resolveTieGroup(
  teamIds: TeamId[],
  resolvedGames: ResolvedGame[],
  teamLookup: Record<TeamId, TeamRecord>,
  fallbackCompare?: (a: TeamRecord, b: TeamRecord) => number | null,
): TieResolution {
  if (teamIds.length <= 1) {
    return { rankedIds: [...teamIds], unresolvedGroups: [] };
  }

  const groupGames = resolvedGames.filter(
    (game) => teamIds.includes(game.home) && teamIds.includes(game.away),
  );
  const winnersKnown = groupGames.every((game) => game.winner !== null);
  if (!winnersKnown) {
    return tryFallbackResolution(teamIds, teamLookup, fallbackCompare);
  }

  const directStats = buildGroupStats(teamIds, groupGames);
  const winsGroups = groupByMetric(teamIds, (teamId) => directStats[teamId].wins);
  if (winsGroups.length > 1) {
    return flattenResolutions(winsGroups, (group) =>
      resolveTieGroup(group, resolvedGames, teamLookup, fallbackCompare),
    );
  }

  const equalDirectGames = allEqual(teamIds.map((teamId) => directStats[teamId].games));
  const directScoresKnown = groupGames.every((game) => game.scoreKnown);

  if (equalDirectGames && directScoresKnown) {
    const directDiffGroups = groupByMetric(
      teamIds,
      (teamId) => directStats[teamId].pointDiff,
    );
    if (directDiffGroups.length > 1) {
      return flattenResolutions(directDiffGroups, (group) =>
        resolveTieGroup(group, resolvedGames, teamLookup, fallbackCompare),
      );
    }

    const directPointsGroups = groupByMetric(
      teamIds,
      (teamId) => directStats[teamId].pointsFor,
    );
    if (directPointsGroups.length > 1) {
      return flattenResolutions(directPointsGroups, (group) =>
        resolveTieGroup(group, resolvedGames, teamLookup, fallbackCompare),
      );
    }
  }

  const overall = buildOverallStats(teamIds, resolvedGames);
  if (overall.complete) {
    const overallDiffGroups = groupByMetric(
      teamIds,
      (teamId) => overall.stats[teamId].pointDiff,
    );
    if (overallDiffGroups.length > 1) {
      return flattenResolutions(overallDiffGroups, (group) =>
        resolveTieGroup(group, resolvedGames, teamLookup, fallbackCompare),
      );
    }

    const overallPointsGroups = groupByMetric(
      teamIds,
      (teamId) => overall.stats[teamId].pointsFor,
    );
    if (overallPointsGroups.length > 1) {
      return flattenResolutions(overallPointsGroups, (group) =>
        resolveTieGroup(group, resolvedGames, teamLookup, fallbackCompare),
      );
    }
  }

  return tryFallbackResolution(teamIds, teamLookup, fallbackCompare);
}

export function resolveStandingsByTiebreaks(
  teams: TeamRecord[],
  wins: Record<TeamId, number>,
  options: ResolveOptions = {},
): StandingsResolution {
  const teamLookup: Record<TeamId, TeamRecord> = {};
  for (const team of teams) {
    teamLookup[team.id] = team;
  }

  const totalGames = options.totalGames;
  const resolvedGames = options.games
    ? buildResolvedGames(options.games, options.forcedOutcomes)
    : [];

  const buckets = new Map<string, TeamId[]>();
  for (const team of teams) {
    const gamesPlayed = totalGames?.[team.id];
    const numerator = wins[team.id];
    const denominator = gamesPlayed && gamesPlayed > 0 ? gamesPlayed : 1;
    const divisor = gcd(numerator, denominator);
    const key = `${numerator / divisor}:${denominator / divisor}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(team.id);
    } else {
      buckets.set(key, [team.id]);
    }
  }

  const rankedIds: TeamId[] = [];
  const unresolvedGroups: TeamId[][] = [];

  for (const [, tiedIds] of Array.from(buckets.entries()).sort((left, right) => {
    const [leftWins, leftGames] = left[0].split(":").map(Number);
    const [rightWins, rightGames] = right[0].split(":").map(Number);
    return rightWins * leftGames - leftWins * rightGames;
  })) {
    const resolution =
      tiedIds.length > 1
        ? resolveTieGroup(tiedIds, resolvedGames, teamLookup, options.fallbackCompare)
        : { rankedIds: tiedIds, unresolvedGroups: [] };
    rankedIds.push(...resolution.rankedIds);
    unresolvedGroups.push(...resolution.unresolvedGroups);
  }

  return { rankedIds, unresolvedGroups };
}
