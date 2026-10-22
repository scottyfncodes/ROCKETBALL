import { FlightSim } from '../src/sim/simulation';
import { passLaunch } from '../src/sports/football';
import { kickLaunch } from '../src/sports/soccer';
import { BASEBALL, battedLaunch } from '../src/sports/baseball';
import { deg } from '../src/sim/vec';
import type { Course } from '../src/sim/types';

const open = (sport: Course['sport']): Course => ({ sport, fuel: 2, objective: { type: 'homerun', x: 9999, h: 0 }, obstacles: [], rings: [], worldEnd: 9999 });
const carry = (c: Course, l: ReturnType<typeof passLaunch>, boost = false) => {
  const s = new FlightSim(c, l).run(() => ({ boost, steer: 0 }));
  return `${s.firstLanding?.x.toFixed(1)}m apex ${s.maxHeight.toFixed(1)} t ${s.t.toFixed(2)}`;
};
for (const a of [30, 40, 45, 50]) console.log('football', a, carry(open('football'), passLaunch(deg(a), 1, 0)), '| boost', carry(open('football'), passLaunch(deg(a), 1, 0), true));
for (const c of [-1, 0, 1]) for (const a of [20, 35, 45]) console.log('soccer', a, 'curl', c, carry(open('soccer'), kickLaunch(deg(a), 1, c, 0)), '| boost', carry(open('soccer'), kickLaunch(deg(a), 1, c, 0), true));
for (const plane of ['lift', 'drive'] as const) console.log('baseball', plane, carry(open('baseball'), battedLaunch({ hit: true, error: 0, quality: 1, grade: 'PERFECT' }, plane, 0.13, 0)), '| boost', carry(open('baseball'), battedLaunch({ hit: true, error: 0, quality: 1, grade: 'PERFECT' }, plane, 0.13, 0), true), BASEBALL.vMax);
