import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  loadData,
  findFocusTeamId,
  dataFingerprint,
  loadOddsCache,
} from "../src/lib/data";
import { simulateSeason } from "../src/lib/simulate";
import { parseRegularSeason } from "../src/lib/ffbb";
import { buildWinTable, selectWinTarget } from "../src/lib/winTable";
import { DEFAULT_PROBABILITY_SCALE, DEFAULT_HOME_ADV } from "../src/lib/model";
import type { DataFile } from "../src/lib/types";

test("snapshot is Group B with a full balanced schedule and matching results", () => {
  const data = loadData();
  assert.equal(data.group, "B");
  assert.equal(data.teams.length, 13);
  assert.equal(data.games.length, 156);
  assert.equal(findFocusTeamId(data), "269");
  for (const team of data.teams) {
    const games = data.games.filter(
      (g) => g.home === team.id || g.away === team.id,
    );
    assert.equal(games.length, 24);
    const played = games.filter((g) => g.played);
    const wins = played.filter((g) =>
      g.home === team.id
        ? g.homeScore! > g.awayScore!
        : g.awayScore! > g.homeScore!,
    ).length;
    assert.equal(wins, team.wins);
    assert.equal(played.length - wins, team.losses);
  }
});
test("seven qualification places, normalized probabilities and deterministic draws", () => {
  const data = loadData();
  const params = {
    simulations: 100,
    seed: 42,
    probabilityScale: DEFAULT_PROBABILITY_SCALE,
    homeAdv: DEFAULT_HOME_ADV,
  };
  const result = simulateSeason(data, params);
  assert.deepEqual(result, simulateSeason(data, params));
  assert.ok(
    Math.abs(Object.values(result.playoffOdds).reduce((a, b) => a + b, 0) - 7) <
      1e-8,
  );
  for (const t of data.teams) {
    assert.ok(
      Math.abs(result.rankHist[t.id].reduce((a, b) => a + b, 0) - 1) < 1e-8,
    );
    assert.ok(
      Math.abs(result.winHist[t.id].reduce((a, b) => a + b, 0) - 1) < 1e-8,
    );
  }
});
test("forced Vitré sweep and losses affect both simulator and win table", () => {
  const data = loadData(),
    id = findFocusTeamId(data),
    team = data.teams.find((t) => t.id === id)!;
  const remaining = data.games.filter(
    (g) => !g.played && (g.home === id || g.away === id),
  );
  for (const sweep of [true, false]) {
    const forcedOutcomes = Object.fromEntries(
      remaining.map((g) => [
        g.id,
        (g.home === id) === sweep ? ("home" as const) : ("away" as const),
      ]),
    );
    const params = {
      simulations: 20,
      seed: 42,
      probabilityScale: DEFAULT_PROBABILITY_SCALE,
      homeAdv: DEFAULT_HOME_ADV,
      forcedOutcomes,
    };
    const result = simulateSeason(data, params);
    assert.ok(
      result.winHist[id][team.wins + (sweep ? remaining.length : 0)] > 0.999,
    );
    const table = buildWinTable(data, id, params);
    assert.equal(table.rows[sweep ? remaining.length : 0].samples, 20);
  }
});
test("a finished eight-team competition qualifies seven, not eight", () => {
  const teams = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    name: String(i),
    abbr: String(i),
    wins: 8 - i,
    losses: i,
  }));
  const data: DataFile = { season: "test", updated: "test", teams, games: [] };
  const result = simulateSeason(data, {
    simulations: 10,
    seed: 42,
    probabilityScale: DEFAULT_PROBABILITY_SCALE,
    homeAdv: DEFAULT_HOME_ADV,
  });
  assert.equal(result.playoffOdds["6"], 1);
  assert.equal(result.playoffOdds["7"], 0);
});
test("cache invalidation includes scores, cutoff and model settings", () => {
  const data = loadData();
  const cache = loadOddsCache(data);
  assert.ok(cache);
  const changed = structuredClone(data);
  changed.games[0].homeScore = (changed.games[0].homeScore ?? 0) + 1;
  assert.notEqual(dataFingerprint(data), dataFingerprint(changed));
  assert.equal(loadOddsCache(changed), null);
  const raw = JSON.parse(fs.readFileSync("data/odds.json", "utf8"));
  assert.equal(raw.cutoff, 7);
  assert.equal(raw.focusId, "269");
});
test("importer rejects incomplete upstream HTML", () => {
  assert.throws(() =>
    parseRegularSeason("<html><body>No standings</body></html>"),
  );
});

test("importer parses official page structure and rejects partial or inconsistent data", () => {
  const data = loadData();
  const standings = data.teams
    .map(
      (t) =>
        `<tr><td>${t.officialRank}</td><td><a class="team" href="/saison-reguliere/equipe/${t.id}-team"><span>${t.name}</span></a></td><td>${t.points}</td><td>${t.wins + t.losses}</td><td>${t.wins}</td><td>${t.losses}</td></tr>`,
    )
    .join("");
  const fixtures = data.games.map(
    (g) =>
      `<li class="display-games__second-list__entry"><time datetime="${g.date.slice(0, 10)}"></time><ul><li class="display-games__third-list__entry"><span class="game__day">Journée 1, Group B</span><span class="game__date"><span class="date">${g.date.slice(11)}</span></span>${[g.home, g.away].map((id, i) => `<div class="display-games__third-list__entry__team"><img src="https://www.proballers.com/media/team/${id}.svg"><span class="team__title">${data.teams.find((t) => t.id === id)!.abbr}</span>${g.played ? `<span class="team__score">${i === 0 ? g.homeScore : g.awayScore}</span>` : ""}</div>`).join("")}</li></ul></li>`,
  );
  const html = (games: string[]) =>
    `<h2 class="generic__title">Classement de la NM1 poule B</h2><div><table><tbody>${standings}</tbody></table></div><ul>${games.join("")}</ul>`;
  const parsed = parseRegularSeason(html(fixtures), data.updated);
  const scheduleOnly = { ...data };
  delete scheduleOnly.boxScores;
  delete scheduleOnly.boxScoreSources;
  assert.deepEqual(parsed, scheduleOnly);
  assert.throws(
    () => parseRegularSeason(html(fixtures.slice(1))),
    /Incomplete schedule/,
  );
  assert.throws(
    () =>
      parseRegularSeason(
        html(fixtures).replace(
          '<span class="team__score">',
          '<span class="bad-score">',
        ),
      ),
    /Invalid basketball score|disagree/,
  );
});

test("90% target uses the fewest wins with enough samples, without rounding a lower probability up", () => {
  const table = loadOddsCache(loadData())!.focusWinTable!;
  const eligible = selectWinTarget(table)!;
  assert.ok(
    table.rows
      .filter(
        (row) =>
          row.remainingWins < eligible.remainingWins && row.samples >= 100,
      )
      .every((row) => 1 - row.noPlayoffs < 0.9),
  );
  assert.ok(1 - eligible.noPlayoffs >= 0.9);
  const synthetic = {
    ...table,
    rows: [
      { ...eligible, remainingWins: 12 },
      { ...eligible, remainingWins: 8, noPlayoffs: 0.100001 },
      { ...eligible, remainingWins: 9, samples: 99 },
      { ...eligible, remainingWins: 10, noPlayoffs: 0.1 },
    ],
  };
  assert.equal(selectWinTarget(synthetic)!.remainingWins, 10);
  assert.equal(selectWinTarget(undefined), undefined);
  assert.equal(
    selectWinTarget({ ...table, rows: synthetic.rows.slice(1, 3) }),
    undefined,
  );
});
