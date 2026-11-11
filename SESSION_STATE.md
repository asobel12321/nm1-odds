# Session State

## Objective

Use the official 2026/27 NM1 tiebreaks in Vitré’s top-seven forecasts, including the combined score of head-to-head matchups.

## Branch

codex/nm1-tiebreak-release (release record for codex/nm1-score-tiebreakers) in the nm1-odds-efficiency worktree. Canonical checkout: C:/Users/asobe/Projects/Active/nm1-odds.

## Current Status

Published 11 November 2026 through PR11: https://github.com/asobel12321/nm1-odds/pull/11. Feature merged as 9ca801af858ba3ad6613d2454815143c34c9a693. Using the same validated 58-game snapshot, Vitré’s forecast changes from 69.59% to 70.03%. Next-game win 78.44%, loss 59.34%, best round 80.36%. Live homepage and API both verified the new standings version and 70.0% displayed odds; canonical Active checkout synced.

## Files Changed

Shared season sampler, projection forecast adapter, tiebreak resolver, full/focus simulations and win table, next-game/best-round callers, experimental comparison adapter, odds cache, tests, homepage/what-if methodology, and documentation.

## Accomplishments

- Checked FFBB general Articles 16–17 and the NM1 phase-one cutoff in the published 2026/27 rulebooks.
- Rank projections by classification points; resolve ties by mini-table points, head-to-head margin and scoring, then overall group margin and scoring. Restart after a split; share positions if the rule calls for drawing lots.
- Use real completed scores and projected totals with logistic sampled margins for future games. Forced results condition the margin on the chosen winner.
- Keep the same one draw per fixture, model ratings, home advantage, win probabilities, sampled win histograms, and live standings presentation.
- Version the cache and apply the same ranking and scores to headline odds, what-if, best round, next-game odds and the win target.

## Things Tried

Initial full recompute took 36.3 seconds. Narrowed score work to games involving tied teams and the best-round shortcut to the cutoff tie. Final 64-combination best-round search took 8.68 seconds and reproduced the saved result exactly.

## Things Learned

A split series uses the sum of the two margins. In a multi-team tie, the criteria restart with the remaining tied subset rather than moving straight to the next criterion.

## Known Issues

Future score totals are projected, with stochastic margins; the model does not forecast match-level administrative rulings or forfeits. It starts from the official classification points reported in the snapshot. Existing win-probability calibration caveats remain.

## Verification Run

- npm test: PASS, 43 tests, including 7 new cases for official rule order, conditional score draws and seventh-place replay.
- npm run lint: PASS.
- npm run build: PASS, including final TypeScript compilation.
- npm run recompute: PASS; exact baseline win histograms, ratings and data fingerprint match prior cache.
- Final optimized best-round cache replay: PASS, exact, 8.68 seconds for 64 combinations.
- git diff --check: PASS.
- Built homepage and what-if API: PASS, 13 standings rows, updated methodology, and all three scenario probabilities replay exactly.
- GitHub CI and Vercel preview/production deployment: PASS.
- Live homepage/API: PASS, ffbb-2026-score-v1, 70.0% baseline, all three scenarios, 13 standings rows.

## Next Steps

Release complete. Local server stopped. The existing automatic refresh recomputes the official tiebreak projections as new scores are validated.
