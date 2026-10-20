import { idx, inBounds } from '../sim/grid';

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
