import test from "node:test";
import assert from "node:assert/strict";
import { loadData, dataFingerprint, loadOddsCache } from "../src/lib/data";
import { createProjectionModel } from "../src/lib/projectionModel";
import { fitEfficiency, predictEfficiency } from "../src/lib/efficiency";
import {
  assertEfficiencyCoverage,
  refreshEfficiencyData,
} from "../src/lib/ffbbEfficiency";
import type { DataFile } from "../src/lib/types";
import type { BoxGame } from "../src/lib/ffbbBoxScore";
function schedule(data: DataFile) {
  const standings = data.teams
    .map(
      (t) =>
        "<tr><td>" +
        t.officialRank +
        '</td><td><a class="team" href="/equipe/' +
        t.id +
        '-team"><span>' +
        t.name +
        "</span></a></td><td>" +
        t.points +
        "</td><td>" +
        (t.wins + t.losses) +
        "</td><td>" +
        t.wins +
        "</td><td>" +
        t.losses +
        "</td></tr>",
    )
    .join("");
  const games = data.games
    .map(
      (g) =>
        '<li class="display-games__second-list__entry"><time datetime="' +
        g.date.slice(0, 10) +
        '"></time><ul><li class="display-games__third-list__entry"><span class="game__day">Journée "+(g.round ?? 1)+", Group B</span><span class="game__date"><span class="date">' +
        g.date.slice(11) +
        '</span></span><a href="' +
        (data.boxScoreSources?.[g.id]?.url ?? "/match/" + g.id + "-test") +
        '">Game</a>' +
        [g.home, g.away]
          .map(
            (id, i) =>
              '<div class="display-games__third-list__entry__team"><img src="/team/' +
              id +
              '.svg"><span class="team__title">' +
              data.teams.find((t) => t.id === id)!.abbr +
              "</span>" +
              (g.played
                ? '<span class="team__score">' +
                  (i === 0 ? g.homeScore : g.awayScore) +
                  "</span>"
                : "") +
              "</div>",
          )
          .join("") +
        "</li></ul></li>",
    )
    .join("");
  return (
    '<h2 class="generic__title">Classement poule B</h2><div><table><tbody>' +
    standings +
    "</tbody></table></div><ul>" +
    games +
    "</ul>"
  );
}
function statistics(data: DataFile) {
  return (
    "<main><table><tbody>" +
    data.teams
      .map((t) => {
        const own = data
          .boxScores!.filter((g) => g.home === t.id || g.away === t.id)
          .map((g) => (g.home === t.id ? g.homeBox : g.awayBox));
        const cells = Array(22).fill("0");
        cells[0] = '<a href="/equipe/' + t.id + '-team">' + t.name + "</a>";
        cells[1] = String(own.length);
        for (const [field, i] of Object.entries({
          points: 2,
          twoAttempted: 5,
          threeAttempted: 8,
          ftAttempted: 11,
          offensiveRebounds: 14,
          turnovers: 18,
        }))
          cells[i] = (
            own.reduce((s, b) => s + b[field as keyof typeof b], 0) / own.length
          ).toFixed(1);
        return (
          "<tr>" + cells.map((c) => "<td>" + c + "</td>").join("") + "</tr>"
        );
      })
      .join("") +
    "</tbody></table></main>"
  );
}
function boxHtml(g: BoxGame) {
  const headers = [
    "N°",
    "Joueurs",
    "Min",
    "Pts",
    "2R-2T",
    "3R-3T",
    "T%",
    "LFR-LFT",
    "LF%",
    "RO",
    "RD",
    "RT",
    "PD",
    "IN",
    "BP",
    "CT",
    "FTE",
    "FPR",
    "+/-",
    "EVA",
  ];
  return (
    "<main><h1>" +
    [g.home, g.away]
      .map((id) => '<a href="/equipe/' + id + '-team">Team</a>')
      .join("") +
    "</h1><table><thead><tr><th></th>" +
    ["1", "2", "3", "4", "P"].map((n) => "<th>" + n + "</th>").join("") +
    "</tr></thead><tbody>" +
    [g.homeScore, g.awayScore]
      .map(
        (p) =>
          "<tr><td>Team</td><td>" +
          p +
          "</td><td>0</td><td>0</td><td>0</td><td>-</td></tr>",
      )
      .join("") +
    "</tbody></table>" +
    [g.homeBox, g.awayBox]
      .map((b) => {
        const c = [
          "Totaux Équipe",
          b.minutes * 5,
          b.points,
          b.twoMade + "-" + b.twoAttempted,
          b.threeMade + "-" + b.threeAttempted,
          "0%",
          b.ftMade + "-" + b.ftAttempted,
          "0%",
          b.offensiveRebounds,
          b.defensiveRebounds,
          b.offensiveRebounds + b.defensiveRebounds,
          0,
          0,
          b.turnovers,
          0,
          0,
          0,
          0,
          0,
        ];
        return (
          "<table><thead><tr>" +
          headers.map((h) => "<th>" + h + "</th>").join("") +
          "</tr></thead><tbody><tr>" +
          c.map((v) => "<td>" + v + "</td>").join("") +
          "</tr></tbody></table>"
        );
      })
      .join("") +
    "</main>"
  );
}
test("production adapter uses the reviewed efficiency fit and rejects incomplete/mismatched inputs", () => {
  const data = loadData(),
    fit = fitEfficiency(data, data.boxScores!),
    model = createProjectionModel(data),
    game = data.games.find((g) => !g.played)!;
  assert.equal(
    model.homeProbability(game),
    predictEfficiency(fit, game.home, game.away).homeWinProbability,
  );
  assert.equal(model.strengthRatings["269"], fit.teams["269"].net);
  assert.throws(
    () =>
      createProjectionModel({ ...data, boxScores: data.boxScores!.slice(1) }),
    /Incomplete/,
  );
  const changed = structuredClone(data);
  changed.boxScores![0].homeScore++;
  assert.throws(() => assertEfficiencyCoverage(changed), /disagrees/);
});
test("same-score stats corrections invalidate the production cache", () => {
  const data = loadData(),
    changed = structuredClone(data);
  changed.boxScores![0].homeBox.turnovers++;
  assert.notEqual(dataFingerprint(data), dataFingerprint(changed));
  assert.equal(loadOddsCache(changed), null);
});
test("refresh reuses matching validated boxes and reconciles all teams", async () => {
  const data = loadData(),
    before = structuredClone(data),
    requests: string[] = [];
  const next = await refreshEfficiencyData(
    schedule(data),
    data,
    async (url) => {
      requests.push(url);
      return statistics(data);
    },
  );
  assert.equal(requests.length, 1);
  assert.ok(requests[0].endsWith("/leaders/equipes"));
  assert.deepEqual(next.boxScores, data.boxScores);
  assert.deepEqual(data, before);
});
test("refresh retrieves missing boxes; a missing feed retains the prior input untouched", async () => {
  const data = loadData(),
    previous = { ...data, boxScores: data.boxScores!.slice(1) },
    target = data.boxScores![0],
    html = schedule(data);
  const next = await refreshEfficiencyData(html, previous, async (url) =>
    url.endsWith("/leaders/equipes") ? statistics(data) : boxHtml(target),
  );
  assert.equal(next.boxScores!.length, data.boxScores!.length);
  const before = structuredClone(previous);
  await assert.rejects(
    () =>
      refreshEfficiencyData(html, previous, async () => {
        throw Error("feed unavailable");
      }),
    /feed unavailable/,
  );
  assert.deepEqual(previous, before);
});
test("same-score stat corrections force a full refetch before replacing a snapshot", async () => {
  const data = loadData(),
    previous = structuredClone(data);
  previous.boxScores![0].homeBox.twoAttempted += 2;
  let fetched = 0;
  const next = await refreshEfficiencyData(
    schedule(data),
    previous,
    async (url) => {
      if (url.endsWith("/leaders/equipes")) return statistics(data);
      fetched++;
      const game = data.boxScores!.find((g) => g.source === url);
      assert.ok(game);
      return boxHtml(game);
    },
  );
  assert.equal(fetched, data.boxScores!.length);
  assert.deepEqual(
    next.boxScores!.map((g) => g.homeBox),
    data.boxScores!.map((g) => g.homeBox),
  );
});
