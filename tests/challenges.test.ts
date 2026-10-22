import { describe, expect, it } from 'vitest';
import { CHALLENGES, TRIPLE_THREAT } from '../src/config/challenges';
import { SPORTS } from '../src/sim/types';
import { FlightSim } from '../src/sim/simulation';
import { launches, scoreSim, solve } from './solver';

describe('challenge set', () => {
  it('has five challenges per sport with unique ids and indices 1–5', () => {
    expect(CHALLENGES).toHaveLength(15);
    for (const sport of SPORTS) {
      const list = CHALLENGES.filter((c) => c.sport === sport);
      expect(list.map((c) => c.index)).toEqual([1, 2, 3, 4, 5]);
    }
    const ids = [...CHALLENGES, ...TRIPLE_THREAT].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('star thresholds rise from 2 to 3 stars', () => {
    for (const c of CHALLENGES) expect(c.stars[1]).toBeGreaterThan(c.stars[0]);
  });

  it('baseball challenges define pitches and a timing window', () => {
    for (const c of CHALLENGES.filter((x) => x.sport === 'baseball')) {
      expect(c.pitches?.length).toBeGreaterThan(0);
      expect(c.swingWindow).toBeGreaterThan(0.05);
    }
  });
});

// The "bot player" brute-forces launches and rocket strategies through the real simulation.
describe('every challenge is completable', () => {
  for (const c of [...CHALLENGES, ...TRIPLE_THREAT]) {
    it(`${c.id} ${c.name}`, { timeout: 120_000 }, () => {
      const r = solve(c, { stopAtFirst: true });
      expect(r.solved).toBe(true);
    });
  }
});

describe('rocket challenges really need the rocket', () => {
  for (const c of CHALLENGES.filter((x) => x.requiresRocket)) {
    it(`${c.id} ${c.name} cannot be completed without boosting`, { timeout: 60_000 }, () => {
      for (const a of launches(c, true)) {
        const sim = new FlightSim(c, a.launch).run();
        expect(scoreSim(c, sim, a.quality).success).toBe(false);
      }
    });
  }
});
