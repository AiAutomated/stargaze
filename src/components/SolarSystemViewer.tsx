import React, { useRef, useMemo, useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import {
  ZoomIn, ZoomOut, RotateCcw, X, Sparkles, Play, Pause,
  Calendar
} from 'lucide-react';
import meteorShowersData from '../data/meteorShowers.json';

// ─── ORBITAL MECHANICS ────────────────────────────────────────────────────────
const D2R = Math.PI / 180;

function solveKepler(M: number, e: number): number {
  let E = M;
  for (let k = 0; k < 120; k++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

function norm2pi(a: number): number {
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

function orbToEcl(r: number, nu: number, Omega: number, omega: number, inc: number): THREE.Vector3 {
  const xo = r * Math.cos(nu), yo = r * Math.sin(nu);
  const cO = Math.cos(Omega), sO = Math.sin(Omega);
  const cw = Math.cos(omega), sw = Math.sin(omega);
  const ci = Math.cos(inc), si = Math.sin(inc);
  const x = (cO*cw - sO*sw*ci)*xo + (-cO*sw - sO*cw*ci)*yo;
  const y = (sO*cw + cO*sw*ci)*xo + (-sO*sw + cO*cw*ci)*yo;
  const z = sw*si*xo + cw*si*yo;
  return new THREE.Vector3(x, z, -y);
}

function planetPos(
  a: number, e: number, i_deg: number, Omega_deg: number, obar_deg: number,
  L0: number, Lrate: number, T: number
): THREE.Vector3 {
  const L = norm2pi(D2R * ((L0 + Lrate * T) % 360));
  const obar = norm2pi(D2R * obar_deg);
  const Omega = norm2pi(D2R * Omega_deg);
  const omega = obar - Omega;
  const inc = D2R * i_deg;
  const M = norm2pi(L - obar);
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));
  const r = a * (1 - e * Math.cos(E));
  return orbToEcl(r, nu, Omega, omega, inc);
}

// Comet position from perihelion date
function cometPosFromT(
  a: number, e: number, i_deg: number, Omega_deg: number, omega_deg: number,
  T_periYear: number, T: number
): THREE.Vector3 {
  const yearsFromJ2000 = T * 100;
  const currentYear = 2000 + yearsFromJ2000;
  const period = Math.pow(Math.abs(a), 1.5);
  const yearsSincePeri = currentYear - T_periYear;
  const M = norm2pi((yearsSincePeri / period) * 2 * Math.PI);
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));
  const r = a * (1 - e * Math.cos(E));
  return orbToEcl(r, nu, norm2pi(D2R * Omega_deg), norm2pi(D2R * omega_deg), D2R * i_deg);
}

function genOrbitPath(a: number, e: number, i_deg: number, Omega_deg: number, omega_deg: number, n = 300): THREE.Vector3[] {
  const Omega = norm2pi(D2R * Omega_deg);
  const omega = norm2pi(D2R * omega_deg);
  const inc = D2R * i_deg;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const nu = (k / n) * 2 * Math.PI;
    const r = a * (1 - e*e) / (1 + e * Math.cos(nu));
    if (r > 0 && r < 1500) pts.push(orbToEcl(r, nu, Omega, omega, inc));
  }
  return pts;
}

function julianT(d: Date): number {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (d.getTime() - J2000) / (1000 * 86400 * 36525);
}

function tToDate(T: number): Date {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return new Date(J2000 + T * 36525 * 86400 * 1000);
}

// ─── PLANET DATA ──────────────────────────────────────────────────────────────
interface PlanetDef {
  name: string; color: string; glowColor: string; displayR: number;
  a: number; e: number; i: number; Omega: number; obar: number; L0: number; Lrate: number;
  rings?: { inner: number; outer: number; color: string; opacity: number };
  fact: string;
}

