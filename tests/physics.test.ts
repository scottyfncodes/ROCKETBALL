import { describe, expect, it } from 'vitest';
import { BALLS, FIXED_DT, GRAVITY, ROCKET } from '../src/config/physics';
import { FlightSim } from '../src/sim/simulation';
import { FixedStepper } from '../src/sim/stepper';
import { launchAt, openCourse } from './helpers';

describe('ballistic flight', () => {
  it('falls under gravity with the expected vertical acceleration', () => {
    const sim = new FlightSim(openCourse(), launchAt(0, 0, 50));
    for (let i = 0; i < 60; i++) sim.step();
    // Drag at these low speeds is tiny, so v ≈ -g t.
    expect(sim.vel.y).toBeCloseTo(-GRAVITY * 60 * FIXED_DT, 0);
    expect(sim.vel.y).toBeGreaterThan(-GRAVITY * 60 * FIXED_DT); // drag only slows it
  });

  it('carries less far than a vacuum because of drag', () => {
    const v = 20;
    const sim = new FlightSim(openCourse(), launchAt(v * Math.SQRT1_2, v * Math.SQRT1_2, BALLS.football.radius)).run();
    const vacuum = (v * v) / GRAVITY;
    expect(sim.firstLanding!.x).toBeLessThan(vacuum);
    expect(sim.firstLanding!.x).toBeGreaterThan(vacuum * 0.8);
  });

  it('backspin lifts a soccer ball and topspin makes it dip', () => {
    const run = (spin: number) => new FlightSim(openCourse('soccer'), launchAt(18, 10, 0.5, spin)).run().firstLanding!.x;
    expect(run(6)).toBeGreaterThan(run(0));
    expect(run(-6)).toBeLessThan(run(0));
  });

  it('is deterministic', () => {
    const a = new FlightSim(openCourse(), launchAt(15, 12)).run((s) => ({ boost: s.t > 0.5 && s.t < 1.2, steer: 0.4 }));
    const b = new FlightSim(openCourse(), launchAt(15, 12)).run((s) => ({ boost: s.t > 0.5 && s.t < 1.2, steer: 0.4 }));
    expect(a.pos).toEqual(b.pos);
    expect(a.fuel).toEqual(b.fuel);
  });

  it('bounces on the ground, losing speed, then rolls to a stop', () => {
    const sim = new FlightSim(openCourse('soccer', { objective: { type: 'goal', x: 999, height: 4.5, depth: 2 } }), launchAt(8, 6, 1));
    sim.run();
    expect(sim.bounces).toBeGreaterThan(0);
    expect(sim.outcome?.success).toBe(false);
    expect(sim.speed).toBeLessThan(1);
    expect(sim.pos.y).toBeCloseTo(BALLS.soccer.radius, 2);
  });
});

describe('fixed-step simulation', () => {
  const simulateAt = (fps: number) => {
    const sim = new FlightSim(openCourse(), launchAt(16, 14));
    const stepper = new FixedStepper();
    // Input depends on simulation time, as it does when a player holds the rocket.
    for (let f = 0; f < fps * 2; f++) stepper.advance(1 / fps, () => sim.step({ boost: sim.t > 0.5 && sim.t < 1.25, steer: 0.3 }));
    return sim;
  };

  it('produces the same trajectory at 30, 60 and 120 fps', () => {
    const a = simulateAt(30);
    const b = simulateAt(60);
    const c = simulateAt(120);
    expect(a.t).toBeCloseTo(b.t, 6);
    expect(b.t).toBeCloseTo(c.t, 6);
    expect(a.pos.x).toBeCloseTo(c.pos.x, 4);
    expect(a.pos.y).toBeCloseTo(c.pos.y, 4);
  });

  it('drops the backlog after a long stall instead of fast-forwarding', () => {
    const s = new FixedStepper();
    let n = 0;
    s.advance(5, () => n++);
    expect(n).toBe(s.maxSteps);
    expect(s.acc).toBe(0);
  });
});

