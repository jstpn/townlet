import { BUILDINGS, SERVICES, type Service } from './catalogue';
import { MAP_SIZE, TILE_COUNT, idx, rectTiles } from './grid';
import type { SimState } from './sim';
import { Zone } from './types';

export type Coverage = Record<Service, Uint8Array>;

/** Marks every tile within Chebyshev `radius` of the rectangle. */
function stamp(
  grid: Uint8Array | Float32Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  value: (d: number) => number,
): void {
  for (const tile of rectTiles(x0 - radius, y0 - radius, x1 + radius, y1 + radius)) {
    const x = tile % MAP_SIZE;
    const y = Math.floor(tile / MAP_SIZE);
    const d = Math.max(0, x0 - x, x - x1, y0 - y, y - y1);
    const v = value(d);
    if (v > grid[tile]) grid[tile] = v;
  }
}

/** One boolean grid per service kind, from every building's radius. */
export function computeCoverage(state: SimState): Coverage {
  const coverage = Object.fromEntries(
    SERVICES.map((s) => [s, new Uint8Array(TILE_COUNT)]),
  ) as Coverage;
  for (const b of state.buildings.values()) {
    const def = BUILDINGS[b.kind];
    for (const service of def.services) {
      stamp(coverage[service], b.x, b.y, b.x + def.size - 1, b.y + def.size - 1, def.radius, () => 1);
    }
  }
  return coverage;
}

/** Tiles within two of a road, where zoned lots may develop. */
export function computeRoadAccess(state: SimState): Uint8Array {
  const access = new Uint8Array(TILE_COUNT);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      if (state.road[idx(x, y)] === 1) stamp(access, x, y, x, y, 2, () => 1);
    }
  }
  return access;
}

/** Industrial smoke: 1 at a developed lot, fading linearly to 0 at radius 3 + level, max over emitters. */
export function computePollution(state: SimState): Float32Array {
  const field = new Float32Array(TILE_COUNT);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = idx(x, y);
      const level = state.level[tile];
      if (state.zone[tile] !== Zone.Industrial || level === 0) continue;
      const radius = 3 + level;
      stamp(field, x, y, x, y, radius, (d) => 1 - d / radius);
    }
  }
  return field;
}
