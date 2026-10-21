import { describe, expect, it } from 'vitest';
import { autoplay } from './autoplayer';

const SEEDS = ['budapest', 'moonrise'];
const MONTHS = 240;
/** Months a sensible mayor should need, give or take: a short, a medium and a long evening. */
const BOUND = { easy: 40, normal: 80, hard: 160 };

describe('a sensible mayor', () => {
  it.each(SEEDS)(
    'wins on easy without ever losing (%s)',
    (seed) => {
      const { sim, wonAt, lostAt } = autoplay('easy', seed, MONTHS);
      console.log(
        `easy ${seed}: won ${wonAt}, pop ${sim.state.population}, money ${Math.round(sim.state.money)}`,
      );
      expect(lostAt).toBeUndefined();
      expect(wonAt).toBeLessThanOrEqual(BOUND.easy);
    },
    120000,
  );

  it.each(SEEDS)(
    'wins on normal (%s)',
    (seed) => {
      const { sim, wonAt, lostAt } = autoplay('normal', seed, MONTHS);
      console.log(
        `normal ${seed}: won ${wonAt}, lost ${lostAt}, pop ${sim.state.population}, money ${Math.round(sim.state.money)}`,
      );
      expect(wonAt).toBeLessThanOrEqual(BOUND.normal);
    },
    120000,
  );

  it.each(SEEDS)(
    'wins on hard (%s)',
    (seed) => {
      const { sim, wonAt, lostAt } = autoplay('hard', seed, MONTHS);
      console.log(
        `hard ${seed}: won ${wonAt}, lost ${lostAt}, pop ${sim.state.population}, money ${Math.round(sim.state.money)}`,
      );
      expect(wonAt).toBeLessThanOrEqual(BOUND.hard);
      expect(wonAt).toBeGreaterThan(BOUND.normal / 2);
    },
    120000,
  );
});
