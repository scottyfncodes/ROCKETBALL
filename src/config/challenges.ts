/**
 * The handcrafted ROCKETBALL challenges. Five per sport plus the three-round Triple Threat final.
 * Layouts are data: tune numbers here, the simulation and renderer read them as-is.
 */
import type { PitchKind } from '../sports/baseball';
import type { Course, Obstacle, Ring, Sport } from '../sim/types';

export interface Challenge extends Course {
  id: string;
  /** 1-based position within its sport. */
  index: number;
  name: string;
  /** One-line goal shown before the attempt. */
  goal: string;
  /** Coaching tip shown on the briefing / after a fail. */
  tip: string;
  /** Score thresholds for 2 and 3 stars (1 star = any success). */
  stars: [number, number];
  /** Design intent: can't be completed without the rocket (verified by tests). */
  requiresRocket?: boolean;
  /** Baseball: pitch sequence (cycled per pitch) and the swing timing window in seconds. */
  pitches?: PitchKind[];
  swingWindow?: number;
}

const goalFrame = (x: number, height = 4.5): Obstacle => ({ id: 'crossbar', style: 'crossbar', x: x - 0.15, y: height, w: 0.3, h: 0.3, bounce: 0.5 });
const keeper = (x: number, extra: Partial<Obstacle> = {}): Obstacle => ({ id: 'keeper', style: 'keeper', x, y: 0, w: 1.1, h: 2.7, ...extra });
const fence = (x: number, h: number): Obstacle => ({ id: 'wall', style: 'outfieldWall', x, y: 0, w: 1, h, bounce: 0.3 });
const ring = (id: string, x: number, y: number, r = 1.6, points = 300, extra: Partial<Ring> = {}): Ring => ({ id, x, y, r, points, ...extra });

