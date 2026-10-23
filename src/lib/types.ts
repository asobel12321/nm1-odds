import type { BoxGame } from "./ffbbBoxScore";
import type { EfficiencyTeam } from "./efficiency";
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
  round?: number;
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
  boxScores?: BoxGame[];
  boxScoreSources?: Record<
    string,
    { url: string; retrieved: string; sha256: string }
  >;
}

export type GameResult = "home" | "away";
export type ForcedOutcomes = Record<string, GameResult>;

export interface SimParams {
  simulations: number;
  probabilityScale: number;
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
  modelVersion: string;
  marginCap: number;
  strengthRidge: number;
  strengthRatings: Record<TeamId, number>;
  ftCoefficient: number;
  paceRidge: number;
  ratingUnits: string;
  efficiencyRatings: Record<TeamId, EfficiencyTeam>;
  groupEfficiency: number;
  groupPace: number;
  dataHash: string;
  cutoff: number;
  seed: number;
  updated: string;
  simulations: number;
  probabilityScale: number;
  homeAdv: number;
  focusId: TeamId;
  focusWinTable?: WinTable;
  bestCaseVersion?: string;
  focusBestCase?: BestCaseResult | null;
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

export interface BestCaseResult {
  roundNumber: number | null;
  roundDate: string;
  roundEndDate: string;
  games: Game[];
  scenarios: number;
  simulations: number;
  seed: number;
  baselineOdds: number;
  odds: number;
  outcomes: ForcedOutcomes;
}
