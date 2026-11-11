import {
  fitEfficiency,
  predictEfficiency,
  EFFICIENCY_CONFIG,
} from "./efficiency";
import type { DataFile, Game } from "./types";
import { assertEfficiencyCoverage } from "./ffbbEfficiency";
export const DEFAULT_HOME_ADV = EFFICIENCY_CONFIG.homeAdv;
export const DEFAULT_PROBABILITY_SCALE = EFFICIENCY_CONFIG.probabilityScale;
export type GameForecast = Pick<
  ReturnType<typeof predictEfficiency>,
  "homeScore" | "awayScore" | "margin" | "homeWinProbability"
>;

export const MODEL_CONFIG = {
  standingsVersion: "ffbb-2026-score-v1",
  modelVersion: "adjusted-efficiency-20-v1",
  marginCap: EFFICIENCY_CONFIG.marginCap,
  strengthRidge: EFFICIENCY_CONFIG.ridge,
  paceRidge: EFFICIENCY_CONFIG.paceRidge,
  ftCoefficient: EFFICIENCY_CONFIG.ftCoefficient,
  homeAdv: DEFAULT_HOME_ADV,
  probabilityScale: DEFAULT_PROBABILITY_SCALE,
  ratingUnits: "points-per-100-possessions",
};
export function createProjectionModel(
  data: DataFile,
  options: { homeAdv?: number; probabilityScale?: number } = {},
) {
  assertEfficiencyCoverage(data);
  const fit = fitEfficiency(data, data.boxScores ?? [], {
    homeAdv: options.homeAdv ?? DEFAULT_HOME_ADV,
    probabilityScale: options.probabilityScale ?? DEFAULT_PROBABILITY_SCALE,
  });
  const strengthRatings = Object.fromEntries(
    Object.entries(fit.teams).map(([id, t]) => [id, t.net]),
  );
  const forecast = (game: Game) => predictEfficiency(fit, game.home, game.away);
  return {
    fit,
    forecast,
    strengthRatings,
    homeProbability: (game: Game) => forecast(game).homeWinProbability,
    metadata: {
      ...MODEL_CONFIG,
      homeAdv: fit.config.homeAdv,
      probabilityScale: fit.config.probabilityScale,
      strengthRatings,
      efficiencyRatings: fit.teams,
      groupEfficiency: fit.averageEfficiency,
      groupPace: fit.averagePace,
    },
  };
}
