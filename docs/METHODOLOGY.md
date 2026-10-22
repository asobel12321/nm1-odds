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

The homepage and schedule probabilities, conditional win-target table and what-if API use this same fitted model. Season forecasts run20,000 fixed-seed simulations; the what-if API uses5,000 when outcomes are forced. Ratings and pace stay fixed within a simulated season. Existing ranking and direct-game tiebreak rules are retained; future simulated scores use75–74, and unresolved ties share rank probabilities. Top-seven probabilities sum places1–7. A final win count is not a clinch guarantee.

Standings remain ordered by winning percentage, with equal percentages ordered by FFBB position. Power rating does not change their order.

## Data, refresh and failure handling

The production data file contains a single complete score-and-box-score snapshot, with source URLs, retrieval timestamps and SHA-256 provenance. Every completed fixture must have exactly one matching box score. IDs, points from made shots, period totals, team minutes, rebounds and possession plausibility are validated; group totals reconcile to the FFBB team-stat page's rounded averages.

Hosted refreshes check approximately hourly on traffic, reusing matching completed-game boxes and fetching new or changed results. If team averages reveal a stat correction without a score change, all boxes are re-fetched and reconciled. A failed validation retains the complete saved Git snapshot and its original timestamp. The daily GitHub refresh fetches all completed boxes and updates the source snapshot and odds atomically; it does not commit a mixed partial model. Source-check times do not imply a newer result.

The odds cache is keyed by the full score-and-stat snapshot, model version, cap, offense/defense and pace shrinkage, FT coefficient, rating units, home advantage, probability scale, focus team, seed and qualification cutoff.

## Validation and limits

The initial39-game current-season chronological comparison was essentially even with the previous capped-margin model (Brier0.24254 versus0.24289). This is a small exploratory comparison. Independent historical efficiency validation is pending; ridge4, home advantage3 and logistic scale10 remain provisional. The previous season's group-wide home-court analysis supported retaining3points, but does not validate the efficiency model's full probability calibration.

Injuries, future lineup changes, future strength uncertainty and administrative points deductions are not forecast. These are model estimates, not official FFBB probabilities.

Sources: [FFBB team statistics](https://nm1.ffbb.com/saison-reguliere/leaders/equipes), [Ken Pomeroy's glossary](https://kenpom.com/blog/ratings-glossary/), [published additive methodology](https://kenpom.com/blog/ratings-methodology-update/).
