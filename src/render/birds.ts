import * as THREE from 'three';
import { MAP_SIZE, wrapAngle } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { GeometryBuilder } from './geometryBuilder';
import { uploadInstances } from './instanced';
import type { Layer } from './layer';
import type { Palette } from './palette';

const MAX_FLOCKS = 3;
const FLOCK_SIZE = 7;
const RESIDENTS_PER_FLOCK = 1500;
const SPEED = 2.6;
const HEIGHT = 6;
/** Flocks turn back toward the middle once they stray this close to the edge. */
const EDGE = 6;

type Flock = { x: number; z: number; heading: number; phase: number };

/** Small flocks wheeling over the town in a loose V, flapping as they go. */
export class BirdLayer implements Layer {
  readonly object: THREE.InstancedMesh;
  private flocks: Flock[] = [];
  private target = 0;
  private time = 0;
  private palette: Palette | undefined;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor() {
    this.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.object = new THREE.InstancedMesh(birdGeometry(), this.material, MAX_FLOCKS * FLOCK_SIZE);
    this.object.count = 0;
    this.object.frustumCulled = false;
  }

  sync(state: SimState, palette: Palette): boolean {
    if (palette !== this.palette) {
      this.palette = palette;
      this.material.color.set(palette.road).multiplyScalar(0.55);
    }
    this.target = Math.min(MAX_FLOCKS, 1 + Math.floor(state.population / RESIDENTS_PER_FLOCK));
    return false;
  }

  animate(dt: number): void {
    this.time += dt;
    if (this.flocks.length > this.target) this.flocks.length = this.target;
    while (this.flocks.length < this.target) {
      this.flocks.push({
        x: EDGE + Math.random() * (MAP_SIZE - 2 * EDGE),
        z: EDGE + Math.random() * (MAP_SIZE - 2 * EDGE),
        heading: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    let n = 0;
    for (const flock of this.flocks) {
      this.steer(flock, dt);
      flock.x += Math.cos(flock.heading) * SPEED * dt;
      flock.z += Math.sin(flock.heading) * SPEED * dt;
      for (let k = 0; k < FLOCK_SIZE; k++) this.place(flock, k, n++);
    }
    uploadInstances(this.object, n);
  }

  /** A slow wandering turn, plus a pull toward the middle of the map near the edges. */
  private steer(flock: Flock, dt: number): void {
    let turn = Math.sin(this.time * 0.25 + flock.phase) * 0.45;
    const half = MAP_SIZE / 2;
    if (Math.abs(flock.x - half) > half - EDGE || Math.abs(flock.z - half) > half - EDGE) {
      const home = Math.atan2(half - flock.z, half - flock.x);
      const delta = wrapAngle(home - flock.heading);
      turn += Math.sign(delta) * 1.2;
    }
    flock.heading += turn * dt;
  }

  /** Bird k of a flock: the leader at the point, the rest staggered back along the two arms. */
  private place(flock: Flock, k: number, index: number): void {
    const rank = Math.ceil(k / 2);
    const side = k % 2 === 0 ? 1 : -1;
    const back = rank * 0.55;
    const across = side * rank * 0.45;
    const cos = Math.cos(flock.heading);
    const sin = Math.sin(flock.heading);
    const bob = Math.sin(this.time * 2 + k * 1.3 + flock.phase) * 0.1;
    this.p.set(
      flock.x - cos * back - sin * across,
      HEIGHT + rank * 0.08 + bob + Math.sin(this.time * 0.5 + flock.phase) * 0.4,
      flock.z - sin * back + cos * across,
    );
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -flock.heading);
    // The wings are modelled raised; scaling their height through zero flaps them.
    this.s.set(1, Math.sin(this.time * 9 + k * 0.9 + flock.phase), 1);
    this.object.setMatrixAt(index, this.m.compose(this.p, this.q, this.s));
  }
}

/** Two swept wings meeting at a short body, tips raised, facing +x. */
function birdGeometry(): THREE.BufferGeometry {
  const g = new GeometryBuilder();
  const c = new THREE.Color('#ffffff');
  g.tri(0.08, 0, 0, -0.06, 0, 0, -0.02, 0.1, -0.24, c);
  g.tri(0.08, 0, 0, -0.02, 0.1, 0.24, -0.06, 0, 0, c);
  return g.build();
}
