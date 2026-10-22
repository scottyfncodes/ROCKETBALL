import type { Challenge } from '../config/challenges';
import type { Sport } from '../sim/types';
import type { Camera } from './camera';
import { THEMES, rng, type Theme } from './theme';

const STAND_TILE = 900;

interface Cached {
  key: string;
  sky: HTMLCanvasElement;
  stands: HTMLCanvasElement;
  standsH: number;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Sky, stadium and field layers. Expensive static pieces are cached in offscreen canvases. */
export class Background {
  private cache = new Map<Sport, Cached>();

  private build(sport: Sport, w: number, h: number, dpr: number): Cached {
    const key = `${w}x${h}@${dpr}`;
    const hit = this.cache.get(sport);
    if (hit && hit.key === key) return hit;
    const th = THEMES[sport];
    const sky = makeCanvas(w * dpr, h * dpr);
    paintSky(sky.getContext('2d')!, th, w, h, dpr, sport);
    const standsH = Math.min(170, Math.max(90, h * 0.15));
    const stands = makeCanvas(STAND_TILE * dpr, standsH * dpr);
    paintStands(stands.getContext('2d')!, th, sport, STAND_TILE, standsH, dpr);
    const c = { key, sky, stands, standsH };
    this.cache.set(sport, c);
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge, time: number): void {
    const { w, h, dpr, groundY } = cam.vp;
    const sport = ch.sport;
    const th = THEMES[sport];
    const c = this.build(sport, w, h, dpr);
    ctx.drawImage(c.sky, 0, 0, w, h);

    // Drifting clouds for day games.
    if (!th.night) drawClouds(ctx, cam, sport, time);

    // Stands with parallax (they are far away, so they move slowly and do not zoom).
    const par = cam.left * 9;
    let off = -(((par % STAND_TILE) + STAND_TILE) % STAND_TILE);
    const sy = groundY - c.standsH + 4;
    while (off < w) {
      ctx.drawImage(c.stands, off, sy, STAND_TILE, c.standsH);
      off += STAND_TILE;
    }
    if (th.night) drawLightGlow(ctx, w, sy, time);

    // Advertising boards along the edge of the field.
    drawBoards(ctx, cam, th);
    drawField(ctx, cam, ch, th);
  }
}

function paintSky(g: CanvasRenderingContext2D, th: Theme, w: number, h: number, dpr: number, sport: Sport): void {
  g.scale(dpr, dpr);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, th.sky[0]);
  grad.addColorStop(0.55, th.sky[1]);
  grad.addColorStop(1, th.sky[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const r = rng(sport.length * 97);
  if (th.night) {
    for (let i = 0; i < 140; i++) {
      g.globalAlpha = 0.25 + r() * 0.6;
      g.fillStyle = '#fff';
      const s = r() < 0.1 ? 2 : 1;
      g.fillRect(r() * w, r() * h * 0.6, s, s);
    }
    g.globalAlpha = 1;
  } else if (sport === 'soccer') {
    // Low setting sun.
    const sun = g.createRadialGradient(w * 0.78, h * 0.62, 0, w * 0.78, h * 0.62, h * 0.5);
    sun.addColorStop(0, 'rgba(255,230,160,0.95)');
    sun.addColorStop(0.12, 'rgba(255,170,90,0.55)');
    sun.addColorStop(1, 'rgba(255,120,80,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
  } else {
    const sun = g.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, h * 0.35);
    sun.addColorStop(0, 'rgba(255,255,230,0.9)');
    sun.addColorStop(0.1, 'rgba(255,255,220,0.4)');
    sun.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
  }
}

function paintStands(g: CanvasRenderingContext2D, th: Theme, sport: Sport, w: number, h: number, dpr: number): void {
  g.scale(dpr, dpr);
  const r = rng(sport.length * 131 + 7);
  const roofY = h * (sport === 'baseball' ? 0.38 : 0.22);
  // Structure silhouette.
  g.fillStyle = th.stands[0];
  if (sport === 'soccer') {
    // Sweeping cantilever roof.
    g.beginPath();
    g.moveTo(0, roofY + 10);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, roofY + Math.sin((x / w) * Math.PI * 2) * 8);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    for (let x = 0; x < w; x += 60) {
      g.beginPath();
      g.moveTo(x, roofY + Math.sin((x / w) * Math.PI * 2) * 8);
      g.lineTo(x + 30, roofY + 26);
      g.stroke();
    }
  } else {
    g.fillRect(0, roofY, w, h - roofY);
  }
  // Tiers of crowd.
  const tiers = sport === 'baseball' ? 2 : 3;
  const top = roofY + 14;
  const tierH = (h - top - 8) / tiers;
  for (let t = 0; t < tiers; t++) {
    const y0 = top + t * tierH;
    g.fillStyle = t % 2 ? th.stands[0] : th.stands[1];
    g.fillRect(0, y0, w, tierH - 4);
    for (let y = y0 + 4; y < y0 + tierH - 8; y += 6) {
      for (let x = (y % 12) / 2; x < w; x += 6 + r() * 3) {
        g.globalAlpha = 0.5 + r() * 0.5;
        g.fillStyle = th.crowd[Math.floor(r() * th.crowd.length)];
        g.beginPath();
        g.arc(x, y, 1.6 + r() * 0.8, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, y0 + tierH - 5, w, 3);
  }
  // Light towers / scoreboard.
  if (sport === 'football') {
    for (const x of [140, 560]) {
      g.fillStyle = '#0a0d22';
      g.fillRect(x - 3, 0, 6, roofY + 4);
      g.fillStyle = '#20264d';
      g.fillRect(x - 26, 0, 52, 20);
      g.fillStyle = '#fffbe0';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.fillRect(x - 22 + i * 12, 3 + j * 8, 8, 5);
    }
  } else if (sport === 'baseball') {
    g.fillStyle = '#10213a';
    g.fillRect(380, roofY - 46, 150, 54);
    g.fillStyle = '#0a1628';
    g.fillRect(386, roofY - 40, 138, 34);
    g.fillStyle = '#ffd23f';
    g.font = '900 16px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('ROCKETBALL', 455, roofY - 17);
    g.fillStyle = '#10213a';
    g.fillRect(450, roofY + 8, 10, 30);
  } else {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let x = 80; x < w; x += 280) g.fillRect(x, roofY - 3, 70, 4);
  }
}

function drawLightGlow(ctx: CanvasRenderingContext2D, w: number, standsTop: number, time: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const flick = 0.92 + Math.sin(time * 1.3) * 0.03;
  for (const fx of [0.2, 0.8]) {
    const gx = w * fx;
    const g = ctx.createRadialGradient(gx, standsTop, 0, gx, standsTop, 220);
    g.addColorStop(0, `rgba(255,250,220,${0.35 * flick})`);
    g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - 220, standsTop - 220, 440, 440);
  }
  ctx.restore();
}

function drawClouds(ctx: CanvasRenderingContext2D, cam: Camera, sport: Sport, time: number): void {
  const { w, groundY } = cam.vp;
  const r = rng(sport === 'baseball' ? 5 : 11);
  ctx.save();
  ctx.fillStyle = sport === 'baseball' ? 'rgba(255,255,255,0.85)' : 'rgba(255,190,170,0.35)';
  for (let i = 0; i < 6; i++) {
    const base = r() * 1400;
    const y = 40 + r() * groundY * 0.45;
    const s = 0.6 + r() * 0.9;
    const x = ((((base - cam.left * 4 + time * 6) % 1400) + 1400) % 1400) - 200;
    if (x > w + 150) continue;
    for (const [dx, dy, rx, ry] of [[0, 0, 60, 18], [34, -10, 36, 20], [-30, -6, 30, 15]]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawBoards(ctx: CanvasRenderingContext2D, cam: Camera, th: Theme): void {
  const { w, groundY } = cam.vp;
  const bh = Math.max(8, Math.min(16, cam.scale * 0.8));
  ctx.fillStyle = '#0b0b16';
  ctx.fillRect(0, groundY - bh - 2, w, bh + 2);
  const seg = 160;
  const par = cam.left * cam.scale * 0.8;
  let x = -(((par % seg) + seg) % seg);
  ctx.font = `900 ${Math.round(bh * 0.72)}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  let i = Math.floor(par / seg);
  while (x < w) {
    ctx.fillStyle = i % 2 ? th.accent : th.home[0];
    ctx.fillRect(x + 2, groundY - bh - 1, seg - 4, bh);
    ctx.fillStyle = i % 2 ? '#111' : '#fff';
    ctx.fillText(i % 3 === 0 ? 'ROCKETBALL' : i % 3 === 1 ? 'IGNITE!' : 'FULL THRUST', x + seg / 2, groundY - bh / 2 - 1);
    x += seg;
    i++;
  }
}

function drawField(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge, th: Theme): void {
  const { w, h, groundY } = cam.vp;
  const s = cam.scale;
  const fieldH = h - groundY;
  ctx.fillStyle = th.turf[0];
  ctx.fillRect(0, groundY, w, fieldH);
  // Mowing stripes, 5 m wide in world space.
  const x0 = Math.floor(cam.left / 5) * 5;
  ctx.fillStyle = th.turf[1];
  for (let x = x0; x < cam.right + 5; x += 5) {
    if (Math.round(x / 5) % 2 === 0) ctx.fillRect(cam.sx(x), groundY, 5 * s + 0.5, fieldH);
  }
  // Depth shading toward the bottom of the screen.
  const shade = ctx.createLinearGradient(0, groundY, 0, h);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(0.08, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, groundY, w, fieldH);

  if (ch.sport === 'football') drawFootballMarkings(ctx, cam, ch, th);
  else if (ch.sport === 'soccer') drawSoccerMarkings(ctx, cam, ch, th);
  else drawBaseballMarkings(ctx, cam, ch, th);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(0, groundY - 1, w, 2);
}

function drawFootballMarkings(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge, th: Theme): void {
  const { h, groundY } = cam.vp;
  const fieldH = h - groundY;
  const obj = ch.objective;
  if (obj.type === 'endzone') {
    ctx.fillStyle = th.accent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(cam.sx(obj.x0), groundY, (obj.x1 - obj.x0) * cam.scale, fieldH);
    ctx.globalAlpha = 1;
    // Diagonal hatching.
    ctx.save();
    ctx.beginPath();
    ctx.rect(cam.sx(obj.x0), groundY, (obj.x1 - obj.x0) * cam.scale, fieldH);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 6;
    for (let x = cam.sx(obj.x0) - fieldH; x < cam.sx(obj.x1); x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + fieldH, groundY);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `900 ${Math.min(28, fieldH * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('END ZONE', cam.sx((obj.x0 + obj.x1) / 2), groundY + fieldH * 0.45);
    ctx.restore();
  }
  ctx.strokeStyle = th.line;
  ctx.fillStyle = th.line;
  ctx.lineWidth = 2;
  ctx.font = `800 ${Math.min(18, Math.max(11, cam.scale * 0.9))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const start = Math.max(0, Math.floor(cam.left / 10) * 10);
  for (let x = start; x < cam.right + 10; x += 10) {
    const px = cam.sx(x);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(px, groundY);
    ctx.lineTo(px - fieldH * 0.25, h);
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    if (x > 0) ctx.fillText(String(x), px - fieldH * 0.12, groundY + fieldH * 0.62);
  }
  ctx.globalAlpha = 1;
}

function drawSoccerMarkings(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge, th: Theme): void {
  const { h, groundY } = cam.vp;
  const fieldH = h - groundY;
  const obj = ch.objective;
  if (obj.type !== 'goal') return;
  ctx.strokeStyle = th.line;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  for (const d of [0, 5.5, 16.5]) {
    const px = cam.sx(obj.x - d);
    ctx.beginPath();
    ctx.moveTo(px, groundY);
    ctx.lineTo(px - fieldH * 0.3, h);
    ctx.stroke();
  }
  // Penalty spot and kick spot.
  ctx.fillStyle = th.line;
  ctx.beginPath();
  ctx.ellipse(cam.sx(obj.x - 11), groundY + fieldH * 0.3, 4, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(cam.sx(0), groundY + 6, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBaseballMarkings(ctx: CanvasRenderingContext2D, cam: Camera, ch: Challenge, th: Theme): void {
  const { h, groundY } = cam.vp;
  const fieldH = h - groundY;
  // Infield dirt.
  ctx.fillStyle = '#c98a52';
  const dx0 = cam.sx(-4);
  const dx1 = cam.sx(30);
  ctx.beginPath();
  ctx.moveTo(dx0, groundY);
  ctx.lineTo(dx1, groundY);
  ctx.quadraticCurveTo(dx1 + fieldH * 0.6, groundY + fieldH * 0.5, dx1 - fieldH * 0.2, h);
  ctx.lineTo(dx0 - fieldH * 0.4, h);
  ctx.fill();
  // Mound.
  ctx.fillStyle = '#b97a45';
  ctx.beginPath();
  ctx.ellipse(cam.sx(18), groundY + 2, 2.6 * cam.scale, 0.5 * cam.scale + 3, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Home plate and batter's box.
  ctx.fillStyle = th.line;
  ctx.beginPath();
  ctx.ellipse(cam.sx(0.6), groundY + 5, 0.6 * cam.scale + 3, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Warning track before the wall.
  const obj = ch.objective;
  const wallX = obj.type === 'homerun' ? obj.x : ch.obstacles.find((o) => o.style === 'outfieldWall')?.x;
  if (wallX !== undefined) {
    ctx.fillStyle = '#a8703f';
    ctx.fillRect(cam.sx(wallX - 5), groundY, 5 * cam.scale, fieldH);
  }
  // Distance markers every 25 m.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `800 ${Math.min(16, Math.max(10, cam.scale * 0.8))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (let x = Math.max(25, Math.ceil(cam.left / 25) * 25); x < cam.right + 25; x += 25) {
    ctx.fillText(`${x}m`, cam.sx(x), groundY + fieldH * 0.55);
  }
}
