export const DEFAULT_K = 2.2;
export const DEFAULT_HOME_ADV = 0.125;
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
export function teamStrength(wins: number, losses: number): number {
  return (wins + 2) / (wins + losses + 4);
}
export function winProb(
  home: number,
  away: number,
  k: number,
  homeAdv: number,
): number {
  return sigmoid(k * (home - away) + homeAdv);
}
