# Session State

## Objective

Restore automatic NM1 score/model updates after the site stopped at its 17 November snapshot.

## Branch

codex/ffbb-refresh-release (release record after codex/restore-ffbb-refresh) in C:/Users/asobe/Projects/Worktrees/nm1-odds-efficiency. Canonical checkout: C:/Users/asobe/Projects/Active/nm1-odds.

## Current Status

On 21 November, identified refresh failures on 18–20 November: a venue reversal collapsed the Laval–Les Sables legs into one ID (155 fixtures), and the main FFBB page lost its standings table. Fixed both; a complete live refresh passed with 13 teams, 156 fixtures and 75 validated boxes. Vitré now 6–5 and top-seven 70.92%. Published through PR12, merged as aefb03124a109f694b2ba8d4210edfd1d8356663. Production homepage/API verified November 21 data, 6–5 record, 70.9% odds and an explicit derived-standings label. Build flagged Next 16.4.2 advisory. Updated manifests/lockfile to 16.4.6; patched builds and all 48 tests passed in GitHub and Vercel. Manual refresh workflow 44899504254 succeeded end to end and saved the validated current snapshot.

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

Until FFBB restores standings rows, records/positions are derived and labeled accordingly. This fallback refuses a known administrative points adjustment, a new season, missing fixtures, unknown teams or a statistical mismatch. The local Windows dependency installation needs npm ci when package downloads are available again; two tarball downloads reset. GitHub and Vercel successfully installed and verified the patched framework.

## Verification Run

- Reproducer before fix: expected 2 failures, identical to the production errors.
- Full live npm run refresh: PASS, 75 completed boxes and refreshed odds.
- npm test: PASS, 48 tests, including derived-standings validation failures and venue inversion.
- npm run typecheck and lint: PASS before framework patch.
- Final patched 16.4.6 builds: PASS in GitHub and Vercel; production lockfile audit: 0 vulnerabilities.
- git diff --check: PASS.
- GitHub workflow 44899504254: PASS, npm ci, full refresh, 48 tests and saved snapshot commit.
- Production homepage/API: PASS, checked 21 November, 6–5 record, 70.9% odds, 13 standings rows and no stale warning.

## Next Steps

Release complete. Live hourly and scheduled daily refreshes use the repaired importer. The successful manual workflow is https://github.com/asobel12321/nm1-odds/actions/runs/44899504254. Canonical Active checkout synced.
