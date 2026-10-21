export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type DifficultySettings = {
  label: string;
  startingMoney: number;
  /** Research takes this times its days. */
  researchMultiplier: number;
  /** Share of the age's base caps in stock at the start. */
  startingStock: number;
  costMultiplier: number;
  upkeepMultiplier: number;
  growthRate: number;
  /** Days between arrivals while a bed and food wait. */
  arrivalDays: number;
  leaveThreshold: number;
  /** Days between departures while the town is hungry or unhappy. */
  leaveDays: number;
  /** Whether the town is lost when its last resident leaves. */
  canLose: boolean;
  fireChance: number;
  /** Money below this ends the game. Undefined means the town cannot fail. */
  debtLimit: number | undefined;
  winTarget: number;
};

export const DIFFICULTY: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy',
    startingMoney: 20000,
    startingStock: 0.5,
    researchMultiplier: 0.8,
    costMultiplier: 0.8,
    upkeepMultiplier: 0.8,
    growthRate: 0.05,
    arrivalDays: 2,
    leaveThreshold: 30,
    leaveDays: 6,
    canLose: false,
    fireChance: 0,
    debtLimit: undefined,
    winTarget: 2000,
  },
  normal: {
    label: 'Normal',
    startingMoney: 10000,
    startingStock: 0.25,
    researchMultiplier: 1,
    costMultiplier: 1,
    upkeepMultiplier: 1,
    growthRate: 0.035,
    arrivalDays: 3,
    leaveThreshold: 40,
    leaveDays: 4,
    canLose: true,
    fireChance: 0.15,
    debtLimit: -5000,
    winTarget: 5000,
  },
  hard: {
    label: 'Hard',
    startingMoney: 6000,
    startingStock: 0.15,
    researchMultiplier: 1.25,
    costMultiplier: 1.25,
    upkeepMultiplier: 1.3,
    growthRate: 0.025,
    arrivalDays: 4,
    leaveThreshold: 50,
    leaveDays: 3,
    canLose: true,
    fireChance: 0.5,
    debtLimit: -2000,
    winTarget: 10000,
  },
};

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}
