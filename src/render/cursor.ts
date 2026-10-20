import * as THREE from 'three';

const CAPACITY = 1024;

/** Translucent tile highlights for the build preview. */
export class CursorLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly matrix = new THREE.Matrix4();

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, CAPACITY);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  setTiles(tiles: readonly { x: number; y: number }[], color: string): void {
    this.material.color.set(color);
    let n = 0;
    for (const { x, y } of tiles) {
      if (n >= CAPACITY) break;
      this.matrix.makeTranslation(x + 0.5, 0.08, y + 0.5);
      this.mesh.setMatrixAt(n, this.matrix);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.mesh.count = 0;
  }
}
