import React, { useRef, useMemo, useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, Info, X, Globe, Sparkles, ChevronRight, RotateCcw } from 'lucide-react';
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

// Orbital plane → ecliptic frame. Maps to Three.js XZ = ecliptic plane, Y = ecliptic north.
function orbToEcl(r: number, nu: number, Omega: number, omega: number, inc: number): THREE.Vector3 {
  const xo = r * Math.cos(nu), yo = r * Math.sin(nu);
  const cO = Math.cos(Omega), sO = Math.sin(Omega);
  const cw = Math.cos(omega), sw = Math.sin(omega);
  const ci = Math.cos(inc), si = Math.sin(inc);
  const x = (cO*cw - sO*sw*ci)*xo + (-cO*sw - sO*cw*ci)*yo;
  const y = (sO*cw + cO*sw*ci)*xo + (-sO*sw + cO*cw*ci)*yo;
  const z = sw*si*xo + cw*si*yo;
  return new THREE.Vector3(x, z, -y);   // ecliptic (x,y,z) → Three.js (x,z,-y)
}

// Planet position from JPL mean-longitude Keplerian elements (T = Julian centuries from J2000)
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

// Generate full orbit path for display
function genOrbitPath(a: number, e: number, i_deg: number, Omega_deg: number, omega_deg: number, n = 300): THREE.Vector3[] {
  const Omega = norm2pi(D2R * Omega_deg);
  const omega = norm2pi(D2R * omega_deg);
  const inc   = D2R * i_deg;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const nu = (k / n) * 2 * Math.PI;
    const r = a * (1 - e*e) / (1 + e * Math.cos(nu));
    if (r > 0 && r < 1500) pts.push(orbToEcl(r, nu, Omega, omega, inc));
  }
  return pts;
}

// Julian centuries from J2000 for a given Date
function julianT(d: Date): number {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (d.getTime() - J2000) / (1000 * 86400 * 36525);
}

// ─── PLANET DATA (JPL J2000 elements) ────────────────────────────────────────
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
    fact:'Our pale blue dot. Crosses comet debris trails, creating meteor showers. 1 AU = 149.6 million km.' },
  { name:'Mars', color:'#cc4422', glowColor:'#ff6644', displayR:0.024,
    a:1.52366231, e:0.09341233, i:1.85061, Omega:49.57854, obar:336.04084, L0:355.45332, Lrate:19140.30268,
    fact:'Olympus Mons (22 km tall). A year = 687 Earth days. Two tiny moons: Phobos & Deimos.' },
  { name:'Jupiter', color:'#c8884a', glowColor:'#ffaa66', displayR:0.13,
    a:5.20336301, e:0.04839266, i:1.30530, Omega:100.55615, obar:14.75385, L0:34.40438, Lrate:3034.74612,
    fact:'Largest planet (1,300 Earths fit inside). Great Red Spot = ongoing storm for 350+ years. 95 moons.' },
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

// ─── COMET / PARENT BODY DATA ─────────────────────────────────────────────────
interface CometDef {
  name: string; showerName: string; color: string; trailColor: string;
  a: number; e: number; i: number; Omega: number; omega: number;
  peakMonth: number; speed: number; zhr: number; description: string;
}

