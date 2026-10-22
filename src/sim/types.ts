import type { Vec } from './vec';

export type Sport = 'football' | 'soccer' | 'baseball';
export const SPORTS: Sport[] = ['football', 'soccer', 'baseball'];

/** Deterministic oscillation used by moving defenders, keepers, rings and receivers. */
export interface Motion {
  axis: 'x' | 'y';
  amplitude: number;
  period: number;
  /** Phase offset in cycles (0..1). */
  phase?: number;
}

export type ObstacleStyle =
  | 'defender'
  | 'lineman'
  | 'wall'
  | 'keeper'
  | 'crossbar'
  | 'post'
  | 'sign'
  | 'outfieldWall'
  | 'deck'
  | 'billboard'
  | 'drone';

export interface Obstacle {
  id: string;
  style: ObstacleStyle;
  /** Bottom-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
  motion?: Motion;
  /** Overrides the ball's restitution when it hits this obstacle. */
  bounce?: number;
}

export interface Ring {
  id: string;
  x: number;
  y: number;
  r: number;
  motion?: Motion;
  /** Bonus points awarded for passing through. */
  points: number;
  /** When true, the attempt only succeeds if this ring was passed. */
  required?: boolean;
}

/** The primary objective of a challenge. */
export type Objective =
  /** Football: ball must first touch the ground inside [x0, x1] (or pass through the catch window if given). */
  | { type: 'endzone'; x0: number; x1: number; window?: CatchWindow }
  /** Soccer: ball must cross goal line x under the crossbar. */
  | { type: 'goal'; x: number; height: number; depth: number }
  /** Baseball: ball must clear the wall at x (height h) and land beyond it. */
  | { type: 'homerun'; x: number; h: number }
  /** Baseball: ball must strike the billboard obstacle with this id. */
  | { type: 'billboard'; targetId: string; x: number; y: number; w: number; h: number; motion?: Motion };

/** A receiver's hands — the football is "caught" if its centre enters this box. */
export interface CatchWindow {
  x: number;
  y: number;
  w: number;
  h: number;
  motion?: Motion;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaunchParams {
  pos: Vec;
  vel: Vec;
  /** Spin (rad/s scale used by Magnus). Positive = backspin / lift. */
  spin: number;
  /** Seconds since the attempt started when the ball was launched (sync for moving objects). */
  clock: number;
}

export interface FlightInput {
  /** Rocket held. */
  boost: boolean;
  /** -1 (nose down) .. +1 (nose up). */
  steer: number;
}

export type FlightEvent =
  | { type: 'bounce'; pos: Vec; speed: number }
  | { type: 'hit'; id: string; style: ObstacleStyle; pos: Vec; speed: number }
  | { type: 'ring'; id: string; pos: Vec; points: number }
  | { type: 'ignite'; pos: Vec }
  | { type: 'fuelEmpty'; pos: Vec }
  | { type: 'success'; pos: Vec; label: string }
  | { type: 'fail'; pos: Vec; label: string };

export interface FlightOutcome {
  success: boolean;
  label: string;
  /** Where the decisive moment happened. */
  pos: Vec;
  /** Time into the flight when decided. */
  t: number;
}

/** Everything the flight simulation needs to know about a challenge layout. */
export interface Course {
  sport: Sport;
  /** Seconds of rocket burn available. */
  fuel: number;
  objective: Objective;
  obstacles: Obstacle[];
  rings: Ring[];
  /** Ball leaving x > worldEnd is out of play. */
  worldEnd: number;
  /** Optional constant horizontal wind acceleration (m/s²). */
  wind?: number;
}
