/** One lighting cycle lasts this many game days. */
export const CYCLE_DAYS = 120;

/** Light levels for one moment of the cycle: multipliers for the sun and sky, and how far into night and golden hour we are. */
export type Daylight = { sun: number; sky: number; night: number; warmth: number };

type Key = [phase: number, sun: number, night: number, warmth: number];

/** Dawn, a long flat day, golden hour, a short dusk, a short night. The last key matches the first, so the cycle wraps. */
const KEYS: Key[] = [
  [0, 0.35, 1, 0],
  [0.04, 0.6, 0.6, 0.5],
  [0.12, 1, 0, 0],
  [0.55, 1, 0, 0],
  [0.66, 0.9, 0, 1],
  [0.74, 0.5, 0.7, 0.4],
  [0.8, 0.35, 1, 0],
  [1, 0.35, 1, 0],
];

/** Light for a phase of the cycle in [0, 1), interpolated between the keys above. */
export function daylight(phase: number): Daylight {
  const p = ((phase % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && p >= KEYS[i + 1][0]) i++;
  const [p0, sun0, night0, warm0] = KEYS[i];
  const [p1, sun1, night1, warm1] = KEYS[i + 1];
  const t = (p - p0) / (p1 - p0);
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  const night = lerp(night0, night1);
  return { sun: lerp(sun0, sun1), sky: 1 - 0.35 * night, night, warmth: lerp(warm0, warm1) };
}
