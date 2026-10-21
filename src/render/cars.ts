import * as THREE from 'three';
import { footprint } from '../sim/catalogue';
import { DIRS4, TILE_COUNT, idx, inBounds, labelRegions, roadPath, xOf, yOf } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { Zone } from '../sim/types';
import { GeometryBuilder } from './geometryBuilder';
import { uploadInstances } from './instanced';
import type { Layer } from './layer';
import type { Palette } from './palette';
import { roadY } from './roadMask';

const MAX_CARS = 150;
const RESIDENTS_PER_CAR = 4;
const SPAWNS_PER_FRAME = 2;
const LANE = 0.19;
const SPEED = 2.4;

type Car = { path: number[]; dist: number; speed: number; color: number };

/** Small cars commuting along the roads between homes and jobs, driving on the left. */
export class CarLayer implements Layer {
  readonly object: THREE.InstancedMesh;
  private cars: Car[] = [];
  /** Road tiles beside a home whose road network also reaches a job, so every route exists. */
  private homes: number[] = [];
  /** Road tiles beside a job, grouped by road network. */
  private jobsByNetwork: number[][] = [];
  private network: Int32Array = new Int32Array(0);
  private road: Uint8Array = new Uint8Array(0);
  private height: Uint8Array = new Uint8Array(0);
  private target = 0;
  private colors: THREE.Color[] = [];
  private palette: Palette | undefined;
  private rev = -1;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);

  constructor() {
    this.object = new THREE.InstancedMesh(
      carGeometry(),
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6 }),
      MAX_CARS,
    );
    this.object.count = 0;
    this.object.frustumCulled = false;
  }

  sync(state: SimState, palette: Palette): boolean {
    if (palette !== this.palette) {
      this.palette = palette;
      this.colors = [...palette.roofs, palette.accent, palette.trim].map((c) => new THREE.Color(c));
    }
    this.target = Math.min(MAX_CARS, Math.floor(state.population / RESIDENTS_PER_CAR));
    const rev = state.rev.roads + state.rev.zones + state.rev.buildings;
    if (rev === this.rev) return false;
    this.rev = rev;
    this.road = state.road;
    this.height = state.height;
    this.collectEndpoints(state);
    this.cars = this.cars.filter((car) => car.path.every((tile) => state.road[tile] === 1));
    return false;
  }

  animate(dt: number): void {
    if (this.cars.length > this.target) this.cars.length = this.target;
    for (let i = 0; i < SPAWNS_PER_FRAME && this.cars.length < this.target; i++) this.spawn();
    this.cars = this.cars.filter((car) => {
      car.dist += car.speed * dt;
      return car.dist < car.path.length - 1;
    });
    this.cars.forEach((car, i) => this.place(car, i));
    uploadInstances(this.object, this.cars.length);
  }

  private collectEndpoints(state: SimState): void {
    const home = new Uint8Array(TILE_COUNT);
    const job = new Uint8Array(TILE_COUNT);
    for (let tile = 0; tile < TILE_COUNT; tile++) {
      if (state.level[tile] === 0) continue;
      if (state.zone[tile] === Zone.Residential) home[tile] = 1;
      else job[tile] = 1;
    }
    for (const b of state.buildings.values()) for (const tile of footprint(b)) job[tile] = 1;
    const { label, sizes } = labelRegions((tile) => state.road[tile] === 1);
    this.network = label;
    this.jobsByNetwork = sizes.map(() => []);
    const homes: number[] = [];
    for (let tile = 0; tile < TILE_COUNT; tile++) {
      if (state.road[tile] === 0) continue;
      const x = xOf(tile);
      const y = yOf(tile);
      let nearHome = false;
      let nearJob = false;
      for (const [dx, dy] of DIRS4) {
        if (!inBounds(x + dx, y + dy)) continue;
        const next = idx(x + dx, y + dy);
        nearHome ||= home[next] === 1;
        nearJob ||= job[next] === 1;
      }
      if (nearHome) homes.push(tile);
      if (nearJob) this.jobsByNetwork[label[tile]]?.push(tile);
    }
    this.homes = homes.filter((tile) => this.jobsByNetwork[label[tile]]?.length);
  }

  private spawn(): void {
    if (this.homes.length === 0 || this.colors.length === 0) return;
    const from = pick(this.homes);
    const jobs = this.jobsByNetwork[this.network[from]];
    if (!jobs) return;
    const path = roadPath(this.road, from, pick(jobs));
    if (!path || path.length < 2) return;
    if (Math.random() < 0.5) path.reverse();
    const color = Math.floor(Math.random() * this.colors.length);
    this.cars.push({ path, dist: 0, speed: SPEED * (0.8 + Math.random() * 0.4), color });
  }

  private place(car: Car, index: number): void {
    const i = Math.min(car.path.length - 2, Math.floor(car.dist));
    const u = car.dist - i;
    const a = car.path[i];
    const b = car.path[i + 1];
    let dx = xOf(b) - xOf(a);
    let dz = yOf(b) - yOf(a);
    // Blend heading into the neighbouring segment near each node so the lane offset sweeps round corners.
    const blend = u < 0.25 ? car.path[i - 1] : u > 0.75 ? car.path[i + 2] : undefined;
    if (blend !== undefined) {
      const w = u < 0.25 ? 0.5 - 2 * u : 2 * u - 1.5;
      const [ox, oz] =
        u < 0.25
          ? [xOf(a) - xOf(blend), yOf(a) - yOf(blend)]
          : [xOf(blend) - xOf(b), yOf(blend) - yOf(b)];
      dx = dx * (1 - w) + ox * w;
      dz = dz * (1 - w) + oz * w;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
    }
    const px = xOf(a) + 0.5 + (xOf(b) - xOf(a)) * u + dz * LANE;
    const pz = yOf(a) + 0.5 + (yOf(b) - yOf(a)) * u - dx * LANE;
    // Averaged a little ahead and behind, so a step between terraces at a junction becomes a short slope.
    const y =
      (roadY(this.road, this.height, px - dx * 0.3, pz - dz * 0.3) +
        roadY(this.road, this.height, px, pz) +
        roadY(this.road, this.height, px + dx * 0.3, pz + dz * 0.3)) /
      3;
    this.p.set(px, y + 0.06, pz);
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(-dz, dx));
    this.object.setMatrixAt(index, this.m.compose(this.p, this.q, this.s));
    this.object.setColorAt(index, this.colors[car.color]);
  }
}

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** A body and a cabin, facing +x. The instance colour paints the whole car. */
function carGeometry(): THREE.BufferGeometry {
  const g = new GeometryBuilder();
  const white = new THREE.Color(1, 1, 1);
  g.box(-0.22, 0, -0.11, 0.22, 0.15, 0.11, white);
  g.box(-0.1, 0.15, -0.09, 0.1, 0.26, 0.09, white);
  return g.build();
}
