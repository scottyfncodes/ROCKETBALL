import { CHALLENGES, TRIPLE_ID, type Challenge } from '../config/challenges';
import { COSMETICS, type Cosmetic } from '../config/cosmetics';
import type { Sport } from '../sim/types';
import type { SaveData } from './storage';

export const starsOf = (save: SaveData, id: string): number => save.best[id]?.stars ?? 0;

export function totalStars(save: SaveData): number {
  return [...CHALLENGES.map((c) => c.id), TRIPLE_ID].reduce((s, id) => s + starsOf(save, id), 0);
}

export const MAX_STARS = (CHALLENGES.length + 1) * 3;

/** Challenge 1 of each sport is always open; each later one opens when the previous is cleared. */
export function isUnlocked(save: SaveData, c: Challenge): boolean {
  if (c.index <= 1) return true;
  const prev = CHALLENGES.find((p) => p.sport === c.sport && p.index === c.index - 1);
  return !prev || starsOf(save, prev.id) > 0;
}

/** The Triple Threat final opens once every challenge has been cleared. */
export const tripleUnlocked = (save: SaveData): boolean => CHALLENGES.every((c) => starsOf(save, c.id) > 0);

export function sportStars(save: SaveData, sport: Sport): number {
  return CHALLENGES.filter((c) => c.sport === sport).reduce((s, c) => s + starsOf(save, c.id), 0);
}

export function isCosmeticUnlocked(save: SaveData, c: Cosmetic): boolean {
  return c.triple ? save.tripleWon : totalStars(save) >= c.stars;
}

export interface RecordOutcome {
  newBest: boolean;
  previousBest: number;
  /** Cosmetics unlocked by this result. */
  unlocked: Cosmetic[];
  /** Challenge newly opened by this result, if any. */
  opened: Challenge | null;
  tripleOpened: boolean;
}

/** Record a finished attempt. Mutates `save` and reports anything newly earned. */
export function recordResult(save: SaveData, id: string, score: number, stars: number, success: boolean): RecordOutcome {
  const before = COSMETICS.filter((c) => isCosmeticUnlocked(save, c)).map((c) => c.id);
  const wasTriple = tripleUnlocked(save);
  const prev = save.best[id];
  const previousBest = prev?.score ?? 0;
  const newBest = success && score > previousBest;
  const opened = CHALLENGES.find((c) => {
    const me = CHALLENGES.find((x) => x.id === id);
    return me && c.sport === me.sport && c.index === me.index + 1 && !isUnlocked(save, c);
  });
  save.attempts++;
  if (success) {
    save.best[id] = { score: Math.max(previousBest, score), stars: Math.max(prev?.stars ?? 0, stars) };
    if (id === TRIPLE_ID) save.tripleWon = true;
  }
  const unlocked = COSMETICS.filter((c) => !before.includes(c.id) && isCosmeticUnlocked(save, c));
  return {
    newBest,
    previousBest,
    unlocked,
    opened: success && opened ? opened : null,
    tripleOpened: !wasTriple && tripleUnlocked(save),
  };
}

export function nextChallenge(c: Challenge): Challenge | undefined {
  return CHALLENGES.find((x) => x.sport === c.sport && x.index === c.index + 1);
}
