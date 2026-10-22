import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseBoxScore,
  type BoxGame,
  type TeamBox,
} from "../src/lib/ffbbBoxScore";
import {
  fitEfficiency,
  predictEfficiency,
  possessionData,
} from "../src/lib/efficiency";
import { simulateEfficiencySeason } from "../src/lib/efficiencySimulate";

const gold = fs.readFileSync(
  "tests/fixtures/efficiency-vitre-tarbes.html",
  "utf8",
);
const fixture = {
  id: "269-2937",
  date: "2026-09-25 20:30",
  home: "269",
  away: "2937",
  played: true,
  homeScore: 69,
  awayScore: 66,
};
const parsed = () =>
  parseBoxScore(
    gold,
    fixture,
    "https://nm1.ffbb.com/saison-reguliere/match/876800-vitre-tarbes-lourdes",
  );
const teams = ["a", "b", "c"].map((id) => ({
  id,
  name: id,
  abbr: id,
  wins: 0,
  losses: 0,
}));
function box(points: number): TeamBox {
  return {
    points,
    minutes: 40,
    twoMade: points / 2,
    twoAttempted: 90,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
    offensiveRebounds: 10,
    defensiveRebounds: 20,
    turnovers: 20,
  };
}
function game(
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  id = home + "-" + away,
): BoxGame {
  return {
    id,
    date: "2026-09-18",
    home,
    away,
    played: true,
    homeScore,
    awayScore,
    minutes: 40,
    homeBox: box(homeScore),
    awayBox: box(awayScore),
    source: "synthetic",
  };
}
test("golden FFBB totals parse, reconstruct points and validate periods", () => {
  const g = parsed();
  assert.equal(g.homeBox.twoAttempted + g.homeBox.threeAttempted, 61);
  assert.equal(g.awayBox.turnovers, 16);
  assert.equal(g.minutes, 40);
  assert.ok(Math.abs(possessionData(g).possessions - 74.96) < 1e-9);
});
test("reject partial feed, wrong teams, missing columns and invalid totals", () => {
  assert.throws(
    () => parseBoxScore(gold, { ...fixture, homeScore: 70 }, "test"),
    /final score/,
  );
  assert.throws(
    () => parseBoxScore(gold, { ...fixture, home: "other" }, "test"),
    /IDs/,
  );
  assert.throws(
    () => parseBoxScore(gold.replaceAll("2R-2T", "2R"), fixture, "test"),
    /two team/,
  );
  assert.throws(
    () => parseBoxScore(gold.replace(">200<", ">175<"), fixture, "test"),
    /duration/,
  );
});
test("overtime retains total possessions but pace is per 40 minutes", () => {
  const html = fs.readFileSync(
    "tests/fixtures/efficiency-vitre-fougeres.html",
    "utf8",
  );
  const g = parseBoxScore(
    html,
    { ...fixture, id: "269-345", homeScore: 87, awayScore: 92, away: "345" },
    "test",
  );
  assert.equal(g.minutes, 45);
  const p = possessionData(g);
  assert.ok(Math.abs(p.pace - (p.possessions * 40) / 45) < 1e-12);
});
test("fresh rosters have zero net and exactly one three-point home edge", () => {
  const fit = fitEfficiency({ teams }, []),
    p = predictEfficiency(fit, "a", "b");
  assert.equal(fit.teams.a.net, 0);
  assert.equal(p.margin, 3);
  assert.ok(Math.abs(p.homeWinProbability - 0.574442516811659) < 1e-12);
  assert.equal(fit.teams.a.rawOffense, null);
});
test("symmetric round robin recovers strength ordering and centered effects", () => {
  const games = [
    game("a", "b", 110, 100),
    game("b", "a", 100, 110),
    game("a", "c", 110, 90),
    game("c", "a", 90, 110),
    game("b", "c", 100, 90),
    game("c", "b", 90, 100),
  ];
  const fit = fitEfficiency({ teams }, games, { homeAdv: 0 });
  assert.ok(
    fit.teams.a.net > fit.teams.b.net && fit.teams.b.net > fit.teams.c.net,
  );
  assert.ok(
    Math.abs(Object.values(fit.teams).reduce((s, t) => s + t.net, 0)) < 1e-9,
  );
  assert.ok(
    Math.abs(
      predictEfficiency(fit, "a", "b").margin +
        predictEfficiency(fit, "b", "a").margin,
    ) < 1e-9,
  );
});
test("20-point cap preserves total efficiency while bounding the fitted differential", () => {
  const first = game("a", "b", 120, 80),
    second = game("a", "b", 130, 70);
  const x = fitEfficiency({ teams }, [first], { homeAdv: 0 }),
    y = fitEfficiency({ teams }, [second], { homeAdv: 0 });
  for (const id of ["a", "b", "c"]) {
    assert.equal(x.teams[id].net, y.teams[id].net);
    assert.equal(x.teams[id].adjustedOffense, y.teams[id].adjustedOffense);
    assert.equal(x.teams[id].adjustedDefense, y.teams[id].adjustedDefense);
  }
  assert.ok(Math.abs(x.teams.a.net - 10 / 3) < 1e-9);
  assert.equal(x.teams.a.rawOffense, 120);
  assert.equal(y.teams.a.rawOffense, 130);
});
test("team records never enter rating fit; unplayed/duplicate/missing data are rejected", () => {
  const games = [game("a", "b", 110, 100)],
    a = fitEfficiency({ teams }, games);
  assert.deepEqual(
    a,
    fitEfficiency(
      { teams: teams.map((t) => ({ ...t, wins: 999, losses: 999 })) },
      games,
    ),
  );
  assert.throws(
    () => fitEfficiency({ teams }, [...games, ...games]),
    /Invalid efficiency game/,
  );
  assert.throws(
    () =>
      fitEfficiency({ teams }, [
        { ...games[0], played: false } as unknown as BoxGame,
      ]),
    /Invalid efficiency game/,
  );
  assert.throws(() => fitEfficiency({ teams }, games, { ridge: 0 }), /options/);
  assert.throws(() => predictEfficiency(a, "a", "a"), /matchup/);
});
test("venue correction neutralizes a balanced three-point home advantage", () => {
  const t = teams.slice(0, 2),
    games = [game("a", "b", 102, 99), game("b", "a", 102, 99)],
    fit = fitEfficiency({ teams: t }, games);
  assert.ok(Math.abs(fit.teams.a.net) < 1e-9);
  assert.ok(Math.abs(fit.teams.b.net) < 1e-9);
  assert.ok(Math.abs(predictEfficiency(fit, "a", "b").margin - 3) < 1e-9);
});
test("efficiency season projection is deterministic and conserves seven places", () => {
  const input = JSON.parse(
    fs.readFileSync("data/experimental/poule-b-boxscores.json", "utf8"),
  );
  const fit = fitEfficiency(input.data, input.boxes),
    result = simulateEfficiencySeason(input.data, fit, 100, 42);
  assert.deepEqual(result, simulateEfficiencySeason(input.data, fit, 100, 42));
  assert.ok(
    Math.abs(Object.values(result.playoffOdds).reduce((a, b) => a + b, 0) - 7) <
      1e-9,
  );
  assert.equal(
    input.boxes.length,
    input.data.games.filter((g: { played: boolean }) => g.played).length,
  );
  for (const t of input.data.teams) {
    assert.ok(
      Math.abs(
        result.rankHist[t.id].reduce((a: number, b: number) => a + b, 0) - 1,
      ) < 1e-9,
    );
    assert.ok(
      Math.abs(
        result.winHist[t.id].reduce((a: number, b: number) => a + b, 0) - 1,
      ) < 1e-9,
    );
  }
});
