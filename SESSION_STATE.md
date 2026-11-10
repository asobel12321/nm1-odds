# Session State

## Objective

Remove the homepage Up next / Vitré schedule section and let the standings use its space.

## Branch

codex/remove-home-schedule in the nm1-odds-efficiency worktree. Canonical checkout: C:/Users/asobe/Projects/Active/nm1-odds.

## Current Status

Schedule sidebar removed; standings use one full-width column. Build and lint passed; ready for GitHub checks and production verification.

## Files Changed

src/app/page.tsx, src/app/globals.css, tasks/todo.md, SESSION_STATE.md.

## Accomplishments

Removed the schedule sidebar and its accompanying context card. Existing odds, scenario cards, data and calculations are untouched.

## Things Tried

Used the existing homepage section and layout styles for a small removal.

## Things Learned

The desktop layout reserved a second column for the schedule; a single-column grid prevents an empty sidebar gap.

## Known Issues

No new model or data changes. Visual browser preview was unavailable in the preceding task; use built-page checks for this removal.

## Verification Run

- npm run lint: PASS.
- npm run build: PASS, including TypeScript checks.
- git diff --check: PASS.
- Reviewed diff: only schedule/sidebar markup and the standings grid changed.

## Next Steps

Verify, commit/push, pass GitHub checks, merge and confirm the schedule is absent in production. Sync the canonical Active checkout.
