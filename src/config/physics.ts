/**
 * Central tuning for the shared ROCKETBALL physics. All units are arcade "metres" and seconds,
 * with +y pointing up and the ground at y = 0.
 */
import type { Sport } from '../sim/types';

/** Fixed simulation step. Physics never depends on render frame rate. */
export const FIXED_DT = 1 / 120;
/** Upper bound on simulated steps per rendered frame (prevents spiral of death after a stall). */
export const MAX_STEPS_PER_FRAME = 12;

export const GRAVITY = 9.8;

export interface BallPhysics {
  radius: number;
  /** Quadratic drag coefficient: a = -drag * |v| * v. */
  drag: number;
  /** Magnus lift per unit spin: a = magnus * spin * perp(v). Positive spin = backspin (lift). */
  magnus: number;
  /** Spin decay per second (fraction). */
  spinDecay: number;
  /** Velocity kept along the collision normal. */
  restitution: number;
  /** Fraction of tangential speed kept on each bounce. */
  bounceFriction: number;
  /** Rolling deceleration on the ground (m/s²). */
  rollFriction: number;
}

export const BALLS: Record<Sport, BallPhysics> = {
  football: { radius: 0.45, drag: 0.0016, magnus: 0, spinDecay: 0, restitution: 0.42, bounceFriction: 0.7, rollFriction: 9 },
  soccer: { radius: 0.5, drag: 0.0032, magnus: 0.02, spinDecay: 0.12, restitution: 0.45, bounceFriction: 0.62, rollFriction: 11 },
  baseball: { radius: 0.4, drag: 0.0016, magnus: 0.012, spinDecay: 0.05, restitution: 0.35, bounceFriction: 0.6, rollFriction: 7 },
};

export const ROCKET = {
  /** Thrust acceleration (m/s²). ~1.4 g so a steered rocket can climb. */
  thrust: 14,
  /** Maximum thrust deflection from the flight direction, in radians, at full steer. */
  maxSteer: (80 * Math.PI) / 180,
  /** Delay after launch before a touch can ignite (so the launch gesture never boosts). */
  armDelay: 0.18,
  /** Top speed the rocket can push the ball to (keeps flights readable). */
  maxSpeed: 46,
};

export const FLIGHT = {
  /** Hard limit on a single flight. */
  maxTime: 14,
  /** Ground speed under which the ball is considered stopped. */
  stopSpeed: 0.8,
  /** Seconds of simulation that continue after the outcome is decided (for the celebration). */
  settleTime: 1.1,
  /** Never let the ball climb above this altitude. */
  ceiling: 140,
};
