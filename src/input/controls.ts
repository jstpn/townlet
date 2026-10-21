import type { CameraRig } from '../render/camera';
import type { Pointer } from './pointer';

const PAN_SPEED = 1.1; // screen heights per second
const EDGE = 14; // px

type Pinch = { distance: number; angle: number; x: number; y: number };

/**
 * Camera movement: held keys, edge pan, wheel zoom, middle-drag pan, right-drag rotate, and on
 * touch screens two fingers to pinch, drag and twist.
 */
export class CameraControls {
  private readonly held = new Set<string>();
  private drag: { button: 1 | 2; lastX: number; lastY: number } | undefined;
  private pinch: Pinch | undefined;

  constructor(
    private readonly rig: CameraRig,
    private readonly pointer: Pointer,
    private readonly element: HTMLElement,
  ) {
    element.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    pointer.onDown(this.onPointerDown);
    pointer.onMove(this.onPointerMove);
    pointer.onUp(this.onPointerUp);
  }

  dispose(): void {
    this.element.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  update(dt: number): void {
    if (this.pinch && this.pointer.touches.size < 2) {
      this.pinch = undefined;
      this.rig.commitDrag();
    }
    let right = 0;
    let up = 0;
    if (this.held.has('a') || this.held.has('arrowleft')) right -= 1;
    if (this.held.has('d') || this.held.has('arrowright')) right += 1;
    if (this.held.has('w') || this.held.has('arrowup')) up += 1;
    if (this.held.has('s') || this.held.has('arrowdown')) up -= 1;
    if (this.pointer.inside && !this.drag && document.hasFocus()) {
      if (this.pointer.x < EDGE) right -= 1;
      if (this.pointer.x > this.element.clientWidth - EDGE) right += 1;
      if (this.pointer.y < EDGE) up += 1;
      if (this.pointer.y > this.element.clientHeight - EDGE) up -= 1;
    }
    if (right !== 0 || up !== 0) {
      const len = Math.hypot(right, up);
      this.rig.pan((right / len) * PAN_SPEED * dt, (up / len) * PAN_SPEED * dt);
    }
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.rig.zoomBy(Math.exp(e.deltaY * 0.0012), this.pointer.ndc);
  };

  private readonly onPointerDown = (button: number): void => {
    if (button === 1 || button === 2) {
      this.drag = { button, lastX: this.pointer.x, lastY: this.pointer.y };
    }
  };

  private readonly onPointerMove = (): void => {
    if (this.pointer.touches.size >= 2) return this.onPinch();
    if (!this.drag) return;
    const dx = this.pointer.x - this.drag.lastX;
    const dy = this.pointer.y - this.drag.lastY;
    this.drag.lastX = this.pointer.x;
    this.drag.lastY = this.pointer.y;
    if (this.drag.button === 2) {
      this.rig.dragYaw += dx * 0.006;
    } else {
      const h = this.element.clientHeight;
      this.rig.pan((-dx / h) * 2, (dy / h) * 2);
    }
  };

  /** Two fingers: their midpoint pans, their distance zooms and their angle rotates. */
  private onPinch(): void {
    const [a, b] = [...this.pointer.touches.values()];
    const next: Pinch = {
      distance: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
    if (this.pinch) {
      const h = this.element.clientHeight;
      this.rig.zoomBy(this.pinch.distance / next.distance, this.pointer.ndc);
      this.rig.pan((-(next.x - this.pinch.x) / h) * 2, ((next.y - this.pinch.y) / h) * 2);
      let twist = next.angle - this.pinch.angle;
      if (twist > Math.PI) twist -= 2 * Math.PI;
      if (twist < -Math.PI) twist += 2 * Math.PI;
      this.rig.dragYaw += twist;
    }
    this.pinch = next;
  }

  private readonly onPointerUp = (button: number): void => {
    if (this.drag?.button !== button) return;
    if (button === 2) this.rig.commitDrag();
    this.drag = undefined;
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // Shortcuts with modifiers belong to the browser, and macOS drops the matching keyup, so
    // a modifier press releases everything rather than leaving a key stuck.
    if (e.metaKey || e.ctrlKey || e.altKey) {
      this.held.clear();
      return;
    }
    const key = e.key.toLowerCase();
    if (!e.repeat && (key === 'q' || key === 'e')) this.rig.rotate(key === 'q' ? -1 : 1);
    this.held.add(key);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.key.toLowerCase());
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    if (this.drag?.button === 2) this.rig.commitDrag();
    this.drag = undefined;
  };
}
