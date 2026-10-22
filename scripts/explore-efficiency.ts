import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  fitEfficiency,
  predictEfficiency,
  EFFICIENCY_CONFIG,
} from "../src/lib/efficiency";
import { simulateEfficiencySeason } from "../src/lib/efficiencySimulate";
import { fitStrengthRatings, winProb } from "../src/lib/model";
import { simulateSeason } from "../src/lib/simulate";
import type { BoxGame } from "../src/lib/ffbbBoxScore";
import type { DataFile } from "../src/lib/types";
const input = JSON.parse(
  fs.readFileSync("data/experimental/poule-b-boxscores.json", "utf8"),
) as { data: DataFile; boxes: BoxGame[]; audit: unknown };
const { data, boxes } = input,
  simulations = 50000,
  seed = 20261022;
assert.equal(
  boxes.length,
  data.games.filter((g) => g.played).length,
  "Incomplete efficiency coverage",
);
const fit = fitEfficiency(data, boxes),
  alternate = fitEfficiency(data, boxes, { ftCoefficient: 0.475 });
const baseMargin = fitStrengthRatings(data, 3);
const baseline = simulateSeason(
  data,
  {
    simulations,
    seed,
    homeAdv: 3,
    probabilityScale: 10,
    focusId: "269",
  },
  (g) => winProb(baseMargin[g.home], baseMargin[g.away], 10, 3),
);
const projection = simulateEfficiencySeason(data, fit, simulations, seed),
  sensitivity = simulateEfficiencySeason(data, alternate, simulations, seed);
const baseRatings = fitStrengthRatings(data, 3);
function predictPastOnly(games: BoxGame[]) {
  return [...new Set(games.map((g) => g.date.slice(0, 10)))]
    .sort()
    .flatMap((date) => {
      const earlier = games.filter((g) => g.date.slice(0, 10) < date),
        f = fitEfficiency(data, earlier),
        a = fitEfficiency(data, earlier, { ftCoefficient: 0.475 });
      const m = fitStrengthRatings({ ...data, games: earlier }, 3);
      assert.ok(earlier.every((g) => g.date.slice(0, 10) < date));
      return games
        .filter((g) => g.date.slice(0, 10) === date)
        .map((g) => ({
          id: g.id,
          date,
          y: Number(g.homeScore > g.awayScore),
          priorGames: earlier.length,
          current: winProb(m[g.home], m[g.away], 10, 3),
          efficiency: predictEfficiency(f, g.home, g.away).homeWinProbability,
          alternate: predictEfficiency(a, g.home, g.away).homeWinProbability,
        }));
    });
}
const walk = predictPastOnly(boxes);
const corrupted = boxes.map((g) =>
  g.date.slice(0, 10) >= "2026-10-01"
    ? {
        ...g,
        homeScore: g.awayScore,
        awayScore: g.homeScore,
        homeBox: { ...g.awayBox },
        awayBox: { ...g.homeBox },
      }
    : g,
);
assert.deepEqual(
  predictPastOnly(corrupted).filter((r) => r.date < "2026-10-01"),
  walk.filter((r) => r.date < "2026-10-01"),
);
const metrics = Object.fromEntries(
  (["current", "efficiency", "alternate"] as const).map((model) => [
    model,
    {
      games: walk.length,
      brier: walk.reduce((s, r) => s + (r[model] - r.y) ** 2, 0) / walk.length,
      logLoss:
        walk.reduce(
          (s, r) =>
            s - r.y * Math.log(r[model]) - (1 - r.y) * Math.log(1 - r[model]),
          0,
        ) / walk.length,
      accuracy:
        walk.filter((r) => Number(r[model] >= 0.5) === r.y).length /
        walk.length,
    },
  ]),
);
const standings = [...data.teams].sort(
  (a, b) =>
    b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses) ||
    (a.officialRank ?? 99) - (b.officialRank ?? 99),
);
const rows = standings.map((t) => ({
  ...t,
  ...fit.teams[t.id],
  marginRating: baseRatings[t.id],
  currentTop7: baseline.playoffOdds[t.id],
  draftTop7: projection.playoffOdds[t.id],
  alternateTop7: sensitivity.playoffOdds[t.id],
  expectedWins: projection.winHist[t.id].reduce((s, p, w) => s + p * w, 0),
}));
const remaining = data.games
  .filter((g) => !g.played)
  .map((g) => ({ ...g, ...predictEfficiency(fit, g.home, g.away) }));
