import type * as THREE from 'three';

/** Sets how many instances draw and uploads just that prefix of the matrix and colour buffers. */
export function uploadInstances(mesh: THREE.InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.visible = count > 0;
  mesh.instanceMatrix.clearUpdateRanges();
  mesh.instanceMatrix.addUpdateRange(0, count * 16);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.clearUpdateRanges();
    mesh.instanceColor.addUpdateRange(0, count * 3);
    mesh.instanceColor.needsUpdate = true;
  }
}
