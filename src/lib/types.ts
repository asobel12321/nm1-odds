export type TeamId = string;

export interface TeamRecord {
  id: TeamId;
  name: string;
  abbr: string;
  wins: number;
  losses: number;
}

export interface Game {
  id: string;
  date: string;
  home: TeamId;
  away: TeamId;
  played: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface DataFile {
  season: string;
  updated: string;
  teams: TeamRecord[];
  games: Game[];
}

export type GameResult = "home" | "away";
export type ForcedOutcomes = Record<string, GameResult>;

export interface SimParams {
  simulations: number;
  k: number;
  homeAdv: number;
  seed?: number;
  sombId?: TeamId;
  forcedOutcomes?: ForcedOutcomes;
}

export interface SimResult {
  top7Odds: Record<TeamId, number>;
  rankHist: Record<TeamId, number[]>;
  winHist: Record<TeamId, number[]>;
}

export interface WinTableRow {
  remainingWins: number;
  remainingLosses: number;
  wins: number;
  losses: number;
  winPct: number;
  rankProbs: number[];
  noPlayoffs: number;
}

export interface WinTable {
  remainingGames: number;
  rows: WinTableRow[];
}

export interface MatchdayImpactGame {
  game: Game;
  homeWinOdds: number;
  awayWinOdds: number;
  better: "home" | "away";
  delta: number;
}

export interface MatchdayImpact {
  roundDate: string;
  games: MatchdayImpactGame[];
}

export interface OddsCache extends SimResult {
  updated: string;
  simulations: number;
  k: number;
  homeAdv: number;
  sombId: TeamId;
  sombWinTable?: WinTable;
  sombMatchdayImpact?: MatchdayImpact;
}

export interface BestWorstResult {
  roundDate: string;
  scenarios: number;
  best: { label: string; odds: number; outcomes: ForcedOutcomes };
  worst: { label: string; odds: number; outcomes: ForcedOutcomes };
}
