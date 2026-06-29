import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, X, Loader2, Eye } from 'lucide-react';
import meteorShowersData from '../data/meteorShowers.json';

// ─── ASTRONOMY UTILS ──────────────────────────────────────────────────────────
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function julianDay(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

function localSiderealTime(jd: number, lonDeg: number): number {
  const T = (jd - 2451545.0) / 36525;
  let theta = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933*T*T;
  return ((theta + lonDeg) % 360 + 360) % 360;
}

// Convert RA/Dec (degrees) → Altitude/Azimuth (degrees)
function raDecToAltAz(ra: number, dec: number, lat: number, lst: number): { alt: number; az: number } {
  const H = ((lst - ra) % 360 + 360) % 360; // Hour angle
  const hr = H * D2R, dr = dec * D2R, lr = lat * D2R;
  const sinAlt = Math.sin(dr)*Math.sin(lr) + Math.cos(dr)*Math.cos(lr)*Math.cos(hr);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * R2D;
  const cosAz = (Math.sin(dr) - Math.sin(alt*D2R)*Math.sin(lr)) / (Math.cos(alt*D2R)*Math.cos(lr));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * R2D;
  if (Math.sin(hr) > 0) az = 360 - az;
  return { alt, az };
}

// Alt/Az → Three.js XYZ on hemisphere (Y=up, North=+Z, East=+X)
function altAzToVec3(alt: number, az: number, r = 5): THREE.Vector3 {
  const ar = alt * D2R, azr = az * D2R;
  const x = r * Math.cos(ar) * Math.sin(azr);  // East component
  const y = r * Math.sin(ar);                    // Up component
  const z = -r * Math.cos(ar) * Math.cos(azr);  // North component (negative for correct orientation)
  return new THREE.Vector3(x, y, z);
}

// ─── RADIANT DATA ─────────────────────────────────────────────────────────────
// RA in degrees, Dec in degrees
const SHOWER_RADIANTS: Record<string, { ra: number; dec: number; color: string }> = {
  'Quadrantids':            { ra:230, dec:49,  color:'#88ccff' },
  'Lyrids':                 { ra:272, dec:34,  color:'#aa88ff' },
  'Eta Aquariids':          { ra:338, dec:-1,  color:'#ff9944' },
  'Southern Delta Aquariids':{ ra:340, dec:-16, color:'#44ccff' },
  'Perseids':               { ra:48,  dec:58,  color:'#ff4488' },
  'Orionids':               { ra:95,  dec:16,  color:'#ff9944' },
  'Leonids':                { ra:152, dec:22,  color:'#ffcc33' },
  'Geminids':               { ra:112, dec:33,  color:'#44ff88' },
  'Taurids':                { ra:51,  dec:14,  color:'#ff6633' },
  'Ursids':                 { ra:217, dec:76,  color:'#88ffff' },
};

// Major bright stars (RA in degrees, Dec in degrees, magnitude, name)
const BRIGHT_STARS = [
  { name:'Sirius',    ra:101.3, dec:-16.7, mag:-1.46, color:'#cce8ff' },
  { name:'Canopus',   ra:95.9,  dec:-52.7, mag:-0.74, color:'#fff8e0' },
  { name:'Arcturus',  ra:213.9, dec:19.2,  mag:-0.05, color:'#ffbb77' },
  { name:'Vega',      ra:279.2, dec:38.8,  mag:0.03,  color:'#ddddff' },
  { name:'Rigel',     ra:78.6,  dec:-8.2,  mag:0.12,  color:'#aaccff' },
  { name:'Procyon',   ra:114.8, dec:5.2,   mag:0.38,  color:'#ffe8cc' },
  { name:'Betelgeuse',ra:88.8,  dec:7.4,   mag:0.42,  color:'#ff8844' },
  { name:'Aldebaran', ra:68.9,  dec:16.5,  mag:0.85,  color:'#ff9966' },
  { name:'Antares',   ra:247.4, dec:-26.4, mag:0.96,  color:'#ff6644' },
  { name:'Spica',     ra:201.3, dec:-11.2, mag:0.98,  color:'#aaddff' },
  { name:'Pollux',    ra:116.3, dec:28.0,  mag:1.14,  color:'#ffcc88' },
  { name:'Deneb',     ra:310.4, dec:45.3,  mag:1.25,  color:'#ffffff' },
  { name:'Regulus',   ra:152.1, dec:11.9,  mag:1.35,  color:'#ddddff' },
  { name:'Castor',    ra:113.6, dec:31.9,  mag:1.58,  color:'#ffffff' },
  { name:'Fomalhaut', ra:344.4, dec:-29.6, mag:1.16,  color:'#ccddff' },
  { name:'Mimosa',    ra:191.9, dec:-59.7, mag:1.25,  color:'#aaccff' },
  { name:'Acrux',     ra:186.6, dec:-63.1, mag:0.77,  color:'#ccddff' },
  { name:'Shaula',    ra:263.4, dec:-37.1, mag:1.62,  color:'#ddddff' },
  { name:'Bellatrix', ra:81.3,  dec:6.3,   mag:1.64,  color:'#bbccff' },
  { name:'Alnilam',   ra:84.1,  dec:-1.2,  mag:1.65,  color:'#ccddff' },
];

// Simplified constellation outlines [star1RA, star1Dec, star2RA, star2Dec, ...]
const CONSTELLATIONS: { name: string; lines: [number,number,number,number][] }[] = [
  { name:'Orion', lines: [
    [88.8,7.4, 84.1,-1.2], [84.1,-1.2, 81.3,6.3], [81.3,6.3, 78.6,-8.2],
    [84.1,-1.2, 84.9,-2.0], [84.9,-2.0, 85.2,-1.9],
  ]},
  { name:'Ursa Major', lines: [
    [165.9,61.8, 178.4,53.7], [178.4,53.7, 183.9,55.0],
    [183.9,55.0, 193.5,55.9], [193.5,55.9, 200.9,54.9],
  ]},
  { name:'Cassiopeia', lines: [
    [2.3,59.1, 10.1,56.5], [10.1,56.5, 14.2,60.7], [14.2,60.7, 21.4,60.2], [21.4,60.2, 28.6,63.7],
  ]},
];

// ─── SCENE COMPONENTS ─────────────────────────────────────────────────────────

interface SkyObject {
  type: 'star' | 'radiant'; name: string; alt: number; az: number;
  color: string; size: number; shower?: any;
}

function HorizonRing() {
  const pts = useMemo(() => {
    const p: [number,number,number][] = [];
    for (let i=0; i<=128; i++) {
      const a = (i/128) * Math.PI * 2;
      p.push([5*Math.cos(a), 0, 5*Math.sin(a)]);
    }
    return p;
  }, []);
  return (
    <>
      {/* Horizon glow disc */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[5.2, 64]} />
        <meshBasicMaterial color="#0a1428" transparent opacity={0.85} />
      </mesh>
      {/* Horizon ring line */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(pts.flat()), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#1a3a6a" transparent opacity={0.7} />
      </line>
      {/* Cardinal directions */}
      {[['N',0,0,-5.3],['S',0,0,5.3],['E',5.3,0,0],['W',-5.3,0,0]].map(([label,x,y,z]) => (
        <mesh key={String(label)} position={[Number(x), Number(y)+0.15, Number(z)]}>
          <sphereGeometry args={[0.02, 4, 4]} />
          <meshBasicMaterial color="#4488aa" />
        </mesh>
      ))}
    </>
  );
}

function MilkyWay() {
  const COUNT = 800;
  const { geo } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    // Approximate Milky Way band (galactic equator roughly from Cygnus to Centaurus)
    for (let k = 0; k < COUNT; k++) {
      // Random position along a band at roughly 0°-60° altitude, spanning all azimuth but concentrated in a band
      const az   = Math.random() * 360 * D2R;
      const alt  = (Math.random() * 60 + 5) * D2R;
      // Weight toward a band
      const bandWeight = Math.exp(-Math.pow((az - Math.PI) / 1.5, 2));
      const r = 4.8 + (Math.random() - 0.5) * 0.3;
      pos[k*3]   = r * Math.cos(alt) * Math.sin(az);
      pos[k*3+1] = r * Math.sin(alt) * (0.3 + 0.7 * Math.random());
      pos[k*3+2] = -r * Math.cos(alt) * Math.cos(az);
      const brightness = (0.1 + 0.15 * Math.random()) * (0.3 + 0.7 * bandWeight);
      col[k*3] = brightness * 0.6; col[k*3+1] = brightness * 0.7; col[k*3+2] = brightness;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { geo: g };
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.015} vertexColors transparent opacity={0.6} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function SkyScene({ objects, onHover, onSelect }:
  { objects: SkyObject[]; onHover: (o: SkyObject | null) => void; onSelect: (o: SkyObject) => void }) {

  return (
    <>
      <Stars radius={5} depth={0.5} count={4000} factor={2} saturation={0.1} fade speed={0} />
      <MilkyWay />
      <HorizonRing />
      <ambientLight intensity={0.02} />

      {/* Bright stars */}
      {objects.filter(o => o.type === 'star' && o.alt > -2).map(o => {
        const pos = altAzToVec3(o.alt, o.az, 4.9);
        return (
          <mesh key={o.name} position={pos} onClick={(e) => { e.stopPropagation(); onSelect(o); }}>
            <sphereGeometry args={[o.size, 6, 6]} />
            <meshBasicMaterial color={o.color} />
          </mesh>
        );
      })}

      {/* Meteor shower radiant points */}
      {objects.filter(o => o.type === 'radiant' && o.alt > -5).map(o => {
        const pos = altAzToVec3(o.alt, o.az, 4.85);
        return (
          <group key={o.name} position={pos}
            onClick={(e) => { e.stopPropagation(); onSelect(o); }}>
            {/* Radiant ring */}
            <mesh>
              <torusGeometry args={[0.08, 0.012, 8, 32]} />
              <meshBasicMaterial color={o.color} transparent opacity={0.85} />
            </mesh>
            {/* Inner glow */}
            <mesh>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color={o.color} transparent opacity={0.5} depthWrite={false} />
            </mesh>
            {/* Radiating lines */}
            {[0,60,120,180,240,300].map(angle => {
              const ar = angle * D2R;
              const end = new THREE.Vector3(Math.cos(ar)*0.15, Math.sin(ar)*0.15, 0);
              return (
                <line key={angle}>
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position"
                      args={[new Float32Array([0,0,0,end.x,end.y,end.z]), 3]} />
                  </bufferGeometry>
                  <lineBasicMaterial color={o.color} transparent opacity={0.6} />
                </line>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SkyView() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError,   setLocError]   = useState<string | null>(null);
  const [selected,   setSelected]   = useState<SkyObject | null>(null);
  const [hovered,    setHovered]    = useState<SkyObject | null>(null);
  const [now,        setNow]        = useState(new Date());

  // Default to London if no location
  const loc = location ?? { lat: 51.5, lon: -0.1 };

  // Tick clock every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const requestLocation = () => {
    setLocLoading(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      pos => { setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setLocLoading(false); },
      _   => { setLocError('Could not get location. Showing London view.'); setLocLoading(false); },
      { timeout: 8000 }
    );
  };

  const jd  = useMemo(() => julianDay(now), [now]);
  const lst = useMemo(() => localSiderealTime(jd, loc.lon), [jd, loc.lon]);

  // Compute all sky objects
  const objects = useMemo<SkyObject[]>(() => {
    const result: SkyObject[] = [];

    // Bright stars
    BRIGHT_STARS.forEach(s => {
      const { alt, az } = raDecToAltAz(s.ra, s.dec, loc.lat, lst);
      const size = Math.max(0.012, 0.03 - s.mag * 0.008);
      result.push({ type:'star', name:s.name, alt, az, color:s.color, size });
    });

    // Meteor shower radiants
    (meteorShowersData as any[]).forEach((shower: any) => {
      const radiant = SHOWER_RADIANTS[shower.name];
      if (!radiant) return;
      const { alt, az } = raDecToAltAz(radiant.ra, radiant.dec, loc.lat, lst);
      const nowDate = new Date();
      const isActive = nowDate >= new Date(shower.start) && nowDate <= new Date(shower.end);
      const isPeak = Math.abs(new Date(shower.peak).getTime() - nowDate.getTime()) < 86400000 * 3;
      result.push({
        type:'radiant', name:shower.name, alt, az,
        color: isPeak ? '#ffffff' : (isActive ? radiant.color : `${radiant.color}88`),
        size: isActive ? 0.06 : 0.04,
        shower,
      });
    });

    return result;
  }, [loc, lst]);

  const activeShowers = useMemo(() =>
    (meteorShowersData as any[]).filter((s: any) => {
      const n = new Date();
      return n >= new Date(s.start) && n <= new Date(s.end);
    }),
  []);

  const visibleRadiants = objects.filter(o => o.type === 'radiant' && o.alt > 0);

  return (
    <div className="relative w-full h-full" style={{ background:'#000408' }}>
      {/* Three.js dome */}
      <Canvas
        camera={{ position:[0, 0.5, 0.01], fov:90, near:0.01, far:20 }}
        gl={{ antialias:true, alpha:false }}
        style={{ width:'100%', height:'100%' }}>
        <Suspense fallback={null}>
          <OrbitControls
            enableDamping dampingFactor={0.08}
            minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1}
            enableZoom={false} rotateSpeed={-0.4}
            makeDefault
          />
          <SkyScene objects={objects} onHover={setHovered} onSelect={setSelected} />
        </Suspense>
      </Canvas>

      {/* ── Header ── */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono"
          style={{ background:'rgba(0,0,0,0.65)', border:'1px solid rgba(255,255,255,0.10)' }}>
          <Eye size={11} className="text-blue-400" />
          <span className="text-white/70">Night Sky · {loc.lat.toFixed(1)}° {loc.lat >= 0 ? 'N' : 'S'}, {Math.abs(loc.lon).toFixed(1)}° {loc.lon >= 0 ? 'E' : 'W'}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/50">{now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <p className="text-white/25 text-[9px] mt-1 font-mono">Drag to look around</p>
      </div>

      {/* ── Location button ── */}
      <div className="absolute top-14 right-3 z-20">
        <button onClick={requestLocation}
          className={`glass-card flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
            location ? 'text-green-400 border-green-500/20' : 'text-white/50 hover:text-white'
          }`}>
          {locLoading ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
          {location ? 'Location set' : 'Use my location'}
        </button>
        {locError && <p className="text-[9px] text-orange-400/70 mt-1 text-right">{locError}</p>}
      </div>

      {/* ── Active showers panel ── */}
      {activeShowers.length > 0 && (
        <div className="absolute top-14 left-3 z-20">
          <div className="glass-card p-3 rounded-xl max-w-[180px]">
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2">Active Tonight</p>
            {activeShowers.map((s: any) => {
              const rad = SHOWER_RADIANTS[s.name];
              const obj = objects.find(o => o.name === s.name);
              const isAboveHorizon = obj && obj.alt > 0;
              return (
                <div key={s.id} className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: rad?.color ?? '#ffffff', boxShadow:`0 0 5px ${rad?.color ?? '#fff'}` }} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/80 font-medium truncate">{s.name}</p>
                    <p className="text-[9px] text-white/35">
                      {isAboveHorizon
                        ? `${obj!.alt.toFixed(0)}° above horizon`
                        : 'Below horizon now'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected object panel ── */}
      <AnimatePresence>
        {selected && (
          <motion.div key="sky-panel"
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
            className="absolute left-3 bottom-20 z-20 glass-card p-4 rounded-2xl w-72">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider mb-0.5">
                  {selected.type === 'star' ? '⭐ Bright Star' : '☄️ Meteor Shower Radiant'}
                </p>
                <h3 className="text-sm font-bold font-space" style={{ color:selected.color }}>{selected.name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white"><X size={14}/></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="p-2 rounded-xl" style={{ background:'rgba(255,255,255,0.04)' }}>
                <p className="text-xs font-bold font-space" style={{ color:selected.color }}>{selected.alt.toFixed(1)}°</p>
                <p className="text-[9px] text-white/35">Altitude</p>
              </div>
              <div className="p-2 rounded-xl" style={{ background:'rgba(255,255,255,0.04)' }}>
                <p className="text-xs font-bold font-space" style={{ color:selected.color }}>{selected.az.toFixed(1)}°</p>
                <p className="text-[9px] text-white/35">Azimuth</p>
              </div>
            </div>
            {selected.type === 'radiant' && selected.shower && (() => {
              const s = selected.shower;
              const now = new Date();
              const daysToP = Math.ceil((new Date(s.peak).getTime() - now.getTime()) / 86400000);
              return (
                <div className="text-[10px] text-white/55 leading-relaxed space-y-1.5">
                  <p><span className="text-white/40">Parent:</span> {s.parent}</p>
                  <p><span className="text-white/40">Peak ZHR:</span> {s.zhr} meteors/hour</p>
                  <p><span className="text-white/40">Speed:</span> {s.speed} km/s</p>
                  {daysToP > 0
                    ? <p className="text-purple-300">Peak in {daysToP} days</p>
                    : daysToP < 0
                    ? <p className="text-white/35">Peak was {Math.abs(daysToP)} days ago</p>
                    : <p className="text-green-300 font-semibold">🌠 Peaking now!</p>
                  }
                  <p className="text-[9px] mt-1 leading-snug">{s.viewingTips}</p>
                </div>
              );
            })()}
            {selected.type === 'star' && (
              <p className="text-[10px] text-white/50 leading-relaxed">
                {selected.alt > 0
                  ? `Currently ${selected.alt.toFixed(1)}° above the horizon — visible tonight.`
                  : `Below the horizon right now. Best viewed from a different time or location.`}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Visible radiants count (bottom-right) ── */}
      <div className="absolute bottom-4 right-3 z-20">
        <div className="glass-card px-3 py-2 rounded-xl">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Radiants Above Horizon</p>
          <p className="text-xl font-bold font-space text-white">{visibleRadiants.length}</p>
          <p className="text-[9px] text-white/30">of {objects.filter(o=>o.type==='radiant').length} tracked showers</p>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-white/18 text-[9px] font-mono tracking-wider">
          ○ rings = meteor radiant points · star positions accurate for right now
        </p>
      </div>
    </div>
  );
}
