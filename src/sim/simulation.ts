import { BALLS, FIXED_DT, FLIGHT, GRAVITY, ROCKET, type BallPhysics } from '../config/physics';
import type { Course, FlightEvent, FlightInput, FlightOutcome, LaunchParams } from './types';
import { type Vec, clamp, distToSegment, norm, rotate } from './vec';
import { circleBox, obstacleAt, pointInBox, ringAt, windowAt } from './world';

const NO_INPUT: FlightInput = { boost: false, steer: 0 };

/**
 * Deterministic flight of a single launched ball, including rocket propulsion,
 * collisions and objective resolution. Pure simulation: no rendering, no DOM.
 */
export class FlightSim {
  readonly course: Course;
  readonly ballCfg: BallPhysics;
  readonly launch: LaunchParams;

  pos: Vec;
  vel: Vec;
  spin: number;
  /** Seconds since launch. */
  t = 0;
  /** Visual roll angle (radians). */
  roll = 0;

  fuel: number;
  readonly fuelMax: number;
  boosting = false;
  ignited = false;
  /** Current thrust direction (unit vector), valid while boosting. */
  thrustDir: Vec = { x: 1, y: 0 };
  steer = 0;

  ringsPassed = new Set<string>();
  hits: string[] = [];
  bounces = 0;
  maxHeight = 0;
  boostTime = 0;
  groundTouched = false;
  /** First ground contact position. */
  firstLanding: Vec | null = null;

  outcome: FlightOutcome | null = null;
  done = false;
  private settle = 0;
  private events: FlightEvent[] = [];
  private contacts = new Set<string>();

  constructor(course: Course, launch: LaunchParams) {
    this.course = course;
    this.launch = launch;
    this.ballCfg = BALLS[course.sport];
    this.pos = { ...launch.pos };
    this.vel = { ...launch.vel };
    this.spin = launch.spin;
    this.fuel = course.fuel;
    this.fuelMax = course.fuel;
  }

