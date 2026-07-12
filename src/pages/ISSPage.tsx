import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { MapPin, Navigation, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import * as satellite from 'satellite.js';
import ISSGroundTrack from '../components/ISSGroundTrack';

interface ISSPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  timestamp: number;
}

interface Pass {
  start:      Date;
  maxEl:      number;
  maxElTime:  Date;
  end:        Date;
  duration:   number; // minutes
}

interface TLE { line1: string; line2: string }

function useISSPosition() {
  const [pos, setPos] = useState<ISSPosition | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      if (r.ok) setPos(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  return { pos, loading, refresh };
}

async function fetchTLE(): Promise<TLE | null> {
  try {
    const r = await fetch('https://celestrak.org/satcat/tle.php?CATNR=25544&FORMAT=TLE');
    if (!r.ok) return null;
    const text = await r.text();
    const lines = text.trim().split('\n').map(l => l.trim());
    const l1 = lines.find(l => l.startsWith('1 25544'));
    const l2 = lines.find(l => l.startsWith('2 25544'));
    if (l1 && l2) return { line1: l1, line2: l2 };
    // fallback: take lines 1 and 2 (0-indexed) if they follow TLE name format
    if (lines.length >= 3) return { line1: lines[1], line2: lines[2] };
    return null;
  } catch { return null; }
}

function predictPasses(tle: TLE, lat: number, lon: number, altKm = 0): Pass[] {
  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    const observer = {
      longitude: satellite.degreesToRadians(lon),
      latitude:  satellite.degreesToRadians(lat),
      height:    altKm / 1000,
    };

    const passes: Pass[] = [];
    const step  = 15 * 1000; // 15s
    const end   = Date.now() + 24 * 3600 * 1000;
    let inPass  = false;
    let pStart  = new Date();
    let pMaxEl  = 0;
    let pMaxT   = new Date();

    for (let t = Date.now(); t < end; t += step) {
      const date   = new Date(t);
      const pv     = satellite.propagate(satrec, date);
      if (typeof pv.position === 'boolean' || !pv.position) continue;
      const gmst   = satellite.gstime(date);
      const ecf    = satellite.eciToEcf(pv.position as satellite.EciVec3<number>, gmst);
      const look   = satellite.ecfToLookAngles(observer, ecf);
      const elDeg  = (look.elevation as number) * (180 / Math.PI);

      if (elDeg >= 10) {
        if (!inPass) { inPass = true; pStart = date; pMaxEl = elDeg; pMaxT = date; }
        else if (elDeg > pMaxEl) { pMaxEl = elDeg; pMaxT = date; }
      } else if (inPass) {
        inPass = false;
        passes.push({
          start: pStart, end: date,
          maxEl: Math.round(pMaxEl),
          maxElTime: pMaxT,
          duration: Math.round((date.getTime() - pStart.getTime()) / 60000),
        });
        if (passes.length >= 5) break;
      }
    }
    return passes;
  } catch { return []; }
}

// ─── Orbit number from TLE (rev at epoch + orbits since) ────────────────────
function orbitNumber(tle: TLE | null): number | null {
  if (!tle) return null;
  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    const revAtEpoch = parseInt(tle.line2.substring(63, 68).trim(), 10);
    if (isNaN(revAtEpoch)) return null;
    // epoch → JS date
    const epochDays = satrec.jdsatepoch - 2440587.5;
    const epochMs = epochDays * 86400000;
    const meanMotion = satrec.no * 1440 / (2 * Math.PI); // revs/day
    const elapsed = (Date.now() - epochMs) / 86400000;
    return Math.floor(revAtEpoch + elapsed * meanMotion);
  } catch { return null; }
}

