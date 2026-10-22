/**
 * Browser smoke test: builds nothing, serves dist/ with `vite preview`, drives the game in
 * Chromium with phone, small-phone, landscape and desktop emulation.
 *
 *   npm run build && npm run e2e
 *
 * Set CHROMIUM_PATH to use a specific Chromium binary.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium, devices } from 'playwright-core';

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const exe = process.env.CHROMIUM_PATH ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => {
  try {
    process.kill(-server.pid);
  } catch {
    /* already gone */
  }
};
process.on('exit', stopServer);
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve());
  server.on('exit', (c) => reject(new Error(`preview exited ${c}`)));
  setTimeout(() => reject(new Error('preview timeout')), 20000);
});

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROFILES = [
  { name: 'iPhone 13 portrait', ctx: { ...devices['iPhone 13'] }, touch: true },
  { name: 'iPhone SE portrait', ctx: { ...devices['iPhone SE'] }, touch: true },
  { name: 'iPhone 13 landscape', ctx: { ...devices['iPhone 13 landscape'] }, touch: true },
  { name: 'Desktop 1280x800', ctx: { viewport: { width: 1280, height: 800 } }, touch: false },
];

async function touchDrag(cdp, pts, holdMs = 0) {
  const tp = (p) => [{ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) });
  for (const p of pts.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) });
    await sleep(16);
  }
  if (holdMs) await sleep(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function drag(page, cdp, touch, pts, holdMs = 0) {
  if (touch) return touchDrag(cdp, pts, holdMs);
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y);
  if (holdMs) await sleep(holdMs);
  await page.mouse.up();
}

const state = (page) =>
  page.evaluate(() => {
    const g = window.__rocketball.game;
    return {
      phase: g.phase,
      paused: g.paused,
      fuel: g.sim?.fuel ?? null,
      ignited: g.sim?.ignited ?? false,
      challenge: g.challenge.id,
      scrollY: window.scrollY,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      muted: g.sfx.muted,
    };
  });

