import * as THREE from 'three';
import { CameraControls } from './input/controls';
import { Pointer } from './input/pointer';
import { BuildTool } from './input/tools';
import { BuildingLayer } from './render/buildings';
import { CarLayer } from './render/cars';
import { CursorLayer } from './render/cursor';
import { FireLayer } from './render/fire';
import type { Layer } from './render/layer';
import { PALETTES, type Palette, type PaletteName } from './render/palette';
import { GameRenderer } from './render/renderer';
import { RoadLayer } from './render/roads';
import { TerrainLayer } from './render/terrain';
import { WaterLayer } from './render/water';
import { ZoneLayer } from './render/zones';
import type { Difficulty } from './sim/difficulty';
import type { Point } from './sim/grid';
import { Sim } from './sim/sim';

const DAY_SECONDS = 0.5;

export type GameOptions = {
  seed: string;
  difficulty: Difficulty;
  palette: PaletteName;
};

/** Wires the simulation to the renderer and input. One instance per town; dispose before the next. */
export class Game {
  readonly sim: Sim;
  readonly gfx: GameRenderer;
  readonly tool: BuildTool;
  private palette: Palette;
  private readonly layers: Layer[] = [
    new WaterLayer(),
    new TerrainLayer(),
    new RoadLayer(),
    new ZoneLayer(),
    new BuildingLayer(),
    new CarLayer(),
    new FireLayer(),
  ];
  private readonly cursor = new CursorLayer();
  private readonly ring = new CursorLayer();
  private readonly pointer: Pointer;
  private readonly controls: CameraControls;
  private readonly clock = new THREE.Clock();
  /** Sim speed multiplier: 0 pauses, 1 to 3 run. One day lasts half a second at 1x. */
  speed = 1;
  private dayClock = 0;
  private previewRev = -1;
  /** Called after each frame's simulation and before the render, for the HUD. */
  onFrame: (() => void) | undefined;

  constructor(canvas: HTMLCanvasElement, options: GameOptions) {
    this.palette = PALETTES[options.palette];
    this.sim = new Sim({ seed: options.seed, difficulty: options.difficulty });
    this.gfx = new GameRenderer(canvas, this.palette);
    for (const layer of this.layers) this.gfx.scene.add(layer.object);
    this.gfx.scene.add(this.cursor.object, this.ring.object);
    this.pointer = new Pointer(canvas);
    this.controls = new CameraControls(this.gfx.rig, this.pointer, canvas);
    this.tool = new BuildTool(this.sim, this.gfx.rig, this.pointer);
    this.gfx.renderer.setAnimationLoop(this.frame);
  }

  /** Client pixel position of a tile's centre, for tests and labels. */
  tileToScreen(x: number, y: number): { x: number; y: number } {
    const ndc = this.gfx.rig.project(x + 0.5, y + 0.5);
    return {
      x: ((ndc.x + 1) / 2) * this.gfx.canvas.clientWidth,
      y: ((1 - ndc.y) / 2) * this.gfx.canvas.clientHeight,
    };
  }

  /** Soft highlight under the info panel's selection, or a building's reach. */
  highlight(tiles: readonly Point[] | undefined): void {
    if (tiles) this.ring.show(tiles, 'ring');
    else this.ring.clear();
  }

  get paletteName(): PaletteName {
    return this.palette.name;
  }

  setPalette(name: PaletteName): void {
    this.palette = PALETTES[name];
    this.gfx.setPalette(this.palette);
  }

  dispose(): void {
    this.controls.dispose();
    this.pointer.dispose();
    this.gfx.dispose();
  }

  private readonly frame = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.controls.update(dt);
    this.gfx.rig.update(dt);
    this.tool.update();
    this.tick(dt);
    for (const layer of this.layers) layer.animate?.(dt);
    this.onFrame?.();
    this.syncLayers();
    this.gfx.render();
  };

  private tick(dt: number): void {
    this.dayClock += dt * this.speed;
    // Catch up at most a few days per frame so a background tab does not fast-forward the town.
    for (let n = 0; this.dayClock >= DAY_SECONDS && n < 4; n++) {
      this.dayClock -= DAY_SECONDS;
      this.sim.step();
    }
    if (this.dayClock > DAY_SECONDS) this.dayClock = 0;
  }

  private syncLayers(): void {
    let rebuilt = false;
    for (const layer of this.layers) {
      if (layer.sync(this.sim.state, this.palette)) rebuilt = true;
    }
    if (rebuilt) this.gfx.requestShadowUpdate();
    if (this.tool.previewRev !== this.previewRev) {
      this.previewRev = this.tool.previewRev;
      const preview = this.tool.preview;
      if (preview) this.cursor.show(preview.plan.tiles, preview.tint);
      else this.cursor.clear();
    }
  }
}
