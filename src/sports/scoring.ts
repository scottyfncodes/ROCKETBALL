import type { FlightSim } from '../sim/simulation';

export interface ScoreItem {
  label: string;
  value: number;
}

export interface ScoreResult {
  success: boolean;
  label: string;
  total: number;
  items: ScoreItem[];
}

export function fuelBonus(sim: FlightSim, max: number): number {
  if (sim.fuelMax <= 0) return 0;
  return Math.round((sim.fuel / sim.fuelMax) * max);
}

export function ringBonus(sim: FlightSim): number {
  return sim.course.rings.filter((r) => sim.ringsPassed.has(r.id)).reduce((s, r) => s + r.points, 0);
}

export function finalize(success: boolean, label: string, items: ScoreItem[]): ScoreResult {
  const kept = items.filter((i) => i.value > 0).map((i) => ({ ...i, value: Math.round(i.value) }));
  const total = success ? kept.reduce((s, i) => s + i.value, 0) : 0;
  return { success, label, total, items: success ? kept : [] };
}

/** Stars for a score: 0 on failure, 1 for any success, 2/3 at the challenge thresholds. */
export function starsFor(success: boolean, total: number, thresholds: readonly [number, number]): number {
  if (!success) return 0;
  if (total >= thresholds[1]) return 3;
  if (total >= thresholds[0]) return 2;
  return 1;
}
