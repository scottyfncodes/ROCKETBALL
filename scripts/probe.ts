import { challengeById } from '../src/config/challenges';
import { FlightSim } from '../src/sim/simulation';
import { launches, scoreSim } from '../tests/solver';
const c = challengeById(process.argv[2] ?? 'sc4')!;
let n = 0;
for (const a of launches(c, true)) {
  const sim = new FlightSim(c, a.launch).run();
  if (scoreSim(c, sim, a.quality).success) {
    if (n++ < 5) console.log(a.desc, 'landing', sim.firstLanding?.x.toFixed(1), 'bounces', sim.bounces, 'hits', sim.hits, 'apex', sim.maxHeight.toFixed(1));
  }
}
console.log('total', n);
