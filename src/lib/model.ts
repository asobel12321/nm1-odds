import type { DataFile, TeamId } from "./types";

export const MODEL_VERSION = "adjusted-margin-20-v1";
export const MARGIN_CAP = 20;
export const STRENGTH_RIDGE = 4;
export const DEFAULT_HOME_ADV = 3; // Points, used in both rating fit and game prediction.
export const DEFAULT_PROBABILITY_SCALE = 10; // Logistic scale in points; provisional, not backtested.
export const MODEL_CONFIG = {
  modelVersion: MODEL_VERSION,
  marginCap: MARGIN_CAP,
  strengthRidge: STRENGTH_RIDGE,
  homeAdv: DEFAULT_HOME_ADV,
  probabilityScale: DEFAULT_PROBABILITY_SCALE,
};

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Fit neutral-court ratings from completed scores only. Each game has equal weight. */
export function fitStrengthRatings(
  data: DataFile,
  homeAdv = DEFAULT_HOME_ADV,
): Record<TeamId, number> {
  if (!Number.isFinite(homeAdv))
    throw new Error("Home advantage must be finite.");
  const ids = data.teams.map((team) => team.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? STRENGTH_RIDGE : 0)),
  );
  const rhs = Array<number>(n).fill(0);
  for (const game of data.games) {
    if (!game.played) continue;
    const i = index.get(game.home),
      j = index.get(game.away);
    if (
      i === undefined ||
      j === undefined ||
      i === j ||
      typeof game.homeScore !== "number" ||
      typeof game.awayScore !== "number" ||
      !Number.isFinite(game.homeScore) ||
      !Number.isFinite(game.awayScore)
    ) {
      throw new Error(`Invalid completed game: ${game.id}`);
    }
    const margin = Math.max(
      -MARGIN_CAP,
      Math.min(MARGIN_CAP, game.homeScore - game.awayScore),
    );
    const neutralMargin = margin - homeAdv;
    matrix[i][i]++;
    matrix[j][j]++;
    matrix[i][j]--;
    matrix[j][i]--;
    rhs[i] += neutralMargin;
    rhs[j] -= neutralMargin;
  }
  // Solve the ridge-regularized normal equations with partial pivoting.
  const augmented = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col]))
        pivot = row;
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];
    const scale = augmented[col][col];
    if (Math.abs(scale) < 1e-10) throw new Error("Strength model is singular.");
    for (let j = col; j <= n; j++) augmented[col][j] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j <= n; j++)
        augmented[row][j] -= factor * augmented[col][j];
    }
  }
  return Object.fromEntries(ids.map((id, i) => [id, augmented[i][n]]));
}

/** A positive expected home margin raises the home team's win probability. */
export function winProb(
  home: number,
  away: number,
  probabilityScale: number,
  homeAdv: number,
): number {
  if (!Number.isFinite(probabilityScale) || probabilityScale <= 0)
    throw new Error("Probability scale must be positive.");
  return sigmoid((home - away + homeAdv) / probabilityScale);
}
