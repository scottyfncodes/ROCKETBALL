// Usage: npx vite-node scripts/tune.ts [challengeId...]
import { CHALLENGES, TRIPLE_THREAT } from '../src/config/challenges';
import { solve } from '../tests/solver';

const ids = process.argv.slice(2);
for (const c of [...CHALLENGES, ...TRIPLE_THREAT]) {
  if (ids.length && !ids.includes(c.id)) continue;
  const t = Date.now();
  const r = solve(c, { dense: process.env.DENSE === '1' });
  console.log(
    `${c.id.padEnd(4)} ${c.name.padEnd(28)} solved=${r.solved} noRocket=${r.solvedWithoutRocket} best=${r.best} stars=${c.stars} succ=${r.successes}/${r.tried} ${Date.now() - t}ms  ${r.bestDesc}`,
  );
}
