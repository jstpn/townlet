import * as THREE from 'three';
import { MAP_SIZE, TILE_COUNT, idx, inBounds, xOf, yOf } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { GeometryBuilder } from './geometryBuilder';
import { uploadInstances } from './instanced';
import type { Layer } from './layer';
import type { Palette } from './palette';
import { pick } from './random';
import { WATER_Y, waterDepth } from './terrain';

const MAX_BOATS = 6;
const RESIDENTS_PER_BOAT = 600;
const SPEED = 0.45;
const TURN_RATE = 1.1;
/** Water this many tiles from any shore is open enough to sail. */
const OPEN_DEPTH = 2;
/** Boats may wander this far past the map edge before turning back. */
const MARGIN = 4;
const LOOK_AHEAD = 1.4;
/** Boats are drawn larger than life, as the houses are, so they read from the usual zoom. */
const BOAT_SCALE = 1.4;

type Boat = { x: number; z: number; heading: number; turn: 1 | -1; phase: number; color: number };

/** Little sailing boats drifting on the open water around the island. */
export class BoatLayer implements Layer {
  readonly object = new THREE.Group();
  private readonly hulls: THREE.InstancedMesh;
  private readonly sails: THREE.InstancedMesh;
  private boats: Boat[] = [];
  private depth: Uint16Array = new Uint16Array(0);
  private openTiles: number[] = [];
  private target = 0;
  private time = 0;
  private hullColors: THREE.Color[] = [];
  private sailColors: THREE.Color[] = [];
  private palette: Palette | undefined;
  private readonly m = new THREE.Matrix4();
  private readonly e = new THREE.Euler();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(BOAT_SCALE, BOAT_SCALE, BOAT_SCALE);

  constructor() {
    this.hulls = new THREE.InstancedMesh(
      hullGeometry(),
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.7 }),
      MAX_BOATS,
    );
    this.sails = new THREE.InstancedMesh(
      sailGeometry(),
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, side: THREE.DoubleSide }),
      MAX_BOATS,
    );
    for (const mesh of [this.hulls, this.sails]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
    }
    this.object.add(this.hulls, this.sails);
  }

  sync(state: SimState, palette: Palette): boolean {
    if (palette !== this.palette) {
      this.palette = palette;
      this.hullColors = [palette.trim, palette.accent, ...palette.roofs].map(
        (c) => new THREE.Color(c),
      );
      this.sailColors = palette.walls.map((c) => new THREE.Color(c));
    }
    if (this.depth.length === 0) {
      this.depth = waterDepth(state.terrain);
      for (let tile = 0; tile < TILE_COUNT; tile++) {
        if (this.depth[tile] >= OPEN_DEPTH) this.openTiles.push(tile);
      }
    }
    this.target = Math.min(MAX_BOATS, 2 + Math.floor(state.population / RESIDENTS_PER_BOAT));
    return false;
  }

  animate(dt: number): void {
    this.time += dt;
    if (this.boats.length > this.target) this.boats.length = this.target;
    while (this.boats.length < this.target) this.spawn();
    this.boats.forEach((boat, i) => {
      this.steer(boat, dt);
      boat.x += Math.cos(boat.heading) * SPEED * dt;
      boat.z += Math.sin(boat.heading) * SPEED * dt;
      this.place(boat, i);
    });
    uploadInstances(this.hulls, this.boats.length);
    uploadInstances(this.sails, this.boats.length);
  }

  /** True on water far enough from shore, or a little way past the map edge. */
  private open(x: number, z: number): boolean {
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (inBounds(tx, tz)) return this.depth[idx(tx, tz)] >= OPEN_DEPTH;
    return tx >= -MARGIN && tz >= -MARGIN && tx < MAP_SIZE + MARGIN && tz < MAP_SIZE + MARGIN;
  }

  /** Holds course while the water ahead is open; otherwise turns the boat's preferred way. */
  private steer(boat: Boat, dt: number): void {
    const ahead = this.open(
      boat.x + Math.cos(boat.heading) * LOOK_AHEAD,
      boat.z + Math.sin(boat.heading) * LOOK_AHEAD,
    );
    if (!ahead) boat.heading += boat.turn * TURN_RATE * dt;
    else boat.heading += Math.sin(this.time * 0.3 + boat.phase) * 0.15 * dt;
  }

  private spawn(): void {
    const tile = pick(this.openTiles);
    this.boats.push({
      x: xOf(tile) + 0.5,
      z: yOf(tile) + 0.5,
      heading: Math.random() * Math.PI * 2,
      turn: Math.random() < 0.5 ? 1 : -1,
      phase: Math.random() * Math.PI * 2,
      color: Math.floor(Math.random() * this.hullColors.length),
    });
  }

  private place(boat: Boat, i: number): void {
    const bob = Math.sin(this.time * 1.7 + boat.phase) * 0.025;
    const roll = 0.05 + Math.sin(this.time * 1.3 + boat.phase) * 0.05;
    this.p.set(boat.x, WATER_Y + 0.02 + bob, boat.z);
    this.q.setFromEuler(this.e.set(roll, -boat.heading, 0, 'YXZ'));
    this.m.compose(this.p, this.q, this.s);
    this.hulls.setMatrixAt(i, this.m);
    this.sails.setMatrixAt(i, this.m);
    this.hulls.setColorAt(i, this.hullColors[boat.color]);
    this.sails.setColorAt(i, this.sailColors[boat.color % this.sailColors.length]);
  }
}

/** A pointed hull with a deck and a mast, facing +x. The instance colour paints it. */
function hullGeometry(): THREE.BufferGeometry {
  const g = new GeometryBuilder();
  const c = new THREE.Color('#ffffff');
  const keel = -0.06;
  const deck = 0.1;
  g.quad(-0.32, deck, -0.13, -0.32, deck, 0.13, 0.05, deck, 0.15, 0.05, deck, -0.15, 0, 1, 0, c);
  g.tri(0.05, deck, -0.15, 0.05, deck, 0.15, 0.42, deck, 0, c);
  g.wall(0.05, 0.15, -0.32, 0.13, keel, deck, c);
  g.wall(-0.32, -0.13, 0.05, -0.15, keel, deck, c);
  g.wall(0.42, 0, 0.05, 0.15, keel, deck, c);
  g.wall(0.05, -0.15, 0.42, 0, keel, deck, c);
  g.wall(-0.32, 0.13, -0.32, -0.13, keel, deck, c);
  g.box(0, deck, -0.012, 0.024, 0.78, 0.012, c);
  return g.build();
}

/** A triangular sail hung from the mast, in the boat's long plane. */
function sailGeometry(): THREE.BufferGeometry {
  const g = new GeometryBuilder();
  const c = new THREE.Color('#ffffff');
  g.tri(0.03, 0.72, 0, 0.03, 0.16, 0, -0.3, 0.16, 0, c);
  return g.build();
}
