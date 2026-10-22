import { DEFAULT_EQUIPPED, cosmeticById, type CosmeticKind } from '../config/cosmetics';

export const SAVE_KEY = 'rocketball.save.v1';

export interface BestResult {
  score: number;
  stars: number;
}

export interface SaveData {
  v: 1;
  best: Record<string, BestResult>;
  /** Tutorial prompts the player has already completed. */
  tutorial: Record<string, boolean>;
  settings: { muted: boolean; reducedMotion: boolean | null };
  equipped: Record<CosmeticKind, string>;
  tripleWon: boolean;
  attempts: number;
}

export const defaultSave = (): SaveData => ({
  v: 1,
  best: {},
  tutorial: {},
  settings: { muted: false, reducedMotion: null },
  equipped: { ...DEFAULT_EQUIPPED },
  tripleWon: false,
  attempts: 0,
});

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const finite = (x: unknown, lo: number, hi: number): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null;

/** Repair anything loaded from storage. Unknown or broken fields fall back to defaults. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  if (isObj(raw.best)) {
    for (const [id, b] of Object.entries(raw.best)) {
      if (!isObj(b)) continue;
      const score = finite(b.score, 0, 1e7);
      const stars = finite(b.stars, 0, 3);
      if (score !== null && stars !== null) d.best[id] = { score: Math.round(score), stars: Math.round(stars) };
    }
  }
  if (isObj(raw.tutorial)) for (const [k, val] of Object.entries(raw.tutorial)) if (val === true) d.tutorial[k] = true;
  if (isObj(raw.settings)) {
    if (typeof raw.settings.muted === 'boolean') d.settings.muted = raw.settings.muted;
    if (typeof raw.settings.reducedMotion === 'boolean') d.settings.reducedMotion = raw.settings.reducedMotion;
  }
  if (isObj(raw.equipped)) {
    for (const kind of ['trail', 'skin', 'celebration'] as const) {
      const id = raw.equipped[kind];
      if (typeof id === 'string' && cosmeticById(id)?.kind === kind) d.equipped[kind] = id;
    }
  }
  d.tripleWon = raw.tripleWon === true;
  d.attempts = Math.round(finite(raw.attempts, 0, 1e9) ?? 0);
  return d;
}

/** Minimal Storage shape so tests can inject a fake or a throwing backend. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface Store {
  /** False when the browser refuses storage (private mode, blocked cookies, quota). */
  readonly persistent: boolean;
  load(): SaveData;
  save(data: SaveData): boolean;
  reset(): SaveData;
}

function probe(s: StorageLike | null | undefined): StorageLike | null {
  if (!s) return null;
  try {
    const k = '__rb_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function createStore(backend: StorageLike | null | undefined = browserStorage()): Store {
  const s = probe(backend);
  let memory: SaveData = defaultSave();
  let persistent = s !== null;
  return {
    get persistent() {
      return persistent;
    },
    load() {
      if (!s) return (memory = sanitize(memory));
      try {
        const txt = s.getItem(SAVE_KEY);
        memory = txt ? sanitize(JSON.parse(txt)) : defaultSave();
      } catch {
        // Corrupt JSON or a storage error: start fresh rather than crash.
        memory = defaultSave();
      }
      return memory;
    },
    save(data) {
      memory = data;
      if (!s) return false;
      try {
        s.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
      } catch {
        persistent = false;
        return false;
      }
    },
    reset() {
      memory = defaultSave();
      try {
        s?.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
      return memory;
    },
  };
}
