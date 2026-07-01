import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Rocket, MapPin, Navigation, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import * as satellite from 'satellite.js';

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
      const elDeg  = satellite.radiansToDegrees(look.elevation);

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

export default function ISSPage() {
  const { pos, loading: posLoading } = useISSPosition();
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [locError, setLocError] = useState(false);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [passLoading, setPassLoading] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError(true); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLoc(loc);
        setPassLoading(true);
        const tle = await fetchTLE();
        if (tle) setPasses(predictPasses(tle, loc.lat, loc.lon));
        setPassLoading(false);
      },
      () => setLocError(true)
    );
  }, []);

  const orbitalPeriod = 92; // minutes
  const orbitNumber   = pos ? Math.floor((pos.timestamp / 60 / orbitalPeriod) % 10000) : null;

  return (
    <>
      <title>ISS Tracker | Live International Space Station Position | Stargaze</title>
      <meta name="description" content="Track the International Space Station in real time. See the current ISS position, altitude, speed, and predict when it will fly over your location." />
      <link rel="canonical" href="https://stargaze.io/iss" />
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">

      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
          style={{ background:'rgba(52,211,153,0.10)', border:'1px solid rgba(52,211,153,0.25)' }}>
          <span className="live-dot" />
          <span className="text-xs font-mono text-emerald-300/80 tracking-wider">LIVE · UPDATES EVERY 5 SECONDS</span>
        </div>
        <h1 className="hero-title hero-gradient-text mb-4">ISS Tracker</h1>
        <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
          The International Space Station orbits Earth every 92 minutes at ~400 km altitude. Here's where it is right now.
        </p>
      </motion.div>

      {/* Live position grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label:'Latitude',  value: pos ? `${pos.latitude.toFixed(4)}°` : '…', icon:'🌐', color:'#34d399' },
          { label:'Longitude', value: pos ? `${pos.longitude.toFixed(4)}°` : '…', icon:'🧭', color:'#60a5fa' },
          { label:'Altitude',  value: pos ? `${Math.round(pos.altitude)} km` : '…', icon:'🛸', color:'#c084fc' },
          { label:'Speed',     value: pos ? `${Math.round(pos.velocity).toLocaleString()} km/h` : '…', icon:'⚡', color:'#fb923c' },
        ].map(({ label, value, icon, color }) => (
          <motion.div key={label} initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }}
            className="glass-card p-4 rounded-2xl" style={{ borderTop:`2px solid ${color}30` }}>
            <p className="text-2xl mb-1">{icon}</p>
            <p className="text-lg font-bold font-space" style={{ color }}>{value}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-mono mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Map + Pass finder */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">

        {/* World map */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}
          className="lg:col-span-3 glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono text-white/35 uppercase tracking-widest">Live Ground Track</p>
            {pos && (
              <p className="text-[10px] text-white/30 font-mono">
                {new Date(pos.timestamp * 1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} UTC
              </p>
            )}
          </div>
          {/* Simple SVG world map with ISS dot */}
          <div className="relative rounded-xl overflow-hidden" style={{ background:'rgba(0,0,50,0.6)', aspectRatio:'2/1' }}>
            <svg viewBox="0 0 360 180" className="w-full h-full" style={{ opacity:0.4 }}>
              {/* Simple world outline — latitude/longitude grid */}
              {[-60,-30,0,30,60].map(lat => (
                <line key={lat} x1="0" y1={90-lat} x2="360" y2={90-lat} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
              ))}
              {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(lon => (
                <line key={lon} x1={lon+180} y1="0" x2={lon+180} y2="180" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
              ))}
            </svg>
            {/* ISS dot */}
            {pos && (() => {
              const x = ((pos.longitude + 180) / 360) * 100;
              const y = ((90 - pos.latitude) / 180) * 100;
              return (
                <div className="absolute" style={{ left:`${x}%`, top:`${y}%`, transform:'translate(-50%,-50%)' }}>
                  <div className="w-4 h-4 rounded-full border-2 border-emerald-400 bg-emerald-400/30 animate-pulse" />
                  <div className="absolute top-4 left-4 text-[10px] font-mono text-emerald-300 whitespace-nowrap">ISS ↑</div>
                </div>
              );
            })()}
            {/* User location */}
            {userLoc && (() => {
              const x = ((userLoc.lon + 180) / 360) * 100;
              const y = ((90 - userLoc.lat) / 180) * 100;
              return (
                <div className="absolute" style={{ left:`${x}%`, top:`${y}%`, transform:'translate(-50%,-50%)' }}>
                  <div className="w-3 h-3 rounded-full bg-blue-400 border border-white" />
                </div>
              );
            })()}
            {/* Labels */}
            <div className="absolute inset-x-0 bottom-2 flex justify-center">
              <div className="flex items-center gap-4 text-[9px] font-mono text-white/40">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />ISS</span>
                {userLoc && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />You</span>}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-white/20 text-center mt-2 font-mono">
            ISS completes 1 orbit every ~92 min · {pos ? `Visibility: ${pos.visibility}` : ''}
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
