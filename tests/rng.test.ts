import { describe, expect, it } from 'vitest';
import { createRng } from '../src/sim/rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng('townlet');
    const b = createRng('townlet');
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
    expect(seqA[0]).toBeGreaterThanOrEqual(0);
    expect(seqA[0]).toBeLessThan(1);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng('townlet');
    const b = createRng('hamlet');
    expect(a.next()).not.toBe(b.next());
  });
});
