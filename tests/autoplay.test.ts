import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../src/sim/difficulty';
import { autoplay } from './autoplayer';

const SEEDS = ['budapest', 'moonrise'];
const MONTHS = 240;
/** Months a sensible mayor should need, give or take: a short, a medium and a long evening. */
const BOUND: Record<Difficulty, [min: number, max: number]> = {
  easy: [0, 40],
  normal: [0, 80],
  hard: [40, 160],
};
const RUNS = (Object.keys(BOUND) as Difficulty[]).flatMap((d) => SEEDS.map((s) => [d, s] as const));

describe('a sensible mayor', () => {
  it.each(RUNS)(
    'wins on %s within bounds (%s)',
    (difficulty, seed) => {
      const { sim, wonAt, lostAt } = autoplay(difficulty, seed, MONTHS);
      console.log(
        `${difficulty} ${seed}: won ${wonAt}, lost ${lostAt}, pop ${sim.state.population}, money ${Math.round(sim.state.money)}`,
      );
      const [min, max] = BOUND[difficulty];
      expect(lostAt).toBeUndefined();
      expect(wonAt).toBeGreaterThan(min);
      expect(wonAt).toBeLessThanOrEqual(max);
    },
    120000,
  );
});
