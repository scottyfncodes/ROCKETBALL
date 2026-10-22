import type { Challenge } from '../../config/challenges';
import type { Touch } from '../../input/input';
import type { Viewport } from '../../render/camera';
import type { Vec } from '../../sim/vec';
import { BASEBALL, PITCHES, battedLaunch, judgeSwing, pitchPos, type Contact, type PitchType, type SwingPlane } from '../../sports/baseball';
import type { LaunchRequest, SetupController } from './types';

type Phase = 'ready' | 'windup' | 'pitch' | 'between';

/** HOME RUN: watch the pitch, tap to swing. Upper half of the screen lifts, lower half drives. */
export class BaseballSetup implements SetupController {
  readonly sport = 'baseball' as const;
  launch: LaunchRequest | null = null;
  failed: string | null = null;
  phase: Phase = 'ready';
  phaseT = 0;
  strikes = 0;
  pitchNo = 0;
  pitch: PitchType;
  releaseClock = 0;
  swung = false;
  swingClock = 0;
  plane: SwingPlane = 'lift';
  lastContact: Contact | null = null;
  message: string | null = null;
  readonly window: number;
  private splitY = 400;
  /** Called with the result of each swing (for sound / effects). */
  onSwing: ((c: Contact) => void) | null = null;

  constructor(private ch: Challenge, vp: Viewport) {
    this.window = ch.swingWindow ?? 0.13;
    this.pitch = this.pitchFor(0);
    this.resize(vp);
  }

  resize(vp: Viewport): void {
    this.splitY = vp.top + (vp.groundY - vp.top) * 0.5;
  }

  get split(): number {
    return this.splitY;
  }

  private pitchFor(n: number): PitchType {
    const list = this.ch.pitches?.length ? this.ch.pitches : ['fastball' as const];
    return PITCHES[list[n % list.length]];
  }

  prompt(): string {
    if (this.message) return this.message;
    if (this.phase === 'ready' || this.phase === 'windup') return `NEXT: ${this.pitch.label} · TAP TO SWING`;
    return 'TAP TO SWING · TOP = LIFT · BOTTOM = DRIVE';
  }

  /** Seconds since release (negative before the pitch). */
  pitchTime(clock: number): number {
    return this.phase === 'pitch' || this.phase === 'between' ? clock - this.releaseClock : -1;
  }

  ballPos(clock: number): Vec | null {
    if (this.phase !== 'pitch') return null;
    return pitchPos(this.pitch, clock - this.releaseClock);
  }

  /** 0..1 swing animation progress, or -1 when not swinging. */
  swingProgress(clock: number): number {
    if (!this.swung) return -1;
    return Math.min(1, (clock - this.swingClock) / 0.18);
  }

  down(t: Touch, clock: number): void {
    this.swing(t.y < this.splitY ? 'lift' : 'drive', clock);
  }
  move(): void {}
  up(): void {}

  key(code: string, down: boolean, clock: number): void {
    if (!down) return;
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space' || code === 'Enter') this.swing('lift', clock);
    else if (code === 'ArrowDown' || code === 'KeyS') this.swing('drive', clock);
  }

  swing(plane: SwingPlane, clock: number): void {
    if (this.swung || (this.phase !== 'windup' && this.phase !== 'pitch')) return;
    this.swung = true;
    this.swingClock = clock;
    this.plane = plane;
    const s = this.phase === 'pitch' ? clock - this.releaseClock : -10;
    const c = judgeSwing(this.pitch, s, this.window);
    this.lastContact = c;
    this.onSwing?.(c);
    if (c.hit) {
      this.launch = { launch: battedLaunch(c, plane, this.window, clock), quality: c.quality, callout: `${c.grade}!` };
    }
  }

  update(dt: number, clock: number): void {
    this.phaseT += dt;
    switch (this.phase) {
      case 'ready':
        if (this.phaseT > 0.6) this.go('windup');
        break;
      case 'windup':
        if (this.phaseT > BASEBALL.windup) {
          this.go('pitch');
          this.releaseClock = clock;
        }
        break;
      case 'pitch': {
        const s = clock - this.releaseClock;
        if (s > this.pitch.travel + BASEBALL.followThrough) {
          this.strikes++;
          this.message = this.strikes >= BASEBALL.strikesAllowed ? 'STRIKE THREE!' : `STRIKE ${this.strikes}!`;
          this.go('between');
        }
        break;
      }
      case 'between':
        if (this.phaseT > 1.0) {
          if (this.strikes >= BASEBALL.strikesAllowed) {
            this.failed = 'STRUCK OUT';
            return;
          }
          this.pitchNo++;
          this.pitch = this.pitchFor(this.pitchNo);
          this.swung = false;
          this.message = null;
          this.lastContact = null;
          this.go('windup');
        }
        break;
    }
  }

  private go(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }
}
