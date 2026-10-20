import * as THREE from 'three';
import { DIRS4, MAP_SIZE, TILE_COUNT, idx, inBounds } from '../sim/grid';
import { Terrain } from '../sim/types';
import { GeometryBuilder } from './geometryBuilder';
import { tileHash } from './hash';
import type { Palette } from './palette';

export const SEA_BED_Y = -0.45;
export const WATER_Y = -0.14;

/** Distance in tiles from the nearest land, for water tiles; 0 on land. */
function waterDepthField(terrain: Uint8Array): Uint8Array {
  const depth = new Uint8Array(TILE_COUNT).fill(255);
  const queue: number[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    if (terrain[i] !== Terrain.Water) {
      depth[i] = 0;
      queue.push(i);
    }
  }
  // Pushing while iterating is deliberate: the array is the BFS queue.
  for (const tile of queue) {
    const x = tile % MAP_SIZE;
    const y = (tile - x) / MAP_SIZE;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const next = idx(nx, ny);
      if (depth[next] !== 255) continue;
      depth[next] = (depth[tile] ?? 0) + 1;
      queue.push(next);
    }
  }
  return depth;
}

const v = (x: number, y: number, z: number): THREE.Vector3Like => ({ x, y, z });

export function buildTerrainGeometry(terrain: Uint8Array, palette: Palette): THREE.BufferGeometry {
  const builder = new GeometryBuilder();
  const depth = waterDepthField(terrain);
  const grass = new THREE.Color(palette.grass);
  const grassAlt = new THREE.Color(palette.grassAlt);
  const sand = new THREE.Color(palette.sand);
  const sandSide = sand.clone().multiplyScalar(0.82);
  const shallow = new THREE.Color(palette.waterShallow);
  const deep = new THREE.Color(palette.waterDeep).multiplyScalar(0.8);
  const bed = new THREE.Color();

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = idx(x, y);
      const kind = terrain[tile];
      if (kind === Terrain.Water) {
        const t = Math.min(1, Math.max(0, ((depth[tile] ?? 0) - 1) / 2.5));
        bed.copy(shallow).lerp(deep, t);
        builder.quad(
          v(x, SEA_BED_Y, y),
          v(x, SEA_BED_Y, y + 1),
          v(x + 1, SEA_BED_Y, y + 1),
          v(x + 1, SEA_BED_Y, y),
          bed.getHex(),
        );
        continue;
      }
      const top =
        kind === Terrain.Sand
          ? sand
          : tileHash(x, y, 7) < 0.5 || kind === Terrain.Forest
            ? grassAlt
            : grass;
      builder.quad(v(x, 0, y), v(x, 0, y + 1), v(x + 1, 0, y + 1), v(x + 1, 0, y), top.getHex());
      // Skirts: a small step down into the water on every shore-facing side.
      if (x === 0 || terrain[idx(x - 1, y)] === Terrain.Water) {
        builder.quad(
          v(x, SEA_BED_Y, y + 1),
          v(x, 0, y + 1),
          v(x, 0, y),
          v(x, SEA_BED_Y, y),
          sandSide.getHex(),
        );
      }
      if (x === MAP_SIZE - 1 || terrain[idx(x + 1, y)] === Terrain.Water) {
        builder.quad(
          v(x + 1, SEA_BED_Y, y),
          v(x + 1, 0, y),
          v(x + 1, 0, y + 1),
          v(x + 1, SEA_BED_Y, y + 1),
          sandSide.getHex(),
        );
      }
      if (y === 0 || terrain[idx(x, y - 1)] === Terrain.Water) {
        builder.quad(
          v(x, SEA_BED_Y, y),
          v(x, 0, y),
          v(x + 1, 0, y),
          v(x + 1, SEA_BED_Y, y),
          sandSide.getHex(),
        );
      }
      if (y === MAP_SIZE - 1 || terrain[idx(x, y + 1)] === Terrain.Water) {
        builder.quad(
          v(x + 1, SEA_BED_Y, y + 1),
          v(x + 1, 0, y + 1),
          v(x, 0, y + 1),
          v(x, SEA_BED_Y, y + 1),
          sandSide.getHex(),
        );
      }
    }
  }
  return builder.build();
}

export function createTerrainMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
}
