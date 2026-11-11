import { predictEfficiency, type EfficiencyFit } from "./efficiency";
import { simulateSeason } from "./simulate";
import type { DataFile, SimResult } from "./types";

/** Experimental fit using the same score draws and standings rules as production. */
export function simulateEfficiencySeason(
  data: DataFile,
  fit: EfficiencyFit,
  simulations = 20000,
  seed = 20261022,
): SimResult {
  if (!Number.isInteger(simulations) || simulations < 1 || simulations > 250000)
    throw new Error("Invalid simulation count");
  if (data.teams.some((team) => !fit.teams[team.id]))
    throw new Error("Missing team efficiency");
  return simulateSeason(
    data,
    {
      simulations,
      seed,
      homeAdv: fit.config.homeAdv,
      probabilityScale: fit.config.probabilityScale,
    },
    (game) => predictEfficiency(fit, game.home, game.away),
  );
}
