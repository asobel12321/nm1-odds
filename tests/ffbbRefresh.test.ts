import test from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/lib/data";
import { parseRegularSeason } from "../src/lib/ffbb";
import type { DataFile } from "../src/lib/types";

function emptySeason(): DataFile {
  const data = structuredClone(loadData());
  data.teams.forEach((t, i) =>
    Object.assign(t, { wins: 0, losses: 0, points: 0, officialRank: i + 1 }),
  );
  data.games.forEach((g) =>
    Object.assign(g, { played: false, homeScore: null, awayScore: null }),
  );
  data.boxScores = [];
  data.boxScoreSources = {};
  return data;
}
function page(data: DataFile, includeStandings = true) {
  const standings = includeStandings
    ? '<h2 class="generic__title">Classement poule B</h2><div><table><tbody>' +
      data.teams
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
            "</td><td>0</td><td>" +
            t.wins +
            "</td><td>" +
            t.losses +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table></div>"
    : "";
  return (
    standings +
    "<ul>" +
    data.games
      .map(
        (g) =>
          '<li class="display-games__second-list__entry"><time datetime="' +
          g.date.slice(0, 10) +
          '"></time><ul><li class="display-games__third-list__entry"><span class="game__day">Journée ' +
          g.round +
          ', Group B</span><span class="game__date"><span class="date">' +
          g.date.slice(11) +
          "</span></span>" +
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
      .join("") +
    "</ul>"
  );
}

test("a venue inversion does not collapse the two legs into one fixture", () => {
  const data = emptySeason();
  const legs = data.games.filter(
    (g) =>
      (g.home === "15605" || g.away === "15605") &&
      (g.home === "14016" || g.away === "14016"),
  );
  assert.equal(legs.length, 2);
  legs.forEach((g) => Object.assign(g, { home: "14016", away: "15605" }));
  const parsed = parseRegularSeason(page(data));
  assert.equal(parsed.games.length, 156);
  assert.equal(new Set(parsed.games.map((g) => g.id)).size, 156);
  assert.equal(
    parsed.games.filter((g) => g.home === "14016" && g.away === "15605").length,
    2,
  );
});

test("a missing standings table can rebuild records from a complete score feed and known roster", () => {
  const data = emptySeason();
  const game = data.games[0];
  Object.assign(game, { played: true, homeScore: 89, awayScore: 75 });
  const parsed = parseRegularSeason(page(data, false), data.updated, {
    previous: data,
  });
  assert.equal(parsed.standingsSource, "results");
  assert.equal(parsed.teams.find((t) => t.id === game.home)!.wins, 1);
  assert.equal(parsed.teams.find((t) => t.id === game.home)!.points, 2);
  assert.equal(parsed.teams.find((t) => t.id === game.away)!.losses, 1);
  assert.throws(
    () =>
      parseRegularSeason(
        page({ ...data, games: data.games.slice(1) }, false),
        data.updated,
        { previous: data },
      ),
    /Incomplete schedule/,
  );
});

test("standings fallback refuses unknown rosters, point adjustments, and a different season", () => {
  const data = emptySeason(),
    html = page(data, false);
  assert.throws(
    () =>
      parseRegularSeason(html, data.updated, {
        previous: { ...data, teams: data.teams.slice(1) },
      }),
    /standings table missing/,
  );
  const adjusted = structuredClone(data);
  adjusted.teams[0].points = 3;
  assert.throws(
    () => parseRegularSeason(html, data.updated, { previous: adjusted }),
    /standings table missing/,
  );
  assert.throws(
    () =>
      parseRegularSeason(html, data.updated, {
        previous: { ...data, season: "2025-2026" },
      }),
    /Season changed/,
  );
  assert.throws(
    () =>
      parseRegularSeason(
        page({ ...data, games: [data.games[0], ...data.games] }),
      ),
    /Duplicate/,
  );
});
