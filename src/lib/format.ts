export function formatTopOdds(prob: number, decimals = 1): string {
  if (prob >= 1 - 1e-9) {
    return `${(100).toFixed(decimals)}%`;
  }
  if (prob <= 0) {
    return `${(0).toFixed(decimals)}%`;
  }
  const capped = Math.min(prob, 0.999);
  const minDisplay = 0.001;
  if (capped < minDisplay) {
    return `${(minDisplay * 100).toFixed(decimals)}%`;
  }
  return `${(capped * 100).toFixed(decimals)}%`;
}
