import { CHALLENGES, TRIPLE_ID, TRIPLE_STARS, TRIPLE_THREAT, challengesFor, type Challenge } from '../config/challenges';
import { COSMETICS, type CosmeticKind } from '../config/cosmetics';
import type { AttemptSummary, Game, GameUI, Phase } from '../game/game';
import { MAX_STARS, isCosmeticUnlocked, isUnlocked, sportStars, starsOf, totalStars, tripleUnlocked } from '../game/progress';
import type { Store } from '../game/storage';
import { SPORTS, type Sport } from '../sim/types';
import { THEMES } from '../render/theme';
import { BACK, ICONS, LOCK, PAUSE, RETRY, SOUND_OFF, SOUND_ON, STAR, TROPHY, WORDMARK } from './art';

const SPORT_LABEL: Record<Sport, { title: string; verb: string }> = {
  football: { title: 'TOUCHDOWN', verb: 'Throw' },
  soccer: { title: 'GOAL', verb: 'Kick' },
  baseball: { title: 'HOME RUN', verb: 'Swing' },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const stars = (n: number, cls = '') => [0, 1, 2].map((i) => STAR(i < n, cls)).join('');
const fmt = (n: number) => n.toLocaleString('en-US');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** All DOM screens. The canvas only draws the game world; menus and HUD live here. */
export class UI implements GameUI {
  private root: HTMLElement;
  private game!: Game;
  private screens: Record<string, HTMLElement> = {};
  private sport: Sport = 'football';
  private hud!: { el: HTMLElement; name: HTMLElement; prompt: HTMLElement; fuel: HTMLElement; fuelFill: HTMLElement; mute: HTMLButtonElement; retry: HTMLButtonElement };
  private bannerEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private bannerTimer = 0;
  private toastTimer = 0;
  private resultTimers: number[] = [];
  /** Only move focus automatically for keyboard users (avoids focus rings on touch). */
  private keyboardUser = false;
  private collectionFrom: 'title' | 'hub' = 'title';

  constructor(root: HTMLElement, private store: Store) {
    this.root = root;
  }

  bind(game: Game): void {
    this.game = game;
    window.addEventListener('keydown', () => (this.keyboardUser = true), true);
    window.addEventListener('pointerdown', () => (this.keyboardUser = false), true);
    this.build();
    this.showTitle();
    if (!this.store.persistent) this.toast("Progress can't be saved in this browser mode. You can still play!");
  }

  // ------------------------------------------------------------------ build

  private build(): void {
    this.root.innerHTML = '';
    this.screens.title = this.buildTitle();
    this.screens.hub = el('section', 'screen hub scrollable');
    this.screens.collection = el('section', 'screen collection scrollable');
    this.screens.pause = this.buildPause();
    this.screens.result = el('section', 'screen result scrollable');
    this.hud = this.buildHud();
    this.bannerEl = el('div', 'banner');
    this.bannerEl.setAttribute('aria-live', 'polite');
    this.toastEl = el('div', 'toast');
    this.toastEl.setAttribute('role', 'status');
    for (const s of Object.values(this.screens)) this.root.append(s);
    this.root.append(this.hud.el, this.bannerEl, this.toastEl);
  }

  private button(label: string, cls: string, onClick: () => void, aria?: string): HTMLButtonElement {
    const b = el('button', `btn ${cls}`, label);
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.sfx.unlock();
      this.game.sfx.click();
      onClick();
    });
    return b;
  }

  private show(name: string | null): void {
    for (const [k, s] of Object.entries(this.screens)) s.classList.toggle('visible', k === name);
    const scr = name ? this.screens[name] : null;
    // Move focus into the new screen for keyboard / screen-reader users.
    if (scr && this.keyboardUser) requestAnimationFrame(() => (scr.querySelector<HTMLElement>('[data-autofocus]') ?? scr.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true }));
  }

  private buildTitle(): HTMLElement {
    const s = el('section', 'screen title');
    s.innerHTML = `
      <div class="title-inner">
        ${WORDMARK}
        <p class="tagline">Throw a touchdown. Kick a goal. Hit a home run.<br><strong>Then light the rocket.</strong></p>
        <div class="title-actions"></div>
      </div>`;
    const actions = s.querySelector('.title-actions')!;
    const play = this.button('PLAY', 'primary big', () => this.showHub());
    play.dataset.autofocus = '';
    const row = el('div', 'row');
    row.append(
      this.button('COLLECTION', 'ghost', () => this.showCollection('title')),
      this.button(this.game.sfx.muted ? `${SOUND_OFF}<span>SOUND OFF</span>` : `${SOUND_ON}<span>SOUND ON</span>`, 'ghost sound-toggle', () => this.toggleMute()),
    );
    actions.append(play, row);
    return s;
  }

  private buildHud(): UI['hud'] {
    const h = el('div', 'hud');
    h.innerHTML = `
      <div class="hud-top">
        <div class="hud-left"></div>
        <div class="hud-name" aria-live="polite"></div>
        <div class="hud-right"></div>
      </div>
      <div class="hud-bottom">
        <div class="hud-prompt" aria-live="polite"></div>
        <div class="fuel" role="meter" aria-label="Rocket fuel" aria-valuemin="0" aria-valuemax="100"><span class="fuel-label">FUEL</span><div class="fuel-bar"><div class="fuel-fill"></div></div></div>
      </div>`;
    const pause = this.button(PAUSE, 'icon', () => this.game.pause(), 'Pause');
    const retry = this.button(RETRY, 'icon', () => this.game.retry(), 'Restart attempt');
    const mute = this.button(this.game.sfx.muted ? SOUND_OFF : SOUND_ON, 'icon', () => this.toggleMute(), 'Toggle sound');
    h.querySelector('.hud-left')!.append(pause);
    h.querySelector('.hud-right')!.append(retry, mute);
    return {
      el: h,
      name: h.querySelector('.hud-name')!,
      prompt: h.querySelector('.hud-prompt')!,
      fuel: h.querySelector('.fuel')!,
      fuelFill: h.querySelector('.fuel-fill')!,
      mute,
      retry,
    };
  }

  private buildPause(): HTMLElement {
    const s = el('section', 'screen pause');
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-label', 'Paused');
    const card = el('div', 'card');
    card.innerHTML = '<h2>PAUSED</h2>';
    const resume = this.button('RESUME', 'primary', () => this.game.resume());
    resume.dataset.autofocus = '';
    card.append(
      resume,
      this.button('RESTART', '', () => {
        this.game.resume();
        this.game.retry();
      }),
      this.button('CHALLENGES', '', () => {
        this.game.resume();
        this.game.toMenu();
        this.showHub();
      }),
      this.button('SOUND ON / OFF', 'ghost', () => this.toggleMute()),
    );
    s.append(card);
    return s;
  }

  // ------------------------------------------------------------------ screens

  showTitle(): void {
    this.hud.el.classList.remove('visible');
    this.show('title');
  }

  showHub(sport: Sport = this.sport): void {
    this.sport = sport;
    this.hud.el.classList.remove('visible');
    const save = this.game.save;
    const s = this.screens.hub;
    s.innerHTML = '';
    const head = el('header', 'hub-head');
    head.append(this.button(BACK, 'icon', () => this.showTitle(), 'Back to title'));
    head.append(el('div', 'hub-stars', `${STAR(true)}<span>${totalStars(save)} / ${MAX_STARS}</span>`));
    head.append(this.button('COLLECTION', 'ghost small', () => this.showCollection('hub')));
    s.append(head);

    const tabs = el('nav', 'tabs');
    tabs.setAttribute('role', 'tablist');
    for (const sp of SPORTS) {
      const b = this.button(`${ICONS[sp]}<span>${SPORT_LABEL[sp].title}</span><small>${sportStars(save, sp)}/15</small>`, `tab ${sp === sport ? 'active' : ''}`, () => this.showHub(sp));
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(sp === sport));
      b.style.setProperty('--accent', THEMES[sp].accent);
      tabs.append(b);
    }
    s.append(tabs);

    const list = el('div', 'cards');
    list.style.setProperty('--accent', THEMES[sport].accent);
    for (const c of challengesFor(sport)) list.append(this.card(c));
    s.append(list);

    const tripleOpen = tripleUnlocked(save);
    const t = el('button', `card triple ${tripleOpen ? '' : 'locked'}`);
    t.type = 'button';
    const best = save.best[TRIPLE_ID];
    t.innerHTML = `${ICONS.triple}<div class="card-body"><h3>TRIPLE THREAT</h3><p>${tripleOpen ? 'One throw. One kick. One swing. Win the championship.' : 'Clear all 15 challenges to unlock the championship.'}</p></div><div class="card-meta">${tripleOpen ? `<div class="stars">${stars(starsOf(save, TRIPLE_ID))}</div>${best ? `<span class="best">${fmt(best.score)}</span>` : ''}` : LOCK}</div>`;
    t.disabled = !tripleOpen;
    t.setAttribute('aria-label', tripleOpen ? 'Play Triple Threat final' : 'Triple Threat, locked');
    t.addEventListener('click', () => {
      this.game.sfx.unlock();
      this.game.sfx.click();
      this.play(() => this.game.startTriple());
    });
    s.append(t);
    this.show('hub');
  }

  private card(c: Challenge): HTMLElement {
    const save = this.game.save;
    const open = isUnlocked(save, c);
    const b = el('button', `card ${open ? '' : 'locked'} ${c.index === 5 ? 'signature' : ''}`);
    b.type = 'button';
    b.disabled = !open;
    const st = starsOf(save, c.id);
    const best = save.best[c.id];
    b.innerHTML = `
      <div class="card-num">${c.index}</div>
      <div class="card-body"><h3>${esc(c.name)}${c.requiresRocket ? ' <em class="rocket-tag">ROCKET</em>' : ''}</h3><p>${esc(open ? c.goal : 'Clear the previous challenge to unlock.')}</p></div>
      <div class="card-meta">${open ? `<div class="stars">${stars(st)}</div>${best ? `<span class="best">${fmt(best.score)}</span>` : '<span class="best new">NEW</span>'}` : LOCK}</div>`;
    b.setAttribute('aria-label', open ? `Challenge ${c.index}: ${c.name}. ${st} stars.` : `Challenge ${c.index}, locked`);
    b.addEventListener('click', () => {
      this.game.sfx.unlock();
      this.game.sfx.click();
      this.play(() => this.game.startChallenge(c));
    });
    return b;
  }

  private play(start: () => void): void {
    this.show(null);
    this.hud.el.classList.add('visible');
    start();
  }

  showCollection(from: 'title' | 'hub' = this.collectionFrom): void {
    this.collectionFrom = from;
    this.hud.el.classList.remove('visible');
    const save = this.game.save;
    const s = this.screens.collection;
    s.innerHTML = '';
    const head = el('header', 'hub-head');
    head.append(this.button(BACK, 'icon', () => (from === 'hub' ? this.showHub() : this.showTitle()), 'Back'));
    head.append(el('div', 'hub-stars', `${STAR(true)}<span>${totalStars(save)} / ${MAX_STARS}</span>`));
    head.append(el('div', 'spacer'));
    s.append(head);
    s.append(el('h2', 'coll-title', 'COLLECTION'));
    const kinds: [CosmeticKind, string][] = [
      ['trail', 'Rocket trails'],
      ['skin', 'Ball skins'],
      ['celebration', 'Celebrations'],
    ];
    for (const [kind, label] of kinds) {
      s.append(el('h3', 'coll-kind', label));
      const grid = el('div', 'coll-grid');
      for (const c of COSMETICS.filter((x) => x.kind === kind)) {
        const open = isCosmeticUnlocked(save, c);
        const on = save.equipped[kind] === c.id;
        const b = el('button', `item ${open ? '' : 'locked'} ${on ? 'equipped' : ''}`);
        b.type = 'button';
        b.disabled = !open;
        b.style.setProperty('--c1', c.colors[0]);
        b.style.setProperty('--c2', c.colors[1]);
        b.innerHTML = `<span class="swatch ${kind}"></span><span class="item-name">${esc(c.name)}</span><span class="item-req">${open ? (on ? 'EQUIPPED' : 'TAP TO EQUIP') : c.triple ? 'WIN TRIPLE THREAT' : `${LOCK} ${c.stars} STARS`}</span>`;
        b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', () => {
          this.game.sfx.click();
          save.equipped[kind] = c.id;
          this.game.persist();
          this.showCollection();
        });
        grid.append(b);
      }
      s.append(grid);
    }
    this.show('collection');
  }

  private toggleMute(): void {
    const m = !this.game.sfx.muted;
    this.game.sfx.setMuted(m);
    this.game.save.settings.muted = m;
    this.game.persist();
    this.hud.mute.innerHTML = m ? SOUND_OFF : SOUND_ON;
    this.root.querySelectorAll('.sound-toggle').forEach((b) => (b.innerHTML = m ? `${SOUND_OFF}<span>SOUND OFF</span>` : `${SOUND_ON}<span>SOUND ON</span>`));
    this.toast(m ? 'Sound off' : 'Sound on');
  }

  toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), 2600);
  }

  // ------------------------------------------------------------------ GameUI

  onBanner(ch: Challenge, roundLabel?: string): void {
    this.hud.name.innerHTML = `<span class="hud-sport" style="color:${THEMES[ch.sport].accent2}">${SPORT_LABEL[ch.sport].title}${roundLabel ? '' : ` ${ch.index}`}</span><span>${esc(ch.name.replace('Triple Threat · ', ''))}</span>`;
    this.bannerEl.innerHTML = `${roundLabel ? `<small>${roundLabel}</small>` : `<small>${SPORT_LABEL[ch.sport].title} · ${ch.index}/5</small>`}<strong>${esc(ch.name.replace('Triple Threat · ', ''))}</strong><span>${esc(ch.goal)}</span>`;
    this.bannerEl.style.setProperty('--accent', THEMES[ch.sport].accent);
    this.bannerEl.classList.add('visible');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('visible'), 2600);
    this.resultTimers.forEach(clearTimeout);
    this.show(null);
    this.hud.el.classList.add('visible');
  }

  onBannerHide(): void {
    this.bannerEl.classList.remove('visible');
  }

  onPhase(phase: Phase): void {
    this.hud.el.dataset.phase = phase;
    if (phase === 'menu') this.hud.el.classList.remove('visible');
  }

  onPrompt(text: string, emphasis: boolean): void {
    this.hud.prompt.textContent = text;
    this.hud.prompt.classList.toggle('emph', emphasis);
    this.hud.prompt.classList.toggle('empty', !text);
  }

  onFuel(frac: number, visible: boolean, boosting: boolean): void {
    this.hud.fuel.classList.toggle('hidden', !visible);
    this.hud.fuel.classList.toggle('boosting', boosting);
    this.hud.fuel.classList.toggle('low', frac < 0.25);
    this.hud.fuelFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
    this.hud.fuel.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
  }

  onPauseChange(paused: boolean): void {
    this.show(paused ? 'pause' : null);
  }

  onResult(r: AttemptSummary): void {
    this.resultTimers.forEach(clearTimeout);
    // Let the celebration / failure moment play before the card slides in.
    const delay = r.result.success ? 900 : 500;
    this.resultTimers = [window.setTimeout(() => this.renderResult(r), delay)];
  }

  private renderResult(r: AttemptSummary): void {
    const s = this.screens.result;
    const { result, challenge: ch } = r;
    const th = THEMES[ch.sport];
    s.innerHTML = '';
    s.style.setProperty('--accent', th.accent);
    const card = el('div', `card result-card ${result.success ? 'win' : 'lose'}`);
    s.append(card);

    if (r.triple && r.triple.final) {
      this.renderTripleFinal(card, r);
      this.show('result');
      return;
    }
    const roundTag = r.triple ? `<small class="round-tag">ROUND ${r.triple.round + 1} OF 3</small>` : '';
    card.innerHTML = `
      ${roundTag}
      <h2 class="result-label">${esc(result.label)}</h2>
      ${r.triple ? '' : `<div class="result-stars">${[0, 1, 2].map((i) => STAR(i < r.stars, `pop d${i}`)).join('')}</div>`}
      <div class="result-score"><span class="count" data-to="${result.total}">0</span><small>POINTS</small></div>
      <ul class="breakdown">${result.items.map((i) => `<li><span>${esc(i.label)}</span><b>+${fmt(i.value)}</b></li>`).join('')}</ul>
      <div class="notes"></div>
      <div class="actions"></div>`;
    const notes = card.querySelector('.notes')!;
    const rec = r.record;
    if (rec?.newBest && rec.previousBest > 0) notes.append(el('p', 'note best', `NEW PERSONAL BEST! <small>(was ${fmt(rec.previousBest)})</small>`));
    else if (!r.triple && this.game.save.best[ch.id] && result.success) notes.append(el('p', 'note', `Best: ${fmt(this.game.save.best[ch.id].score)}`));
    if (r.detail) notes.append(el('p', 'note miss', esc(r.detail)));
    if (!result.success) notes.append(el('p', 'note tip', `<b>TIP</b> ${esc(ch.tip)}`));
    if (!r.triple && result.success && r.stars < 3) {
      const need = r.stars === 1 ? ch.stars[0] : ch.stars[1];
      notes.append(el('p', 'note', `${fmt(need)} points for the next star`));
    }
    if (rec?.opened) notes.append(el('p', 'note unlock', `UNLOCKED: ${esc(rec.opened.name)}`));
    if (rec?.tripleOpened) notes.append(el('p', 'note unlock', 'TRIPLE THREAT FINAL UNLOCKED!'));
    for (const u of rec?.unlocked ?? []) notes.append(el('p', 'note unlock', `NEW ${u.kind === 'skin' ? 'BALL SKIN' : u.kind === 'trail' ? 'ROCKET TRAIL' : 'CELEBRATION'}: ${esc(u.name)}`));
    if (rec?.unlocked.length || rec?.opened || rec?.tripleOpened) window.setTimeout(() => this.game.sfx.unlockFanfare(), 600);

    const actions = card.querySelector('.actions')!;
    if (r.triple) {
      const next = this.button('NEXT ROUND', 'primary', () => this.game.nextTripleRound());
      next.dataset.autofocus = '';
      actions.append(next, this.button('QUIT', 'ghost', () => this.leaveToHub()));
    } else {
      const nextCh = this.game.next();
      const retry = this.button(`${RETRY}<span>RETRY</span>`, result.success ? '' : 'primary', () => this.game.retry());
      const menu = this.button('CHALLENGES', 'ghost', () => this.leaveToHub(ch.sport));
      if (result.success && nextCh) {
        const next = this.button('NEXT', 'primary', () => this.game.startChallenge(nextCh));
        next.dataset.autofocus = '';
        actions.append(next, retry, menu);
      } else {
        retry.dataset.autofocus = '';
        actions.append(retry);
        if (result.success && ch.index === 5) actions.append(this.button(`TRY ${SPORT_LABEL[SPORTS[(SPORTS.indexOf(ch.sport) + 1) % 3]].title}`, '', () => this.leaveToHub(SPORTS[(SPORTS.indexOf(ch.sport) + 1) % 3])));
        actions.append(menu);
      }
    }
    this.show('result');
    this.animateResult(card, r.stars);
  }

  private renderTripleFinal(card: HTMLElement, r: AttemptSummary): void {
    const t = r.triple!;
    const won = t.rounds.length === 3 && t.rounds.every((x) => x.success);
    card.classList.add('triple-final', won ? 'win' : 'lose');
    card.innerHTML = `
      ${won ? TROPHY : ''}
      <h2 class="result-label">${won ? 'CHAMPION!' : 'SO CLOSE'}</h2>
      <div class="result-stars">${[0, 1, 2].map((i) => STAR(i < r.stars, `pop d${i}`)).join('')}</div>
      <div class="result-score"><span class="count" data-to="${t.total}">0</span><small>TRIPLE THREAT TOTAL</small></div>
      <ul class="breakdown">${t.rounds.map((x, i) => `<li><span>${SPORT_LABEL[TRIPLE_THREAT[i].sport].title} · ${esc(x.label)}</span><b>${x.success ? '+' + fmt(x.total) : '0'}</b></li>`).join('')}</ul>
      <div class="notes">${won ? '' : '<p class="note tip">Win all three rounds in one run to take the championship.</p>'}<p class="note">${fmt(TRIPLE_STARS[0])} / ${fmt(TRIPLE_STARS[1])} points for 2 / 3 stars</p></div>
      <div class="actions"></div>`;
    const notes = card.querySelector('.notes')!;
    for (const u of r.record?.unlocked ?? []) notes.append(el('p', 'note unlock', `NEW: ${esc(u.name)}`));
    const actions = card.querySelector('.actions')!;
    const again = this.button(`${RETRY}<span>RUN IT BACK</span>`, 'primary', () => this.game.startTriple());
    again.dataset.autofocus = '';
    actions.append(again, this.button('CHALLENGES', 'ghost', () => this.leaveToHub()));
    if (won) {
      this.game.celebrate({ x: this.game.cam.left + 10, y: 10 });
      this.game.sfx.unlockFanfare();
    }
    this.animateResult(card, r.stars);
  }

  private animateResult(card: HTMLElement, nStars: number): void {
    const count = card.querySelector<HTMLElement>('.count');
    if (count) {
      const to = Number(count.dataset.to);
      const start = performance.now();
      const dur = this.game.reducedMotion ? 1 : 900;
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / dur);
        count.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    for (let i = 0; i < nStars; i++) this.resultTimers.push(window.setTimeout(() => this.game.sfx.star(i), 350 + i * 260));
  }

  private leaveToHub(sport?: Sport): void {
    this.game.toMenu();
    this.showHub(sport ?? this.sport);
  }

  /** Used by the test hook to list challenge ids in play order. */
  static order(): string[] {
    return CHALLENGES.map((c) => c.id);
  }
}
