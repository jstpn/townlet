import * as THREE from 'three';
import type { Palette } from './palette';
import { buildTerrainGeometry, createTerrainMaterial } from './terrain';
import { TreeLayer } from './trees';
import { WaterLayer } from './water';

/** Everything drawn from the map: ground, sea and trees. */
export class WorldLayers {
  readonly group = new THREE.Group();
  private readonly terrainMesh: THREE.Mesh;
  private readonly water: WaterLayer;
  private readonly trees: TreeLayer;
  private palette: Palette;
  private terrain: Uint8Array;

  constructor(terrain: Uint8Array, palette: Palette) {
    this.palette = palette;
    this.terrain = terrain;
    this.terrainMesh = new THREE.Mesh(
      buildTerrainGeometry(terrain, palette),
      createTerrainMaterial(),
    );
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = true;
    this.water = new WaterLayer(palette);
    this.trees = new TreeLayer(palette);
    this.trees.rebuild(terrain);
    this.group.add(this.terrainMesh, this.water.group, this.trees.group);
  }

  setPalette(palette: Palette): void {
    this.palette = palette;
    this.water.setPalette(palette);
    this.trees.setPalette(palette);
    this.rebuild();
  }

  setTerrain(terrain: Uint8Array): void {
    this.terrain = terrain;
    this.rebuild();
  }

  private rebuild(): void {
    this.terrainMesh.geometry.dispose();
    this.terrainMesh.geometry = buildTerrainGeometry(this.terrain, this.palette);
    this.trees.rebuild(this.terrain);
  }
}
