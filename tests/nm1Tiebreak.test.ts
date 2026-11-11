import test from "node:test";
import assert from "node:assert/strict";
import { resolveStandingsByTiebreaks } from "../src/lib/tiebreak";
import { sampleGameScore } from "../src/lib/seasonSampler";
import { simulateSeason, simulateQualificationOdds } from "../src/lib/simulate";
import type { DataFile, Game, TeamRecord } from "../src/lib/types";

const team = (id: string): TeamRecord => ({
  id,
  name: id,
  abbr: id,
  wins: 1,
  losses: 1,
});
const finished = (
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
): Game => ({
  id: home + "-" + away,
  date: "2026-11-11 20:00",
  home,
  away,
  played: true,
  homeScore,
  awayScore,
});
const tied = (ids: string[], games: Game[]) =>
  resolveStandingsByTiebreaks(
    ids.map(team),
    Object.fromEntries(ids.map((id) => [id, 1])),
    { games },
  );

test("a split uses the combined unbounded official score; a sweep uses mini-table points first", () => {
  assert.deepEqual(
    tied(["a", "b"], [finished("b", "a", 99, 87), finished("a", "b", 80, 75)])
      .rankedIds,
    ["b", "a"],
  );
  assert.deepEqual(
    tied(["a", "b"], [finished("a", "b", 115, 55), finished("b", "a", 80, 78)])
      .rankedIds,
    ["a", "b"],
  );
  assert.deepEqual(
    tied(["a", "b"], [finished("b", "a", 80, 79), finished("a", "b", 75, 76)])
      .rankedIds,
    ["b", "a"],
  );
});

test("after a three-team split, restart the mini-table among the teams still tied", () => {
  // A and B are both +10 in the mini-table; A scores more overall there,
  // but B swept A and wins the restarted two-team tiebreak.
  const games = [
    finished("b", "a", 90, 80),
    finished("a", "b", 80, 90),
    finished("a", "c", 90, 75),
    finished("c", "a", 75, 90),
    finished("c", "b", 80, 75),
    finished("b", "c", 75, 80),
  ];
  assert.deepEqual(tied(["a", "b", "c"], games).rankedIds, ["b", "a", "c"]);
});

test("overall point differential and points scored follow a level head-to-head", () => {
  const series = [finished("a", "b", 90, 80), finished("b", "a", 90, 80)];
  assert.deepEqual(
    tied(
      ["a", "b"],
      [...series, finished("a", "c", 90, 70), finished("b", "c", 85, 75)],
    ).rankedIds,
    ["a", "b"],
  );
  assert.deepEqual(
    tied(
      ["a", "b"],
      [...series, finished("a", "c", 90, 80), finished("b", "c", 100, 90)],
    ).rankedIds,
    ["b", "a"],
  );
  assert.deepEqual(tied(["a", "b"], series).unresolvedGroups, [["a", "b"]]);
});

test("mini-table classification points precede score metrics with uneven direct schedules", () => {
  const games = [
    finished("a", "b", 101, 70),
    finished("c", "b", 80, 77),
    finished("b", "c", 80, 75),
  ];
  // One win each, but B has 4 match points, C has 3, A has 2.
  assert.deepEqual(tied(["a", "b", "c"], games).rankedIds, ["b", "c", "a"]);
});

test("official classification points outrank raw wins when the recorded totals differ", () => {
  const resolution = resolveStandingsByTiebreaks(
    [team("a"), team("b")],
    { a: 2, b: 1 },
    { classificationPoints: { a: 2, b: 3 } },
  );
  assert.deepEqual(resolution.rankedIds, ["b", "a"]);
});

test("future scores preserve the existing winner draw and vary forced win margins", () => {
  const p = 1 / (1 + Math.exp(-0.5));
  const forecast = {
    homeScore: 80,
    awayScore: 75,
    margin: 5,
    homeWinProbability: p,
  };
  assert.deepEqual(sampleGameScore(forecast, 0.5, 10), {
    homeScore: 80,
    awayScore: 75,
  });
  for (const draw of [0, 0.05, 0.5, p, 0.99999]) {
    const normal = sampleGameScore(forecast, draw, 10);
    assert.equal(normal.homeScore > normal.awayScore, draw < p);
    assert.ok(
      normal.homeScore !== normal.awayScore &&
        Number.isInteger(normal.homeScore) &&
        Number.isInteger(normal.awayScore),
    );
    const home = sampleGameScore(forecast, draw, 10, "home"),
      away = sampleGameScore(forecast, draw, 10, "away");
    assert.ok(home.homeScore > home.awayScore);
    assert.ok(away.awayScore > away.homeScore);
  }
  assert.ok(sampleGameScore(forecast, 0.5, 10, "home").homeScore > 81);
});

test("a simulated return-leg margin changes seventh place without changing either win total", () => {
  const teams = [
    ...Array.from({ length: 6 }, (_, i) => ({
      ...team(String(i)),
      wins: 2,
      losses: 0,
    })),
    { ...team("a"), losses: 0 },
    { ...team("b"), wins: 0 },
  ];
  const future = {
    ...finished("b", "a", 0, 0),
    played: false,
    homeScore: null,
    awayScore: null,
  };
  const params = {
    simulations: 1,
    seed: 42,
    homeAdv: 3,
    probabilityScale: 10,
    forcedOutcomes: { [future.id]: "home" as const },
  };
  const forecast = () => ({
    homeScore: 100,
    awayScore: 75,
    margin: 25,
    homeWinProbability: 1 / (1 + Math.exp(-2.5)),
  });
  const season = (margin: number): DataFile => ({
    season: "test",
    updated: "test",
    teams,
    games: [finished("a", "b", 75 + margin, 75), future],
  });
  const small = simulateSeason(season(7), params, forecast);
  const large = simulateSeason(season(45), params, forecast);
  assert.deepEqual(small.winHist, large.winHist);
  assert.equal(small.playoffOdds.a, 0);
  assert.equal(large.playoffOdds.a, 1);
  assert.equal(
    simulateQualificationOdds(season(7), "a", params, forecast),
    small.playoffOdds.a,
  );
});
