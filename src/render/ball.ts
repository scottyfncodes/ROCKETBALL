import type { Sport } from '../sim/types';

export interface SkinStyle {
  id: string;
}

interface Palette {
  base: string;
  base2: string;
  mark: string;
  glow?: string;
}

function palette(sport: Sport, skin: string): Palette {
  switch (skin) {
    case 'skin-neon':
      return { base: '#1b1440', base2: '#2e2470', mark: '#ff3df2', glow: '#ff3df2' };
    case 'skin-lava':
      return { base: '#2a0d05', base2: '#5a1a08', mark: '#ff7a00', glow: '#ff5a00' };
    case 'skin-chrome':
      return { base: '#dfe6ef', base2: '#8a97aa', mark: '#3b4658' };
    case 'skin-galaxy':
      return { base: '#120a2e', base2: '#3d2a8a', mark: '#c9b8ff', glow: '#8f6bff' };
    default:
      if (sport === 'football') return { base: '#8a4a22', base2: '#5e2f14', mark: '#ffffff' };
      if (sport === 'soccer') return { base: '#ffffff', base2: '#d9dee8', mark: '#1a1d29' };
      return { base: '#fbfaf5', base2: '#d9d6cc', mark: '#d7263d' };
  }
}

/**
 * Draw a ball at screen (x, y) with radius r. `roll` spins soccer/baseballs; footballs point
 * along `heading` and show their spiral through `roll`.
 */
export function drawBall(ctx: CanvasRenderingContext2D, sport: Sport, skin: string, x: number, y: number, r: number, roll: number, heading: number): void {
  const p = palette(sport, skin);
  ctx.save();
  ctx.translate(x, y);
  if (p.glow) {
    ctx.shadowColor = p.glow;
    ctx.shadowBlur = r * 1.2;
  }
  if (sport === 'football') {
    ctx.rotate(-heading);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, p.base2);
    g.addColorStop(0.35, p.base);
    g.addColorStop(1, p.base2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.45, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
    // Spiral: the lace band slides around the ball.
    const off = Math.sin(roll * 3) * r * 0.55;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.45, r, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = p.mark;
    ctx.lineWidth = Math.max(1.2, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, off);
    ctx.lineTo(r * 0.6, off);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.12);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.22, off - r * 0.2);
      ctx.lineTo(i * r * 0.22, off + r * 0.2);
      ctx.stroke();
    }
    // Stripes near the tips.
    ctx.globalAlpha = 0.8;
    for (const sx of [-1.05, 1.05]) {
      ctx.beginPath();
      ctx.moveTo(sx * r, -r);
      ctx.lineTo(sx * r, r);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, p.base);
    g.addColorStop(1, p.base2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.clip();
    ctx.rotate(roll);
    if (sport === 'soccer') {
      ctx.fillStyle = p.mark;
      const pent = (cx: number, cy: number, s: number) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
        }
        ctx.closePath();
        ctx.fill();
      };
      pent(0, 0, r * 0.36);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
        pent(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.32);
      }
    } else {
      ctx.strokeStyle = p.mark;
      ctx.lineWidth = Math.max(1, r * 0.13);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * r * 1.25, 0, r * 0.85, side < 0 ? -0.9 : Math.PI - 0.9, side < 0 ? 0.9 : Math.PI + 0.9);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    if (skin === 'skin-galaxy') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) {
        const a = roll + i * 1.7;
        ctx.fillRect(Math.cos(a) * r * 0.55, Math.sin(a * 1.3) * r * 0.55, 1.5, 1.5);
      }
    }
  }
  ctx.restore();
}

/**
 * The rocket booster strapped to the ball. `dir` is the thrust direction in screen radians
 * (the booster sits on the opposite side). When firing, draws a flickering flame.
 */
export function drawRocket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  dir: number,
  firing: boolean,
  colors: [string, string],
  time: number,
  hasFuel: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir);
  const L = r * 1.5;
  const W = r * 0.75;
  const bx = -r * 0.9 - L;
  if (firing) {
    const f = 0.8 + Math.sin(time * 60) * 0.12 + Math.sin(time * 23) * 0.1;
    const fl = r * 4.2 * f;
    const g = ctx.createLinearGradient(bx, 0, bx - fl, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.2, colors[0]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx + 2, -W * 0.55);
    ctx.quadraticCurveTo(bx - fl * 0.5, -W * 0.9, bx - fl, 0);
    ctx.quadraticCurveTo(bx - fl * 0.5, W * 0.9, bx + 2, W * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colors[1];
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(bx, 0, W * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Booster body
  const body = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
  body.addColorStop(0, '#f2f5fa');
  body.addColorStop(0.5, '#a9b4c6');
  body.addColorStop(1, '#5d6a80');
  ctx.fillStyle = body;
  ctx.strokeStyle = 'rgba(10,12,30,0.9)';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.roundRect(bx, -W / 2, L, W, W * 0.3);
  ctx.fill();
  ctx.stroke();
  // Fins
  ctx.fillStyle = hasFuel ? '#ff4d1f' : '#666b78';
  ctx.beginPath();
  ctx.moveTo(bx + L * 0.35, -W / 2);
  ctx.lineTo(bx - W * 0.2, -W * 1.05);
  ctx.lineTo(bx, -W / 2);
  ctx.moveTo(bx + L * 0.35, W / 2);
  ctx.lineTo(bx - W * 0.2, W * 1.05);
  ctx.lineTo(bx, W / 2);
  ctx.fill();
  // Strap
  ctx.fillStyle = '#222';
  ctx.fillRect(bx + L - 2, -W * 0.18, r * 0.9 + 2, W * 0.36);
  ctx.restore();
}