const COMETS: CometDef[] = [
  { name:'1P/Halley', showerName:'Eta Aquariids & Orionids', color:'#ff9944', trailColor:'#ff9944',
    a:17.8341, e:0.9671, i:162.26, Omega:58.42, omega:111.33,
    peakMonth:5, speed:66, zhr:50,
    description:'The most famous comet. Returns every ~76 years. Earth crosses its orbit TWICE: Eta Aquariids (May) and Orionids (October). Observed since at least 240 BC. Last perihelion: 1986. Next: 2061.' },
  { name:'109P/Swift-Tuttle', showerName:'Perseids', color:'#ff4488', trailColor:'#ff4488',
    a:26.09, e:0.9632, i:113.43, Omega:139.38, omega:152.98,
    peakMonth:8, speed:59, zhr:100,
    description:'Discovered 1862. Returns every ~130 years. Its 26 km-wide nucleus sheds massive debris. The Perseids are the most popular annual shower, producing up to 100 meteors/hour in warm August nights.' },
  { name:'55P/Tempel-Tuttle', showerName:'Leonids', color:'#ffcc33', trailColor:'#ffcc33',
    a:10.334, e:0.9055, i:162.49, Omega:235.27, omega:172.50,
    peakMonth:11, speed:71, zhr:15,
    description:'Returns every 33 years. Near a perihelion passage, Earth hits FRESH debris: Leonid STORMS occur. In 1833 the sky rained meteors at 100,000+/hour. 1966 saw 150,000/hour. Next perihelion: 2031.' },
  { name:'3200 Phaethon', showerName:'Geminids', color:'#44ff88', trailColor:'#44ff88',
    a:1.2710, e:0.8898, i:22.26, Omega:265.23, omega:322.14,
    peakMonth:12, speed:35, zhr:120,
    description:'Unique — an ASTEROID, not a comet! Passes just 0.14 AU from the Sun, where extreme heat causes it to shed rock fragments. The Geminids are now the STRONGEST annual shower and intensify each century.' },
  { name:'2P/Encke', showerName:'Taurids', color:'#ff6633', trailColor:'#ff6633',
    a:2.2149, e:0.8482, i:11.78, Omega:334.57, omega:186.54,
    peakMonth:11, speed:27, zhr:10,
    description:'Shortest-period comet (3.3 years). Ancient, fragmented stream fills a broad swath of the inner solar system. Taurids are slow but produce bright fireballs. The debris complex may include several large fragments.' },
  { name:'C/1861 G1 Thatcher', showerName:'Lyrids', color:'#aa88ff', trailColor:'#aa88ff',
    a:55.68, e:0.9844, i:79.78, Omega:31.93, omega:213.37,
    peakMonth:4, speed:49, zhr:18,
    description:'One of the oldest known comets. Period ~415 years — last seen 1861. The Lyrids have been recorded for 2,700 years. Ancient Chinese texts describe a massive 687 BC outburst "like falling rain."' },
];

// ─── THREE.JS COMPONENTS ──────────────────────────────────────────────────────

