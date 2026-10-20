import * as THREE from 'three';
import { MAP_SIZE, idx } from '../sim/grid';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, roadConnections } from '../sim/roads';
import { GeometryBuilder } from './geometryBuilder';
import type { Palette } from './palette';

const KERB_H = 0.035;
const ROAD_H = 0.055;
const INSET = 0.14;

/** Roads as one merged mesh: a pale kerb slab per tile with the darker surface shaped by its connections. */
export class RoadLayer {
  readonly mesh: THREE.Mesh;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
    );
    this.mesh.receiveShadow = true;
  }

  rebuild(road: Uint8Array, palette: Palette): void {
    const builder = new GeometryBuilder();
    const kerb = new THREE.Color(palette.roadLine).getHex();
    const surface = new THREE.Color(palette.road).getHex();
    const v = (x: number, y: number, z: number): THREE.Vector3Like => ({ x, y, z });

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (road[idx(x, y)] === 0) continue;
        const mask = roadConnections(road, x, y);
        builder.box(v(x, 0, y), v(x + 1, KERB_H, y + 1), kerb);
        const x0 = x + INSET;
        const x1 = x + 1 - INSET;
        const y0 = y + INSET;
        const y1 = y + 1 - INSET;
        builder.box(v(x0, 0, y0), v(x1, ROAD_H, y1), surface);
        if (mask & ROAD_N) builder.box(v(x0, 0, y), v(x1, ROAD_H, y0), surface);
        if (mask & ROAD_S) builder.box(v(x0, 0, y1), v(x1, ROAD_H, y + 1), surface);
        if (mask & ROAD_W) builder.box(v(x, 0, y0), v(x0, ROAD_H, y1), surface);
        if (mask & ROAD_E) builder.box(v(x1, 0, y0), v(x + 1, ROAD_H, y1), surface);
      }
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = builder.build();
  }
}
