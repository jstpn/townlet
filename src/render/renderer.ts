import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { MAP_SIZE } from '../sim/grid';
import { CameraRig } from './camera';
import type { Daylight } from './daylight';
import { GradeShader } from './grade';
import type { Palette } from './palette';

const SUN_INTENSITY = 2.4;
const SKY_INTENSITY = 1.1;
const GOLDEN = new THREE.Color('#ffb36b');

/** Owns the WebGL renderer, scene, lights and fog. Layers add themselves to `scene`. */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly sun: THREE.DirectionalLight;
  readonly sky: THREE.HemisphereLight;
  private readonly fog: THREE.Fog;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private sunColor = new THREE.Color();
  private time = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    palette: Palette,
  ) {
    // The composer target carries the multisampling; the canvas only ever shows a full-screen quad.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // The sun is static, so the shadow pass only runs when geometry changes.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.sky = new THREE.HemisphereLight('#ffffff', '#ffffff', 1.1);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.4);
    this.sun.position.set(MAP_SIZE / 2 - 40, 70, MAP_SIZE / 2 + 30);
    this.sun.target.position.set(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = -48;
    cam.right = 48;
    cam.top = 48;
    cam.bottom = -48;
    cam.near = 1;
    cam.far = 220;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sky, this.sun, this.sun.target);

    this.fog = new THREE.Fog('#ffffff', 150, 260);
    this.scene.fog = this.fog;

    // Half float keeps the glowing windows above 1 so only they bloom; the samples keep the edges smooth.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.rig.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 1.0);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.setPalette(palette);

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  setPalette(palette: Palette): void {
    this.scene.background = new THREE.Color(palette.sky);
    this.fog.color.set(palette.fog);
    this.sky.color.set(palette.sky);
    this.sky.groundColor.set(palette.grass);
    this.sunColor.set(palette.sun);
    (this.grade.uniforms.nightColor.value as THREE.Color).set(palette.night);
  }

  /** Dims and tints the scene for the time of day. */
  setDaylight(d: Daylight): void {
    this.sun.intensity = SUN_INTENSITY * d.sun;
    this.sky.intensity = SKY_INTENSITY * d.sky;
    this.sun.color.copy(this.sunColor).lerp(GOLDEN, d.warmth * 0.6);
    this.grade.uniforms.night.value = d.night;
    // Only the window glow crosses the bloom threshold, so by day the pass has nothing to add.
    this.bloom.enabled = d.night > 0;
  }

  /** Call after any shadow-casting geometry changes. */
  requestShadowUpdate(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  readonly resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.rig.resize(width, height);
  };

  render(dt = 0): void {
    this.time = (this.time + dt) % 60;
    this.grade.uniforms.time.value = this.time;
    this.composer.render();
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.setAnimationLoop(null);
    this.composer.dispose();
    this.renderer.dispose();
  }
}
