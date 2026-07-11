import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as satellite from 'satellite.js';

export interface ISSPos {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility?: string;
  timestamp: number;
}

interface TLE { line1: string; line2: string }

interface Props {
  pos: ISSPos | null;
  userLoc: { lat: number; lon: number } | null;
  tle?: TLE | null;
}

/** Equirectangular landmass silhouettes (very simplified, viewBox 0–360 × 0–180) */
const CONTINENTS = [
  // North America
  'M 40 45 L 55 38 L 75 42 L 95 48 L 100 55 L 95 70 L 80 75 L 70 68 L 55 72 L 45 65 Z',
  // South America
  'M 95 95 L 105 90 L 112 105 L 110 130 L 100 145 L 92 135 L 88 110 Z',
  // Europe
  'M 165 42 L 185 38 L 200 45 L 195 55 L 175 58 L 165 52 Z',
  // Africa
  'M 170 70 L 195 68 L 210 85 L 205 120 L 185 135 L 170 120 L 165 90 Z',
  // Asia
  'M 200 35 L 250 30 L 290 40 L 300 55 L 280 70 L 250 65 L 220 60 L 205 50 Z',
  // Australia
  'M 280 115 L 310 112 L 320 125 L 305 138 L 280 132 Z',
  // Greenland
  'M 120 22 L 140 18 L 145 32 L 130 40 L 118 32 Z',
];

function lonLatToXY(lon: number, lat: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * 360,
    y: ((90 - lat) / 180) * 180,
  };
}

/** Sample orbit path from TLE for ~1.1 periods */
function sampleOrbit(tle: TLE, samples = 90): { x: number; y: number; lon: number; lat: number }[] {
  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    const periodMin = (2 * Math.PI) / satrec.no; // minutes
    const durationMs = periodMin * 60_000 * 1.15;
    const step = durationMs / samples;
    const start = Date.now() - 10 * 60_000; // include 10 min of history
    const pts: { x: number; y: number; lon: number; lat: number }[] = [];

    for (let i = 0; i <= samples; i++) {
      const date = new Date(start + i * step);
      const pv = satellite.propagate(satrec, date);
      if (typeof pv.position === 'boolean' || !pv.position) continue;
      const gmst = satellite.gstime(date);
      const gd = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, gmst);
      const lat = gd.latitude * (180 / Math.PI);
      let lon = gd.longitude * (180 / Math.PI);
      // normalize lon to -180..180
      lon = ((lon + 180) % 360 + 360) % 360 - 180;
      const { x, y } = lonLatToXY(lon, lat);
      pts.push({ x, y, lon, lat });
    }
    return pts;
  } catch {
    return [];
  }
}

