import type { FlightSim } from '../sim/simulation';
import type { LaunchParams } from '../sim/types';
import { type Vec, clamp, deg, lerp } from '../sim/vec';
import { finalize, fuelBonus, ringBonus, type ScoreResult } from './scoring';

/** HOME RUN — read the pitch, tap to swing. Tap high to lift it, low to drive it. */
export const BASEBALL = {
  mound: { x: 18, y: 2.0 },
  plate: { x: 0.6, y: 1.05 },
  contactPos: { x: 0.9, y: 1.1 },
  windup: 1.0,
  /** Seconds the ball keeps travelling past the plate on a miss. */
  followThrough: 0.5,
  vMin: 22,
  vMax: 37,
  liftAngle: deg(33),
  driveAngle: deg(19),
  /** Extra loft (early) or less loft (late) at the edge of the timing window. */
  timingAngle: deg(11),
  backspin: 3,
  strikesAllowed: 3,
};

export type PitchKind = 'meatball' | 'fastball' | 'changeup' | 'curveball' | 'heater';

export interface PitchType {
  kind: PitchKind;
  label: string;
  /** Seconds from release to the plate. */
  travel: number;
  /** Vertical bulge of the path (m). Positive = rises then drops (curveball). */
  bulge: number;
}

export const PITCHES: Record<PitchKind, PitchType> = {
  meatball: { kind: 'meatball', label: 'MEATBALL', travel: 1.45, bulge: 0.2 },
  fastball: { kind: 'fastball', label: 'FASTBALL', travel: 0.85, bulge: 0.1 },
  changeup: { kind: 'changeup', label: 'CHANGEUP', travel: 1.3, bulge: 0.35 },
  curveball: { kind: 'curveball', label: 'CURVEBALL', travel: 1.1, bulge: 1.3 },
  heater: { kind: 'heater', label: 'HEATER', travel: 0.68, bulge: 0.05 },
};

/** Ball position `s` seconds after release (can run past the plate). */
export function pitchPos(p: PitchType, s: number): Vec {
  const u = s / p.travel;
  const x = lerp(BASEBALL.mound.x, BASEBALL.plate.x, u);
  const uc = clamp(u, 0, 1);
  const y = lerp(BASEBALL.mound.y, BASEBALL.plate.y, uc) + p.bulge * 4 * uc * (1 - uc) - Math.max(0, u - 1) * 0.8;
  return { x, y };
}

export type SwingPlane = 'lift' | 'drive';

export interface Contact {
  hit: boolean;
  /** Seconds; negative = early. */
  error: number;
  /** 0..1 */
  quality: number;
  grade: 'PERFECT' | 'GREAT' | 'GOOD' | 'WEAK' | 'MISS';
}

/** Judge a swing that started `swingTime` seconds after release. */
export function judgeSwing(p: PitchType, swingTime: number, window: number): Contact {
  const error = swingTime - p.travel;
  if (Math.abs(error) > window) return { hit: false, error, quality: 0, grade: 'MISS' };
  const quality = 1 - Math.abs(error) / window;
  const grade = quality > 0.78 ? 'PERFECT' : quality > 0.5 ? 'GREAT' : quality > 0.22 ? 'GOOD' : 'WEAK';
  return { hit: true, error, quality, grade };
}

export function battedLaunch(c: Contact, plane: SwingPlane, window: number, clock: number): LaunchParams {
  const base = plane === 'lift' ? BASEBALL.liftAngle : BASEBALL.driveAngle;
  const angle = base + clamp(-c.error / window, -1, 1) * BASEBALL.timingAngle;
  const speed = BASEBALL.vMin + (BASEBALL.vMax - BASEBALL.vMin) * Math.pow(c.quality, 0.7);
  return {
    pos: { ...BASEBALL.contactPos },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    spin: BASEBALL.backspin,
    clock,
  };
}

export function scoreBaseball(sim: FlightSim, contactQuality: number): ScoreResult {
  const out = sim.outcome;
  if (!out) return finalize(false, 'FLY OUT', []);
  const obj = sim.course.objective;
  const distance = obj.type === 'homerun' ? Math.max(out.pos.x, sim.pos.x) : out.pos.x;
  return finalize(out.success, out.label, [
    { label: obj.type === 'homerun' ? 'Home run' : 'Target hit', value: 1000 },
    { label: 'Contact', value: 600 * contactQuality },
    { label: 'Distance', value: Math.max(0, distance) * 4 },
    { label: 'Fuel saved', value: fuelBonus(sim, 400) },
    { label: 'Rings', value: ringBonus(sim) },
  ]);
}
