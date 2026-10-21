import * as THREE from 'three';
import { MAP_SIZE, idx } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { Zone } from '../sim/types';
import { GeometryBuilder } from './geometryBuilder';
import { groundY } from './ground';
import type { Layer } from './layer';
import type { Palette } from './palette';

const LOT_Y = 0.02;
const INSET = 0.08;

/** Flat tinted lots on zoned tiles that have not developed yet. */
export class ZoneLayer implements Layer {
  readonly object: THREE.Mesh;
  private rev = -1;
  private palette: Palette | undefined;

  constructor() {
    this.object = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    this.object.receiveShadow = true;
  }

  sync(state: SimState, palette: Palette): boolean {
    if (state.rev.zones === this.rev && palette === this.palette) return false;
    this.rev = state.rev.zones;
    this.palette = palette;
    this.object.geometry.dispose();
    this.object.geometry = buildZoneGeometry(state, palette);
    return true;
  }
}

function buildZoneGeometry(state: SimState, palette: Palette): THREE.BufferGeometry {
  const builder = new GeometryBuilder();
  const colors = palette.zones.map((hex) => new THREE.Color(hex));
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = idx(x, y);
      const zone = state.zone[tile];
      if (zone === Zone.None || state.level[tile] > 0) continue;
      const color = colors[zone - 1];
      if (!color) continue;
      const base = groundY(state.height, tile) + LOT_Y;
      builder.floor(x + INSET, y + INSET, x + 1 - INSET, y + 1 - INSET, base, color);
    }
  }
  return builder.build();
}
