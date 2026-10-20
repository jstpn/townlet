import * as THREE from 'three';
import { TILE_COUNT } from '../sim/grid';
import type { PlanTile } from '../sim/sim';

export type PreviewTint = 'build' | 'remove';

const OK = new THREE.Color('#ffffff');
const REMOVE = new THREE.Color('#c4453a');
const BLOCKED = new THREE.Color('#c4453a');

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

  show(tiles: readonly PlanTile[], tint: PreviewTint): void {
    let n = 0;
    for (const { x, y, ok } of tiles) {
      if (tint === 'remove' && !ok) continue;
      this.matrix.makeTranslation(x + 0.5, 0.08, y + 0.5);
      this.object.setMatrixAt(n, this.matrix);
      this.object.setColorAt(n, tint === 'remove' ? REMOVE : ok ? OK : BLOCKED);
      n++;
    }
    this.object.count = n;
    this.object.instanceMatrix.clearUpdateRanges();
    this.object.instanceMatrix.addUpdateRange(0, n * 16);
    this.object.instanceMatrix.needsUpdate = true;
    if (this.object.instanceColor) {
      this.object.instanceColor.clearUpdateRanges();
      this.object.instanceColor.addUpdateRange(0, n * 3);
      this.object.instanceColor.needsUpdate = true;
    }
  }

  clear(): void {
    this.object.count = 0;
  }
}
