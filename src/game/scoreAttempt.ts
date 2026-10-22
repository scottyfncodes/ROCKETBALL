import type { Challenge } from '../config/challenges';
import type { FlightSim } from '../sim/simulation';
import { scoreBaseball } from '../sports/baseball';
import { scoreFootball } from '../sports/football';
import { finalize, starsFor, type ScoreResult } from '../sports/scoring';
import { scoreSoccer } from '../sports/soccer';

/** Sport-specific scoring for a finished flight. */
export function scoreAttempt(ch: Challenge, sim: FlightSim, quality: number): ScoreResult {
  switch (ch.sport) {
    case 'football':
      return scoreFootball(sim);
    case 'soccer':
      return scoreSoccer(sim);
    case 'baseball':
      return scoreBaseball(sim, quality);
  }
}

export const failedSetup = (label: string): ScoreResult => finalize(false, label, []);

export function medalFor(ch: Challenge, r: ScoreResult): number {
  return starsFor(r.success, r.total, ch.stars);
}

/** One line of concrete feedback for a missed attempt ("Landed at 52 m — end zone is 28–40 m"). */
export function describeMiss(ch: Challenge, sim: FlightSim | null): string | null {
  if (!sim?.outcome || sim.outcome.success) return null;
  const o = ch.objective;
  const at = sim.outcome.pos;
  const m = (n: number) => `${Math.round(n)} m`;
  const req = ch.rings.find((r) => r.required && !sim.ringsPassed.has(r.id));
  if (req) return `You missed the gold ring at ${m(req.x)}, ${m(req.y)} high.`;
  switch (o.type) {
    case 'endzone':
      if (sim.hits.length) return 'A defender got a hand on it. Go over them or time the jump.';
      if (o.window) return `Ball came down at ${m(at.x)}. Your receiver was around ${m(o.window.x)}.`;
      return `Landed at ${m(at.x)}. The end zone is ${Math.round(o.x0)}–${m(o.x1)}.`;
    case 'goal':
      if (sim.hits.includes('keeper')) return 'The keeper got it. Go higher than his gloves.';
      if (sim.hits.includes('wall')) return 'Blocked by the wall. Kick higher or add dip.';
      if (sim.maxHeight > o.height && at.x > o.x) return `Over the bar — keep it under ${o.height} m at the goal line.`;
      return `Stopped at ${m(at.x)}. The goal is at ${m(o.x)}.`;
    case 'homerun':
      if (sim.hits.includes('wall')) return `Hit the wall. You need more than ${m(o.h)} of height at ${m(o.x)}.`;
      return `Carried ${m(Math.max(at.x, sim.pos.x))}. The fence is at ${m(o.x)}.`;
    case 'billboard':
      return `The board is at ${m(o.x)}, ${Math.round(o.y)}–${m(o.y + o.h)} high.`;
  }
}