const output = {
  experimental: true,
  generated: new Date().toISOString(),
  sourceUpdated: data.updated,
  season: data.season,
  group: data.group,
  config: EFFICIENCY_CONFIG,
  simulations,
  seed,
  averageEfficiency: fit.averageEfficiency,
  averagePace: fit.averagePace,
  coverage: {
    completed: boxes.length,
    expected: boxes.length,
    allTeams: data.teams.length,
  },
  ratings: rows,
  remaining,
  metrics,
  walkForward: walk,
  projection,
  sensitivity,
  baseline,
  audit: input.audit,
};
const dir = path.resolve("outputs/efficiency");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "comparison.json"),
  JSON.stringify(output, null, 2) + "\n",
);
const columns = [
  "name",
  "games",
  "adjustedOffense",
  "adjustedDefense",
  "net",
  "pace",
  "currentTop7",
  "draftTop7",
  "alternateTop7",
  "expectedWins",
] as const;
fs.writeFileSync(
  path.join(dir, "ratings.csv"),
  columns.join(",") +
    "\n" +
    rows.map((r) => columns.map((k) => r[k]).join(",")).join("\n") +
    "\n",
);
const pct = (n: number) => (100 * n).toFixed(1) + "%",
  f = (n: number) => n.toFixed(2),
  v = rows.find((t) => t.id === "269")!;
