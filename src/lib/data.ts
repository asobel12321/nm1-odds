import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import {
  DEFAULT_HOME_ADV,
  DEFAULT_PROBABILITY_SCALE,
  MODEL_CONFIG,
} from "@/lib/model";
import { DEFAULT_SEED, FOCUS_TEAM_ID, PLAYOFF_CUTOFF } from "@/lib/competition";
import type { DataFile, TeamRecord, Game, OddsCache } from "@/lib/types";

export function loadData(): DataFile {
  // Fail visibly if official data is missing; never show fabricated standings.
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "poule-b.json"), "utf8"),
  );
}

export function dataFingerprint(data: DataFile): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export function teamsById(teams: TeamRecord[]): Record<string, TeamRecord> {
  return Object.fromEntries(teams.map((team) => [team.id, team]));
}

export function remainingGames(games: Game[]): Game[] {
  return games.filter((game) => !game.played);
}

export function findFocusTeamId(data: DataFile): string {
  const team = data.teams.find(
    (t) => t.id === FOCUS_TEAM_ID || t.abbr === "AVB",
  );
  if (!team)
    throw new Error(
      "Vitré is missing from the Group B data. Run npm run refresh.",
    );
  return team.id;
}

export function loadOddsCache(data = loadData()): OddsCache | null {
  try {
    const cache: OddsCache = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "odds.json"), "utf8"),
    );
    return cache.modelVersion === MODEL_CONFIG.modelVersion &&
      cache.marginCap === MODEL_CONFIG.marginCap &&
      cache.strengthRidge === MODEL_CONFIG.strengthRidge &&
      cache.dataHash === dataFingerprint(data) &&
      cache.cutoff === PLAYOFF_CUTOFF &&
      cache.seed === DEFAULT_SEED &&
      cache.focusId === findFocusTeamId(data) &&
      cache.probabilityScale === DEFAULT_PROBABILITY_SCALE &&
      cache.homeAdv === DEFAULT_HOME_ADV
      ? cache
      : null;
  } catch {
    return null;
  }
}
