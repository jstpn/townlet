import './style.css';
import * as THREE from 'three';
import { CameraControls } from './input/controls';
import { PALETTES } from './render/palette';
import { GameRenderer } from './render/renderer';
import { WorldLayers } from './render/world';
import { generateMap } from './sim/mapgen';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) {
  throw new Error('missing #scene canvas');
}

const palette = PALETTES.budapest;
const map = generateMap('budapest');
const gfx = new GameRenderer(canvas, palette);
const world = new WorldLayers(map.terrain, palette);
gfx.scene.add(world.group);
const controls = new CameraControls(gfx.rig, canvas);

const clock = new THREE.Clock();
gfx.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update(dt);
  gfx.rig.update(dt);
  gfx.render();
});
