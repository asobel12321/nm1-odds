# Adjusted net efficiency methodology

The production forecast uses this season's Group B games only. It is inspired by possession-based opponent-adjusted ratings such as KenPom, and is a transparent local implementation rather than a reproduction of KenPom's proprietary model.

## Possessions, efficiency and pace

For each team in each game:

`estimated possessions = 2PA + 3PA - offensive rebounds + turnovers + 0.44 * FTA`

Average the two teams' estimates and use that common denominator for both offenses. Raw ORTG is points scored per100 possessions; raw DRTG is points allowed per100 possessions. Displayed raw efficiencies, when used in analysis, are averaged equally by game. Pace is possessions per40 minutes; overtime uses actual game possessions for scoring efficiency and normalizes duration only for pace.

The free-throw coefficient0.44 is an approximation. The initial draft also tested0.475 and obtained nearly identical qualification probabilities; neither coefficient is claimed to be measured for NM1.

## Rating fit

Limit each score differential to ±20 game points while keeping the sum of the two scores unchanged. Remove the common +3-point home margin by subtracting1.5 points from the home fitting score and adding1.5 to the away fitting score. Convert those neutralized scores to points per100 possessions.

Fit an additive model to both sides of every game:

`neutralized scoring efficiency = group baseline + team offense effect + opponent defense effect`

Minimize squared residuals plus `4 * sum(offenseEffect^2 + defenseEffect^2)`. Higher defensive effect means more points conceded. Each game has equal weight. AdjORTG = baseline + offense effect; AdjDRTG = baseline + defense effect. **Power rating = AdjORTG - AdjDRTG**, in points per100 possessions relative to Group B average. Higher is better.

Fit game pace as `group baseline pace + home tempo effect + away tempo effect`, with ridge penalty4 on tempo effects. A team's displayed adjusted pace against an average-tempo opponent is baseline + twice its tempo effect; a matchup uses the mean of the two displayed team paces.

No previous-season team ratings carry over. Early estimates shrink toward the current group average. Groups without inter-group games cannot have their relative strength offset identified; these ratings compare Group B teams with Group B only.

## Game and season forecasts

`expected home margin = (home AdjNet - away AdjNet) * projected possessions / 100 + 3`

`home win probability = 1 / (1 + exp(-expected home margin / 10))`

Venue is removed during fitting and added once when forecasting. The margin is back in game points before applying the probability scale. Equal-rated teams give the home side57.4%.

The homepage and schedule probabilities, conditional win-target table and what-if API use this same fitted model. Season forecasts run20,000 fixed-seed simulations; the what-if API uses5,000 when outcomes are forced. Ratings and pace stay fixed within a simulated season. Season ranks use FFBB classification points and the score-based tiebreaks described below. Top-seven probabilities sum places1–7. A final win count is not a clinch guarantee.

Standings remain ordered by winning percentage, with equal percentages ordered by FFBB position. Power rating does not change their order.

## Data, refresh and failure handling

The production data file contains a single complete score-and-box-score snapshot, with source URLs, retrieval timestamps and SHA-256 provenance. Every completed fixture must have exactly one matching box score. IDs, points from made shots, period totals, team minutes, rebounds and possession plausibility are validated; group totals reconcile to the FFBB team-stat page's rounded averages.

Hosted refreshes check approximately hourly on traffic, reusing matching completed-game boxes and fetching new or changed results. If team averages reveal a stat correction without a score change, all boxes are re-fetched and reconciled. A failed validation retains the complete saved Git snapshot and its original timestamp. The daily GitHub refresh fetches all completed boxes and updates the source snapshot and odds atomically; it does not commit a mixed partial model. Source-check times do not imply a newer result.

The odds cache is keyed by the full score-and-stat snapshot, model version, cap, offense/defense and pace shrinkage, FT coefficient, rating units, home advantage, probability scale, focus team, seed and qualification cutoff.

## Validation and limits

