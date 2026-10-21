import * as THREE from 'three';
import { xOf, yOf } from '../sim/grid';
import type { SimState } from '../sim/sim';
import { GeometryBuilder } from './geometryBuilder';
import { tileHash } from './hash';
import { uploadInstances } from './instanced';
import type { Layer } from './layer';
import type { Palette } from './palette';

const MAX_FIRES = 256;
const FLAMES_PER_FIRE = 4;
const PUFFS_PER_FIRE = 4;
const PUFF_SECONDS = 2.4;

/** Flame tongues and rising smoke over every burning tile. Unlit, so they read in any light. */
export class FireLayer implements Layer {
  readonly object = new THREE.Group();
  private readonly flames: THREE.InstancedMesh;
  private readonly smoke: THREE.InstancedMesh;
  private readonly smokeMaterial: THREE.MeshStandardMaterial;
  private burning: number[] = [];
  private palette: Palette | undefined;
  private rev = -1;
  private time = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor() {
    this.flames = new THREE.InstancedMesh(
      flameGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      MAX_FIRES * FLAMES_PER_FIRE,
    );
    this.smokeMaterial = new THREE.MeshStandardMaterial({
      flatShading: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.smoke = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.11, 0),
      this.smokeMaterial,
      MAX_FIRES * PUFFS_PER_FIRE,
    );
    for (const mesh of [this.flames, this.smoke]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
    }
    this.object.add(this.flames, this.smoke);
  }

  sync(state: SimState, palette: Palette): boolean {
    if (palette !== this.palette) {
      this.palette = palette;
      this.smokeMaterial.color.set(palette.fog).multiplyScalar(0.72);
    }
    if (state.rev.fire === this.rev) return false;
    this.rev = state.rev.fire;
    this.burning = [];
    state.fire.forEach((days, tile) => {
      if (days > 0 && this.burning.length < MAX_FIRES) this.burning.push(tile);
    });
    this.animate(0);
    return false;
  }

  animate(dt: number): void {
    this.time += dt;
    if (this.burning.length === 0 && this.flames.count === 0) return;
    let f = 0;
    let k = 0;
    for (const tile of this.burning) {
      const x = xOf(tile);
      const y = yOf(tile);
      for (let i = 0; i < FLAMES_PER_FIRE; i++) {
        const phase = tileHash(x, y, 20 + i) * 6.28;
        const flicker = 0.75 + 0.25 * Math.sin(this.time * 9 + phase) * Math.cos(this.time * 5.3 + phase);
        this.p.set(x + 0.25 + 0.5 * tileHash(x, y, 30 + i), 0.4, y + 0.25 + 0.5 * tileHash(x, y, 40 + i));
        this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, phase + this.time * 0.6);
        this.s.set(1.6 + 0.6 * flicker, 1.2 + 1.8 * flicker, 1.6 + 0.6 * flicker);
        this.flames.setMatrixAt(f++, this.m.compose(this.p, this.q, this.s));
      }
      for (let i = 0; i < PUFFS_PER_FIRE; i++) {
        const t = ((this.time + tileHash(x, y, 50 + i) * PUFF_SECONDS) % PUFF_SECONDS) / PUFF_SECONDS;
        const drift = tileHash(x, y, 60 + i) - 0.5;
        this.p.set(x + 0.5 + drift * 0.3 + t * 0.6, 1.6 + t * 2.2, y + 0.5 - drift * 0.2 + t * 0.3);
        const size = 0.6 + t * 1.8;
        this.s.set(size, size, size);
        this.q.identity();
        this.smoke.setMatrixAt(k++, this.m.compose(this.p, this.q, this.s));
      }
    }
    uploadInstances(this.flames, f);
    uploadInstances(this.smoke, k);
  }
}

/** Two crossed tongues, each a wide base tapering to a point, warm at the heart and red at the tips. */
function flameGeometry(): THREE.BufferGeometry {
  const g = new GeometryBuilder();
  const core = new THREE.Color('#ffd166');
  const edge = new THREE.Color('#e4572e');
  for (const angle of [0, Math.PI / 2]) {
    const c = Math.cos(angle) * 0.16;
    const s = Math.sin(angle) * 0.16;
    g.tri(-c, 0, -s, c, 0, s, 0, 0.55, 0, edge);
    g.tri(-c * 0.5, 0.05, -s * 0.5, c * 0.5, 0.05, s * 0.5, 0, 0.32, 0, core);
  }
  return g.build();
}
