import { createProjectionModel } from "./projectionModel";
import { simulateQualificationOdds } from "./simulate";
import type { DataFile, NextGameResult, SimParams, TeamId } from "./types";

export const NEXT_GAME_VERSION = "next-game-v1";
export const NEXT_GAME_SIMULATIONS = 5000;

/** Force only Vitré's next result; every other remaining game follows the model. */
export function buildNextGame(
  data: DataFile,
  teamId: TeamId,
  params: SimParams,
): NextGameResult | null {
  if (!data.teams.some((team) => team.id === teamId))
    throw new Error("Unknown focus team");
  if (!Number.isFinite(params.simulations))
    throw new Error("Invalid simulation count");
  if (Object.keys(params.forcedOutcomes ?? {}).length > 0)
    throw new Error("Next-game scenarios cannot include other forced outcomes");
  const game = data.games
    .filter((g) => !g.played && (g.home === teamId || g.away === teamId))
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    )[0];
  if (!game) return null;
  const simulations = Math.max(
    1,
    Math.min(NEXT_GAME_SIMULATIONS, Math.floor(params.simulations)),
  );
  const seed = params.seed ?? 1;
  const predict = createProjectionModel(data, params).homeProbability;
  const win = game.home === teamId ? "home" : "away";
  const loss = win === "home" ? "away" : "home";
  const conditional = (outcome: "home" | "away") =>
    simulateQualificationOdds(
      data,
      teamId,
      {
        ...params,
        simulations,
        seed,
        focusId: teamId,
        forcedOutcomes: { [game.id]: outcome },
      },
      predict,
    );
  return {
    game,
    simulations,
    seed,
    winOdds: conditional(win),
    lossOdds: conditional(loss),
  };
}
