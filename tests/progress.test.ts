import { describe, expect, it } from 'vitest';
import { CHALLENGES, TRIPLE_ID } from '../src/config/challenges';
import { COSMETICS } from '../src/config/cosmetics';
import { isCosmeticUnlocked, isUnlocked, recordResult, totalStars, tripleUnlocked } from '../src/game/progress';
import { SAVE_KEY, createStore, defaultSave, sanitize, type StorageLike } from '../src/game/storage';

const fakeStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe('challenge progression', () => {
  it('opens challenge 1 of every sport, then each after the previous is cleared', () => {
    const s = defaultSave();
    for (const c of CHALLENGES) expect(isUnlocked(s, c)).toBe(c.index === 1);
    const out = recordResult(s, 'fb1', 2000, 1, true);
    expect(out.opened?.id).toBe('fb2');
    expect(isUnlocked(s, CHALLENGES.find((c) => c.id === 'fb2')!)).toBe(true);
    expect(isUnlocked(s, CHALLENGES.find((c) => c.id === 'fb3')!)).toBe(false);
  });

  it('a failed attempt does not unlock anything or record a best', () => {
    const s = defaultSave();
    const out = recordResult(s, 'fb1', 0, 0, false);
    expect(out.opened).toBeNull();
    expect(s.best.fb1).toBeUndefined();
    expect(s.attempts).toBe(1);
  });

  it('keeps the best score and best stars', () => {
    const s = defaultSave();
    recordResult(s, 'sc1', 2500, 3, true);
    const out = recordResult(s, 'sc1', 1800, 1, true);
    expect(out.newBest).toBe(false);
    expect(s.best.sc1).toEqual({ score: 2500, stars: 3 });
  });

  it('every challenge is reachable by clearing the ones before it, then the Triple Threat opens', () => {
    const s = defaultSave();
    for (const c of CHALLENGES) {
      expect(isUnlocked(s, c)).toBe(true);
      recordResult(s, c.id, 2000, 1, true);
    }
    expect(tripleUnlocked(s)).toBe(true);
    expect(totalStars(s)).toBe(15);
  });

  it('unlocks cosmetics by total stars, and the gold trail by winning the Triple Threat', () => {
    const s = defaultSave();
    const plasma = COSMETICS.find((c) => c.id === 'trail-plasma')!;
    const gold = COSMETICS.find((c) => c.id === 'trail-gold')!;
    expect(isCosmeticUnlocked(s, plasma)).toBe(false);
    expect(recordResult(s, 'fb1', 3000, 3, true).unlocked).toEqual([]);
    const out = recordResult(s, 'sc1', 3000, 3, true);
    expect(out.unlocked.map((c) => c.id)).toEqual(expect.arrayContaining(['skin-neon', 'trail-plasma']));
    expect(isCosmeticUnlocked(s, plasma)).toBe(true);
    expect(isCosmeticUnlocked(s, gold)).toBe(false);
    const t = recordResult(s, TRIPLE_ID, 8000, 3, true);
    expect(t.unlocked.map((c) => c.id)).toContain('trail-gold');
  });
});

describe('local save', () => {
  it('round-trips through storage', () => {
    const st = fakeStorage();
    const store = createStore(st);
    const s = store.load();
    recordResult(s, 'bb1', 2222, 2, true);
    s.settings.muted = true;
    s.equipped.trail = 'trail-plasma';
    expect(store.save(s)).toBe(true);
    const again = createStore(st).load();
    expect(again.best.bb1).toEqual({ score: 2222, stars: 2 });
    expect(again.settings.muted).toBe(true);
    expect(again.equipped.trail).toBe('trail-plasma');
  });

  it('recovers from corrupt JSON', () => {
    const st = fakeStorage();
    st.data.set(SAVE_KEY, '{not json');
    const s = createStore(st).load();
    expect(s).toEqual(defaultSave());
  });

  it('repairs invalid fields but keeps valid ones', () => {
    const s = sanitize({
      best: { fb1: { score: 1500, stars: 2 }, bad: { score: 'x', stars: 2 }, fb2: { score: 1e12, stars: 9 } },
      settings: { muted: 'yes' },
      equipped: { trail: 'skin-neon', skin: 'skin-lava' },
      tutorial: { rocket: true, steer: 'no' },
      attempts: -5,
    });
    expect(s.best.fb1).toEqual({ score: 1500, stars: 2 });
    expect(s.best.bad).toBeUndefined();
    expect(s.best.fb2.stars).toBe(3);
    expect(s.settings.muted).toBe(false);
    expect(s.equipped.trail).toBe('trail-flame'); // wrong kind rejected
    expect(s.equipped.skin).toBe('skin-lava');
    expect(s.tutorial).toEqual({ rocket: true });
    expect(s.attempts).toBe(0);
  });

  it('falls back to memory when storage throws (private mode)', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {},
    };
    const store = createStore(throwing);
    expect(store.persistent).toBe(false);
    const s = store.load();
    recordResult(s, 'fb1', 2000, 1, true);
    expect(store.save(s)).toBe(false);
    expect(store.load().best.fb1).toBeDefined();
  });

  it('marks storage non-persistent if a later write fails (quota)', () => {
    const st = fakeStorage();
    const store = createStore(st);
    st.setItem = () => {
      throw new Error('quota');
    };
    expect(store.save(defaultSave())).toBe(false);
    expect(store.persistent).toBe(false);
  });

  it('works with no storage at all', () => {
    const store = createStore(null);
    expect(store.persistent).toBe(false);
    expect(store.load()).toEqual(defaultSave());
  });
});
