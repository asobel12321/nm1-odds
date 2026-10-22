import {
  MODEL_CONFIG,
  createProjectionModel,
} from "../src/lib/projectionModel";
import assert from "node:assert/strict";
import test from "node:test";
import {
  fitStrengthRatings,
  winProb,
  DEFAULT_PROBABILITY_SCALE,
  DEFAULT_HOME_ADV,
} from "../src/lib/model";
import { loadData, loadOddsCache } from "../src/lib/data";
import { simulateSeason } from "../src/lib/simulate";
import { buildWinTable } from "../src/lib/winTable";
import type { DataFile } from "../src/lib/types";

function pair(margin: number): DataFile {
  return {
    season: "test",
    updated: "test",
    teams: [
      { id: "A", name: "A", abbr: "A", wins: 1, losses: 0 },
      { id: "B", name: "B", abbr: "B", wins: 0, losses: 1 },
    ],
    games: [
      {
        id: "played",
        date: "2026-10-01",
        home: "A",
        away: "B",
        played: true,
        homeScore: 80 + margin,
        awayScore: 80,
      },
    ],
  };
}
test("strength fit matches an independently solvable ridge system and caps both signs at twenty", () => {
  assert.ok(Math.abs(fitStrengthRatings(pair(10)).A - 7 / 6) < 1e-10);
  assert.deepEqual(fitStrengthRatings(pair(40)), fitStrengthRatings(pair(20)));
  assert.deepEqual(
    fitStrengthRatings(pair(-40)),
    fitStrengthRatings(pair(-20)),
  );
  assert.ok(Math.abs(fitStrengthRatings(pair(20)).A - 17 / 6) < 1e-10);
  assert.ok(Math.abs(fitStrengthRatings(pair(-20)).A + 23 / 6) < 1e-10);
});
test("ratings use completed scores, not record totals or hypothetical future scores", () => {
  const data = pair(10),
    expected = fitStrengthRatings(data),
    changed = structuredClone(data);
  changed.teams[0].wins = 100;
  changed.teams[1].wins = 100;
  changed.games.push({
    id: "future",
    date: "2026-11-01",
    home: "B",
    away: "A",
    played: false,
    homeScore: 150,
    awayScore: 0,
  });
  assert.deepEqual(fitStrengthRatings(changed), expected);
  changed.games[0].homeScore = 95;
  assert.notDeepEqual(fitStrengthRatings(changed), expected);
  const empty = pair(0);
  empty.games = [];
  assert.deepEqual(fitStrengthRatings(empty), { A: 0, B: 0 });
});
test("point-scale win probabilities retain home court and have correct direction and symmetry", () => {
  assert.equal(winProb(0, 0, 10, 0), 0.5);
  assert.ok(Math.abs(winProb(0, 0, 10, 3) - 0.574442516811659) < 1e-12);
  assert.ok(winProb(3, 0, 10, 3) > winProb(0, 0, 10, 3));
  assert.ok(
    Math.abs(winProb(4, -2, 10, 0) + winProb(-2, 4, 10, 0) - 1) < 1e-12,
  );
  assert.throws(() => winProb(0, 0, 0, 3));
});
test("simulator and conditional win table share identical sampled seasons", () => {
  const data = loadData(),
    id = "269",
    params = {
      simulations: 200,
      seed: 42,
      probabilityScale: DEFAULT_PROBABILITY_SCALE,
      homeAdv: DEFAULT_HOME_ADV,
      forcedOutcomes: {},
    };
  const result = simulateSeason(data, params),
    table = buildWinTable(data, id, params),
    wins = data.teams.find((t) => t.id === id)!.wins;
  for (const row of table.rows)
    assert.ok(
      Math.abs(
        result.winHist[id][wins + row.remainingWins] -
          row.samples / params.simulations,
      ) < 1e-12,
    );
  const qualification = table.rows.reduce(
    (sum, row) =>
      sum + (row.samples / params.simulations) * (1 - row.noPlayoffs),
    0,
  );
  assert.ok(Math.abs(result.playoffOdds[id] - qualification) < 1e-10);
});
test("cached strength scores are centered and reproduce the current fitted model", () => {
  const data = loadData(),
    cache = loadOddsCache(data);
  assert.ok(cache);
  for (const [key, value] of Object.entries(MODEL_CONFIG))
    assert.equal(cache[key as keyof typeof cache], value);
  const ratings = createProjectionModel(data).strengthRatings;
  assert.deepEqual(cache.strengthRatings, ratings);
  assert.ok(Math.abs(Object.values(ratings).reduce((a, b) => a + b, 0)) < 1e-9);
});
