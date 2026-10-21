import * as THREE from 'three';
import { MAP_SIZE, idx } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { GeometryBuilder } from './geometryBuilder';
import { STEP_Y, groundY } from './ground';
import type { Layer } from './layer';
import type { Palette } from './palette';
import {
  ROAD_E,
  ROAD_N,
  ROAD_S,
  ROAD_W,
  rampDirection,
  rampRise,
  roadConnections,
} from './roadMask';

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
    this.object.geometry = buildRoadGeometry(state.road, state.height, palette);
    return true;
  }
}

function buildRoadGeometry(
  road: Uint8Array,
  height: Uint8Array,
  palette: Palette,
): THREE.BufferGeometry {
  const builder = new GeometryBuilder();
  const kerb = new THREE.Color(palette.roadLine);
  const surface = new THREE.Color(palette.road);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = idx(x, y);
      if (road[tile] === 0) continue;
      const base = groundY(height, tile);
      const x0 = x + INSET;
      const x1 = x + 1 - INSET;
      const y0 = y + INSET;
      const y1 = y + 1 - INSET;
      const up = rampDirection(road, height, x, y);
      if (up !== 0) {
        // A straight slope up to the next terrace, full width, with the surface inset on the sides only.
        const rise = (px: number, pz: number): number =>
          base + rampRise(up, px - x, pz - y) * STEP_Y;
        slab(builder, x, y, x + 1, y + 1, rise, KERB_H, kerb);
        if (up === ROAD_N || up === ROAD_S) slab(builder, x0, y, x1, y + 1, rise, ROAD_H, surface);
        else slab(builder, x, y0, x + 1, y1, rise, ROAD_H, surface);
        continue;
      }
      const mask = roadConnections(road, x, y);
      builder.box(x, base, y, x + 1, base + KERB_H, y + 1, kerb);
      builder.box(x0, base, y0, x1, base + ROAD_H, y1, surface);
      if (mask & ROAD_N) builder.box(x0, base, y, x1, base + ROAD_H, y0, surface);
      if (mask & ROAD_S) builder.box(x0, base, y1, x1, base + ROAD_H, y + 1, surface);
      if (mask & ROAD_W) builder.box(x, base, y0, x0, base + ROAD_H, y1, surface);
      if (mask & ROAD_E) builder.box(x1, base, y0, x + 1, base + ROAD_H, y1, surface);
    }
  }
  return builder.build();
}

/** A slab of the given thickness whose underside follows `floor`, with its four sides closed. */
function slab(
  g: GeometryBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  floor: (px: number, pz: number) => number,
  thickness: number,
  color: THREE.Color,
): void {
  const corners: [number, number][] = [
    [x0, z0],
    [x0, z1],
    [x1, z1],
    [x1, z0],
  ];
  const top = corners.map(([px, pz]) => floor(px, pz) + thickness);
  g.tri(x0, top[0], z0, x0, top[1], z1, x1, top[2], z1, color);
  g.tri(x0, top[0], z0, x1, top[2], z1, x1, top[3], z0, color);
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[(i + 1) % 4];
    const [bx, bz] = corners[i];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (bz - az) / len;
    const nz = -(bx - ax) / len;
    const ya = floor(ax, az);
    const yb = floor(bx, bz);
    g.quad(
      ax,
      ya,
      az,
      ax,
      ya + thickness,
      az,
      bx,
      yb + thickness,
      bz,
      bx,
      yb,
      bz,
      nx,
      0,
      nz,
      color,
    );
  }
}