const PLANETS: PlanetDef[] = [
  { name:'Mercury', color:'#a0a0a0', glowColor:'#c8c8c8', displayR:0.018,
    a:0.38709893, e:0.20563069, i:7.00487, Omega:48.33167, obar:77.45645, L0:252.25084, Lrate:149472.67411,
    fact:'Smallest planet. Year = 88 Earth days. Temperature swings from −180 °C to 430 °C.' },
  { name:'Venus', color:'#e8cda0', glowColor:'#ffe0a0', displayR:0.034,
    a:0.72333199, e:0.00677323, i:3.39471, Omega:76.68069, obar:131.53298, L0:181.97973, Lrate:58517.81539,
    fact:'Hottest planet (462 °C average). Spins backwards. Dense CO₂ atmosphere traps heat.' },
  { name:'Earth', color:'#4488cc', glowColor:'#66aaff', displayR:0.038,
    a:1.00000011, e:0.01671022, i:0.00005, Omega:-11.26064, obar:102.94719, L0:100.46435, Lrate:35999.37244,
    fact:'Our pale blue dot. Crosses comet debris trails annually, creating meteor showers. 1 AU = 149.6 million km.' },
  { name:'Mars', color:'#cc4422', glowColor:'#ff6644', displayR:0.024,
    a:1.52366231, e:0.09341233, i:1.85061, Omega:49.57854, obar:336.04084, L0:355.45332, Lrate:19140.30268,
    fact:'Olympus Mons (22 km tall). A year = 687 Earth days. Two tiny moons: Phobos & Deimos.' },
  { name:'Jupiter', color:'#c8884a', glowColor:'#ffaa66', displayR:0.13,
    a:5.20336301, e:0.04839266, i:1.30530, Omega:100.55615, obar:14.75385, L0:34.40438, Lrate:3034.74612,
    fact:'Largest planet (1,300 Earths fit inside). Great Red Spot storm for 350+ years. 95 moons.' },
  { name:'Saturn', color:'#e4d191', glowColor:'#ffee99', displayR:0.10,
    a:9.53707032, e:0.05415060, i:2.48446, Omega:113.71504, obar:92.43194, L0:49.94432, Lrate:1222.49309,
    rings:{ inner:0.135, outer:0.255, color:'#d4c080', opacity:0.55 },
    fact:'Ring system spans 282,000 km but only metres thick. Least dense planet — it would float on water.' },
  { name:'Uranus', color:'#7de8e8', glowColor:'#88ffff', displayR:0.066,
    a:19.19126393, e:0.04716771, i:0.76986, Omega:74.22988, obar:170.96424, L0:313.23218, Lrate:428.48202,
    fact:'Rotates on its side (97.8° axial tilt). Coldest planetary atmosphere (−224 °C). 27 moons.' },
  { name:'Neptune', color:'#4455cc', glowColor:'#5566ff', displayR:0.060,
    a:30.06896348, e:0.00858587, i:1.76917, Omega:131.72169, obar:44.97135, L0:304.88003, Lrate:218.45945,
    fact:'Fastest winds in solar system (2,100 km/h). 1 year = 165 Earth years. Triton orbits retrograde.' },
];

// ─── COMET DATA ───────────────────────────────────────────────────────────────
interface CometDef {
  name: string; showerName: string; color: string;
  a: number; e: number; i: number; Omega: number; omega: number;
  T_periYear: number;   // Year of (or near) most recent perihelion
  peakMonth: number; speed: number; zhr: number; description: string;
}

const COMETS: CometDef[] = [
  { name:'1P/Halley', showerName:'Eta Aquariids & Orionids', color:'#ff9944',
    a:17.8341, e:0.9671, i:162.26, Omega:58.42, omega:111.33, T_periYear:1986.11,
    peakMonth:5, speed:66, zhr:50,
    description:'The most famous comet. Returns every ~76 years. Earth crosses its orbit TWICE: Eta Aquariids (May) and Orionids (October). Observed since at least 240 BC. Last perihelion: 1986. Next: 2061.' },
  { name:'109P/Swift-Tuttle', showerName:'Perseids', color:'#ff4488',
    a:26.09, e:0.9632, i:113.43, Omega:139.38, omega:152.98, T_periYear:1992.95,
    peakMonth:8, speed:59, zhr:100,
    description:'Discovered 1862. Returns every ~130 years. Its 26 km-wide nucleus sheds massive debris. The Perseids are the most popular annual shower, producing up to 100 meteors/hour on warm August nights.' },
  { name:'55P/Tempel-Tuttle', showerName:'Leonids', color:'#ffcc33',
    a:10.334, e:0.9055, i:162.49, Omega:235.27, omega:172.50, T_periYear:1998.16,
    peakMonth:11, speed:71, zhr:15,
    description:'Returns every 33 years. Near a perihelion, Earth hits FRESH debris — Leonid STORMS. In 1833 the sky rained meteors at 100,000+/hour. 1966 saw 150,000/hour. Next perihelion: 2031.' },
  { name:'3200 Phaethon', showerName:'Geminids', color:'#44ff88',
    a:1.2710, e:0.8898, i:22.26, Omega:265.23, omega:322.14, T_periYear:2025.98,
    peakMonth:12, speed:35, zhr:120,
    description:'Unique — an ASTEROID, not a comet! Passes just 0.14 AU from the Sun, where extreme heat causes rock fragments to shed. The Geminids are now the STRONGEST annual shower and intensify each century.' },
  { name:'2P/Encke', showerName:'Taurids', color:'#ff6633',
    a:2.2149, e:0.8482, i:11.78, Omega:334.57, omega:186.54, T_periYear:2023.81,
    peakMonth:11, speed:27, zhr:10,
    description:'Shortest-period comet (3.3 years). Ancient, fragmented stream fills a broad swath of the inner solar system. Taurids are slow but produce bright fireballs and may include several large fragments.' },
  { name:'C/1861 G1 Thatcher', showerName:'Lyrids', color:'#aa88ff',
    a:55.68, e:0.9844, i:79.78, Omega:31.93, omega:213.37, T_periYear:1861.23,
    peakMonth:4, speed:49, zhr:18,
    description:'One of the oldest known comets. Period ~415 years — last seen 1861. The Lyrids have been recorded for 2,700 years. Ancient Chinese texts describe a massive 687 BC outburst "like falling rain."' },
];

