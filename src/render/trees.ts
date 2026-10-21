import * as THREE from 'three';
import { MAP_SIZE, idx } from '../sim/grid';
import { Terrain } from '../sim/types';
import { tileHash } from './hash';
import { uploadInstances } from './instanced';
import type { Palette } from './palette';

const CAPACITY = 7000;

/** Low-poly trees on forest tiles: a trunk and two stacked crowns, instanced. */
export class TreeLayer {
  readonly object = new THREE.Group();
  private readonly trunks: THREE.InstancedMesh;
  private readonly lower: THREE.InstancedMesh;
  private readonly upper: THREE.InstancedMesh;
  private readonly trunkMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.trunkMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 });
    const crownMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 });
    this.trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.05, 0.08, 0.32, 5),
      this.trunkMaterial,
      CAPACITY,
    );
    this.lower = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.3, 0.5, 6),
      crownMaterial,
      CAPACITY,
    );
    this.upper = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.2, 0.42, 6),
      crownMaterial,
      CAPACITY,
    );
    for (const mesh of [this.trunks, this.lower, this.upper]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.frustumCulled = false;
    }
    this.object.add(this.trunks, this.lower, this.upper);
  }

  /** Rebuilds every instance from the terrain. Cheap enough to run whenever a tile changes. */
  rebuild(terrain: Uint8Array, palette: Palette): void {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const foliage = new THREE.Color(palette.foliage);
    const foliageAlt = new THREE.Color(palette.foliageAlt);
    this.trunkMaterial.color.set(palette.trunk);
    let n = 0;

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (terrain[idx(x, y)] !== Terrain.Forest) continue;
        const count = 1 + Math.floor(tileHash(x, y, 1) * 3);
        for (let k = 0; k < count && n < CAPACITY; k++) {
          const px = x + 0.2 + tileHash(x, y, 10 + k) * 0.6;
          const pz = y + 0.2 + tileHash(x, y, 20 + k) * 0.6;
          const s = 0.75 + tileHash(x, y, 30 + k) * 0.5;
          rotation.setFromAxisAngle(up, tileHash(x, y, 40 + k) * Math.PI * 2);
          const crown = tileHash(x, y, 50 + k) < 0.5 ? foliage : foliageAlt;

          position.set(px, 0.16 * s, pz);
          scale.set(s, s, s);
          matrix.compose(position, rotation, scale);
          this.trunks.setMatrixAt(n, matrix);

          position.set(px, (0.32 + 0.25) * s, pz);
          matrix.compose(position, rotation, scale);
          this.lower.setMatrixAt(n, matrix);
          this.lower.setColorAt(n, crown);

          position.set(px, (0.32 + 0.5 + 0.12) * s, pz);
          matrix.compose(position, rotation, scale);
          this.upper.setMatrixAt(n, matrix);
          this.upper.setColorAt(n, crown);
          n++;
        }
      }
    }

    for (const mesh of [this.trunks, this.lower, this.upper]) uploadInstances(mesh, n);
  }
}
