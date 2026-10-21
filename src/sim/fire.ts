import type { DifficultySettings } from './difficulty';
import { DIRS4, TILE_COUNT, idx, inBounds, xOf, yOf } from './grid';
import type { Fields } from './growth';
import type { Rng } from './rng';
import type { SimState } from './sim';
import { Zone } from './types';

/** A developed lot or a service other than the town hall, and not already burning. */
export function flammable(state: SimState, tile: number): boolean {
  if (state.fire[tile] > 0) return false;
  const id = state.buildingId[tile];
  if (id !== -1) return state.buildings.get(id)?.kind !== 'townHall';
  return state.zone[tile] !== Zone.None && state.level[tile] > 0;
}

/** Starts a fire on a flammable tile. Returns false when nothing there can burn. */
export function ignite(state: SimState, fields: Fields, tile: number): boolean {
  if (!flammable(state, tile)) return false;
  state.fire[tile] = fields.coverage.fire[tile] ? 3 : 10;
  state.rev.fire++;
  return true;
}

/** Each month, with the difficulty's chance, a fire starts on a random tile that can burn. */
export function monthlyFire(
  state: SimState,
  fields: Fields,
  rng: Rng,
  settings: DifficultySettings,
): number | undefined {
  if (!rng.chance(settings.fireChance)) return undefined;
  const candidates: number[] = [];
  for (let tile = 0; tile < TILE_COUNT; tile++) if (flammable(state, tile)) candidates.push(tile);
  const tile = candidates[rng.int(candidates.length)];
  if (tile !== undefined) ignite(state, fields, tile);
  return tile;
}

/** One day of burning: spread to neighbours and count down. Returns the tiles that burnt out. */
export function stepFire(state: SimState, fields: Fields, rng: Rng): number[] {
  const burnt: number[] = [];
  const spreading: number[] = [];
  for (let tile = 0; tile < TILE_COUNT; tile++) if (state.fire[tile] > 0) spreading.push(tile);
  for (const tile of spreading) {
    const x = xOf(tile);
    const y = yOf(tile);
    for (const [dx, dy] of DIRS4) {
      if (!inBounds(x + dx, y + dy)) continue;
      const next = idx(x + dx, y + dy);
      if (flammable(state, next) && rng.chance(fields.coverage.fire[next] ? 0.05 : 0.2)) {
        ignite(state, fields, next);
      }
    }
  }
  for (const tile of spreading) {
    state.fire[tile]--;
    if (state.fire[tile] === 0) burnt.push(tile);
  }
  if (spreading.length > 0) state.rev.fire++;
  return burnt;
}
