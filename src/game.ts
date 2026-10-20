import * as THREE from 'three';
import { CameraControls } from './input/controls';
import { BuildTool } from './input/tools';
import { CursorLayer } from './render/cursor';
import { PALETTES, type Palette, type PaletteName } from './render/palette';
import { GameRenderer } from './render/renderer';
import { RoadLayer } from './render/roads';
import { WorldLayers } from './render/world';
import type { Difficulty } from './sim/difficulty';
import { Sim } from './sim/sim';

export type GameOptions = {
  seed: string;
  difficulty: Difficulty;
  palette: PaletteName;
};

/** Wires the simulation to the renderer and input. One instance per town. */
export class Game {
  readonly sim: Sim;
  readonly gfx: GameRenderer;
  readonly tool: BuildTool;
  private palette: Palette;
  private readonly world: WorldLayers;
  private readonly roads = new RoadLayer();
  private readonly cursor = new CursorLayer();
  private readonly controls: CameraControls;
  private readonly clock = new THREE.Clock();
  private seen = { terrain: -1, roads: -1 };

  constructor(canvas: HTMLCanvasElement, options: GameOptions) {
    this.palette = PALETTES[options.palette];
    this.sim = new Sim({ seed: options.seed, difficulty: options.difficulty });
    this.gfx = new GameRenderer(canvas, this.palette);
    this.world = new WorldLayers(this.sim.state.terrain, this.palette);
    this.gfx.scene.add(this.world.group, this.roads.mesh, this.cursor.mesh);
    this.controls = new CameraControls(this.gfx.rig, canvas);
    this.tool = new BuildTool(this.sim, this.gfx.rig, this.cursor, canvas);
    this.gfx.renderer.setAnimationLoop(this.frame);
  }

  setPalette(name: PaletteName): void {
    this.palette = PALETTES[name];
    this.gfx.setPalette(this.palette);
    this.world.setPalette(this.palette);
    this.seen.roads = -1;
  }

  private readonly frame = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.controls.update(dt);
    this.gfx.rig.update(dt);
    this.syncLayers();
    this.gfx.render();
  };

  /** Rebuilds any layer whose sim revision moved since the last frame. */
  private syncLayers(): void {
    const rev = this.sim.state.rev;
    if (rev.terrain !== this.seen.terrain) {
      this.world.setTerrain(this.sim.state.terrain);
      this.seen.terrain = rev.terrain;
    }
    if (rev.roads !== this.seen.roads) {
      this.roads.rebuild(this.sim.state.road, this.palette);
      this.seen.roads = rev.roads;
    }
  }
}
