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
export interface KpPoint    { time: string; kp: number }
export interface Fireball   { date: string; energy?: string; impact_e?: string; lat?: string; lon?: string; lat_dir?: string; lon_dir?: string; alt?: string; vel?: string }
export interface Asteroid   { des: string; fullname?: string; cd: string; dist: string; v_rel: string; h: string }
export interface EpicImg    { date: string; url: string }
export interface MarsSnap   { src: string; camera: string; earthDate: string; sol: number }
export interface NewsArticle { id: number; title: string; url: string; image_url: string; news_site: string; summary: string; published_at: string }
export interface SolarFlare  { flrID: string; beginTime: string; peakTime: string; endTime?: string; classType: string; sourceLocation?: string; activeRegionNum?: number }
export interface CMEEvent    { activityID: string; startTime: string; cmeAnalyses?: Array<{ speed?: number; type?: string }> }

export interface SpaceData {
  kpNow:      number | null
  kpHistory:  KpPoint[]
  kpStatus:   'quiet' | 'unsettled' | 'active' | 'storm-minor' | 'storm-major'
  kpLabel:    string
  kpColor:    string
  auroraLat:  string
  fireballs:  Fireball[]
  asteroids:  Asteroid[]
  epicImg:    EpicImg | null
  marsSnap:   MarsSnap | null
  news:       NewsArticle[]
  flares:     SolarFlare[]
  cmes:       CMEEvent[]
  loading:    boolean
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

// ─── Utilities ───────────────────────────────────────────────────────────────
export function asteroidSize(h: number): string {
  const km = 3432 * Math.pow(10, -h / 5);
  if (km >= 1) return `~${km.toFixed(1)} km`;
  return `~${Math.round(km * 1000)} m`;
}
export function auToLD(au: number): string {
  const ld = au * 389.17;
  if (ld < 1) return `${(ld * 384400).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} km`;
  return `${ld.toFixed(1)} LD`;
}
export function fireballEnergy(fb: Fireball): string {
  if (fb.impact_e) {
    const kt = parseFloat(fb.impact_e);
    if (kt >= 1000) return `${(kt / 1000).toFixed(1)} Mt`;
    return `${kt.toFixed(1)} kt`;
  }
  if (fb.energy) return `${parseFloat(fb.energy).toFixed(0)} GJ`;
  return 'Unknown';
}
export function flareClass(classType: string): { color: string; label: string } {
  const cls = classType?.[0]?.toUpperCase() ?? 'A';
  if (cls === 'X') return { color: '#dc2626', label: 'X-class (Extreme)' };
  if (cls === 'M') return { color: '#f97316', label: 'M-class (Strong)' };
  if (cls === 'C') return { color: '#fbbf24', label: 'C-class (Moderate)' };
  return { color: '#4ade80', label: 'A/B-class (Weak)' };
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useSpaceData(): SpaceData {
  const [kpNow,    setKpNow]   = useState<number | null>(null);
  const [kpHistory,setKpH]     = useState<KpPoint[]>([]);
  const [fireballs,setFballs]  = useState<Fireball[]>([]);
  const [asteroids,setAst]     = useState<Asteroid[]>([]);
  const [epicImg,  setEpic]    = useState<EpicImg | null>(null);
  const [marsSnap, setMars]    = useState<MarsSnap | null>(null);
  const [news,     setNews]    = useState<NewsArticle[]>([]);
  const [flares,   setFlares]  = useState<SolarFlare[]>([]);
  const [cmes,     setCmes]    = useState<CMEEvent[]>([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // ── NOAA Kp index (3-hour intervals, 5-min refresh) ──────────────────────
    // NOTE: NOAA changed this product from array-of-arrays to array-of-objects
    // ({time_tag, Kp, a_running, station_count}) — handle both formats.
    async function loadKp() {
      const cached = cGet('kp', 5 * 60_000);
      if (cached && cached.now !== null && cached.history?.length) {
        if (alive) { setKpNow(cached.now); setKpH(cached.history); }
        return;
      }
      try {
        const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        if (!r.ok) return;
        const raw: any[] = await r.json();
        let pts: KpPoint[] = [];
        if (Array.isArray(raw) && raw.length > 0) {
          if (Array.isArray(raw[0])) {
            // legacy format: [["time_tag","Kp",...], ["2026-07-12 09:00:00","3.67",...], ...]
            pts = raw.slice(1).map(row => ({ time: String(row[0]), kp: parseFloat(row[1]) }));
          } else {
            // current format: [{time_tag: "2026-07-12T09:00:00", Kp: 3.67, ...}, ...]
            pts = raw.map(row => ({
              time: String(row.time_tag ?? row.timeTag ?? ''),
              kp: parseFloat(row.Kp ?? row.kp ?? row.kp_index),
            }));
          }
        }
        pts = pts.filter(p => !isNaN(p.kp)).slice(-24);
        const now = pts[pts.length - 1]?.kp ?? null;
        if (now === null) return; // don't cache an empty result
        if (alive) { setKpNow(now); setKpH(pts); }
        cSet('kp', { now, history: pts });
      } catch {}
    }

    // ── JPL Fireball API (1h cache) ──────────────────────────────────────────
    // NOTE: ssd-api.jpl.nasa.gov stopped sending CORS headers to browsers —
    // try direct first (in case it returns), then fall back to a CORS proxy.
    async function loadFireballs() {
      const cached = cGet('fireballs', 60 * 60_000);
      if (cached) { if (alive) setFballs(cached); return; }
      try {
        const direct = 'https://ssd-api.jpl.nasa.gov/fireball.api?limit=20';
        let r = await fetch(direct).catch(() => null);
        if (!r || !r.ok) {
          r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(direct));
        }
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

    // ── Close approaches: NASA NeoWs feed, next 7 days, within 0.05 AU ───────
    // NOTE: JPL cad.api stopped sending CORS headers — NeoWs (api.nasa.gov)
    // provides the same data with CORS enabled. Mapped to the old shape.
    async function loadAsteroids() {
      const cached = cGet('asteroids', 60 * 60_000);
      if (cached) { if (alive) setAst(cached); return; }
      try {
        const today = new Date().toISOString().slice(0, 10);
        const plus6 = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10); // NeoWs max range = 7 days
        const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${plus6}&api_key=${NASA_KEY}`;
        const r = await fetch(url);
        if (!r.ok) return;
        const d = await r.json();
        const neos: any[] = Object.values(d.near_earth_objects ?? {}).flat();
        const items: Asteroid[] = neos
          .map((n: any) => {
            const ca = n.close_approach_data?.[0];
            if (!ca) return null;
            return {
              des: String(n.name ?? '').replace(/[()]/g, ''),
              fullname: n.name,
              cd: new Date(ca.epoch_date_close_approach).toISOString(),
              dist: String(ca.miss_distance?.astronomical ?? ''),
              v_rel: String(ca.relative_velocity?.kilometers_per_second ?? ''),
              h: String(n.absolute_magnitude_h ?? ''),
            } as Asteroid;
          })
          .filter((a): a is Asteroid => a !== null && parseFloat(a.dist) <= 0.05)
          .sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist))
          .slice(0, 10);
        if (alive) setAst(items);
        cSet('asteroids', items);
      } catch {}
    }

    // ── NASA EPIC: latest Earth image from DSCOVR (3h cache) ─────────────────
    // NOTE: the api.nasa.gov EPIC mirror now 404s — use the canonical
    // epic.gsfc.nasa.gov service (CORS enabled, no key required).
    async function loadEPIC() {
      const cached = cGet('epic', 3 * 60 * 60_000);
      if (cached) { if (alive) setEpic(cached); return; }
      try {
        const r = await fetch('https://epic.gsfc.nasa.gov/api/natural');
        if (!r.ok) return;
        const d = await r.json();
        if (!Array.isArray(d) || d.length === 0) return;
        const img = d[d.length - 1]; // most recent capture
        const datePath = img.date.split(' ')[0].replace(/-/g, '/');
        const url = `https://epic.gsfc.nasa.gov/archive/natural/${datePath}/png/${img.image}.png`;
        const epic: EpicImg = { date: img.date, url };
        if (alive) setEpic(epic);
        cSet('epic', epic);
      } catch {}
    }

    // ── NASA Mars Curiosity rover: latest photos (6h cache) ──────────────────
    // NOTE: the mars-photos API on api.nasa.gov now 404s. Try it first in case
    // it returns, then fall back to the NASA Image Library (sol unknown → -1).
    async function loadMars() {
      const cached = cGet('mars', 6 * 60 * 60_000);
      if (cached) { if (alive) setMars(cached); return; }
      try {
        const r = await fetch(`https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/latest_photos?api_key=${NASA_KEY}`).catch(() => null);
        if (r && r.ok) {
          const d = await r.json();
          const photos: any[] = d.latest_photos ?? [];
          const preferred = ['MAST', 'NAVCAM', 'MASTL', 'MARDI'];
          const photo = photos.find(p => preferred.includes(p.camera?.name)) ?? photos[0];
          if (photo) {
            const snap: MarsSnap = {
              src: photo.img_src,
              camera: photo.camera?.full_name ?? 'Unknown Camera',
              earthDate: photo.earth_date,
              sol: photo.sol,
            };
            if (alive) setMars(snap);
            cSet('mars', snap);
            return;
          }
        }
        // Fallback: most recent Curiosity surface image from the NASA Image Library
        const lib = await fetch('https://images-api.nasa.gov/search?q=curiosity%20rover%20mars%20surface&media_type=image&year_start=2024&page_size=10');
        if (!lib.ok) return;
        const ld = await lib.json();
        const items: any[] = ld.collection?.items ?? [];
        const item = items.find(i => i.links?.[0]?.href && i.data?.[0]);
        if (!item) return;
        const snap: MarsSnap = {
          src: item.links[0].href,
          camera: item.data[0].title ?? 'Curiosity',
          earthDate: item.data[0].date_created ?? new Date().toISOString(),
          sol: -1, // unknown from the image library
        };
        if (alive) setMars(snap);
        cSet('mars', snap);
      } catch {}
    }

    // ── SpaceflightNews API (15-min cache) ───────────────────────────────────
    async function loadNews() {
      const cached = cGet('news', 15 * 60_000);
      if (cached) { if (alive) setNews(cached); return; }
      try {
        const r = await fetch('https://api.spaceflightnewsapi.net/v4/articles/?limit=12&ordering=-published_at');
        if (!r.ok) return;
        const d = await r.json();
        const articles: NewsArticle[] = d.results ?? [];
        if (alive) setNews(articles);
        cSet('news', articles);
      } catch {}
    }

    // ── NASA DONKI: solar flares + CMEs (1h cache) ───────────────────────────
    async function loadDONKI() {
      const cached = cGet('donki', 60 * 60_000);
      if (cached) { if (alive) { setFlares(cached.flares); setCmes(cached.cmes); } return; }
      try {
        const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const [fRes, cRes] = await Promise.all([
          fetch(`https://api.nasa.gov/DONKI/FLR?startDate=${start}&api_key=${NASA_KEY}`),
          fetch(`https://api.nasa.gov/DONKI/CME?startDate=${start}&api_key=${NASA_KEY}`),
        ]);
        const flaresRaw: SolarFlare[] = fRes.ok ? await fRes.json() : [];
        const cmesRaw:   CMEEvent[]   = cRes.ok ? await cRes.json() : [];
        // reverse ONCE into new arrays — .reverse() is in-place, so calling it
        // twice on the same array (old bug) un-reversed the cached copy
        const flares = [...flaresRaw].reverse();
        const cmes = [...cmesRaw].reverse();
        if (alive) { setFlares(flares); setCmes(cmes); }
        cSet('donki', { flares, cmes });
      } catch {}
    }

    // Load all in parallel
    Promise.all([loadKp(), loadFireballs(), loadAsteroids(), loadEPIC(), loadMars(), loadNews(), loadDONKI()])
      .finally(() => { if (alive) setLoading(false); });

    const kpTimer = setInterval(loadKp, 5 * 60_000);
    return () => { alive = false; clearInterval(kpTimer); };
  }, []);

  const meta = kpNow !== null
    ? kpMeta(kpNow)
    : { status: 'quiet' as const, label: 'Loading...', color: '#4ade80', aurora: '' };

  return {
    kpNow, kpHistory, fireballs, asteroids, epicImg, marsSnap,
    news, flares, cmes, loading,
    kpStatus: meta.status, kpLabel: meta.label, kpColor: meta.color, auroraLat: meta.aurora,
  };
}
