import type { Sport } from '../sim/types';

export interface Theme {
  name: string;
  sky: [string, string, string];
  turf: [string, string];
  turfDark: string;
  line: string;
  accent: string;
  accent2: string;
  stands: [string, string];
  crowd: string[];
  home: [string, string];
  away: [string, string];
  night: boolean;
}

export const THEMES: Record<Sport, Theme> = {
  football: {
    name: 'TOUCHDOWN',
    sky: ['#04071c', '#0f1d4d', '#2d2a6b'],
    turf: ['#1c8a3c', '#187a34'],
    turfDark: '#0f4d22',
    line: '#f4f7ff',
    accent: '#ff5a1f',
    accent2: '#ffd23f',
    stands: ['#0b0f2a', '#161c45'],
    crowd: ['#ff5a1f', '#ffd23f', '#ffffff', '#3d7bff', '#ff3d7f', '#9aa6d6'],
    home: ['#1f5bff', '#ffd23f'],
    away: ['#d7263d', '#ffffff'],
    night: true,
  },
  soccer: {
    name: 'GOAL',
    sky: ['#1b0f3f', '#7a2c78', '#ff8a4c'],
    turf: ['#2fa34c', '#289243'],
    turfDark: '#145a26',
    line: '#ffffff',
    accent: '#3dd6ff',
    accent2: '#ffe14d',
    stands: ['#22113f', '#33195a'],
    crowd: ['#3dd6ff', '#ffe14d', '#ffffff', '#ff4fd8', '#7c5cff', '#ff8a4c'],
    home: ['#ffe14d', '#1d2b6b'],
    away: ['#e8333f', '#ffffff'],
    night: false,
  },
  baseball: {
    name: 'HOME RUN',
    sky: ['#1f78d1', '#6cc0ff', '#d8f0ff'],
    turf: ['#41ad4c', '#3a9d44'],
    turfDark: '#226b2b',
    line: '#ffffff',
    accent: '#ff3b3b',
    accent2: '#ffd23f',
    stands: ['#1d3557', '#28497a'],
    crowd: ['#ffffff', '#ff3b3b', '#ffd23f', '#1d3557', '#8ecae6', '#f4a261'],
    home: ['#ffffff', '#c1121f'],
    away: ['#264653', '#e9c46a'],
    night: false,
  },
};

/** Deterministic PRNG for procedural decoration (stable between frames and sessions). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
