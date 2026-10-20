import type { CameraRig } from '../render/camera';

const PAN_SPEED = 1.1; // screen heights per second
const EDGE = 14; // px

/** Mouse and keyboard camera control. Build tools attach separately. */
export class CameraControls {
  private readonly keys = new Set<string>();
  private pointer = { x: 0, y: 0, inside: false };
  private drag: { button: number; lastX: number; lastY: number } | undefined;

  constructor(
    private readonly rig: CameraRig,
    private readonly element: HTMLElement,
  ) {
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointerleave', () => (this.pointer.inside = false));
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get pointerNdc(): { x: number; y: number } {
    return {
      x: (this.pointer.x / this.element.clientWidth) * 2 - 1,
      y: -(this.pointer.y / this.element.clientHeight) * 2 + 1,
    };
  }

  update(dt: number): void {
    let right = 0;
    let up = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) right -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) right += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) up += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) up -= 1;
    if (this.pointer.inside && !this.drag && document.hasFocus()) {
      const w = this.element.clientWidth;
      const h = this.element.clientHeight;
      if (this.pointer.x < EDGE) right -= 1;
      if (this.pointer.x > w - EDGE) right += 1;
      if (this.pointer.y < EDGE) up += 1;
      if (this.pointer.y > h - EDGE) up -= 1;
    }
    if (right !== 0 || up !== 0) {
      const len = Math.hypot(right, up);
      this.rig.pan((right / len) * PAN_SPEED * dt, (up / len) * PAN_SPEED * dt);
    }
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.0012);
    this.rig.zoomBy(factor, this.pointerNdc);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.pointer = { x: e.clientX, y: e.clientY, inside: true };
    if (e.button === 1 || e.button === 2) {
      this.drag = { button: e.button, lastX: e.clientX, lastY: e.clientY };
      e.preventDefault();
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.pointer = { x: e.clientX, y: e.clientY, inside: true };
    if (!this.drag) return;
    const dx = e.clientX - this.drag.lastX;
    const dy = e.clientY - this.drag.lastY;
    this.drag.lastX = e.clientX;
    this.drag.lastY = e.clientY;
    if (this.drag.button === 2) {
      this.rig.dragYaw += dx * 0.006;
    } else {
      const h = this.element.clientHeight;
      this.rig.pan((-dx / h) * 2, (dy / h) * 2);
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.drag?.button !== e.button) return;
    if (this.drag.button === 2) this.rig.commitDrag();
    this.drag = undefined;
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (e.repeat) return;
    if (key === 'q') this.rig.rotate(-1);
    else if (key === 'e') this.rig.rotate(1);
    else this.keys.add(key);
  };
}
