import type { CameraRig } from '../render/camera';
import type { PreviewTint } from '../render/cursor';
import type { BuildingKind } from '../sim/catalogue';
import type { Point } from '../sim/grid';
import type { CommandResult, Plan, Sim } from '../sim/sim';
import type { ZoneKind } from '../sim/types';
import type { Pointer } from './pointer';

export type Tool =
  | { kind: 'none' }
  | { kind: 'road' }
  | { kind: 'bulldoze' }
  | { kind: 'zone'; zone: ZoneKind }
  | { kind: 'building'; building: BuildingKind };

export type Preview = { plan: Plan; tint: PreviewTint };

/**
 * Turns left-button gestures into sim commands. The preview is data for the renderer, and a
 * release always commits exactly what the preview last showed.
 */
export class BuildTool {
  tool: Tool = { kind: 'none' };
  preview: Preview | undefined;
  /** Bumped whenever `preview` changes, so the renderer can skip unchanged frames. */
  previewRev = 0;
  /** Tile clicked with no tool active, for the info panel. A new object per click. */
  selected: Point | undefined;
  /** Called with the outcome of every committed gesture. */
  onCommand: ((result: CommandResult) => void) | undefined;
  private start: Point | undefined;
  private hover: Point | undefined;

  constructor(
    private readonly sim: Sim,
    private readonly rig: CameraRig,
    private readonly pointer: Pointer,
  ) {
    pointer.onDown(this.onPointerDown);
    pointer.onMove(this.update);
    pointer.onUp(this.onPointerUp);
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.start = undefined;
    this.select(undefined);
    this.refreshPreview();
  }

  select(tile: Point | undefined): void {
    this.selected = tile;
  }

  /** Re-picks the tile under the pointer. Called on pointer moves and once per frame, since the camera can move too. */
  readonly update = (): void => {
    const tile = this.pointer.inside ? this.rig.pickTile(this.pointer.ndc) : undefined;
    if (tile?.x === this.hover?.x && tile?.y === this.hover?.y) return;
    this.hover = tile;
    this.refreshPreview();
  };

  private plan(from: Point, to: Point): Plan | undefined {
    switch (this.tool.kind) {
      case 'road':
        return this.sim.planRoadLine(from.x, from.y, to.x, to.y);
      case 'bulldoze':
        return this.sim.planBulldozeRect(from.x, from.y, to.x, to.y);
      case 'zone':
        return this.sim.planZoneRect(this.tool.zone, from.x, from.y, to.x, to.y);
      case 'building':
        return this.sim.planBuilding(this.tool.building, to.x, to.y);
      case 'none':
        return undefined;
    }
  }

  private commit(from: Point, to: Point): void {
    let result: CommandResult;
    switch (this.tool.kind) {
      case 'road':
        result = this.sim.placeRoadLine(from.x, from.y, to.x, to.y);
        break;
      case 'bulldoze':
        result = this.sim.bulldozeRect(from.x, from.y, to.x, to.y);
        break;
      case 'zone':
        result = this.sim.zoneRect(this.tool.zone, from.x, from.y, to.x, to.y);
        break;
      case 'building':
        result = this.sim.placeBuilding(this.tool.building, to.x, to.y);
        break;
      case 'none':
        return;
    }
    this.onCommand?.(result);
  }

  private refreshPreview(): void {
    const anchor = this.start ?? this.hover;
    const plan = anchor && this.hover ? this.plan(anchor, this.hover) : undefined;
    this.preview = plan
      ? { plan, tint: this.tool.kind === 'bulldoze' ? 'remove' : 'build' }
      : undefined;
    this.previewRev++;
  }

  private readonly onPointerDown = (button: number): void => {
    if (button !== 0) return;
    this.hover = this.rig.pickTile(this.pointer.ndc);
    if (this.tool.kind === 'none') {
      this.select(this.hover);
      return;
    }
    this.start = this.hover;
    this.refreshPreview();
  };

  private readonly onPointerUp = (button: number): void => {
    if (button !== 0 || !this.start) return;
    const end = this.hover;
    if (end) this.commit(this.start, end);
    this.start = undefined;
    this.refreshPreview();
  };
}
