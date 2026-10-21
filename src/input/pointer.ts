export type PointerButton = 0 | 1 | 2;
type Handler = (button: PointerButton) => void;

/**
 * One source of truth for where the pointer is over the canvas, plus button events. Touches are
 * tracked by id: one finger acts as the left button, and a second finger cancels that gesture and
 * hands the touches to the camera until they all lift.
 */
export class Pointer {
  x = 0;
  y = 0;
  inside = false;
  /** Live touch points by pointer id. */
  readonly touches = new Map<number, { x: number; y: number }>();
  private multi = false;
  private readonly downHandlers: Handler[] = [];
  private readonly upHandlers: Handler[] = [];
  private readonly moveHandlers: (() => void)[] = [];
  private readonly cancelHandlers: (() => void)[] = [];

  constructor(private readonly element: HTMLElement) {
    element.addEventListener('contextmenu', this.handleContextMenu);
    element.addEventListener('pointerdown', this.handleDown);
    element.addEventListener('pointerleave', this.handleLeave);
    window.addEventListener('pointermove', this.handleMove);
    window.addEventListener('pointerup', this.handleUp);
    window.addEventListener('pointercancel', this.handleUp);
  }

  /** Normalised device coordinates of the pointer, -1 to 1 on both axes. */
  get ndc(): { x: number; y: number } {
    return {
      x: (this.x / this.element.clientWidth) * 2 - 1,
      y: -(this.y / this.element.clientHeight) * 2 + 1,
    };
  }

  onDown(handler: Handler): void {
    this.downHandlers.push(handler);
  }

  onUp(handler: Handler): void {
    this.upHandlers.push(handler);
  }

  onMove(handler: () => void): void {
    this.moveHandlers.push(handler);
  }

  /** A gesture in progress has been taken over by a second finger. */
  onCancel(handler: () => void): void {
    this.cancelHandlers.push(handler);
  }

  dispose(): void {
    this.element.removeEventListener('contextmenu', this.handleContextMenu);
    this.element.removeEventListener('pointerdown', this.handleDown);
    this.element.removeEventListener('pointerleave', this.handleLeave);
    window.removeEventListener('pointermove', this.handleMove);
    window.removeEventListener('pointerup', this.handleUp);
    window.removeEventListener('pointercancel', this.handleUp);
  }

  private readonly handleContextMenu = (e: Event): void => e.preventDefault();

  private readonly handleDown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size >= 2) {
        if (!this.multi) for (const h of this.cancelHandlers) h();
        this.multi = true;
        this.track(e);
        return;
      }
    }
    this.track(e);
    if (e.button === 1 || e.button === 2) e.preventDefault();
    if (e.button <= 2) for (const h of this.downHandlers) h(e.button as PointerButton);
  };

  private readonly handleMove = (e: PointerEvent): void => {
    const touch = this.touches.get(e.pointerId);
    if (touch) {
      touch.x = e.clientX;
      touch.y = e.clientY;
    }
    this.track(e);
    for (const h of this.moveHandlers) h();
  };

  private readonly handleUp = (e: PointerEvent): void => {
    const touch = e.pointerType === 'touch';
    if (touch) this.touches.delete(e.pointerId);
    if (this.multi) {
      if (this.touches.size === 0) this.multi = false;
    } else if (e.button <= 2) {
      for (const h of this.upHandlers) h(e.button as PointerButton);
    }
    // A lifted finger hovers nothing, so the preview and edge pan let go.
    if (touch && this.touches.size === 0) this.inside = false;
  };

  private readonly handleLeave = (): void => {
    this.inside = false;
  };

  /** With two fingers down the pointer sits between them, so zoom anchors on the pinch. */
  private track(e: PointerEvent): void {
    if (this.touches.size >= 2) {
      let x = 0;
      let y = 0;
      for (const t of this.touches.values()) {
        x += t.x;
        y += t.y;
      }
      this.x = x / this.touches.size;
      this.y = y / this.touches.size;
    } else {
      this.x = e.clientX;
      this.y = e.clientY;
    }
    this.inside = true;
  }
}
