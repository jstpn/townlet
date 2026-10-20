import * as THREE from 'three';
import { MAP_SIZE } from '../sim/grid';
import type { SimState } from '../sim/sim';
import type { Layer } from './layer';
import type { Palette } from './palette';
import { SEA_BED_Y, WATER_Y } from './terrain';

const EXTENT = 600;

/** The sea: a translucent surface over a deep bed that stretches past the map into the fog. */
export class WaterLayer implements Layer {
  readonly object = new THREE.Group();
  private readonly surface: THREE.MeshStandardMaterial;
  private readonly bed: THREE.MeshStandardMaterial;
  private palette: Palette | undefined;

  constructor() {
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
    this.object.add(bedMesh, surfaceMesh);
  }

  sync(_state: SimState, palette: Palette): boolean {
    if (palette === this.palette) return false;
    this.palette = palette;
    this.surface.color.set(palette.waterDeep);
    this.bed.color.set(palette.waterDeep).multiplyScalar(0.8);
    return false;
  }
}
