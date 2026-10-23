import { createProjectionModel } from "./projectionModel";
import { simulateQualificationOdds } from "./simulate";
import type {
  BestCaseResult,
  DataFile,
  ForcedOutcomes,
  SimParams,
  TeamId,
} from "./types";

export const BEST_CASE_VERSION = "round-best-v1";
export const BEST_CASE_SIMULATIONS = 5000;
export function nextScenarioRound(data: DataFile) {
  const remaining = data.games
    .filter((g) => !g.played)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const first = remaining[0];
  if (!first) return null;
  const games = remaining.filter((g) =>
    first.round != null
      ? g.round === first.round
      : g.date.slice(0, 10) === first.date.slice(0, 10),
  );
  return {
    roundNumber: first.round ?? null,
    roundDate: games[0].date,
    roundEndDate: games[games.length - 1].date,
    games,
  };
}
/** Enumerate every combination for the next official round, retaining every forced result. */
export function buildBestCase(
  data: DataFile,
  teamId: TeamId,
  params: SimParams,
): BestCaseResult | null {
  const round = nextScenarioRound(data);
  if (!round) return null;
  if (round.games.length > 7) return null; // Malformed round metadata must not break the homepage.
  if (!data.teams.some((t) => t.id === teamId))
    throw new Error("Unknown focus team");
  if (!Number.isFinite(params.simulations))
    throw new Error("Invalid simulation count");
  if (
    Object.keys(params.forcedOutcomes ?? {}).some(
      (id) => !round.games.some((g) => g.id === id),
    )
  )
    throw new Error("Forced outcome outside the scenario round");
  const simulations = Math.max(
    1,
    Math.min(BEST_CASE_SIMULATIONS, Math.floor(params.simulations)),
  );
  const seed = params.seed ?? 1;
  const predict = createProjectionModel(data, params).homeProbability;
  const known = params.forcedOutcomes ?? {},
    unforced = round.games.filter((g) => !known[g.id]),
    scenarios = 2 ** unforced.length;
  const baseline = simulateQualificationOdds(
    data,
    teamId,
    { ...params, simulations, seed },
    predict,
  );
  let best: { odds: number; outcomes: ForcedOutcomes } | undefined;
  for (let mask = 0; mask < scenarios; mask++) {
    const outcomes: ForcedOutcomes = { ...known };
    unforced.forEach((g, i) => {
      outcomes[g.id] = mask & (1 << i) ? "home" : "away";
    });
    const odds = simulateQualificationOdds(
      data,
      teamId,
      { ...params, simulations, seed, forcedOutcomes: outcomes },
      predict,
    );
    if (!best || odds > best.odds) best = { odds, outcomes };
  }
  if (!best) return null;
  const selected: ForcedOutcomes = Object.fromEntries(
    round.games.map((g) => [g.id, best!.outcomes[g.id]]),
  );
  return {
    ...round,
    scenarios,
    simulations,
    seed,
    baselineOdds: baseline,
    odds: best.odds,
    outcomes: selected,
  };
}
