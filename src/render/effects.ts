import type { Vec } from '../sim/vec';
import type { Camera } from './camera';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  /** Gravity in units/s² (world: m, screen: px). */
  g: number;
  drag: number;
  /** World-space particles move with the camera; screen-space ones (celebrations) don't. */
  world: boolean;
  additive: boolean;
  shape: 'dot' | 'rect' | 'spark';
  spin: number;
  angle: number;
}

export interface FloatText {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
  size: number;
  world: boolean;
}

export interface Ripple {
  x: number;
  y: number;
  t: number;
  max: number;
  color: string;
  world: boolean;
}

const MAX_PARTICLES = 700;

/** Pooled particles, floating text and shockwave rings. */
export class Effects {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  ripples: Ripple[] = [];
  flash = 0;
  /** Particle density multiplier (reduced motion lowers it). */
  density = 1;

  clear(): void {
    this.particles.length = 0;
    this.texts.length = 0;
    this.ripples.length = 0;
    this.flash = 0;
  }

  emit(p: Partial<Particle> & { x: number; y: number }): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({
      vx: 0, vy: 0, life: 0.6, max: 0.6, size: 3, color: '#fff', g: 0, drag: 0, world: true,
      additive: false, shape: 'dot', spin: 0, angle: 0, ...p,
    });
  }

  burst(at: Vec, n: number, colors: string[], speed: number, opts: Partial<Particle> = {}): void {
    const count = Math.round(n * this.density);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      const life = (opts.life ?? 0.7) * (0.6 + Math.random() * 0.6);
      this.emit({
        ...opts,
        x: at.x, y: at.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life,
        color: colors[i % colors.length], size: (opts.size ?? 3) * (0.6 + Math.random() * 0.8),
        spin: (Math.random() - 0.5) * 12, angle: Math.random() * 6,
      });
    }
  }

  text(text: string, at: Vec, color = '#fff', size = 18, world = true): void {
    this.texts.push({ text, x: at.x, y: at.y, t: 0, color, size, world });
  }

  ripple(at: Vec, max: number, color: string, world = true): void {
    this.ripples.push({ x: at.x, y: at.y, t: 0, max, color, world });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      // World particles use y-up; screen particles use y-down.
      p.vy += (p.world ? -p.g : p.g) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < 1.3);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 0.7);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    for (const r of this.ripples) {
      const k = r.t / 0.7;
      const x = r.world ? cam.sx(r.x) : r.x;
      const y = r.world ? cam.sy(r.y) : r.y;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(x, y, r.max * (0.2 + k * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      const k = Math.max(0, p.life / p.max);
      const x = p.world ? cam.sx(p.x) : p.x;
      const y = p.world ? cam.sy(p.y) : p.y;
      const size = p.world && p.shape === 'dot' ? p.size * (0.5 + 0.5 * k) : p.size;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        ctx.fillRect(-size, -size * 0.5, size * 2, size);
        ctx.restore();
      } else if (p.shape === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = size * 0.6;
        const sx = p.world ? p.vx * cam.scale : p.vx;
        const sy = p.world ? -p.vy * cam.scale : p.vy;
        const l = Math.hypot(sx, sy) || 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - (sx / l) * size * 4, y - (sy / l) * size * 4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const t of this.texts) {
      const k = t.t / 1.3;
      const x = t.world ? cam.sx(t.x) : t.x;
      const y = (t.world ? cam.sy(t.y) : t.y) - k * 40;
      const pop = t.t < 0.15 ? 0.6 + (t.t / 0.15) * 0.5 : 1.1 - Math.min(0.1, (t.t - 0.15) * 0.3);
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.font = `italic 900 ${t.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,10,30,0.85)';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, cam.vp.w, cam.vp.h);
    }
  }
}

export interface TrailPoint {
  x: number;
  y: number;
  boost: boolean;
}

/** Ball trail: faint streak when coasting, thick glowing ribbon while the rocket burns. */
export function drawTrail(ctx: CanvasRenderingContext2D, cam: Camera, pts: TrailPoint[], colors: [string, string], rainbow: boolean, time: number): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const n = pts.length;
  // Coasting streak.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = Math.max(0, n - 240); i < n; i++) {
    const p = pts[i];
    if (i === Math.max(0, n - 240)) ctx.moveTo(cam.sx(p.x), cam.sy(p.y));
    else ctx.lineTo(cam.sx(p.x), cam.sy(p.y));
  }
  ctx.stroke();
  // Boost ribbon.
  ctx.globalCompositeOperation = 'lighter';
  const w = Math.max(4, cam.scale * 0.55);
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!b.boost) continue;
    const age = (n - i) / n;
    ctx.globalAlpha = Math.max(0.1, 1 - age * 0.8);
    ctx.strokeStyle = rainbow ? `hsl(${(i * 6 + time * 200) % 360},100%,60%)` : i % 2 ? colors[0] : colors[1];
    ctx.lineWidth = w * (1 - age * 0.6);
    ctx.beginPath();
    ctx.moveTo(cam.sx(a.x), cam.sy(a.y));
    ctx.lineTo(cam.sx(b.x), cam.sy(b.y));
    ctx.stroke();
  }
  ctx.restore();
}
