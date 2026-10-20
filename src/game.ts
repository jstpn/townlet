import * as THREE from 'three';
import { CameraControls } from './input/controls';
import { Pointer } from './input/pointer';
import { BuildTool } from './input/tools';
import { CursorLayer } from './render/cursor';
import type { Layer } from './render/layer';
import { PALETTES, type Palette, type PaletteName } from './render/palette';
import { GameRenderer } from './render/renderer';
import { RoadLayer } from './render/roads';
import { TerrainLayer } from './render/terrain';
import { WaterLayer } from './render/water';
import type { Difficulty } from './sim/difficulty';
import { Sim } from './sim/sim';

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
  private readonly layers: Layer[] = [new WaterLayer(), new TerrainLayer(), new RoadLayer()];
  private readonly cursor = new CursorLayer();
  private readonly pointer: Pointer;
  private readonly controls: CameraControls;
  private readonly clock = new THREE.Clock();
  private previewRev = -1;

  constructor(canvas: HTMLCanvasElement, options: GameOptions) {
    this.palette = PALETTES[options.palette];
    this.sim = new Sim({ seed: options.seed, difficulty: options.difficulty });
    this.gfx = new GameRenderer(canvas, this.palette);
    for (const layer of this.layers) this.gfx.scene.add(layer.object);
    this.gfx.scene.add(this.cursor.object);
    this.pointer = new Pointer(canvas);
    this.controls = new CameraControls(this.gfx.rig, this.pointer, canvas);
    this.tool = new BuildTool(this.sim, this.gfx.rig, this.pointer);
    this.gfx.renderer.setAnimationLoop(this.frame);
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
    this.syncLayers();
    this.gfx.render();
  };

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
