import { FIXED_DT, MAX_STEPS_PER_FRAME } from '../config/physics';

/**
 * Converts variable frame times into a whole number of fixed simulation steps so the
 * physics is identical at 30, 60 or 120 fps.
 */
export class FixedStepper {
  acc = 0;

  constructor(
    readonly dt = FIXED_DT,
    readonly maxSteps = MAX_STEPS_PER_FRAME,
  ) {}

  /** Advance by `frameDt` seconds, calling `step` once per fixed step. Returns steps taken. */
  advance(frameDt: number, step: () => void): number {
    this.acc += Math.max(0, frameDt);
    let n = 0;
    // Small epsilon so accumulated float error never drops a step.
    while (this.acc >= this.dt - 1e-9 && n < this.maxSteps) {
      step();
      this.acc -= this.dt;
      n++;
    }
    // After a long stall, drop the backlog instead of fast-forwarding the game.
    if (n >= this.maxSteps) this.acc = 0;
    return n;
  }

  reset(): void {
    this.acc = 0;
  }
}
