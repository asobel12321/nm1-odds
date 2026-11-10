# Session State

## Objective

Show Vitré’s top-seven odds after a win or loss in its next game, alongside a less prominent best-case round with expandable results.

## Branch

codex/next-game-release (release records after codex/next-game-scenarios) in C:\Users\asobe\Projects\Worktrees\nm1-odds-efficiency. Canonical checkout: C:\Users\asobe\Projects\Active\nm1-odds.

## Current Status

Published on 10 November 2026 through PR9: https://github.com/asobel12321/nm1-odds/pull/9. Merged feature SHA edaef9835fac53c0f074ddb5c32370f9226b40f6. GitHub checks and Vercel preview/production deployments passed. Cached next fixture is home against Les Sables d’Olonne on 13 November at 20:30 France time. Conditional qualification estimates: win 78.18%, loss 58.76%, best Round 11 80.18%; unchanged baseline 69.59%. Production HTTP verified all three estimates, the correct next opponent/date, six collapsed round results and unchanged 13-row standings/baseline. Canonical Active checkout synced.

## Files Changed

src/lib/nextGame.ts; cache types/loading/live and script recompute paths; data/odds.json; UpcomingScenarios replaces BestCaseRound; homepage and compact responsive styles; next-game replay tests; README, methodology, tasks and this handoff.

## Accomplishments

- Select Vitré’s earliest unplayed fixture by date rather than array order or round number.
- Run 5,000 shared-seed simulations for each next-game result, forcing only that fixture and retaining all existing ratings, home advantage and tiebreaks.
- Version and save next-game results with the same validated snapshot and automatic refresh used for the main forecast.
- Show win and loss qualification odds first, then a smaller best-round estimate; required round results use a native details disclosure, collapsed by default.
- Preserve all baseline odds, rating values, rank/win histograms, win-target rows and best-round results exactly.

## Things Tried

Initial synthetic completed-game fixtures lacked required box scores. Corrected test data to pair completed fixtures with valid box inputs; all 36 tests now pass. Windows browser inspection stopped because the tool could not verify its current URL. No further UI actions attempted; verified built HTML and API instead.

## Things Learned

The next official round starts before Vitré’s fixture. Win/loss scenarios must force only Vitré’s next result and allow all other games to follow the model; best-round scenarios condition on the entire listed combination.

## Known Issues

Visual browser inspection was unavailable in this session. Responsive CSS was reviewed, but no screenshot or mobile preview is claimed. Existing sampling, fixed-rating and synthetic future-score tiebreak limitations remain. These are qualification probabilities conditional on results, not the chance of winning the next game.

## Verification Run

- npm test: PASS, 36 tests including home/away result replay, chronological selection, completion and input validation.
- npm run typecheck: PASS.
- npm run lint: PASS.
- npm run build: PASS.
- Regenerated odds cache: PASS; all pre-existing forecasts, ratings and best-round fields equal the previous snapshot exactly.
- Built homepage HTTP: PASS, three correctly labeled estimates, six collapsed round results, 13 standings rows and old oversized section removed.
- POST /api/odds: PASS, both displayed next-game outcomes reproduce the exact qualification probabilities.
- git diff --check: PASS.
- GitHub verification and Vercel preview/production deployment: PASS.
- Live homepage HTTP: PASS, 78.2% win / 58.8% loss / 80.2% best round; 69.6% baseline and six collapsed results.

## Next Steps

Release complete. Local server stopped. Next-game and best-round estimates refresh automatically with validated snapshots. Independent historical efficiency validation remains future work.
