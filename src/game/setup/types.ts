import type { Challenge } from '../../config/challenges';
import type { LaunchParams } from '../../sim/types';
import type { Touch } from '../../input/input';
import type { Viewport } from '../../render/camera';

export interface LaunchRequest {
  launch: LaunchParams;
  /** 0..1 contact/strike quality (baseball contact; power otherwise). */
  quality: number;
  /** Short callout shown at launch ("PERFECT!", "BULLET PASS"). */
  callout?: string;
}

/** A sport's pre-launch phase: reads input, exposes state for rendering, emits a launch. */
export interface SetupController {
  readonly sport: Challenge['sport'];
  /** Text for the HUD prompt. */
  prompt(): string;
  down(t: Touch, clock: number): void;
  move(t: Touch, clock: number): void;
  up(t: Touch, cancelled: boolean, clock: number): void;
  key(code: string, down: boolean, clock: number): void;
  update(dt: number, clock: number): void;
  /** Set once the athletic action has happened. Consumed by the game. */
  launch: LaunchRequest | null;
  /** Set when the setup itself fails (baseball strikeout). */
  failed: string | null;
  resize(vp: Viewport): void;
}
