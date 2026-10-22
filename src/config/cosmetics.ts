export type CosmeticKind = 'trail' | 'skin' | 'celebration';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  /** Total stars required. */
  stars: number;
  /** Requires a Triple Threat win instead of stars. */
  triple?: boolean;
  /** Primary / secondary colours used by the renderer and the collection swatches. */
  colors: [string, string];
}

export const COSMETICS: Cosmetic[] = [
  { id: 'trail-flame', kind: 'trail', name: 'Classic Flame', stars: 0, colors: ['#ffb22e', '#ff4d1f'] },
  { id: 'trail-plasma', kind: 'trail', name: 'Plasma Blue', stars: 6, colors: ['#7ff3ff', '#2a7bff'] },
  { id: 'trail-toxic', kind: 'trail', name: 'Toxic Lime', stars: 14, colors: ['#e6ff5a', '#2bd96b'] },
  { id: 'trail-rainbow', kind: 'trail', name: 'Rainbow Rush', stars: 24, colors: ['#ff4fd8', '#4fd8ff'] },
  { id: 'trail-gold', kind: 'trail', name: 'Golden Jet', stars: 0, triple: true, colors: ['#fff2a8', '#ffb800'] },

  { id: 'skin-classic', kind: 'skin', name: 'Game Ball', stars: 0, colors: ['#ffffff', '#222222'] },
  { id: 'skin-neon', kind: 'skin', name: 'Neon Night', stars: 4, colors: ['#1b1440', '#ff3df2'] },
  { id: 'skin-lava', kind: 'skin', name: 'Lava Core', stars: 10, colors: ['#2a0d05', '#ff6a00'] },
  { id: 'skin-chrome', kind: 'skin', name: 'Chrome', stars: 18, colors: ['#f4f7fb', '#7c8a9e'] },
  { id: 'skin-galaxy', kind: 'skin', name: 'Galaxy', stars: 30, colors: ['#120a2e', '#8f6bff'] },

  { id: 'cele-fireworks', kind: 'celebration', name: 'Fireworks', stars: 0, colors: ['#ffd23f', '#ff3d7f'] },
  { id: 'cele-confetti', kind: 'celebration', name: 'Confetti Storm', stars: 8, colors: ['#3dd6ff', '#ffe14d'] },
  { id: 'cele-shockwave', kind: 'celebration', name: 'Shockwave', stars: 16, colors: ['#ffffff', '#5cf2ff'] },
  { id: 'cele-starburst', kind: 'celebration', name: 'Starburst', stars: 36, colors: ['#fff6b0', '#ff9b1f'] },
];

export const DEFAULT_EQUIPPED = { trail: 'trail-flame', skin: 'skin-classic', celebration: 'cele-fireworks' } as const;

export const cosmeticById = (id: string): Cosmetic | undefined => COSMETICS.find((c) => c.id === id);
