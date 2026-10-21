import { AGE_DEFS } from './ages';
import { BUILDINGS, footprint } from './catalogue';
import type { DifficultySettings } from './difficulty';
import type { Building, SimState } from './sim';

/** Days of eating the stock must hold, for the town and the newcomer, before anyone arrives. */
const ARRIVAL_FOOD_DAYS = 10;
/** Happiness lost per day of hunger. */
const HUNGER_PENALTY = 10;

/** Within two tiles of a path, where a building works. */
export const reachable = (b: Building, roadAccess: Uint8Array): boolean =>
  footprint(b).some((tile) => roadAccess[tile] === 1);

/** Beds in the main building and every dwelling by a path. */
export function countBeds(state: SimState, roadAccess: Uint8Array): number {
  let beds = 0;
  for (const b of state.buildings.values()) {
    const def = BUILDINGS[b.kind];
    if (def.beds && (b.kind === AGE_DEFS[state.age].main || reachable(b, roadAccess)))
      beds += def.beds;
  }
  return beds;
}

/**
 * One day of residents in an engine age: they eat, leave while hungry or unhappy, and arrive while
 * a bed is free and the food holds. Returns true when the town has just been lost.
 */
export function stepPeople(
  state: SimState,
  roadAccess: Uint8Array,
  settings: DifficultySettings,
): boolean {
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
