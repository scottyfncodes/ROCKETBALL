import { CHALLENGES, TRIPLE_ID, TRIPLE_STARS, TRIPLE_THREAT, type Challenge } from '../config/challenges';
import { cosmeticById } from '../config/cosmetics';
import { FIXED_DT, ROCKET } from '../config/physics';
import { FixedStepper } from '../sim/stepper';
import { Sfx } from '../audio/audio';
import { Input, type Touch } from '../input/input';
import { Camera } from '../render/camera';
import { Effects, type TrailPoint } from '../render/effects';
import { Renderer } from '../render/renderer';
import { FlightSim } from '../sim/simulation';
import type { FlightEvent, FlightInput } from '../sim/types';
import { type Vec, clamp } from '../sim/vec';
import { starsFor, type ScoreResult } from '../sports/scoring';
import { BaseballSetup } from './setup/baseballSetup';
import { FootballSetup } from './setup/footballSetup';
import { SoccerSetup } from './setup/soccerSetup';
import type { LaunchRequest, SetupController } from './setup/types';
import { describeMiss, failedSetup, medalFor, scoreAttempt } from './scoreAttempt';
import { nextChallenge, recordResult, type RecordOutcome } from './progress';
import type { SaveData, Store } from './storage';
import { THEMES } from '../render/theme';

export type Phase = 'menu' | 'intro' | 'setup' | 'flight' | 'result';

export interface AttemptSummary {
  challenge: Challenge;
  result: ScoreResult;
  stars: number;
  record: RecordOutcome | null;
  /** Concrete feedback for a miss. */
  detail: string | null;
  /** Present for Triple Threat runs. */
  triple?: { round: number; rounds: ScoreResult[]; final: boolean; total: number };
}

/** Callbacks into the DOM layer. */
export interface GameUI {
  onBanner(ch: Challenge, roundLabel?: string): void;
  onBannerHide(): void;
  onPhase(phase: Phase): void;
  onPrompt(text: string, emphasis: boolean): void;
  onFuel(frac: number, visible: boolean, boosting: boolean): void;
  onResult(s: AttemptSummary): void;
  onPauseChange(paused: boolean): void;
}

export interface TutorialHint {
  kind: 'football-aim' | 'soccer-aim' | 'baseball-aim' | 'rocket' | 'steer';
}

const TUT_TEXT: Record<TutorialHint['kind'], string> = {
  'football-aim': 'PULL BACK, AIM, LET GO',
  'soccer-aim': 'SWIPE TOWARD THE GOAL',
  'baseball-aim': 'TAP AS THE BALL REACHES YOU',
  rocket: 'HOLD ANYWHERE TO IGNITE',
  steer: 'DRAG UP / DOWN TO STEER',
};

export class Game {
  readonly cam = new Camera();
  readonly fx = new Effects();
  readonly input = new Input();
  readonly sfx = new Sfx();
  readonly renderer: Renderer;
  private ctx: CanvasRenderingContext2D;

