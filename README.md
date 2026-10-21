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

GitHub Actions refreshes the data daily at 05:30 UTC and supports manual runs. Its validated data commits keep GitHub current. Note: pushes made with GitHub’s default `GITHUB_TOKEN` do not trigger other GitHub workflows and may not trigger the Vercel Git integration. For unattended hosting refreshes, configure a Vercel deploy hook or supported bot credential separately; no hosting secrets are stored here. The UI labels the snapshot date and warns when it is over two days old.

## Git workflow

Before editing: `git status` then `git pull --ff-only` on a clean branch. Create a `codex/<description>` feature branch. Commit reviewed changes and `git push -u origin <branch>`. Merge reviewed work to `main` through GitHub; Vercel is connected to this repo. After remote data refreshes, pull before editing. Never use force push as routine sync.

## Model and limits

Each remaining result uses `sigmoid(2 * (homeStrength - awayStrength) + 0.12)`, where strength is `(wins + 2) / (wins + losses + 4)`. This shrinks small early-season samples toward 50%. Strength is fixed during the simulated season; injuries, rosters, form and future point deductions are not modeled. Seeded draws make comparisons reproducible.

Top-seven odds sum ranks 1–7 across 20,000 simulations. The model retains direct-game tiebreak logic; future wins use synthetic 75–74 scores, so exact tiebreak margins are approximate. Unresolved ties split probability across the tied positions. Win-target rows are conditional samples and require at least 100 observations. No win target is a clinch claim.

The cache includes a SHA-256 fingerprint of the data, the focus team, cutoff and model settings. A changed input invalidates it. The what-if API accepts only valid remaining-game outcomes and caps computation at 5,000 fixed-seed simulations. The old `/what-if/somb` bookmark redirects to `/what-if/vitre`.

Competition format: https://nm1.ffbb.com/playoffs/page/4-formule-du-championnat-de-france-nm1
