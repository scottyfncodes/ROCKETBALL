# ROCKETBALL

**Throw a touchdown. Kick a goal. Hit a home run. Then light the rocket.**

ROCKETBALL is an original solo arcade sports game built for phones (iPhone Safari first) and playable on desktop. Every attempt follows one loop: **set up → launch → ignite → steer → score.** Make a real athletic move, then hold to fire a rocket strapped to the ball and drag to steer it while the fuel lasts.

## Play locally

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
npm run build      # static production build in dist/
npm run preview    # serve dist/
```

`dist/` is a fully static site with relative paths, so it can be hosted anywhere (Vercel, GitHub Pages, any static host). There is no backend, no accounts, no analytics and no runtime dependencies.

## How to play

| Sport | Athletic action | Then |
| --- | --- | --- |
| **TOUCHDOWN** (football) | Pull back anywhere like a slingshot, aim with the arc preview, let go to throw. | Hold anywhere to ignite. Drag up/down to steer. Release to save fuel. |
| **GOAL** (soccer) | Swipe toward the goal. Longer swipe = harder. Curve the swipe: a rainbow adds topspin (ball dips), a smile adds backspin (ball floats). | Same rocket controls. |
| **HOME RUN** (baseball) | Watch the pitch and tap as it reaches you. Tap the top half to lift it, the bottom half to drive it. Early = more loft, late = flatter. Three strikes and you're out. | Same rocket controls. |

Desktop: arrows aim/adjust power (Q/E curl a kick), Space launches and boosts, ↑/↓ steer, P/Esc pause, R retry.

Each sport has 5 handcrafted challenges (learn the move → combine aiming and fuel with obstacles → a signature challenge). Clearing all 15 unlocks the **Triple Threat** championship: one throw, one kick and one swing scored as a single run. Stars unlock rocket trails, ball skins and celebrations in the **Collection**. Progress is saved in `localStorage`; if storage is blocked (private mode) the game still plays and says progress won't be saved.

## Project layout

```
src/
  config/      physics.ts (all tunables), challenges.ts (15 + Triple Threat), cosmetics.ts
  sim/         pure deterministic simulation: vectors, world geometry, FlightSim, FixedStepper
  sports/      per-sport launch math + scoring (football, soccer, baseball)
  game/        Game controller, sport setup controllers (input → launch), progression, storage
  render/      Canvas 2D renderer: camera, stadium backgrounds, athletes, ball/rocket, effects
  ui/          DOM screens (title, hub, HUD, pause, results, collection) and inline SVG art
  audio/       procedural Web Audio sound effects (no audio files)
  input/       pointer/touch/keyboard input with "consume" so launch touches never boost
tests/         Vitest unit tests + a brute-force "bot player" solver
scripts/       e2e-smoke.mjs (Playwright), tune.ts (difficulty/star tuning)
```

Simulation is separated from presentation: `FlightSim` knows nothing about the DOM or canvas and steps at a fixed 120 Hz, so physics is identical at any frame rate. All art is procedural (Canvas 2D + inline SVG); there are no external assets or fonts.

## Tests and checks

```bash
npm run typecheck
npm run lint
npm test           # 80 unit tests, ~30 s (includes solving every challenge)
npm run build && npm run e2e   # browser smoke test (needs Chromium; set CHROMIUM_PATH if needed)
npm run check      # typecheck + lint + test + build
npx vite-node scripts/tune.ts  # full solver sweep: best bot score per challenge vs star thresholds
```

Unit tests cover gravity/drag/spin, fixed-step determinism across 30/60/120 fps, fuel use and arming delay, steering, collisions, rings, every objective type, medals, unlock progression, cosmetics, and save recovery (corrupt JSON, invalid fields, throwing/quota-limited/missing storage). A bot player brute-forces launches and rocket strategies to prove **all 15 challenges and all 3 Triple Threat rounds are completable**, and that every challenge marked "ROCKET" **cannot** be completed without boosting. Star thresholds were set from the bot's best scores, so 3 stars is reachable.

The e2e smoke test runs in Chromium with iPhone 13, iPhone SE, iPhone 13 landscape and desktop emulation: touch slingshot throw, hold-to-boost fuel burn, release stops fuel, no page scroll/overflow, pause on tab hide and explicit resume without accidental launch, mute + persistence across reload, result screen + instant retry, all 15 challenges opening from the hub, Triple Threat unlock, and zero console errors.

## Known limitations

- **Not tested on a physical iPhone.** Testing used Chromium device emulation (touch events, viewport, DPR), not WebKit/Safari. See the checklist below.
- Audio unlocks on the first tap (an iOS requirement); the hardware mute switch silences Web Audio on iPhone.
- Portrait is the primary layout; side-on play in portrait shows ~19 m of field, with the course minimap and edge arrows showing what is off screen.

### iPhone verification checklist

1. Open the URL in Safari; add to Home Screen once and open from there too.
2. Title → PLAY → Rocket Pass: pull back/release throws; no page scroll, zoom or text selection while dragging.
3. Mid-flight: hold to boost (sound + flame), drag up/down steers, release stops fuel.
4. Soccer: rainbow swipe dips, smile swipe floats. Baseball: taps in the top/bottom half lift/drive.
5. HUD buttons clear the notch / Dynamic Island and home indicator in portrait and landscape.
6. Rotate the phone mid-attempt: layout reflows, attempt continues.
7. Switch apps mid-flight → come back: game is paused; RESUME continues without a boost.
8. Mute toggle works; close and reopen Safari: stars, bests, mute and equipped cosmetics persist.
9. Turn on Settings → Accessibility → Reduce Motion: no screen shake/flash, intro flyover skipped.
