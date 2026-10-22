# Session State

## Objective

Activate opponent-adjusted net efficiency in season projections, update the on-site methodology, and merge PR6 to main as explicitly requested by the user.

## Branch

codex/adjusted-efficiency, C:\Users\asobe\Projects\Worktrees\nm1-odds-efficiency.
Canonical checkout: C:\Users\asobe\Projects\Active\nm1-odds.
PR: https://github.com/asobel12321/nm1-odds/pull/6. GitHub is authoritative for final merge/deployment status.

## Current Status

Production integration and local verification complete. User authorized promotion to main. Ready to push the release commit, pass CI, merge PR6 and verify production.

## Files Changed

- projectionModel.ts centralizes production configuration, complete-box coverage and game probabilities.
- ffbbEfficiency.ts validates and refreshes scores and possession inputs together.
- Production simulator, win-target table, schedule UI, what-if API, cache and refresh scripts use the efficiency model.
- Production data/odds snapshots include39 validated games, efficiency metadata, source provenance and all13 teams.
- Homepage transparency, rating units, README and docs/METHODOLOGY.md describe the new calculation.
- tests/production-efficiency.test.ts adds input-coverage, cache and source-correction safeguards.
- Original draft comparison and legacy margin functions remain available for research.

## Accomplishments

- Same current-season-only model across headline odds, fixture odds, conditional win targets and forced scenarios.
- Preserved +3 home advantage, ±20 game-point cap, ridge4, logistic scale10, qualification rules and standings order.
- Power rating now AdjORTG minus AdjDRTG in points per100 possessions.
- Hosted refreshes reuse matching boxes, fetch new/changed games and retry all boxes on team-average discrepancies.
- Daily refresh fetches all boxes; invalid source updates retain the last complete saved snapshot.
- Removed the page's Date.now render-purity lint issue by calculating source age in the cached server loader.
- Vitré rating+1.5549, production snapshot top7=73.36% with20,000 simulations and seed20261021.

## Things Tried

The first production write was stopped by an automatic approval-review usage limit; no write occurred. Normal approved execution resumed after the user requested completion.

## Things Learned

A draft-only merge would not change live predictions. Production integration must include automatic possession-data refresh and cache invalidation. PFB means Pays de Fougères this season.

## Known Issues

Independent historical efficiency validation remains pending. FT coefficient0.44, ridge4 and logistic scale10 remain provisional. Injuries, future roster changes, future strength uncertainty and administrative deductions are not forecast. Future tiebreak scores remain synthetic75–74.
The original39-game comparison was essentially even with the previous model. Do not describe it as proof of better prediction.

## Verification Run

- Fresh npm run refresh: PASS,13 teams/156 fixtures/39 complete box scores.
- npm test: PASS,26 tests.
- npm run typecheck: PASS.
- npm run lint: PASS (full repository).
- npm run build: PASS.
- Built-app HTTP checks: PASS, homepage methodology and model version, unchanged standings order, baseline efficiency API, forced Vitré sweep top7=100%, invalid fixture400, what-if page200.
- git diff --check: PASS.

## Next Steps

Complete PR6 merge and production verification. Later: audit historical box scores and evaluate this fixed model on independent group-seasons. Do not transfer old team ratings to new rosters.