The initial39-game current-season chronological comparison was essentially even with the previous capped-margin model (Brier0.24254 versus0.24289). This is a small exploratory comparison. Independent historical efficiency validation is pending; ridge4, home advantage3 and logistic scale10 remain provisional. The previous season's group-wide home-court analysis supported retaining3points, but does not validate the efficiency model's full probability calibration.

Injuries, future lineup changes, future strength uncertainty and administrative points deductions are not forecast. These are model estimates, not official FFBB probabilities.

Sources: [FFBB team statistics](https://nm1.ffbb.com/saison-reguliere/leaders/equipes), [Ken Pomeroy's glossary](https://kenpom.com/blog/ratings-glossary/), [published additive methodology](https://kenpom.com/blog/ratings-methodology-update/).

## Homepage 90% target

The headline target selects the fewest remaining wins whose exact final-record qualification estimate is at least90%, using only rows with at least100 simulated samples. It displays the actual probability as well. This is conditional on the simulated mix of results at that record, not a guarantee for every possible set of wins. It updates from the existing win table without changing the model.

## Best upcoming round

FFBB round numbers group fixtures even when they span different dates; old snapshots without round numbers fall back to the next calendar matchday. Completed fixtures are excluded. The search enumerates every remaining home/away outcome combination (up to seven games), using5,000 simulations each with a shared fixed seed. A focus-team calculation skips tiebreak work only when a team's entire classification-points tie group lies on one side of the cutoff; boundary ties use the same production resolver. Tests replay the selected scenario in the full simulator.
Every forced result is displayed and retained. The estimate is conditional on that full set of outcomes, not its occurrence probability or a mathematical clinch. Ratings stay fixed; subsequent real scores can change ratings. Search sampling can affect very close choices. Scenario results are cached with the validated data and regenerated by live and daily refreshes.

## Next-game win and loss outlook

The homepage shows Vitré’s top-seven qualification odds conditional on winning or losing its earliest unplayed fixture, ordered by fixture date (including postponed games and byes). Each scenario forces only that result; every other remaining game follows the unchanged efficiency model, home advantage and tiebreak rules. Both use 5,000 simulations and the same fixed seed/random draws, matching the what-if API. These are qualification probabilities, not next-game win probabilities. The estimates are cached with the validated snapshot and regenerated by hosted and daily refreshes; they disappear when Vitré has no fixtures left. The best-round estimate sits alongside them, with its full required results collapsed by default.

## Official NM1 tiebreaks

The [2026/27 NM1 rules](https://api.ffbb.app/assets/98830834-2257-4aa4-adef-01d602c49ac6) send the first seven teams in each phase-one group to Group A. For ordinary game results the [FFBB general rules, Articles 16–17](https://api.ffbb.app/assets/4bbee286-1104-41bd-ba6f-0f9db0c46815#page=20) award two classification points for a win and one for a loss. We start with the official points already earned and add those values for future games. On the balanced schedule with no penalties, final classification points and wins sort teams identically. The live standings display still uses winning percentage and FFBB position for ties.

When classification points are tied, form a mini-table using only games between those teams. Compare head-to-head classification points, then combined head-to-head scoring margin, then head-to-head points scored. The two scoring criteria require equal numbers of head-to-head games. If the tie remains, use the whole group’s point differential and then points scored. When a criterion splits teams, restart the process for each still-tied subset. Exact ties share the affected ranks uniformly to represent the official draw of lots. For example, a 12-point win and a 5-point loss gives a team a +7 head-to-head margin if the two teams split the series.

Completed games use their recorded scores without a margin cap. For each future game, the existing win draw also supplies a margin from a logistic distribution centered on the matchup's projected margin, using the existing scale of 10. The projected score total comes from adjusted offense, defense and pace. Split it around the sampled margin, round to integer scores, and preserve the winning side. In a winner-only what-if, sample from the part of the margin distribution consistent with the picked winner. The same draw is consumed per fixture, so the game win probabilities, ratings, and baseline sampled win totals are unchanged. The ±20-point cap still applies only to fitting team ratings. Individual administrative rulings, including forfeits and their special match points, are outside the projected sporting results.
