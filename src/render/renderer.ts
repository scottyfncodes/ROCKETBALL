import type { Challenge } from '../config/challenges';
import { cosmeticById } from '../config/cosmetics';
import type { Game } from '../game/game';
import type { BaseballSetup } from '../game/setup/baseballSetup';
import type { FootballSetup } from '../game/setup/footballSetup';
import type { SoccerSetup } from '../game/setup/soccerSetup';
import { BALLS } from '../config/physics';
import { BASEBALL } from '../sports/baseball';
import { FOOTBALL } from '../sports/football';
import { SOCCER } from '../sports/soccer';
import type { Vec } from '../sim/vec';
import { obstacleAt, ringAt, windowAt } from '../sim/world';
import { drawAthlete, drawObjectiveBack, drawObjectiveFront, drawObstacles, drawRings } from './actors';
import { Background } from './background';
import { drawBall, drawRocket } from './ball';
import type { Camera } from './camera';
import { drawTrail } from './effects';
import { THEMES } from './theme';

const EMPTY = new Set<string>();

export class Renderer {
  private bg = new Background();

  constructor(private ctx: CanvasRenderingContext2D) {}

  private begin(cam: Camera): void {
    const { dpr } = cam.vp;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Title-screen background: a rocket ball looping over the stadium. */
  drawAttract(g: Game, _dt: number): void {
    const ctx = this.ctx;
    const cam = g.cam;
    this.begin(cam);
    this.bg.draw(ctx, cam, g.challenge, g.time);
    const trailCol = (cosmeticById(g.equipped.trail)?.colors ?? ['#ffb22e', '#ff4d1f']) as [string, string];
    drawTrail(ctx, cam, g.trail, trailCol, g.equipped.trail === 'trail-rainbow', g.time);
    g.fx.draw(ctx, cam);
    const last = g.trail[g.trail.length - 1];
    if (last) {
      const prev = g.trail[Math.max(0, g.trail.length - 4)];
      const heading = Math.atan2(last.y - prev.y, last.x - prev.x);
      this.ball(g, g.challenge.sport, { x: last.x, y: last.y }, heading, g.time * 8, last.boost, heading, true);
    }
    // Dim for menu legibility.
    ctx.fillStyle = 'rgba(5,6,20,0.45)';
    ctx.fillRect(0, 0, cam.vp.w, cam.vp.h);
  }

  draw(g: Game): void {
    const ctx = this.ctx;
    const cam = g.cam;
    const ch = g.challenge;
    const sim = g.sim;
    const clock = sim ? sim.clock : g.clock;
    this.begin(cam);
    this.bg.draw(ctx, cam, ch, g.time);

    // Ghost of the previous attempt.
    const ghost = g.ghosts.get(ch.id);
    if (ghost && g.phase === 'setup') this.ghost(ghost, cam);

    drawObjectiveBack(ctx, cam, ch, clock);
    this.athletes(g, clock);
    drawObstacles(ctx, cam, ch, clock, sim ? new Set(sim.hits) : EMPTY);
    drawRings(ctx, cam, ch, clock, sim ? sim.ringsPassed : EMPTY);

    // Setup visuals (aim / swipe / pitch).
    if (g.phase === 'setup' || g.phase === 'intro') this.setupLayer(g, clock);

    // Trail + particles + ball.
    const trailCol = (cosmeticById(g.equipped.trail)?.colors ?? ['#ffb22e', '#ff4d1f']) as [string, string];
    drawTrail(ctx, cam, g.trail, trailCol, g.equipped.trail === 'trail-rainbow', g.time);
    if (sim) {
      const heading = Math.atan2(sim.vel.y, sim.vel.x);
      const thrust = sim.boosting ? Math.atan2(sim.thrustDir.y, sim.thrustDir.x) : heading;
      g.fx.draw(ctx, cam);
      this.ball(g, ch.sport, sim.pos, heading, sim.roll, sim.boosting, thrust, sim.fuel > 0, sim.t);
    } else {
      g.fx.draw(ctx, cam);
    }
    drawObjectiveFront(ctx, cam, ch);

    this.edgeIndicators(g, clock);
    this.minimap(g, clock);
    if (g.steerUI && sim?.boosting !== undefined) this.joystick(g);
    if (g.hint && !g.steerUI) this.tutorialGesture(g);
  }

  // ----------------------------------------------------------------------------

  private ball(g: Game, sport: Challenge['sport'], pos: Vec, heading: number, roll: number, boosting: boolean, thrust: number, hasFuel = true, t = 99): void {
    const ctx = this.ctx;
    const cam = g.cam;
    const r = Math.max(7, BALLS[sport].radius * cam.scale);
    const x = cam.sx(pos.x);
    const y = cam.sy(pos.y);
    // Ground shadow helps read height.
    const h = pos.y;
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.3 - h * 0.01)})`;
    ctx.beginPath();
    ctx.ellipse(x, cam.sy(0) + 2, r * Math.max(0.4, 1.2 - h * 0.02), r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    const colors = (cosmeticById(g.equipped.trail)?.colors ?? ['#ffb22e', '#ff4d1f']) as [string, string];
    // Booster snaps on just after launch.
    if (t > 0.08) drawRocket(ctx, x, y, r, -thrust, boosting, colors, g.time, hasFuel);
    drawBall(ctx, sport, g.equipped.skin, x, y, r, roll, heading);
    // Halo keeps the ball readable over busy backgrounds.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  private ghost(pts: Vec[], cam: Camera): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(cam.sx(p.x), cam.sy(p.y)) : ctx.moveTo(cam.sx(p.x), cam.sy(p.y))));
    ctx.stroke();
    ctx.restore();
  }

  private athletes(g: Game, clock: number): void {
    const ctx = this.ctx;
    const cam = g.cam;
    const ch = g.challenge;
    const th = THEMES[ch.sport];
    const H = 4.0 * cam.scale;
    const ground = cam.sy(0);
    const sinceLaunch = g.sim ? g.sim.t : -1;
    if (ch.sport === 'football') {
      const fs = g.setup as FootballSetup | null;
      let arm = 2.4;
      if (fs?.showingAim && fs.aim) arm = Math.PI - 0.3 + fs.aim.power * 0.5;
      if (sinceLaunch >= 0) arm = sinceLaunch < 0.25 ? 2.4 - sinceLaunch * 10 : -0.3;
      drawAthlete(ctx, cam.sx(-0.4), ground, H, { jersey: th.home[0], trim: th.home[1], helmet: true }, { kind: 'throw', arm, t: 0 });
    } else if (ch.sport === 'soccer') {
      const kickT = sinceLaunch >= 0 ? Math.min(1, sinceLaunch / 0.25) : 0;
      const ss = g.setup as SoccerSetup | null;
      const wind = ss?.swiping ? 0.15 : 0;
      drawAthlete(ctx, cam.sx(-1.3), ground, H, { jersey: th.home[0], trim: th.home[1] }, { kind: 'kick', t: sinceLaunch >= 0 ? 0.3 + kickT * 0.7 : wind });
    } else {
      const bs = g.setup as BaseballSetup | null;
      // Pitcher on the mound.
      let pt = 0;
      if (bs) {
        if (bs.phase === 'windup') pt = Math.min(1, bs.phaseT / BASEBALL.windup);
        else if (bs.phase === 'pitch') pt = 1;
      }
      if (sinceLaunch >= 0) pt = 1;
      drawAthlete(ctx, cam.sx(18.3), cam.sy(0.25), H, { jersey: th.away[0], trim: th.away[1], cap: true, gloves: '#5a3b1e' }, { kind: 'pitch', t: pt }, -1);
      // Catcher crouch hint (simple).
      drawAthlete(ctx, cam.sx(-2.2), ground, H * 0.7, { jersey: '#2c3e50', trim: '#95a5a6', helmet: true }, { kind: 'stand' });
      // Batter.
      let swing = -1;
      let plane: 'lift' | 'drive' = 'lift';
      if (bs) {
        swing = bs.swingProgress(clock);
        plane = bs.plane;
      }
      if (sinceLaunch >= 0) swing = 1;
      drawAthlete(ctx, cam.sx(-0.5), ground, H, { jersey: th.home[0], trim: th.home[1], helmet: true }, { kind: 'bat', swing, plane });
    }
  }

  private setupLayer(g: Game, clock: number): void {
    const ctx = this.ctx;
    const cam = g.cam;
    const ch = g.challenge;
    if (ch.sport === 'football') {
      const fs = g.setup as FootballSetup | null;
      const p = FOOTBALL.launchPos;
      let heading = 0.6;
      if (fs?.showingAim && fs.aim) {
        heading = fs.aim.angle;
        this.previewDots(fs.preview, cam, '#ffffff');
        // Slingshot band.
        if (fs.dragging) {
          ctx.strokeStyle = 'rgba(255,210,63,0.9)';
          ctx.lineWidth = 3;
          ctx.setLineDash([2, 6]);
          ctx.beginPath();
          ctx.moveTo(fs.start.x, fs.start.y);
          ctx.lineTo(fs.cur.x, fs.cur.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,210,63,0.9)';
          ctx.beginPath();
          ctx.arc(fs.start.x, fs.start.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fs.cur.x, fs.cur.y, 14, 0, Math.PI * 2);
          ctx.stroke();
        }
        this.powerArc(cam.sx(p.x), cam.sy(p.y), fs.aim.power, fs.aim.angle, fs.aim.valid);
      }
      this.ball(g, 'football', p, heading, g.time * 2, false, heading, true, 0);
    } else if (ch.sport === 'soccer') {
      const ss = g.setup as SoccerSetup | null;
      if (ss?.showingAim && ss.kick) {
        this.previewDots(ss.preview, cam, ss.kick.curl < -0.2 ? '#ffd23f' : ss.kick.curl > 0.2 ? '#5cf2ff' : '#ffffff');
        this.powerArc(cam.sx(SOCCER.ballPos.x), cam.sy(SOCCER.ballPos.y), ss.kick.power, ss.kick.angle, ss.kick.valid);
      }
      if (ss?.swiping && ss.points.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(92,242,255,0.85)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ss.points.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.stroke();
        ctx.restore();
      }
      this.ball(g, 'soccer', SOCCER.ballPos, 0, 0, false, 0, true, 0);
    } else {
      const bs = g.setup as BaseballSetup | null;
      if (!bs) return;
      // Swing zones.
      const { w } = cam.vp;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(0, bs.split);
      ctx.lineTo(w, bs.split);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.textAlign = 'right';
      ctx.fillText('TAP HERE ▲ LIFT', w - 14, bs.split - 10);
      ctx.fillText('TAP HERE ▼ DRIVE', w - 14, bs.split + 22);
      ctx.restore();
      // Timing ring at the plate on early challenges (teaches the rhythm).
      const plate = { x: cam.sx(BASEBALL.plate.x), y: cam.sy(BASEBALL.plate.y) };
      const s = bs.pitchTime(clock);
      if (bs.phase === 'pitch' && !bs.swung && (ch.index <= 2 || !g.save.tutorial['baseball-aim'])) {
        const k = 1 - s / bs.pitch.travel;
        if (k > -0.3) {
          ctx.strokeStyle = Math.abs(k) < bs.window / bs.pitch.travel ? '#5cff8a' : 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(plate.x, plate.y, Math.max(10, 12 + k * 70), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(plate.x - 0.5 * cam.scale, cam.sy(1.9), 1 * cam.scale, 1.3 * cam.scale);
      const bp = bs.ballPos(clock);
      if (bp && !bs.launch) {
        const r = Math.max(6, BALLS.baseball.radius * cam.scale);
        drawBall(ctx, 'baseball', g.equipped.skin, cam.sx(bp.x), cam.sy(bp.y), r, s * 30, 0);
      }
      if (bs.lastContact && !bs.lastContact.hit && bs.phase !== 'between') {
        this.label(bs.lastContact.error < 0 ? 'TOO EARLY' : 'TOO LATE', plate.x + 40, plate.y - 60, '#ff8a8a');
      }
      // Strike counter.
      for (let i = 0; i < BASEBALL.strikesAllowed; i++) {
        ctx.fillStyle = i < bs.strikes ? '#ff3b3b' : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(cam.sx(-2) + i * 16, cam.sy(0) + 26, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('STRIKES', cam.sx(-2) - 6, cam.sy(0) + 46);
    }
  }

  private label(text: string, x: number, y: number, color: string): void {
    const ctx = this.ctx;
    ctx.font = 'italic 900 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  private previewDots(pts: Vec[], cam: Camera, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    for (let i = 1; i < pts.length; i++) {
      const k = 1 - i / pts.length;
      ctx.globalAlpha = 0.25 + k * 0.7;
      ctx.beginPath();
      ctx.arc(cam.sx(pts[i].x), cam.sy(pts[i].y), 2 + k * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private powerArc(x: number, y: number, power: number, angle: number, valid: boolean): void {
    const ctx = this.ctx;
    const R = 46;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, R, -Math.PI * 0.5, 0);
    ctx.stroke();
    const col = !valid ? '#888' : power > 0.85 ? '#ff4d1f' : power > 0.5 ? '#ffd23f' : '#5cff8a';
    ctx.strokeStyle = col;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, R, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 0.5 * power);
    ctx.stroke();
    // Aim arrow.
    const L = 26 + power * 50;
    const ex = x + Math.cos(angle) * L;
    const ey = y - Math.sin(angle) * L;
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(angle) * 10, ey - Math.sin(angle) * 10);
    ctx.lineTo(ex + Math.cos(angle + 2.5) * 9, ey - Math.sin(angle + 2.5) * 9);
    ctx.lineTo(ex + Math.cos(angle - 2.5) * 9, ey - Math.sin(angle - 2.5) * 9);
    ctx.fill();
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round((angle * 180) / Math.PI)}°`, x + R + 8, y - 6);
    ctx.restore();
  }

  /** Arrows on the screen edge pointing at the target (and the ball when it flies off the top). */
  private edgeIndicators(g: Game, clock: number): void {
    const ctx = this.ctx;
    const cam = g.cam;
    const ch = g.challenge;
    const o = ch.objective;
    let tx: number;
    let ty: number;
    if (o.type === 'endzone') {
      if (o.window) {
        const w = windowAt(o.window, clock);
        tx = w.x + w.w / 2;
        ty = w.y + w.h / 2;
      } else {
        tx = (o.x0 + o.x1) / 2;
        ty = 0.5;
      }
    } else if (o.type === 'goal') {
      tx = o.x;
      ty = o.height / 2;
    } else if (o.type === 'homerun') {
      tx = o.x;
      ty = o.h;
    } else {
      tx = o.x + o.w / 2;
      ty = o.y + o.h / 2;
    }
    const from = g.sim ? g.sim.pos.x : 0;
    const sx = cam.sx(tx);
    const { w, top, groundY } = cam.vp;
    if (sx > w - 10 && g.phase !== 'result') {
      const y = Math.min(groundY - 30, Math.max(top + 40, cam.sy(ty)));
      const d = Math.max(0, Math.round(tx - from));
      ctx.save();
      ctx.fillStyle = THEMES[ch.sport].accent2;
      ctx.beginPath();
      ctx.moveTo(w - 8, y);
      ctx.lineTo(w - 24, y - 12);
      ctx.lineTo(w - 24, y + 12);
      ctx.fill();
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(`${d}m`, w - 28, y + 5);
      ctx.fillText(`${d}m`, w - 28, y + 5);
      ctx.restore();
    }
    const sim = g.sim;
    if (sim && cam.sy(sim.pos.y) < top + 6) {
      const x = Math.min(w - 20, Math.max(20, cam.sx(sim.pos.x)));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, top + 4);
      ctx.lineTo(x - 9, top + 18);
      ctx.lineTo(x + 9, top + 18);
      ctx.fill();
      ctx.font = '900 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(sim.pos.y)}m`, x, top + 32);
    }
  }

  /** Thin course overview under the HUD: the whole challenge at a glance. */
  private minimap(g: Game, clock: number): void {
    const ctx = this.ctx;
    const cam = g.cam;
    const ch = g.challenge;
    const { w, top, safe } = cam.vp;
    const pad = 14 + Math.max(safe.left, safe.right);
    const mw = w - pad * 2;
    const y = top - 10;
    const o = ch.objective;
    const end = Math.max(
      ...[o.type === 'endzone' ? o.x1 + 6 : o.type === 'goal' ? o.x + 6 : o.type === 'homerun' ? o.x + 15 : o.x + 15, ...ch.rings.map((r) => r.x + 5)],
    );
    const x0 = -3;
    const mx = (x: number) => pad + ((x - x0) / (end - x0)) * mw;
    const hScale = 0.55;
    const my = (yy: number) => y - Math.min(30, yy * hScale);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(5,8,25,0.45)';
    ctx.beginPath();
    ctx.roundRect(pad - 6, y - 34, mw + 12, 40, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx(x0), y);
    ctx.lineTo(mx(end), y);
    ctx.stroke();
    const th = THEMES[ch.sport];
    ctx.fillStyle = th.accent2;
    if (o.type === 'endzone') ctx.fillRect(mx(o.x0), y - 3, mx(o.x1) - mx(o.x0), 4);
    else if (o.type === 'goal') ctx.fillRect(mx(o.x) - 1, my(o.height), 3, y - my(o.height));
    ctx.fillStyle = 'rgba(255,120,120,0.85)';
    for (const ob of ch.obstacles) {
      const b = obstacleAt(ob, clock);
      if (ob.style === 'crossbar') continue;
      ctx.fillStyle = ob.style === 'billboard' ? th.accent2 : ob.style === 'outfieldWall' ? '#5cff8a' : 'rgba(255,120,120,0.85)';
      ctx.fillRect(mx(b.x), my(b.y + b.h), Math.max(2, mx(b.x + b.w) - mx(b.x)), Math.max(2, my(b.y) - my(b.y + b.h)));
    }
    for (const r of ch.rings) {
      const c = ringAt(r, clock);
      ctx.strokeStyle = r.required ? '#ffd23f' : '#5cf2ff';
      ctx.beginPath();
      ctx.arc(mx(c.x), my(c.y), 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Ball path so far + ball.
    if (g.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < g.trail.length; i += 6) {
        const p = g.trail[i];
        if (i === 0) ctx.moveTo(mx(p.x), my(p.y));
        else ctx.lineTo(mx(p.x), my(p.y));
      }
      ctx.stroke();
    }
    const bp = g.sim ? g.sim.pos : { x: 0, y: 1 };
    ctx.fillStyle = g.sim?.boosting ? '#ffb22e' : '#ffffff';
    ctx.beginPath();
    ctx.arc(mx(bp.x), my(bp.y), 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Current camera window.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(mx(cam.left), y - 32, Math.max(4, mx(cam.right) - mx(cam.left)), 34);
    ctx.restore();
  }

  private joystick(g: Game): void {
    const s = g.steerUI;
    if (!s) return;
    const ctx = this.ctx;
    const steerPx = Math.min(90, Math.max(45, g.cam.vp.h * 0.11));
    const dy = Math.max(-steerPx, Math.min(steerPx, s.cy - s.y));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(s.x - 18, s.y - steerPx - 18, 36, steerPx * 2 + 36, 18);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲', s.x, s.y - steerPx - 24);
    ctx.fillText('▼', s.x, s.y + steerPx + 36);
    ctx.fillStyle = g.sim?.fuel ? 'rgba(255,178,46,0.9)' : 'rgba(150,150,150,0.8)';
    ctx.beginPath();
    ctx.arc(s.x, s.y + dy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Animated ghost finger demonstrating the gesture for first-time players. */
  private tutorialGesture(g: Game): void {
    const ctx = this.ctx;
    const cam = g.cam;
    const { w, groundY, top } = cam.vp;
    const kind = g.hint!.kind;
    const t = g.time % 2;
    let x = w * 0.6;
    let y = (groundY + top) / 2;
    let show = true;
    if (kind === 'football-aim') {
      const k = Math.min(1, t / 1.2);
      x = w * 0.55 - k * w * 0.22;
      y = (groundY + top) * 0.45 + k * 70;
      if (t > 1.5) show = false;
      ctx.strokeStyle = 'rgba(255,210,63,0.6)';
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.55, (groundY + top) * 0.45);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (kind === 'soccer-aim') {
      const k = Math.min(1, t / 0.9);
      const bx = cam.sx(0);
      const by = cam.sy(0.5);
      x = bx + k * w * 0.45;
      y = by - Math.sin(k * Math.PI * 0.5) * 120 + k * k * 10;
      if (t > 1.4) show = false;
    } else if (kind === 'baseball-aim') {
      x = w * 0.62;
      y = (groundY + top) * 0.4;
      show = t % 1 < 0.6;
    } else if (kind === 'rocket' || kind === 'steer') {
      x = w * 0.68;
      y = groundY - 90;
      if (kind === 'steer') y -= Math.sin(g.time * 3) * 40;
      ctx.strokeStyle = 'rgba(255,178,46,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 22 + (g.time * 30) % 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (!show) return;
    // Finger
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(10,10,30,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x - 8, y + 6, 16, 30, 7);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
