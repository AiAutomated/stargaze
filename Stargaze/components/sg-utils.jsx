// ─── Stargaze Shared UI Components ───────────────────────────────────────────
// Exports: Nav, Footer, ConstellationCanvas, Countdown, MonoLabel, ISSWidget, MoonWidget

const { useState, useEffect, useRef, useCallback } = React;

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      '#030010',
  surface: 'rgba(255,255,255,0.025)',
  border:  'rgba(255,255,255,0.07)',
  accent:  'var(--sg-accent, #4a8fff)',
  amber:   '#c8993a',
  text:    'rgba(255,255,255,0.9)',
  muted:   'rgba(255,255,255,0.42)',
  dim:     'rgba(255,255,255,0.12)',
};

// ─── Inject global CSS ────────────────────────────────────────────────────────
(function injectCSS() {
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
    body {
      background: #030010;
      color: rgba(255,255,255,0.9);
      font-family: 'Inter', sans-serif;
      overflow-x: hidden;
      min-height: 100vh;
    }
    :root { --sg-accent: #4a8fff; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #030010; }
    ::-webkit-scrollbar-thumb { background: rgba(74,143,255,0.3); border-radius: 2px; }

    .sg-display { font-family: 'Syne', sans-serif; }
    .sg-mono    { font-family: 'JetBrains Mono', monospace; }

    .sg-card {
      background: rgba(255,255,255,0.025);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      transition: border-color 0.2s, background 0.2s;
    }
    .sg-card:hover {
      border-color: rgba(255,255,255,0.13);
      background: rgba(255,255,255,0.04);
    }
    .sg-card-accent:hover { border-color: rgba(74,143,255,0.3); }

    .sg-btn {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;
      padding: 10px 20px; border-radius: 6px; cursor: pointer;
      transition: all 0.2s; text-decoration: none; border: none;
      white-space: nowrap;
    }
    .sg-btn-primary {
      background: var(--sg-accent, #4a8fff);
      color: #030010;
    }
    .sg-btn-primary:hover { filter: brightness(1.12); transform: translateY(-1px); }
    .sg-btn-ghost {
      background: transparent;
      color: rgba(255,255,255,0.6);
      border: 1px solid rgba(255,255,255,0.12);
    }
    .sg-btn-ghost:hover { border-color: rgba(255,255,255,0.28); color: rgba(255,255,255,0.9); }

    .sg-divider { height: 1px; background: rgba(255,255,255,0.06); }

    .sg-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-family: 'JetBrains Mono', monospace; font-size: 9px;
      font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;
      padding: 3px 8px; border-radius: 4px;
    }
    .sg-badge-active   { background: rgba(74,222,128,0.1);  color: #4ade80; border: 1px solid rgba(74,222,128,0.2); }
    .sg-badge-upcoming { background: rgba(74,143,255,0.1); color: #4a8fff; border: 1px solid rgba(74,143,255,0.2); }
    .sg-badge-past     { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.06); }

    .sg-live-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.7);
      animation: sg-pulse 2s ease-in-out infinite; display: inline-block;
    }
    @keyframes sg-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.7);opacity:0.5} }

    @keyframes sg-fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    .sg-fade-up { animation: sg-fade-up 0.5s ease forwards; }

    .sg-nav-link {
      font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500;
      letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none;
      color: rgba(255,255,255,0.45); padding: 7px 14px; border-radius: 5px;
      transition: color 0.2s, background 0.2s; cursor: pointer; background: none; border: none;
    }
    .sg-nav-link:hover { color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.05); }
    .sg-nav-link.active { color: rgba(255,255,255,0.9); background: rgba(74,143,255,0.12); }

    .sg-input {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 6px; color: white;
      padding: 8px 12px;
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      outline: none; transition: border-color 0.2s;
    }
    .sg-input:focus { border-color: rgba(74,143,255,0.5); }
    .sg-input option { background: #0a0620; }

    /* Tweaks panel */
    #sg-tweaks {
      position: fixed; bottom: 24px; right: 24px; z-index: 1000;
      width: 220px; background: rgba(8,4,20,0.97);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
      padding: 16px; display: none; flex-direction: column; gap: 14px;
    }
    #sg-tweaks.open { display: flex; }
    .sg-tweak-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
    .sg-tweak-opts { display: flex; gap: 6px; flex-wrap: wrap; }
    .sg-tweak-opt {
      padding: 5px 10px; border-radius: 5px; font-family: 'JetBrains Mono', monospace; font-size: 10px;
      cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: transparent;
      color: rgba(255,255,255,0.5); transition: all 0.15s;
    }
    .sg-tweak-opt.sel, .sg-tweak-opt:hover { border-color: var(--sg-accent); color: var(--sg-accent); background: rgba(74,143,255,0.08); }
  `;
  document.head.appendChild(style);
})();

// ─── Mono Label ───────────────────────────────────────────────────────────────
function MonoLabel({ children, style }) {
  return (
    <span className="sg-mono" style={{
      fontSize: 10, fontWeight: 500, letterSpacing: '0.22em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)',
      ...style
    }}>{children}</span>
  );
}

// ─── Constellation Canvas (Hero BG) ───────────────────────────────────────────
function ConstellationCanvas({ showNames = true }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    // Seeded PRNG
    let seed = 31337;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Ambient stars
    const STARS = Array.from({ length: 140 }, () => ({
      fx: rand(), fy: rand(),
      r: rand() * 1.4 + 0.25,
      alpha: rand() * 0.35 + 0.08,
      phase: rand() * Math.PI * 2,
      speed: rand() * 0.012 + 0.004,
    }));

    // Named constellations (fractional coords)
    const CONSTS = [
      {
        name: 'Orion', nameAt: [0.155, 0.165],
        pts: [[0.10,0.28],[0.14,0.36],[0.19,0.33],[0.22,0.26],[0.17,0.20],[0.13,0.22],[0.16,0.45],[0.20,0.46]],
        edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,6],[2,7],[6,7]],
      },
      {
        name: 'Ursa Major', nameAt: [0.79, 0.09],
        pts: [[0.72,0.16],[0.77,0.13],[0.82,0.15],[0.86,0.19],[0.84,0.25],[0.79,0.26],[0.75,0.23]],
        edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]],
      },
      {
        name: 'Cassiopeia', nameAt: [0.515, 0.055],
        pts: [[0.43,0.09],[0.48,0.13],[0.53,0.08],[0.58,0.13],[0.62,0.09]],
        edges: [[0,1],[1,2],[2,3],[3,4]],
      },
      {
        name: 'Scorpius', nameAt: [0.66, 0.62],
        pts: [[0.62,0.55],[0.66,0.59],[0.69,0.64],[0.72,0.68],[0.70,0.73],[0.66,0.75],[0.63,0.73]],
        edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]],
      },
    ];

    // Flatten constellation points for quick lookup
    const constPts = [];
    CONSTS.forEach((c, ci) => c.pts.forEach((p, si) => constPts.push({ fx: p[0], fy: p[1], ci, si, r: 1.6 + rand() * 0.6, alpha: 0.55 + rand() * 0.35 })));

    let t = 0;
    const draw = () => {
      t += 0.008;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const mx = mouseRef.current.x * W;
      const my = mouseRef.current.y * H;

      // Ambient stars
      STARS.forEach(s => {
        const sx = s.fx * W, sy = s.fy * H;
        const alpha = s.alpha + Math.sin(t * s.speed * 60 + s.phase) * 0.08;
        const dist = Math.hypot(sx - mx, sy - my);
        const boost = Math.max(0, 1 - dist / 180) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r + boost * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,215,255,${Math.min(0.9, alpha + boost)})`;
        ctx.fill();
      });

      // Constellation edges
      CONSTS.forEach((c, ci) => {
        const off = constPts.findIndex(p => p.ci === ci);
        c.edges.forEach(([a, b]) => {
          const pa = constPts[off + a], pb = constPts[off + b];
          const ax = pa.fx * W, ay = pa.fy * H;
          const bx = pb.fx * W, by = pb.fy * H;
          const midx = (ax + bx) / 2, midy = (ay + by) / 2;
          const dist = Math.hypot(midx - mx, midy - my);
          const alpha = 0.06 + Math.max(0, 1 - dist / 200) * 0.28;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          ctx.strokeStyle = `rgba(74,143,255,${alpha})`; ctx.lineWidth = 0.6; ctx.stroke();
        });
        // Name label
        if (showNames) {
          const nx = c.nameAt[0] * W, ny = c.nameAt[1] * H;
          const dist = Math.hypot(nx - mx, ny - my);
          const alpha = 0.12 + Math.max(0, 1 - dist / 200) * 0.35;
          ctx.fillStyle = `rgba(74,143,255,${alpha})`;
          ctx.font = '8.5px JetBrains Mono, monospace';
          ctx.fillText(c.name.toUpperCase(), nx, ny);
        }
      });

      // Constellation stars
      constPts.forEach(s => {
        const sx = s.fx * W, sy = s.fy * H;
        const dist = Math.hypot(sx - mx, sy - my);
        const boost = Math.max(0, 1 - dist / 160) * 0.7;
        if (boost > 0.05) {
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14 + boost * 12);
          g.addColorStop(0, `rgba(74,143,255,${boost * 0.35})`);
          g.addColorStop(1, 'transparent');
          ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI * 2);
          ctx.fillStyle = g; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(sx, sy, s.r + boost * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,210,255,${Math.min(1, s.alpha + boost)})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    const onMove = e => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: (e.clientX - rect.left) / W, y: (e.clientY - rect.top) / H };
    };
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [showNames]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ targetDate }) {
  const [cd, setCd] = useState(() => SG.formatCountdown(new Date(targetDate) - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setCd(SG.formatCountdown(new Date(targetDate) - Date.now())), 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  const units = [['days', cd.days], ['hrs', cd.hours], ['min', cd.mins], ['sec', cd.secs]];
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      {units.map(([label, val]) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <div className="sg-mono" style={{
            fontSize: 'clamp(1.6rem, 4vw, 2.8rem)', fontWeight: 700, lineHeight: 1,
            color: 'white', letterSpacing: '-0.02em',
            padding: '10px 14px', minWidth: 60,
            background: 'rgba(74,143,255,0.08)', border: '1px solid rgba(74,143,255,0.15)',
            borderRadius: 8,
          }}>{val}</div>
          <div className="sg-mono" style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.28)', marginTop: 6, textTransform: 'uppercase' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ page, navigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { id: '/',         label: 'Home'     },
    { id: '/calendar', label: 'Calendar' },
    { id: '/live',     label: 'Live'     },
    { id: '/globe',    label: 'Globe'    },
    { id: '/about',    label: 'About'    },
  ];

  const go = (id) => { navigate(id); setMobileOpen(false); };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      padding: scrolled ? '10px 0' : '18px 0',
      background: scrolled ? 'rgba(3,0,16,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
      transition: 'all 0.3s',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <button onClick={() => go('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="10" stroke="rgba(74,143,255,0.6)" strokeWidth="1"/>
            <circle cx="11" cy="11" r="3" fill="#4a8fff"/>
            <circle cx="11" cy="4"  r="1.2" fill="rgba(255,255,255,0.7)"/>
            <circle cx="18" cy="8"  r="0.8" fill="rgba(255,255,255,0.5)"/>
            <circle cx="4"  cy="8"  r="0.8" fill="rgba(255,255,255,0.5)"/>
          </svg>
          <span className="sg-display" style={{ fontSize: 15, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>Stargaze</span>
        </button>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {links.map(l => (
            <button key={l.id} className={`sg-nav-link${page === l.id ? ' active' : ''}`} onClick={() => go(l.id)}>{l.label}</button>
          ))}
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(o => !o)} style={{ display: 'none', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4 }} id="sg-mobile-toggle">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {mobileOpen ? <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/> : <><rect y="4" width="20" height="1.5" rx="1"/><rect y="9" width="20" height="1.5" rx="1"/><rect y="14" width="20" height="1.5" rx="1"/></>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ background: 'rgba(3,0,16,0.97)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 24px' }}>
          {links.map(l => (
            <button key={l.id} className={`sg-nav-link${page === l.id ? ' active' : ''}`} onClick={() => go(l.id)} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}>{l.label}</button>
          ))}
        </div>
      )}
    </nav>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ navigate }) {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 80, padding: '48px 0 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, marginBottom: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" stroke="rgba(74,143,255,0.5)" strokeWidth="1"/><circle cx="11" cy="11" r="3" fill="#4a8fff"/></svg>
              <span className="sg-display" style={{ fontSize: 13, fontWeight: 700 }}>Stargaze</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', lineHeight: 1.7 }}>Free, real-time celestial event tracking for everyone.</p>
          </div>
          <div>
            <MonoLabel style={{ display: 'block', marginBottom: 12 }}>Explore</MonoLabel>
            {[['/', 'Home'], ['/calendar', 'Calendar'], ['/live', 'Live Feed'], ['/globe', '3D Globe']].map(([id, label]) => (
              <button key={id} onClick={() => navigate(id)} style={{ display: 'block', background: 'none', border: 'none', color: 'rgba(255,255,255,0.32)', fontSize: 12, cursor: 'pointer', marginBottom: 8, textAlign: 'left', padding: 0, transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.7)'}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.32)'}
              >{label}</button>
            ))}
          </div>
          <div>
            <MonoLabel style={{ display: 'block', marginBottom: 12 }}>Data Sources</MonoLabel>
            {[['https://www.imo.net', 'IMO'], ['https://api.nasa.gov', 'NASA API'], ['https://celestrak.org', 'CelesTrak']].map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'rgba(255,255,255,0.32)', fontSize: 12, marginBottom: 8, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.7)'}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.32)'}
              >{label}</a>
            ))}
          </div>
        </div>
        <div className="sg-divider" />
        <div style={{ paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <MonoLabel>© {new Date().getFullYear()} Stargaze</MonoLabel>
          <MonoLabel>Data: IMO · NASA · Open-Meteo · CelesTrak</MonoLabel>
        </div>
      </div>
    </footer>
  );
}

