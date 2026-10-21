import * as THREE from 'three';
import { TILE_COUNT, idx } from '../sim/grid';
import type { Point } from '../sim/grid';
import { groundY } from './ground';
import type { PlanStatus } from '../sim/sim';
import { uploadInstances } from './instanced';

export type PreviewTint = 'build' | 'remove' | 'ring';

const WHITE = new THREE.Color('#ffffff');
const RED = new THREE.Color('#c4453a');
const RING = new THREE.Color('#f6eedc');

/** Translucent tile highlights for the build preview, coloured per tile. */
export class CursorLayer {
  readonly object: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();

  constructor() {
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.object = new THREE.InstancedMesh(geometry, material, TILE_COUNT);
    this.object.count = 0;
    this.object.frustumCulled = false;
    this.object.renderOrder = 10;
  }

  /** Draws the tiles on their terraces, from the `height` grid. */
  show(
    tiles: readonly (Point & { status?: PlanStatus })[],
    tint: PreviewTint,
    height: Uint8Array,
  ): void {
    let n = 0;
    for (const { x, y, status } of tiles) {
      if (status === 'keep' && tint === 'remove') continue;
      const base = groundY(height, idx(x, y));
      this.matrix.makeTranslation(x + 0.5, base + 0.08, y + 0.5);
      this.object.setMatrixAt(n, this.matrix);
      const color =
        tint === 'ring' ? RING : status === 'blocked' || tint === 'remove' ? RED : WHITE;
      this.object.setColorAt(n, color);
      n++;
    }
    uploadInstances(this.object, n);
  }

  clear(): void {
    this.object.count = 0;
  }
}
