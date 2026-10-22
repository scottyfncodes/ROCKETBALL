import type { FlightSim } from '../sim/simulation';
import type { LaunchParams } from '../sim/types';
import { clamp, deg } from '../sim/vec';
import { windowAt } from '../sim/world';
import { finalize, fuelBonus, ringBonus, type ScoreResult } from './scoring';

/** TOUCHDOWN — slingshot pass: pull back, release to throw. */
export const FOOTBALL = {
  launchPos: { x: 0, y: 2.2 },
  vMin: 9,
  vMax: 21,
  minAngle: deg(5),
  maxAngle: deg(72),
  /** Drag shorter than this fraction of the max is treated as a cancel. */
  deadZone: 0.12,
};

export interface PassAim {
  angle: number;
  power: number;
  valid: boolean;
}

/**
 * Convert a slingshot drag (screen pixels, y down; drag = current - start) into an aim.
 * Pull back and down-left to throw up and to the right.
 */
export function aimFromDrag(dx: number, dy: number, maxDrag: number): PassAim {
  const raw = Math.atan2(dy, -dx);
  const power = clamp(Math.hypot(dx, dy) / maxDrag, 0, 1);
  const angle = clamp(raw, FOOTBALL.minAngle, FOOTBALL.maxAngle);
  return { angle, power, valid: power >= FOOTBALL.deadZone && dx < Math.abs(dy) * 0.5 };
}

export function passLaunch(angle: number, power: number, clock: number): LaunchParams {
  const speed = FOOTBALL.vMin + (FOOTBALL.vMax - FOOTBALL.vMin) * clamp(power, 0, 1);
  return {
    pos: { ...FOOTBALL.launchPos },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    spin: 0,
    clock,
  };
}

export function scoreFootball(sim: FlightSim): ScoreResult {
  const out = sim.outcome;
  if (!out) return finalize(false, 'INCOMPLETE', []);
  const obj = sim.course.objective;
  let accuracy = 0;
  if (obj.type === 'endzone') {
    if (obj.window) {
      const w = windowAt(obj.window, sim.launch.clock + out.t);
      const cx = w.x + w.w / 2;
      const cy = w.y + w.h / 2;
      const d = Math.hypot(out.pos.x - cx, out.pos.y - cy);
      accuracy = 900 * clamp(1 - d / (Math.hypot(w.w, w.h) / 2 + 0.3), 0, 1);
    } else {
      const c = (obj.x0 + obj.x1) / 2;
      accuracy = 900 * clamp(1 - Math.abs(out.pos.x - c) / ((obj.x1 - obj.x0) / 2), 0, 1);
    }
  }
  return finalize(out.success, out.label, [
    { label: 'Touchdown', value: 1000 },
    { label: 'Accuracy', value: accuracy },
    { label: 'Pass distance', value: Math.max(0, out.pos.x) * 6 },
    { label: 'Fuel saved', value: fuelBonus(sim, 600) },
    { label: 'Rings', value: ringBonus(sim) },
  ]);
}
