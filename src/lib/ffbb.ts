import { load } from "cheerio";
import type { DataFile, Game, TeamRecord } from "./types";
import { FOCUS_TEAM_ID, SOURCE_URL } from "./competition";
import { resolveStandingsByTiebreaks } from "./tiebreak";

export const FFBB_FEED_VERSION = "round-fixtures-results-standings-v2";

/** One fixture per round and team pair; a venue reversal must not merge the legs. */
export function ffbbFixtureId(home: string, away: string, round?: number) {
  if (!Number.isInteger(round) || round! < 1 || round! > 26)
    throw new Error("Missing or invalid FFBB fixture round");
  return "r" + round + "-" + [home, away].sort().join("-");
}

export function hasGroupBStandings(html: string): boolean {
  const $ = load(html);
  const header = $("h2.generic__title")
    .filter((_, el) => /poule\s+b/i.test($(el).text()))
    .first();
  return (
    header.nextAll("div").find("table").first().find("tbody tr").length > 0
  );
}

export function parseRegularSeason(
  html: string,
  updated = new Date().toISOString(),
  options: { previous?: DataFile; standingsHtml?: string } = {},
): DataFile {
  const $ = load(html);
  const standings = load(options.standingsHtml ?? html);
  const header = standings("h2.generic__title")
    .filter((_, el) => /poule\s+b/i.test(standings(el).text()))
    .first();
  const table = header.nextAll("div").find("table").first();
  const derived = table.find("tbody tr").length === 0;
  const teams: TeamRecord[] = [];
  if (derived) {
    const previous = options.previous;
    if (
      !previous ||
      previous.group !== "B" ||
      previous.teams.length !== 13 ||
      previous.teams.some((t) => t.points !== 2 * t.wins + t.losses)
    )
      throw new Error(
        "FFBB Group B standings table missing; existing data preserved.",
      );
    teams.push(
      ...previous.teams.map((t) => ({ ...t, wins: 0, losses: 0, points: 0 })),
    );
  } else {
    table.find("tbody tr").each((_, row) => {
      const cells = standings(row).find("td");
      const link = cells.eq(1).find("a.team");
      const id = link.attr("href")?.match(/\/equipe\/(\d+)-/)?.[1];
      if (!id || cells.length < 6)
        throw new Error("Unrecognized FFBB team row.");
      teams.push({
        id,
        name: link.find("span").last().text().trim(),
        abbr: "",
        wins: Number(cells.eq(4).text().trim()),
        losses: Number(cells.eq(5).text().trim()),
        points: Number(cells.eq(2).text().trim()),
        officialRank: Number(cells.eq(0).text().trim()),
      });
    });
  }
  if (
    teams.length !== 13 ||
    new Set(teams.map((t) => t.id)).size !== 13 ||
    !teams.some((t) => t.id === FOCUS_TEAM_ID)
  )
    throw new Error(
      "Expected 13 Group B teams including Vitré. Review competition configuration.",
    );
  const lookup = new Map(teams.map((t) => [t.id, t]));
  const games = new Map<string, Game>();
  $(".display-games__third-list__entry").each((_, entry) => {
    const el = $(entry),
      label = el.find(".game__day").text();
    if (!/Group B\b/i.test(label)) return;
    const nodes = el.find(".display-games__third-list__entry__team");
    const ids = [0, 1].map(
      (i) =>
        nodes
          .eq(i)
          .find("img")
          .attr("src")
          ?.match(/\/team\/(\d+)\./)?.[1],
    );
    if (
      !ids[0] ||
      !ids[1] ||
      !lookup.has(ids[0]) ||
      !lookup.has(ids[1]) ||
      ids[0] === ids[1]
    )
      throw new Error(
        "Unrecognized Group B fixture; refusing a partial schedule.",
      );
    const [home, away] = ids as [string, string];
    [home, away].forEach((id, i) => {
      lookup.get(id)!.abbr = nodes.eq(i).find(".team__title").text().trim();
    });
    const day = el
      .closest(".display-games__second-list__entry")
      .find("time")
      .first()
      .attr("datetime");
    const time = el
      .find(".game__date .date")
      .text()
      .match(/(\d{2}:\d{2})/);
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day))
      throw new Error("Missing fixture date or ID.");
    const scores = [0, 1].map((i) =>
      Number.parseInt(nodes.eq(i).find(".team__score").text().trim(), 10),
    );
    if (
      scores.some(Number.isFinite) &&
      (!scores.every(Number.isFinite) ||
        scores.some((n) => n < 0) ||
        scores[0] === scores[1])
    ) {
      if (!(scores[0] === 0 && scores[1] === 0))
        throw new Error("Invalid basketball score.");
    }
    const played = scores.every(Number.isFinite) && scores[0] !== scores[1];
    const round = Number(label.match(/Journée\s+(\d+)/i)?.[1]);
    const id = ffbbFixtureId(home, away, round);
    if (games.has(id)) throw new Error("Duplicate or invalid fixture.");
    games.set(id, {
      id,
      date: day + (time ? " " + time[1] : ""),
      round,
      home,
      away,
      played,
      homeScore: played ? scores[0] : null,
      awayScore: played ? scores[1] : null,
    });
  });
  const schedule = [...games.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  if (schedule.length !== teams.length * (teams.length - 1))
    throw new Error("Incomplete schedule: " + schedule.length + " games.");
  const pairs = new Map<string, number>();
  for (const game of schedule) {
    const key = [game.home, game.away].sort().join("-");
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  if (pairs.size !== 78 || [...pairs.values()].some((n) => n !== 2))
    throw new Error("Incomplete or invalid two-leg schedule.");
  for (const team of teams) {
    const played = schedule.filter(
      (g) => g.played && (g.home === team.id || g.away === team.id),
    );
    const wins = played.filter((g) =>
      g.home === team.id
        ? g.homeScore! > g.awayScore!
        : g.awayScore! > g.homeScore!,
    ).length;
    if (derived)
      Object.assign(team, {
        wins,
        losses: played.length - wins,
        points: played.length + wins,
      });
    if (
      wins !== team.wins ||
      played.length - wins !== team.losses ||
      !team.abbr ||
      ![team.wins, team.losses, team.points, team.officialRank].every(
        Number.isFinite,
      )
    )
      throw new Error(
        "Standings and results disagree for " +
          team.name +
          "; existing data preserved.",
      );
  }
  const first = Math.min(...schedule.map((g) => Number(g.date.slice(0, 4))));
  const season = first + "-" + (first + 1);
  if (options.previous && season !== options.previous.season)
    throw new Error("Season changed: update competition configuration first");
  if (derived) {
    const wins = Object.fromEntries(teams.map((t) => [t.id, t.wins]));
    const rank = resolveStandingsByTiebreaks(teams, wins, {
      classificationPoints: Object.fromEntries(
        teams.map((t) => [t.id, t.points!]),
      ),
      games: schedule.filter((g) => g.played),
    }).rankedIds;
    teams.forEach((t) => {
      t.officialRank = rank.indexOf(t.id) + 1;
    });
    teams.sort((a, b) => a.officialRank! - b.officialRank!);
  }
  return {
    season,
    updated,
    phase: "regular-season",
    group: "B",
    source: SOURCE_URL,
    ...(derived ? { standingsSource: "results" as const } : {}),
    teams,
    games: schedule,
  };
}