export const CHALLENGES: Challenge[] = [
  // ------------------------------------------------------------------ FOOTBALL
  {
    id: 'fb1', sport: 'football', index: 1, name: 'Rocket Pass',
    goal: 'Land the pass in the end zone.',
    tip: 'Pull back and release to throw. Hold anywhere mid-flight to fire the rocket.',
    fuel: 1.5, worldEnd: 70, stars: [2150, 2480],
    objective: { type: 'endzone', x0: 28, x1: 40 },
    obstacles: [], rings: [],
  },
  {
    id: 'fb2', sport: 'football', index: 2, name: 'Afterburner',
    goal: 'The end zone is out of arm range. Boost it there.',
    tip: 'Throw high, then hold to boost near the top of the arc.',
    fuel: 2.0, worldEnd: 95, stars: [2400, 2760], requiresRocket: true,
    objective: { type: 'endzone', x0: 58, x1: 68 },
    obstacles: [], rings: [ring('r1', 44, 13, 1.8, 300)],
  },
  {
    id: 'fb3', sport: 'football', index: 3, name: 'Blitz',
    goal: 'Clear the jumping rushers and score.',
    tip: 'Watch the defenders jump. Throw when they drop, or rocket over them.',
    fuel: 1.8, worldEnd: 90, stars: [2350, 2720],
    objective: { type: 'endzone', x0: 50, x1: 60 },
    obstacles: [
      { id: 'd1', style: 'defender', x: 11, y: 0, w: 1.5, h: 4.2, motion: { axis: 'y', amplitude: 1.4, period: 1.7 } },
      { id: 'd2', style: 'lineman', x: 32, y: 0, w: 1.8, h: 5.2, motion: { axis: 'y', amplitude: 1.8, period: 2.3, phase: 0.4 } },
    ],
    rings: [ring('r1', 26, 12, 1.7, 300)],
  },
  {
    id: 'fb4', sport: 'football', index: 4, name: 'Thread the Needle',
    goal: 'Hit your receiver in stride. Stay under the drone.',
    tip: 'Lead the receiver. Steer down (drag down) to dive the ball into his hands.',
    fuel: 1.6, worldEnd: 90, stars: [2000, 2290],
    objective: { type: 'endzone', x0: 48, x1: 60, window: { x: 50, y: 1.4, w: 2.4, h: 2.6, motion: { axis: 'x', amplitude: 5, period: 5 } } },
    obstacles: [
      { id: 'd1', style: 'defender', x: 18, y: 0, w: 1.5, h: 4.2, motion: { axis: 'y', amplitude: 1.2, period: 1.5 } },
      { id: 'drone', style: 'drone', x: 30, y: 13, w: 6, h: 1.4, motion: { axis: 'y', amplitude: 1.5, period: 3 } },
      { id: 'd2', style: 'defender', x: 42, y: 0, w: 1.5, h: 4.2, motion: { axis: 'y', amplitude: 1.2, period: 1.9, phase: 0.5 } },
    ],
    rings: [ring('r1', 33, 7.5, 1.6, 400)],
  },
  {
    id: 'fb5', sport: 'football', index: 5, name: 'Hail Mary Rocket',
    goal: 'Ninety metres. Three rushers. One rocket. Thread the ring.',
    tip: 'Throw a high bomb, boost long through the gold ring, then let it fall into the end zone.',
    fuel: 2.4, worldEnd: 125, stars: [2550, 2940], requiresRocket: true,
    objective: { type: 'endzone', x0: 90, x1: 100 },
    obstacles: [
      { id: 'd1', style: 'defender', x: 14, y: 0, w: 1.5, h: 4.2, motion: { axis: 'y', amplitude: 1.6, period: 1.6 } },
      { id: 'd2', style: 'lineman', x: 40, y: 0, w: 1.8, h: 5.2, motion: { axis: 'y', amplitude: 2.2, period: 2.1, phase: 0.3 } },
      { id: 'drone', style: 'drone', x: 58, y: 20, w: 7, h: 1.4, motion: { axis: 'y', amplitude: 2.5, period: 3.4 } },
      { id: 'd3', style: 'defender', x: 80, y: 0, w: 1.5, h: 4.2, motion: { axis: 'y', amplitude: 1.8, period: 1.8, phase: 0.6 } },
    ],
    rings: [ring('gold', 70, 12, 2.0, 600, { required: true })],
  },

  // -------------------------------------------------------------------- SOCCER
  {
    id: 'sc1', sport: 'soccer', index: 1, name: 'Open Net',
    goal: 'Swipe to kick it into the goal.',
    tip: 'Swipe from the ball toward the goal. Longer swipe = harder kick.',
    fuel: 1.2, worldEnd: 60, stars: [2100, 2400],
    objective: { type: 'goal', x: 24, height: 4.5, depth: 2.2 },
    obstacles: [goalFrame(24)], rings: [],
  },
  {
    id: 'sc2', sport: 'soccer', index: 2, name: 'Over the Wall',
    goal: 'Bend it over the wall and under the bar.',
    tip: 'Curve your swipe like a rainbow to put topspin on it. It will dip late.',
    fuel: 1.4, worldEnd: 70, stars: [2280, 2630],
    objective: { type: 'goal', x: 30, height: 4.5, depth: 2.2 },
    obstacles: [{ id: 'wall', style: 'wall', x: 9, y: 0, w: 1.0, h: 2.8 }, goalFrame(30)],
    rings: [ring('r1', 18, 6.5, 1.6, 300)],
  },
  {
    id: 'sc3', sport: 'soccer', index: 3, name: "Keeper's Reach",
    goal: 'Beat the diving keeper. Top corner pays.',
    tip: 'The keeper jumps on a rhythm. Aim above his gloves and boost down into the corner.',
    fuel: 1.6, worldEnd: 80, stars: [2400, 2770],
    objective: { type: 'goal', x: 38, height: 4.5, depth: 2.2 },
    obstacles: [
      { id: 'wall', style: 'wall', x: 11, y: 0, w: 1.0, h: 2.8 },
      keeper(36.4, { motion: { axis: 'y', amplitude: 0.7, period: 1.8 } }),
      goalFrame(38),
    ],
    rings: [ring('r1', 37, 3.2, 1.0, 400)],
  },
  {
    id: 'sc4', sport: 'soccer', index: 4, name: 'Long Range Rocket',
    goal: 'Score from 64 metres. Your leg cannot do it alone.',
    tip: 'Kick high and long, ignite near the top, and steer down under the bar.',
    fuel: 2.2, worldEnd: 100, stars: [2250, 2580], requiresRocket: true,
    objective: { type: 'goal', x: 64, height: 4.5, depth: 2.2 },
    obstacles: [
      { id: 'wall', style: 'wall', x: 10, y: 0, w: 1.0, h: 2.8 },
      { id: 'def', style: 'wall', x: 32, y: 0, w: 1.0, h: 3.0, motion: { axis: 'x', amplitude: 3, period: 3.2 } },
      keeper(62.4, { motion: { axis: 'y', amplitude: 0.5, period: 1.4 } }),
      goalFrame(64),
    ],
    rings: [ring('r1', 36, 11, 1.8, 400)],
  },
  {
    id: 'sc5', sport: 'soccer', index: 5, name: 'The Bender',
    goal: 'Over the wall, under the sign, through the ring, into the net.',
    tip: 'Topspin the kick so it drops under the sign, then boost up through the ring.',
    fuel: 1.9, worldEnd: 90, stars: [2480, 2860], requiresRocket: true,
    objective: { type: 'goal', x: 46, height: 4.5, depth: 2.2 },
    obstacles: [
      { id: 'wall', style: 'wall', x: 9, y: 0, w: 1.0, h: 2.8 },
      { id: 'sign', style: 'sign', x: 20, y: 6.2, w: 8, h: 1.6 },
      keeper(44.4, { motion: { axis: 'y', amplitude: 0.8, period: 1.6, phase: 0.25 } }),
      goalFrame(46),
    ],
    rings: [ring('gold', 35, 4.2, 1.7, 600, { required: true })],
  },

  // ------------------------------------------------------------------ BASEBALL
  {
    id: 'bb1', sport: 'baseball', index: 1, name: 'Batting Practice',
    goal: 'Time your swing and clear the fence.',
    tip: 'Tap as the ball reaches the plate. Tap the upper half to lift, the lower half to drive.',
    fuel: 1.5, worldEnd: 140, stars: [1950, 2240],
    pitches: ['meatball'], swingWindow: 0.17,
    objective: { type: 'homerun', x: 80, h: 3 },
    obstacles: [fence(80, 3)], rings: [],
  },
  {
    id: 'bb2', sport: 'baseball', index: 2, name: 'Heat Check',
    goal: 'Catch up to the fastball and rocket it out.',
    tip: 'Fastballs arrive sooner — tap earlier. Then hold to boost the ball over the deep fence.',
    fuel: 1.8, worldEnd: 170, stars: [2260, 2600], requiresRocket: true,
    pitches: ['fastball'], swingWindow: 0.14,
    objective: { type: 'homerun', x: 128, h: 4 },
    obstacles: [fence(128, 4)], rings: [ring('r1', 70, 24, 2.2, 300)],
  },
  {
    id: 'bb3', sport: 'baseball', index: 3, name: 'Billboard Bash',
    goal: 'Smash the ROCKETBALL billboard above the bleachers.',
    tip: 'Drive it on a line, then steer up into the board. Going over it is a miss.',
    fuel: 1.8, worldEnd: 150, stars: [1780, 2050],
    pitches: ['changeup', 'curveball'], swingWindow: 0.13,
    objective: { type: 'billboard', targetId: 'board', x: 84, y: 22, w: 2, h: 7 },
    obstacles: [fence(96, 4), { id: 'board', style: 'billboard', x: 84, y: 22, w: 2, h: 7, bounce: 0.3 }],
    rings: [],
  },
  {
    id: 'bb4', sport: 'baseball', index: 4, name: 'The Monster',
    goal: 'Clear the 16-metre Monster wall.',
    tip: 'Lift it, ignite early and steer up. Save fuel for the climb at the end.',
    fuel: 1.7, worldEnd: 160, stars: [2230, 2570],
    pitches: ['changeup', 'fastball', 'curveball'], swingWindow: 0.13,
    objective: { type: 'homerun', x: 92, h: 16 },
    obstacles: [fence(92, 16)], rings: [ring('r1', 60, 25, 2.0, 400)],
  },
  {
    id: 'bb5', sport: 'baseball', index: 5, name: 'Moonshot',
    goal: 'Hit the moon ring, dodge the blimp, leave the park.',
    tip: 'Perfect contact, then a long steady burn. Steer around the blimp into the ring.',
    fuel: 2.2, worldEnd: 220, stars: [2550, 2930], requiresRocket: true,
    pitches: ['heater', 'curveball', 'heater'], swingWindow: 0.12,
    objective: { type: 'homerun', x: 135, h: 6 },
    obstacles: [fence(135, 6), { id: 'blimp', style: 'drone', x: 78, y: 26, w: 12, h: 4, motion: { axis: 'y', amplitude: 4, period: 4 } }],
    rings: [ring('moon', 112, 34, 2.4, 700, { required: true })],
  },
];

