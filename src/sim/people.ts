import { AGE_DEFS, type Stock } from './ages';
import { BUILDINGS, footprint } from './catalogue';
import type { DifficultySettings } from './difficulty';
import type { Building, SimState } from './sim';

/** Days of eating the stock must hold, for the town and the newcomer, before anyone arrives. */
const ARRIVAL_FOOD_DAYS = 10;
/** Happiness lost per day of hunger. */
const HUNGER_PENALTY = 10;

/** The main building always works; anything else only within two tiles of a path. */
function works(state: SimState, b: Building, roadAccess: Uint8Array): boolean {
  return b.kind === AGE_DEFS[state.age].main || footprint(b).some((t) => roadAccess[t] === 1);
}

/** Beds in every working building. */
export function countBeds(state: SimState, roadAccess: Uint8Array): number {
  let beds = 0;
  for (const b of state.buildings.values()) {
    if (works(state, b, roadAccess)) beds += BUILDINGS[b.kind].beds ?? 0;
  }
  return beds;
}

/** Whether the terrain a workplace draws on lies within its radius. */
function supplied(state: SimState, b: Building): boolean {
  const near = BUILDINGS[b.kind].makes?.near;
  return !near || footprint(b, near.radius).some((t) => state.terrain[t] === near.terrain);
}

/**
 * Residents fill the slots of working, supplied workplaces nearest a bed first (Manhattan from
 * corner to corner, ties by id), and each filled slot makes its yield into the stock up to the cap.
 */
function work(state: SimState, roadAccess: Uint8Array, caps: Stock): void {
  const homes: Building[] = [];
  const open: { b: Building; distance: number }[] = [];
  for (const b of state.buildings.values()) {
    b.workers = 0;
    b.wasted = 0;
    if (!works(state, b, roadAccess)) continue;
    const def = BUILDINGS[b.kind];
    if (def.beds) homes.push(b);
    if (def.slots && supplied(state, b)) open.push({ b, distance: 0 });
  }
  for (const place of open) {
    place.distance = Math.min(
      ...homes.map((h) => Math.abs(h.x - place.b.x) + Math.abs(h.y - place.b.y)),
    );
  }
  open.sort((p, q) => p.distance - q.distance || p.b.id - q.b.id);
  let free = state.population;
  for (const { b } of open) {
    const def = BUILDINGS[b.kind];
    b.workers = Math.min(free, def.slots ?? 0);
    free -= b.workers;
    if (!def.makes || b.workers === 0) continue;
    const r = def.makes.resource;
    const made = b.workers * def.makes.each;
    const have = state.stock[r] ?? 0;
    const kept = Math.min(made, Math.max(0, (caps[r] ?? 0) - have));
    state.stock[r] = have + kept;
    b.wasted = made - kept;
  }
}

/**
 * One day of residents in an engine age: they work, eat, leave while hungry or unhappy, and
 * arrive while a bed is free and the food holds. Returns true when the town has just been lost.
 */
export function stepPeople(
  state: SimState,
  roadAccess: Uint8Array,
  caps: Stock,
  settings: DifficultySettings,
): boolean {
  work(state, roadAccess, caps);
  const food = state.stock.food ?? 0;
  const eaten = Math.min(food, state.population);
  state.stock.food = food - eaten;
  state.hungerDays = eaten < state.population ? state.hungerDays + 1 : 0;
  state.happiness = Math.max(0, 100 - HUNGER_PENALTY * state.hungerDays);

  const unhappy = state.hungerDays > 0 || state.happiness < settings.leaveThreshold;
  state.leaveWait = unhappy && state.population > 0 ? state.leaveWait + 1 : 0;
  if (state.leaveWait >= settings.leaveDays) {
    state.leaveWait = 0;
    state.population--;
    if (state.population === 0 && settings.canLose) return true;
  }

  const welcome =
    !unhappy &&
    state.population < countBeds(state, roadAccess) &&
    state.stock.food >= ARRIVAL_FOOD_DAYS * (state.population + 1);
  state.arrivalWait = welcome ? state.arrivalWait + 1 : 0;
  if (state.arrivalWait >= settings.arrivalDays) {
    state.arrivalWait = 0;
    state.population++;
  }
  return false;
}