function SunComponent() {
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.12 * Math.sin(t * 0.7);
    }
    if (outerRef.current) {
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.06 * Math.sin(t * 0.4 + 1.2);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <pointLight intensity={4.0} distance={200} decay={1.5} color="#fff8e0" />
      <ambientLight intensity={0.15} />
      {/* Core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshBasicMaterial color="#fff9d0" />
      </mesh>
      {/* Inner glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshBasicMaterial color="#ffe060" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {/* Outer corona */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[0.30, 32, 32]} />
        <meshBasicMaterial color="#ff9900" transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

function OrbitLine({ a, e, i, Omega, omega, color, opacity = 0.22 }:
  { a: number; e: number; i: number; Omega: number; omega: number; color: string; opacity?: number }) {
  const pts = useMemo(() => genOrbitPath(a, e, i, Omega, omega, 400), [a, e, i, Omega, omega]);
  const positions = useMemo(() => pts.map(p => [p.x, p.y, p.z] as [number,number,number]), [pts]);
  if (positions.length < 2) return null;
  return (
    <Line points={positions} color={color} lineWidth={1} transparent opacity={opacity} />
  );
}

function PlanetMesh({ planet, position, onClick, isSelected, T }:
  { planet: PlanetDef; position: THREE.Vector3; onClick: () => void; isSelected: boolean; T: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (isSelected && meshRef.current) {
      meshRef.current.rotation.y += 0.008;
    }
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.55 : 0.28;
    }
  });

  const isEarth = planet.name === 'Earth';

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[planet.displayR * (isEarth ? 1.6 : 1.45), 16, 16]} />
        <meshBasicMaterial color={planet.glowColor} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {/* Planet sphere */}
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <sphereGeometry args={[planet.displayR, 32, 32]} />
        <meshStandardMaterial
          color={planet.color}
          roughness={0.75}
          metalness={0.05}
          emissive={isSelected ? planet.glowColor : '#000000'}
          emissiveIntensity={isSelected ? 0.25 : 0}
        />
      </mesh>
      {/* Atmosphere for Earth */}
      {isEarth && (
        <mesh>
          <sphereGeometry args={[planet.displayR * 1.18, 32, 32]} />
          <meshBasicMaterial color="#88ccff" transparent opacity={0.12} depthWrite={false} side={THREE.BackSide} />
        </mesh>
      )}
      {/* Saturn rings */}
      {planet.rings && (
        <mesh rotation={[Math.PI / 2, 0, 0.45]}>
          <ringGeometry args={[planet.rings.inner, planet.rings.outer, 64]} />
          <meshBasicMaterial color={planet.rings.color} transparent opacity={planet.rings.opacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function DebrisTrail({ comet, isActive }:
  { comet: CometDef; isActive: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = isActive ? 6000 : 3000;

  const { positions, colors } = useMemo(() => {
    const orbitPts = genOrbitPath(comet.a, comet.e, comet.i, comet.Omega, comet.omega, 800);
    if (orbitPts.length === 0) return { positions: new Float32Array(0), colors: new Float32Array(0) };

    // Sample random points along orbit, with spread perpendicular to orbit
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const hex = comet.trailColor;
    const rgb = new THREE.Color(hex);

    for (let k = 0; k < COUNT; k++) {
      const idx = Math.floor(Math.random() * (orbitPts.length - 1));
      const p0 = orbitPts[idx];
      const p1 = orbitPts[Math.min(idx+1, orbitPts.length-1)];
      const t = Math.random();
      const bp = p0.clone().lerp(p1, t);

      // Perpendicular spread (debris cloud width ~0.05-0.15 AU)
      const spread = 0.04 + Math.random() * 0.12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      bp.x += spread * Math.sin(phi) * Math.cos(theta);
      bp.y += spread * Math.sin(phi) * Math.sin(theta) * 0.3; // thin disk
      bp.z += spread * Math.cos(phi);

      pos[k*3]   = bp.x;
      pos[k*3+1] = bp.y;
      pos[k*3+2] = bp.z;

      const brightness = 0.4 + Math.random() * 0.6;
      col[k*3]   = rgb.r * brightness;
      col[k*3+1] = rgb.g * brightness;
      col[k*3+2] = rgb.b * brightness;
    }
    return { positions: pos, colors: col };
  }, [comet, COUNT]);

  useFrame(({ clock }) => {
    if (pointsRef.current && isActive) {
      const mat = pointsRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.45 + 0.25 * Math.sin(clock.getElapsedTime() * 1.8);
    }
  });

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  if (positions.length === 0) return null;

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={isActive ? 0.022 : 0.014}
        vertexColors
        transparent
        opacity={isActive ? 0.55 : 0.30}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function AsteroidBelt() {
  const COUNT = 2500;
  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let k = 0; k < COUNT; k++) {
      // Spread between 2.1 and 3.3 AU with Gaussian-ish concentration at 2.7 AU
      const r = 2.1 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const inclRand = (Math.random() - 0.5) * 0.3;   // slight inclination spread
      pos[k*3]   = r * Math.cos(theta);
      pos[k*3+1] = inclRand;
      pos[k*3+2] = -r * Math.sin(theta);
    }
    return pos;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  return (
    <points geometry={geo}>
      <pointsMaterial size={0.008} color="#888877" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function KuiperBelt() {
  const COUNT = 1500;
  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let k = 0; k < COUNT; k++) {
      const r = 30 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const inclRand = (Math.random() - 0.5) * 6;
      pos[k*3]   = r * Math.cos(theta);
      pos[k*3+1] = inclRand;
      pos[k*3+2] = -r * Math.sin(theta);
    }
    return pos;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  return (
    <points geometry={geo}>
      <pointsMaterial size={0.06} color="#556677" transparent opacity={0.30} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function OortCloud() {
  const COUNT = 800;
  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let k = 0; k < COUNT; k++) {
      const r = 200 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      pos[k*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[k*3+1] = r * Math.cos(phi);
      pos[k*3+2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  return (
    <points geometry={geo}>
      <pointsMaterial size={0.5} color="#334455" transparent opacity={0.25} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// Zoom-level label sprites (appear/disappear based on camera distance)
function DepthLabel({ position, text, visibleAbove, visibleBelow, color = 'rgba(255,255,255,0.5)' }:
  { position: [number,number,number]; text: string; visibleAbove?: number; visibleBelow?: number; color?: string }) {
  const { camera } = useThree();
  const [vis, setVis] = useState(false);

  useFrame(() => {
    const d = camera.position.length();
    const above = visibleAbove ?? 0;
    const below = visibleBelow ?? Infinity;
    setVis(d >= above && d <= below);
  });

  if (!vis) return null;
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function CameraController({ onDistChange }: { onDistChange: (d: number) => void }) {
  const { camera } = useThree();
  const lastDist = useRef(0);

  useFrame(() => {
    const d = camera.position.length();
    if (Math.abs(d - lastDist.current) > 0.5) {
      lastDist.current = d;
      onDistChange(d);
    }
  });
  return null;
}

// ─── MAIN SCENE ───────────────────────────────────────────────────────────────
interface Selected { type: 'planet' | 'comet'; data: PlanetDef | CometDef }

function SolarSystemScene({
  T, activeShowerIds, onSelect, showDebris, showOrbits, showKuiper, showOort
}: {
  T: number;
  activeShowerIds: Set<string>;
  onSelect: (s: Selected | null) => void;
  showDebris: boolean;
  showOrbits: boolean;
  showKuiper: boolean;
  showOort: boolean;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);

  const planetPositions = useMemo(() =>
    PLANETS.map(p => planetPos(p.a, p.e, p.i, p.Omega, p.obar, p.L0, p.Lrate, T)),
    [T]
  );

  const handleSelectPlanet = useCallback((planet: PlanetDef) => {
    const s: Selected = { type: 'planet', data: planet };
    setSelected(s);
    onSelect(s);
  }, [onSelect]);

  const handleSelectComet = useCallback((comet: CometDef) => {
    const s: Selected = { type: 'comet', data: comet };
    setSelected(s);
    onSelect(s);
  }, [onSelect]);

  return (
    <>
      {/* Stars background */}
      <Stars radius={800} depth={200} count={8000} factor={5} saturation={0.2} fade speed={0.3} />

      {/* Sun */}
      <SunComponent />

      {/* Asteroid belt */}
      <AsteroidBelt />

      {/* Kuiper Belt */}
      {showKuiper && <KuiperBelt />}

      {/* Oort Cloud */}
      {showOort && <OortCloud />}

      {/* Planet orbits */}
      {showOrbits && PLANETS.map((p) => (
        <OrbitLine
          key={p.name}
          a={p.a} e={p.e} i={p.i} Omega={p.Omega}
          omega={p.obar - p.Omega}
          color={p.name === 'Earth' ? '#4488ff' : '#ffffff'}
          opacity={p.name === 'Earth' ? 0.45 : 0.14}
        />
      ))}

      {/* Comet orbits + debris trails */}
      {COMETS.map((c) => {
        const isActive = activeShowerIds.has(c.showerName.toLowerCase()) ||
          new Date().getMonth() + 1 === c.peakMonth;
        return (
          <group key={c.name} onClick={(e) => { e.stopPropagation(); handleSelectComet(c); }}>
            {showOrbits && (
              <OrbitLine
                a={c.a} e={c.e} i={c.i} Omega={c.Omega} omega={c.omega}
                color={c.color}
                opacity={isActive ? 0.55 : 0.28}
              />
            )}
            {showDebris && <DebrisTrail comet={c} isActive={isActive} />}
          </group>
        );
      })}

      {/* Planets */}
      {PLANETS.map((p, idx) => (
        <PlanetMesh
          key={p.name}
          planet={p}
          position={planetPositions[idx]}
          onClick={() => handleSelectPlanet(p)}
          isSelected={selected?.type === 'planet' && (selected.data as PlanetDef).name === p.name}
          T={T}
        />
      ))}

      {/* Click-to-deselect */}
      <mesh
        position={[0,0,0]}
        scale={[2000,2000,2000]}
        onClick={() => { setSelected(null); onSelect(null); }}
        visible={false}
      >
        <sphereGeometry />
        <meshBasicMaterial />
      </mesh>
    </>
  );
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────

function getZoneLabel(dist: number): { zone: string; desc: string; color: string } {
  if (dist < 3)   return { zone: 'Inner Solar System', desc: 'Rocky planets, asteroid belt', color: '#88ccff' };
  if (dist < 12)  return { zone: 'Outer Solar System', desc: 'Gas & ice giants', color: '#aaffcc' };
  if (dist < 40)  return { zone: 'Trans-Neptunian Region', desc: 'Beyond Neptune — Kuiper Belt', color: '#ccaaff' };
  if (dist < 80)  return { zone: 'Kuiper Belt', desc: 'Icy bodies, Pluto\'s neighbourhood', color: '#ffccaa' };
  if (dist < 300) return { zone: 'Inner Oort Cloud', desc: 'Reservoir of long-period comets', color: '#ffaacc' };
  return { zone: 'Outer Oort Cloud / Deep Space', desc: '~1 light-year from the Sun', color: '#ff8888' };
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function SolarSystemViewer() {
  const T = useMemo(() => julianT(new Date()), []);
  const [cameraDist, setCameraDist] = useState(18);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [showDebris, setShowDebris] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showKuiper, setShowKuiper] = useState(false);
  const [showOort,   setShowOort]   = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const controlsRef = useRef<any>(null);

  // Auto-enable deep-space layers based on zoom
  useEffect(() => {
    setShowKuiper(cameraDist > 32);
    setShowOort(cameraDist > 100);
  }, [cameraDist]);

  const activeShowerIds = useMemo(() => {
    const now = new Date();
    const active = new Set<string>();
    (meteorShowersData as any[]).forEach((s: any) => {
      const start = new Date(s.start);
      const end   = new Date(s.end);
      if (now >= start && now <= end) active.add(s.name.toLowerCase());
    });
    return active;
  }, []);

  const zone = getZoneLabel(cameraDist);

  const resetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  const zoomTo = useCallback((target: number) => {
    if (controlsRef.current) {
      const cam = controlsRef.current.object as THREE.PerspectiveCamera;
      const dir = cam.position.clone().normalize();
      cam.position.copy(dir.multiplyScalar(target));
      controlsRef.current.update();
    }
  }, []);

  return (
    <div className="relative w-full h-full" style={{ background: '#000408' }}>
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 14, 18], fov: 45, near: 0.01, far: 5000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <CameraController onDistChange={setCameraDist} />
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.06}
            minDistance={0.5}
            maxDistance={800}
            makeDefault
          />
          <SolarSystemScene
            T={T}
            activeShowerIds={activeShowerIds}
            onSelect={setSelected}
            showDebris={showDebris}
            showOrbits={showOrbits}
            showKuiper={showKuiper}
            showOort={showOort}
          />
        </Suspense>
      </Canvas>

      {/* ── Zone Label (top-center) ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="px-4 py-1.5 rounded-full text-xs font-mono font-semibold tracking-widest uppercase"
          style={{ background: 'rgba(0,0,0,0.55)', border: `1px solid ${zone.color}33`, color: zone.color }}>
          ⦿ {zone.zone} — {cameraDist.toFixed(1)} AU from Sun
        </div>
        <p className="text-center text-white/35 text-[10px] mt-1 font-mono">{zone.desc}</p>
      </div>

      {/* ── Controls (top-right) ── */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <div className="glass-card p-2 rounded-xl flex flex-col gap-1.5">
          <button onClick={() => zoomTo(Math.max(0.5, cameraDist * 0.5))}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Zoom In">
            <ZoomIn size={15} />
          </button>
          <button onClick={() => zoomTo(cameraDist * 2.0)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Zoom Out">
            <ZoomOut size={15} />
          </button>
          <div className="w-full h-px bg-white/10" />
          <button onClick={resetCamera}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Reset View">
            <RotateCcw size={15} />
          </button>
        </div>

        {/* Quick zoom buttons */}
        <div className="glass-card p-2 rounded-xl flex flex-col gap-1">
          {[['Earth', 2], ['Inner', 8], ['System', 22], ['Kuiper', 60], ['Oort', 250]].map(([label, dist]) => (
            <button key={label} onClick={() => zoomTo(dist as number)}
              className="text-[10px] px-2 py-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors font-mono tracking-wide text-left">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Layer toggles (bottom-left) ── */}
      <div className="absolute bottom-4 left-3 z-20">
        <div className="glass-card p-3 rounded-xl flex flex-col gap-2">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-0.5">Layers</p>
          {[
            { key: 'orbits', label: 'Orbit Paths', val: showOrbits, set: setShowOrbits, color: '#4488ff' },
            { key: 'debris', label: 'Debris Trails', val: showDebris, set: setShowDebris, color: '#ff9944' },
            { key: 'kuiper', label: 'Kuiper Belt', val: showKuiper, set: setShowKuiper, color: '#88aaff' },
            { key: 'oort',   label: 'Oort Cloud',  val: showOort,   set: setShowOort,   color: '#ff88aa' },
          ].map(({ key, label, val, set, color }) => (
            <button key={key} onClick={() => set(!val)}
              className="flex items-center gap-2 text-[11px] text-white/60 hover:text-white transition-colors">
              <div className={`w-3 h-3 rounded-sm border transition-colors flex items-center justify-center`}
                style={{ borderColor: color, background: val ? color : 'transparent' }}>
                {val && <span className="text-black text-[8px]">✓</span>}
              </div>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend / comet guide (bottom-right) ── */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-4 right-3 z-20 glass-card p-3 rounded-xl w-52 max-h-72 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Meteor Shower Sources</p>
              <button onClick={() => setShowLegend(false)} className="text-white/30 hover:text-white transition-colors">
                <X size={11} />
              </button>
            </div>
            {COMETS.map(c => {
              const isActive = new Date().getMonth() + 1 === c.peakMonth;
              return (
                <button key={c.name}
                  onClick={() => setSelected({ type: 'comet', data: c })}
                  className="w-full flex items-center gap-2 py-1 text-left hover:bg-white/5 rounded px-1 transition-colors group">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
                    style={{ background: c.color, boxShadow: isActive ? `0 0 6px ${c.color}` : 'none' }} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/80 truncate font-medium">{c.showerName}</p>
                    <p className="text-[9px] text-white/35 truncate">{c.name}</p>
                  </div>
                  {isActive && (
                    <span className="text-[8px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded font-mono ml-auto flex-shrink-0">ACTIVE</span>
                  )}
                </button>
              );
            })}
            <div className="mt-2 pt-2 border-t border-white/8">
              <p className="text-[9px] text-white/25 leading-relaxed">
                Glowing trails = debris from comets/asteroids. Earth (blue) crosses these streams annually, creating meteor showers.
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

      {/* ── Selected Object Panel ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="info-panel"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute left-3 top-16 z-20 glass-card p-4 rounded-2xl w-72"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                {selected.type === 'comet' ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: (selected.data as CometDef).color }} />
                      <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Meteor Shower Source</p>
                    </div>
                    <h3 className="text-base font-bold font-space text-white">{(selected.data as CometDef).showerName}</h3>
                    <p className="text-xs text-white/50">{(selected.data as CometDef).name}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider mb-1">Planet</p>
                    <h3 className="text-base font-bold font-space text-white">{(selected.data as PlanetDef).name}</h3>
                  </>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
                <X size={15} />
              </button>
            </div>

            {selected.type === 'comet' && (() => {
              const c = selected.data as CometDef;
              return (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'Peak ZHR', val: c.zhr.toString() },
                      { label: 'Speed', val: `${c.speed} km/s` },
                      { label: 'Period', val: c.a > 50 ? '>400yr' : `${(c.a**1.5).toFixed(1)}yr` },
                    ].map(({ label, val }) => (
                      <div key={label} className="text-center p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-sm font-bold font-space" style={{ color: c.color }}>{val}</p>
                        <p className="text-[9px] text-white/35 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/55 leading-relaxed">{c.description}</p>
                  <div className="mt-3 p-2 rounded-xl border" style={{ borderColor: `${c.color}33`, background: `${c.color}0a` }}>
                    <p className="text-[9px] text-white/40 uppercase font-mono tracking-wider mb-1">How it works</p>
                    <p className="text-[10px] text-white/55 leading-relaxed">
                      Earth's orbit crosses the {c.name} debris stream each year. Particles enter the atmosphere at {c.speed} km/s,
                      vaporising at ~100 km altitude and creating the glowing streaks we see as meteors.
                    </p>
                  </div>
                </>
              );
            })()}

            {selected.type === 'planet' && (() => {
              const p = selected.data as PlanetDef;
              const pos = planetPos(p.a, p.e, p.i, p.Omega, p.obar, p.L0, p.Lrate, T);
              const dist = pos.length();
              return (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: 'Distance from Sun', val: `${dist.toFixed(3)} AU` },
                      { label: 'Orbital Period', val: `${(p.a**1.5).toFixed(2)} yr` },
                    ].map(({ label, val }) => (
                      <div key={label} className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-xs font-bold font-space" style={{ color: p.glowColor }}>{val}</p>
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

      {/* ── How Meteor Showers Work (info card, only at Earth zoom) ── */}
      <AnimatePresence>
        {cameraDist < 4 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 glass-card px-4 py-2.5 rounded-2xl max-w-sm text-center pointer-events-none"
          >
            <p className="text-[11px] text-blue-300 font-mono mb-0.5">🌍 Earth's Perspective</p>
            <p className="text-[10px] text-white/45">
              The coloured debris trails cross Earth's orbit. Every year at the same date, Earth ploughs through them — that's your meteor shower. Zoom out to see the full picture.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Deep space scale hints ── */}
      <AnimatePresence>
        {cameraDist > 250 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center pointer-events-none"
          >
            <p className="text-white/20 text-xs font-mono">The Oort Cloud extends to ~100,000 AU</p>
            <p className="text-white/15 text-[10px] font-mono mt-1">Nearest star (Proxima Centauri) = 268,000 AU</p>
            <p className="text-white/10 text-[9px] font-mono mt-0.5">Our Milky Way Galaxy = 1.89 billion AU across</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Instructions (first load) ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none" style={{ opacity: cameraDist > 4 ? 0 : 0 }}>
        <p className="text-white/25 text-[10px] font-mono">Drag to rotate · Scroll to zoom · Click objects for info</p>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-white/20 text-[9px] font-mono tracking-wider">
          Drag · Scroll to zoom · Click objects for info · Planetary positions accurate for today
        </p>
      </div>
    </div>
  );
}
