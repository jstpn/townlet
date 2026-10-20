import * as THREE from 'three';
import { MAP_SIZE } from '../sim/grid';
import { CameraRig } from './camera';
import type { Palette } from './palette';

/** Owns the WebGL renderer, scene, lights and fog. Layers add themselves to `scene`. */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly sun: THREE.DirectionalLight;
  readonly sky: THREE.HemisphereLight;
  private readonly fog: THREE.Fog;

  constructor(
    readonly canvas: HTMLCanvasElement,
    palette: Palette,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.sky = new THREE.HemisphereLight('#ffffff', '#ffffff', 1.1);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.4);
    this.sun.position.set(MAP_SIZE / 2 - 40, 70, MAP_SIZE / 2 + 30);
    this.sun.target.position.set(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const cam = this.sun.shadow.camera;
    cam.left = -52;
    cam.right = 52;
    cam.top = 52;
    cam.bottom = -52;
    cam.near = 1;
    cam.far = 220;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sky, this.sun, this.sun.target);

    this.fog = new THREE.Fog('#ffffff', 150, 260);
    this.scene.fog = this.fog;
    this.setPalette(palette);

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  setPalette(palette: Palette): void {
    this.scene.background = new THREE.Color(palette.sky);
    this.fog.color.set(palette.fog);
    this.sky.color.set(palette.sky);
    this.sky.groundColor.set(palette.grass);
    this.sun.color.set(palette.sun);
  }

  readonly resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.rig.resize(width, height);
  };

  render(): void {
    this.renderer.render(this.scene, this.rig.camera);
  }
}
