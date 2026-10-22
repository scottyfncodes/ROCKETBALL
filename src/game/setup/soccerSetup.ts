import type { Challenge } from '../../config/challenges';
import type { Touch } from '../../input/input';
import type { Viewport } from '../../render/camera';
import { clamp, deg, type Vec } from '../../sim/vec';
import { SOCCER, kickFromSwipe, kickLaunch, type Kick } from '../../sports/soccer';
import { previewPath } from './preview';
import type { LaunchRequest, SetupController } from './types';

/** GOAL: swipe toward the goal. Length = power, the swipe's curve = bend. Kicks on release. */
export class SoccerSetup implements SetupController {
  readonly sport = 'soccer' as const;
  launch: LaunchRequest | null = null;
  failed: string | null = null;
  swiping = false;
  points: Vec[] = [];
  kick: Kick | null = null;
  preview: Vec[] = [];
  ref = 240;
  hint: string | null = null;
  private keyKick: Kick = { angle: deg(25), power: 0.7, curl: 0, valid: true };
  private keyMode = false;
  private readonly previewTime: number;

  constructor(private ch: Challenge, vp: Viewport) {
    this.resize(vp);
    this.previewTime = ch.id.startsWith('tt') ? 0.7 : ch.index <= 2 ? 1.6 : 0.9;
  }

  resize(vp: Viewport): void {
    this.ref = clamp(Math.min(vp.w, vp.h) * 0.6, 170, 340);
  }

  prompt(): string {
    if (this.hint) return this.hint;
    if (this.swiping && this.kick) {
      const c = this.kick.curl;
      const spin = Math.abs(c) < 0.2 ? 'STRAIGHT' : c < 0 ? 'DIP' : 'FLOAT';
      return `${Math.round(this.kick.power * 100)}% · ${spin}`;
    }
    return 'SWIPE TOWARD THE GOAL TO KICK';
  }

  down(t: Touch): void {
    this.swiping = true;
    this.keyMode = false;
    this.hint = null;
    this.points = [{ x: t.x, y: t.y }];
    this.kick = null;
    this.preview = [];
  }

  move(t: Touch, clock: number): void {
    if (!this.swiping) return;
    const last = this.points[this.points.length - 1];
    if (Math.hypot(t.x - last.x, t.y - last.y) < 3) return;
    this.points.push({ x: t.x, y: t.y });
    if (this.points.length > 120) this.points.splice(1, 1);
    this.kick = kickFromSwipe(this.points, this.ref);
    this.refresh(clock);
  }

  up(t: Touch, cancelled: boolean, clock: number): void {
    if (!this.swiping) return;
    this.swiping = false;
    this.points.push({ x: t.x, y: t.y });
    const k = kickFromSwipe(this.points, this.ref);
    if (!cancelled && k.valid) this.fire(k, clock);
    else if (!cancelled && this.points.length > 1) this.hint = 'SWIPE RIGHT, TOWARD THE GOAL';
    this.kick = null;
    this.preview = [];
    this.points = [];
  }

  key(code: string, down: boolean, clock: number): void {
    if (!down) return;
    const k = this.keyKick;
    if (code === 'ArrowUp' || code === 'KeyW') k.angle = clamp(k.angle + deg(2), SOCCER.minAngle, SOCCER.maxAngle);
    else if (code === 'ArrowDown' || code === 'KeyS') k.angle = clamp(k.angle - deg(2), SOCCER.minAngle, SOCCER.maxAngle);
    else if (code === 'ArrowRight' || code === 'KeyD') k.power = clamp(k.power + 0.03, 0.1, 1);
    else if (code === 'ArrowLeft' || code === 'KeyA') k.power = clamp(k.power - 0.03, 0.1, 1);
    else if (code === 'KeyQ') k.curl = clamp(k.curl - 0.25, -1, 1);
    else if (code === 'KeyE') k.curl = clamp(k.curl + 0.25, -1, 1);
    else if (code === 'Space' || code === 'Enter') {
      if (this.keyMode) {
        this.fire(k, clock);
        return;
      }
    } else return;
    this.keyMode = true;
    this.kick = { ...k };
    this.refresh(clock);
  }

  update(): void {}

  get showingAim(): boolean {
    return (this.swiping || this.keyMode) && !!this.kick;
  }

  private refresh(clock: number): void {
    const k = this.kick;
    this.preview = k?.valid ? previewPath(this.ch, kickLaunch(k.angle, k.power, k.curl, clock), this.previewTime) : [];
  }

  private fire(k: Kick, clock: number): void {
    this.keyMode = false;
    this.launch = {
      launch: kickLaunch(k.angle, k.power, k.curl, clock),
      quality: k.power,
      callout: Math.abs(k.curl) > 0.7 ? (k.curl < 0 ? 'DIPPING SHOT!' : 'KNUCKLE FLOAT!') : undefined,
    };
  }
}
