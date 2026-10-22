import type { Challenge } from '../../config/challenges';
import type { Touch } from '../../input/input';
import type { Viewport } from '../../render/camera';
import { clamp, deg, type Vec } from '../../sim/vec';
import { FOOTBALL, aimFromDrag, passLaunch, type PassAim } from '../../sports/football';
import { previewPath } from './preview';
import type { LaunchRequest, SetupController } from './types';

/** TOUCHDOWN: drag back from anywhere like a slingshot; release to throw. */
export class FootballSetup implements SetupController {
  readonly sport = 'football' as const;
  launch: LaunchRequest | null = null;
  failed: string | null = null;
  dragging = false;
  start: Vec = { x: 0, y: 0 };
  cur: Vec = { x: 0, y: 0 };
  aim: PassAim | null = null;
  preview: Vec[] = [];
  maxDrag = 160;
  private keyAim: PassAim = { angle: deg(42), power: 0.75, valid: true };
  private keyMode = false;
  private previewAge = 0;
  private readonly previewTime: number;

  constructor(private ch: Challenge, vp: Viewport) {
    this.resize(vp);
    this.previewTime = ch.id.startsWith('tt') ? 0.9 : ch.index <= 2 ? 6 : ch.index <= 4 ? 1.4 : 1.0;
  }

  resize(vp: Viewport): void {
    this.maxDrag = clamp(Math.min(vp.w, vp.h) * 0.36, 110, 220);
  }

  prompt(): string {
    if (this.dragging && this.aim) return this.aim.valid ? `RELEASE TO THROW · ${Math.round(this.aim.power * 100)}%` : 'PULL BACK FURTHER';
    return 'PULL BACK & RELEASE TO THROW';
  }

  down(t: Touch): void {
    this.dragging = true;
    this.keyMode = false;
    this.start = { x: t.x, y: t.y };
    this.cur = { ...this.start };
    this.aim = null;
    this.preview = [];
  }

  move(t: Touch, clock: number): void {
    if (!this.dragging) return;
    this.cur = { x: t.x, y: t.y };
    this.aim = aimFromDrag(this.cur.x - this.start.x, this.cur.y - this.start.y, this.maxDrag);
    this.refresh(clock);
  }

  up(_t: Touch, cancelled: boolean, clock: number): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (!cancelled && this.aim?.valid) this.fire(this.aim, clock);
    this.aim = null;
    this.preview = [];
  }

  key(code: string, down: boolean, clock: number): void {
    if (!down) return;
    const a = this.keyAim;
    if (code === 'ArrowUp' || code === 'KeyW') a.angle = clamp(a.angle + deg(2), FOOTBALL.minAngle, FOOTBALL.maxAngle);
    else if (code === 'ArrowDown' || code === 'KeyS') a.angle = clamp(a.angle - deg(2), FOOTBALL.minAngle, FOOTBALL.maxAngle);
    else if (code === 'ArrowRight' || code === 'KeyD') a.power = clamp(a.power + 0.03, 0.15, 1);
    else if (code === 'ArrowLeft' || code === 'KeyA') a.power = clamp(a.power - 0.03, 0.15, 1);
    else if (code === 'Space' || code === 'Enter') {
      if (this.keyMode) this.fire(a, clock);
      this.keyMode = true;
      this.aim = { ...a };
      this.refresh(clock);
      return;
    } else return;
    this.keyMode = true;
    this.aim = { ...a };
    this.refresh(clock);
  }

  update(dt: number, clock: number): void {
    this.previewAge += dt;
    // Moving defenders change the preview's collisions, so refresh it a few times a second.
    if ((this.dragging || this.keyMode) && this.aim?.valid && this.previewAge > 0.1) this.refresh(clock);
  }

  get showingAim(): boolean {
    return (this.dragging || this.keyMode) && !!this.aim;
  }

  private refresh(clock: number): void {
    this.previewAge = 0;
    this.preview = this.aim?.valid ? previewPath(this.ch, passLaunch(this.aim.angle, this.aim.power, clock), this.previewTime) : [];
  }

  private fire(a: PassAim, clock: number): void {
    this.keyMode = false;
    this.launch = {
      launch: passLaunch(a.angle, a.power, clock),
      quality: a.power,
      callout: a.power > 0.92 ? 'BULLET PASS!' : undefined,
    };
  }
}