// ─── SHARED TIME REF (avoids React re-renders for animation) ─────────────────
const timeOffsetRef = { current: 0 }; // Julian centuries from now
const playingRef   = { current: false };
const speedRef     = { current: 30 };  // days per second

// ─── THREE.JS COMPONENTS ──────────────────────────────────────────────────────

function SunComponent() {
  const glowRef  = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (glowRef.current)  (glowRef.current.material  as THREE.MeshBasicMaterial).opacity = 0.35 + 0.12*Math.sin(t*0.7);
    if (outerRef.current) (outerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.10 + 0.05*Math.sin(t*0.4+1.2);
  });
  return (
    <group>
      <pointLight intensity={5} distance={300} decay={1.4} color="#fff8e0" />
      <ambientLight intensity={0.18} />
      <mesh><sphereGeometry args={[0.12,32,32]}/><meshBasicMaterial color="#fff9d0"/></mesh>
      <mesh ref={glowRef}><sphereGeometry args={[0.20,32,32]}/><meshBasicMaterial color="#ffe060" transparent opacity={0.35} depthWrite={false}/></mesh>
      <mesh ref={outerRef}><sphereGeometry args={[0.35,32,32]}/><meshBasicMaterial color="#ff9900" transparent opacity={0.10} depthWrite={false}/></mesh>
      {/* Sun label */}
      <Html center distanceFactor={8} position={[0, 0.45, 0]}>
        <div style={{ color:'#ffe090', fontSize:'11px', fontFamily:'monospace', whiteSpace:'nowrap', textShadow:'0 0 6px #ff9900', pointerEvents:'none', userSelect:'none' }}>☀ Sun</div>
      </Html>
    </group>
  );
}

function OrbitLine({ a, e, i, Omega, omega, color, opacity = 0.22 }:
  { a: number; e: number; i: number; Omega: number; omega: number; color: string; opacity?: number }) {
  const positions = useMemo(() => {
    const pts = genOrbitPath(a, e, i, Omega, omega, 400);
    return pts.map(p => [p.x, p.y, p.z] as [number,number,number]);
  }, [a, e, i, Omega, omega]);
  if (positions.length < 2) return null;
  return <Line points={positions} color={color} lineWidth={1} transparent opacity={opacity} />;
}

// Earth with texture loader (graceful fallback to color)
function EarthSphere({ displayR }: { displayR: number }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      'https://unpkg.com/three-globe@2.32.4/example/img/earth-blue-marble.jpg',
      (t) => setTex(t),
      undefined,
      () => {} // fallback to solid colour
    );
  }, []);
  return (
    <>
      <mesh>
        <sphereGeometry args={[displayR, 48, 48]} />
        <meshStandardMaterial map={tex ?? undefined} color={tex ? undefined : '#4488cc'} roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[displayR * 1.18, 32, 32]} />
        <meshBasicMaterial color="#88ccff" transparent opacity={0.10} depthWrite={false} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

interface PlanetMeshProps {
  planet: PlanetDef;
  baseT: number;
  onClick: () => void;
  isSelected: boolean;
  showLabels: boolean;
}

