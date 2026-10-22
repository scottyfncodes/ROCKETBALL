import type { Challenge } from '../config/challenges';
import type { Box, Obstacle } from '../sim/types';
import { obstacleAt, ringAt, windowAt } from '../sim/world';
import type { Camera } from './camera';
import { THEMES } from './theme';

export type Pose =
  | { kind: 'stand' }
  | { kind: 'throw'; arm: number; t: number }
  | { kind: 'reach'; lift: number }
  | { kind: 'block' }
  | { kind: 'keeper'; lift: number }
  | { kind: 'kick'; t: number }
  | { kind: 'bat'; swing: number; plane: 'lift' | 'drive' }
  | { kind: 'pitch'; t: number };

export interface Kit {
  jersey: string;
  trim: string;
  skin?: string;
  helmet?: boolean;
  cap?: boolean;
  gloves?: string;
}

const OUTLINE = 'rgba(8,10,25,0.9)';

function limb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w + 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Stylised athlete. (fx, fy) = feet on screen, H = standing height in px, facing right.
 * Built from a few bold shapes so it reads at small sizes.
 */
export function drawAthlete(ctx: CanvasRenderingContext2D, fx: number, fy: number, H: number, kit: Kit, pose: Pose, face = 1): void {
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(face, 1);
  const skin = kit.skin ?? '#c98d5e';
  const u = H / 10;
  const hipY = -u * 4.4;
  const shY = -u * 7.6;
  const headR = u * 1.05;
  let legSpread = u * 0.9;
  let lean = 0;
  if (pose.kind === 'kick') {
    legSpread = u * 1.4;
    lean = -u * 0.4;
  }
  if (pose.kind === 'bat') lean = -u * 0.3;

  // Legs
  const legW = u * 1.2;
  if (pose.kind === 'kick') {
    const k = Math.sin(Math.min(1, pose.t) * Math.PI);
    limb(ctx, 0, hipY, -legSpread, 0, legW, kit.trim);
    limb(ctx, 0, hipY, u * (1 + k * 3), -u * k * 2.2, legW, kit.trim);
  } else {
    limb(ctx, 0, hipY, -legSpread, 0, legW, kit.trim);
    limb(ctx, 0, hipY, legSpread, 0, legW, kit.trim);
  }
  // Torso
  ctx.fillStyle = kit.jersey;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const tw = u * (kit.helmet ? 2.6 : 2.1);
  ctx.moveTo(lean - tw / 2, shY);
  ctx.lineTo(lean + tw / 2, shY);
  ctx.lineTo(tw * 0.38, hipY + u * 0.3);
  ctx.lineTo(-tw * 0.38, hipY + u * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Jersey stripe
  ctx.fillStyle = kit.trim;
  ctx.fillRect(lean - tw / 2 + 2, shY + u * 1.2, tw - 4, u * 0.5);

  // Arms
  const armW = u * 0.85;
  const sx = lean;
  const sy = shY + u * 0.3;
  const armC = kit.gloves ?? skin;
  switch (pose.kind) {
    case 'throw': {
      const a = pose.arm;
      const ex = sx + Math.cos(a) * u * 3.4;
      const ey = sy - Math.sin(a) * u * 3.4;
      limb(ctx, sx, sy, ex, ey, armW, skin);
      limb(ctx, sx, sy, sx + u * 2, sy + u * 1.4, armW, skin);
      break;
    }
    case 'reach': {
      const l = pose.lift;
      limb(ctx, sx, sy, sx - u * 0.6, sy - u * (2.4 + l), armW, armC);
      limb(ctx, sx, sy, sx + u * 0.6, sy - u * (2.4 + l), armW, armC);
      break;
    }
    case 'keeper': {
      const l = pose.lift;
      limb(ctx, sx, sy, sx - u * 1.6, sy - u * (2.2 + l), armW, armC);
      limb(ctx, sx, sy, sx + u * 1.6, sy - u * (2.2 + l), armW, armC);
      break;
    }
    case 'block':
      limb(ctx, sx, sy, sx + u * 1.2, sy + u * 1.8, armW, skin);
      limb(ctx, sx, sy, sx - u * 0.6, sy + u * 1.9, armW, skin);
      break;
    case 'bat': {
      const sw = pose.swing;
      const start = 2.3;
      const end = pose.plane === 'lift' ? -0.35 : -0.05;
      const a = sw < 0 ? start : start + (end - start) * sw;
      const hx = sx + u * 1.3 + (sw > 0 ? u * sw * 0.8 : 0);
      const hy = sy + u * 1.4;
      limb(ctx, sx, sy, hx, hy, armW, skin);
      // Bat
      const bx = hx + Math.cos(a) * u * 4.2;
      const by = hy - Math.sin(a) * u * 4.2;
      limb(ctx, hx, hy, bx, by, u * 0.75, '#c08a4a');
      break;
    }
    case 'pitch': {
      const t = pose.t;
      const a = t < 0.7 ? 2.6 + t * 1.2 : 3.4 - (t - 0.7) * 10;
      limb(ctx, sx, sy, sx + Math.cos(a) * u * 3.2, sy - Math.sin(a) * u * 3.2, armW, skin);
      limb(ctx, sx, sy, sx + u * 1.6, sy + u, armW, kit.gloves ?? '#5a3b1e');
      break;
    }
    default:
      limb(ctx, sx, sy, sx - u * 0.8, sy + u * 2.4, armW, skin);
      limb(ctx, sx, sy, sx + u * 0.8, sy + u * 2.4, armW, skin);
  }

  // Head
  const hx = lean;
  const hy = shY - headR * 0.9;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hx, hy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (kit.helmet) {
    ctx.fillStyle = kit.jersey;
    ctx.beginPath();
    ctx.arc(hx, hy - headR * 0.1, headR * 1.15, Math.PI * 0.95, Math.PI * 2.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = kit.trim;
    ctx.lineWidth = Math.max(1.5, u * 0.25);
    ctx.beginPath();
    ctx.moveTo(hx + headR * 0.6, hy - headR * 0.1);
    ctx.lineTo(hx + headR * 1.25, hy + headR * 0.3);
    ctx.moveTo(hx + headR * 0.7, hy + headR * 0.4);
    ctx.lineTo(hx + headR * 1.25, hy + headR * 0.55);
    ctx.stroke();
  } else if (kit.cap) {
    ctx.fillStyle = kit.trim;
    ctx.beginPath();
    ctx.arc(hx, hy - headR * 0.2, headR * 1.02, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(hx, hy - headR * 0.35, headR * 1.5, headR * 0.3);
  } else {
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath();
    ctx.arc(hx, hy - headR * 0.25, headR * 0.95, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }
  ctx.restore();
}

function drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number): void {
  // Body
  ctx.fillStyle = '#1b1f33';
  ctx.strokeStyle = '#ff3d5a';
  ctx.lineWidth = 2;
  const r = Math.min(h * 0.5, 10);
  ctx.beginPath();
  ctx.roundRect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.6, r);
  ctx.fill();
  ctx.stroke();
  // Hazard stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.6);
  ctx.clip();
  ctx.fillStyle = '#ffd23f';
  for (let i = -2; i < 20; i++) {
    const sx = x + w * 0.15 + i * h * 0.8;
    ctx.beginPath();
    ctx.moveTo(sx, y + h * 0.8);
    ctx.lineTo(sx + h * 0.4, y + h * 0.8);
    ctx.lineTo(sx + h * 0.8, y + h * 0.2);
    ctx.lineTo(sx + h * 0.4, y + h * 0.2);
    ctx.fill();
  }
  ctx.restore();
  // Rotors
  for (const fx of [0.08, 0.92]) {
    const cx = x + w * fx;
    ctx.fillStyle = '#1b1f33';
    ctx.fillRect(cx - 2, y - 2, 4, h * 0.4);
    ctx.fillStyle = 'rgba(220,230,255,0.5)';
    const span = w * 0.16 * (0.6 + 0.4 * Math.abs(Math.sin(time * 40 + fx * 9)));
    ctx.beginPath();
    ctx.ellipse(cx, y - 2, span, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Warning light
  ctx.fillStyle = Math.sin(time * 8) > 0 ? '#ff3d5a' : '#5a0d1a';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h + 3, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawWallPad(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string): void {
  ctx.fillStyle = '#1f5a3a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x - 2, y, w + 4, Math.max(3, w * 0.12));
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let yy = y + 10; yy < y + h; yy += 14) {
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x + w / 2, y + Math.min(h * 0.5, 60));
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${Math.max(9, Math.min(w * 0.7, 20))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawBillboard(ctx: CanvasRenderingContext2D, cam: Camera, b: Box, time: number, hit: boolean): void {
  const x = cam.sx(b.x);
  const y = cam.sy(b.y + b.h);
  const w = b.w * cam.scale;
  const h = b.h * cam.scale;
  // Pole (decorative)
  ctx.fillStyle = '#3a4252';
  ctx.fillRect(x + w / 2 - 3, y + h, 6, cam.sy(0) - (y + h));
  // Face: drawn wide for readability, facing the batter.
  const fw = Math.max(w * 2.4, 26);
  const fx = x + w / 2 - fw / 2;
  ctx.fillStyle = hit ? '#ffd23f' : '#14152a';
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(fx, y, fw, h, 6);
  ctx.fill();
  ctx.stroke();
  // Bullseye
  const pulse = 1 + Math.sin(time * 5) * 0.06;
  const cx = fx + fw / 2;
  const cy = y + h / 2;
  const R = Math.min(fw, h) * 0.38 * pulse;
  for (let i = 3; i >= 1; i--) {
    ctx.fillStyle = i % 2 ? '#ff3b3b' : '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, (R * i) / 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draws the challenge's objective structures that sit behind the ball (goal frame, end zone posts). */
export function drawObjectiveBack(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge, time: number): void {
  const obj = ch.objective;
  const th = THEMES[ch.sport];
  if (obj.type === 'endzone') {
    // Goal post at the back of the end zone.
    const px = cam.sx(obj.x1);
    const base = cam.sy(0);
    const s = cam.scale;
    ctx.strokeStyle = th.accent2;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, s * 0.25);
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.lineTo(px, base - 3 * s);
    ctx.lineTo(px + 1.2 * s, base - 3 * s);
    ctx.lineTo(px + 1.2 * s, base - 9 * s);
    ctx.stroke();
    if (obj.window) {
      const w = windowAt(obj.window, time);
      drawReceiver(ctx, cam, w, time);
    }
  } else if (obj.type === 'goal') {
    const x = cam.sx(obj.x);
    const xb = cam.sx(obj.x + obj.depth);
    const top = cam.sy(obj.height);
    const base = cam.sy(0);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    const step = Math.max(5, cam.scale * 0.35);
    ctx.beginPath();
    for (let yy = top; yy <= base; yy += step) {
      ctx.moveTo(x, yy);
      ctx.lineTo(xb, yy + (base - yy) * 0.08);
    }
    for (let xx = x; xx <= xb; xx += step) {
      ctx.moveTo(xx, top + ((xx - x) / Math.max(1, xb - x)) * (base - top) * 0.15);
      ctx.lineTo(xx, base);
    }
    ctx.stroke();
    ctx.strokeStyle = '#e8ecf5';
    ctx.lineWidth = Math.max(2, cam.scale * 0.12);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(xb, top + (base - top) * 0.15);
    ctx.lineTo(xb, base);
    ctx.stroke();
    ctx.restore();
  }
}

/** Goal posts that sit in front of the ball. */
export function drawObjectiveFront(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge): void {
  const obj = ch.objective;
  if (obj.type !== 'goal') return;
  const x = cam.sx(obj.x);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, cam.scale * 0.3);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, cam.sy(0));
  ctx.lineTo(x, cam.sy(obj.height));
  ctx.stroke();
}

function drawReceiver(ctx: CanvasRenderingContext2D, cam: Camera, w: Box, time: number): void {
  const th = THEMES.football;
  const fx = cam.sx(w.x + w.w / 2);
  const H = 4.2 * cam.scale;
  drawAthlete(ctx, fx, cam.sy(0), H, { jersey: th.home[0], trim: th.home[1], helmet: true }, { kind: 'reach', lift: 0.4 + Math.sin(time * 6) * 0.2 });
  // Target window glow.
  const x = cam.sx(w.x);
  const y = cam.sy(w.y + w.h);
  const pw = w.w * cam.scale;
  const ph = w.h * cam.scale;
  ctx.save();
  ctx.strokeStyle = th.accent2;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -time * 30;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, pw, ph);
  ctx.fillStyle = 'rgba(255,210,63,0.16)';
  ctx.fillRect(x, y, pw, ph);
  ctx.restore();
}

export function drawObstacles(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge, time: number, hits: ReadonlySet<string>): void {
  const th = THEMES[ch.sport];
  for (const o of ch.obstacles) {
    const b = obstacleAt(o, time);
    if (cam.sx(b.x + b.w) < -40 || cam.sx(b.x) > cam.vp.w + 40) continue;
    drawObstacle(ctx, cam, o, b, time, th, hits.has(o.id));
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, cam: Camera, o: Obstacle, b: Box, time: number, th: (typeof THEMES)['football'], hit: boolean): void {
  const s = cam.scale;
  const x = cam.sx(b.x);
  const y = cam.sy(b.y + b.h);
  const w = b.w * s;
  const h = b.h * s;
  const feet = cam.sy(b.y);
  switch (o.style) {
    case 'defender':
    case 'lineman': {
      const lift = b.y > 0.05 ? 1.2 : 0.2;
      // Shadow on the ground while airborne.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, cam.sy(0), w * 0.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      drawAthlete(ctx, x + w / 2, feet, h * 0.72, { jersey: th.away[0], trim: th.away[1], helmet: true }, { kind: 'reach', lift }, -1);
      break;
    }
    case 'keeper':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, cam.sy(0), w * 0.6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      drawAthlete(ctx, x + w / 2, feet, h * 0.74, { jersey: '#2bd96b', trim: '#0d3b1f', gloves: '#ffe14d' }, { kind: 'keeper', lift: b.y > 0.05 ? 0.8 : 0.2 }, -1);
      break;
    case 'wall': {
      const n = 2;
      for (let i = 0; i < n; i++) {
        drawAthlete(ctx, x + w * (0.3 + i * 0.4), feet, h, { jersey: th.away[0], trim: th.away[1] }, { kind: 'block' }, -1);
      }
      break;
    }
    case 'drone':
      drawDrone(ctx, x, y, w, h, time);
      break;
    case 'sign': {
      ctx.strokeStyle = '#9aa3b5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + 4, 0);
      ctx.moveTo(x + w - 4, y);
      ctx.lineTo(x + w - 4, 0);
      ctx.stroke();
      ctx.fillStyle = '#14152a';
      ctx.strokeStyle = th.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = th.accent2;
      ctx.font = `900 ${Math.max(9, h * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ROCKETBALL', x + w / 2, y + h / 2 + 1);
      break;
    }
    case 'outfieldWall':
      drawWallPad(ctx, x, y, w, h, `${Math.round(b.x)}m`);
      break;
    case 'billboard':
      drawBillboard(ctx, cam, b, time, hit);
      break;
    case 'crossbar': {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y, Math.max(w, 4) + 2, Math.max(h, 4));
      break;
    }
    default:
      ctx.fillStyle = '#888';
      ctx.fillRect(x, y, w, h);
  }
}

export function drawRings(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge, time: number, passed: ReadonlySet<string>): void {
  for (const r of ch.rings) {
    const c = ringAt(r, time);
    const x = cam.sx(c.x);
    const y = cam.sy(c.y);
    const R = r.r * cam.scale;
    const done = passed.has(r.id);
    const gold = r.required;
    ctx.save();
    ctx.lineWidth = Math.max(3, R * 0.16);
    ctx.strokeStyle = done ? 'rgba(255,255,255,0.35)' : gold ? '#ffd23f' : '#5cf2ff';
    ctx.shadowColor = gold ? '#ffb800' : '#00d9ff';
    ctx.shadowBlur = done ? 0 : 14;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (!done) {
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = time * 20;
      ctx.beginPath();
      ctx.arc(x, y, R * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = gold ? '#ffd23f' : '#bff9ff';
      ctx.font = `900 ${Math.max(10, Math.min(14, R * 0.4))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(gold ? 'MUST HIT' : `+${r.points}`, x, y - R - 4);
    }
    ctx.restore();
  }
}
