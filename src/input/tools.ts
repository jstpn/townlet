import type { CameraRig } from '../render/camera';
import type { PreviewTint } from '../render/cursor';
import type { Point } from '../sim/grid';
import type { Plan, Sim } from '../sim/sim';
import type { Pointer } from './pointer';

export type Tool = { kind: 'none' } | { kind: 'road' } | { kind: 'bulldoze' };

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
    this.refreshPreview();
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
      case 'none':
        return undefined;
    }
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
    if (button !== 0 || this.tool.kind === 'none') return;
    this.hover = this.rig.pickTile(this.pointer.ndc);
    this.start = this.hover;
    this.refreshPreview();
  };

  private readonly onPointerUp = (button: number): void => {
    if (button !== 0 || !this.start) return;
    const end = this.hover;
    if (end) {
      if (this.tool.kind === 'road')
        this.sim.placeRoadLine(this.start.x, this.start.y, end.x, end.y);
      else if (this.tool.kind === 'bulldoze') {
        this.sim.bulldozeRect(this.start.x, this.start.y, end.x, end.y);
      }
    }
    this.start = undefined;
    this.refreshPreview();
  };
}
