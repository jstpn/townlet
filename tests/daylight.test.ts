import { describe, expect, it } from 'vitest';
import { MIDNIGHT, daylight } from '../src/render/daylight';

describe('daylight', () => {
  it('is flat day from the start of the cycle', () => {
    expect(daylight(0)).toEqual({ sun: 1, sky: 1, night: 0, warmth: 0 });
    expect(daylight(0.25)).toEqual({ sun: 1, sky: 1, night: 0, warmth: 0 });
  });

  it('is full night at midnight, with the sun low', () => {
    const late = daylight(MIDNIGHT);
    expect(late.night).toBe(1);
    expect(late.sun).toBeLessThan(0.5);
    expect(late.sky).toBeLessThan(1);
  });

  it('ramps through dawn and warms through golden hour', () => {
    const dawn = daylight(0.8);
    expect(dawn.night).toBeGreaterThan(0);
    expect(dawn.night).toBeLessThan(1);
    const golden = daylight(0.41);
    expect(golden.warmth).toBeGreaterThan(0.5);
    expect(golden.night).toBeCloseTo(0, 5);
  });

  it('wraps without a seam', () => {
    const end = daylight(0.9999);
    const start = daylight(0);
    for (const key of ['sun', 'sky', 'night', 'warmth'] as const) {
      expect(Math.abs(end[key] - start[key])).toBeLessThan(0.01);
    }
  });
});
