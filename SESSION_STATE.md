# Session State

## Objective

Build an experimental KenPom-style adjusted net efficiency rating from this season's FFBB Group B box scores and use it for season projections, without switching the live site.

## Branch

codex/adjusted-efficiency in C:\Users\asobe\Projects\Worktrees\nm1-odds-efficiency. Based on main 9624450. Canonical main checkout remains C:\Users\asobe\Projects\Active\nm1-odds.

## Current Status

Working draft implemented and verified. Synced to GitHub as draft PR https://github.com/asobel12321/nm1-odds/pull/6; not merged or selected by the production model.

## Files Changed

- src/lib/ffbbBoxScore.ts: validated game-total parser.
- src/lib/efficiency.ts: possession estimates, opponent/venue-adjusted offense, defense, net and pace.
- src/lib/efficiencySimulate.ts: experimental season simulation sharing existing ranking/tiebreak rules.
- scripts/import-efficiency-boxscores.ts and scripts/explore-efficiency.ts; package scripts.
- data/experimental/poule-b-boxscores.json: frozen public input with provenance and audit.
- tests/efficiency.test.ts and two minimal public golden box-score fixtures.
- docs/EFFICIENCY_DRAFT.md, README.md, .gitignore, tasks/todo.md and this handoff.

## Accomplishments

- All 39 completed games validated, all 13 teams covered; totals reconcile to FFBB team averages.
- Preserved cap20 and +3-point home adjustment. New rosters start with no prior team strength.
- Fitted offensive/defensive efficiency and pace; compared FT coefficients0.44 and0.475.
- Ran 50,000 simulations each for current margin model and both efficiency variants, same seed.
- Vitré draft AdjO99.1796, AdjD97.6247, net+1.5549 per100; draft top7=73.584%, current comparison=73.496%.
- Current-season walk-forward Brier: draft0.242543 versus current0.242892 over39 games. Too small to establish improvement.
- Production model, simulator, routing, UI and production snapshots untouched.

## Things Tried

- Shared dependency junction worked for scripts but Turbopack rejected dependencies outside its root. Replaced it with an independent npm ci --ignore-scripts installation; build then passed.
- Two initial test expectations were corrected (hand-calculated possessions and comparing raw fields in a capped-fit test); final tests pass.
- Full lint identifies an existing Date.now render-purity violation in src/app/page.tsx:51. Reproduced on unchanged canonical main. New files lint clean.

## Things Learned

- Current PFB abbreviation means Pays de Fougères Basket (team345), not Pôle France.
- Vitré–Fougères included overtime: normalize tempo to40 minutes while efficiency uses actual game possessions.
- FFBB rounded team averages are useful for reconciliation; per-game boxes are required for opponent adjustment and chronological backtests.

## Known Issues

- Model remains experimental; ridge4, FT coefficient, pace fit and logistic scale10 require independent validation.
- Only39 current-season results evaluated. No historical efficiency backtest yet.
- Predictions omit injuries, roster changes and future rating uncertainty. Future tiebreak margins retain the existing synthetic75–74 convention.
- Historical FFBB data previously showed partial feeds; current importer checks consistency but cannot certify upstream statistical accuracy.
- Full-repo lint still fails on the existing production page issue. npm ci reported5 high-severity dependency findings; no dependency changes were made.
- HTTP source caches and generated output are ignored under outputs/efficiency/. Tracked data is a fixed experimental snapshot, independent of daily production updates.

## Verification Run

- npm run efficiency:import: PASS,39/39 games and13/13 teams reconciled.
- npm run efficiency:explore: PASS; leakage assertion passes; report/CSV/comparison JSON generated.
- npm test: PASS,21 tests.
- npm run typecheck: PASS.
- Focused ESLint on all six new TypeScript files: PASS.
- npm run build: PASS with independent worktree dependencies.
- git diff --check: PASS.
- Full npm run lint: FAIL, existing src/app/page.tsx:51 react-hooks/purity issue, reproduced on main.

## Next Steps

Review docs/EFFICIENCY_DRAFT.md and outputs/efficiency/REPORT.md. Import and audit historical box scores, freeze this candidate, and test independent seasons before switching the production model. To fetch a new current-season input: npm run efficiency:import -- --refresh. Regenerate comparisons with npm run efficiency:explore. Do not transfer historical team ratings to new rosters.
