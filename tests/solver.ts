/**
 * Brute-force "bot player" that searches launches and rocket strategies for a challenge.
 * Used by tests to prove every challenge is completable, and by scripts/tune.ts.
 */
import type { Challenge } from '../src/config/challenges';
import { FlightSim } from '../src/sim/simulation';
import type { FlightInput, LaunchParams } from '../src/sim/types';
import { type Vec, clamp, deg, norm } from '../src/sim/vec';
import { ringAt } from '../src/sim/world';
import { passLaunch, scoreFootball } from '../src/sports/football';
import { kickLaunch, scoreSoccer } from '../src/sports/soccer';
import { BASEBALL, PITCHES, battedLaunch, judgeSwing, scoreBaseball } from '../src/sports/baseball';
import { ROCKET } from '../src/config/physics';

export interface Attempt {
  launch: LaunchParams;
  quality: number;
  desc: string;
}

export type Strategy = { name: string; input: (sim: FlightSim) => FlightInput };

export function launches(c: Challenge, dense = false): Attempt[] {
  const out: Attempt[] = [];
  const moving = c.obstacles.some((o) => o.motion) || c.rings.some((r) => r.motion) || (c.objective.type === 'endzone' && c.objective.window);
  const clocks = moving ? (dense ? [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1] : [0, 0.5, 1.0, 1.5, 2.0]) : [0];
  const aStep = dense ? 2 : 4;
  const pStep = dense ? 0.05 : 0.1;
  if (c.sport === 'football') {
    for (const clock of clocks)
      for (let a = 8; a <= 70; a += aStep)
        for (let p = 0.3; p <= 1.0001; p += pStep) out.push({ launch: passLaunch(deg(a), p, clock), quality: 0, desc: `a${a} p${p.toFixed(2)} t${clock}` });
  } else if (c.sport === 'soccer') {
    for (const clock of clocks)
      for (let a = 3; a <= 57; a += aStep)
        for (let p = 0.3; p <= 1.0001; p += pStep)
          for (const curl of [-1, -0.5, 0, 0.5, 1])
            out.push({ launch: kickLaunch(deg(a), p, curl, clock), quality: 0, desc: `a${a} p${p.toFixed(2)} c${curl} t${clock}` });
  } else {
    const w = c.swingWindow ?? 0.13;
    const pitch = PITCHES[c.pitches?.[0] ?? 'fastball'];
    for (let f = -0.9; f <= 0.9001; f += dense ? 0.15 : 0.3)
      for (const plane of ['lift', 'drive'] as const) {
        const contact = judgeSwing(pitch, pitch.travel + f * w, w);
        const clock = BASEBALL.windup + pitch.travel + f * w;
        out.push({ launch: battedLaunch(contact, plane, w, clock), quality: contact.quality, desc: `${plane} e${(f * w).toFixed(3)}` });
      }
  }
  return out;
}

function waypoints(c: Challenge, sim: FlightSim): Vec[] {
  const pts: Vec[] = c.rings.filter((r) => !sim.ringsPassed.has(r.id)).map((r) => ringAt(r, sim.clock)).filter((p) => p.x > sim.pos.x);
  const o = c.objective;
  if (o.type === 'endzone') pts.push(o.window ? { x: o.window.x + 1.2, y: 2.6 } : { x: (o.x0 + o.x1) / 2, y: 0 });
  else if (o.type === 'goal') pts.push({ x: o.x + 1, y: o.height * 0.6 });
  else if (o.type === 'homerun') pts.push({ x: o.x + 10, y: o.h + 8 });
  else pts.push({ x: o.x + 1, y: o.y + o.h / 2 });
  return pts.filter((p) => p.x > sim.pos.x - 0.5);
}

/** Steer toward the next waypoint (a skilled human approximation). */
function homing(c: Challenge, t0: number, dur: number, ringsOnly: boolean): Strategy {
  return {
    name: `home${ringsOnly ? 'R' : ''} ${t0}+${dur}`,
    input: (sim) => {
      if (sim.t < t0 || sim.t > t0 + dur) return { boost: false, steer: 0 };
      const wps = waypoints(c, sim);
      const target = ringsOnly ? wps[0] : wps[wps.length - 1];
      if (!target) return { boost: false, steer: 0 };
      const want = norm({ x: target.x - sim.pos.x, y: target.y - sim.pos.y });
      const fwd = norm(sim.vel);
      const ang = Math.atan2(fwd.x * want.y - fwd.y * want.x, fwd.x * want.x + fwd.y * want.y);
      return { boost: true, steer: clamp(ang / ROCKET.maxSteer, -1, 1) };
    },
  };
}

export function strategies(c: Challenge, dense = false): Strategy[] {
  const s: Strategy[] = [{ name: 'none', input: () => ({ boost: false, steer: 0 }) }];
  if (c.fuel <= 0) return s;
  const starts = dense ? [0.2, 0.5, 0.8, 1.1, 1.5, 2.0, 2.6] : [0.2, 0.7, 1.3, 2.0];
  const durs = dense ? [0.3, 0.6, 1.0, 1.5, 9] : [0.5, 1.2, 9];
  for (const t0 of starts)
    for (const d of durs) {
      for (const st of dense ? [-1, -0.5, 0, 0.5, 1] : [-0.6, 0, 0.6])
        s.push({ name: `const ${t0}+${d} s${st}`, input: (sim) => ({ boost: sim.t >= t0 && sim.t <= t0 + d, steer: st }) });
      s.push(homing(c, t0, d, false));
      s.push(homing(c, t0, d, true));
    }
  return s;
}

export interface SolveResult {
  solved: boolean;
  best: number;
  bestDesc: string;
  solvedWithoutRocket: boolean;
  successes: number;
  tried: number;
}

export function scoreSim(c: Challenge, sim: FlightSim, quality: number): { success: boolean; total: number } {
  const r = c.sport === 'football' ? scoreFootball(sim) : c.sport === 'soccer' ? scoreSoccer(sim) : scoreBaseball(sim, quality);
  return { success: r.success, total: r.total };
}

export function solve(c: Challenge, opts: { dense?: boolean; stopAtFirst?: boolean } = {}): SolveResult {
  const res: SolveResult = { solved: false, best: 0, bestDesc: '', solvedWithoutRocket: false, successes: 0, tried: 0 };
  const strats = strategies(c, opts.dense);
  for (const a of launches(c, opts.dense)) {
    // Cheap prune: skip rocket strategies for launches that hit the ground almost immediately.
    for (const st of strats) {
      const sim = new FlightSim(c, a.launch).run(st.input);
      res.tried++;
      const sc = scoreSim(c, sim, a.quality);
      if (sc.success) {
        res.solved = true;
        res.successes++;
        if (!sim.ignited) res.solvedWithoutRocket = true;
        if (sc.total > res.best) {
          res.best = sc.total;
          res.bestDesc = `${a.desc} | ${st.name}`;
        }
        if (opts.stopAtFirst) return res;
      }
    }
  }
  return res;
}
