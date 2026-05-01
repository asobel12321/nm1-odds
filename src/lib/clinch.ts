import { PLAYOFF_CUTOFF } from "@/lib/competition";
import { findSombId, remainingGames, teamsById } from "@/lib/data";
import { getSombTiebreakStatus, rankTeams } from "@/lib/rank";
import type {
  ClinchResult,
  ClinchScenario,
  DataFile,
  ForcedOutcomes,
  Game,
  TeamId,
} from "@/lib/types";

const MAX_DISPLAY_SCENARIOS = 12;
type Bit = "0" | "1" | "-";

interface Implicant {
  bits: Bit[];
  covers: number[];
}

function dateValue(date: string): number {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function dateKey(date: string): string {
  return date.split(" ")[0] ?? date;
}

function nextRoundGames(games: Game[]): { roundDate: string; games: Game[] } | null {
  if (games.length === 0) {
    return null;
  }
  const sorted = [...games].sort((a, b) => dateValue(a.date) - dateValue(b.date));
  const target = sorted[0];
  const targetKey = dateKey(target.date);
  return {
    roundDate: target.date,
    games: sorted.filter((game) => dateKey(game.date) === targetKey),
  };
}

function finalTotalGames(data: DataFile): Record<TeamId, number> {
  const totals: Record<TeamId, number> = {};
  for (const team of data.teams) {
    totals[team.id] = team.wins + team.losses;
  }
  for (const game of data.games) {
    if (!game.played) {
      totals[game.home] += 1;
      totals[game.away] += 1;
    }
  }
  return totals;
}

function formatOutcomeLabel(
  outcomes: ForcedOutcomes,
  games: Game[],
  teamLookup: Record<string, { name: string }>,
): string {
  const parts = games.flatMap((game) => {
    const outcome = outcomes[game.id];
    if (!outcome) {
      return [];
    }
    const winnerId = outcome === "home" ? game.home : game.away;
    const loserId = outcome === "home" ? game.away : game.home;
    const winner = teamLookup[winnerId]?.name ?? winnerId;
    const loser = teamLookup[loserId]?.name ?? loserId;
    return [`${winner} over ${loser}`];
  });

  if (parts.length === 0) {
    return "Any results on this matchday clinch a top-8 seed.";
  }

  return parts.join("; ");
}

function maskToBits(mask: number, length: number): Bit[] {
  return Array.from({ length }, (_, index) =>
    ((mask >> index) & 1) === 1 ? "1" : "0",
  );
}

function implicantKey(bits: Bit[]): string {
  return bits.join("");
}

function combineImplicants(a: Implicant, b: Implicant): Implicant | null {
  let diffIndex = -1;
  for (let i = 0; i < a.bits.length; i += 1) {
    if (a.bits[i] === b.bits[i]) {
      continue;
    }
    if (a.bits[i] === "-" || b.bits[i] === "-") {
      return null;
    }
    if (diffIndex !== -1) {
      return null;
    }
    diffIndex = i;
  }

  if (diffIndex === -1) {
    return null;
  }

  const bits = [...a.bits];
  bits[diffIndex] = "-";
  const covers = Array.from(new Set([...a.covers, ...b.covers])).sort(
    (left, right) => left - right,
  );
  return { bits, covers };
}

function buildPrimeImplicants(minterms: number[], bitCount: number): Implicant[] {
  let current: Implicant[] = minterms.map((mask) => ({
    bits: maskToBits(mask, bitCount),
    covers: [mask],
  }));
  const primes: Implicant[] = [];

  while (current.length > 0) {
    const used = new Set<number>();
    const next = new Map<string, Implicant>();

    for (let i = 0; i < current.length; i += 1) {
      for (let j = i + 1; j < current.length; j += 1) {
        const combined = combineImplicants(current[i], current[j]);
        if (!combined) {
          continue;
        }
        used.add(i);
        used.add(j);
        next.set(implicantKey(combined.bits), combined);
      }
    }

    for (let i = 0; i < current.length; i += 1) {
      if (!used.has(i)) {
        primes.push(current[i]);
      }
    }

    current = Array.from(next.values());
  }

  const deduped = new Map<string, Implicant>();
  for (const prime of primes) {
    deduped.set(implicantKey(prime.bits), prime);
  }
  return Array.from(deduped.values());
}

function chooseImplicants(minterms: number[], bitCount: number): Implicant[] {
  if (minterms.length === 0) {
    return [];
  }

  const primes = buildPrimeImplicants(minterms, bitCount);
  const coversByMinterm = new Map<number, number[]>();
  for (const minterm of minterms) {
    coversByMinterm.set(minterm, []);
  }
  for (let index = 0; index < primes.length; index += 1) {
    for (const minterm of primes[index].covers) {
      coversByMinterm.get(minterm)?.push(index);
    }
  }

  const chosen = new Set<number>();
  const covered = new Set<number>();

  for (const minterm of minterms) {
    const covering = coversByMinterm.get(minterm) ?? [];
    if (covering.length !== 1) {
      continue;
    }
    chosen.add(covering[0]);
  }

  for (const index of chosen) {
    for (const minterm of primes[index].covers) {
      covered.add(minterm);
    }
  }

  while (covered.size < minterms.length) {
    let bestIndex = -1;
    let bestCoverage = -1;
    let bestSpecificity = Number.POSITIVE_INFINITY;

    for (let index = 0; index < primes.length; index += 1) {
      if (chosen.has(index)) {
        continue;
      }
      const uncovered = primes[index].covers.filter((minterm) => !covered.has(minterm));
      if (uncovered.length === 0) {
        continue;
      }
      const specified = primes[index].bits.filter((bit) => bit !== "-").length;
      if (
        uncovered.length > bestCoverage ||
        (uncovered.length === bestCoverage && specified < bestSpecificity)
      ) {
        bestIndex = index;
        bestCoverage = uncovered.length;
        bestSpecificity = specified;
      }
    }

    if (bestIndex === -1) {
      break;
    }

    chosen.add(bestIndex);
    for (const minterm of primes[bestIndex].covers) {
      covered.add(minterm);
    }
  }

  return Array.from(chosen)
    .map((index) => primes[index])
    .sort((left, right) => {
      const leftSpecified = left.bits.filter((bit) => bit !== "-").length;
      const rightSpecified = right.bits.filter((bit) => bit !== "-").length;
      if (leftSpecified !== rightSpecified) {
        return leftSpecified - rightSpecified;
      }
      return implicantKey(left.bits).localeCompare(implicantKey(right.bits));
    });
}

function implicantToOutcomes(implicant: Implicant, games: Game[]): ForcedOutcomes {
  const outcomes: ForcedOutcomes = {};
  for (let i = 0; i < implicant.bits.length; i += 1) {
    if (implicant.bits[i] === "-") {
      continue;
    }
    outcomes[games[i].id] = implicant.bits[i] === "1" ? "home" : "away";
  }
  return outcomes;
}

function buildClinchingPatterns(
  clinchingMasks: number[],
  games: Game[],
): ClinchScenario[] {
  return chooseImplicants(clinchingMasks, games.length).map((implicant) => ({
    label: "",
    outcomes: implicantToOutcomes(implicant, games),
  }));
}

function canStillMissPlayoffs(
  data: DataFile,
  teamId: TeamId,
  sombId: TeamId,
  nextRoundOutcomes: ForcedOutcomes,
): boolean {
  const wins: Record<TeamId, number> = {};
  for (const team of data.teams) {
    wins[team.id] = team.wins;
  }

  const variableGames: Game[] = [];
  for (const game of remainingGames(data.games)) {
    const forced = nextRoundOutcomes[game.id];
    if (forced) {
      const winnerId = forced === "home" ? game.home : game.away;
      wins[winnerId] += 1;
      continue;
    }

    if (game.home === teamId || game.away === teamId) {
      const opponentId = game.home === teamId ? game.away : game.home;
      wins[opponentId] += 1;
      continue;
    }

    variableGames.push(game);
  }

  const totals = finalTotalGames(data);
  const compareRecord = (leftId: TeamId, rightId: TeamId): number => {
    const leftGames = totals[leftId];
    const rightGames = totals[rightId];
    const diff = wins[leftId] * rightGames - wins[rightId] * leftGames;
    if (diff > 0) {
      return 1;
    }
    if (diff < 0) {
      return -1;
    }
    return 0;
  };

  function isConservativeClinch(): boolean {
    const ranked = rankTeams(data.teams, wins, sombId, totals);
    const teamRank = ranked.indexOf(teamId);
    if (teamRank < 0) {
      return false;
    }
    if (teamRank >= PLAYOFF_CUTOFF) {
      return false;
    }

    let betterCount = 0;
    const tied: TeamId[] = [];

    for (const team of data.teams) {
      const comparison = compareRecord(team.id, teamId);
      if (comparison > 0) {
        betterCount += 1;
        continue;
      }
      if (comparison === 0) {
        tied.push(team.id);
      }
    }

    if (betterCount >= PLAYOFF_CUTOFF) {
      return false;
    }

    const tieSize = tied.length;
    if (betterCount + tieSize <= PLAYOFF_CUTOFF) {
      return true;
    }

    if (
      teamId === sombId &&
      betterCount === PLAYOFF_CUTOFF - 1 &&
      tieSize === 2
    ) {
      const opponentId = tied.find((id) => id !== teamId);
      return (
        opponentId !== undefined &&
        getSombTiebreakStatus(opponentId, sombId) === "won"
      );
    }

    return false;
  }

  function search(index: number): boolean {
    if (index >= variableGames.length) {
      return !isConservativeClinch();
    }

    const game = variableGames[index];

    wins[game.home] += 1;
    if (search(index + 1)) {
      wins[game.home] -= 1;
      return true;
    }
    wins[game.home] -= 1;

    wins[game.away] += 1;
    if (search(index + 1)) {
      wins[game.away] -= 1;
      return true;
    }
    wins[game.away] -= 1;

    return false;
  }

  return search(0);
}

export function scenarioClinchesConservatively(
  data: DataFile,
  teamId: TeamId,
  nextRoundOutcomes: ForcedOutcomes,
): boolean {
  const sombId = findSombId(data) ?? "SOMB";
  return !canStillMissPlayoffs(data, teamId, sombId, nextRoundOutcomes);
}

export function buildClinchScenarios(
  data: DataFile,
  teamId: TeamId,
): ClinchResult | null {
  const sombId = findSombId(data) ?? "SOMB";
  const round = nextRoundGames(remainingGames(data.games));
  if (!round) {
    return null;
  }

  const scenarios = Math.max(1, 2 ** round.games.length);
  const teamLookup = teamsById(data.teams);
  const clinchingMasks: number[] = [];
  let totalClinchingScenarios = 0;

  for (let mask = 0; mask < scenarios; mask += 1) {
    const outcomes: ForcedOutcomes = {};
    for (let i = 0; i < round.games.length; i += 1) {
      const game = round.games[i];
      const bit = (mask >> i) & 1;
      outcomes[game.id] = bit === 1 ? "home" : "away";
    }

    if (!canStillMissPlayoffs(data, teamId, sombId, outcomes)) {
      totalClinchingScenarios += 1;
      clinchingMasks.push(mask);
    }
  }

  const clinchingScenarios = buildClinchingPatterns(
    clinchingMasks,
    round.games,
  )
    .map((scenario) => ({
      ...scenario,
      label: formatOutcomeLabel(scenario.outcomes, round.games, teamLookup),
    }))
    .slice(0, MAX_DISPLAY_SCENARIOS);

  return {
    roundDate: round.roundDate,
    scenarios,
    totalClinchingScenarios,
    clinchingScenarios,
  };
}
