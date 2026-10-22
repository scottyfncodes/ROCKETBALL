import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../src/config/challenges';
import { FlightSim } from '../src/sim/simulation';
import { deg } from '../src/sim/vec';
import { BASEBALL, PITCHES, battedLaunch, judgeSwing, pitchPos } from '../src/sports/baseball';
import { FOOTBALL, aimFromDrag, passLaunch } from '../src/sports/football';
import { SOCCER, kickFromSwipe } from '../src/sports/soccer';
import { scoreAttempt } from '../src/game/scoreAttempt';
import { starsFor } from '../src/sports/scoring';

describe('football slingshot aim', () => {
  it('pulling down-left throws up-right; power scales with pull length', () => {
    const a = aimFromDrag(-100, 100, 200);
    expect(a.angle).toBeCloseTo(deg(45), 5);
    expect(a.power).toBeCloseTo(Math.SQRT2 / 2, 5);
    expect(a.valid).toBe(true);
    expect(aimFromDrag(-400, 0, 200).power).toBe(1);
  });
  it('tiny drags cancel and angles are clamped', () => {
    expect(aimFromDrag(-5, 5, 200).valid).toBe(false);
    expect(aimFromDrag(-100, -100, 200).angle).toBe(FOOTBALL.minAngle);
    expect(aimFromDrag(0, 200, 200).angle).toBe(FOOTBALL.maxAngle);
  });
  it('launch speed maps power to the configured range', () => {
    const l = passLaunch(0, 1, 0);
    expect(l.vel.x).toBeCloseTo(FOOTBALL.vMax);
    expect(passLaunch(0, 0, 0).vel.x).toBeCloseTo(FOOTBALL.vMin);
  });
});

describe('soccer swipe kick', () => {
  const swipe = (bulge: number) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push({ x: i * 20, y: -i * 10 - Math.sin((i / 10) * Math.PI) * bulge });
    return kickFromSwipe(pts, 300);
  };
  it('reads angle and power from the swipe chord', () => {
    const k = swipe(0);
    expect(k.angle).toBeCloseTo(Math.atan2(100, 200), 5);
    expect(k.power).toBeCloseTo(Math.hypot(200, 100) / 300, 5);
    expect(Math.abs(k.curl)).toBeLessThan(0.01);
  });
  it('a rainbow swipe gives topspin (dip) and a smile gives backspin (float)', () => {
    expect(swipe(40).curl).toBeLessThan(-0.5);
    expect(swipe(-40).curl).toBeGreaterThan(0.5);
  });
  it('swiping away from the goal is rejected', () => {
    expect(kickFromSwipe([{ x: 100, y: 0 }, { x: 0, y: -50 }], 300).valid).toBe(false);
  });
  it('maximum curl maps to the spin limit', () => {
    expect(SOCCER.maxSpin).toBeGreaterThan(0);
  });
});

describe('baseball timing', () => {
  const p = PITCHES.fastball;
  it('perfect timing is the arrival time at the plate', () => {
    const c = judgeSwing(p, p.travel, 0.13);
    expect(c).toMatchObject({ hit: true, grade: 'PERFECT', quality: 1 });
  });
  it('outside the window is a miss; inside degrades quality', () => {
    expect(judgeSwing(p, p.travel - 0.2, 0.13).hit).toBe(false);
    const late = judgeSwing(p, p.travel + 0.1, 0.13);
    expect(late.hit).toBe(true);
    expect(late.quality).toBeLessThan(0.3);
  });
  it('early contact lofts the ball, late contact flattens it; lift > drive', () => {
    const early = battedLaunch(judgeSwing(p, p.travel - 0.06, 0.13), 'lift', 0.13, 0);
    const late = battedLaunch(judgeSwing(p, p.travel + 0.06, 0.13), 'lift', 0.13, 0);
    const drive = battedLaunch(judgeSwing(p, p.travel - 0.06, 0.13), 'drive', 0.13, 0);
    const ang = (l: { vel: { x: number; y: number } }) => Math.atan2(l.vel.y, l.vel.x);
    expect(ang(early)).toBeGreaterThan(ang(late));
    expect(ang(early)).toBeGreaterThan(ang(drive));
  });
  it('better contact hits it harder', () => {
    const perfect = battedLaunch(judgeSwing(p, p.travel, 0.13), 'lift', 0.13, 0);
    const weak = battedLaunch(judgeSwing(p, p.travel + 0.12, 0.13), 'lift', 0.13, 0);
    expect(Math.hypot(perfect.vel.x, perfect.vel.y)).toBeCloseTo(BASEBALL.vMax, 5);
    expect(Math.hypot(weak.vel.x, weak.vel.y)).toBeLessThan(BASEBALL.vMax * 0.75);
  });
  it('pitches travel from the mound to the plate', () => {
    expect(pitchPos(p, 0).x).toBeCloseTo(BASEBALL.mound.x);
    expect(pitchPos(p, p.travel).x).toBeCloseTo(BASEBALL.plate.x);
    expect(pitchPos(p, p.travel).y).toBeCloseTo(BASEBALL.plate.y);
  });
});

describe('sport scoring is distinct', () => {
  const labels = (sport: string) => {
    const ch = CHALLENGES.find((c) => c.sport === sport && c.index === 1)!;
    return ch;
  };
  it('each sport scores different things', () => {
    const fb = labels('football');
    const sim = new FlightSim(fb, passLaunch(deg(45), 0.9, 0)).run();
    const r = scoreAttempt(fb, sim, 0.9);
    expect(r.success).toBe(true);
    expect(r.items.map((i) => i.label)).toEqual(expect.arrayContaining(['Touchdown', 'Accuracy', 'Pass distance']));

    const sc = labels('soccer');
    const ssim = new FlightSim(sc, { pos: { x: 0, y: 0.5 }, vel: { x: 17, y: 8 }, spin: 0, clock: 0 }).run();
    const s = scoreAttempt(sc, ssim, 1);
    expect(s.success).toBe(true);
    expect(s.items.map((i) => i.label)).toContain('Goal');
    expect(s.items.some((i) => i.label === 'Placement' || i.label === 'Top corner!')).toBe(true);

    const bb = labels('baseball');
    const bsim = new FlightSim(bb, battedLaunch(judgeSwing(PITCHES.meatball, PITCHES.meatball.travel, 0.17), 'lift', 0.17, 0)).run();
    const b = scoreAttempt(bb, bsim, 1);
    expect(b.success).toBe(true);
    expect(b.items.map((i) => i.label)).toEqual(expect.arrayContaining(['Home run', 'Contact', 'Distance']));
  });

  it('failures score zero', () => {
    const fb = labels('football');
    const sim = new FlightSim(fb, passLaunch(deg(10), 0.2, 0)).run();
    const r = scoreAttempt(fb, sim, 0.2);
    expect(r).toMatchObject({ success: false, total: 0, items: [] });
  });
});

describe('medals', () => {
  it('awards 0–3 stars from success and thresholds', () => {
    expect(starsFor(false, 99999, [100, 200])).toBe(0);
    expect(starsFor(true, 50, [100, 200])).toBe(1);
    expect(starsFor(true, 100, [100, 200])).toBe(2);
    expect(starsFor(true, 250, [100, 200])).toBe(3);
  });
});
