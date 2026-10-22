import './styles.css';
import { Game } from './game/game';
import { createStore } from './game/storage';
import { UI } from './ui/ui';
import { CHALLENGES, TRIPLE_THREAT } from './config/challenges';

// Older iOS Safari lacks CanvasRenderingContext2D.roundRect: provide a plain fallback.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h);
  } as CanvasRenderingContext2D['roundRect'];
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const probe = document.getElementById('safe-probe') as HTMLElement;

const store = createStore();
const save = store.load();
const ui = new UI(uiRoot, store);
const game = new Game(canvas, store, save, ui);
ui.bind(game);

// ---- Reduced motion: follow the OS unless the player chose otherwise.
const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const applyMotion = () => {
  game.reducedMotion = save.settings.reducedMotion ?? !!motionQuery?.matches;
  game.fx.density = game.reducedMotion ? 0.4 : 1;
  document.documentElement.classList.toggle('reduced-motion', game.reducedMotion);
};
applyMotion();
motionQuery?.addEventListener?.('change', applyMotion);

// ---- Layout: canvas fills the visual viewport; safe areas come from CSS env().
function layout(): void {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  const cs = getComputedStyle(probe);
  const px = (v: string) => parseFloat(v) || 0;
  const safe = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  document.documentElement.style.setProperty('--app-h', `${h}px`);
  game.resize(w, h, dpr, safe);
}
layout();
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 250));

// ---- Pause when hidden. Resuming always requires an explicit tap on RESUME.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.pause();
    game.sfx.suspend();
  }
});
window.addEventListener('pagehide', () => game.pause());

// ---- Block page gestures that fight the game (pinch zoom, double-tap zoom, rubber-banding).
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener(
  'touchmove',
  (e) => {
    if (!(e.target as HTMLElement).closest('.scrollable')) e.preventDefault();
  },
  { passive: false },
);
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = performance.now();
    if (now - lastTouchEnd < 300 && (e.target as HTMLElement).tagName === 'CANVAS') e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

// ---- Main loop.
let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  try {
    game.frame(dt);
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Small, read-only hook used by the automated browser smoke test.
(window as unknown as { __rocketball: unknown }).__rocketball = {
  game,
  ui,
  challenges: [...CHALLENGES, ...TRIPLE_THREAT].map((c) => c.id),
};