  phase: Phase = 'menu';
  challenge: Challenge = CHALLENGES[0];
  /** Attempt clock: drives moving obstacles; advances in fixed steps. */
  clock = 0;
  /** Real time, for purely cosmetic animation. */
  time = 0;
  introT = 0;
  introLen = 1.8;
  setup: SetupController | null = null;
  sim: FlightSim | null = null;
  launchReq: LaunchRequest | null = null;
  launchClock = 0;
  trail: TrailPoint[] = [];
  ghosts = new Map<string, Vec[]>();
  paused = false;
  reducedMotion = false;
  hint: TutorialHint | null = null;
  /** Steering joystick: origin and current pointer. */
  steerUI: { x: number; y: number; cy: number } | null = null;
  private boostTouch: number | null = null;
  private stepper = new FixedStepper();
  private slowmo = 0;
  private lastPrompt = '';
  private resultShown = false;
  private triple: { round: number; rounds: ScoreResult[] } | null = null;
  private attract: FlightSim | null = null;
  private attractSport = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: Store,
    public save: SaveData,
    private ui: GameUI,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.renderer = new Renderer(this.ctx);
    this.sfx.muted = save.settings.muted;
    this.input.attach(canvas, {
      down: (t) => this.onDown(t),
      move: (t) => this.onMove(t),
      up: (t, c) => this.onUp(t, c),
      key: (code, down, repeat) => this.onKey(code, down, repeat),
    });
  }

  get equipped() {
    return this.save.equipped;
  }

  get isTriple(): boolean {
    return this.triple !== null;
  }

  get tripleRound(): number {
    return this.triple?.round ?? 0;
  }

  persist(): void {
    this.store.save(this.save);
  }

  // ------------------------------------------------------------------ lifecycle

  startChallenge(ch: Challenge, opts: { skipIntro?: boolean } = {}): void {
    this.challenge = ch;
    this.fx.clear();
    this.sim = null;
    this.launchReq = null;
    this.trail = [];
    this.steerUI = null;
    this.boostTouch = null;
    this.clock = 0;
    this.stepper.reset();
    this.slowmo = 0;
    this.resultShown = false;
    this.paused = false;
    this.input.consumeAll();
    this.sfx.stopThrust();
    this.setup = this.makeSetup(ch);
    const skip = opts.skipIntro || this.reducedMotion;
    this.introLen = skip ? 0 : 1.9;
    this.introT = 0;
    this.phase = skip ? 'setup' : 'intro';
    this.frameSetup(true);
    if (!skip) this.cam.left = this.introFrom().left;
    this.ui.onBanner(ch, this.triple ? `ROUND ${this.triple.round + 1} OF 3` : undefined);
    this.ui.onPhase(this.phase);
    this.updateHint();
  }

  startTriple(): void {
    this.triple = { round: 0, rounds: [] };
    this.startChallenge(TRIPLE_THREAT[0]);
  }

  /** Retry the same challenge (or restart the Triple Threat run). */
  retry(): void {
    if (this.triple) {
      this.startTriple();
      return;
    }
    this.startChallenge(this.challenge, { skipIntro: true });
  }

  nextTripleRound(): void {
    if (!this.triple) return;
    this.triple.round++;
    this.startChallenge(TRIPLE_THREAT[this.triple.round]);
  }

  next(): Challenge | undefined {
    return nextChallenge(this.challenge);
  }

  toMenu(): void {
    this.triple = null;
    this.phase = 'menu';
    this.sim = null;
    this.setup = null;
    this.fx.clear();
    this.sfx.stopThrust();
    this.paused = false;
    this.ui.onPhase('menu');
  }

  pause(): void {
    if (this.paused || this.phase === 'menu' || this.phase === 'result') return;
    this.paused = true;
    this.input.reset();
    this.boostTouch = null;
    this.steerUI = null;
    this.sfx.stopThrust();
    this.ui.onPauseChange(true);
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.stepper.reset();
    // Anything still pressed must be released and pressed again before it counts.
    this.input.consumeAll();
    this.ui.onPauseChange(false);
  }

  resize(w: number, h: number, dpr: number, safe: { top: number; right: number; bottom: number; left: number }): void {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const bottomBand = clamp(h * 0.15, 80, 150) + safe.bottom;
    const top = safe.top + (h < 500 ? 104 : 116);
    this.cam.vp = { w, h, dpr, groundY: h - bottomBand, top, safe };
    this.setup?.resize(this.cam.vp);
    if (this.phase === 'setup' || this.phase === 'intro') this.frameSetup(true);
  }

  private makeSetup(ch: Challenge): SetupController {
    if (ch.sport === 'football') return new FootballSetup(ch, this.cam.vp);
    if (ch.sport === 'soccer') return new SoccerSetup(ch, this.cam.vp);
    const b = new BaseballSetup(ch, this.cam.vp);
    b.onSwing = (c) => {
      if (c.hit) {
        this.sfx.crack(c.quality);
        this.fx.burst({ x: 0.9, y: 1.1 }, 18, ['#fff', '#ffd23f'], 9, { shape: 'spark', life: 0.4, size: 2 });
        this.cam.shake(c.quality > 0.78 ? 6 : 3, !this.reducedMotion);
      } else this.sfx.whiff();
    };
    return b;
  }

  // ------------------------------------------------------------------ input

  private onDown(t: Touch): void {
    this.sfx.unlock();
    if (this.paused) return;
    if (this.phase === 'intro') {
      // Tap skips the flyover; this touch does nothing else.
      this.endIntro();
      t.consumed = true;
      return;
    }
    if (this.phase === 'setup') {
      this.ui.onBannerHide();
      this.setup?.down(t, this.clock);
    } else if (this.phase === 'flight' && this.sim && this.boostTouch === null) {
      this.boostTouch = t.id;
      this.steerUI = { x: t.x, y: t.y, cy: t.y };
    }
  }

  private onMove(t: Touch): void {
    if (this.paused) return;
    if (this.phase === 'setup') this.setup?.move(t, this.clock);
    else if (this.phase === 'flight' && t.id === this.boostTouch && this.steerUI) this.steerUI.cy = t.y;
  }

  private onUp(t: Touch, cancelled: boolean): void {
    if (this.paused) return;
    if (this.phase === 'setup') this.setup?.up(t, cancelled, this.clock);
    if (t.id === this.boostTouch) {
      this.boostTouch = null;
      this.steerUI = null;
    }
  }

  private onKey(code: string, down: boolean, repeat: boolean): void {
    if (down) this.sfx.unlock();
    if (code === 'Escape' || code === 'KeyP') {
      if (down && !repeat) {
        if (this.paused) this.resume();
        else this.pause();
      }
      return;
    }
    if (this.paused) return;
    if (code === 'KeyR' && down && !repeat && this.phase !== 'menu') {
      this.retry();
      return;
    }
    if (this.phase === 'intro' && down && !repeat) {
      this.endIntro();
      this.input.consumeAll();
      return;
    }
    if (this.phase === 'setup' && (down ? true : false)) {
      if (!repeat || code.startsWith('Arrow') || /^Key[WASDQE]$/.test(code)) this.setup?.key(code, down, this.clock);
    }
  }

  private flightInput(): FlightInput {
    const keys = this.input.keys;
    const steerPx = clamp(this.cam.vp.h * 0.11, 45, 90);
    let boost = false;
    let steer = 0;
    if (this.boostTouch !== null && this.input.touches.has(this.boostTouch) && this.steerUI) {
      boost = true;
      steer = clamp((this.steerUI.y - this.steerUI.cy) / steerPx, -1, 1);
    }
    if (keys.has('Space')) boost = true;
    if (keys.has('ArrowUp') || keys.has('KeyW')) steer = 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) steer = -1;
    return { boost, steer };
  }

  // ------------------------------------------------------------------ simulation

  frame(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    if (this.phase === 'menu') {
      this.attractTick(dt);
      this.fx.update(dt);
      this.renderer.drawAttract(this, dt);
      return;
    }
    if (!this.paused) {
      const scale = this.slowmo > 0 ? 0.35 : 1;
      this.slowmo = Math.max(0, this.slowmo - dt);
      this.stepper.advance(dt * scale, () => this.tick());
      this.fx.update(dt * scale);
      this.updateCamera(dt);
      this.cam.updateShake(dt);
      this.updateHud();
    }
    this.renderer.draw(this);
  }

  private tick(): void {
    this.clock += FIXED_DT;
    if (this.phase === 'intro') {
      this.introT += FIXED_DT;
      if (this.introT >= this.introLen) this.endIntro();
      return;
    }
    if (this.phase === 'setup' && this.setup) {
      this.setup.update(FIXED_DT, this.clock);
      if (this.setup.launch) this.beginFlight(this.setup.launch);
      else if (this.setup.failed) this.finish(failedSetup(this.setup.failed));
      return;
    }
    if (this.phase === 'flight' && this.sim) {
      const sim = this.sim;
      const inp = this.flightInput();
      const wasBoosting = sim.boosting;
      sim.step(inp);
      if (sim.boosting && !wasBoosting) this.sfx.thrustOn();
      if (!sim.boosting && wasBoosting) this.sfx.stopThrust();
      if (sim.boosting) {
        this.sfx.thrustLevel(inp.steer);
        this.emitExhaust(sim);
        if (Math.abs(inp.steer) > 0.45) this.learn('steer');
      }
      this.trail.push({ x: sim.pos.x, y: sim.pos.y, boost: sim.boosting });
      if (this.trail.length > 1400) this.trail.shift();
      for (const e of sim.drain()) this.onEvent(e);
      if (sim.done) this.finishFlight();
    }
  }

  private endIntro(): void {
    if (this.phase !== 'intro') return;
    this.phase = 'setup';
    this.ui.onPhase('setup');
    this.updateHint();
  }

  private beginFlight(req: LaunchRequest): void {
    this.launchReq = req;
    this.launchClock = req.launch.clock;
    this.sim = new FlightSim(this.challenge, req.launch);
    this.phase = 'flight';
    this.input.consumeAll();
    this.boostTouch = null;
    this.steerUI = null;
    this.trail = [{ ...req.launch.pos, boost: false }];
    const sport = this.challenge.sport;
    if (sport === 'football') this.sfx.launch(req.quality);
    else if (sport === 'soccer') this.sfx.kick(req.quality);
    this.fx.burst(req.launch.pos, 10, ['#ffffff', '#d8e2ff'], 5, { life: 0.35, size: 2 });
    if (req.callout) this.fx.text(req.callout, { x: req.launch.pos.x + 2, y: req.launch.pos.y + 3 }, THEMES[sport].accent2, 20);
    this.learn(`${sport}-aim`);
    this.ui.onPhase('flight');
    this.updateHint();
  }

  private emitExhaust(sim: FlightSim): void {
    const tr = cosmeticById(this.equipped.trail)?.colors ?? ['#ffb22e', '#ff4d1f'];
    const rainbow = this.equipped.trail === 'trail-rainbow';
    const d = sim.thrustDir;
    const r = sim.ballCfg.radius;
    const n = this.reducedMotion ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const sp = 6 + Math.random() * 6;
      const life = 0.25 + Math.random() * 0.3;
      this.fx.emit({
        x: sim.pos.x - d.x * r * 2.6,
        y: sim.pos.y - d.y * r * 2.6,
        vx: sim.vel.x * 0.3 - (d.x + spread * d.y) * sp,
        vy: sim.vel.y * 0.3 - (d.y - spread * d.x) * sp,
        life,
        max: life,
        size: 2 + Math.random() * 3,
        color: rainbow ? `hsl(${(this.time * 300 + i * 40) % 360},100%,60%)` : Math.random() < 0.5 ? tr[0] : tr[1],
        additive: true,
        drag: 2,
      });
    }
  }

  private onEvent(e: FlightEvent): void {
    const motion = !this.reducedMotion;
    switch (e.type) {
      case 'ignite':
        this.sfx.ignite();
        this.fx.burst(e.pos, 24, ['#fff3b0', '#ffb22e', '#ff4d1f'], 9, { additive: true, life: 0.5 });
        this.fx.text('IGNITION!', { x: e.pos.x, y: e.pos.y + 2.5 }, '#ffd23f', 18);
        this.learn('rocket');
        break;
      case 'fuelEmpty':
        this.sfx.fuelOut();
        this.sfx.stopThrust();
        this.fx.text('FUEL EMPTY', { x: e.pos.x, y: e.pos.y + 2.5 }, '#ff8a8a', 15);
        break;
      case 'bounce':
        if (e.speed > 2) {
          this.sfx.bounce(e.speed);
          this.fx.burst({ x: e.pos.x, y: 0.1 }, 8, ['#d9c49a', '#a7d38c'], 3, { g: 9, life: 0.5, size: 2.5 });
        }
        break;
      case 'hit':
        this.sfx.hit();
        this.fx.burst(e.pos, 16, ['#ffffff', '#ffd23f', '#ff8a3d'], 8, { shape: 'spark', life: 0.4, size: 2 });
        if (e.speed > 6) this.cam.shake(Math.min(8, e.speed * 0.5), motion);
        break;
      case 'ring':
        this.sfx.ring();
        this.fx.ripple(e.pos, 50, '#5cf2ff');
        this.fx.burst(e.pos, 14, ['#5cf2ff', '#ffffff'], 6, { additive: true, life: 0.5 });
        this.fx.text(`RING +${e.points}`, { x: e.pos.x, y: e.pos.y + 2.4 }, '#9ff8ff', 17);
        break;
      case 'success':
        this.sfx.stopThrust();
        this.sfx.score();
        this.celebrate(e.pos);
        this.fx.text(e.label, { x: this.cam.vp.w / 2, y: this.cam.vp.h * 0.36 }, '#ffd23f', 40, false);
        if (motion) this.slowmo = 0.7;
        break;
      case 'fail':
        this.sfx.stopThrust();
        this.sfx.fail();
        this.fx.text(e.label, { x: this.cam.vp.w / 2, y: this.cam.vp.h * 0.36 }, '#ffffff', 34, false);
        break;
    }
  }

  celebrate(at: Vec): void {
    const id = this.equipped.celebration;
    const c = cosmeticById(id)?.colors ?? ['#ffd23f', '#ff3d7f'];
    const colors = [c[0], c[1], '#ffffff', THEMES[this.challenge.sport].accent];
    const motion = !this.reducedMotion;
    const s = this.cam.toScreen(at);
    if (motion) this.fx.flash = 1;
    this.cam.shake(5, motion);
    if (id === 'cele-confetti') {
      for (let i = 0; i < 110 * this.fx.density; i++) {
        const life = 1.6 + Math.random();
        this.fx.emit({
          x: Math.random() * this.cam.vp.w, y: -10 - Math.random() * 80, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120,
          g: 60, drag: 0.8, life, max: life, size: 4, color: colors[i % colors.length], world: false, shape: 'rect', spin: (Math.random() - 0.5) * 14,
        });
      }
    } else if (id === 'cele-shockwave') {
      this.fx.ripple(s, 160, c[1], false);
      this.fx.ripple(s, 260, c[0], false);
      this.fx.burst(s, 40, colors, 420, { world: false, shape: 'spark', life: 0.7, size: 2.5, drag: 2 });
    } else if (id === 'cele-starburst') {
      for (let k = 0; k < 3; k++) this.fx.burst({ x: s.x + (k - 1) * 70, y: s.y - 40 - k * 20 }, 30, colors, 300, { world: false, life: 1, additive: true, size: 3, g: 120 });
      this.fx.ripple(s, 220, c[0], false);
    } else {
      for (let k = 0; k < 4; k++) {
        const fx = this.cam.vp.w * (0.2 + k * 0.2);
        const fy = this.cam.vp.h * (0.18 + (k % 2) * 0.1);
        this.fx.burst({ x: fx, y: fy }, 34, [colors[k % colors.length], '#ffffff'], 260, { world: false, life: 1.1, additive: true, g: 140, drag: 1.2, size: 2.5 });
      }
    }
  }

  private finishFlight(): void {
    if (!this.sim || this.resultShown) return;
    this.ghosts.set(this.challenge.id, this.trail.filter((_, i) => i % 3 === 0).map((p) => ({ x: p.x, y: p.y })));
    this.finish(scoreAttempt(this.challenge, this.sim, this.launchReq?.quality ?? 0));
  }

  private finish(result: ScoreResult): void {
    if (this.resultShown) return;
    this.resultShown = true;
    this.sfx.stopThrust();
    if (!this.sim) {
      this.sfx.fail();
      this.fx.text(result.label, { x: this.cam.vp.w / 2, y: this.cam.vp.h * 0.36 }, '#ffffff', 34, false);
    }
    this.phase = 'result';
    this.ui.onPhase('result');
    this.hint = null;

    if (this.triple) {
      this.triple.rounds.push(result);
      const final = this.triple.round >= TRIPLE_THREAT.length - 1;
      const total = this.triple.rounds.reduce((s, r) => s + r.total, 0);
      let record: RecordOutcome | null = null;
      let stars = 0;
      if (final) {
        const success = this.triple.rounds.length === 3 && this.triple.rounds.every((r) => r.success);
        stars = starsFor(success, total, TRIPLE_STARS);
        record = recordResult(this.save, TRIPLE_ID, total, stars, success);
        this.persist();
      }
      this.ui.onResult({
        challenge: this.challenge,
        result,
        stars,
        record,
        detail: describeMiss(this.challenge, this.sim),
        triple: { round: this.triple.round, rounds: [...this.triple.rounds], final, total },
      });
      return;
    }
    const stars = medalFor(this.challenge, result);
    const record = recordResult(this.save, this.challenge.id, result.total, stars, result.success);
    this.persist();
    this.ui.onResult({ challenge: this.challenge, result, stars, record, detail: describeMiss(this.challenge, this.sim) });
  }

  // ------------------------------------------------------------------ tutorial

  learn(key: string): void {
    if (this.save.tutorial[key]) return;
    this.save.tutorial[key] = true;
    this.persist();
    this.updateHint();
  }

  private updateHint(): void {
    const t = this.save.tutorial;
    const sport = this.challenge.sport;
    let h: TutorialHint | null = null;
    if (this.phase === 'setup' && !t[`${sport}-aim`]) h = { kind: `${sport}-aim` as TutorialHint['kind'] };
    else if (this.phase === 'flight' && this.sim && !this.sim.outcome) {
      if (!t.rocket) h = { kind: 'rocket' };
      else if (!t.steer && this.sim.ignited) h = { kind: 'steer' };
    }
    this.hint = h;
  }

  private updateHud(): void {
    let text = '';
    let emph = false;
    if (this.phase === 'intro') text = 'TAP TO SKIP';
    else if (this.phase === 'setup' && this.setup) {
      if (this.hint) {
        text = TUT_TEXT[this.hint.kind];
        emph = true;
      } else text = this.setup.prompt();
    } else if (this.phase === 'flight' && this.sim) {
      this.updateHint();
      const s = this.sim;
      if (this.hint) {
        text = TUT_TEXT[this.hint.kind];
        emph = true;
      } else if (s.outcome) text = '';
      else if (s.fuel <= 0) text = 'OUT OF FUEL';
      else if (!s.ignited) text = s.t < ROCKET.armDelay ? '' : 'HOLD TO BOOST';
      else text = s.boosting ? 'DRAG UP / DOWN TO STEER' : 'HOLD TO BOOST · RELEASE TO SAVE FUEL';
    }
    const key = `${text}|${emph}`;
    if (key !== this.lastPrompt) {
      this.lastPrompt = key;
      this.ui.onPrompt(text, emph);
    }
    const fuelFrac = this.sim ? this.sim.fuel / Math.max(0.001, this.sim.fuelMax) : 1;
    this.ui.onFuel(fuelFrac, this.phase === 'setup' || this.phase === 'flight', !!this.sim?.boosting);
  }

  // ------------------------------------------------------------------ camera

  /** Where the camera starts the intro flyover (looking at the objective). */
  private introFrom(): { left: number } {
    const o = this.challenge.objective;
    const x = o.type === 'endzone' ? (o.x0 + o.x1) / 2 : o.x;
    return { left: this.cam.leftFor(x, 0.6, this.cam.baseScale()) };
  }

  private frameSetup(snap: boolean): void {
    const cam = this.cam;
    const base = cam.baseScale();
    const ch = this.challenge;
    let left = cam.leftFor(0, 0.16, base);
    let scale = base;
    if (ch.sport === 'baseball') {
      scale = Math.min(base * 1.15, cam.vp.w / 27);
      left = -4.5;
    } else if (ch.sport === 'soccer' && ch.objective.type === 'goal' && ch.objective.x < 34) {
      scale = Math.max(base * 0.6, Math.min(base, cam.vp.w / (ch.objective.x + 9)));
      left = cam.leftFor(0, 0.1, scale);
    }
    // While aiming, zoom out so the whole preview arc is visible.
    const pv = (this.setup as FootballSetup | SoccerSetup | null)?.preview;
    if (pv && pv.length > 1 && this.phase === 'setup') {
      let maxX = 0;
      let maxY = 0;
      for (const p of pv) {
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const fit = Math.min(cam.vp.w * 0.86 / (maxX + 4), (cam.vp.groundY - cam.vp.top - 20) / (maxY + 3));
      scale = Math.max(base * 0.62, Math.min(scale, fit));
      left = cam.leftFor(0, 0.1, scale);
    }
    if (snap) {
      cam.scale = scale;
      cam.left = left;
    } else cam.approach(left, scale, 1 / 60, 5);
  }

  private updateCamera(dt: number): void {
    const cam = this.cam;
    const base = cam.baseScale();
    if (this.phase === 'intro') {
      const k = this.introT / Math.max(0.01, this.introLen);
      const e = k < 0.25 ? 0 : (k - 0.25) / 0.75;
      const ease = e * e * (3 - 2 * e);
      const from = this.introFrom().left;
      const to = cam.leftFor(0, 0.16, base);
      cam.scale = base;
      cam.left = from + (to - from) * ease;
      return;
    }
    if (this.phase === 'setup') {
      this.frameSetup(false);
      return;
    }
    const sim = this.sim;
    if (!sim) return;
    const room = cam.vp.groundY - cam.vp.top - 40;
    const fitH = room / (sim.pos.y + 5);
    const scale = clamp(Math.min(base, fitH), base * 0.28, base);
    const ahead = clamp(sim.vel.x / 40, -0.1, 0.15);
    const left = cam.leftFor(sim.pos.x, 0.34 - ahead, scale);
    cam.approach(Math.max(left, cam.leftFor(0, 0.16, scale) - 3), scale, dt, this.phase === 'result' ? 2 : 5);
  }

  // ------------------------------------------------------------------ attract mode

  private attractTick(dt: number): void {
    const sports = ['football', 'soccer', 'baseball'] as const;
    if (!this.attract || this.attract.done) {
      const sport = sports[this.attractSport++ % 3];
      const ch = CHALLENGES.find((c) => c.sport === sport && c.index === 2)!;
      this.challenge = ch;
      this.attract = new FlightSim({ ...ch, worldEnd: 9999, fuel: 1.4 }, {
        pos: { x: 0, y: 2 },
        vel: { x: 17, y: 15 },
        spin: 0,
        clock: 0,
      });
      this.trail = [];
      this.fx.clear();
    }
    const sim = this.attract;
    this.stepper.advance(dt, () => {
      const boost = sim.t > 0.7 && sim.t < 2.1;
      sim.step({ boost, steer: Math.sin(sim.t * 2) * 0.5 });
      if (sim.boosting && Math.random() < 0.6) this.emitExhaust(sim);
      this.trail.push({ x: sim.pos.x, y: sim.pos.y, boost: sim.boosting });
      sim.drain();
      if (sim.outcome && sim.t > 6) sim.done = true;
    });
    this.cam.scale = this.cam.baseScale() * 0.8;
    this.cam.approach(this.cam.leftFor(sim.pos.x, 0.45), this.cam.scale, dt, 3);
  }
}
