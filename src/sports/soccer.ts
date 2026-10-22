import type { FlightSim } from '../sim/simulation';
import type { LaunchParams } from '../sim/types';
import { type Vec, clamp, deg } from '../sim/vec';
import { finalize, fuelBonus, ringBonus, type ScoreResult } from './scoring';

/** GOAL — swipe kick: swipe direction = angle, length = power, curve of the swipe = bend. */
export const SOCCER = {
  ballPos: { x: 0, y: 0.5 },
  vMin: 11,
  vMax: 23,
  minAngle: deg(2),
  maxAngle: deg(58),
  /** Spin at full curl. Positive = backspin (ball floats), negative = topspin (ball dips). */
  maxSpin: 7,
  /** Bulge (fraction of swipe length) that counts as full curl. */
  fullCurl: 0.3,
  minSwipeFrac: 0.08,
};

export interface Kick {
  angle: number;
  power: number;
  /** -1 (dip) .. +1 (float). */
  curl: number;
  valid: boolean;
}

/**
 * Read a swipe path (screen pixels, y down). `ref` is the swipe length that gives full power.
 * A swipe that arcs above its chord ("rainbow") gives topspin so the ball dips; a "smile" floats.
 */
export function kickFromSwipe(points: Vec[], ref: number): Kick {
  if (points.length < 2) return { angle: 0, power: 0, curl: 0, valid: false };
  const a = points[0];
  const b = points[points.length - 1];
  const cx = b.x - a.x;
  const cy = b.y - a.y;
  const chord = Math.hypot(cx, cy);
  const power = clamp(chord / ref, 0, 1);
  const angle = clamp(Math.atan2(-cy, cx), SOCCER.minAngle, SOCCER.maxAngle);
  let bulge = 0;
  if (chord > 1) {
    for (const p of points) {
      const d = (cx * (p.y - a.y) - cy * (p.x - a.x)) / chord;
      if (Math.abs(d) > Math.abs(bulge)) bulge = d;
    }
  }
  const curl = chord > 1 ? clamp(bulge / chord / SOCCER.fullCurl, -1, 1) : 0;
  return { angle, power, curl, valid: power >= SOCCER.minSwipeFrac && cx > 0 };
}

export function kickLaunch(angle: number, power: number, curl: number, clock: number): LaunchParams {
  const speed = SOCCER.vMin + (SOCCER.vMax - SOCCER.vMin) * clamp(power, 0, 1);
  return {
    pos: { ...SOCCER.ballPos },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    spin: clamp(curl, -1, 1) * SOCCER.maxSpin,
    clock,
  };
}

export function scoreSoccer(sim: FlightSim): ScoreResult {
  const out = sim.outcome;
  if (!out) return finalize(false, 'NO GOAL', []);
  const obj = sim.course.objective;
  const h = obj.type === 'goal' ? obj.height : 4;
  const corner = clamp(out.pos.y / h, 0, 1);
  const bend = Math.abs(sim.launch.spin) / SOCCER.maxSpin;
  return finalize(out.success, out.label, [
    { label: 'Goal', value: 1000 },
    { label: corner > 0.7 ? 'Top corner!' : 'Placement', value: 900 * corner * corner },
    { label: 'Bend', value: 500 * bend },
    { label: 'Fuel saved', value: fuelBonus(sim, 500) },
    { label: 'Rings', value: ringBonus(sim) },
  ]);
}
