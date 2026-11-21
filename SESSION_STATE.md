# Session State

## Objective

Restore automatic NM1 score/model updates after the site stopped at its 17 November snapshot.

## Branch

codex/restore-ffbb-refresh in C:/Users/asobe/Projects/Worktrees/nm1-odds-efficiency. Canonical checkout: C:/Users/asobe/Projects/Active/nm1-odds.

## Current Status

On 21 November, identified refresh failures on 18–20 November: a venue reversal collapsed the Laval–Les Sables legs into one ID (155 fixtures), and the main FFBB page lost its standings table. Fixed both; a complete live refresh passed with 13 teams, 156 fixtures and 75 validated boxes. Vitré now 6–5 and top-seven 70.92%. Final build/deploy and GitHub workflow verification pending. Build flagged Next 16.4.2 advisory. Updated manifests/lockfile to 16.4.6; Windows package downloads reset twice, so the patched final build will be verified by GitHub/Vercel before merging.

## Files Changed

FFBB parser and efficiency refresh, snapshot cache version, current data/odds/team map, standings-source UI labels, 5 new source-regression cases, corrected synthetic round formatting, framework patch, README/methodology and task records.

## Accomplishments

- Identify fixtures by round and unordered team pair, preserving both legs through a venue reversal.
- Require all 156 fixtures, two fixtures per team pair and the known same-season 13-team roster.
- Try the dedicated standings page if the main page lacks standings. If both omit rows, reconstruct records and points from complete scores with an explicit results-derived flag.
- Preserve all completed-box validation and independent FFBB team-stat reconciliation before replacing data.
- Show calculated points position/source text when official standings are absent; preserve winning-percentage table order.
- Invalidate the hosted fallback cache for the repaired source parser.

## Things Tried

Regression tests reproduced both actual errors before the code change; they pass after the fix. The full real refresh then succeeded. The initial production build compiled but stopped on a newly reported Next.js security advisory affecting <=16.4.4; upgrading within the existing 16.4 release line.

## Things Learned

The two current Laval–Les Sables fixtures both list Les Sables at home. A home-away composite ID is not a unique match identity. The official team-stat page remains populated even though the standings pages are empty, allowing the full score/box snapshot to be reconciled independently.

## Known Issues

Until FFBB restores standings rows, records/positions are derived and labeled accordingly. This fallback refuses a known administrative points adjustment, a new season, missing fixtures, unknown teams or a statistical mismatch. Patched dependency build verification is pending in GitHub/Vercel because local Windows tarball downloads reset.

## Verification Run

- Reproducer before fix: expected 2 failures, identical to the production errors.
- Full live npm run refresh: PASS, 75 completed boxes and refreshed odds.
- npm test: PASS, 48 tests, including derived-standings validation failures and venue inversion.
- npm run typecheck and lint: PASS before framework patch.
- First build: compilation/typecheck passed, then security-advisory stop. Lockfile updated to 16.4.6; final patched build pending CI.
- git diff --check: PASS.

## Next Steps

Verify patched framework, final build and page/API; publish through PR, run the GitHub refresh workflow, confirm production dates/record/odds, sync Active and update this record.
