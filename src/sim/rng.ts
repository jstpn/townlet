/** Deterministic pseudo-random numbers. Same seed, same sequence, serialisable state. */
export type Rng = {
  /** Uniform float in [0, 1). */
  next: () => number;
  /** Uniform integer in [0, n). */
  int: (n: number) => number;
  /** True with probability p. */
  chance: (p: number) => boolean;
  /** Current state, for saving. */
  state: () => number;
};

/** 32-bit string hash (cyrb-style) so word seeds map to well-mixed integers. */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32: small, fast, good enough for a game. Pass a saved `state` to resume a sequence. */
export function createRng(seed: string, state?: number): Rng {
  let s = state ?? hashSeed(seed);
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    chance: (p) => next() < p,
    state: () => s,
  };
}
