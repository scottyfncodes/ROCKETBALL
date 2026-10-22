import type { Course, LaunchParams } from '../../sim/types';
import type { Vec } from '../../sim/vec';
import { FlightSim } from '../../sim/simulation';

/** Unboosted trajectory points for an aim preview. Stops at the first ground contact or obstacle. */
export function previewPath(course: Course, launch: LaunchParams, maxTime: number, every = 4): Vec[] {
  const sim = new FlightSim({ ...course, rings: [] }, launch);
  const pts: Vec[] = [{ ...sim.pos }];
  let n = 0;
  while (sim.t < maxTime && !sim.groundTouched && sim.hits.length === 0 && !sim.done) {
    sim.step();
    if (++n % every === 0) pts.push({ ...sim.pos });
  }
  pts.push({ ...sim.pos });
  return pts;
}
