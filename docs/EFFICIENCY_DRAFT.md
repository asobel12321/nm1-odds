# Adjusted efficiency draft: NM1 2026-2027, Group B

Generated 2026-10-22T14:58:19.366Z; source snapshot 2026-10-22T14:53:53.460Z. **Experimental; production is unchanged.**

## First result

Vitré: adjusted offense **99.18**, adjusted defense **97.62**, adjusted net **+1.55 points per 100 possessions**. Higher offense and lower defense are better; zero net is Group B average.

The draft gives Vitré a **73.6%** top-seven probability, versus **73.5%** with the current capped-margin model on identical inputs and seed. Using FT coefficient 0.475 instead of 0.44 gives **73.6%**. These are model comparisons, not validated improvements or live odds.

## All teams (existing standings order, not sorted by rating)

| Team                | Games |   AdjO |   AdjD | AdjNet | Pace /40 | Current top7 | Draft top7 | Expected wins |
| ------------------- | ----: | -----: | -----: | -----: | -------: | -----------: | ---------: | ------------: |
| Tarbes Lourdes      |     6 | 106.36 | 101.34 |  +5.01 |    76.83 |        96.8% |      96.9% |         15.79 |
| Challans            |     6 | 104.39 |  99.53 |  +4.86 |    75.80 |        92.1% |      92.5% |         14.71 |
| Fougères            |     6 |  99.18 |  98.49 |  +0.69 |    73.32 |        81.6% |      82.0% |         13.55 |
| Toulouse            |     5 | 100.65 |  98.88 |  +1.77 |    80.10 |        73.4% |      74.3% |         13.04 |
| Vitré               |     5 |  99.18 |  97.62 |  +1.55 |    74.20 |        73.5% |      73.6% |         13.05 |
| Rennes              |     5 | 101.04 |  99.55 |  +1.49 |    84.68 |        73.7% |      74.3% |         13.12 |
| Lorient             |     7 |  98.77 |  98.64 |  +0.13 |    74.31 |        62.5% |      62.4% |         12.34 |
| Angers              |     6 |  94.61 |  96.29 |  -1.68 |    73.48 |        39.1% |      38.3% |         11.06 |
| Tours               |     7 | 100.12 | 101.51 |  -1.40 |    79.41 |        34.8% |      33.2% |         10.82 |
| Les Sables d'Olonne |     6 |  98.20 |  99.61 |  -1.41 |    76.39 |        30.6% |      30.7% |         10.67 |
| Chartres            |     6 | 100.71 | 103.64 |  -2.92 |    75.91 |        22.5% |      22.0% |         10.06 |
| Bordeaux            |     7 |  95.84 |  98.50 |  -2.66 |    77.41 |        13.9% |      13.7% |          9.47 |
| Laval               |     6 |  96.72 | 102.16 |  -5.43 |    74.59 |         5.5% |       5.9% |          8.33 |

Adjusted values are fitted from capped training differentials and shrunk toward the group average. Raw efficiencies in comparison.json use actual points and equal weighting by game. Pace is an opponent-adjusted estimate for a game against an average-tempo team. Average fitted efficiency: 99.67; average pace: 76.65 possessions per 40 minutes.

## Data audit

All **39 completed games**, involving all **13 teams**, validated: team IDs, made-shot reconstruction, final scores, period totals, rebounds and full 40-minute/overtime duration. Per-game totals reconcile to the FFBB team-stat page's games played and rounded averages for points, 2PA, 3PA, FTA, offensive rebounds and turnovers. Source URLs, fetch times and SHA-256 hashes are saved with the experimental input. The importer preserves the prior snapshot on validation failure and caches HTTP responses locally. This checks internal consistency, not independently certified statistical accuracy.

## Model

1. Estimated possessions for each side = FGA − ORB + TO + 0.44 × FTA. Use the mean of the two sides for the game; 0.475 is retained as a sensitivity check, not assumed to be calibrated for NM1.
2. Offense/defense use points per 100 actual game possessions. Pace is normalized to 40 minutes for overtime. Each game has equal weight.
3. Before fitting, clip the score differential to ±20 game points, preserving the mean of the two scores. Subtract 1.5 points from the home side and add 1.5 to the away side to remove the common +3-point home margin. Raw reported efficiencies remain uncapped.
4. Fit baseline + team offense effect + opposing defense effect by ridge least squares, penalty4 for each effect; higher defense effect means more points allowed. Fit baseline pace + both teams' pace effects, penalty4.
5. AdjO = baseline + offensive effect. AdjD = baseline + defensive effect. AdjNet = AdjO − AdjD. Groups are not compared with each other.
6. Predict each offense against the opposing defense, multiply efficiency difference by projected game possessions/100, then add +3 home points once. Home win probability = sigmoid(predicted margin/10). No historical roster strengths enter the fit.
7. Run 50,000 fixed-seed season simulations with existing ranking/tiebreak rules. Ratings stay fixed during each simulated season; future tiebreak scores retain the existing synthetic75–74 approximation. Unresolved ties split rank probability.

## Initial current-season walk-forward check

All games on a date are forecast using only earlier dates. Reversing every outcome from October 1 onward leaves all earlier predictions unchanged.

| Model      | Games | Brier (lower better) | Log loss (lower better) | Winner accuracy |
| ---------- | ----: | -------------------: | ----------------------: | --------------: |
| current    |    39 |               0.2429 |                  0.6798 |           64.1% |
| efficiency |    39 |               0.2425 |                  0.6792 |           64.1% |
| alternate  |    39 |               0.2425 |                  0.6791 |           64.1% |

Only 39 games, and these are exploratory candidate comparisons rather than a final holdout. Shrinkage, FT coefficient and logistic scale remain provisional. Equal teams with no observations receive 57.4% home probability; 100 efficiency/75 pace baselines at zero observations are explicit cold-start conveniences and do not transfer prior rosters. Injury, lineup and future-strength uncertainty are not modeled. Monte Carlo standard error is at most 0.22 percentage points at 50,000 simulations, but model uncertainty is much larger.

## Run and inspect

- npm run efficiency:import — cache and validate current FFBB box scores; existing raw HTTP cache is reused. Pass -- --refresh to fetch a fresh source snapshot.
- npm run efficiency:explore — regenerate this comparison, ratings.csv and comparison.json.
- Input: data/experimental/poule-b-boxscores.json.
- Outputs: outputs/efficiency/ (ignored by Git); source and regression fixtures are tracked.
- Source: [FFBB team stats](https://nm1.ffbb.com/saison-reguliere/leaders/equipes).
- Principles: [Ken Pomeroy's efficiency glossary](https://kenpom.com/blog/ratings-glossary/) and [additive methodology](https://kenpom.com/blog/ratings-methodology-update/). This transparent draft is not an exact copy of KenPom's proprietary system.

Next validation: import historical game-level box scores, then compare this fixed candidate with the existing model across independent group-seasons. No live model switch is justified by these early data alone.
