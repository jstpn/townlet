import * as THREE from 'three';
import { MAP_SIZE, idx } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { GeometryBuilder } from './geometryBuilder';
import type { Layer } from './layer';
import type { Palette } from './palette';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, roadConnections } from './roadMask';

const KERB_H = 0.035;
const ROAD_H = 0.055;
const INSET = 0.14;

/** Roads as one merged mesh: a pale kerb slab per tile with the darker surface shaped by its connections. */
export class RoadLayer implements Layer {
  readonly object: THREE.Mesh;
  private rev = -1;
  private palette: Palette | undefined;

  constructor() {
    this.object = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
    );
    this.object.receiveShadow = true;
  }

  sync(state: SimState, palette: Palette): boolean {
    if (state.rev.roads === this.rev && palette === this.palette) return false;
    this.rev = state.rev.roads;
    this.palette = palette;
    this.object.geometry.dispose();
    this.object.geometry = buildRoadGeometry(state.road, palette);
    return true;
  }
}

function buildRoadGeometry(road: Uint8Array, palette: Palette): THREE.BufferGeometry {
  const builder = new GeometryBuilder();
  const kerb = new THREE.Color(palette.roadLine);
  const surface = new THREE.Color(palette.road);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      if (road[idx(x, y)] === 0) continue;
      const mask = roadConnections(road, x, y);
      builder.box(x, 0, y, x + 1, KERB_H, y + 1, kerb);
      const x0 = x + INSET;
      const x1 = x + 1 - INSET;
      const y0 = y + INSET;
      const y1 = y + 1 - INSET;
      builder.box(x0, 0, y0, x1, ROAD_H, y1, surface);
      if (mask & ROAD_N) builder.box(x0, 0, y, x1, ROAD_H, y0, surface);
      if (mask & ROAD_S) builder.box(x0, 0, y1, x1, ROAD_H, y + 1, surface);
      if (mask & ROAD_W) builder.box(x, 0, y0, x0, ROAD_H, y1, surface);
      if (mask & ROAD_E) builder.box(x1, 0, y0, x + 1, ROAD_H, y1, surface);
    }
  }
  return builder.build();
}
