import { load } from "cheerio";
import type { DataFile, Game, TeamRecord } from "./types";
import { FOCUS_TEAM_ID, SOURCE_URL } from "./competition";

export function parseRegularSeason(
  html: string,
  updated = new Date().toISOString(),
): DataFile {
  const $ = load(html);
  const header = $("h2.generic__title")
    .filter((_, el) => /poule\s+b/i.test($(el).text()))
    .first();
  const table = header.nextAll("div").first().find("table").first();
  if (!table.length)
    throw new Error(
      "FFBB Group B standings table missing; existing data preserved.",
    );
  const teams: TeamRecord[] = [];
  table.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    const link = cells.eq(1).find("a.team");
    const id = link.attr("href")?.match(/\/equipe\/(\d+)-/)?.[1];
    if (!id || cells.length < 6) throw new Error("Unrecognized FFBB team row.");
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
  if (teams.length !== 13 || !teams.some((t) => t.id === FOCUS_TEAM_ID)) {
    throw new Error(
      `Expected 13 Group B teams including Vitré, got ${teams.length}. Review competition configuration.`,
    );
  }
  const lookup = new Map(teams.map((t) => [t.id, t]));
  const games = new Map<string, Game>();
  $(".display-games__third-list__entry").each((_, entry) => {
    const el = $(entry);
    if (!/Group B\b/i.test(el.find(".game__day").text())) return;
    const nodes = el.find(".display-games__third-list__entry__team");
    const ids = [0, 1].map(
      (i) =>
        nodes
          .eq(i)
          .find("img")
          .attr("src")
          ?.match(/\/team\/(\d+)\./)?.[1],
    );
    if (!ids[0] || !ids[1] || !lookup.has(ids[0]) || !lookup.has(ids[1])) {
      throw new Error(
        "Unrecognized Group B fixture; refusing a partial schedule.",
      );
    }
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
      .match(/(\d{2}:\d{2})/); // FFBB local time, Europe/Paris.
    const id = `${home}-${away}`;
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !id)
      throw new Error("Missing fixture date or ID.");
    const scores = [0, 1].map((i) =>
      Number.parseInt(nodes.eq(i).find(".team__score").text().trim(), 10),
    );
    const anyScore = scores.some(Number.isFinite);
    if (
      anyScore &&
      (!scores.every(Number.isFinite) ||
        scores.some((n) => n < 0) ||
        scores[0] === scores[1])
    ) {
      if (!(scores[0] === 0 && scores[1] === 0))
        throw new Error("Invalid basketball score.");
    }
    const played = scores.every(Number.isFinite) && scores[0] !== scores[1];
    games.set(id, {
      id,
      date: day + (time ? ` ${time[1]}` : ""),
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
  // Every ordered pair must appear exactly once: 13 teams, 24 games each, 156 total.
  if (schedule.length !== teams.length * (teams.length - 1))
    throw new Error(`Incomplete schedule: ${schedule.length} games.`);
  const pairs = new Set(schedule.map((g) => `${g.home}:${g.away}`));
  if (pairs.size !== schedule.length || schedule.some((g) => g.home === g.away))
    throw new Error("Duplicate or invalid fixture.");
  for (const team of teams) {
    const played = schedule.filter(
      (g) => g.played && (g.home === team.id || g.away === team.id),
    );
    const wins = played.filter((g) =>
      g.home === team.id
        ? g.homeScore! > g.awayScore!
        : g.awayScore! > g.homeScore!,
    ).length;
    if (
      wins !== team.wins ||
      played.length - wins !== team.losses ||
      !team.abbr ||
      ![team.wins, team.losses, team.points, team.officialRank].every(
        Number.isFinite,
      )
    ) {
      throw new Error(
        `Standings and results disagree for ${team.name}; existing data preserved.`,
      );
    }
  }
  const first = Math.min(...schedule.map((g) => Number(g.date.slice(0, 4))));
  return {
    season: `${first}-${first + 1}`,
    updated,
    phase: "regular-season",
    group: "B",
    source: SOURCE_URL,
    teams,
    games: schedule,
  };
}
