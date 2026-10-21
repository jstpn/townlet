import * as THREE from 'three';
import { DIRS4, MAP_SIZE, distanceField, idx, inBounds } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { Terrain } from '../sim/types';
import { GeometryBuilder } from './geometryBuilder';
import { groundY } from './ground';
import { tileHash } from './hash';
import type { Layer } from './layer';
import type { Palette } from './palette';
import { TreeLayer } from './trees';

export const SEA_BED_Y = -0.45;
export const WATER_Y = -0.14;

const depthCache = new WeakMap<Uint8Array, Uint16Array>();

/** Tiles from the nearest shore, for every tile. Water never changes after generation, so it is computed once per town. */
export function waterDepth(terrain: Uint8Array): Uint16Array {
  let depth = depthCache.get(terrain);
  if (!depth) {
    depth = distanceField((tile) => terrain[tile] !== Terrain.Water);
    depthCache.set(terrain, depth);
  }
  return depth;
}

/** Ground as flat terraces with cliff sides, and trees. Rebuilds when the terrain revision or the palette changes. */
export class TerrainLayer implements Layer {
  readonly object = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly trees = new TreeLayer();
  private rev = -1;
  private palette: Palette | undefined;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    );
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.object.add(this.mesh, this.trees.object);
  }

  sync(state: SimState, palette: Palette): boolean {
    if (state.rev.terrain === this.rev && palette === this.palette) return false;
    this.rev = state.rev.terrain;
    this.palette = palette;
    this.mesh.geometry.dispose();
    this.mesh.geometry = buildTerrainGeometry(
      state.terrain,
      state.height,
      waterDepth(state.terrain),
      palette,
    );
    this.trees.rebuild(state.terrain, state.height, palette);
    return true;
  }
}

function buildTerrainGeometry(
  terrain: Uint8Array,
  height: Uint8Array,
  depth: Uint16Array,
  palette: Palette,
): THREE.BufferGeometry {
  const builder = new GeometryBuilder();
  const grass = new THREE.Color(palette.grass);
  const grassAlt = new THREE.Color(palette.grassAlt);
  const sand = new THREE.Color(palette.sand);
  const sandSide = sand.clone().multiplyScalar(0.82);
  const shallow = new THREE.Color(palette.waterShallow);
  const deep = new THREE.Color(palette.waterDeep).multiplyScalar(0.8);
  const bed = new THREE.Color();
  const wet = (x: number, y: number): boolean =>
    !inBounds(x, y) || terrain[idx(x, y)] === Terrain.Water;

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = idx(x, y);
      const kind = terrain[tile];
      if (kind === Terrain.Water) {
        const t = THREE.MathUtils.clamp((depth[tile] - 1) / 2.5, 0, 1);
        bed.copy(shallow).lerp(deep, t);
        builder.floor(x, y, x + 1, y + 1, SEA_BED_Y, bed);
        continue;
      }
      const top =
        kind === Terrain.Sand
          ? sand
          : kind === Terrain.Forest || tileHash(x, y, 7) < 0.5
            ? grassAlt
            : grass;
      const top_y = groundY(height, tile);
      builder.floor(x, y, x + 1, y + 1, top_y, top);
      // Sides: down to the sea bed on a shore, or down to the lower terrace on a cliff.
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        const bottom = wet(nx, ny) ? SEA_BED_Y : groundY(height, idx(nx, ny));
        if (bottom >= top_y) continue;
        if (dx === -1) builder.wall(x, y + 1, x, y, bottom, top_y, sandSide);
        else if (dx === 1) builder.wall(x + 1, y, x + 1, y + 1, bottom, top_y, sandSide);
        else if (dy === -1) builder.wall(x, y, x + 1, y, bottom, top_y, sandSide);
        else builder.wall(x + 1, y + 1, x, y + 1, bottom, top_y, sandSide);
      }
    }
  }
  return builder.build();
}
