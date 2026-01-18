import fs from "fs";
import path from "path";
import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { DataFile, Game, TeamRecord } from "../src/lib/types";

const STANDINGS_URL = "https://nm1.ffbb.com/classement";
const CALENDAR_URL = "https://nm1.ffbb.com/calendrier";

function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function parseTeamId(href: string | undefined, name: string): string {
  const match = href?.match(/\/equipe\/(\d+)-/);
  if (match) {
    return match[1];
  }
  return normalizeName(name).toUpperCase();
}

function seasonStartYear(today: Date): number {
  const month = today.getMonth() + 1;
  return month >= 7 ? today.getFullYear() : today.getFullYear() - 1;
}

function parseDate(raw: string, seasonYear: number): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) {
    return cleaned || "TBD";
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const hour = match[3] ? Number(match[3]) : null;
  const minute = match[4] ? Number(match[4]) : null;
  const year = month >= 7 ? seasonYear : seasonYear + 1;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dateBase = `${year}-${mm}-${dd}`;
  if (hour === null || minute === null) {
    return dateBase;
  }
  const hh = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return `${dateBase} ${hh}:${min}`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  return new TextDecoder("utf-8").decode(buffer);
}

function parseStandings(html: string) {
  const $ = load(html);
  const header = $("h2.generic__title")
    .filter((_, el) => $(el).text().toLowerCase().includes("poule b"))
    .first();
  if (!header.length) {
    throw new Error("Could not locate Poule B standings table.");
  }
  let table = header.nextAll("div").find("table").first();
  if (!table.length) {
    table = header.parent().find("table").first();
  }
  if (!table.length) {
    throw new Error("Poule B standings table missing.");
  }

  const teams: TeamRecord[] = [];
  const nameToId = new Map<string, string>();

  table.find("tbody tr").each((_, row) => {
    const tds = $(row).find("td");
    if (tds.length < 6) {
      return;
    }
    const teamCell = tds.eq(1);
    const name = teamCell.find("span").last().text().trim();
    const href = teamCell.find("a.team").attr("href");
    const id = parseTeamId(href, name);
    const wins = Number(teamCell.parent().find("td").eq(4).text().trim());
    const losses = Number(teamCell.parent().find("td").eq(5).text().trim());

    teams.push({
      id,
      name,
      abbr: "",
      wins: Number.isFinite(wins) ? wins : 0,
      losses: Number.isFinite(losses) ? losses : 0,
    });
    nameToId.set(normalizeName(name), id);
  });

  return { teams, nameToId };
}

function extractTeamData($: CheerioAPI, el: AnyNode) {
  const node = $(el);
  const imgSrc = node.find("img").attr("src") ?? "";
  const logoIdMatch = imgSrc.match(/getTeamLogo\\?id=(\\d+)/);
  const logoId = logoIdMatch ? logoIdMatch[1] : null;
  const name =
    node.find("img").attr("alt")?.trim() ??
    node.find(".team__title").text().trim();
  const abbr = node.find(".team__title").text().trim();
  const scoreText = node.find(".team__score").first().text().trim();
  const score = Number.parseInt(scoreText, 10);
  return { name, abbr, score: Number.isFinite(score) ? score : null, logoId };
}

