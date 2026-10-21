import * as THREE from 'three';
import { BUILDINGS, type BuildingKind } from '../sim/catalogue';
import { MAP_SIZE, idx, inBounds } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { Zone } from '../sim/types';
import { tileHash } from './hash';
import type { Layer } from './layer';
import { MODEL_KEYS, type Model, type ModelKey, type Role, buildModels } from './models';
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
const CAPACITY: Partial<Record<ModelKey, number>> = { tree: 1024, turbineBlades: 384 };
const WINDOW_CAPACITY = 24000;
const TURBINE_HUB_Y = 1.71;

/** One instanced mesh per model part, so a lot levelling up costs one matrix write, not a rebuild. */
export class BuildingLayer implements Layer {
  readonly object = new THREE.Group();
  private readonly models = buildModels();
  private readonly meshes = new Map<ModelKey, Map<Role, THREE.InstancedMesh>>();
  private readonly counts = new Map<ModelKey, number>();
  private readonly windows: THREE.InstancedMesh;
  private readonly windowMaterial: THREE.MeshStandardMaterial;
  private windowCount = 0;
  private readonly turbines: THREE.Matrix4[] = [];
  private spin = 0;
  private rev = -1;
  private palette: Palette | undefined;
  private readonly m = new THREE.Matrix4();
  private readonly m2 = new THREE.Matrix4();
  private readonly color = new THREE.Color();

  constructor() {
    for (const key of MODEL_KEYS) {
      const model = this.models[key];
      const capacity = CAPACITY[key] ?? (model.size === 2 ? 256 : 2048);
      const parts = new Map<Role, THREE.InstancedMesh>();
      for (const [role, geometry] of model.parts) {
        const mesh = new THREE.InstancedMesh(
          geometry,
          new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85 }),
          capacity,
        );
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
        this.place(key, x, y, 1, this.facing(state, x, y, 1), tileHash(x, y, 3), palette);
      }
    }
    for (const b of state.buildings.values()) {
      const size = BUILDINGS[b.kind].size;
      const key = SERVICE_MODELS[b.kind];
      const yaw = this.facing(state, b.x, b.y, size);
      this.place(key, b.x, b.y, size, yaw, tileHash(b.x, b.y, 5), palette);
      if (b.kind === 'windTurbine') {
        this.turbines.push(this.m.clone());
      }
    }
    for (const [key, parts] of this.meshes) {
      const count = this.counts.get(key) ?? 0;
      for (const mesh of parts.values()) upload(mesh, count);
    }
    upload(this.windows, this.windowCount);
    this.animate(0);
    return true;
  }

  animate(dt: number): void {
    this.spin += dt * 1.6;
    const blades = this.meshes.get('turbineBlades');
    if (!blades) return;
    this.turbines.forEach((base, i) => {
      // The hub sits at the top of the mast, in front of the nacelle, facing +z in model space.
      for (let k = 0; k < 3; k++) {
        this.m2.makeRotationZ(this.spin + i * 0.7 + (k * 2 * Math.PI) / 3);
        this.m.makeTranslation(0.5, TURBINE_HUB_Y, 0.64).multiply(this.m2);
        this.m.premultiply(base);
        for (const mesh of blades.values()) mesh.setMatrixAt(i * 3 + k, this.m);
      }
    });
    for (const mesh of blades.values()) upload(mesh, this.turbines.length * 3);
  }

  /** Yaw so the model's +z front faces an adjacent road, else a stable hashed direction. */
  private facing(state: SimState, x: number, y: number, size: number): number {
    const dirs: [number, number][] = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    const start = Math.floor(tileHash(x, y, 11) * 4);
    for (let k = 0; k < 4; k++) {
      const [dx, dy] = dirs[(start + k) % 4] ?? [0, 1];
      for (let i = 0; i < size; i++) {
        const nx = dx === 0 ? x + i : dx > 0 ? x + size : x - 1;
        const ny = dy === 0 ? y + i : dy > 0 ? y + size : y - 1;
        if (inBounds(nx, ny) && state.road[idx(nx, ny)] === 1) return Math.atan2(dx, dy);
      }
    }
    const [dx, dy] = dirs[start] ?? [0, 1];
    return Math.atan2(dx, dy);
  }

  /** Writes one instance of `key` at tile (x, y), leaving its matrix in `this.m`. */
  private place(
    key: ModelKey,
    x: number,
    y: number,
    size: number,
    yaw: number,
    variant: number,
    palette: Palette,
  ): void {
    const model: Model = this.models[key];
    const parts = this.meshes.get(key);
    if (!parts) return;
    const i = this.counts.get(key) ?? 0;
    this.counts.set(key, i + 1);
    const half = size / 2;
    this.m.makeTranslation(x + half, 0, y + half);
    this.m2.makeRotationY(yaw);
    this.m.multiply(this.m2);
    this.m2.makeTranslation(-half, 0, -half);
    this.m.multiply(this.m2);
    const v = Math.floor(variant * 4);
    for (const [role, mesh] of parts) {
      if (i >= mesh.instanceMatrix.count) return;
      mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, this.color.set(roleColor(role, palette, v)));
    }
    for (const w of model.windows) {
      if (this.windowCount >= WINDOW_CAPACITY) break;
      this.m2.makeRotationY(Math.atan2(w.nx, w.nz));
      this.m2.setPosition(w.x + w.nx * 0.006, w.y, w.z + w.nz * 0.006);
      this.m2.premultiply(this.m);
      this.windows.setMatrixAt(this.windowCount++, this.m2);
    }
  }
}

function roleColor(role: Role, palette: Palette, variant: number): string {
  switch (role) {
    case 'wall':
      return palette.walls[variant % 4] ?? palette.trim;
    case 'roof':
      return palette.roofs[variant % 4] ?? palette.accent;
    case 'trim':
      return palette.trim;
    case 'foliage':
      return variant % 2 ? palette.foliageAlt : palette.foliage;
    case 'trunk':
      return palette.trunk;
    case 'dark':
      return palette.road;
    case 'accent':
      return palette.accent;
    case 'glass':
      return palette.night;
  }
}

function upload(mesh: THREE.InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.instanceMatrix.clearUpdateRanges();
  mesh.instanceMatrix.addUpdateRange(0, count * 16);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.clearUpdateRanges();
    mesh.instanceColor.addUpdateRange(0, count * 3);
    mesh.instanceColor.needsUpdate = true;
  }
}
