import { BUILDINGS, ZONE_CAPACITY } from './catalogue';
import type { DifficultySettings } from './difficulty';
import type { Coverage } from './fields';
import { TILE_COUNT, clamp, rectTiles, xOf, yOf } from './grid';
import type { Rng } from './rng';
import type { SimState } from './sim';
import { Zone, type ZoneKind } from './types';

export type Demand = Record<ZoneKind, number>;

export type Fields = { coverage: Coverage; roadAccess: Uint8Array; pollution: Float32Array };

const clamp1 = (v: number): number => clamp(v, -1, 1);

/** Share of residents who work. */
const WORKER_SHARE = 0.4;
/**
 * Jobs the shops and factories aim to offer per worker. Above one, so a town that keeps up with
 * its shops and factories always has room for more homes: residential demand at equilibrium is
 * 1 - 1 / JOBS_PER_WORKER plus the baseline.
 */
const JOBS_PER_WORKER = 4 / 3;
/** Of the wanted jobs, the share that is commercial; the rest is industrial. */
const COMMERCIAL_SHARE = 5 / 8;

/** Residents, jobs and the three demand bars, from what the lots currently hold. */
export function computeDemand(state: SimState): {
  population: number;
  jobs: number;
  demand: Demand;
} {
  let population = 0;
  let commercialJobs = 0;
  let industrialJobs = 0;
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    const zone = state.zone[tile];
    if (zone === Zone.Residential) population += held(state, tile);
    else if (zone === Zone.Commercial) commercialJobs += held(state, tile);
    else if (zone === Zone.Industrial) industrialJobs += held(state, tile);
  }
  let serviceJobs = 0;
  for (const b of state.buildings.values()) serviceJobs += BUILDINGS[b.kind].jobs;
  const jobs = commercialJobs + industrialJobs + serviceJobs;
  const workers = population * WORKER_SHARE;
  const wantedJobs = workers * JOBS_PER_WORKER;
  const commercialTarget = wantedJobs * COMMERCIAL_SHARE;
  const industrialTarget = wantedJobs - commercialTarget;
  const baseline = 0.2 * Math.max(0, 1 - population / 500);
  return {
    population,
    jobs,
    demand: {
      [Zone.Residential]: clamp1((jobs - workers) / Math.max(jobs, 20) + baseline),
      [Zone.Commercial]: clamp1(
        (commercialTarget - commercialJobs) / Math.max(commercialTarget, 10) + 0.1,
      ),
      [Zone.Industrial]: clamp1(
        (industrialTarget - industrialJobs) / Math.max(industrialTarget, 10) + 0.15,
      ),
    },
  };
}

/** Residents or jobs the lot holds when full. */
export function capacity(state: SimState, tile: number): number {
  const zone = state.zone[tile];
  const level = state.level[tile];
  if (zone === Zone.None || level === 0) return 0;
  return ZONE_CAPACITY[zone as ZoneKind][level - 1] ?? 0;
}

/** Residents or jobs the lot holds right now. */
export const held = (state: SimState, tile: number): number =>
  capacity(state, tile) * state.occupancy[tile];

function residentsNear(state: SimState, x: number, y: number, radius: number): number {
  let total = 0;
  for (const tile of rectTiles(x - radius, y - radius, x + radius, y + radius)) {
    if (state.zone[tile] === Zone.Residential) total += held(state, tile);
  }
  return total;
}

function industryNear(state: SimState, x: number, y: number, self: number): boolean {
  for (const tile of rectTiles(x - 4, y - 4, x + 4, y + 4)) {
    if (tile !== self && state.zone[tile] === Zone.Industrial && state.level[tile] > 0) return true;
  }
  return false;
}

/** How much a zoned tile wants to grow, 0 to 1, from services, parks, neighbours and smoke. */
export function desirability(state: SimState, fields: Fields, tile: number): number {
  const x = xOf(tile);
  const y = yOf(tile);
  const c = fields.coverage;
  const pollution = fields.pollution[tile];
  let score: number;
  switch (state.zone[tile]) {
    case Zone.Residential:
      score =
        0.3 +
        0.15 * (c.school[tile] + c.clinic[tile] + c.police[tile] + c.fire[tile]) +
        0.1 * c.park[tile] +
        0.05 * c.plaza[tile] -
        0.4 * pollution;
      break;
    case Zone.Commercial:
      score =
        0.3 +
        0.4 * Math.min(1, residentsNear(state, x, y, 6) / 40) +
        0.15 * c.police[tile] +
        0.1 * c.park[tile] -
        0.2 * pollution;
      break;
    case Zone.Industrial:
      score = 0.6 + 0.2 * c.fire[tile] + (industryNear(state, x, y, tile) ? 0.2 : 0);
      break;
    default:
      return 0;
  }
  return clamp(score, 0, 1);
}

/** One day of growth across every zoned tile. Returns true when any level changed. */
export function stepGrowth(
  state: SimState,
  fields: Fields,
  rng: Rng,
  settings: DifficultySettings,
): boolean {
  let changed = false;
  const content = state.happiness >= settings.leaveThreshold;
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    const zone = state.zone[tile];
    if (zone === Zone.None) continue;
    const served = fields.coverage.power[tile] === 1 && fields.coverage.water[tile] === 1;
    const reachable = fields.roadAccess[tile] === 1;
    const demand = state.demand[zone as ZoneKind];
    const level = state.level[tile];
    const mayGrow = served && reachable && level < 3 && demand > 0;
    // Appeal is only read for blight on developed lots and for growth rolls.
    const want = level > 0 || mayGrow ? desirability(state, fields, tile) : 0;

    if (level > 0) {
      const filling = served && reachable && demand > -0.2 && content;
      const occupancy = state.occupancy[tile];
      state.occupancy[tile] = filling
        ? Math.min(1, occupancy + 0.05)
        : Math.max(0, occupancy - 0.03);
    }

    state.starveDays[tile] =
      level > 0 && state.occupancy[tile] < 0.1 && demand < 0 ? state.starveDays[tile] + 1 : 0;
    state.blightDays[tile] = level > 0 && want < 0.2 ? state.blightDays[tile] + 1 : 0;
    if (state.starveDays[tile] >= 30 || state.blightDays[tile] >= 60) {
      state.level[tile] = level - 1;
      state.starveDays[tile] = 0;
      state.blightDays[tile] = 0;
      if (state.level[tile] === 0) state.occupancy[tile] = 0;
      changed = true;
      continue;
    }

    if (!mayGrow || want <= 0.35 + 0.15 * level) continue;
    if (rng.chance(settings.growthRate * demand * want)) {
      state.level[tile] = level + 1;
      changed = true;
    }
  }
  return changed;
}