function parseSchedulePage(
  html: string,
  nameToId: Map<string, string>,
  seasonYear: number,
) {
  const $ = load(html);
  const gamesById = new Map<string, Game>();
  const abbrById = new Map<string, string>();
  const pageNameToId = new Map<string, string>();

  $(".scroll-entry__headerteam a").each((_, link) => {
    const href = $(link).attr("href");
    const name =
      $(link).attr("title")?.trim() ??
      $(link).find("img").attr("alt")?.trim() ??
      "";
    if (!name) {
      return;
    }
    const id = parseTeamId(href, name);
    pageNameToId.set(normalizeName(name), id);
  });

  $(".display-games__third-list__entry").each((_, entry) => {
    const dateText = $(entry).find(".game__date .date").first().text();
    const date = parseDate(dateText, seasonYear);
    const teamEls = $(entry).find(".display-games__third-list__entry__team");
    if (teamEls.length < 2) {
      return;
    }
    const homeEl = teamEls.get(0);
    const awayEl = teamEls.get(1);
    if (!homeEl || !awayEl) {
      return;
    }
    const homeData = extractTeamData($, homeEl);
    const awayData = extractTeamData($, awayEl);
    let homeId =
      homeData.logoId ??
      pageNameToId.get(normalizeName(homeData.name)) ??
      nameToId.get(normalizeName(homeData.name));
    let awayId =
      awayData.logoId ??
      pageNameToId.get(normalizeName(awayData.name)) ??
      nameToId.get(normalizeName(awayData.name));
    const matchHref = $(entry).find("a.header__game__link").attr("href") ?? "";
    if (!homeId || !awayId) {
      return;
    }

    if (homeData.abbr) {
      abbrById.set(homeId, homeData.abbr);
    }
    if (awayData.abbr) {
      abbrById.set(awayId, awayData.abbr);
    }

    const matchId =
      matchHref.match(/\/match\/(\d+)/)?.[1] ??
      `${date}-${homeId}-${awayId}`;

    const played = homeData.score !== null && awayData.score !== null;
    if (!gamesById.has(matchId)) {
      gamesById.set(matchId, {
        id: matchId,
        date,
        home: homeId,
        away: awayId,
        played,
        homeScore: played ? homeData.score : null,
        awayScore: played ? awayData.score : null,
      });
    }
  });

  return { games: Array.from(gamesById.values()), abbrById };
}

async function fetchScheduleLinks(seasonYear: number): Promise<string[]> {
  const calendarHtml = await fetchHtml(CALENDAR_URL);
  const $ = load(calendarHtml);
  const links = new Set<string>();
  $(".schedule__link").each((_, link) => {
    const href = $(link).attr("href");
    if (href) {
      const url = new URL(href, CALENDAR_URL).toString();
      links.add(url);
    }
  });

  const seasonPrefix = `/calendrier/season/${seasonYear}/`;
  $("a.season.dropdown-item").each((_, link) => {
    const href = $(link).attr("href");
    if (href && href.startsWith(seasonPrefix)) {
      const url = new URL(href, CALENDAR_URL).toString();
      links.add(url);
    }
  });

  return links.size > 0 ? Array.from(links) : [CALENDAR_URL];
}

async function fetchAllSchedulePages(seasonYear: number): Promise<string[]> {
  const links = await fetchScheduleLinks(seasonYear);
  const pages: string[] = [];
  for (const link of links) {
    try {
      const html = await fetchHtml(link);
      pages.push(html);
    } catch (error) {
      console.warn(`Failed to fetch schedule page ${link}: ${String(error)}`);
    }
  }
  return pages;
}

function fallbackAbbr(name: string): string {
  const cleaned = normalizeName(name).toUpperCase();
  return cleaned.slice(0, 4) || "TEAM";
}

function applyAbbreviations(teams: TeamRecord[], abbrById: Map<string, string>) {
  return teams.map((team) => {
    let abbr = abbrById.get(team.id) ?? fallbackAbbr(team.name);
    if (normalizeName(team.name).includes("boulogne")) {
      abbr = "SOMB";
    }
    return { ...team, abbr };
  });
}

async function main() {
  const standingsHtml = await fetchHtml(STANDINGS_URL);

  const { teams: rawTeams, nameToId } = parseStandings(standingsHtml);
  const seasonYear = seasonStartYear(new Date());
  const schedulePages = await fetchAllSchedulePages(seasonYear);
  const gamesById = new Map<string, Game>();
  const abbrById = new Map<string, string>();
  for (const page of schedulePages) {
    const { games, abbrById: pageAbbr } = parseSchedulePage(
      page,
      nameToId,
      seasonYear,
    );
    for (const game of games) {
      gamesById.set(game.id, game);
    }
    for (const [id, abbr] of pageAbbr.entries()) {
      abbrById.set(id, abbr);
    }
  }
  const teamIds = new Set(rawTeams.map((team) => team.id));
  const games = Array.from(gamesById.values()).filter(
    (game) => teamIds.has(game.home) && teamIds.has(game.away),
  );
  const teams = applyAbbreviations(rawTeams, abbrById);

  if (teams.length !== 14) {
    console.warn(`Expected 14 Poule B teams, got ${teams.length}.`);
  }

  const output: DataFile = {
    season: `${seasonYear}-${seasonYear + 1}`,
    updated: new Date().toISOString().slice(0, 10),
    teams,
    games,
  };

  const outputPath = path.join(process.cwd(), "data", "poule-b.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${teams.length} teams and ${games.length} games to ${outputPath}`);
}

main().catch((error) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
