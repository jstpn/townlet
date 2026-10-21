import { type Building, Sim, type SimState } from './sim';

const GRIDS = [
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

type GridKey = (typeof GRIDS)[number];

/** The sim as plain JSON-safe data: typed arrays become number arrays, the map and set become lists. */
export type SimSnapshot = Omit<SimState, GridKey | 'buildings' | 'announced' | 'rev'> &
  Record<GridKey, number[]> & { buildings: Building[]; announced: string[]; rng: number };

export function snapshot(sim: Sim): SimSnapshot {
  const s = sim.state;
  const grids = {} as Record<GridKey, number[]>;
  for (const key of GRIDS) grids[key] = Array.from(s[key]);
  return {
    ...grids,
    seed: s.seed,
    difficulty: s.difficulty,
    day: s.day,
    money: s.money,
    nextBuildingId: s.nextBuildingId,
    founded: s.founded,
    population: s.population,
    jobs: s.jobs,
    demand: s.demand,
    happiness: s.happiness,
    taxRate: s.taxRate,
    budget: s.budget,
    status: s.status,
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
  for (const key of GRIDS) s[key].set(snap[key]);
  Object.assign(s, {
    day: snap.day,
    money: snap.money,
    nextBuildingId: snap.nextBuildingId,
    founded: snap.founded,
    population: snap.population,
    jobs: snap.jobs,
    demand: snap.demand,
    happiness: snap.happiness,
    taxRate: snap.taxRate,
    budget: snap.budget,
    status: snap.status,
  });
  s.buildings = new Map(snap.buildings.map((b) => [b.id, b]));
  s.announced = new Set(snap.announced);
  return sim;
}
