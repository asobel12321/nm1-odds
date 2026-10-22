import { load } from "cheerio";
import type { Game } from "./types";

export interface TeamBox {
  points: number;
  minutes: number;
  twoMade: number;
  twoAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  turnovers: number;
}
export interface BoxGame extends Game {
  played: true;
  homeScore: number;
  awayScore: number;
  minutes: number;
  homeBox: TeamBox;
  awayBox: TeamBox;
  source: string;
}
function integer(value: string, label: string) {
  if (!/^\d+$/.test(value)) throw new Error("Invalid " + label);
  return Number(value);
}
function shots(value: string) {
  const pair = value.match(/^(\d+)-(\d+)$/);
  if (!pair || Number(pair[1]) > Number(pair[2]))
    throw new Error("Invalid shooting totals");
  return [Number(pair[1]), Number(pair[2])];
}
export function parseBoxScore(
  html: string,
  game: Game,
  source: string,
): BoxGame {
  if (!game.played || game.homeScore == null || game.awayScore == null)
    throw new Error("A completed fixture is required");
  const $ = load(html);
  const tables = $("main table").filter((_, el) =>
    $(el).find("thead").text().includes("2R-2T"),
  );
  if (tables.length !== 2) throw new Error("Expected two team box scores");
  // IDs identify sides; labels and ticker abbreviations may change between seasons.
  const headings = $("main h1 a[href*='/equipe/']")
    .map(
      (_, a) =>
        $(a)
          .attr("href")
          ?.match(/\/equipe\/(\d+)-/)?.[1],
    )
    .get();
  if (
    headings.length !== 2 ||
    headings[0] !== game.home ||
    headings[1] !== game.away
  )
    throw new Error("Box-score team IDs do not match fixture");
  const parse = (index: number): TeamBox => {
    const table = tables.eq(index);
    const headers = table
      .find("thead th")
      .map((_, el) => $(el).text().trim())
      .get();
    const expected = [
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
    if (JSON.stringify(headers) !== JSON.stringify(expected))
      throw new Error("Unrecognized box-score columns");
    const row = table
      .find("tr")
      .filter((_, el) => /^Totaux\s+Équipe/.test($(el).text().trim()))
      .last();
    const c = row
      .find("td")
      .map((_, el) => $(el).text().trim())
      .get();
    if (c.length !== 19) throw new Error("Missing team totals");
    const [twoMade, twoAttempted] = shots(c[3]),
      [threeMade, threeAttempted] = shots(c[4]),
      [ftMade, ftAttempted] = shots(c[6]);
    const box = {
      points: integer(c[2], "points"),
      minutes: integer(c[1], "team minutes") / 5,
      twoMade,
      twoAttempted,
      threeMade,
      threeAttempted,
      ftMade,
      ftAttempted,
      offensiveRebounds: integer(c[8], "offensive rebounds"),
      defensiveRebounds: integer(c[9], "defensive rebounds"),
      turnovers: integer(c[13], "turnovers"),
    };
    if (2 * twoMade + 3 * threeMade + ftMade !== box.points)
      throw new Error("Points disagree with made shots");
    if (box.minutes < 40 || (box.minutes - 40) % 5 !== 0 || box.minutes > 70)
      throw new Error("Invalid completed-game duration");
    if (
      integer(c[10], "total rebounds") !==
      box.offensiveRebounds + box.defensiveRebounds
    )
      throw new Error("Rebounds do not reconcile");
    if (
      box.offensiveRebounds >
      box.twoAttempted +
        box.threeAttempted -
        twoMade -
        threeMade +
        box.ftAttempted -
        ftMade
    )
      throw new Error("Offensive rebounds exceed misses");
    return box;
  };
  const homeBox = parse(0),
    awayBox = parse(1);
  if (
    homeBox.points !== game.homeScore ||
    awayBox.points !== game.awayScore ||
    homeBox.minutes !== awayBox.minutes
  )
    throw new Error(
      "Box-score totals do not match validated final score/duration",
    );
  // Check period totals independently: a partial feed must not become a valid game.
  const periods = $("main table")
    .filter((_, el) =>
      $(el).find("thead").text().replace(/\s+/g, "").includes("1234P"),
    )
    .first();
  const periodRows = periods.find("tbody tr");
  if (periodRows.length !== 2)
    throw new Error("Missing period score validation");
  periodRows.each((i, el) => {
    const cells = $(el)
      .find("td")
      .map((_, c) => $(c).text().trim())
      .get()
      .slice(1);
    const sum = cells.reduce(
      (s, c) => s + (c === "-" ? 0 : integer(c, "period score")),
      0,
    );
    if (sum !== [game.homeScore, game.awayScore][i])
      throw new Error("Period scores disagree with final score");
  });
  return {
    ...game,
    played: true,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    homeBox,
    awayBox,
    minutes: homeBox.minutes,
    source,
  };
}
