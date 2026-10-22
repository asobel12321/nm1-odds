# Vitré · The top seven race

NM1 2026–2027 Phase 1, Group B. Tracks Aurore Vitré Basket Bretagne’s chance of finishing **1–7** and qualifying for Phase 2’s upper group (Groupe A).

Production: https://nm1-odds.vercel.app · Source: https://nm1.ffbb.com/saison-reguliere

## Canonical checkout

Use `C:\Users\asobe\Projects\Active\nm1-odds`. Keep source outside OneDrive. GitHub `asobel12321/nm1-odds` is the shared source of truth. The previous ChatGPT folder was an empty repository, not an existing source checkout.

Open this Active folder as the project in your editor/Codex. Use one checkout for this project. `node_modules`, `.next`, `.vercel`, secrets and local environment files are ignored. Never synchronize Git internals with OneDrive.

## Local commands (Node 22+)

```sh
npm ci
npm run dev
npm run refresh
npm test
npm run typecheck
npm run build
```

`refresh` imports and validates the official page, then recomputes the 20,000-simulation cache. Validation requires 13 Group B teams, all 156 home/away fixtures, unique IDs, and score-derived records matching the standings. A malformed/incomplete upstream page fails before replacing the existing snapshot. The data contains actual source timestamps and official ranks. FFBB fixture times are Europe/Paris local time.

The hosted site checks FFBB through a server-side cache refreshed approximately hourly on traffic. Fresh source data is validated before simulation; a source failure falls back to the validated Git snapshot with its original timestamp. The UI warns when the source timestamp is over two days old. A new season fails the live refresh rather than silently reusing this season’s rules.

GitHub Actions also saves a validated snapshot and odds to GitHub daily at 05:30 UTC, with a manual-run option. The hosted Data Cache means daily bot commits do not need to trigger Vercel deployments to keep live probabilities current. Pull remote snapshots into the canonical checkout with `git pull --ff-only` before editing.

## Git workflow

Before editing: `git status` then `git pull --ff-only` on a clean branch. Create a `codex/<description>` feature branch. Commit reviewed changes and `git push -u origin <branch>`. Merge reviewed work to `main` through GitHub; Vercel is connected to this repo. After remote data refreshes, pull before editing. Never use force push as routine sync.

## Model and limits

Power rating is now **opponent-adjusted net efficiency per100 possessions**: adjusted ORTG minus adjusted DRTG. Ratings use current-season game box scores, estimate possessions from attempts/rebounds/turnovers/free throws, account for opponents and venue, and fit an adjusted pace. New rosters receive no previous-season team strengths.

The model retains the ±20 game-point margin cap, ridge weight4, +3-point home advantage and logistic probability scale10. Expected game margin = net-rating difference × projected possessions/100 +3 home points. Ratings and pace remain fixed inside each simulated season. Standings retain their existing winning-percentage order; the power-rating column does not sort the table.

See [the full production methodology](docs/METHODOLOGY.md), also explained in the homepage transparency section. The same model supplies headline odds, schedule probabilities, win-target rows and what-if scenarios. Independent historical efficiency validation remains pending.

Production data includes validated box scores with source provenance. A score-and-stat mismatch retains the previous complete snapshot. Hosted refreshes check hourly and reuse matching boxes; the daily GitHub refresh fetches all completed boxes to pick up statistical corrections. Cache invalidation includes possession inputs and model configuration. Top-seven simulations retain the existing tiebreak approximation, and the what-if API still caps forced scenarios at5,000 simulations.

Competition format: https://nm1.ffbb.com/playoffs/page/4-formule-du-championnat-de-france-nm1

## Original development comparison

The original comparison is retained as a development record; production now uses the efficiency model documented above. It fits current-season offensive and defensive efficiency per 100 estimated possessions, adjusted for opponents and venue, plus an adjusted pace. It retains the 20-point game-margin cap and three-point home advantage. See [the draft results and methodology](docs/EFFICIENCY_DRAFT.md).

```sh
npm run efficiency:import
npm run efficiency:import -- --refresh
npm run efficiency:explore
```

The first command reuses locally cached source pages; `--refresh` fetches a fresh snapshot. The importer validates every completed Group B box score and reconciles the results with FFBB team averages before replacing `data/experimental/poule-b-boxscores.json`. That input is independent of daily production refreshes. Reports, CSVs and source-page caches live in ignored `outputs/efficiency/`; the public-data input, source URLs/hashes and regression fixtures are tracked. The draft's future fixture probabilities and season simulations are written to `outputs/efficiency/comparison.json`. Its small early-season comparison does not establish superior calibration.
