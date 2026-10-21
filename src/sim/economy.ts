import { BUILDINGS, ROAD_UPKEEP, TAX_BASE } from './catalogue';
import type { DifficultySettings } from './difficulty';
import { TILE_COUNT } from './grid';
import { type Fields, capacity } from './growth';
import type { SimState } from './sim';
import { Zone, type ZoneKind } from './types';

export type Budget = { income: number; expenses: number };

/** Tax from every developed lot and upkeep for every building and road tile, for one month. */
export function settleMonth(state: SimState, settings: DifficultySettings): Budget {
  let income = 0;
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    const zone = state.zone[tile];
    const level = state.level[tile];
    if (zone === Zone.None || level === 0) continue;
    const base = TAX_BASE[zone as ZoneKind][level - 1] ?? 0;
    income += base * state.occupancy[tile] * (state.taxRate / 10);
  }
  let upkeep = 0;
  for (const b of state.buildings.values()) upkeep += BUILDINGS[b.kind].upkeep;
  for (let tile = 0; tile < TILE_COUNT; tile++) upkeep += state.road[tile] * ROAD_UPKEEP;
  return { income, expenses: upkeep * settings.upkeepMultiplier };
}

/** 100 at 0%, 60 at 10%, 0 at 20%, linear between. */
function taxScore(rate: number): number {
  return rate <= 10 ? 100 - 4 * rate : 60 - 6 * (rate - 10);
}

/** Weighted mean of what residents care about, 0 to 100. An empty town is content. */
export function computeHappiness(state: SimState, fields: Fields): number {
  let residents = 0;
  let covered = 0;
  let parked = 0;
  let smoked = 0;
  const c = fields.coverage;
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    if (state.zone[tile] !== Zone.Residential) continue;
    const held = capacity(state, tile) * state.occupancy[tile];
    if (held === 0) continue;
    residents += held;
    if (c.school[tile] && c.clinic[tile] && c.police[tile] && c.fire[tile]) covered += held;
    if (c.park[tile] || c.plaza[tile]) parked += held;
    if (fields.pollution[tile] > 0) smoked += held;
  }
  const share = (part: number): number => (100 * part) / residents;
  const workers = state.population * 0.6;
  const employment = workers === 0 ? 100 : 100 * Math.min(1, state.jobs / workers);
  const comfort = residents === 0 ? 500 : 2 * share(covered) + share(parked) + 2 * (100 - share(smoked));
  return (2 * taxScore(state.taxRate) + comfort + 2 * employment) / 9;
}