/** Triple Threat: one round per sport, scored as a single run. */
export const TRIPLE_THREAT: Challenge[] = [
  {
    id: 'tt1', sport: 'football', index: 1, name: 'Triple Threat · Touchdown',
    goal: 'Round 1: hit the sprinting receiver past the rushers.',
    tip: 'Lead him. The window moves.',
    fuel: 2.0, worldEnd: 110, stars: [0, 0],
    objective: { type: 'endzone', x0: 66, x1: 78, window: { x: 70, y: 1.4, w: 2.4, h: 2.6, motion: { axis: 'x', amplitude: 6, period: 4.4 } } },
    obstacles: [
      { id: 'd1', style: 'lineman', x: 16, y: 0, w: 1.8, h: 5.2, motion: { axis: 'y', amplitude: 1.8, period: 1.8 } },
      { id: 'drone', style: 'drone', x: 40, y: 17, w: 7, h: 1.4, motion: { axis: 'y', amplitude: 2, period: 3 } },
    ],
    rings: [ring('r1', 54, 8, 1.8, 400)],
  },
  {
    id: 'tt2', sport: 'soccer', index: 2, name: 'Triple Threat · Goal',
    goal: 'Round 2: long-range rocket past the keeper.',
    tip: 'Kick high, boost late, dive under the bar.',
    fuel: 2.0, worldEnd: 100, stars: [0, 0],
    objective: { type: 'goal', x: 52, height: 4.5, depth: 2.2 },
    obstacles: [
      { id: 'wall', style: 'wall', x: 10, y: 0, w: 1.0, h: 2.8 },
      { id: 'sign', style: 'sign', x: 26, y: 12, w: 8, h: 1.6 },
      keeper(50.4, { motion: { axis: 'y', amplitude: 0.7, period: 1.5 } }),
      goalFrame(52),
    ],
    rings: [ring('r1', 51, 3.2, 1.0, 500)],
  },
  {
    id: 'tt3', sport: 'baseball', index: 3, name: 'Triple Threat · Home Run',
    goal: 'Round 3: walk it off. Clear the far wall.',
    tip: 'Perfect timing, big lift, full burn.',
    fuel: 2.0, worldEnd: 200, stars: [0, 0],
    pitches: ['fastball', 'curveball', 'changeup'], swingWindow: 0.13,
    objective: { type: 'homerun', x: 128, h: 8 },
    obstacles: [fence(128, 8)], rings: [ring('r1', 95, 30, 2.2, 400)],
  },
];

/** Total score thresholds for 2 and 3 stars in the Triple Threat. */
export const TRIPLE_STARS: [number, number] = [6700, 7700];
export const TRIPLE_ID = 'triple';

export const challengesFor = (sport: Sport): Challenge[] => CHALLENGES.filter((c) => c.sport === sport);
export const challengeById = (id: string): Challenge | undefined =>
  CHALLENGES.find((c) => c.id === id) ?? TRIPLE_THREAT.find((c) => c.id === id);
