import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBestCase,
  nextScenarioRound,
  BEST_CASE_VERSION,
} from "../src/lib/bestCase";
import { simulateSeason, simulateQualificationOdds } from "../src/lib/simulate";
import { loadData, loadOddsCache } from "../src/lib/data";
import type { DataFile, Game, ForcedOutcomes } from "../src/lib/types";
const params = {
  simulations: 120,
  seed: 42,
  homeAdv: 3,
  probabilityScale: 10,
  focusId: "6",
};
function fixture(
  id: string,
  home: string,
  away: string,
  date: string,
  round?: number,
): Game {
  return {
    id,
    home,
    away,
    date,
    round,
    played: false,
    homeScore: null,
    awayScore: null,
  };
}
function synthetic(): DataFile {
  const teams = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    name: String(i),
    abbr: String(i),
    wins: 9 - i,
    losses: 11 + i,
  }));
  return {
    season: "test",
    updated: "test",
    teams,
    games: [
      fixture("a", "0", "7", "2026-10-23 20:00", 8),
      fixture("b", "1", "6", "2026-10-24 20:00", 8),
      fixture("c", "2", "5", "2026-10-23 20:30", 8),
      fixture("d", "3", "4", "2026-10-24 20:30", 8),
      fixture("e", "0", "6", "2026-10-30 20:00", 9),
      fixture("f", "1", "5", "2026-10-30 20:00", 9),
      fixture("g", "2", "4", "2026-10-30 20:30", 9),
      fixture("h", "3", "7", "2026-10-30 20:30", 9),
    ],
  };
}
test("upcoming official round includes split dates and excludes later rounds", () => {
  const data = synthetic(),
    round = nextScenarioRound(data)!;
  assert.equal(round.roundNumber, 8);
  assert.equal(round.games.length, 4);
  assert.equal(round.roundDate.slice(0, 10), "2026-10-23");
  assert.equal(round.roundEndDate.slice(0, 10), "2026-10-24");
  data.games[0].played = true;
  assert.equal(nextScenarioRound(data)!.games.length, 3);
  const bye = synthetic();
  bye.games = bye.games.filter((g) => g.home !== "6" && g.away !== "6");
  assert.equal(nextScenarioRound(bye)!.games.length, 3);
  assert.equal(nextScenarioRound({ ...data, games: [] }), null);
});
test("postponed early-round fixtures are selected by next date; legacy data falls back to a matchday", () => {
  const data = synthetic();
  data.games.push(fixture("postponed", "0", "1", "2026-10-27 20:00", 1));
  assert.equal(nextScenarioRound(data)!.roundNumber, 8);
  data.games = data.games.filter((g) => g.round !== 8);
  assert.equal(nextScenarioRound(data)!.roundNumber, 1);
  const legacy = synthetic();
  legacy.games = legacy.games.map((g) => ({ ...g, round: undefined }));
  assert.equal(nextScenarioRound(legacy)!.games.length, 2);
});
test("fast focus odds reproduce full simulation for wins, losses, ties and unequal schedules", () => {
  const data = synthetic();
  for (const forcedOutcomes of [
    {},
    { a: "home", b: "away", c: "home", d: "away" },
    { a: "away", b: "home", c: "away", d: "home" },
  ] as ForcedOutcomes[]) {
    const p = { ...params, forcedOutcomes };
    assert.ok(
      Math.abs(
        simulateQualificationOdds(data, "6", p) -
          simulateSeason(data, p).playoffOdds["6"],
      ) < 1e-12,
    );
  }
  data.games = data.games.filter((g) => g.id !== "e");
  assert.ok(
    Math.abs(
      simulateQualificationOdds(data, "6", params) -
        simulateSeason(data, params).playoffOdds["6"],
    ) < 1e-12,
  );
});
test("best case is the maximum of all masks and its full displayed scenario replays exactly", () => {
  const data = synthetic(),
    result = buildBestCase(data, "6", params)!;
  assert.equal(result.scenarios, 16);
  assert.equal(Object.keys(result.outcomes).length, 4);
  assert.equal(result.seed, params.seed);
  let maximum = 0;
  const games = nextScenarioRound(data)!.games;
  for (let mask = 0; mask < 16; mask++) {
    const outcomes: ForcedOutcomes = {};
    games.forEach((g, i) => {
      outcomes[g.id] = mask & (1 << i) ? "home" : "away";
    });
    maximum = Math.max(
      maximum,
      simulateSeason(data, { ...params, forcedOutcomes: outcomes }).playoffOdds[
        "6"
      ],
    );
  }
  assert.ok(Math.abs(result.odds - maximum) < 1e-12);
  assert.ok(
    Math.abs(
      result.odds -
        simulateSeason(data, { ...params, forcedOutcomes: result.outcomes })
          .playoffOdds["6"],
    ) < 1e-12,
  );
  assert.deepEqual(buildBestCase(data, "6", params), result);
  assert.equal(buildBestCase({ ...data, games: [] }, "6", params), null);
  assert.throws(
    () =>
      buildBestCase(data, "6", { ...params, forcedOutcomes: { e: "home" } }),
    /outside/,
  );
});
test("cached current-round scenario lists every game and reproduces its reported odds", () => {
  const data = loadData(),
    cache = loadOddsCache(data)!;
  assert.equal(cache.bestCaseVersion, BEST_CASE_VERSION);
  const result = cache.focusBestCase!;
  assert.equal(result.scenarios, 2 ** result.games.length);
  assert.equal(result.games.length, Object.keys(result.outcomes).length);
  assert.ok(
    result.games.every((g) => !g.played && g.round === result.roundNumber),
  );
  const replay = simulateSeason(data, {
    ...params,
    focusId: "269",
    simulations: result.simulations,
    seed: result.seed,
    forcedOutcomes: result.outcomes,
  });
  assert.ok(Math.abs(replay.playoffOdds["269"] - result.odds) < 1e-12);
});
