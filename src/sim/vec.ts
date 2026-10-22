export interface Vec {
  x: number;
  y: number;
}

export const v = (x = 0, y = 0): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const norm = (a: Vec): Vec => {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 };
};
/** Rotate counter-clockwise (y up) by `rad`. */
export const rotate = (a: Vec, rad: number): Vec => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
/** Perpendicular, rotated 90° counter-clockwise (y up). */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const clamp = (n: number, lo: number, hi: number): number => (n < lo ? lo : n > hi ? hi : n);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const fromAngle = (rad: number, mag = 1): Vec => ({ x: Math.cos(rad) * mag, y: Math.sin(rad) * mag });
export const deg = (d: number): number => (d * Math.PI) / 180;

/** Shortest distance from point p to segment ab. */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
