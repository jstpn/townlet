import * as THREE from 'three';
import { BUILDINGS, type BuildingKind } from '../sim/catalogue';
import { MAP_SIZE, idx } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { Zone } from '../sim/types';
import { GeometryBuilder } from './geometryBuilder';
import { tileHash } from './hash';
import type { Layer } from './layer';
import type { Palette } from './palette';

const INSET = 0.12;

/** Placeholder masses for services and developed lots. Real silhouettes arrive with the building pass. */
export class BuildingLayer implements Layer {
  readonly object: THREE.Mesh;
  private rev = -1;
  private palette: Palette | undefined;

  constructor() {
    this.object = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }),
    );
    this.object.castShadow = true;
    this.object.receiveShadow = true;
  }

  sync(state: SimState, palette: Palette): boolean {
    const rev = state.rev.buildings + state.rev.zones;
    if (rev === this.rev && palette === this.palette) return false;
    this.rev = rev;
    this.palette = palette;
    this.object.geometry.dispose();
    this.object.geometry = buildGeometry(state, palette);
    return true;
  }
}

const SERVICE_HEIGHT: Record<BuildingKind, number> = {
  townHall: 1.6,
  windTurbine: 2.4,
  waterTower: 1.8,
  park: 0.1,
  school: 0.9,
  clinic: 1.0,
  fireStation: 0.9,
  policeStation: 0.9,
  tree: 0.6,
  plaza: 0.06,
};

function buildGeometry(state: SimState, palette: Palette): THREE.BufferGeometry {
  const builder = new GeometryBuilder();
  const walls = palette.walls.map((hex) => new THREE.Color(hex));
  const roofs = palette.roofs.map((hex) => new THREE.Color(hex));
  const trim = new THREE.Color(palette.trim);
  const foliage = new THREE.Color(palette.foliage);
  const zoneTint = palette.zones.map((hex) => new THREE.Color(hex));

  for (const building of state.buildings.values()) {
    const def = BUILDINGS[building.kind];
    const x0 = building.x + INSET;
    const y0 = building.y + INSET;
    const x1 = building.x + def.size - INSET;
    const y1 = building.y + def.size - INSET;
    const h = SERVICE_HEIGHT[building.kind];
    const color =
      building.kind === 'park' || building.kind === 'tree'
        ? foliage
        : building.kind === 'plaza'
          ? trim
          : walls[building.id % walls.length];
    builder.box(x0, 0, y0, x1, h, y1, color ?? trim);
    if (h > 0.5) builder.box(x0, h, y0, x1, h + 0.12, y1, roofs[building.id % roofs.length] ?? trim);
  }

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = idx(x, y);
      const zone = state.zone[tile];
      const level = state.level[tile];
      if (zone === Zone.None || level === 0) continue;
      const variant = tileHash(x, y, 7) % walls.length;
      const h = zone === Zone.Industrial ? 0.5 + level * 0.2 : 0.4 + level * 0.35;
      const wall = zone === Zone.Industrial ? zoneTint[2] : walls[variant];
      builder.box(x + INSET, 0, y + INSET, x + 1 - INSET, h, y + 1 - INSET, wall ?? trim);
      builder.box(x + INSET, h, y + INSET, x + 1 - INSET, h + 0.1, y + 1 - INSET, roofs[variant] ?? trim);
    }
  }
  return builder.build();
}
