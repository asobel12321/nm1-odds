import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNextGame,
  NEXT_GAME_VERSION,
  NEXT_GAME_SIMULATIONS,
} from "../src/lib/nextGame";
import { simulateSeason } from "../src/lib/simulate";
import { loadData, loadOddsCache } from "../src/lib/data";
import type { DataFile, Game } from "../src/lib/types";

const params = {
  simulations: 160,
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
  played = false,
): Game {
  return {
    id,
    home,
    away,
    date,
    played,
    homeScore: played ? 75 : null,
    awayScore: played ? 74 : null,
  };
}
function complete(data: DataFile, id: string) {
  const game = data.games.find((g) => g.id === id)!;
  const box = loadData().boxScores![0];
  Object.assign(game, {
    played: true,
    homeScore: box.homeScore,
    awayScore: box.awayScore,
  });
  (data.boxScores ??= []).push({
    ...box,
    ...game,
    played: true,
    homeScore: box.homeScore,
    awayScore: box.awayScore,
  });
}
function synthetic(): DataFile {
  const data: DataFile = {
    season: "test",
    updated: "test",
    teams: Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      name: String(i),
      abbr: String(i),
      wins: 9 - i,
      losses: 11 + i,
    })),
    games: [
      fixture("later", "0", "6", "2026-11-24 20:00"),
      fixture("other", "0", "7", "2026-11-11 20:00"),
      fixture("next", "1", "6", "2026-11-13 20:30"),
      fixture("played", "6", "7", "2026-11-01 20:00"),
      fixture("c", "2", "5", "2026-11-13 20:00"),
      fixture("d", "3", "4", "2026-11-13 20:30"),
      fixture("f", "1", "5", "2026-11-24 20:00"),
      fixture("g", "2", "4", "2026-11-24 20:00"),
      fixture("h", "3", "7", "2026-11-24 20:30"),
    ],
  };
  complete(data, "played");
  return data;
}

test("next-game outlook selects the earliest unplayed focus fixture and advances after results", () => {
  const data = synthetic(),
    before = structuredClone(data);
  assert.equal(buildNextGame(data, "6", params)!.game.id, "next");
  assert.deepEqual(data, before);
  complete(data, "next");
  assert.equal(buildNextGame(data, "6", params)!.game.id, "later");
  data.games = data.games.filter((g) => g.home !== "6" && g.away !== "6");
  assert.equal(buildNextGame(data, "6", params), null);
});

test("win and loss qualification odds replay the full model for home and away fixtures", () => {
  for (const home of [true, false]) {
    const data = synthetic();
    const game = data.games.find((g) => g.id === "next")!;
    if (home) [game.home, game.away] = [game.away, game.home];
    const result = buildNextGame(data, "6", params)!;
    const win = home ? "home" : "away",
      loss = home ? "away" : "home";
    for (const [outcome, actual] of [
      [win, result.winOdds],
      [loss, result.lossOdds],
    ] as const) {
      const expected = simulateSeason(data, {
        ...params,
        forcedOutcomes: { [game.id]: outcome },
      }).playoffOdds["6"];
      assert.ok(Math.abs(actual - expected) < 1e-12);
    }
    assert.deepEqual(buildNextGame(data, "6", params), result);
  }
});

test("next-game outlook rejects hidden assumptions and invalid model inputs", () => {
  const data = synthetic();
  assert.throws(() => buildNextGame(data, "missing", params), /Unknown focus/);
  assert.throws(
    () => buildNextGame(data, "6", { ...params, simulations: NaN }),
    /Invalid simulation/,
  );
  assert.throws(
    () =>
      buildNextGame(data, "6", {
        ...params,
        forcedOutcomes: { other: "home" },
      }),
    /other forced/,
  );
});

test("cached next-game estimates retain the API's sample limit and replay both displayed results", () => {
  const data = loadData(),
    cache = loadOddsCache(data)!;
  assert.equal(cache.nextGameVersion, NEXT_GAME_VERSION);
  const result = cache.focusNextGame!;
  assert.equal(result.simulations, NEXT_GAME_SIMULATIONS);
  assert.ok(!result.game.played);
  assert.ok(
    result.game.home === cache.focusId || result.game.away === cache.focusId,
  );
  const win = result.game.home === cache.focusId ? "home" : "away";
  const loss = win === "home" ? "away" : "home";
  for (const [outcome, actual] of [
    [win, result.winOdds],
    [loss, result.lossOdds],
  ] as const) {
    const replay = simulateSeason(data, {
      ...cache,
      simulations: result.simulations,
      seed: result.seed,
      forcedOutcomes: { [result.game.id]: outcome },
    });
    assert.ok(Math.abs(replay.playoffOdds[cache.focusId] - actual) < 1e-12);
  }
});
