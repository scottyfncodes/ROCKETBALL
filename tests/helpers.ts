import type { Course } from '../src/sim/types';

/** An empty field: nothing to hit, objective far away. */
export const openCourse = (sport: Course['sport'] = 'football', extra: Partial<Course> = {}): Course => ({
  sport,
  fuel: 2,
  objective: { type: 'homerun', x: 9999, h: 0 },
  obstacles: [],
  rings: [],
  worldEnd: 9999,
  ...extra,
});

export const launchAt = (vx: number, vy: number, y = 2, spin = 0) => ({ pos: { x: 0, y }, vel: { x: vx, y: vy }, spin, clock: 0 });
