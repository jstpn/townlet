export type PointerButton = 0 | 1 | 2;
type Handler = (button: PointerButton) => void;

/** One source of truth for where the pointer is over the canvas, plus button events. */
export class Pointer {
  x = 0;
  y = 0;
  inside = false;
  private readonly downHandlers: Handler[] = [];
  private readonly upHandlers: Handler[] = [];
  private readonly moveHandlers: (() => void)[] = [];

  constructor(private readonly element: HTMLElement) {
    element.addEventListener('contextmenu', this.handleContextMenu);
    element.addEventListener('pointerdown', this.handleDown);
    element.addEventListener('pointerleave', this.handleLeave);
    window.addEventListener('pointermove', this.handleMove);
    window.addEventListener('pointerup', this.handleUp);
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

  dispose(): void {
    this.element.removeEventListener('contextmenu', this.handleContextMenu);
    this.element.removeEventListener('pointerdown', this.handleDown);
    this.element.removeEventListener('pointerleave', this.handleLeave);
    window.removeEventListener('pointermove', this.handleMove);
    window.removeEventListener('pointerup', this.handleUp);
  }

  private readonly handleContextMenu = (e: Event): void => e.preventDefault();

  private readonly handleDown = (e: PointerEvent): void => {
    this.track(e);
    if (e.button === 1 || e.button === 2) e.preventDefault();
    if (e.button <= 2) for (const h of this.downHandlers) h(e.button as PointerButton);
  };

  private readonly handleMove = (e: PointerEvent): void => {
    this.track(e);
    for (const h of this.moveHandlers) h();
  };

  private readonly handleUp = (e: PointerEvent): void => {
    if (e.button <= 2) for (const h of this.upHandlers) h(e.button as PointerButton);
  };

  private readonly handleLeave = (): void => {
    this.inside = false;
  };

  private track(e: PointerEvent): void {
    this.x = e.clientX;
    this.y = e.clientY;
    this.inside = true;
  }
}
