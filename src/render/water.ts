import * as THREE from 'three';
import { MAP_SIZE } from '../sim/grid';
import type { Palette } from './palette';
import { SEA_BED_Y, WATER_Y } from './terrain';

const EXTENT = 600;

/** The sea: a translucent surface over a deep bed that stretches past the map into the fog. */
export class WaterLayer {
  readonly group = new THREE.Group();
  private readonly surface: THREE.MeshStandardMaterial;
  private readonly bed: THREE.MeshStandardMaterial;

  constructor(palette: Palette) {
    this.bed = new THREE.MeshStandardMaterial({ roughness: 1 });
    const bedMesh = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT, EXTENT), this.bed);
    bedMesh.rotation.x = -Math.PI / 2;
    bedMesh.position.set(MAP_SIZE / 2, SEA_BED_Y - 0.01, MAP_SIZE / 2);
    bedMesh.receiveShadow = true;

    this.surface = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.62,
      roughness: 0.3,
      metalness: 0,
    });
    const surfaceMesh = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT, EXTENT), this.surface);
    surfaceMesh.rotation.x = -Math.PI / 2;
    surfaceMesh.position.set(MAP_SIZE / 2, WATER_Y, MAP_SIZE / 2);
    surfaceMesh.receiveShadow = true;

    this.group.add(bedMesh, surfaceMesh);
    this.setPalette(palette);
  }

  setPalette(palette: Palette): void {
    this.surface.color.set(palette.waterDeep);
    this.bed.color.set(palette.waterDeep).multiplyScalar(0.8);
  }
}
