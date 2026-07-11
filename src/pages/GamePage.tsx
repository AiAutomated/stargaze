import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Pause, Play, RotateCcw, Trophy, Zap, Heart, Star } from 'lucide-react';

/**
 * Meteor Drift — Stargaze arcade
 * Dodge meteors, collect stardust, survive the night sky.
 * Canvas 2D, 60fps, keyboard + touch.
 */

type Phase = 'menu' | 'playing' | 'paused' | 'over';

interface Star {
  x: number; y: number; z: number; s: number; a: number;
}
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; r: number; color: string;
}
interface Meteor {
  x: number; y: number; vx: number; vy: number;
  r: number; rot: number; spin: number; hp: number;
  hue: number; trail: { x: number; y: number }[];
}
interface Orb {
  x: number; y: number; r: number; kind: 'dust' | 'shield' | 'slow';
  pulse: number;
}
interface Bullet {
  x: number; y: number; vx: number; vy: number; life: number;
}

const HS_KEY = 'sg_meteor_drift_best';
const W = 900;
const H = 560;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>('menu');
  const keysRef = useRef<Record<string, boolean>>({});
  const touchRef = useRef({ active: false, x: 0, y: 0, id: -1 });
  const fireHeld = useRef(false);

  const [phase, setPhase] = useState<Phase>('menu');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try { return parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0; } catch { return 0; }
  });
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [hudShield, setHudShield] = useState(0);

  // Mutable game state (no React re-render per frame)
  const G = useRef({
    t: 0,
    ship: { x: W * 0.5, y: H * 0.72, vx: 0, vy: 0, angle: -Math.PI / 2, cool: 0, inv: 0, shield: 0 },
    stars: [] as Star[],
    particles: [] as Particle[],
    meteors: [] as Meteor[],
    orbs: [] as Orb[],
    bullets: [] as Bullet[],
    score: 0,
    combo: 0,
    comboT: 0,
    lives: 3,
    spawnT: 0,
    orbT: 0,
    shake: 0,
    slow: 0,
    wave: 1,
    flash: 0,
  });

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const resetGame = useCallback(() => {
    const g = G.current;
    g.t = 0;
    g.ship = { x: W * 0.5, y: H * 0.72, vx: 0, vy: 0, angle: -Math.PI / 2, cool: 0, inv: 90, shield: 0 };
    g.particles = [];
    g.meteors = [];
    g.orbs = [];
    g.bullets = [];
    g.score = 0;
    g.combo = 0;
    g.comboT = 0;
    g.lives = 3;
    g.spawnT = 40;
    g.orbT = 120;
    g.shake = 0;
    g.slow = 0;
    g.wave = 1;
    g.flash = 0;
    // denser starfield
    g.stars = Array.from({ length: 140 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: rand(0.2, 1.4),
      s: rand(0.5, 2.2),
      a: rand(0.3, 1),
    }));
    setScore(0);
    setCombo(0);
    setLives(3);
    setHudShield(0);
  }, []);

  const burst = useCallback((x: number, y: number, n: number, color: string, speed = 4) => {
    const g = G.current;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(0.5, speed);
      g.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(18, 40),
        max: 40,
        r: rand(1, 3.5),
        color,
      });
    }
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setPhaseBoth('playing');
  }, [resetGame, setPhaseBoth]);

  // ── Input ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') fireHeld.current = true;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (phaseRef.current === 'playing') setPhaseBoth('paused');
        else if (phaseRef.current === 'paused') setPhaseBoth('playing');
      }
      if ((e.code === 'Enter' || e.code === 'Space') && (phaseRef.current === 'menu' || phaseRef.current === 'over')) {
        startGame();
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') fireHeld.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setPhaseBoth, startGame]);

  // Touch controls on canvas
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const pos = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const r = el.getBoundingClientRect();
      const sx = (t.clientX - r.left) / r.width * W;
      const sy = (t.clientY - r.top) / r.height * H;
      return { x: sx, y: sy, id: t.identifier };
    };

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      if (phaseRef.current === 'menu' || phaseRef.current === 'over') {
        startGame();
        return;
      }
      if (phaseRef.current === 'paused') {
        setPhaseBoth('playing');
        return;
      }
      const p = pos(e);
      touchRef.current = { active: true, x: p.x, y: p.y, id: p.id };
      // tap right half to fire
      if (p.x > W * 0.55) fireHeld.current = true;
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchRef.current.id || touchRef.current.id === -1) {
          const r = el.getBoundingClientRect();
          touchRef.current.x = (t.clientX - r.left) / r.width * W;
          touchRef.current.y = (t.clientY - r.top) / r.height * H;
          touchRef.current.active = true;
        }
      }
    };
    const onEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchRef.current.active = false;
      fireHeld.current = false;
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    el.addEventListener('touchcancel', onEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [setPhaseBoth, startGame]);

  // ── Main loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HiDPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // seed stars for menu
    if (G.current.stars.length === 0) {
      G.current.stars = Array.from({ length: 140 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        z: rand(0.2, 1.4),
        s: rand(0.5, 2.2),
        a: rand(0.3, 1),
      }));
    }

    let lastHud = 0;

    const spawnMeteor = () => {
      const g = G.current;
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0) { x = rand(0, W); y = -30; }
      else if (edge === 1) { x = W + 30; y = rand(0, H * 0.7); }
      else if (edge === 2) { x = rand(0, W); y = -20; }
      else { x = -30; y = rand(0, H * 0.7); }

      const tx = g.ship.x + rand(-80, 80);
      const ty = g.ship.y + rand(-40, 40);
      const d = dist(x, y, tx, ty) || 1;
      const speed = rand(1.2, 2.4) + g.wave * 0.15 + Math.min(g.score / 800, 2);
      const r = rand(10, 22 + Math.min(g.wave, 8));
      g.meteors.push({
        x, y,
        vx: ((tx - x) / d) * speed,
        vy: ((ty - y) / d) * speed,
        r,
        rot: Math.random() * Math.PI * 2,
        spin: rand(-0.06, 0.06),
        hp: r > 18 ? 3 : r > 14 ? 2 : 1,
        hue: rand(15, 40),
        trail: [],
      });
    };

    const spawnOrb = () => {
      const g = G.current;
      const roll = Math.random();
      const kind: Orb['kind'] = roll > 0.92 ? 'shield' : roll > 0.85 ? 'slow' : 'dust';
      g.orbs.push({
        x: rand(40, W - 40),
        y: rand(40, H * 0.55),
        r: kind === 'dust' ? 7 : 10,
        kind,
        pulse: Math.random() * Math.PI * 2,
      });
    };

    const hitShip = () => {
      const g = G.current;
      const s = g.ship;
      if (s.inv > 0) return;
      if (s.shield > 0) {
        s.shield = Math.max(0, s.shield - 45);
        s.inv = 40;
        g.shake = 8;
        g.flash = 0.25;
        burst(s.x, s.y, 18, '#60a5fa', 5);
        return;
      }
      g.lives -= 1;
      s.inv = 100;
      g.shake = 14;
      g.flash = 0.45;
      g.combo = 0;
      burst(s.x, s.y, 28, '#f97316', 6);
      setLives(g.lives);
      setCombo(0);
      if (g.lives <= 0) {
        if (g.score > best) {
          setBest(g.score);
          try { localStorage.setItem(HS_KEY, String(g.score)); } catch { /* ignore */ }
        }
        setScore(g.score);
        setPhaseBoth('over');
      }
    };

    const frame = () => {
      rafRef.current = requestAnimationFrame(frame);
      const g = G.current;
      const ph = phaseRef.current;
      const dtScale = g.slow > 0 ? 0.45 : 1;

      // ── Update (playing only) ──────────────────────────────────────
      if (ph === 'playing') {
        g.t += 1;
        g.wave = 1 + Math.floor(g.score / 500);
        if (g.slow > 0) g.slow -= 1;
        if (g.shake > 0) g.shake *= 0.88;
        if (g.flash > 0) g.flash *= 0.9;
        if (g.comboT > 0) {
          g.comboT -= 1;
          if (g.comboT <= 0) g.combo = 0;
        }

        const s = g.ship;
        if (s.cool > 0) s.cool -= 1;
        if (s.inv > 0) s.inv -= 1;
        if (s.shield > 0) s.shield -= 0.15;

        // Movement
        let ax = 0, ay = 0;
        const k = keysRef.current;
        if (k.ArrowLeft || k.KeyA) ax -= 1;
        if (k.ArrowRight || k.KeyD) ax += 1;
        if (k.ArrowUp || k.KeyW) ay -= 1;
        if (k.ArrowDown || k.KeyS) ay += 1;

        if (touchRef.current.active) {
          const dx = touchRef.current.x - s.x;
          const dy = touchRef.current.y - s.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d > 12) {
            ax += (dx / d) * 1.2;
            ay += (dy / d) * 1.2;
          }
        }

        const acc = 0.55;
        s.vx = (s.vx + ax * acc) * 0.9;
        s.vy = (s.vy + ay * acc) * 0.9;
        s.x = clamp(s.x + s.vx * dtScale, 24, W - 24);
        s.y = clamp(s.y + s.vy * dtScale, 24, H - 24);

        // Face movement
        if (Math.abs(s.vx) + Math.abs(s.vy) > 0.3) {
          const target = Math.atan2(s.vy, s.vx);
          let diff = target - s.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          s.angle += diff * 0.15;
        }

        // Thruster particles
        if (Math.abs(ax) + Math.abs(ay) > 0.1 && g.t % 2 === 0) {
          const back = s.angle + Math.PI;
          g.particles.push({
            x: s.x + Math.cos(back) * 12,
            y: s.y + Math.sin(back) * 12,
            vx: Math.cos(back) * rand(1, 3) + rand(-0.5, 0.5),
            vy: Math.sin(back) * rand(1, 3) + rand(-0.5, 0.5),
            life: rand(10, 22),
            max: 22,
            r: rand(1.5, 3),
            color: Math.random() > 0.5 ? '#60a5fa' : '#a78bfa',
          });
        }

        // Fire
        if ((fireHeld.current || k.Space || k.KeyZ || k.KeyJ) && s.cool <= 0) {
          s.cool = 9;
          const spread = 0.08;
          for (let i = -1; i <= 1; i++) {
            if (i !== 0 && Math.random() > 0.35) continue;
            const ang = s.angle + i * spread;
            g.bullets.push({
              x: s.x + Math.cos(s.angle) * 14,
              y: s.y + Math.sin(s.angle) * 14,
              vx: Math.cos(ang) * 11,
              vy: Math.sin(ang) * 11,
              life: 45,
            });
          }
        }

        // Spawns
        g.spawnT -= 1;
        if (g.spawnT <= 0) {
          spawnMeteor();
          if (g.wave > 2 && Math.random() > 0.6) spawnMeteor();
          g.spawnT = Math.max(18, 55 - g.wave * 3 - Math.min(g.score / 200, 20));
        }
        g.orbT -= 1;
        if (g.orbT <= 0) {
          spawnOrb();
          g.orbT = rand(90, 160);
        }

        // Bullets
        for (let i = g.bullets.length - 1; i >= 0; i--) {
          const b = g.bullets[i];
          b.x += b.vx * dtScale;
          b.y += b.vy * dtScale;
          b.life -= 1;
          if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
            g.bullets.splice(i, 1);
            continue;
          }
          for (let j = g.meteors.length - 1; j >= 0; j--) {
            const m = g.meteors[j];
            if (dist(b.x, b.y, m.x, m.y) < m.r + 3) {
              m.hp -= 1;
              g.bullets.splice(i, 1);
              burst(b.x, b.y, 6, `hsl(${m.hue},90%,60%)`, 3);
              if (m.hp <= 0) {
                const pts = Math.round(m.r * 2 + g.combo * 2);
                g.score += pts;
                g.combo = Math.min(g.combo + 1, 20);
                g.comboT = 90;
                burst(m.x, m.y, 20, `hsl(${m.hue},90%,65%)`, 5);
                // chance of dust
                if (Math.random() > 0.55) {
                  g.orbs.push({ x: m.x, y: m.y, r: 7, kind: 'dust', pulse: 0 });
                }
                g.meteors.splice(j, 1);
              }
              break;
            }
          }
        }

        // Meteors
        for (let i = g.meteors.length - 1; i >= 0; i--) {
          const m = g.meteors[i];
          m.x += m.vx * dtScale;
          m.y += m.vy * dtScale;
          m.rot += m.spin;
          m.trail.push({ x: m.x, y: m.y });
          if (m.trail.length > 8) m.trail.shift();

          if (m.x < -80 || m.x > W + 80 || m.y < -80 || m.y > H + 80) {
            g.meteors.splice(i, 1);
            continue;
          }
          const hitR = m.r + (s.shield > 0 ? 16 : 10);
          if (s.inv <= 0 && dist(m.x, m.y, s.x, s.y) < hitR) {
            hitShip();
            m.hp -= 2;
            if (m.hp <= 0) {
              burst(m.x, m.y, 14, `hsl(${m.hue},90%,60%)`, 4);
              g.meteors.splice(i, 1);
            }
          }
        }

        // Orbs
        for (let i = g.orbs.length - 1; i >= 0; i--) {
          const o = g.orbs[i];
          o.pulse += 0.08;
          o.y += Math.sin(o.pulse) * 0.15;
          if (dist(o.x, o.y, s.x, s.y) < o.r + 14) {
            if (o.kind === 'dust') {
              g.score += 25 + g.combo * 3;
              g.combo = Math.min(g.combo + 1, 20);
              g.comboT = 100;
              burst(o.x, o.y, 12, '#fde047', 3);
            } else if (o.kind === 'shield') {
              s.shield = Math.min(180, s.shield + 100);
              burst(o.x, o.y, 16, '#38bdf8', 4);
            } else {
              g.slow = 180;
              burst(o.x, o.y, 14, '#c084fc', 3);
            }
            g.orbs.splice(i, 1);
          }
        }

        // Passive score drip
        if (g.t % 30 === 0) g.score += 1;

        // Sync HUD ~10fps
        if (g.t - lastHud > 6) {
          lastHud = g.t;
          setScore(g.score);
          setCombo(g.combo);
          setHudShield(Math.round(s.shield));
        }
      } else {
        // menu / pause idle star drift
        g.t += 0.3;
      }

      // Stars always drift
      for (const st of g.stars) {
        st.y += st.z * (ph === 'playing' ? 0.6 + G.current.wave * 0.05 : 0.25);
        if (st.y > H) {
          st.y = 0;
          st.x = Math.random() * W;
        }
      }

      // Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= 1;
        if (p.life <= 0) g.particles.splice(i, 1);
      }

      // ── Draw ───────────────────────────────────────────────────────
      const shx = (Math.random() - 0.5) * g.shake;
      const shy = (Math.random() - 0.5) * g.shake;
      ctx.save();
      ctx.translate(shx, shy);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#050018');
      bg.addColorStop(0.5, '#0a0530');
      bg.addColorStop(1, '#030014');
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      // Nebula washes
      const neb = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, 220);
      neb.addColorStop(0, 'rgba(79,142,247,0.12)');
      neb.addColorStop(1, 'transparent');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);
      const neb2 = ctx.createRadialGradient(W * 0.8, H * 0.6, 0, W * 0.8, H * 0.6, 260);
      neb2.addColorStop(0, 'rgba(139,92,246,0.1)');
      neb2.addColorStop(1, 'transparent');
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, W, H);

      // Stars
      for (const st of g.stars) {
        ctx.globalAlpha = st.a * (0.5 + 0.5 * Math.sin(g.t * 0.05 + st.x));
        ctx.fillStyle = st.z > 1 ? '#e0e7ff' : '#93c5fd';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.s * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Slow-mo vignette
      if (g.slow > 0 && ph === 'playing') {
        ctx.fillStyle = 'rgba(139,92,246,0.06)';
        ctx.fillRect(0, 0, W, H);
      }

      // Orbs
      for (const o of g.orbs) {
        const pulse = 1 + Math.sin(o.pulse) * 0.15;
        const col = o.kind === 'dust' ? '#fde047' : o.kind === 'shield' ? '#38bdf8' : '#c084fc';
        const glow = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 3 * pulse);
        glow.addColorStop(0, col + 'aa');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 3 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * pulse, 0, Math.PI * 2);
        ctx.fill();
        if (o.kind !== 'dust') {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r * 1.4 * pulse, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Meteors
      for (const m of g.meteors) {
        // trail
        if (m.trail.length > 1) {
          ctx.strokeStyle = `hsla(${m.hue},90%,60%,0.35)`;
          ctx.lineWidth = m.r * 0.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(m.trail[0].x, m.trail[0].y);
          for (let t = 1; t < m.trail.length; t++) ctx.lineTo(m.trail[t].x, m.trail[t].y);
          ctx.stroke();
        }
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.rot);
        // rock body
        const grad = ctx.createRadialGradient(-m.r * 0.3, -m.r * 0.3, 0, 0, 0, m.r);
        grad.addColorStop(0, `hsl(${m.hue},70%,55%)`);
        grad.addColorStop(0.5, `hsl(${m.hue + 10},60%,35%)`);
        grad.addColorStop(1, `hsl(${m.hue},40%,18%)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        const sides = 7;
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const rr = m.r * (0.75 + ((i * 37) % 10) / 40);
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,120,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Bullets
      for (const b of g.bullets) {
        const bg2 = ctx.createLinearGradient(b.x, b.y, b.x - b.vx * 2, b.y - b.vy * 2);
        bg2.addColorStop(0, '#fff');
        bg2.addColorStop(0.3, '#93c5fd');
        bg2.addColorStop(1, 'transparent');
        ctx.strokeStyle = bg2;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
        ctx.stroke();
      }

      // Particles
      for (const p of g.particles) {
        ctx.globalAlpha = p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ship
      if (ph === 'playing' || ph === 'paused' || ph === 'over') {
        const s = g.ship;
        const blink = s.inv > 0 && Math.floor(g.t / 4) % 2 === 0;
        if (!blink || ph === 'over') {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.angle + Math.PI / 2);

          // Shield ring
          if (s.shield > 0) {
            ctx.strokeStyle = `rgba(56,189,248,${0.35 + 0.25 * Math.sin(g.t * 0.15)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(147,197,253,0.2)';
            ctx.beginPath();
            ctx.arc(0, 0, 24, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Ship body
          const body = ctx.createLinearGradient(0, -14, 0, 14);
          body.addColorStop(0, '#e0e7ff');
          body.addColorStop(0.4, '#60a5fa');
          body.addColorStop(1, '#4f46e5');
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(0, -16);
          ctx.lineTo(11, 12);
          ctx.lineTo(0, 7);
          ctx.lineTo(-11, 12);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // cockpit
          ctx.fillStyle = '#a5f3fc';
          ctx.beginPath();
          ctx.ellipse(0, -2, 3.5, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // engine glow
          if (ph === 'playing') {
            ctx.fillStyle = `rgba(251,146,60,${0.5 + 0.5 * Math.sin(g.t * 0.5)})`;
            ctx.beginPath();
            ctx.moveTo(-4, 12);
            ctx.lineTo(0, 12 + 8 + Math.random() * 6);
            ctx.lineTo(4, 12);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      // Flash
      if (g.flash > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.35})`;
        ctx.fillRect(0, 0, W, H);
      }

      // In-canvas HUD (playing)
      if (ph === 'playing') {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`WAVE ${g.wave}`, 16, 28);
        if (g.combo > 1) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = '700 14px "Space Grotesk", sans-serif';
          ctx.fillText(`${g.combo}× COMBO`, 16, 48);
        }
        if (g.slow > 0) {
          ctx.fillStyle = '#c084fc';
          ctx.font = '600 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText('TIME DILATION', W - 16, 28);
        }
      }

      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [best, burst, setPhaseBoth]);

  return (
    <>
      <title>Meteor Drift — Space Arcade Game | Stargaze</title>
      <meta name="description" content="Play Meteor Drift: a free space arcade game. Dodge meteors, collect stardust, and set a high score in the Stargaze night sky." />
      <link rel="canonical" href="https://stargaze.io/game" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}>
            <Gamepad2 size={13} className="text-orange-400" />
            <span className="text-xs font-mono text-orange-300/85 tracking-wider">ARCADE · FREE · NO ACCOUNT</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-space mb-2">
            Meteor <span className="text-gradient">Drift</span>
          </h1>
          <p className="text-white/45 text-sm max-w-lg mx-auto leading-relaxed">
            Pilot through the debris field. Blast rocks, chain combos, grab stardust — survive the night sky.
          </p>
        </motion.div>

        {/* HUD bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Star size={14} className="text-yellow-400" />
              <span className="text-sm font-mono font-bold text-white/90 tabular-nums">{score.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy size={14} className="text-amber-500/80" />
              <span className="text-xs font-mono text-white/45 tabular-nums">Best {best.toLocaleString()}</span>
            </div>
            {combo > 1 && (
              <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold font-space">
                <Zap size={12} /> {combo}×
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {hudShield > 0 && (
              <span className="text-[10px] font-mono text-sky-400">SHIELD {hudShield}</span>
            )}
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Heart
                  key={i}
                  size={14}
                  className={i < lives ? 'text-rose-400 fill-rose-400/80' : 'text-white/15'}
                />
              ))}
            </div>
            {phase === 'playing' && (
              <button
                onClick={() => setPhaseBoth('paused')}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label="Pause"
              >
                <Pause size={16} />
              </button>
            )}
            {phase === 'paused' && (
              <button
                onClick={() => setPhaseBoth('playing')}
                className="p-1.5 rounded-lg hover:bg-white/10 text-green-400 transition-colors"
                aria-label="Resume"
              >
                <Play size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Game stage */}
        <div
          ref={wrapRef}
          className="relative rounded-2xl overflow-hidden mx-auto shadow-2xl shadow-blue-500/10"
          style={{
            maxWidth: W,
            border: '1px solid rgba(255,255,255,0.1)',
            background: '#030014',
            aspectRatio: `${W}/${H}`,
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block touch-none cursor-crosshair"
            style={{ width: '100%', height: '100%' }}
            aria-label="Meteor Drift game canvas"
          />

          {/* Overlays */}
          <AnimatePresence>
            {phase === 'menu' && (
              <motion.div
                key="menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
                style={{ background: 'radial-gradient(ellipse at center, rgba(10,5,40,0.55) 0%, rgba(3,0,20,0.82) 100%)' }}
              >
                <div className="logo-mark mb-4" style={{ width: 48, height: 48, borderRadius: 14 }}>
                  <Gamepad2 size={22} className="text-white relative z-10" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-space mb-2">Meteor Drift</h2>
                <p className="text-white/45 text-sm max-w-xs mb-6 leading-relaxed">
                  WASD / arrows to fly · Space or Z to fire · P to pause
                </p>
                <button onClick={startGame} className="btn-primary text-sm px-8 py-3">
                  <Play size={15} /> Start Mission
                </button>
                {best > 0 && (
                  <p className="mt-4 text-xs font-mono text-white/35">High score · {best.toLocaleString()}</p>
                )}
                <p className="mt-6 text-[10px] text-white/25 font-mono max-w-sm">
                  Mobile: drag to steer · tap right side to fire
                </p>
              </motion.div>
            )}

            {phase === 'paused' && (
              <motion.div
                key="paused"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center"
                style={{ background: 'rgba(3,0,20,0.72)', backdropFilter: 'blur(4px)' }}
              >
                <Pause size={28} className="text-white/50 mb-3" />
                <h2 className="text-xl font-bold font-space mb-4">Paused</h2>
                <div className="flex gap-3">
                  <button onClick={() => setPhaseBoth('playing')} className="btn-primary text-xs">
                    <Play size={13} /> Resume
                  </button>
                  <button onClick={startGame} className="btn-secondary text-xs">
                    <RotateCcw size={13} /> Restart
                  </button>
                </div>
              </motion.div>
            )}

            {phase === 'over' && (
              <motion.div
                key="over"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
                style={{ background: 'radial-gradient(ellipse at center, rgba(40,10,20,0.65) 0%, rgba(3,0,20,0.88) 100%)' }}
              >
                <p className="text-xs font-mono text-orange-400/80 tracking-widest mb-2">MISSION FAILED</p>
                <h2 className="text-2xl font-bold font-space mb-1">Ship destroyed</h2>
                <p className="text-4xl font-mono font-bold text-gradient mb-1">{score.toLocaleString()}</p>
                <p className="text-xs text-white/40 mb-6">
                  {score >= best && score > 0 ? '🎉 New high score!' : `Best · ${best.toLocaleString()}`}
                </p>
                <button onClick={startGame} className="btn-primary text-sm px-8">
                  <RotateCcw size={14} /> Fly again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { title: 'Move', desc: 'WASD or arrow keys' },
            { title: 'Fire', desc: 'Space, Z, or J' },
            { title: 'Pause', desc: 'P or Escape' },
            { title: 'Powerups', desc: 'Yellow dust · Blue shield · Purple slow-mo' },
          ].map(c => (
            <div key={c.title} className="glass-card p-3 rounded-xl">
              <p className="text-[10px] font-mono text-blue-400/80 uppercase tracking-wider mb-0.5">{c.title}</p>
              <p className="text-xs text-white/45">{c.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-white/20 font-mono mt-8">
          Meteor Drift · built into Stargaze · high scores saved on this device
        </p>
      </div>
    </>
  );
}
