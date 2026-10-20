import { idx, inBounds } from './grid';

export const ROAD_N = 1;
export const ROAD_E = 2;
export const ROAD_S = 4;
export const ROAD_W = 8;

/** Bit set of the orthogonal neighbours that also carry road. Zero off-road. */
export function roadConnections(road: Uint8Array, x: number, y: number): number {
  if (!inBounds(x, y) || road[idx(x, y)] === 0) return 0;
  let mask = 0;
  if (inBounds(x, y - 1) && road[idx(x, y - 1)] === 1) mask |= ROAD_N;
  if (inBounds(x + 1, y) && road[idx(x + 1, y)] === 1) mask |= ROAD_E;
  if (inBounds(x, y + 1) && road[idx(x, y + 1)] === 1) mask |= ROAD_S;
  if (inBounds(x - 1, y) && road[idx(x - 1, y)] === 1) mask |= ROAD_W;
  return mask;
}
