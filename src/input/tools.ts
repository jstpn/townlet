import type { CameraRig } from '../render/camera';
import type { CursorLayer } from '../render/cursor';
import { inBounds } from '../sim/grid';
import type { Sim } from '../sim/sim';

export type Tool = { kind: 'none' } | { kind: 'road' } | { kind: 'bulldoze' };

type Tile = { x: number; y: number };

const VALID = '#ffffff';
const INVALID = '#c4453a';

/** Turns left-button pointer gestures into sim commands, with a tile preview while dragging. */
export class BuildTool {
  tool: Tool = { kind: 'none' };
  private start: Tile | undefined;
  private hover: Tile | undefined;

  constructor(
    private readonly sim: Sim,
    private readonly rig: CameraRig,
    private readonly cursor: CursorLayer,
    private readonly element: HTMLElement,
  ) {
    element.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.setTool({ kind: 'none' });
    });
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.start = undefined;
    this.refreshPreview();
  }

  private tileAt(clientX: number, clientY: number): Tile | undefined {
    const ndc = {
      x: (clientX / this.element.clientWidth) * 2 - 1,
      y: -(clientY / this.element.clientHeight) * 2 + 1,
    };
    const point = this.rig.groundPoint(ndc);
    if (!point) return undefined;
    const x = Math.floor(point.x);
    const y = Math.floor(point.z);
    return inBounds(x, y) ? { x, y } : undefined;
  }

  /** The straight line the road tool would lay from the drag start to the hovered tile. */
  private lineTiles(from: Tile, to: Tile): Tile[] {
    const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
    const end = horizontal ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
    const tiles: Tile[] = [];
    const dx = Math.sign(end.x - from.x);
    const dy = Math.sign(end.y - from.y);
    const steps = Math.max(Math.abs(end.x - from.x), Math.abs(end.y - from.y));
    for (let i = 0; i <= steps; i++) tiles.push({ x: from.x + dx * i, y: from.y + dy * i });
    return tiles;
  }

  private refreshPreview(): void {
    if (this.tool.kind === 'none' || !this.hover) {
      this.cursor.clear();
      return;
    }
    const tiles = this.start ? this.lineTiles(this.start, this.hover) : [this.hover];
    this.cursor.setTiles(tiles, this.tool.kind === 'bulldoze' ? INVALID : VALID);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.tool.kind === 'none') return;
    this.start = this.tileAt(e.clientX, e.clientY);
    this.hover = this.start;
    this.refreshPreview();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.hover = this.tileAt(e.clientX, e.clientY);
    this.refreshPreview();
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 0 || !this.start) return;
    const end = this.tileAt(e.clientX, e.clientY) ?? this.start;
    const tiles = this.lineTiles(this.start, end);
    const first = tiles[0] ?? this.start;
    const last = tiles[tiles.length - 1] ?? this.start;
    if (this.tool.kind === 'road') {
      this.sim.placeRoadLine(first.x, first.y, last.x, last.y);
    } else if (this.tool.kind === 'bulldoze') {
      for (const tile of tiles) this.sim.bulldoze(tile.x, tile.y);
    }
    this.start = undefined;
    this.refreshPreview();
  };
}
