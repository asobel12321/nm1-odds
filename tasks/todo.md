# Adjusted efficiency draft

- [x] Import and validate current Group B game box scores; audit coverage.
- [x] Fit separate opponent-adjusted offense, defense and pace from this season only.
- [x] Preserve the ±20 margin cap and +3-point home advantage; compare FT coefficients.
- [x] Run a draft season projection with existing qualification/tiebreak rules.
- [x] Add meaningful tests and run test/typecheck/lint/build checks.
- [x] Save a reviewable report, source data provenance and session handoff.

## Review/results

39 completed games and13 teams validated and reconciled. Vitré adjusted net+1.55 per100; draft top7 73.6% versus current73.5% on identical inputs. Both FT coefficient variants give effectively the same qualification result.

21 tests, typecheck, focused lint, production build and whitespace check pass. Full lint is blocked by a pre-existing render-purity issue at src/app/page.tsx:51, reproduced on main.

Production model/UI/data unchanged. Draft model remains unvalidated beyond39 early-season games. Historical efficiency backtesting is the next validation step; no live switch has been made.