  /** Absolute challenge clock (used to place moving objects). */
  get clock(): number {
    return this.launch.clock + this.t;
  }

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.y);
  }

  /** Remove and return events emitted since the last drain. */
  drain(): FlightEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Advance exactly one fixed step. */
  step(input: FlightInput = NO_INPUT): void {
    if (this.done) return;
    const dt = FIXED_DT;
    const b = this.ballCfg;
    const prev = { ...this.pos };

    // --- Forces -----------------------------------------------------------
    let ax = this.course.wind ?? 0;
    let ay = -GRAVITY;
    const sp = this.speed;
    ax -= b.drag * sp * this.vel.x;
    ay -= b.drag * sp * this.vel.y;
    if (b.magnus && this.spin && this.pos.y > b.radius + 0.01) {
      // perp(v) = (-vy, vx); positive spin lifts a ball moving right.
      ax += b.magnus * this.spin * -this.vel.y;
      ay += b.magnus * this.spin * this.vel.x;
    }

    // --- Rocket -----------------------------------------------------------
    const wantBoost = input.boost && !this.outcome && this.fuel > 0 && this.t >= ROCKET.armDelay;
    this.steer = clamp(input.steer, -1, 1);
    if (wantBoost) {
      if (!this.ignited) {
        this.ignited = true;
        this.events.push({ type: 'ignite', pos: { ...this.pos } });
      }
      const forward = sp > 0.5 ? norm(this.vel) : { x: 1, y: 0.2 };
      this.thrustDir = norm(rotate(forward, this.steer * ROCKET.maxSteer));
      ax += this.thrustDir.x * ROCKET.thrust;
      ay += this.thrustDir.y * ROCKET.thrust;
      this.fuel = Math.max(0, this.fuel - dt);
      this.boostTime += dt;
      if (this.fuel <= 0) this.events.push({ type: 'fuelEmpty', pos: { ...this.pos } });
    }
    this.boosting = wantBoost;

    // --- Integrate (semi-implicit Euler) ------------------------------------
    this.vel.x += ax * dt;
    this.vel.y += ay * dt;
    if (wantBoost) {
      const s = this.speed;
      if (s > ROCKET.maxSpeed) {
        this.vel.x *= ROCKET.maxSpeed / s;
        this.vel.y *= ROCKET.maxSpeed / s;
      }
    }
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.spin *= 1 - b.spinDecay * dt;
    this.t += dt;

    if (this.pos.y > FLIGHT.ceiling) {
      this.pos.y = FLIGHT.ceiling;
      this.vel.y = Math.min(0, this.vel.y);
    }

    this.collideObstacles();
    this.collideGround();
    this.checkRings(prev);
    this.checkObjective(prev);

    this.maxHeight = Math.max(this.maxHeight, this.pos.y);
    this.roll -= (this.vel.x / b.radius) * dt * 0.35;

    // --- Termination ----------------------------------------------------------
    if (this.outcome) {
      this.settle += dt;
      if (this.settle >= FLIGHT.settleTime) this.done = true;
      return;
    }
    const stopped = this.pos.y <= b.radius + 0.02 && this.speed < FLIGHT.stopSpeed;
    if (stopped) this.fail(this.stoppedLabel());
    else if (this.pos.x > this.course.worldEnd || this.pos.x < -25) this.fail('OUT OF PLAY');
    else if (this.t >= FLIGHT.maxTime) this.fail('TIME UP');
  }

  /** Run until done with a fixed input function. Used by tests and the challenge solver. */
  run(inputFn: (sim: FlightSim) => FlightInput = () => NO_INPUT, maxSteps = 4000): this {
    let n = 0;
    while (!this.done && n++ < maxSteps) this.step(inputFn(this));
    return this;
  }

  // ---------------------------------------------------------------------------

  private succeed(label: string): void {
    if (this.outcome) return;
    const missing = this.course.rings.find((r) => r.required && !this.ringsPassed.has(r.id));
    if (missing) {
      this.fail('MISSED THE RING');
      return;
    }
    this.outcome = { success: true, label, pos: { ...this.pos }, t: this.t };
    this.events.push({ type: 'success', pos: { ...this.pos }, label });
  }

  private fail(label: string): void {
    if (this.outcome) return;
    this.outcome = { success: false, label, pos: { ...this.pos }, t: this.t };
    this.events.push({ type: 'fail', pos: { ...this.pos }, label });
  }

  private stoppedLabel(): string {
    switch (this.course.objective.type) {
      case 'goal':
        return this.hits.some((h) => h.startsWith('keeper')) ? 'SAVED!' : 'NO GOAL';
      case 'endzone':
        return 'INCOMPLETE';
      default:
        return 'FALLS SHORT';
    }
  }

  private collideObstacles(): void {
    const r = this.ballCfg.radius;
    const now = new Set<string>();
    for (const o of this.course.obstacles) {
      const box = obstacleAt(o, this.clock);
      const c = circleBox(this.pos, r, box);
      if (!c) continue;
      now.add(o.id);
      this.pos.x += c.nx * c.depth;
      this.pos.y += c.ny * c.depth;
      const vn = this.vel.x * c.nx + this.vel.y * c.ny;
      const impact = Math.abs(vn);
      if (vn < 0) {
        const e = o.bounce ?? this.ballCfg.restitution;
        // Reflect the normal component, damp the tangential one.
        const tx = this.vel.x - vn * c.nx;
        const ty = this.vel.y - vn * c.ny;
        this.vel.x = tx * 0.85 - vn * e * c.nx;
        this.vel.y = ty * 0.85 - vn * e * c.ny;
        this.spin *= 0.5;
      }
      if (!this.contacts.has(o.id)) {
        this.hits.push(o.id);
        this.events.push({ type: 'hit', id: o.id, style: o.style, pos: { ...this.pos }, speed: impact });
        this.onObstacleHit(o.id, o.style);
      }
    }
    this.contacts = now;
  }

  private onObstacleHit(id: string, style: string): void {
    const obj = this.course.objective;
    if (obj.type === 'billboard' && id === obj.targetId) {
      this.succeed('BILLBOARD BLAST!');
      return;
    }
    if (this.course.sport === 'football' && (style === 'defender' || style === 'lineman' || style === 'drone')) {
      this.fail('DEFLECTED!');
    }
  }

  private collideGround(): void {
    const b = this.ballCfg;
    if (this.pos.y >= b.radius) return;
    this.pos.y = b.radius;
    if (!this.groundTouched) {
      this.groundTouched = true;
      this.firstLanding = { x: this.pos.x, y: 0 };
      this.onFirstLanding();
    }
    if (this.vel.y < -1.5) {
      const speed = -this.vel.y;
      this.vel.y = speed * b.restitution;
      this.vel.x *= b.bounceFriction;
      this.spin *= 0.4;
      this.bounces++;
      this.events.push({ type: 'bounce', pos: { ...this.pos }, speed });
    } else {
      this.vel.y = 0;
      const dec = b.rollFriction * FIXED_DT;
      this.vel.x = Math.abs(this.vel.x) <= dec ? 0 : this.vel.x - Math.sign(this.vel.x) * dec;
    }
  }

  private onFirstLanding(): void {
    const obj = this.course.objective;
    const x = this.pos.x;
    if (obj.type === 'endzone') {
      if (!obj.window && x >= obj.x0 && x <= obj.x1) this.succeed('TOUCHDOWN!');
      else if (x < obj.x0) this.fail('INCOMPLETE');
      else this.fail(obj.window ? 'INCOMPLETE' : 'OVERTHROWN');
    } else if (obj.type === 'homerun') {
      if (x < -1) this.fail('FOUL BALL');
      else if (x < obj.x) this.fail(this.maxHeight > 8 ? 'FLY OUT' : 'GROUNDED OUT');
    } else if (obj.type === 'billboard') {
      this.fail(x < -1 ? 'FOUL BALL' : 'MISSED THE BOARD');
    }
  }

  private checkRings(prev: Vec): void {
    const r = this.ballCfg.radius;
    for (const ring of this.course.rings) {
      if (this.ringsPassed.has(ring.id)) continue;
      const c = ringAt(ring, this.clock);
      if (distToSegment(c, prev, this.pos) <= ring.r - r * 0.25) {
        this.ringsPassed.add(ring.id);
        this.events.push({ type: 'ring', id: ring.id, pos: { ...c }, points: ring.points });
      }
    }
  }

  private checkObjective(prev: Vec): void {
    const obj = this.course.objective;
    const r = this.ballCfg.radius;
    if (obj.type === 'endzone' && obj.window && !this.outcome) {
      if (pointInBox(this.pos, windowAt(obj.window, this.clock), r * 0.5)) this.succeed('TOUCHDOWN!');
    } else if (obj.type === 'goal') {
      if (!this.outcome && prev.x < obj.x && this.pos.x >= obj.x) {
        if (this.pos.y < obj.height - r * 0.3) this.succeed('GOAL!');
      }
      // Net: once inside the goal the ball is held by the back and roof of the net.
      if (this.outcome?.success && this.pos.x > obj.x) {
        const back = obj.x + obj.depth - r;
        if (this.pos.x > back) {
          this.pos.x = back;
          this.vel.x = -Math.abs(this.vel.x) * 0.15;
        }
        const roof = obj.height - r;
        if (this.pos.y > roof) {
          this.pos.y = roof;
          this.vel.y = -Math.abs(this.vel.y) * 0.2;
        }
      }
      if (!this.outcome && this.pos.x > obj.x + obj.depth + 2) {
        this.fail(this.pos.y >= obj.height ? 'OVER THE BAR' : 'MISSED');
      }
    } else if (obj.type === 'homerun' && !this.outcome) {
      if (this.pos.x > obj.x + 1.2 && this.pos.y > 0) this.succeed('HOME RUN!');
    }
  }
}
