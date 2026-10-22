/**
 * Pointer + keyboard input for the play canvas. Touch is the primary path; mouse and pen
 * share the same pointer code. Pointers that were down when the game state changes can be
 * "consumed" so they never trigger an accidental launch or boost.
 */
export interface Touch {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  /** performance.now() at press. */
  t0: number;
  consumed: boolean;
}

export interface InputHandlers {
  down(t: Touch): void;
  move(t: Touch): void;
  up(t: Touch, cancelled: boolean): void;
  key(code: string, down: boolean, repeat: boolean): void;
}

export class Input {
  readonly touches = new Map<number, Touch>();
  readonly keys = new Set<string>();
  private handlers: InputHandlers | null = null;
  private el: HTMLElement | null = null;

  attach(el: HTMLElement, handlers: InputHandlers): void {
    this.el = el;
    this.handlers = handlers;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('lostpointercapture', this.onCancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.reset());
  }

  private pos(e: PointerEvent): { x: number; y: number } {
    const r = this.el!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button > 0) return;
    e.preventDefault();
    try {
      this.el!.setPointerCapture(e.pointerId);
    } catch {
      /* not supported */
    }
    const p = this.pos(e);
    const t: Touch = { id: e.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y, t0: performance.now(), consumed: false };
    this.touches.set(e.pointerId, t);
    this.handlers?.down(t);
  };

  private onMove = (e: PointerEvent): void => {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    const p = this.pos(e);
    t.x = p.x;
    t.y = p.y;
    if (!t.consumed) this.handlers?.move(t);
  };

  private onUp = (e: PointerEvent): void => this.release(e, false);
  private onCancel = (e: PointerEvent): void => this.release(e, true);

  private release(e: PointerEvent, cancelled: boolean): void {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    this.touches.delete(e.pointerId);
    if (!cancelled) {
      const p = this.pos(e);
      t.x = p.x;
      t.y = p.y;
    }
    if (!t.consumed) this.handlers?.up(t, cancelled);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT') && (e.code === 'Space' || e.code === 'Enter')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    const repeat = e.repeat || this.keys.has(e.code);
    this.keys.add(e.code);
    this.handlers?.key(e.code, true, repeat);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.handlers?.key(e.code, false, false);
  };

  /** Mark every current pointer and key as used up; they must be released before counting again. */
  consumeAll(): void {
    for (const t of this.touches.values()) t.consumed = true;
    this.keys.clear();
  }

  /** Forget everything (tab hidden, window blurred). */
  reset(): void {
    this.touches.clear();
    this.keys.clear();
  }

  /** The oldest live (unconsumed) pointer. */
  active(): Touch | null {
    for (const t of this.touches.values()) if (!t.consumed) return t;
    return null;
  }
}
