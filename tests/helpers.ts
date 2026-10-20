import { TILE_COUNT } from '../src/sim/grid';
import type { Terrain } from '../src/sim/types';

/** A uniform map for command tests. */
export function flatTerrain(kind: Terrain): Uint8Array {
  return new Uint8Array(TILE_COUNT).fill(kind);
}