// ─── ISS Widget ───────────────────────────────────────────────────────────────
function ISSWidget() {
  const [iss, setIss] = useState(null);
  const [err, setErr] = useState(false);
  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      const d = await r.json();
      setIss({ lat: +d.latitude.toFixed(2), lng: +d.longitude.toFixed(2), alt: Math.round(d.altitude), vel: Math.round(d.velocity) });
      setErr(false);
    } catch { setErr(true); }
  }, []);
  useEffect(() => { fetch_(); const id = setInterval(fetch_, 5000); return () => clearInterval(id); }, [fetch_]);

  return (
    <div className="sg-card sg-card-accent" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <MonoLabel>ISS Live Position</MonoLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="sg-live-dot" />
          <span className="sg-mono" style={{ fontSize: 9, color: '#4ade80', letterSpacing: '0.15em' }}>LIVE</span>
        </div>
      </div>
      {err ? (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Connection unavailable</p>
      ) : iss ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['Latitude', `${iss.lat}°`], ['Longitude', `${iss.lng}°`], ['Altitude', `${iss.alt} km`], ['Velocity', `${iss.vel} km/h`]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{k}</div>
              <div className="sg-mono" style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>{v}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
          {[1,2].map(i => <div key={i} style={{ height: 32, background: 'rgba(255,255,255,0.04)', borderRadius: 6, animation: 'sg-pulse 1.5s ease infinite' }} />)}
        </div>
      )}
    </div>
  );
}

