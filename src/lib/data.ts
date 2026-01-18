import fs from "fs";
import path from "path";
import type { DataFile, TeamRecord, Game, OddsCache } from "@/lib/types";

const DEFAULT_DATA: DataFile = {
  season: "2025-2026",
  updated: "2026-01-17",
  teams: [
    { id: "SOMB", name: "SOM Boulogne", abbr: "SOMB", wins: 10, losses: 6 },
    { id: "TEAM2", name: "Team 2", abbr: "T2", wins: 11, losses: 5 },
    { id: "TEAM3", name: "Team 3", abbr: "T3", wins: 9, losses: 7 },
    { id: "TEAM4", name: "Team 4", abbr: "T4", wins: 8, losses: 8 },
    { id: "TEAM5", name: "Team 5", abbr: "T5", wins: 8, losses: 8 },
    { id: "TEAM6", name: "Team 6", abbr: "T6", wins: 7, losses: 9 },
    { id: "TEAM7", name: "Team 7", abbr: "T7", wins: 7, losses: 9 },
    { id: "TEAM8", name: "Team 8", abbr: "T8", wins: 6, losses: 10 },
    { id: "TEAM9", name: "Team 9", abbr: "T9", wins: 6, losses: 10 },
    { id: "TEAM10", name: "Team 10", abbr: "T10", wins: 5, losses: 11 },
    { id: "TEAM11", name: "Team 11", abbr: "T11", wins: 5, losses: 11 },
    { id: "TEAM12", name: "Team 12", abbr: "T12", wins: 4, losses: 12 },
    { id: "TEAM13", name: "Team 13", abbr: "T13", wins: 4, losses: 12 },
    { id: "TEAM14", name: "Team 14", abbr: "T14", wins: 3, losses: 13 },
  ],
  games: [
    {
      id: "2026-01-20-SOMB-TEAM4",
      date: "2026-01-20",
      home: "SOMB",
      away: "TEAM4",
      played: false,
    },
    {
      id: "2026-01-20-TEAM2-TEAM3",
      date: "2026-01-20",
      home: "TEAM2",
      away: "TEAM3",
      played: false,
    },
    {
      id: "2026-01-20-TEAM5-TEAM6",
      date: "2026-01-20",
      home: "TEAM5",
      away: "TEAM6",
      played: false,
    },
    {
      id: "2026-01-27-TEAM7-SOMB",
      date: "2026-01-27",
      home: "TEAM7",
      away: "SOMB",
      played: false,
    },
    {
      id: "2026-01-27-TEAM8-TEAM9",
      date: "2026-01-27",
      home: "TEAM8",
      away: "TEAM9",
      played: false,
    },
    {
      id: "2026-01-27-TEAM10-TEAM11",
      date: "2026-01-27",
      home: "TEAM10",
      away: "TEAM11",
      played: false,
    },
  ],
};

export function loadData(): DataFile {
  const dataPath = path.join(process.cwd(), "data", "poule-b.json");
  try {
    const raw = fs.readFileSync(dataPath, "utf8").trim();
    if (!raw) {
      return DEFAULT_DATA;
    }
    return JSON.parse(raw) as DataFile;
  } catch {
    return DEFAULT_DATA;
  }
}

export function teamsById(teams: TeamRecord[]): Record<string, TeamRecord> {
  const map: Record<string, TeamRecord> = {};
  for (const team of teams) {
    map[team.id] = team;
  }
  return map;
}

export function remainingGames(games: Game[]): Game[] {
  return games.filter((game) => !game.played);
}

export function loadOddsCache(): OddsCache | null {
  const oddsPath = path.join(process.cwd(), "data", "odds.json");
  try {
    const raw = fs.readFileSync(oddsPath, "utf8").trim();
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as OddsCache;
  } catch {
    return null;
  }
}

function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function findSombId(data: DataFile): string | null {
  const byAbbr = data.teams.find(
    (team) => team.abbr.toUpperCase() === "SOMB",
  );
  if (byAbbr) {
    return byAbbr.id;
  }
  const byName = data.teams.find((team) =>
    normalizeName(team.name).includes("boulogne"),
  );
  return byName?.id ?? null;
}
