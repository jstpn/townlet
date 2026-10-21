import { mod } from '../sim/grid';

/** One lighting cycle lasts this many game days. */
export const CYCLE_DAYS = 120;
/** Phase at the middle of the night. */
export const MIDNIGHT = 0.65;

/** Light levels for one moment of the cycle: multipliers for the sun and sky, and how far into night and golden hour we are. */
export type Daylight = { sun: number; sky: number; night: number; warmth: number };

type Key = [phase: number, sun: number, night: number, warmth: number];

/**
 * A long flat day from founding, golden hour, a short dusk, a short night and dawn. Phase 0 is
 * full day so a new town starts in the light; the last key matches the first, so the cycle wraps.
 */
const KEYS: Key[] = [
  [0, 1, 0, 0],
  [0.3, 1, 0, 0],
  [0.41, 0.9, 0, 1],
  [0.49, 0.5, 0.7, 0.4],
  [0.55, 0.35, 1, 0],
  [0.75, 0.35, 1, 0],
  [0.79, 0.6, 0.6, 0.5],
  [0.87, 1, 0, 0],
  [1, 1, 0, 0],
];

/** Light for a phase of the cycle in [0, 1), interpolated between the keys above. */
export function daylight(phase: number): Daylight {
  const p = mod(phase, 1);
  let i = 0;
  while (i < KEYS.length - 2 && p >= KEYS[i + 1][0]) i++;
  const [p0, sun0, night0, warm0] = KEYS[i];
  const [p1, sun1, night1, warm1] = KEYS[i + 1];
  const t = (p - p0) / (p1 - p0);
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  const night = lerp(night0, night1);
  return { sun: lerp(sun0, sun1), sky: 1 - 0.35 * night, night, warmth: lerp(warm0, warm1) };
}