for (const prof of PROFILES) {
  console.log(`\n${prof.name}`);
  const ctx = await browser.newContext(prof.ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(URL);
  await page.waitForFunction(() => !!window.__rocketball);
  await sleep(500);
  const vp = page.viewportSize();
  const mid = { x: vp.width / 2, y: vp.height / 2 };

  check(await page.getByRole('button', { name: 'PLAY' }).isVisible(), 'title screen shows PLAY');
  let s = await state(page);
  check(!s.overflowX, 'no horizontal overflow on title');

  const tap = async (loc) => (prof.touch ? loc.tap() : loc.click());
  await tap(page.getByRole('button', { name: 'PLAY' }));
  await tap(page.getByRole('button', { name: /Challenge 1: Rocket Pass/ }));
  await sleep(300);
  // Tap skips the intro flyover.
  if (prof.touch) await page.touchscreen.tap(mid.x, mid.y);
  else await page.mouse.click(mid.x, mid.y);
  await sleep(300);
  s = await state(page);
  check(s.phase === 'setup', `intro skipped by tap → setup (got ${s.phase})`);

  // Slingshot throw: pull back and down-left.
  const start = { x: vp.width * 0.6, y: vp.height * 0.45 };
  const pull = [];
  for (let i = 0; i <= 10; i++) pull.push({ x: start.x - i * 9, y: start.y + i * 9 });
  await drag(page, cdp, prof.touch, pull);
  await sleep(250);
  s = await state(page);
  check(s.phase === 'flight', `pull-and-release launches the pass (phase ${s.phase})`);

  // Hold to boost and drag up to steer.
  const fuelBefore = s.fuel;
  await drag(page, cdp, prof.touch, [{ x: mid.x, y: mid.y + 60 }, { x: mid.x, y: mid.y + 40 }, { x: mid.x, y: mid.y + 20 }], 450);
  s = await state(page);
  check(s.ignited && s.fuel < fuelBefore, `holding ignites the rocket and burns fuel (${fuelBefore} → ${s.fuel?.toFixed(2)})`);
  const fuelAfterRelease = s.fuel;
  await sleep(300);
  s = await state(page);
  check(s.phase !== 'flight' || s.fuel === fuelAfterRelease, 'releasing stops fuel use');
  check(s.scrollY === 0 && !s.overflowX, 'page did not scroll or overflow during play');

  // Pause on tab hide; resume only via button.
  await page.evaluate(() => {
    const g = window.__rocketball.game;
    g.startChallenge(g.challenge, { skipIntro: true });
  });
  await sleep(200);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(100);
  s = await state(page);
  check(s.paused, 'hiding the tab pauses the game');
  check(await page.getByRole('dialog', { name: 'Paused' }).isVisible(), 'pause dialog is shown');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(200);
  check((await state(page)).paused, 'returning to the tab stays paused until the player resumes');
  await tap(page.getByRole('button', { name: 'RESUME' }));
  await sleep(150);
  s = await state(page);
  check(!s.paused && s.phase === 'setup', 'RESUME continues without launching');

  // Mute toggle persists.
  await tap(page.getByRole('button', { name: 'Toggle sound' }));
  await sleep(100);
  check((await state(page)).muted, 'mute button mutes');

  // Play an attempt to the result screen, then retry.
  await page.evaluate(() => {
    const g = window.__rocketball.game;
    g.startChallenge(g.challenge, { skipIntro: true });
  });
  await drag(page, cdp, prof.touch, pull);
  await page.waitForFunction(() => window.__rocketball.game.phase === 'result', null, { timeout: 15000 });
  await page.waitForSelector('.result.visible', { timeout: 5000 });
  check(true, 'attempt reaches the result screen');
  await tap(page.getByRole('button', { name: /RETRY/ }));
  await sleep(150);
  check((await state(page)).phase === 'setup', 'RETRY restarts instantly');

  // Reload: progress and settings persist.
  await page.reload();
  await page.waitForFunction(() => !!window.__rocketball);
  s = await state(page);
  check(s.muted, 'mute setting persists across reload');
  const attempts = await page.evaluate(() => window.__rocketball.game.save.attempts);
  check(attempts >= 1, `attempts persisted across reload (${attempts})`);

  // Every challenge can be opened from the hub once unlocked.
  if (prof.name.startsWith('iPhone 13 portrait')) {
    await page.evaluate(() => {
      const g = window.__rocketball.game;
      for (const id of window.__rocketball.challenges) if (!id.startsWith('tt')) g.save.best[id] = { score: 1, stars: 1 };
      g.persist();
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__rocketball);
    await tap(page.getByRole('button', { name: 'PLAY' }));
    let opened = 0;
    for (const [tab, prefix] of [['TOUCHDOWN', 'fb'], ['GOAL', 'sc'], ['HOME RUN', 'bb']]) {
      for (let i = 1; i <= 5; i++) {
        await tap(page.getByRole('tab', { name: new RegExp(tab) }));
        await tap(page.getByRole('button', { name: new RegExp(`Challenge ${i}:`) }));
        await sleep(120);
        s = await state(page);
        if (s.challenge === `${prefix}${i}` && (s.phase === 'intro' || s.phase === 'setup')) opened++;
        await tap(page.getByRole('button', { name: 'Pause' }));
        await tap(page.getByRole('button', { name: 'CHALLENGES' }));
      }
    }
    check(opened === 15, `all 15 challenges open from the hub (${opened}/15)`);
    const triple = page.getByRole('button', { name: 'Play Triple Threat final' });
    check(await triple.isEnabled(), 'Triple Threat unlocks after clearing all 15');
    await tap(triple);
    await sleep(150);
    check((await state(page)).challenge === 'tt1', 'Triple Threat starts at round 1');

    // Rough performance sample during an active flight.
    await page.evaluate(() => {
      const g = window.__rocketball.game;
      g.startChallenge(g.challenge, { skipIntro: true });
    });
    await drag(page, cdp, true, pull);
    const fps = await page.evaluate(
      () =>
        new Promise((res) => {
          let n = 0;
          const t0 = performance.now();
          const f = () => (performance.now() - t0 < 2000 ? (n++, requestAnimationFrame(f)) : res(n / 2));
          requestAnimationFrame(f);
        }),
    );
    console.log(`  · ~${Math.round(fps)} fps during flight (headless, software rendering)`);
  }

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

await browser.close();
stopServer();
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll browser checks passed');
process.exit(failures.length ? 1 : 0);
