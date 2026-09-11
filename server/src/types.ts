export type Round = 'jeopardy' | 'showdown';

export interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
}

export interface JeopardyQuestion {
  id: string;
  value: number;
  question: string;
  answer: string;
  dailyDouble: boolean;
  used: boolean;
}

export interface JeopardyCategory {
  id: string;
  title: string;
  order: number;
  questions: JeopardyQuestion[];
}

export interface ScoreAward {
  id: string;
  teamId: string;
  amount: number;
  label: string;
  retracted: boolean;
}

export type ShowdownOption = 'A' | 'B';

export interface ShowdownConfig {
  totalRounds: number;
  points: number[];
  startingTeamId?: string;
}

export interface ShowdownLookup {
  scoreA: number;
  scoreB: number;
  winner: ShowdownOption | 'tie';
  source: 'live' | 'manual';
}

export interface ShowdownHistoryEntry {
  round: number;
  subjectA: string;
  subjectB: string;
  lookup: ShowdownLookup;
  winnerTeamId?: string;
  points: number;
}

export interface ShowdownState {
  finalistIds: string[];
  challengerId: string;
  guesserId: string;
  round: number;
  totalRounds: number;
  phase: 'draft' | 'calculating' | 'manual' | 'resolved' | 'complete' | 'tie';
  subjectA: string;
  subjectB: string;
  guesserChoice?: ShowdownOption;
  lookup?: ShowdownLookup;
  scores: Array<{ teamId: string; score: number }>;
  history: ShowdownHistoryEntry[];
}

export interface GameState {
  phase: 'setup' | 'playing';
  round: Round;
  activeJeopardy?: { categoryId: string; questionId: string; revealed: boolean; dailyDoubleCue?: boolean; teamId?: string; wager?: number };
  teams: Team[];
  categories: JeopardyCategory[];
  showdownConfig: ShowdownConfig;
  activeShowdown?: ShowdownState;
  scoreAwards: ScoreAward[];
  message: string;
}
