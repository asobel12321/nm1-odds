# Session State

## Objective

Remove the homepage Up next / Vitré schedule section and let the standings use its space.

## Branch

codex/remove-schedule-release (release records after codex/remove-home-schedule) in the nm1-odds-efficiency worktree. Canonical checkout: C:/Users/asobe/Projects/Active/nm1-odds.

## Current Status

Published through PR10 on 10 November 2026: https://github.com/asobel12321/nm1-odds/pull/10. Feature merged as 4d88eeca1d1563f4a231d18100097060aa71c28c. Production HTTP confirms the schedule sidebar is absent, with 13 standings rows and all three scenario cards retained. Standings use one full-width column. Active checkout synced.

## Files Changed

src/app/page.tsx, src/app/globals.css, tasks/todo.md, SESSION_STATE.md.

## Accomplishments

Removed the schedule sidebar and its accompanying context card. Existing odds, scenario cards, data and calculations are untouched.

## Things Tried

Used the existing homepage section and layout styles for a small removal.

## Things Learned

The desktop layout reserved a second column for the schedule; a single-column grid prevents an empty sidebar gap.

## Known Issues

No new model or data changes. No browser visual preview is claimed; production HTML was verified directly.

## Verification Run

- npm run lint: PASS.
- npm run build: PASS, including TypeScript checks.
- git diff --check: PASS.
- Reviewed diff: only schedule/sidebar markup and the standings grid changed.
- GitHub test/build checks and Vercel preview: PASS.
- Production HTTP: PASS, no schedule/fixture list, 13 standings rows and three scenario cards.

## Next Steps

Release complete. No model, data, cache or probability changes were required.
