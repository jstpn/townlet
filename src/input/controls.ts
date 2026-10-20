import type { CameraRig } from '../render/camera';
import type { Pointer } from './pointer';

const PAN_SPEED = 1.1; // screen heights per second
const EDGE = 14; // px

/** Camera movement: held keys, edge pan, wheel zoom, middle-drag pan, right-drag rotate. */
export class CameraControls {
  private readonly held = new Set<string>();
  private drag: { button: 1 | 2; lastX: number; lastY: number } | undefined;

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

  private readonly onPointerUp = (button: number): void => {
    if (this.drag?.button !== button) return;
    if (button === 2) this.rig.commitDrag();
    this.drag = undefined;
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.held.add(e.key.toLowerCase());
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.key.toLowerCase());
  };

  private readonly onBlur = (): void => this.held.clear();
}
