export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type DifficultySettings = {
  label: string;
  startingMoney: number;
  costMultiplier: number;
  upkeepMultiplier: number;
  growthRate: number;
  leaveThreshold: number;
  fireChance: number;
  /** Money below this ends the game. Undefined means the town cannot fail. */
  debtLimit: number | undefined;
  winTarget: number;
};

export const DIFFICULTY: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy',
    startingMoney: 20000,
    costMultiplier: 0.8,
    upkeepMultiplier: 0.8,
    growthRate: 0.05,
    leaveThreshold: 30,
    fireChance: 0,
    debtLimit: undefined,
    winTarget: 2000,
  },
  normal: {
    label: 'Normal',
    startingMoney: 10000,
    costMultiplier: 1,
    upkeepMultiplier: 1,
    growthRate: 0.035,
    leaveThreshold: 40,
    fireChance: 0.15,
    debtLimit: -5000,
    winTarget: 5000,
  },
  hard: {
    label: 'Hard',
    startingMoney: 6000,
    costMultiplier: 1.25,
    upkeepMultiplier: 1.3,
    growthRate: 0.025,
    leaveThreshold: 50,
    fireChance: 0.5,
    debtLimit: -2000,
    winTarget: 10000,
  },
};

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}
