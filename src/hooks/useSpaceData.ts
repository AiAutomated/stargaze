import { useState, useEffect } from 'react';

const NASA_KEY = '0oMQ3t0Hfqwtanhhg9gIccTe5PHmZjjt6hi48Dmp';

// ─── Cache helpers ────────────────────────────────────────────────────────────
function cGet(key: string, ttl: number): any | null {
  try {
    const d = JSON.parse(localStorage.getItem('sg_' + key) || 'null');
    if (d && d._ts && Date.now() - d._ts < ttl) return d.v;
  } catch {}
  return null;
}
function cSet(key: string, v: any) {
  try { localStorage.setItem('sg_' + key, JSON.stringify({ _ts: Date.now(), v })); } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface KpPoint  { time: string; kp: number }
export interface Fireball { date: string; energy?: string; impact_e?: string; lat?: string; lon?: string; lat_dir?: string; lon_dir?: string; alt?: string; vel?: string }
export interface Asteroid { des: string; fullname?: string; cd: string; dist: string; v_rel: string; h: string }
export interface EpicImg  { date: string; url: string }
export interface MarsSnap { src: string; camera: string; earthDate: string; sol: number }

export interface SpaceData {
  kpNow:     number | null
  kpHistory: KpPoint[]
  kpStatus:  'quiet' | 'unsettled' | 'active' | 'storm-minor' | 'storm-major'
  kpLabel:   string
  kpColor:   string
  auroraLat: string
  fireballs: Fireball[]
  asteroids: Asteroid[]
  epicImg:   EpicImg | null
  marsSnap:  MarsSnap | null
  loading:   boolean
}

// ─── Kp metadata ─────────────────────────────────────────────────────────────
function kpMeta(kp: number): { status: SpaceData['kpStatus']; label: string; color: string; aurora: string } {
  if (kp < 2)  return { status: 'quiet',       label: 'Quiet',           color: '#4ade80', aurora: 'Not visible (need 65°+ N with dark skies)' }
  if (kp < 3)  return { status: 'quiet',       label: 'Quiet',           color: '#4ade80', aurora: 'Faint arc possible at 60°+ N' }
  if (kp < 4)  return { status: 'unsettled',   label: 'Unsettled',       color: '#a3e635', aurora: 'Visible at 60°+ N' }
  if (kp < 5)  return { status: 'active',      label: 'Active',          color: '#fbbf24', aurora: 'Visible at 55°+ N' }
  if (kp < 6)  return { status: 'storm-minor', label: 'G1 Minor Storm',  color: '#f97316', aurora: 'Visible at 50°+ N — check outside!' }
  if (kp < 7)  return { status: 'storm-minor', label: 'G2 Storm',        color: '#ef4444', aurora: 'Visible at 45°+ N — go outside now!' }
  return              { status: 'storm-major', label: 'G3+ Major Storm',  color: '#dc2626', aurora: 'Visible from mid-latitudes — go outside NOW!' }
}

// ─── Utility: estimate asteroid size from H magnitude ────────────────────────
export function asteroidSize(h: number): string {
  const km = 3432 * Math.pow(10, -h / 5);
  if (km >= 1) return `~${km.toFixed(1)} km`;
  return `~${Math.round(km * 1000)} m`;
}

// ─── Utility: convert AU to lunar distances ───────────────────────────────────
export function auToLD(au: number): string {
  const ld = au * 389.17;
  if (ld < 1) return `${(ld * 384400).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} km`;
  return `${ld.toFixed(1)} LD`;
}

// ─── Utility: fireball energy label ─────────────────────────────────────────
export function fireballEnergy(fb: Fireball): string {
  if (fb.impact_e) {
    const kt = parseFloat(fb.impact_e);
    if (kt >= 1000) return `${(kt / 1000).toFixed(1)} Mt`;
    return `${kt.toFixed(1)} kt`;
  }
  if (fb.energy) return `${parseFloat(fb.energy).toFixed(0)} GJ`;
  return 'Unknown';
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useSpaceData(): SpaceData {
  const [kpNow,    setKpNow]   = useState<number | null>(null);
  const [kpHistory,setKpH]     = useState<KpPoint[]>([]);
  const [fireballs,setFballs]  = useState<Fireball[]>([]);
  const [asteroids,setAst]     = useState<Asteroid[]>([]);
  const [epicImg,  setEpic]    = useState<EpicImg | null>(null);
  const [marsSnap, setMars]    = useState<MarsSnap | null>(null);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // ── NOAA Kp index (3-hour intervals, 5-min refresh) ──────────────────────
    async function loadKp() {
      const cached = cGet('kp', 5 * 60_000);
      if (cached) { if (alive) { setKpNow(cached.now); setKpH(cached.history); } return; }
      try {
        const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        if (!r.ok) return;
        const raw: [string, string, string, string][] = await r.json();
        // First row is header; rest are [time_tag, kp, a_running, station_count]
        const pts: KpPoint[] = raw.slice(1)
          .map(row => ({ time: row[0], kp: parseFloat(row[1]) }))
          .filter(p => !isNaN(p.kp))
          .slice(-24); // last 24 × 3h = 72h
        const now = pts[pts.length - 1]?.kp ?? null;
        if (alive) { setKpNow(now); setKpH(pts); }
        cSet('kp', { now, history: pts });
      } catch {}
    }

    // ── JPL Fireball API (government-confirmed, 1h cache) ────────────────────
    async function loadFireballs() {
      const cached = cGet('fireballs', 60 * 60_000);
      if (cached) { if (alive) setFballs(cached); return; }
      try {
        const r = await fetch('https://ssd-api.jpl.nasa.gov/fireball.api?limit=20');
        if (!r.ok) return;
        const d = await r.json();
        const fields: string[] = d.fields ?? [];
        const events: Fireball[] = (d.data ?? []).map((row: (string | null)[]) => {
          const obj: any = {};
          fields.forEach((f, i) => { if (row[i] != null) obj[f.replace('-','_')] = row[i]; });
          return obj as Fireball;
        });
        if (alive) setFballs(events);
        cSet('fireballs', events);
      } catch {}
    }

    // ── JPL Close Approach: next 7 days, within 0.05 AU (1h cache) ───────────
    async function loadAsteroids() {
      const cached = cGet('asteroids', 60 * 60_000);
      if (cached) { if (alive) setAst(cached); return; }
      try {
        const today = new Date().toISOString().slice(0, 10);
        const plus7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const url = `https://ssd-api.jpl.nasa.gov/cad.api?date-min=${today}&date-max=${plus7}&dist-max=0.05&sort=dist&limit=10&fullname=true`;
        const r = await fetch(url);
        if (!r.ok) return;
        const d = await r.json();
        const fields: string[] = d.fields ?? [];
        const items: Asteroid[] = (d.data ?? []).map((row: (string | null)[]) => {
          const obj: any = {};
          fields.forEach((f, i) => { if (row[i] != null) obj[f] = row[i]; });
          return obj as Asteroid;
        });
        if (alive) setAst(items);
        cSet('asteroids', items);
      } catch {}
    }

    // ── NASA EPIC: latest Earth image from DSCOVR (3h cache) ─────────────────
    async function loadEPIC() {
      const cached = cGet('epic', 3 * 60 * 60_000);
      if (cached) { if (alive) setEpic(cached); return; }
      try {
        const r = await fetch(`https://api.nasa.gov/EPIC/api/natural/images?api_key=${NASA_KEY}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!Array.isArray(d) || d.length === 0) return;
        const img = d[0];
        const datePath = img.date.split(' ')[0].replace(/-/g, '/');
        const url = `https://api.nasa.gov/EPIC/archive/natural/${datePath}/png/${img.image}.png?api_key=${NASA_KEY}`;
        const epic: EpicImg = { date: img.date, url };
        if (alive) setEpic(epic);
        cSet('epic', epic);
      } catch {}
    }

    // ── NASA Mars Curiosity rover: latest photos (6h cache) ──────────────────
    async function loadMars() {
      const cached = cGet('mars', 6 * 60 * 60_000);
      if (cached) { if (alive) setMars(cached); return; }
      try {
        const r = await fetch(`https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/latest_photos?api_key=${NASA_KEY}`);
        if (!r.ok) return;
        const d = await r.json();
        const photos: any[] = d.latest_photos ?? [];
        // Prefer scenic cameras
        const preferred = ['MAST', 'NAVCAM', 'MASTL', 'MARDI'];
        const photo = photos.find(p => preferred.includes(p.camera?.name)) ?? photos[0];
        if (!photo) return;
        const snap: MarsSnap = {
          src: photo.img_src,
          camera: photo.camera?.full_name ?? 'Unknown Camera',
          earthDate: photo.earth_date,
          sol: photo.sol,
        };
        if (alive) setMars(snap);
        cSet('mars', snap);
      } catch {}
    }

    // Load everything in parallel
    Promise.all([loadKp(), loadFireballs(), loadAsteroids(), loadEPIC(), loadMars()])
      .finally(() => { if (alive) setLoading(false); });

    // Refresh Kp every 5 minutes
    const kpTimer = setInterval(loadKp, 5 * 60_000);
    return () => { alive = false; clearInterval(kpTimer); };
  }, []);

  const meta = kpNow !== null
    ? kpMeta(kpNow)
    : { status: 'quiet' as const, label: 'Loading...', color: '#4ade80', aurora: '' };

  return {
    kpNow, kpHistory, fireballs, asteroids, epicImg, marsSnap, loading,
    kpStatus: meta.status, kpLabel: meta.label, kpColor: meta.color, auroraLat: meta.aurora,
  };
}
