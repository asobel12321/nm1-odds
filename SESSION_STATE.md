# Session State

## Objective

Add a prominent, automatically updating 90%+ top-seven win target near the homepage headline, using existing conditional simulation results.

## Branch

codex/ninety-percent-target in C:\Users\asobe\Projects\Worktrees\nm1-odds-efficiency. Canonical checkout: C:\Users\asobe\Projects\Active\nm1-odds.

## Current Status

Implemented and locally verified. Ready to sync, merge and confirm production.

## Files Changed

src/app/page.tsx, src/app/globals.css, src/lib/winTable.ts, tests/model.test.ts, docs/METHODOLOGY.md, tasks/todo.md, SESSION_STATE.md.

## Accomplishments

- Select the fewest remaining wins whose final-record qualification estimate is at least90%, with at least100 samples.
- Show the target, remaining games, final record and actual probability near the headline.
- Current target10 of19 remaining wins;13–11 finish;97.7% conditional qualification estimate.
- Unsupported samples show an unavailable message; the banner is hidden once no games remain.
- No changes to ratings, probabilities, standings order or simulations.

## Things Tried

In-app browser was unavailable. Used the available Chrome browser to inspect the built homepage and its screenshot.

## Things Learned

The available integer win totals jump from70.3% at12–12 to97.7% at13–11. Label the banner90%+ rather than imply an exact90% probability.

## Known Issues

The win target is conditional on reaching the stated final record and the simulated mix of results, not a guaranteed clinch. Existing efficiency-model limitations remain as described in docs/METHODOLOGY.md.

## Verification Run

- npm test: PASS,27 tests including threshold/sample filtering.
- npm run typecheck: PASS.
- npm run lint: PASS.
- npm run build: PASS.
- Chrome rendered-page and screenshot check: PASS, target visible near hero headline.
- git diff --check: PASS.

## Next Steps

Publish through a feature PR and verify the production target. The estimate updates automatically with future valid model snapshots.