// ─── Mission-control telemetry terminal ─────────────────────────────────────
function TelemetryTerminal({ pos, tle }: { pos: ISSPosition | null; tle: TLE | null }) {
  const orbit = orbitNumber(tle);
  const rows: [string, string, string][] = [
    ['LAT', pos ? `${pos.latitude >= 0 ? '+' : ''}${pos.latitude.toFixed(4)}°` : '——.————°', '#00ff88'],
    ['LON', pos ? `${pos.longitude >= 0 ? '+' : ''}${pos.longitude.toFixed(4)}°` : '——.————°', '#00ff88'],
    ['ALT', pos ? `${pos.altitude.toFixed(2)} KM` : '———.—— KM', '#00d4ff'],
    ['VEL', pos ? `${pos.velocity.toFixed(0)} KM/H` : '————— KM/H', '#00d4ff'],
    ['MODE', pos ? (pos.visibility === 'daylight' ? 'DAYLIGHT' : 'ECLIPSE') : 'ACQUIRING', pos?.visibility === 'daylight' ? '#ffb700' : '#c084fc'],
    ['ORBIT', orbit !== null ? `#${orbit.toLocaleString()}` : 'AWAITING TLE', '#f0f4ff'],
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="rounded-2xl mb-8 overflow-hidden"
      style={{ background: 'rgba(1, 4, 2, 0.92)', border: '1px solid rgba(0,255,136,0.22)', boxShadow: '0 0 32px rgba(0,255,136,0.06), inset 0 0 60px rgba(0,255,136,0.03)' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(0,255,136,0.06)', borderBottom: '1px solid rgba(0,255,136,0.15)' }}>
        <p className="text-[10px] font-mono tracking-[0.25em]" style={{ color: '#00ff88' }}>■ ZARYA-25544 // LIVE TELEMETRY</p>
        <p className="text-[10px] font-mono" style={{ color: 'rgba(0,255,136,0.55)' }}>
          {pos ? new Date(pos.timestamp * 1000).toISOString().slice(11, 19) : '--:--:--'} UTC<span className="animate-pulse">▌</span>
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px" style={{ background: 'rgba(0,255,136,0.08)' }}>
        {rows.map(([label, value, color]) => (
          <div key={label} className="px-4 py-3" style={{ background: 'rgba(1,4,2,0.95)' }}>
            <p className="text-[9px] font-mono tracking-[0.2em] mb-1" style={{ color: 'rgba(0,255,136,0.45)' }}>{label}</p>
            <p className="text-sm font-mono font-bold tabular-nums" style={{ color, textShadow: `0 0 12px ${color}55` }}>{value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function ISSPage() {
  const { pos, loading: posLoading } = useISSPosition();
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [locError, setLocError] = useState(false);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [passLoading, setPassLoading] = useState(false);
  const [tle, setTle] = useState<TLE | null>(null);

  // Load TLE once for orbit path (and reuse for pass prediction)
  useEffect(() => {
    let alive = true;
    fetchTLE().then(t => { if (alive && t) setTle(t); });
    // refresh TLE every 6 hours
    const id = setInterval(() => { fetchTLE().then(t => { if (alive && t) setTle(t); }); }, 6 * 3600_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError(true); return; }
    navigator.geolocation.getCurrentPosition(
      async geo => {
        const loc = { lat: geo.coords.latitude, lon: geo.coords.longitude };
        setUserLoc(loc);
        setPassLoading(true);
        const t = tle ?? await fetchTLE();
        if (t) {
          setTle(t);
          setPasses(predictPasses(t, loc.lat, loc.lon));
        }
        setPassLoading(false);
      },
      () => setLocError(true)
    );
  }, [tle]);

  return (
    <>
      <title>ISS Tracker | Live International Space Station Position | Stargaze</title>
      <meta name="description" content="Track the International Space Station in real time. See the current ISS position, altitude, speed, and predict when it will fly over your location." />
      <link rel="canonical" href="https://stargaze.io/iss" />
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">

      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-12 relative">
        <div className="hero-orb hero-orb-cyan" style={{ top: -30, left: '35%', opacity: 0.35 }} aria-hidden="true" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
            style={{ background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.3)', boxShadow: '0 0 20px rgba(52,211,153,0.12)' }}>
            <span className="live-dot" />
            <span className="text-xs font-mono text-emerald-300/80 tracking-wider">LIVE · UPDATES EVERY 5 SECONDS</span>
          </div>
          <h1 className="hero-title hero-gradient-text mb-4">ISS Tracker</h1>
          <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
            The International Space Station orbits Earth every 92 minutes at ~400 km altitude. Here's where it is right now.
          </p>
        </div>
      </motion.div>

      {/* Mission-control telemetry */}
      <TelemetryTerminal pos={pos} tle={tle} />

      {/* Live position grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label:'Latitude',  value: pos ? `${pos.latitude.toFixed(4)}°` : '…', icon:'🌐', color:'#34d399' },
          { label:'Longitude', value: pos ? `${pos.longitude.toFixed(4)}°` : '…', icon:'🧭', color:'#60a5fa' },
          { label:'Altitude',  value: pos ? `${Math.round(pos.altitude)} km` : '…', icon:'🛸', color:'#c084fc' },
          { label:'Speed',     value: pos ? `${Math.round(pos.velocity).toLocaleString()} km/h` : '…', icon:'⚡', color:'#fb923c' },
        ].map(({ label, value, icon, color }) => (
          <motion.div key={label} initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }}
            className="glass-card metric-card p-4 rounded-2xl" style={{ borderTop:`2px solid ${color}50` }}>
            <div className="metric-glow" style={{ background: color }} />
            <p className="text-2xl mb-1 relative z-10">{icon}</p>
            <p className="text-lg font-bold font-space relative z-10" style={{ color }}>{value}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-mono mt-1 relative z-10">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Map + Pass finder */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">

        {/* World map — live ground track */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}
          className="lg:col-span-3 glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-mono text-white/35 uppercase tracking-widest">Live Ground Track</p>
              <p className="text-[10px] text-white/25 font-mono mt-0.5">
                {tle ? 'Orbit from live TLE · ' : ''}{posLoading ? 'connecting…' : 'updates every 5s'}
              </p>
            </div>
            {pos && (
              <div className="text-right">
                <p className="text-[10px] text-white/40 font-mono">
                  {new Date(pos.timestamp * 1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} UTC
                </p>
                {pos.visibility && (
                  <p className="text-[9px] font-mono mt-0.5" style={{ color: pos.visibility === 'daylight' ? '#fbbf24' : '#93c5fd' }}>
                    {pos.visibility === 'daylight' ? '☀ Daylight side' : '☾ Eclipse / night'}
                  </p>
                )}
              </div>
            )}
          </div>
          <ISSGroundTrack pos={pos} userLoc={userLoc} tle={tle} />
          <p className="text-[10px] text-white/25 text-center mt-2.5 font-mono leading-relaxed">
            Full orbit path (~92 min) · visibility footprint under the station · night shade is approximate
          </p>
        </motion.div>

        {/* Pass predictor */}
        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.25 }}
          className="lg:col-span-2 glass-card p-5 rounded-2xl flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Navigation size={12} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-space">Visible Passes</h2>
              <p className="text-[10px] text-white/30 font-mono">Next 24 hours from your location</p>
            </div>
          </div>

          {!userLoc && !locError && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <MapPin size={28} className="text-emerald-400/30 mb-3" />
              <p className="text-sm font-semibold text-white/60 mb-2">Find passes over your location</p>
              <p className="text-[11px] text-white/35 mb-4 leading-relaxed">Grant location access to see when the ISS will fly over you tonight. It's bright — magnitude −3 to −4!</p>
              <button onClick={requestLocation} className="btn-primary text-xs">
                <MapPin size={12} />
                Use My Location
              </button>
            </div>
          )}

          {locError && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-white/40">Location unavailable. Try the NASA Spot the Station tool:</p>
              <a href="https://spotthestation.nasa.gov/" target="_blank" rel="noopener noreferrer"
                className="btn-secondary text-xs mt-3"><ExternalLink size={11}/>NASA Spot the Station</a>
            </div>
          )}

          {passLoading && (
            <div className="flex-1 flex items-center justify-center gap-2">
              <RefreshCw size={14} className="text-emerald-400/50 animate-spin" />
              <p className="text-xs text-white/30 font-mono">Computing passes…</p>
            </div>
          )}

          {userLoc && !passLoading && passes.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-white/40 mb-2">No visible passes in the next 24 hours</p>
              <p className="text-[10px] text-white/25 leading-relaxed">
                The ISS ground track shifts ~22° westward each orbit. Check again tomorrow or use the NASA Spot the Station tool for the full schedule.
              </p>
              <a href="https://spotthestation.nasa.gov/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 mt-3"><ExternalLink size={11}/>Full schedule</a>
            </div>
          )}

          {passes.length > 0 && (
            <div className="flex-1 flex flex-col gap-2">
              {passes.map((p, i) => {
                const isNext = i === 0;
                const minsUntil = Math.max(0, Math.round((p.start.getTime() - Date.now()) / 60000));
                const visColor = p.maxEl >= 60 ? '#4ade80' : p.maxEl >= 30 ? '#fbbf24' : '#60a5fa';
                return (
                  <div key={i} className="p-3 rounded-xl" style={{ background: isNext ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)', border: isNext ? '1px solid rgba(52,211,153,0.20)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isNext && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400">NEXT</span>}
                        <p className="text-xs font-bold text-white/85">{p.start.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={10} className="text-white/30" />
                        <p className="text-[10px] text-white/40 font-mono">{p.duration} min</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-sm font-bold" style={{ color: visColor }}>{p.maxEl}°</p>
                        <p className="text-[9px] text-white/25 font-mono">max el</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white/60">{minsUntil}m</p>
                        <p className="text-[9px] text-white/25 font-mono">until</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white/60">{p.maxEl >= 45 ? '★★★' : p.maxEl >= 20 ? '★★' : '★'}</p>
                        <p className="text-[9px] text-white/25 font-mono">quality</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ISS facts */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
        className="glass-card p-6 rounded-2xl">
        <h2 className="text-sm font-bold font-space mb-4">About the ISS</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { stat:'~408 km', label:'Orbital altitude' },
            { stat:'7.66 km/s', label:'Orbital speed' },
            { stat:'92.6 min', label:'Orbital period' },
            { stat:'16 / day', label:'Orbits per day' },
            { stat:'109 m', label:'Width (solar arrays)' },
            { stat:'73 m', label:'Length (truss)' },
            { stat:'420 t', label:'Mass' },
            { stat:'1998', label:'First module launched' },
          ].map(({ stat, label }) => (
            <div key={label} className="p-3 rounded-xl text-center" style={{ background:'rgba(255,255,255,0.03)' }}>
              <p className="text-sm font-bold text-emerald-300">{stat}</p>
              <p className="text-[10px] text-white/30 font-mono mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4 flex-wrap">
          {[
            { label:'Spot the Station (NASA)', url:'https://spotthestation.nasa.gov/' },
            { label:'ISS Live Stream (NASA TV)', url:'https://www.nasa.gov/nasatv/' },
            { label:'Heavens-Above passes', url:'https://www.heavens-above.com/PassSummary.aspx' },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-300 transition-colors font-mono">
              {label} <ExternalLink size={9} />
            </a>
          ))}
        </div>
      </motion.div>
    </div>
    </>
  );
}
