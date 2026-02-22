// Flatter model for Phase 2: keep outcomes closer to 50/50.
export const DEFAULT_K = 2.0;
export const DEFAULT_HOME_ADV = 0.12;

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function winProb(
  wpctHome: number,
  wpctAway: number,
  k: number,
  homeAdv: number,
): number {
  const diff = wpctHome - wpctAway;
  return sigmoid(k * diff + homeAdv);
}
