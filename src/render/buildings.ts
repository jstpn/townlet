import * as THREE from 'three';
import { BUILDINGS, type BuildingKind } from '../sim/catalogue';
import { MAP_SIZE, idx, inBounds } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { Zone } from '../sim/types';
import { tileHash } from './hash';
import { uploadInstances } from './instanced';
import type { Layer } from './layer';
import { type ModelKey, type Role, buildModels } from './models';
import type { Palette } from './palette';

const ZONE_MODELS: Record<number, readonly [ModelKey, ModelKey, ModelKey]> = {
  [Zone.Residential]: ['res1', 'res2', 'res3'],
  [Zone.Commercial]: ['com1', 'com2', 'com3'],
  [Zone.Industrial]: ['ind1', 'ind2', 'ind3'],
};
const SERVICE_MODELS: Record<BuildingKind, ModelKey> = {
  townHall: 'townHall',
  windTurbine: 'windTurbine',
  waterTower: 'waterTower',
  park: 'park',
  school: 'school',
  clinic: 'clinic',
  fireStation: 'fireStation',
  policeStation: 'policeStation',
  tree: 'tree',
  plaza: 'plaza',
};
/** Instances per model. Lots can fill most of the map; services and decor cannot. */
const CAPACITY: Partial<Record<ModelKey, number>> = {
  res1: 2048,
  res2: 2048,
  res3: 2048,
  com1: 2048,
  com2: 2048,
  com3: 2048,
  ind1: 2048,
  ind2: 2048,
  ind3: 2048,
  tree: 1024,
  turbineBlades: 384,
};
const WINDOW_CAPACITY = 24000;
const TURBINE_HUB_Y = 1.71;
/** A clockwise ring, so the hashed start walks round the building looking for a road. */
const FACING_DIRS: readonly [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

/** The palette's role colours, parsed once per palette instead of once per instance. */
type RoleColors = Record<Exclude<Role, 'wall' | 'roof' | 'foliage'>, THREE.Color> & {
  wall: THREE.Color[];
  roof: THREE.Color[];
  foliage: [THREE.Color, THREE.Color];
};

/** One instanced mesh per model part, so a lot levelling up costs one matrix write, not a rebuild. */
export class BuildingLayer implements Layer {
  readonly object = new THREE.Group();
  private readonly models = buildModels();
  private readonly meshes = new Map<ModelKey, Map<Role, THREE.InstancedMesh>>();
  private readonly capacity = new Map<ModelKey, number>();
  private readonly counts = new Map<ModelKey, number>();
  private colors: RoleColors | undefined;
  private readonly windows: THREE.InstancedMesh;
  private readonly windowMaterial: THREE.MeshStandardMaterial;
  private windowCount = 0;
  private readonly turbines: THREE.Matrix4[] = [];
  private spin = 0;
  private rev = -1;
  private palette: Palette | undefined;
  private readonly m = new THREE.Matrix4();
  private readonly m2 = new THREE.Matrix4();

  constructor() {
    const material = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85 });
    for (const key of Object.keys(this.models) as ModelKey[]) {
      const model = this.models[key];
      const capacity = CAPACITY[key] ?? (model.size === 2 ? 256 : 512);
      this.capacity.set(key, capacity);
      const parts = new Map<Role, THREE.InstancedMesh>();
      for (const [role, geometry] of model.parts) {
        const mesh = new THREE.InstancedMesh(geometry, material, capacity);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.count = 0;
        mesh.frustumCulled = false;
        parts.set(role, mesh);
        this.object.add(mesh);
      }
      this.meshes.set(key, parts);
    }
    this.windowMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.3,
      emissiveIntensity: 0,
    });
    this.windows = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.12, 0.15),
      this.windowMaterial,
      WINDOW_CAPACITY,
    );
    this.windows.count = 0;
    this.windows.frustumCulled = false;
    this.object.add(this.windows);
  }

  /** 0 by day, 1 at night: windows glow. */
  setNight(t: number): void {
    this.windowMaterial.emissiveIntensity = t;
  }

  sync(state: SimState, palette: Palette): boolean {
    // Revisions only grow, so their sum is a change key.
    const rev = state.rev.buildings + state.rev.zones;
    if (rev === this.rev && palette === this.palette) return false;
    this.rev = rev;
    if (palette !== this.palette) this.colors = roleColors(palette);
    this.palette = palette;
    this.windowMaterial.color.set(palette.night);
    this.windowMaterial.emissive.set(palette.windowGlow);
    this.counts.clear();
    this.windowCount = 0;
    this.turbines.length = 0;

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = idx(x, y);
        const level = state.level[tile];
        const models = ZONE_MODELS[state.zone[tile]];
        if (!models || level === 0) continue;
        const key = models[level - 1] ?? models[0];
        this.place(key, x, y, 1, this.facing(state, x, y, 1), tileHash(x, y, 3));
      }
    }
    for (const b of state.buildings.values()) {
      const size = BUILDINGS[b.kind].size;
      const key = SERVICE_MODELS[b.kind];
      const yaw = this.facing(state, b.x, b.y, size);
      const placed = this.place(key, b.x, b.y, size, yaw, tileHash(b.x, b.y, 5));
      if (placed && b.kind === 'windTurbine') this.turbines.push(this.m.clone());
    }
    for (const [key, parts] of this.meshes) {
      const count = this.counts.get(key) ?? 0;
      for (const mesh of parts.values()) uploadInstances(mesh, count);
    }
    uploadInstances(this.windows, this.windowCount);
    this.animate(0);
    return true;
  }

  animate(dt: number): void {
    this.spin += dt * 1.6;
    const blades = this.meshes.get('turbineBlades');
    if (!blades || this.turbines.length === 0) return;
    this.turbines.forEach((base, i) => {
      // The hub sits at the top of the mast, in front of the nacelle, facing +z in model space.
      for (let k = 0; k < 3; k++) {
        this.m2.makeRotationZ(this.spin + i * 0.7 + (k * 2 * Math.PI) / 3);
        this.m.makeTranslation(0.5, TURBINE_HUB_Y, 0.64).multiply(this.m2);
        this.m.premultiply(base);
        for (const mesh of blades.values()) mesh.setMatrixAt(i * 3 + k, this.m);
      }
    });
    for (const mesh of blades.values()) uploadInstances(mesh, this.turbines.length * 3);
  }

  /** Yaw so the model's +z front faces an adjacent road, else a stable hashed direction. */
  private facing(state: SimState, x: number, y: number, size: number): number {
    const start = Math.floor(tileHash(x, y, 11) * 4);
    for (let k = 0; k < 4; k++) {
      const [dx, dy] = FACING_DIRS[(start + k) % 4] ?? [0, 1];
      for (let i = 0; i < size; i++) {
        const nx = dx === 0 ? x + i : dx > 0 ? x + size : x - 1;
        const ny = dy === 0 ? y + i : dy > 0 ? y + size : y - 1;
        if (inBounds(nx, ny) && state.road[idx(nx, ny)] === 1) return Math.atan2(dx, dy);
      }
    }
    const [dx, dy] = FACING_DIRS[start] ?? [0, 1];
    return Math.atan2(dx, dy);
  }

  /** Writes one instance of `key` at tile (x, y), leaving its matrix in `this.m`. False when full. */
  private place(
    key: ModelKey,
    x: number,
    y: number,
    size: number,
    yaw: number,
    variant: number,
  ): boolean {
    const model = this.models[key];
    const parts = this.meshes.get(key);
    const i = this.counts.get(key) ?? 0;
    if (!parts || !this.colors || i >= (this.capacity.get(key) ?? 0)) return false;
    this.counts.set(key, i + 1);
    const half = size / 2;
    this.m.makeTranslation(x + half, 0, y + half);
    this.m2.makeRotationY(yaw);
    this.m.multiply(this.m2);
    this.m2.makeTranslation(-half, 0, -half);
    this.m.multiply(this.m2);
    const v = Math.floor(variant * 4);
    for (const [role, mesh] of parts) {
      mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, roleColor(this.colors, role, v));
    }
    for (const w of model.windows) {
      if (this.windowCount >= WINDOW_CAPACITY) break;
      this.m2.makeRotationY(Math.atan2(w.nx, w.nz));
      this.m2.setPosition(w.x + w.nx * 0.006, w.y, w.z + w.nz * 0.006);
      this.m2.premultiply(this.m);
      this.windows.setMatrixAt(this.windowCount++, this.m2);
    }
    return true;
  }
}

function roleColors(palette: Palette): RoleColors {
  const c = (hex: string): THREE.Color => new THREE.Color(hex);
  return {
    wall: palette.walls.map(c),
    roof: palette.roofs.map(c),
    foliage: [c(palette.foliage), c(palette.foliageAlt)],
    trim: c(palette.trim),
    trunk: c(palette.trunk),
    dark: c(palette.road),
    accent: c(palette.accent),
  };
}

/** `variant` is 0 to 3 and picks among the wall and roof shades. */
function roleColor(colors: RoleColors, role: Role, variant: number): THREE.Color {
  switch (role) {
    case 'wall':
      return colors.wall[variant] ?? colors.trim;
    case 'roof':
      return colors.roof[variant] ?? colors.accent;
    case 'foliage':
      return colors.foliage[variant % 2] ?? colors.trim;
    default:
      return colors[role];
  }
}