function PlanetMesh({ planet, baseT, onClick, isSelected, showLabels }: PlanetMeshProps) {
  const groupRef  = useRef<THREE.Group>(null);
  const glowRef   = useRef<THREE.Mesh>(null);
  const isEarth   = planet.name === 'Earth';

  useFrame(() => {
    const T = baseT + timeOffsetRef.current;
    const pos = planetPos(planet.a, planet.e, planet.i, planet.Omega, planet.obar, planet.L0, planet.Lrate, T);
    if (groupRef.current) groupRef.current.position.copy(pos);
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.6 : 0.28;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[planet.displayR * 1.5, 16, 16]} />
        <meshBasicMaterial color={planet.glowColor} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {/* Planet body */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <sphereGeometry args={[planet.displayR, 32, 32]} />
        {isEarth
          ? null  /* Earth uses EarthSphere below */
          : <meshStandardMaterial color={planet.color} roughness={0.75} metalness={0.05}
              emissive={isSelected ? planet.glowColor : '#000000'} emissiveIntensity={isSelected ? 0.3 : 0} />
        }
      </mesh>
      {isEarth && <EarthSphere displayR={planet.displayR} />}
      {/* Saturn rings */}
      {planet.rings && (
        <mesh rotation={[Math.PI / 2, 0, 0.45]}>
          <ringGeometry args={[planet.rings.inner, planet.rings.outer, 64]} />
          <meshBasicMaterial color={planet.rings.color} transparent opacity={planet.rings.opacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {/* Planet label */}
      {showLabels && (
        <Html center distanceFactor={6} position={[0, planet.displayR + 0.06, 0]}>
          <div style={{
            color: planet.glowColor, fontSize:'10px', fontFamily:'monospace',
            whiteSpace:'nowrap', textShadow:`0 0 8px ${planet.glowColor}`,
            pointerEvents:'none', userSelect:'none', opacity: isSelected ? 1 : 0.8
          }}>
            {planet.name === 'Earth' ? '🌍 Earth' : planet.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// Animated comet nucleus — moves along its orbit in real-time
function CometNucleus({ comet, baseT, isActive }: { comet: CometDef; baseT: number; isActive: boolean }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const T = baseT + timeOffsetRef.current;
    try {
      const pos = cometPosFromT(comet.a, comet.e, comet.i, comet.Omega, comet.omega, comet.T_periYear, T);
      if (meshRef.current)  meshRef.current.position.copy(pos);
      if (trailRef.current) {
        trailRef.current.position.copy(pos);
        const pulse = 0.3 + 0.2 * Math.sin(clock.getElapsedTime() * 2.5);
        (trailRef.current.material as THREE.MeshBasicMaterial).opacity = isActive ? pulse * 0.8 : pulse * 0.35;
      }
    } catch (_) {}
  });

  const col = new THREE.Color(comet.color);

  return (
    <>
      {/* Nucleus body */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[isActive ? 0.035 : 0.022, 8, 8]} />
        <meshStandardMaterial color={comet.color} emissive={comet.color} emissiveIntensity={0.9} />
      </mesh>
      {/* Coma glow */}
      <mesh ref={trailRef}>
        <sphereGeometry args={[isActive ? 0.09 : 0.055, 8, 8]} />
        <meshBasicMaterial color={comet.color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </>
  );
}

function DebrisTrail({ comet, isActive, cameraDist }:
  { comet: CometDef; isActive: boolean; cameraDist: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = isActive ? 5000 : 2500;

  const { positions, colors } = useMemo(() => {
    const orbitPts = genOrbitPath(comet.a, comet.e, comet.i, comet.Omega, comet.omega, 800);
    if (!orbitPts.length) return { positions: new Float32Array(0), colors: new Float32Array(0) };
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const rgb = new THREE.Color(comet.color);
    for (let k = 0; k < COUNT; k++) {
      const idx = Math.floor(Math.random() * (orbitPts.length - 1));
      const bp = orbitPts[idx].clone().lerp(orbitPts[Math.min(idx+1, orbitPts.length-1)], Math.random());
      const spread = 0.03 + Math.random() * 0.10;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      bp.x += spread * Math.sin(phi) * Math.cos(theta);
      bp.y += spread * Math.sin(phi) * Math.sin(theta) * 0.25;
      bp.z += spread * Math.cos(phi);
      pos[k*3]=bp.x; pos[k*3+1]=bp.y; pos[k*3+2]=bp.z;
      const b = 0.4 + Math.random() * 0.6;
      col[k*3]=rgb.r*b; col[k*3+1]=rgb.g*b; col[k*3+2]=rgb.b*b;
    }
    return { positions: pos, colors: col };
  }, [comet, COUNT]);

  useFrame(({ clock }) => {
    if (pointsRef.current && isActive) {
      (pointsRef.current.material as THREE.PointsMaterial).opacity = 0.45 + 0.20 * Math.sin(clock.getElapsedTime() * 1.6);
    }
  });

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  if (!positions.length) return null;
  const ptSize = Math.max(0.008, Math.min(0.025, cameraDist * 0.0008));

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial size={ptSize} vertexColors transparent opacity={isActive ? 0.50 : 0.25} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function AsteroidBelt() {
  const COUNT = 2200;
  const { geo } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let k = 0; k < COUNT; k++) {
      const r = 2.1 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      pos[k*3]=r*Math.cos(theta); pos[k*3+1]=(Math.random()-0.5)*0.28; pos[k*3+2]=-r*Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g };
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.008} color="#887755" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function KuiperBelt() {
  const COUNT = 1400;
  const { geo } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let k = 0; k < COUNT; k++) {
      const r = 30 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      pos[k*3]=r*Math.cos(theta); pos[k*3+1]=(Math.random()-0.5)*5; pos[k*3+2]=-r*Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g };
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.06} color="#556677" transparent opacity={0.28} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function OortCloud() {
  const COUNT = 700;
  const { geo } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let k = 0; k < COUNT; k++) {
      const r = 200 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      pos[k*3]=r*Math.sin(phi)*Math.cos(theta); pos[k*3+1]=r*Math.cos(phi); pos[k*3+2]=r*Math.sin(phi)*Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g };
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.5} color="#334455" transparent opacity={0.22} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// Advances simulation time each frame
function TimeAdvancer({ baseT, onDateChange }: { baseT: number; onDateChange: (d: Date) => void }) {
  const updateTimer = useRef(0);
  useFrame((_, delta) => {
    if (playingRef.current) {
      // speedRef = days per second → convert to centuries per second
      timeOffsetRef.current += delta * speedRef.current / 36525;
    }
    updateTimer.current += delta;
    if (updateTimer.current > 0.4) {
      updateTimer.current = 0;
      onDateChange(tToDate(baseT + timeOffsetRef.current));
    }
  });
  return null;
}

function CameraTracker({ onDistChange }: { onDistChange: (d: number) => void }) {
  const { camera } = useThree();
  const last = useRef(0);
  useFrame(() => {
    const d = camera.position.length();
    if (Math.abs(d - last.current) > 0.3) { last.current = d; onDistChange(d); }
  });
  return null;
}

// ─── MAIN SCENE ───────────────────────────────────────────────────────────────
interface Selected { type: 'planet' | 'comet'; data: PlanetDef | CometDef }

function SolarSystemScene({
  baseT, activeShowerNames, onSelect, showDebris, showOrbits, showKuiper, showOort,
  showLabels, cameraDist
}: {
  baseT: number; activeShowerNames: Set<string>; onSelect: (s: Selected | null) => void;
  showDebris: boolean; showOrbits: boolean; showKuiper: boolean; showOort: boolean;
  showLabels: boolean; cameraDist: number;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);

  const handleSelectPlanet = useCallback((planet: PlanetDef) => {
    const s: Selected = { type:'planet', data:planet };
    setSelected(s); onSelect(s);
  }, [onSelect]);

  const handleSelectComet = useCallback((comet: CometDef) => {
    const s: Selected = { type:'comet', data:comet };
    setSelected(s); onSelect(s);
  }, [onSelect]);

  return (
    <>
      <Stars radius={800} depth={200} count={9000} factor={5} saturation={0.15} fade speed={0.25} />
      <SunComponent />
      <AsteroidBelt />
      {showKuiper && <KuiperBelt />}
      {showOort   && <OortCloud />}

      {/* Planet orbits (static ellipses) */}
      {showOrbits && PLANETS.map(p => (
        <OrbitLine key={p.name} a={p.a} e={p.e} i={p.i} Omega={p.Omega} omega={p.obar - p.Omega}
          color={p.name==='Earth' ? '#4488ff' : '#ffffff'}
          opacity={p.name==='Earth' ? 0.45 : 0.12} />
      ))}

      {/* Comet orbits + debris trails + animated nuclei */}
      {COMETS.map(c => {
        const isActive = activeShowerNames.has(c.showerName);
        return (
          <group key={c.name}>
            {showOrbits && (
              <group onClick={(e) => { e.stopPropagation(); handleSelectComet(c); }}>
                <OrbitLine a={c.a} e={c.e} i={c.i} Omega={c.Omega} omega={c.omega}
                  color={c.color} opacity={isActive ? 0.6 : 0.30} />
              </group>
            )}
            {showDebris && <DebrisTrail comet={c} isActive={isActive} cameraDist={cameraDist} />}
            {/* Animated comet nucleus */}
            <CometNucleus comet={c} baseT={baseT} isActive={isActive} />
          </group>
        );
      })}

      {/* Planets (positions updated via useFrame inside PlanetMesh) */}
      {PLANETS.map(p => (
        <PlanetMesh key={p.name} planet={p} baseT={baseT}
          onClick={() => handleSelectPlanet(p)}
          isSelected={selected?.type==='planet' && (selected.data as PlanetDef).name===p.name}
          showLabels={showLabels} />
      ))}

      {/* Click empty space to deselect */}
      <mesh scale={[2000,2000,2000]} onClick={() => { setSelected(null); onSelect(null); }} visible={false}>
        <sphereGeometry /><meshBasicMaterial />
      </mesh>
    </>
  );
}

// ─── ZONE INFO ────────────────────────────────────────────────────────────────
function getZone(d: number): { zone: string; desc: string; color: string } {
  if (d < 3)   return { zone:'Inner Solar System', desc:'Rocky planets, asteroid belt', color:'#88ccff' };
  if (d < 12)  return { zone:'Outer Solar System', desc:'Gas & ice giants', color:'#aaffcc' };
  if (d < 40)  return { zone:'Trans-Neptunian Region', desc:'Beyond Neptune — Kuiper Belt region', color:'#ccaaff' };
  if (d < 80)  return { zone:'Kuiper Belt', desc:'Icy bodies — Pluto\'s neighbourhood', color:'#ffccaa' };
  if (d < 300) return { zone:'Inner Oort Cloud', desc:'Reservoir of long-period comets', color:'#ffaacc' };
  return { zone:'Outer Oort Cloud', desc:'~1 light-year from the Sun', color:'#ff8888' };
}

// Speed presets: days per simulated second
const SPEED_PRESETS = [
  { label: '1d/s',  days: 1    },
  { label: '1wk/s', days: 7    },
  { label: '1mo/s', days: 30   },
  { label: '1yr/s', days: 365  },
  { label: '10yr/s',days: 3650 },
];

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function SolarSystemViewer() {
  const baseT = useMemo(() => julianT(new Date()), []);
  const [cameraDist, setCameraDist] = useState(18);
  const [selected,   setSelected]   = useState<Selected | null>(null);
  const [showDebris, setShowDebris] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showKuiper, setShowKuiper] = useState(false);
  const [showOort,   setShowOort]   = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  // Time controls
  const [playing,    setPlaying]    = useState(false);
  const [speedIdx,   setSpeedIdx]   = useState(3);    // default 1yr/s
  const [simDate,    setSimDate]    = useState(new Date());
  const [showTimeUI, setShowTimeUI] = useState(false);
  const controlsRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);

  // Sync playing & speed to refs (read by TimeAdvancer inside Canvas)
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = SPEED_PRESETS[speedIdx].days; }, [speedIdx]);

  // Share / snapshot — encode selected object + cam dist into URL hash
  const shareSnapshot = useCallback(() => {
    const params: Record<string, string> = { z: cameraDist.toFixed(1) };
    if (selected) {
      params.type = selected.type;
      params.name = selected.type === 'planet'
        ? (selected.data as PlanetDef).name
        : (selected.data as CometDef).name;
    }
    const hash = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const url = `${window.location.origin}/globe?solar=1&${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback
      window.prompt('Copy this link:', url);
    });
  }, [cameraDist, selected]);

  // Auto-enable deep space layers
  useEffect(() => {
    setShowKuiper(cameraDist > 32);
    setShowOort(cameraDist > 100);
  }, [cameraDist]);

  const activeShowerNames = useMemo(() => {
    const now = new Date();
    const s = new Set<string>();
    (meteorShowersData as any[]).forEach((sh: any) => {
      if (now >= new Date(sh.start) && now <= new Date(sh.end)) s.add(sh.name);
    });
    return s;
  }, []);

  const zone = getZone(cameraDist);

  const zoomTo = useCallback((dist: number) => {
    if (!controlsRef.current) return;
    const cam = controlsRef.current.object as THREE.PerspectiveCamera;
    cam.position.copy(cam.position.clone().normalize().multiplyScalar(dist));
    controlsRef.current.update();
  }, []);

  const resetSim = useCallback(() => {
    timeOffsetRef.current = 0;
    setSimDate(new Date());
    setPlaying(false);
  }, []);

  const isToday = Math.abs(timeOffsetRef.current) < 0.001;
  const simYear = simDate.getFullYear();

  return (
    <div className="relative w-full h-full" style={{ background:'#000408' }}>
      {/* Canvas */}
      <Canvas camera={{ position:[0,14,18], fov:45, near:0.01, far:5000 }}
        gl={{ antialias:true, alpha:false }} style={{ width:'100%', height:'100%' }}>
        <Suspense fallback={null}>
          <CameraTracker onDistChange={setCameraDist} />
          <TimeAdvancer baseT={baseT} onDateChange={setSimDate} />
          <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.06}
            minDistance={0.5} maxDistance={800} makeDefault />
          <SolarSystemScene
            baseT={baseT} activeShowerNames={activeShowerNames} onSelect={setSelected}
            showDebris={showDebris} showOrbits={showOrbits} showKuiper={showKuiper}
            showOort={showOort} showLabels={showLabels} cameraDist={cameraDist} />
        </Suspense>
      </Canvas>

      {/* ── Zone label — positioned below the toggle ── */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold tracking-widest uppercase"
          style={{ background:'rgba(0,0,0,0.60)', border:`1px solid ${zone.color}33`, color:zone.color }}>
          ⦿ {zone.zone} — {cameraDist.toFixed(1)} AU
        </div>
        <p className="text-white/30 text-[9px] mt-0.5 font-mono">{zone.desc}</p>
      </div>

      {/* ── Sim date badge (when not today) ── */}
      <AnimatePresence>
        {!isToday && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="px-3 py-1 rounded-full text-[10px] font-mono"
              style={{ background:'rgba(120,60,180,0.4)', border:'1px solid rgba(180,120,255,0.4)', color:'#cc99ff' }}>
              ⏱ Simulating {simDate.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top-right controls ── */}
      <div className="absolute top-14 right-3 z-20 flex flex-col gap-2">
        {/* Zoom + reset */}
        <div className="glass-card p-2 rounded-xl flex flex-col gap-1.5">
          <button onClick={() => zoomTo(Math.max(0.5, cameraDist * 0.45))}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button onClick={() => zoomTo(cameraDist * 2.2)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <div className="w-full h-px bg-white/10" />
          <button onClick={() => { if (controlsRef.current) controlsRef.current.reset(); }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Reset View">
            <RotateCcw size={14} />
          </button>
          <div className="w-full h-px bg-white/10" />
          <button onClick={shareSnapshot}
            className={`p-1.5 rounded-lg transition-colors ${copied ? 'text-green-400' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Share this view">
            <span className="text-[13px]">{copied ? '✓' : '🔗'}</span>
          </button>
        </div>

        {/* Quick zoom presets */}
        <div className="glass-card p-2 rounded-xl flex flex-col gap-1">
          {([['Earth',2],['Inner',8],['System',22],['Kuiper',60],['Oort',250]] as [string,number][]).map(([label,dist]) => (
            <button key={label} onClick={() => zoomTo(dist)}
              className="text-[10px] px-2 py-1 rounded-lg hover:bg-white/10 text-white/45 hover:text-white transition-colors font-mono text-left">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Time controls (bottom centre) ── */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <AnimatePresence>
          {showTimeUI && (
            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:10 }}
              className="glass-card p-3 rounded-2xl flex flex-col items-center gap-2">
              <p className="text-[9px] text-white/40 font-mono uppercase tracking-widest">Simulation Speed</p>
              <div className="flex gap-1">
                {SPEED_PRESETS.map((sp,i) => (
                  <button key={i} onClick={() => setSpeedIdx(i)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-colors ${
                      speedIdx === i ? 'bg-purple-600/60 text-white' : 'text-white/40 hover:text-white hover:bg-white/8'
                    }`}>{sp.label}</button>
                ))}
              </div>
              {!isToday && (
                <button onClick={resetSim} className="text-[10px] text-purple-300/70 hover:text-purple-200 font-mono flex items-center gap-1">
                  <RotateCcw size={10} /> Reset to today
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play/Pause + time icon */}
        <div className="glass-card p-2 rounded-2xl flex items-center gap-2">
          <button onClick={() => setShowTimeUI(v => !v)}
            className={`p-1.5 rounded-lg transition-colors ${showTimeUI ? 'bg-purple-600/40 text-purple-300' : 'text-white/40 hover:text-white'}`}
            title="Time controls">
            <Calendar size={14} />
          </button>
          <button onClick={() => setPlaying(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              playing ? 'bg-purple-600/70 text-white' : 'bg-white/8 text-white/70 hover:bg-white/15 hover:text-white'
            }`}>
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? 'Pause' : 'Animate'}
          </button>
          {playing && (
            <span className="text-[10px] font-mono text-purple-300 animate-pulse">
              {SPEED_PRESETS[speedIdx].label}
            </span>
          )}
        </div>
      </div>

      {/* ── Layer toggles (bottom-left) ── */}
      <div className="absolute bottom-4 left-3 z-20">
        <div className="glass-card p-3 rounded-xl flex flex-col gap-2">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-0.5">Layers</p>
          {[
            { key:'orbits', label:'Orbit Paths',   val:showOrbits, set:setShowOrbits, color:'#4488ff' },
            { key:'labels', label:'Planet Names',  val:showLabels, set:setShowLabels, color:'#88ddff' },
            { key:'debris', label:'Debris Trails', val:showDebris, set:setShowDebris, color:'#ff9944' },
            { key:'kuiper', label:'Kuiper Belt',   val:showKuiper, set:setShowKuiper, color:'#88aaff' },
            { key:'oort',   label:'Oort Cloud',    val:showOort,   set:setShowOort,   color:'#ff88aa' },
          ].map(({ key,label,val,set,color }) => (
            <button key={key} onClick={() => set(!val)}
              className="flex items-center gap-2 text-[11px] text-white/60 hover:text-white transition-colors">
              <div className="w-3 h-3 rounded-sm border flex items-center justify-center"
                style={{ borderColor:color, background:val ? color : 'transparent' }}>
                {val && <span className="text-black text-[8px]">✓</span>}
              </div>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Meteor shower legend (bottom-right) ── */}
      <AnimatePresence>
        {showLegend && (
          <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}
            className="absolute bottom-4 right-3 z-20 glass-card p-3 rounded-xl w-52 max-h-72 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Shower Sources</p>
              <button onClick={() => setShowLegend(false)} className="text-white/30 hover:text-white transition-colors"><X size={11}/></button>
            </div>
            {COMETS.map(c => {
              const isActive = activeShowerNames.has(c.showerName);
              return (
                <button key={c.name} onClick={() => setSelected({ type:'comet', data:c })}
                  className="w-full flex items-center gap-2 py-1 text-left hover:bg-white/5 rounded px-1 transition-colors group">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
                    style={{ background:c.color, boxShadow:isActive ? `0 0 6px ${c.color}` : 'none' }} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/80 truncate font-medium">{c.showerName}</p>
                    <p className="text-[9px] text-white/35 truncate">{c.name}</p>
                  </div>
                  {isActive && <span className="text-[8px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded font-mono ml-auto flex-shrink-0">LIVE</span>}
                </button>
              );
            })}
            <div className="mt-2 pt-2 border-t border-white/8">
              <p className="text-[9px] text-white/25 leading-relaxed">
                Coloured dots = comet/asteroid nuclei moving in real-time. Click any trail for details. Use Animate to watch orbits evolve.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!showLegend && (
        <button onClick={() => setShowLegend(true)}
          className="absolute bottom-4 right-3 z-20 glass-card p-2 rounded-xl text-white/50 hover:text-white transition-colors">
          <Sparkles size={15} />
        </button>
      )}

      {/* ── Selected object panel ── */}
      <AnimatePresence>
        {selected && (
          <motion.div key="panel" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
            className="absolute left-3 top-28 z-20 glass-card p-4 rounded-2xl w-72">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                {selected.type === 'comet' ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background:(selected.data as CometDef).color }} />
                      <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Meteor Shower Source</p>
                    </div>
                    <h3 className="text-base font-bold font-space">{(selected.data as CometDef).showerName}</h3>
                    <p className="text-xs text-white/50">{(selected.data as CometDef).name}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider mb-1">Planet</p>
                    <h3 className="text-base font-bold font-space">{(selected.data as PlanetDef).name}</h3>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={shareSnapshot}
                  className={`p-1.5 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all ${
                    copied ? 'bg-green-500/20 text-green-400' : 'text-white/30 hover:text-white hover:bg-white/8'
                  }`}
                  title="Copy shareable link">
                  {copied ? '✓ Copied' : '🔗'}
                </button>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white"><X size={15}/></button>
              </div>
            </div>

            {selected.type === 'comet' && (() => {
              const c = selected.data as CometDef;
              const period = Math.pow(Math.abs(c.a), 1.5);
              return (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label:'Peak ZHR', val:c.zhr.toString() },
                      { label:'Speed', val:`${c.speed} km/s` },
                      { label:'Period', val: period > 200 ? `${Math.round(period)}yr` : `${period.toFixed(1)}yr` },
                    ].map(({ label,val }) => (
                      <div key={label} className="text-center p-2 rounded-xl" style={{ background:'rgba(255,255,255,0.04)' }}>
                        <p className="text-sm font-bold font-space" style={{ color:c.color }}>{val}</p>
                        <p className="text-[9px] text-white/35 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-3">{c.description}</p>
                  <div className="p-2.5 rounded-xl border" style={{ borderColor:`${c.color}33`, background:`${c.color}08` }}>
                    <p className="text-[9px] text-white/40 uppercase font-mono tracking-wider mb-1">How it works</p>
                    <p className="text-[10px] text-white/55 leading-relaxed">
                      Earth's orbit crosses the {c.name} debris stream annually. Particles enter the atmosphere
                      at {c.speed} km/s, vaporising at ~100 km altitude — those glowing streaks are meteor shower meteors.
                    </p>
                  </div>
                </>
              );
            })()}

            {selected.type === 'planet' && (() => {
              const p = selected.data as PlanetDef;
              const T = baseT + timeOffsetRef.current;
              const pos = planetPos(p.a, p.e, p.i, p.Omega, p.obar, p.L0, p.Lrate, T);
              const period = Math.pow(p.a, 1.5);
              return (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label:'From Sun now', val:`${pos.length().toFixed(3)} AU` },
                      { label:'Orbital Period', val:`${period.toFixed(2)} yr` },
                    ].map(({ label,val }) => (
                      <div key={label} className="p-2 rounded-xl" style={{ background:'rgba(255,255,255,0.04)' }}>
                        <p className="text-xs font-bold font-space" style={{ color:p.glowColor }}>{val}</p>
                        <p className="text-[9px] text-white/35 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/55 leading-relaxed">{p.fact}</p>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Earth perspective hint ── */}
      <AnimatePresence>
        {cameraDist < 4 && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 glass-card px-4 py-2.5 rounded-2xl max-w-sm text-center pointer-events-none">
            <p className="text-[11px] text-blue-300 font-mono mb-0.5">🌍 Earth's Perspective</p>
            <p className="text-[10px] text-white/45 leading-snug">
              The coloured debris trails cross Earth's orbit. Every year on the same date, Earth ploughs through them — that's your meteor shower. Zoom out to see the full picture.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Deep space hints ── */}
      <AnimatePresence>
        {cameraDist > 250 && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center pointer-events-none">
            <p className="text-white/20 text-xs font-mono">The Oort Cloud extends to ~100,000 AU</p>
            <p className="text-white/12 text-[10px] font-mono mt-1">Nearest star (Proxima Centauri) = 268,000 AU</p>
            <p className="text-white/8 text-[9px] font-mono mt-0.5">Milky Way Galaxy = 1.89 billion AU across</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom hint */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-white/18 text-[9px] font-mono tracking-wider">
          Drag to rotate · Scroll to zoom · Click objects · Planetary positions accurate for {isToday ? 'today' : simDate.getFullYear()}
        </p>
      </div>
    </div>
  );
}