// ─── Moon Widget ──────────────────────────────────────────────────────────────
function MoonWidget() {
  const { phase, illumination, symbol } = SG.getMoonPhase();
  const pct = illumination;
  return (
    <div className="sg-card" style={{ padding: 24 }}>
      <MonoLabel style={{ display: 'block', marginBottom: 18 }}>Moon Phase</MonoLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ fontSize: 52, lineHeight: 1, color: 'rgba(255,255,255,0.85)', fontFamily: 'serif' }}>
          {symbol === '○' ? '○' : symbol === '●' ? '●' : symbol}
        </div>
        <div>
          <div className="sg-display" style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>{phase}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', width: 80 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(255,255,255,0.6)', borderRadius: 2, transition: 'width 1s' }} />
            </div>
            <span className="sg-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tweaks Panel ─────────────────────────────────────────────────────────────
function TweaksPanel({ tweaks, setTweaks }) {
  const ACCENTS = [
    { label: 'Blue',  value: '#4a8fff' },
    { label: 'Teal',  value: '#2dd4bf' },
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Violet','value': '#a78bfa' },
  ];

  useEffect(() => {
    document.documentElement.style.setProperty('--sg-accent', tweaks.accent);
  }, [tweaks.accent]);

  return (
    <div id="sg-tweaks" className="open" style={{ display: 'flex' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="sg-mono" style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.5)' }}>TWEAKS</span>
      </div>
      <div>
        <div className="sg-tweak-label">Accent Color</div>
        <div className="sg-tweak-opts">
          {ACCENTS.map(a => (
            <button key={a.value} className={`sg-tweak-opt${tweaks.accent === a.value ? ' sel' : ''}`}
              style={tweaks.accent === a.value ? { borderColor: a.value, color: a.value } : {}}
              onClick={() => setTweaks(t => ({ ...t, accent: a.value }))}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="sg-tweak-label">Constellation Names</div>
        <div className="sg-tweak-opts">
          {['Show', 'Hide'].map(v => (
            <button key={v} className={`sg-tweak-opt${(tweaks.showNames ? 'Show' : 'Hide') === v ? ' sel' : ''}`}
              onClick={() => setTweaks(t => ({ ...t, showNames: v === 'Show' }))}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="sg-tweak-label">Star Density</div>
        <div className="sg-tweak-opts">
          {['Normal', 'Dense'].map(v => (
            <button key={v} className={`sg-tweak-opt${tweaks.density === v ? ' sel' : ''}`}
              onClick={() => setTweaks(t => ({ ...t, density: v }))}>
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MonoLabel, ConstellationCanvas, Countdown, Nav, Footer, ISSWidget, MoonWidget, TweaksPanel, T });
