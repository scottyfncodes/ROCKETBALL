import type { Vec } from '../sim/vec';
import { clamp } from '../sim/vec';

/** Layout of the canvas in CSS pixels, including safe-area-aware reserved bands. */
export interface Viewport {
  w: number;
  h: number;
  dpr: number;
  /** Screen y of the ground line. */
  groundY: number;
  /** Space reserved at the top for the HUD + minimap. */
  top: number;
  safe: { top: number; right: number; bottom: number; left: number };
}

/** Side-on camera: world x/y (metres, y up) to screen pixels. */
export class Camera {
  left = -4;
  scale = 20;
  shakeX = 0;
  shakeY = 0;
  private shakeT = 0;
  private shakeAmp = 0;
  vp: Viewport = { w: 400, h: 800, dpr: 1, groundY: 680, top: 110, safe: { top: 0, right: 0, bottom: 0, left: 0 } };

  /** Default zoom: fits ~24 m across a portrait phone, more on wide screens. */
  baseScale(): number {
    const { w, h, groundY, top } = this.vp;
    // Portrait phones show ~19 m across; landscape screens show more of the course.
    const across = w < h ? 19 : 34;
    return clamp(Math.min(w / across, (groundY - top) / 15), 10, 46);
  }

  sx(x: number): number {
    return (x - this.left) * this.scale + this.shakeX;
  }
  sy(y: number): number {
    return this.vp.groundY - y * this.scale + this.shakeY;
  }
  toScreen(p: Vec): Vec {
    return { x: this.sx(p.x), y: this.sy(p.y) };
  }
  toWorld(px: number, py: number): Vec {
    return { x: (px - this.shakeX) / this.scale + this.left, y: (this.vp.groundY + this.shakeY - py) / this.scale };
  }
  /** World x at the right edge of the screen. */
  get right(): number {
    return this.left + this.vp.w / this.scale;
  }

  /** Smoothly move toward a framing. `k` is the per-second approach rate. */
  approach(left: number, scale: number, dt: number, k = 4): void {
    const a = 1 - Math.exp(-k * dt);
    this.scale += (scale - this.scale) * a;
    this.left += (left - this.left) * a;
  }

  /** Frame so that world x `x` sits at fraction `frac` of the screen width. */
  leftFor(x: number, frac: number, scale = this.scale): number {
    return x - (this.vp.w * frac) / scale;
  }

  shake(amount: number, enabled: boolean): void {
    if (!enabled) return;
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = 0.35;
  }

  updateShake(dt: number): void {
    if (this.shakeT <= 0) {
      this.shakeX = this.shakeY = 0;
      return;
    }
    this.shakeT -= dt;
    const a = this.shakeAmp * Math.max(0, this.shakeT / 0.35);
    this.shakeX = (Math.random() * 2 - 1) * a;
    this.shakeY = (Math.random() * 2 - 1) * a;
    if (this.shakeT <= 0) this.shakeAmp = 0;
  }
}
