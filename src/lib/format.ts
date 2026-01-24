export function formatTopOdds(prob: number, decimals = 1): string {
  if (prob >= 1 - 1e-9) {
    return `${(100).toFixed(decimals)}%`;
  }
  const capped = Math.min(prob, 0.999);
  return `${(capped * 100).toFixed(decimals)}%`;
}
