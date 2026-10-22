/** Inline SVG artwork for the DOM UI (wordmark, sport icons, stars, trophy, lock). */
export const WORDMARK = `
<svg class="wordmark" viewBox="0 0 640 250" role="img" aria-label="ROCKETBALL">
  <defs>
    <linearGradient id="wm-fire" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6c2"/>
      <stop offset="0.45" stop-color="#ffb22e"/>
      <stop offset="1" stop-color="#ff3d1f"/>
    </linearGradient>
    <linearGradient id="wm-chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#cfd9ee"/>
      <stop offset="0.56" stop-color="#8fa0c4"/>
      <stop offset="1" stop-color="#e8eeff"/>
    </linearGradient>
    <linearGradient id="wm-streak" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff3d1f" stop-opacity="0"/>
      <stop offset="0.7" stop-color="#ff7a1f"/>
      <stop offset="1" stop-color="#fff2a8"/>
    </linearGradient>
  </defs>
  <g transform="skewX(-11) translate(36 0)">
    <text x="300" y="118" text-anchor="middle" class="wm-text" font-size="124" fill="url(#wm-fire)" stroke="#170a33" stroke-width="12" paint-order="stroke" letter-spacing="-3">ROCKET</text>
    <path d="M40 176 L330 160 L330 196 Z" fill="url(#wm-streak)"/>
    <path d="M90 186 L320 172 L320 184 Z" fill="#fff2a8" opacity="0.8"/>
    <text x="440" y="222" text-anchor="middle" class="wm-text" font-size="104" fill="url(#wm-chrome)" stroke="#170a33" stroke-width="11" paint-order="stroke" letter-spacing="-2">BALL</text>
  </g>
  <g transform="translate(588 70)">
    <circle r="30" fill="#fff" stroke="#170a33" stroke-width="7"/>
    <path d="M-30 0 A30 30 0 0 0 30 0" fill="none" stroke="#170a33" stroke-width="4"/>
    <path d="M-12 -27 Q0 -6 -12 27 M12 -27 Q0 -6 12 27" fill="none" stroke="#ff3d1f" stroke-width="4"/>
  </g>
</svg>`;

export const ICONS = {
  football: `<svg viewBox="0 0 48 48" aria-hidden="true"><g transform="rotate(-35 24 24)"><ellipse cx="24" cy="24" rx="20" ry="12" fill="#8a4a22" stroke="#1a0d05" stroke-width="2.5"/><path d="M15 24h18" stroke="#fff" stroke-width="2.5"/><path d="M18 21v6M22 21v6M26 21v6M30 21v6" stroke="#fff" stroke-width="2"/><path d="M9 17v14M39 17v14" stroke="#fff" stroke-width="2" opacity=".8"/></g></svg>`,
  soccer: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#fff" stroke="#111" stroke-width="2.5"/><path d="M24 15l8 6-3 9h-10l-3-9z" fill="#111"/><path d="M24 15V6M32 21l8-3M29 30l5 8M19 30l-5 8M16 21l-8-3" stroke="#111" stroke-width="2"/></svg>`,
  baseball: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#fbfaf5" stroke="#111" stroke-width="2.5"/><path d="M13 9q8 15 0 30M35 9q-8 15 0 30" fill="none" stroke="#d7263d" stroke-width="2.5" stroke-dasharray="3 2.5"/></svg>`,
  triple: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8h24v6a12 12 0 0 1-24 0z" fill="#ffd23f" stroke="#3a2500" stroke-width="2.5"/><path d="M12 11H6a6 6 0 0 0 7 8M36 11h6a6 6 0 0 1-7 8" fill="none" stroke="#ffd23f" stroke-width="3"/><path d="M20 26h8v8h-8z" fill="#ffb800"/><path d="M14 40h20v-6H14z" fill="#ffd23f" stroke="#3a2500" stroke-width="2.5"/></svg>`,
};

export const STAR = (on: boolean, cls = ''): string =>
  `<svg class="star ${on ? 'on' : 'off'} ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>`;

export const LOCK = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="5" y="10" width="14" height="11" rx="2.5" fill="currentColor"/></svg>`;

export const TROPHY = `<svg class="trophy" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset="1" stop-color="#ff9b1f"/></linearGradient></defs><path d="M30 14h60v20a30 30 0 0 1-60 0z" fill="url(#tg)" stroke="#3a2500" stroke-width="4"/><path d="M30 20H14a14 14 0 0 0 18 20M90 20h16a14 14 0 0 1-18 20" fill="none" stroke="#ffd23f" stroke-width="6"/><rect x="52" y="62" width="16" height="20" fill="#ffb800" stroke="#3a2500" stroke-width="4"/><rect x="34" y="82" width="52" height="16" rx="3" fill="url(#tg)" stroke="#3a2500" stroke-width="4"/><text x="60" y="44" text-anchor="middle" font-size="22" font-weight="900" fill="#3a2500">3x</text></svg>`;

export const SOUND_ON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
export const SOUND_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
export const PAUSE = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>`;
export const RETRY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M19 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const BACK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