describe('rocket fuel', () => {
  it('only burns fuel while boosting', () => {
    const sim = new FlightSim(openCourse(), launchAt(15, 15));
    for (let i = 0; i < 120; i++) sim.step({ boost: false, steer: 0 });
    expect(sim.fuel).toBe(2);
    for (let i = 0; i < 60; i++) sim.step({ boost: true, steer: 0 });
    expect(sim.fuel).toBeCloseTo(2 - 60 * FIXED_DT, 6);
    for (let i = 0; i < 60; i++) sim.step({ boost: false, steer: 0 });
    expect(sim.fuel).toBeCloseTo(2 - 60 * FIXED_DT, 6);
  });

  it('cannot ignite during the arming delay right after launch', () => {
    const sim = new FlightSim(openCourse(), launchAt(15, 15));
    while (sim.t < ROCKET.armDelay - FIXED_DT) sim.step({ boost: true, steer: 0 });
    expect(sim.ignited).toBe(false);
    expect(sim.fuel).toBe(2);
    for (let i = 0; i < 3; i++) sim.step({ boost: true, steer: 0 });
    expect(sim.ignited).toBe(true);
  });

  it('stops thrusting when the tank is empty and never goes negative', () => {
    const sim = new FlightSim(openCourse('football', { fuel: 0.5 }), launchAt(15, 25));
    const events: string[] = [];
    for (let i = 0; i < 240; i++) {
      sim.step({ boost: true, steer: 0 });
      events.push(...sim.drain().map((e) => e.type));
    }
    expect(sim.fuel).toBe(0);
    expect(sim.boosting).toBe(false);
    expect(events.filter((e) => e === 'ignite')).toHaveLength(1);
    expect(events.filter((e) => e === 'fuelEmpty')).toHaveLength(1);
    expect(sim.boostTime).toBeCloseTo(0.5, 2);
  });

  it('boosting extends a pass', () => {
    const plain = new FlightSim(openCourse(), launchAt(14, 14)).run();
    const boosted = new FlightSim(openCourse(), launchAt(14, 14)).run(() => ({ boost: true, steer: 0 }));
    expect(boosted.firstLanding!.x).toBeGreaterThan(plain.firstLanding!.x + 20);
  });

  it('caps rocket speed', () => {
    const sim = new FlightSim(openCourse('baseball', { fuel: 10 }), launchAt(30, 30));
    sim.run(() => ({ boost: true, steer: 0.3 }), 1000);
    expect(sim.speed).toBeLessThanOrEqual(ROCKET.maxSpeed + 1e-6);
  });
});

describe('steering', () => {
  const flyWith = (steer: number) => {
    const sim = new FlightSim(openCourse(), launchAt(15, 8));
    for (let i = 0; i < 120; i++) sim.step({ boost: true, steer });
    return sim;
  };

  it('steering up climbs and steering down dives, predictably ordered', () => {
    const up = flyWith(1);
    const level = flyWith(0);
    const down = flyWith(-1);
    expect(up.pos.y).toBeGreaterThan(level.pos.y);
    expect(level.pos.y).toBeGreaterThan(down.pos.y);
  });

  it('rotates thrust from the flight direction by at most the steer limit', () => {
    const sim = new FlightSim(openCourse(), launchAt(10, 0, 30));
    for (let i = 0; i < 30; i++) sim.step({ boost: true, steer: 1 });
    sim.step({ boost: true, steer: 1 });
    const fwd = Math.atan2(sim.vel.y, sim.vel.x);
    const thr = Math.atan2(sim.thrustDir.y, sim.thrustDir.x);
    // thrustDir is computed from the velocity before this step's update; allow a little slack.
    expect(Math.abs(thr - fwd)).toBeLessThanOrEqual(ROCKET.maxSteer + 0.1);
    expect(thr).toBeGreaterThan(fwd);
  });

  it('clamps steer input to [-1, 1]', () => {
    const a = flyWith(1);
    const b = new FlightSim(openCourse(), launchAt(15, 8));
    for (let i = 0; i < 120; i++) b.step({ boost: true, steer: 7 });
    expect(b.pos).toEqual(a.pos);
  });
});
