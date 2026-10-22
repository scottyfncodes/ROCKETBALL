import { describe, expect, it } from 'vitest';
import { FlightSim } from '../src/sim/simulation';
import { circleBox } from '../src/sim/world';
import type { Course } from '../src/sim/types';
import { launchAt, openCourse } from './helpers';

const goalCourse = (extra: Partial<Course> = {}): Course => ({
  sport: 'soccer',
  fuel: 1,
  objective: { type: 'goal', x: 20, height: 4.5, depth: 2.2 },
  obstacles: [{ id: 'crossbar', style: 'crossbar', x: 19.85, y: 4.5, w: 0.3, h: 0.3 }],
  rings: [],
  worldEnd: 60,
  ...extra,
});

describe('circle vs box', () => {
  it('reports a push-out normal on overlap and null when apart', () => {
    expect(circleBox({ x: 0, y: 0 }, 1, { x: 2, y: -1, w: 1, h: 2 })).toBeNull();
    const c = circleBox({ x: 1.5, y: 0 }, 1, { x: 2, y: -1, w: 1, h: 2 })!;
    expect(c.nx).toBeCloseTo(-1);
    expect(c.depth).toBeCloseTo(0.5);
  });
  it('handles a centre inside the box', () => {
    const c = circleBox({ x: 0.5, y: 0.9 }, 0.2, { x: 0, y: 0, w: 1, h: 1 })!;
    expect(c.ny).toBe(1);
  });
});

describe('obstacles', () => {
  it('bounces the ball back off a wall and reports the hit', () => {
    const course = openCourse('soccer', { obstacles: [{ id: 'w', style: 'wall', x: 5, y: 0, w: 1, h: 20 }] });
    const sim = new FlightSim(course, launchAt(15, 2, 3));
    const hits: string[] = [];
    for (let i = 0; i < 120; i++) {
      sim.step();
      for (const e of sim.drain()) if (e.type === 'hit') hits.push(e.id);
    }
    expect(hits).toEqual(['w']);
    expect(sim.vel.x).toBeLessThan(0);
    expect(sim.pos.x).toBeLessThan(5);
  });

  it('a defender deflection ends a football pass', () => {
    const course = openCourse('football', {
      objective: { type: 'endzone', x0: 30, x1: 40 },
      obstacles: [{ id: 'd', style: 'defender', x: 6, y: 0, w: 1.5, h: 6 }],
    });
    const sim = new FlightSim(course, launchAt(14, 3)).run();
    expect(sim.outcome).toMatchObject({ success: false, label: 'DEFLECTED!' });
  });

  it('moving obstacles follow their deterministic motion', () => {
    const course = openCourse('football', {
      obstacles: [{ id: 'd', style: 'defender', x: 6, y: 0, w: 1.5, h: 4, motion: { axis: 'y', amplitude: 3, period: 2 } }],
    });
    // Same throw, different launch clocks: one meets the jumping defender, one does not.
    const t0 = new FlightSim(course, { ...launchAt(14, 3), clock: 0 }).run();
    const t1 = new FlightSim(course, { ...launchAt(14, 3), clock: 1.0 }).run();
    expect(t0.hits.includes('d')).not.toBe(t1.hits.includes('d'));
  });
});

describe('objectives', () => {
  it('scores a goal under the bar', () => {
    const sim = new FlightSim(goalCourse(), launchAt(16, 4.5, 0.5)).run();
    expect(sim.outcome).toMatchObject({ success: true, label: 'GOAL!' });
    // The net holds the ball.
    expect(sim.pos.x).toBeLessThanOrEqual(20 + 2.2);
  });

  it('does not score over the bar', () => {
    const sim = new FlightSim(goalCourse(), launchAt(16, 12, 0.5)).run();
    expect(sim.outcome?.success).toBe(false);
  });

  it('touchdown when the first bounce is in the end zone, otherwise incomplete / overthrown', () => {
    const c = (x0: number, x1: number) => openCourse('football', { objective: { type: 'endzone', x0, x1 } });
    const land = new FlightSim(openCourse(), launchAt(14, 14)).run().firstLanding!.x;
    expect(new FlightSim(c(land - 3, land + 3), launchAt(14, 14)).run().outcome).toMatchObject({ success: true, label: 'TOUCHDOWN!' });
    expect(new FlightSim(c(land + 5, land + 10), launchAt(14, 14)).run().outcome).toMatchObject({ success: false, label: 'INCOMPLETE' });
    expect(new FlightSim(c(land - 10, land - 5), launchAt(14, 14)).run().outcome).toMatchObject({ success: false, label: 'OVERTHROWN' });
  });

  it('catch window: hitting the receiver scores, landing near him does not', () => {
    const course = openCourse('football', { objective: { type: 'endzone', x0: 0, x1: 99, window: { x: 10, y: 1, w: 2, h: 3 } } });
    expect(new FlightSim(course, launchAt(12, 4)).run().outcome?.success).toBe(true);
    expect(new FlightSim(course, launchAt(12, 14)).run().outcome?.success).toBe(false);
  });

  it('home run clears the wall; hitting the wall does not', () => {
    const course = openCourse('baseball', { objective: { type: 'homerun', x: 60, h: 5 }, obstacles: [{ id: 'wall', style: 'outfieldWall', x: 60, y: 0, w: 1, h: 5 }] });
    expect(new FlightSim(course, launchAt(30, 20, 1)).run().outcome).toMatchObject({ success: true, label: 'HOME RUN!' });
    const low = new FlightSim(course, launchAt(30, 2, 1)).run();
    expect(low.outcome?.success).toBe(false);
  });

  it('billboard objective requires striking the target', () => {
    const board = { id: 'board', style: 'billboard' as const, x: 20, y: 5, w: 2, h: 6 };
    const course = openCourse('baseball', { objective: { type: 'billboard', targetId: 'board', x: 20, y: 5, w: 2, h: 6 }, obstacles: [board] });
    expect(new FlightSim(course, launchAt(25, 12, 1)).run().outcome).toMatchObject({ success: true });
    expect(new FlightSim(course, launchAt(25, 25, 1)).run().outcome?.success).toBe(false);
  });

  it('rings are collected when the ball passes through them', () => {
    const course = openCourse('football', { rings: [{ id: 'r', x: 6, y: 2, r: 1, points: 100 }] });
    const sim = new FlightSim(course, launchAt(20, 0.5, 2));
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.ringsPassed.has('r')).toBe(true);
    const miss = new FlightSim(course, launchAt(20, 15, 2));
    for (let i = 0; i < 60; i++) miss.step();
    expect(miss.ringsPassed.has('r')).toBe(false);
  });

  it('a required ring turns a goal into a miss when skipped', () => {
    const course = goalCourse({ rings: [{ id: 'g', x: 10, y: 15, r: 1, points: 0, required: true }] });
    const sim = new FlightSim(course, launchAt(16, 4.5, 0.5)).run();
    expect(sim.outcome).toMatchObject({ success: false, label: 'MISSED THE RING' });
  });
});