const report = `# Adjusted efficiency draft: NM1 ${data.season}, Group ${data.group}

Generated ${output.generated}; source snapshot ${data.updated}. **Experimental; production is unchanged.**

## First result

Vitré: adjusted offense **${f(v.adjustedOffense)}**, adjusted defense **${f(v.adjustedDefense)}**, adjusted net **${v.net >= 0 ? "+" : ""}${f(v.net)} points per 100 possessions**. Higher offense and lower defense are better; zero net is Group B average.

The draft gives Vitré a **${pct(v.draftTop7)}** top-seven probability, versus **${pct(v.currentTop7)}** with the current capped-margin model on identical inputs and seed. Using FT coefficient 0.475 instead of 0.44 gives **${pct(v.alternateTop7)}**. These are model comparisons, not validated improvements or live odds.

## All teams (existing standings order, not sorted by rating)

| Team | Games | AdjO | AdjD | AdjNet | Pace /40 | Current top7 | Draft top7 | Expected wins |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.map((r) => `| ${r.name} | ${r.games} | ${f(r.adjustedOffense)} | ${f(r.adjustedDefense)} | ${r.net >= 0 ? "+" : ""}${f(r.net)} | ${f(r.pace)} | ${pct(r.currentTop7)} | ${pct(r.draftTop7)} | ${f(r.expectedWins)} |`).join("\n")}

Adjusted values are fitted from capped training differentials and shrunk toward the group average. Raw efficiencies in comparison.json use actual points and equal weighting by game. Pace is an opponent-adjusted estimate for a game against an average-tempo team. Average fitted efficiency: ${f(fit.averageEfficiency)}; average pace: ${f(fit.averagePace)} possessions per 40 minutes.

## Data audit

All **${boxes.length} completed games**, involving all **${data.teams.length} teams**, validated: team IDs, made-shot reconstruction, final scores, period totals, rebounds and full 40-minute/overtime duration. Per-game totals reconcile to the FFBB team-stat page's games played and rounded averages for points, 2PA, 3PA, FTA, offensive rebounds and turnovers. Source URLs, fetch times and SHA-256 hashes are saved with the experimental input. The importer preserves the prior snapshot on validation failure and caches HTTP responses locally. This checks internal consistency, not independently certified statistical accuracy.

## Model

1. Estimated possessions for each side = FGA − ORB + TO + 0.44 × FTA. Use the mean of the two sides for the game; 0.475 is retained as a sensitivity check, not assumed to be calibrated for NM1.
2. Offense/defense use points per 100 actual game possessions. Pace is normalized to 40 minutes for overtime. Each game has equal weight.
3. Before fitting, clip the score differential to ±20 game points, preserving the mean of the two scores. Subtract 1.5 points from the home side and add 1.5 to the away side to remove the common +3-point home margin. Raw reported efficiencies remain uncapped.
4. Fit baseline + team offense effect + opposing defense effect by ridge least squares, penalty4 for each effect; higher defense effect means more points allowed. Fit baseline pace + both teams' pace effects, penalty4.
5. AdjO = baseline + offensive effect. AdjD = baseline + defensive effect. AdjNet = AdjO − AdjD. Groups are not compared with each other.
6. Predict each offense against the opposing defense, multiply efficiency difference by projected game possessions/100, then add +3 home points once. Home win probability = sigmoid(predicted margin/10). No historical roster strengths enter the fit.
7. Run ${simulations.toLocaleString("en-US")} fixed-seed season simulations with existing ranking/tiebreak rules. Ratings stay fixed during each simulated season; future tiebreak scores retain the existing synthetic75–74 approximation. Unresolved ties split rank probability.

## Initial current-season walk-forward check

All games on a date are forecast using only earlier dates. Reversing every outcome from October 1 onward leaves all earlier predictions unchanged.

| Model | Games | Brier (lower better) | Log loss (lower better) | Winner accuracy |
|---|---:|---:|---:|---:|
${Object.entries(metrics)
  .map(
    ([name, m]) =>
      `| ${name} | ${m.games} | ${m.brier.toFixed(4)} | ${m.logLoss.toFixed(4)} | ${pct(m.accuracy)} |`,
  )
  .join("\n")}

Only 39 games, and these are exploratory candidate comparisons rather than a final holdout. Shrinkage, FT coefficient and logistic scale remain provisional. Equal teams with no observations receive 57.4% home probability; 100 efficiency/75 pace baselines at zero observations are explicit cold-start conveniences and do not transfer prior rosters. Injury, lineup and future-strength uncertainty are not modeled. Monte Carlo standard error is at most 0.22 percentage points at 50,000 simulations, but model uncertainty is much larger.

## Run and inspect

- npm run efficiency:import — cache and validate current FFBB box scores; existing raw HTTP cache is reused. Pass -- --refresh to fetch a fresh source snapshot.
- npm run efficiency:explore — regenerate this comparison, ratings.csv and comparison.json.
- Input: data/experimental/poule-b-boxscores.json.
- Outputs: outputs/efficiency/ (ignored by Git); source and regression fixtures are tracked.
- Source: [FFBB team stats](https://nm1.ffbb.com/saison-reguliere/leaders/equipes).
- Principles: [Ken Pomeroy's efficiency glossary](https://kenpom.com/blog/ratings-glossary/) and [additive methodology](https://kenpom.com/blog/ratings-methodology-update/). This transparent draft is not an exact copy of KenPom's proprietary system.

Next validation: import historical game-level box scores, then compare this fixed candidate with the existing model across independent group-seasons. No live model switch is justified by these early data alone.
`;
fs.writeFileSync(path.join(dir, "REPORT.md"), report);
console.log(
  JSON.stringify(
    {
      vitre: v,
      metrics,
      averageEfficiency: fit.averageEfficiency,
      averagePace: fit.averagePace,
      report: path.join(dir, "REPORT.md"),
    },
    null,
    2,
  ),
);
