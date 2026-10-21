import * as THREE from 'three';
import { CameraControls } from './input/controls';
import { Pointer } from './input/pointer';
import { Sound } from './audio/sound';
import { BuildTool } from './input/tools';
import { BirdLayer } from './render/birds';
import { BoatLayer } from './render/boats';
import { BuildingLayer } from './render/buildings';
import { CarLayer } from './render/cars';
import { CursorLayer } from './render/cursor';
import { CYCLE_DAYS, daylight } from './render/daylight';
import { FireLayer } from './render/fire';
import type { Layer } from './render/layer';
import { type CameraPose, ZOOM_MAX } from './render/camera';
import { groundY } from './render/ground';
import { PALETTES, type Palette, type PaletteName } from './render/palette';
import { GameRenderer } from './render/renderer';
import { RoadLayer } from './render/roads';
import { TerrainLayer } from './render/terrain';
import { WaterLayer } from './render/water';
import { ZoneLayer } from './render/zones';
import type { Difficulty } from './sim/difficulty';
import { type SaveFile, clearSave, writeSave } from './save';
import { MAP_SIZE, TILE_COUNT, type Point, idx, xOf, yOf } from './sim/grid';
import { restoreSim, snapshot } from './sim/save';
import { Sim } from './sim/sim';

const DAY_SECONDS = 0.5;
/** Zoom the postcard fit measures at; the answer scales linearly from here. */
const FIT_ZOOM = 10;
/** Height the postcard fit allows for: the tallest roofs and the turbine tips. */
const ROOF_HEIGHT = 2.5;

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
  readonly sound = new Sound();
  private palette: Palette;
  private readonly buildings = new BuildingLayer();
  private readonly layers: Layer[] = [
    new WaterLayer(),
    new TerrainLayer(),
    new RoadLayer(),
    new ZoneLayer(),
    this.buildings,
    new CarLayer(),
    new FireLayer(),
    new BoatLayer(),
    new BirdLayer(),
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
  private savedRev = 0;
  /** Called after each frame's simulation and before the render, for the HUD. */
  onFrame: (() => void) | undefined;

  constructor(canvas: HTMLCanvasElement, start: GameOptions | SaveFile) {
    this.palette = PALETTES[start.palette];
    this.sim =
      'sim' in start
        ? restoreSim(start.sim)
        : new Sim({ seed: start.seed, difficulty: start.difficulty });
    this.gfx = new GameRenderer(canvas, this.palette);
    if ('sim' in start) this.gfx.rig.setPose(start.camera);
    this.gfx.rig.ground = this.cursor.ground = this.ring.ground = this.sim.state.height;
    for (const layer of this.layers) this.gfx.scene.add(layer.object);
    this.gfx.scene.add(this.cursor.object, this.ring.object);
    this.pointer = new Pointer(canvas);
    this.controls = new CameraControls(this.gfx.rig, this.pointer, canvas);
    this.tool = new BuildTool(this.sim, this.gfx.rig, this.pointer);
    this.gfx.renderer.setAnimationLoop(this.frame);
  }

  /** Client pixel position of a tile's centre, for tests and labels. */
  tileToScreen(x: number, y: number): { x: number; y: number } {
    const ndc = this.gfx.rig.project(x + 0.5, y + 0.5, groundY(this.sim.state.height, idx(x, y)));
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
    this.save();
  }

  /** The autosave: the sim, the palette and where the camera looks. A lost town is not worth keeping. */
  save(): void {
    if (this.sim.state.status === 'lost') clearSave();
    else
      writeSave({
        version: 1,
        sim: snapshot(this.sim),
        palette: this.palette.name,
        camera: this.gfx.rig.pose(),
      });
    this.savedRev = this.sim.state.rev.save;
  }

  /**
   * Renders the town from the postcard angle, fitted to what has been built, with a title card,
   * and hands back the picture. The camera goes back to where it was afterwards.
   */
  postcard(title: string, subtitle: string): HTMLCanvasElement {
    const pose = this.gfx.rig.pose();
    this.gfx.rig.setPose(this.fitBuiltArea());
    this.syncLayers();
    this.gfx.render();
    const source = this.gfx.canvas;
    const card = document.createElement('canvas');
    card.width = source.width;
    card.height = source.height;
    const ctx = card.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0);
      drawTitleCard(ctx, card.width, card.height, title, subtitle);
    }
    this.gfx.rig.setPose(pose);
    return card;
  }

  /**
   * The postcard pose: rotation 0, centred on the built tiles, zoomed so they fill the frame.
   * Moves the camera to measure, so restore the pose afterwards.
   */
  private fitBuiltArea(): CameraPose {
    const s = this.sim.state;
    let x0 = MAP_SIZE;
    let y0 = MAP_SIZE;
    let x1 = -1;
    let y1 = -1;
    for (let tile = 0; tile < TILE_COUNT; tile++) {
      if (s.road[tile] === 0 && s.buildingId[tile] === -1 && s.zone[tile] === 0) continue;
      x0 = Math.min(x0, xOf(tile));
      y0 = Math.min(y0, yOf(tile));
      x1 = Math.max(x1, xOf(tile) + 1);
      y1 = Math.max(y1, yOf(tile) + 1);
    }
    if (x1 < 0) return { x: MAP_SIZE / 2, z: MAP_SIZE / 2, zoom: ZOOM_MAX, rotation: 0 };
    const rig = this.gfx.rig;
    const pose = { x: (x0 + x1) / 2, z: (y0 + y1) / 2, zoom: FIT_ZOOM, rotation: 0 };
    rig.setPose(pose);
    // Orthographic screen extent scales with 1 / zoom, so measuring the box's corners at ground
    // and roof height once gives the fitting zoom, plus a little margin.
    let extent = 0;
    for (const [x, z] of [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ]) {
      for (const y of [0, ROOF_HEIGHT]) {
        const ndc = rig.project(x, z, y);
        extent = Math.max(extent, Math.abs(ndc.x), Math.abs(ndc.y));
      }
    }
    return { ...pose, zoom: FIT_ZOOM * extent * 1.15 };
  }

  dispose(): void {
    this.sound.dispose();
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
    if (this.sim.state.rev.save !== this.savedRev) this.save();
    for (const layer of this.layers) layer.animate?.(dt);
    this.onFrame?.();
    this.syncLayers();
    this.lightForTimeOfDay();
    this.gfx.render(dt);
  };

  private lightForTimeOfDay(): void {
    const dayTime = this.sim.state.day + this.dayClock / DAY_SECONDS;
    const light = daylight(dayTime / CYCLE_DAYS);
    this.gfx.setDaylight(light);
    this.buildings.setNight(light.night);
    this.sound.setNight(light.night);
  }

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

function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle: string,
): void {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  const font = token('--font');
  const scale = width / 1440;
  const pad = 40 * scale;
  const cardW = 520 * scale;
  const cardH = 150 * scale;
  const x = pad;
  const y = height - pad - cardH;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = token('--ink');
  ctx.fillRect(x + 6 * scale, y + 8 * scale, cardW, cardH);
  ctx.globalAlpha = 1;
  ctx.fillStyle = token('--paper');
  ctx.fillRect(x, y, cardW, cardH);
  ctx.fillStyle = token('--accent');
  ctx.fillRect(x, y, 8 * scale, cardH);
  ctx.fillStyle = token('--ink');
  ctx.font = `500 ${44 * scale}px ${font}`;
  ctx.fillText(title, x + 32 * scale, y + 68 * scale);
  ctx.font = `400 ${22 * scale}px ${font}`;
  ctx.fillStyle = token('--ink-soft');
  ctx.fillText(subtitle, x + 32 * scale, y + 108 * scale);
  ctx.font = `600 ${14 * scale}px ${font}`;
  ctx.fillStyle = token('--ink');
  ctx.letterSpacing = `${3 * scale}px`;
  ctx.fillText('TOWNLET', x + cardW - 120 * scale, y + cardH - 24 * scale);
}
