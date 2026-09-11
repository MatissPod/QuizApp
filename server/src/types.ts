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

export interface GameState {
  phase: 'setup' | 'playing';
  round: 'jeopardy';
  activeJeopardy?: { categoryId: string; questionId: string; revealed: boolean; dailyDoubleCue?: boolean; teamId?: string; wager?: number };
  teams: Team[];
  categories: JeopardyCategory[];
  scoreAwards: ScoreAward[];
  message: string;
}
