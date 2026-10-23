# Adjusted efficiency production release

- [x] Validate current Group B box scores and reconcile all13 teams.
- [x] Fit opponent-adjusted offense, defense, net efficiency and pace.
- [x] Connect headline odds, fixture probabilities, win-target table and scenarios.
- [x] Preserve cap20, +3 home advantage, standings order and tiebreak rules.
- [x] Validate complete source refreshes and possession-aware cache invalidation.
- [x] Update homepage methodology, README and production documentation.
- [x] Regenerate complete production data and odds snapshots.
- [x] Pass26 tests, typecheck, full lint, build and local HTTP checks.
- [x] Pass GitHub checks, merge PR6 and verify production.

## Review/results

Vitré adjusted net+1.55 per100. Production snapshot top7=73.36%,20,000 simulations, seed20261021. Independent historical efficiency validation is pending. The original39-game comparison was essentially even with the old margin model. Production refreshes retain a complete saved snapshot when FFBB scores and possession inputs disagree.

## 90% homepage target

- [x] Derive the minimum sampled win target from the existing conditional win table.
- [x] Add the target near the hero headline, with its final record and actual estimated chance.
- [x] Verify, merge and confirm the live target updates from model data.

## Best upcoming round
- [x] Preserve official round numbers and compare all outcomes with shared randomness.
- [x] Cache and display the full best-case scenario and conditional top-seven odds.
- [x] Verify round grouping, probability replay, UI and performance; publish and confirm live.


## Best-round review/results

Published PR8 on 23 October 2026. Round 8 best case: Bordeaux, Laval, Lorient, Vitré, Challans and Rennes win; conditional top-seven odds 83.14% versus the unchanged 73.36% headline forecast. All six displayed outcomes reproduce the estimate in the full simulator and API. All 32 tests, typecheck, lint, build, GitHub checks and Vercel deployment passed. Production HTTP and browser inspection passed. Conditional estimates retain existing model and future-score tiebreak limitations; scenario calculations use 5,000 shared-draw simulations per combination.
