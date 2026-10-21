export type TeamId = string;

export interface TeamRecord {
  id: TeamId;
  name: string;
  abbr: string;
  wins: number;
  losses: number;
  officialRank?: number;
  points?: number;
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
  source?: string;
  phase?: string;
  group?: string;
}

export type GameResult = "home" | "away";
export type ForcedOutcomes = Record<string, GameResult>;

export interface SimParams {
  simulations: number;
  k: number;
  homeAdv: number;
  seed?: number;
  focusId?: TeamId;
  forcedOutcomes?: ForcedOutcomes;
}

export interface SimResult {
  playoffOdds: Record<TeamId, number>;
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
  samples: number;
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

export interface ClinchScenario {
  label: string;
  outcomes: ForcedOutcomes;
}

export interface ClinchResult {
  roundDate: string;
  scenarios: number;
  totalClinchingScenarios: number;
  clinchingScenarios: ClinchScenario[];
}

export interface OddsCache extends SimResult {
  dataHash: string;
  cutoff: number;
  seed: number;
  updated: string;
  simulations: number;
  k: number;
  homeAdv: number;
  focusId: TeamId;
  focusWinTable?: WinTable;
  focusMatchdayImpact?: MatchdayImpact | null;
  focusClinchScenarios?: ClinchResult | null;
}

export interface BestWorstResult {
  roundDate: string;
  scenarios: number;
  best: {
    label: string;
    odds: number;
    clinches: boolean;
    outcomes: ForcedOutcomes;
    rankHist: number[];
  };
  worst: {
    label: string;
    odds: number;
    clinches: boolean;
    outcomes: ForcedOutcomes;
    rankHist: number[];
  };
}
