import type { Box, Motion, Obstacle, Ring, CatchWindow } from './types';
import type { Vec } from './vec';
import { clamp } from './vec';

/** Offset produced by a deterministic motion at absolute challenge clock `t`. */
export function motionOffset(m: Motion | undefined, t: number): number {
  if (!m) return 0;
  return m.amplitude * Math.sin(2 * Math.PI * (t / m.period + (m.phase ?? 0)));
}

export function boxAt<T extends Box & { motion?: Motion }>(b: T, t: number): Box {
  const o = motionOffset(b.motion, t);
  if (!b.motion) return { x: b.x, y: b.y, w: b.w, h: b.h };
  return b.motion.axis === 'x'
    ? { x: b.x + o, y: b.y, w: b.w, h: b.h }
    : { x: b.x, y: Math.max(0, b.y + o), w: b.w, h: b.h };
}

export const obstacleAt = (o: Obstacle, t: number): Box => boxAt(o, t);
export const windowAt = (w: CatchWindow, t: number): Box => boxAt(w, t);

export function ringAt(r: Ring, t: number): Vec {
  const o = motionOffset(r.motion, t);
  if (!r.motion) return { x: r.x, y: r.y };
  return r.motion.axis === 'x' ? { x: r.x + o, y: r.y } : { x: r.x, y: r.y + o };
}

export interface Contact {
  nx: number;
  ny: number;
  depth: number;
}

/** Circle vs axis-aligned box. Returns the push-out normal when overlapping. */
export function circleBox(p: Vec, r: number, b: Box): Contact | null {
  const cx = clamp(p.x, b.x, b.x + b.w);
  const cy = clamp(p.y, b.y, b.y + b.h);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Centre is inside the box: push out through the nearest face.
  const left = p.x - b.x;
  const right = b.x + b.w - p.x;
  const bottom = p.y - b.y;
  const top = b.y + b.h - p.y;
  const m = Math.min(left, right, bottom, top);
  if (m === top) return { nx: 0, ny: 1, depth: top + r };
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  if (m === right) return { nx: 1, ny: 0, depth: right + r };
  return { nx: 0, ny: -1, depth: bottom + r };
}

export function pointInBox(p: Vec, b: Box, pad = 0): boolean {
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}