/** Split path at antimeridian so SVG lines don't streak across the map */
function pathSegments(pts: { x: number; y: number }[]): string[] {
  if (pts.length < 2) return [];
  const segs: string[] = [];
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i].x - pts[i - 1].x);
    if (dx > 180) {
      segs.push(d);
      d = `M ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    } else {
      d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    }
  }
  segs.push(d);
  return segs;
}

/** Approximate solar terminator (day/night) for current UTC */
function terminatorPath(date = new Date()): string {
  // Solar longitude ≈ 15° * (hours UTC - 12)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const sunLon = 15 * (utcHours - 12);
  // Approximate: terminator is ~90° from subsolar point; ignore season for simplicity
  const pts: string[] = [];
  for (let lat = -90; lat <= 90; lat += 5) {
    // Night side starts roughly sunLon ± 90
    const lon = sunLon + 90;
    const { x, y } = lonLatToXY(((lon + 180) % 360) - 180, lat);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  // Build a half-shade polygon: from terminator line across night side
  // Simplified vertical band for visual interest
  const shadeLon = ((sunLon + 90 + 180) % 360) - 180;
  const x0 = lonLatToXY(shadeLon, 0).x;
  // Night is ~180° wide starting at terminator
  let x1 = x0 + 180;
  if (x1 <= 360) {
    return `M ${x0} 0 L ${x1} 0 L ${x1} 180 L ${x0} 180 Z`;
  }
  // Wrap
  return `M ${x0} 0 L 360 0 L 360 180 L ${x0} 180 Z M 0 0 L ${x1 - 360} 0 L ${x1 - 360} 180 L 0 180 Z`;
}

export default function ISSGroundTrack({ pos, userLoc, tle }: Props) {
  const trailRef = useRef<{ lon: number; lat: number; t: number }[]>([]);
  const [, setTick] = useState(0);

  // Record trail from live positions
  useEffect(() => {
    if (!pos) return;
    const trail = trailRef.current;
    const last = trail[trail.length - 1];
    if (!last || Math.abs(last.lon - pos.longitude) > 0.05 || Math.abs(last.lat - pos.latitude) > 0.05) {
      trail.push({ lon: pos.longitude, lat: pos.latitude, t: Date.now() });
      // keep ~45 min of trail
      while (trail.length > 200) trail.shift();
      setTick(t => t + 1);
    }
  }, [pos?.latitude, pos?.longitude]);

  const orbitPts = useMemo(() => (tle ? sampleOrbit(tle) : []), [tle?.line1, tle?.line2]);
  const orbitSegs = useMemo(() => pathSegments(orbitPts), [orbitPts]);
  const trailPts = trailRef.current.map(p => lonLatToXY(p.lon, p.lat));
  const trailSegs = pathSegments(trailPts);
  const nightPath = useMemo(() => terminatorPath(), [Math.floor(Date.now() / 600_000)]); // refresh ~10 min

  const issXY = pos ? lonLatToXY(pos.longitude, pos.latitude) : null;
  const userXY = userLoc ? lonLatToXY(userLoc.lon, userLoc.lat) : null;

  // Footprint radius in map units (~2° per 100km altitude visual)
  const footR = pos ? Math.max(4, (pos.altitude / 100) * 1.8) : 8;

  return (
    <div
      className="relative rounded-xl overflow-hidden iss-map"
      style={{
        aspectRatio: '2/1',
        background: 'radial-gradient(ellipse at 50% 40%, #0a1a3a 0%, #030514 70%, #020208 100%)',
      }}
    >
      <svg viewBox="0 0 360 180" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="issGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#6ee7b7" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
          </linearGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ocean base is parent bg; continents */}
        {CONTINENTS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="rgba(79,142,247,0.12)"
            stroke="rgba(147,197,253,0.18)"
            strokeWidth="0.4"
          />
        ))}

        {/* Night shade */}
        <path d={nightPath} fill="rgba(0,0,20,0.35)" style={{ pointerEvents: 'none' }} />

        {/* Lat/lon grid */}
        {[-60, -30, 0, 30, 60].map(lat => (
          <line
            key={`lat${lat}`}
            x1="0" y1={90 - lat} x2="360" y2={90 - lat}
            stroke="rgba(255,255,255,0.06)" strokeWidth="0.35" strokeDasharray="2 3"
          />
        ))}
        {[-120, -60, 0, 60, 120].map(lon => (
          <line
            key={`lon${lon}`}
            x1={lon + 180} y1="0" x2={lon + 180} y2="180"
            stroke="rgba(255,255,255,0.06)" strokeWidth="0.35" strokeDasharray="2 3"
          />
        ))}

        {/* Predicted orbit */}
        {orbitSegs.map((d, i) => (
          <path
            key={`orb${i}`}
            d={d}
            fill="none"
            stroke="url(#orbitGrad)"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.85"
          />
        ))}

        {/* Recent trail */}
        {trailSegs.map((d, i) => (
          <path
            key={`tr${i}`}
            d={d}
            fill="none"
            stroke="#6ee7b7"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.9"
            filter="url(#softGlow)"
          />
        ))}

        {/* Visibility footprint */}
        {issXY && (
          <circle
            cx={issXY.x}
            cy={issXY.y}
            r={footR}
            fill="rgba(52,211,153,0.08)"
            stroke="rgba(52,211,153,0.25)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          >
            <animate attributeName="r" values={`${footR};${footR * 1.08};${footR}`} dur="3s" repeatCount="indefinite" />
          </circle>
        )}

        {/* User location */}
        {userXY && (
          <g>
            <circle cx={userXY.x} cy={userXY.y} r="3.5" fill="#60a5fa" stroke="#fff" strokeWidth="0.8" />
            <circle cx={userXY.x} cy={userXY.y} r="6" fill="none" stroke="#60a5fa" strokeWidth="0.5" opacity="0.5">
              <animate attributeName="r" values="5;9;5" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* ISS marker */}
        {issXY && (
          <g filter="url(#softGlow)">
            <circle cx={issXY.x} cy={issXY.y} r="10" fill="url(#issGlow)">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={issXY.x} cy={issXY.y} r="2.8" fill="#ecfdf5" stroke="#34d399" strokeWidth="1.2" />
            {/* Tiny "station" crossbar */}
            <line
              x1={issXY.x - 5} y1={issXY.y} x2={issXY.x + 5} y2={issXY.y}
              stroke="#a7f3d0" strokeWidth="0.9" strokeLinecap="round"
            />
            <line
              x1={issXY.x} y1={issXY.y - 2.5} x2={issXY.x} y2={issXY.y + 2.5}
              stroke="#a7f3d0" strokeWidth="0.7" strokeLinecap="round"
            />
          </g>
        )}

        {/* Equator / prime meridian labels */}
        <text x="182" y="94" fill="rgba(255,255,255,0.2)" fontSize="4" fontFamily="monospace">EQ</text>
        <text x="178" y="12" fill="rgba(255,255,255,0.15)" fontSize="3.5" fontFamily="monospace">N</text>
        <text x="178" y="176" fill="rgba(255,255,255,0.15)" fontSize="3.5" fontFamily="monospace">S</text>
      </svg>

      {/* HUD overlay */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 flex items-end justify-between pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(2,2,12,0.75), transparent)' }}>
        <div className="flex items-center gap-3 text-[9px] font-mono text-white/50">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow shadow-emerald-400/50" />
            ISS
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded bg-emerald-400/70" />
            Orbit
          </span>
          {userLoc && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              You
            </span>
          )}
          <span className="flex items-center gap-1 text-white/30">
            <span className="w-3 h-2 rounded-sm bg-black/40 border border-white/10" />
            Night
          </span>
        </div>
        {pos && (
          <div className="text-right text-[9px] font-mono text-emerald-300/80">
            <div>{pos.latitude.toFixed(2)}° · {pos.longitude.toFixed(2)}°</div>
            <div className="text-white/35">{Math.round(pos.altitude)} km · {Math.round(pos.velocity).toLocaleString()} km/h</div>
          </div>
        )}
      </div>

      {!pos && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[10px] text-white/30 font-mono">Acquiring ISS…</p>
          </div>
        </div>
      )}
    </div>
  );
}
