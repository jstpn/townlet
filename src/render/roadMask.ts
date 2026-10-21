import { idx, inBounds } from '../sim/grid';
import { STEP_Y, groundY } from './ground';

export const ROAD_N = 1;
export const ROAD_E = 2;
export const ROAD_S = 4;
export const ROAD_W = 8;

const SIDES: readonly (readonly [number, number, number])[] = [
  [0, -1, ROAD_N],
  [1, 0, ROAD_E],
  [0, 1, ROAD_S],
  [-1, 0, ROAD_W],
];

/** Bit set of the orthogonal neighbours that also carry road, for picking a road tile's shape. */
export function roadConnections(road: Uint8Array, x: number, y: number): number {
  if (!inBounds(x, y) || road[idx(x, y)] === 0) return 0;
  let mask = 0;
  for (const [dx, dy, bit] of SIDES) {
    if (inBounds(x + dx, y + dy) && road[idx(x + dx, y + dy)] === 1) mask |= bit;
  }
  return mask;
}

/**
 * The side a road tile slopes up toward, or 0 when it lies flat: a tile ramps when it joins
 * exactly one higher neighbour and nothing else but the tile straight behind it.
 */
export function rampDirection(road: Uint8Array, height: Uint8Array, x: number, y: number): number {
  const mask = roadConnections(road, x, y);
  const h = height[idx(x, y)];
  let up = 0;
  for (const [dx, dy, bit] of SIDES) {
    if (mask & bit && height[idx(x + dx, y + dy)] === h + 1) up = up === 0 ? bit : -1;
  }
  if (up <= 0) return 0;
  const opposite = up << 2 > ROAD_W ? up >> 2 : up << 2;
  return (mask & ~(up | opposite)) === 0 ? up : 0;
}

/** How far up a ramp a tile-relative point sits: 0 at the low edge, 1 at the high edge. */
export function rampRise(up: number, fx: number, fz: number): number {
  return up === ROAD_N ? 1 - fz : up === ROAD_S ? fz : up === ROAD_E ? fx : 1 - fx;
}

/** Height of the road surface under a world point, following ramps; the terrace height elsewhere. */
export function roadY(road: Uint8Array, height: Uint8Array, px: number, pz: number): number {
  const x = Math.floor(px);
  const z = Math.floor(pz);
  if (!inBounds(x, z)) return 0;
  const base = groundY(height, idx(x, z));
  const up = rampDirection(road, height, x, z);
  return up === 0 ? base : base + rampRise(up, px - x, pz - z) * STEP_Y;
}
