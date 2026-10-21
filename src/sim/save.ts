import { type Building, Sim, type SimState } from './sim';

export const SNAPSHOT_GRIDS = [
  'terrain',
  'road',
  'zone',
  'level',
  'occupancy',
  'buildingId',
  'starveDays',
  'blightDays',
  'fire',
] as const;

type GridKey = (typeof SNAPSHOT_GRIDS)[number];

/** Everything else that is saved as is. The snapshot type below fails to compile if one is missing. */
const SCALARS = [
  'seed',
  'difficulty',
  'day',
  'money',
  'nextBuildingId',
  'founded',
  'population',
  'jobs',
  'demand',
  'happiness',
  'taxRate',
  'budget',
  'status',
] as const;

/** The sim as plain JSON-safe data: typed arrays become number arrays, the map and set become lists. */
export type SimSnapshot = Omit<SimState, GridKey | 'buildings' | 'announced' | 'rev'> &
  Record<GridKey, number[]> & { buildings: Building[]; announced: string[]; rng: number };

function pick<T, K extends keyof T>(from: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = from[key];
  return out;
}

export function snapshot(sim: Sim): SimSnapshot {
  const s = sim.state;
  const grids = {} as Record<GridKey, number[]>;
  for (const key of SNAPSHOT_GRIDS) grids[key] = Array.from(s[key]);
  return {
    ...pick(s, SCALARS),
    ...grids,
    buildings: [...s.buildings.values()],
    announced: [...s.announced],
    rng: sim.rngState,
  };
}

export function restoreSim(snap: SimSnapshot): Sim {
  const sim = new Sim({
    seed: snap.seed,
    difficulty: snap.difficulty,
    terrain: Uint8Array.from(snap.terrain),
    rngState: snap.rng,
  });
  const s = sim.state;
  for (const key of SNAPSHOT_GRIDS) s[key].set(snap[key]);
  Object.assign(s, pick(snap, SCALARS));
  s.buildings = new Map(snap.buildings.map((b) => [b.id, b]));
  s.announced = new Set(snap.announced);
  return sim;
}
