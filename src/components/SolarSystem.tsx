import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  Suspense,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X, Play, Pause, RotateCcw, Globe, Orbit } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Planet Data
// ──────────────────────────────────────────────────────────────────────────────

interface PlanetData {
  name: string;
  radius: number;           // visual radius in scene units
  distance: number;         // AU from Sun (scaled for scene)
  color: string;
  emissive?: string;
  orbitPeriod: number;      // Earth years for one orbit
  rotationPeriod: number;   // Earth days for one rotation
  tilt: number;             // axial tilt in degrees
  rings?: boolean;
  ringColor?: string;
  moons?: { name: string; distance: number; size: number; period: number }[];
  description: string;
  type: string;
  diameter: string;
  distanceFromSun: string;
  yearLength: string;
  dayLength: string;
  moons_count: string;
  funFact: string;
}

const PLANETS: PlanetData[] = [
  {
    name: 'Mercury', radius: 0.18, distance: 6, color: '#b5b5b5', emissive: '#3a3a3a',
    orbitPeriod: 0.241, rotationPeriod: 58.6, tilt: 0.034,
    description: 'The smallest planet and closest to the Sun, with extreme temperature swings.',
    type: 'Terrestrial', diameter: '4,879 km', distanceFromSun: '57.9M km',
    yearLength: '88 Earth days', dayLength: '58.6 Earth days', moons_count: '0',
    funFact: 'A year on Mercury is shorter than a single day!'
  },
  {
    name: 'Venus', radius: 0.30, distance: 9.5, color: '#e8c477', emissive: '#7a5a10',
    orbitPeriod: 0.615, rotationPeriod: -243, tilt: 177.4,
    description: 'The hottest planet with a thick toxic atmosphere of CO₂ and sulfuric acid clouds.',
    type: 'Terrestrial', diameter: '12,104 km', distanceFromSun: '108.2M km',
    yearLength: '225 Earth days', dayLength: '243 Earth days', moons_count: '0',
    funFact: 'Venus rotates backwards and slower than it orbits the Sun!'
  },
  {
    name: 'Earth', radius: 0.32, distance: 13.5, color: '#2E5090', emissive: '#072534',
    orbitPeriod: 1, rotationPeriod: 1, tilt: 23.4,
    moons: [{ name: 'Moon', distance: 0.9, size: 0.09, period: 0.0748 }],
    description: 'Our home — the only known planet to harbor life, with liquid water and a protective atmosphere.',
    type: 'Terrestrial', diameter: '12,742 km', distanceFromSun: '149.6M km',
    yearLength: '365.25 days', dayLength: '24 hours', moons_count: '1',
    funFact: 'Earth is the densest planet in our Solar System!'
  },
  {
    name: 'Mars', radius: 0.22, distance: 18, color: '#c1440e', emissive: '#5a1a00',
    orbitPeriod: 1.881, rotationPeriod: 1.026, tilt: 25.2,
    moons: [
      { name: 'Phobos', distance: 0.55, size: 0.04, period: 0.00876 },
      { name: 'Deimos', distance: 0.8, size: 0.03, period: 0.0343 }
    ],
    description: 'The Red Planet — home to the tallest volcano in the Solar System, Olympus Mons.',
    type: 'Terrestrial', diameter: '6,779 km', distanceFromSun: '227.9M km',
    yearLength: '687 Earth days', dayLength: '24.6 hours', moons_count: '2',
    funFact: 'Mars has the largest dust storms in the Solar System, lasting months!'
  },
  {
    name: 'Jupiter', radius: 0.85, distance: 27, color: '#c88b3a', emissive: '#5a3800',
    orbitPeriod: 11.86, rotationPeriod: 0.41, tilt: 3.1,
    moons: [
      { name: 'Io', distance: 1.4, size: 0.08, period: 0.00483 },
      { name: 'Europa', distance: 1.8, size: 0.07, period: 0.00972 },
      { name: 'Ganymede', distance: 2.3, size: 0.1, period: 0.0196 },
      { name: 'Callisto', distance: 2.9, size: 0.09, period: 0.0457 }
    ],
    description: 'The largest planet, a gas giant with the famous Great Red Spot — a storm larger than Earth.',
    type: 'Gas Giant', diameter: '139,820 km', distanceFromSun: '778.5M km',
    yearLength: '11.86 Earth years', dayLength: '9.9 hours', moons_count: '95',
    funFact: 'Jupiter\'s Great Red Spot storm has raged for over 350 years!'
  },
  {
    name: 'Saturn', radius: 0.72, distance: 36, color: '#e8d5a3', emissive: '#6a5a30',
    orbitPeriod: 29.46, rotationPeriod: 0.44, tilt: 26.7,
    rings: true, ringColor: '#c8b88866',
    moons: [
      { name: 'Titan', distance: 1.8, size: 0.1, period: 0.0437 },
      { name: 'Enceladus', distance: 1.3, size: 0.05, period: 0.0127 }
    ],
    description: 'The jewel of the Solar System — spectacular rings of ice and rock orbiting a stunning gas giant.',
    type: 'Gas Giant', diameter: '116,460 km', distanceFromSun: '1.43B km',
    yearLength: '29.46 Earth years', dayLength: '10.7 hours', moons_count: '146',
    funFact: 'Saturn is less dense than water — it would float in a giant ocean!'
  },
  {
    name: 'Uranus', radius: 0.48, distance: 44, color: '#7de8e8', emissive: '#1a6a6a',
    orbitPeriod: 84.01, rotationPeriod: -0.72, tilt: 97.77,
    rings: true, ringColor: '#7de8e820',
    moons: [
      { name: 'Titania', distance: 1.2, size: 0.06, period: 0.0236 },
      { name: 'Oberon', distance: 1.6, size: 0.055, period: 0.0369 }
    ],
    description: 'The sideways planet — it orbits the Sun on its side, with its poles facing the Sun.',
    type: 'Ice Giant', diameter: '50,724 km', distanceFromSun: '2.87B km',
    yearLength: '84 Earth years', dayLength: '17.2 hours', moons_count: '28',
    funFact: 'Uranus rotates on its side with an axial tilt of 98 degrees!'
  },
  {
    name: 'Neptune', radius: 0.45, distance: 52, color: '#4b70dd', emissive: '#1a2a7a',
    orbitPeriod: 164.8, rotationPeriod: 0.67, tilt: 28.3,
    moons: [
      { name: 'Triton', distance: 1.3, size: 0.07, period: -0.0163 }
    ],
    description: 'The windiest planet — supersonic winds up to 2,100 km/h rage across this ice giant.',
    type: 'Ice Giant', diameter: '49,244 km', distanceFromSun: '4.5B km',
    yearLength: '164.8 Earth years', dayLength: '16.1 hours', moons_count: '16',
    funFact: 'Neptune has the strongest winds of any planet — up to 2,100 km/h!'
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Asteroid Belt
// ──────────────────────────────────────────────────────────────────────────────

function AsteroidBelt() {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, sizes } = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 21 + (Math.random() - 0.5) * 3.5;
      const y = (Math.random() - 0.5) * 0.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      sizes[i] = Math.random() * 0.04 + 0.01;
    }
    return { positions, sizes };
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.005;
    }
  });

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  return (
    <points ref={meshRef} geometry={geo}>
      <pointsMaterial color="#888888" size={0.06} sizeAttenuation />
    </points>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Orbit Ring
// ──────────────────────────────────────────────────────────────────────────────

function OrbitRing({ distance, isSelected }: { distance: number; isSelected: boolean }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      pts.push([Math.cos(angle) * distance, 0, Math.sin(angle) * distance]);
    }
    return pts;
  }, [distance]);

  return (
    <Line
      points={points}
      color={isSelected ? '#ffffff' : '#334455'}
      opacity={isSelected ? 0.4 : 0.15}
      transparent
      lineWidth={isSelected ? 1 : 0.5}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Saturn Rings
// ──────────────────────────────────────────────────────────────────────────────

function SaturnRings({ planetRadius }: { planetRadius: number }) {
  const mesh = useRef<THREE.Mesh>(null);

  const geo = useMemo(() => new THREE.RingGeometry(
    planetRadius * 1.3,
    planetRadius * 2.3,
    128, 3
  ), [planetRadius]);

  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#c8b888'),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
  }), []);

  return <mesh ref={mesh} geometry={geo} material={mat} rotation={[Math.PI / 3, 0, 0]} />;
}

// ──────────────────────────────────────────────────────────────────────────────
// Moon
// ──────────────────────────────────────────────────────────────────────────────

function Moon({ data, parentRef, timeSpeed }: {
  data: { name: string; distance: number; size: number; period: number };
  parentRef: React.RefObject<THREE.Group | null>;
  timeSpeed: number;
}) {
  const moonRef = useRef<THREE.Mesh>(null);
  const angleRef = useRef(Math.random() * Math.PI * 2);

  useFrame((_, delta) => {
    if (!moonRef.current || !parentRef.current) return;
    angleRef.current += (delta * timeSpeed * (1 / Math.max(Math.abs(data.period), 0.001))) * 0.3;
    const parentPos = new THREE.Vector3();
    parentRef.current.getWorldPosition(parentPos);
    const x = parentPos.x + Math.cos(angleRef.current) * data.distance;
    const z = parentPos.z + Math.sin(angleRef.current) * data.distance;
    moonRef.current.position.set(x, parentPos.y + 0.05, z);
    moonRef.current.rotation.y += delta * 0.5;
  });

  return (
    <mesh ref={moonRef}>
      <sphereGeometry args={[data.size, 16, 16]} />
      <meshPhongMaterial color="#aaaaaa" emissive="#222222" shininess={5} />
    </mesh>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Planet
// ──────────────────────────────────────────────────────────────────────────────

function Planet({
  data,
  timeSpeed,
  onSelect,
  isSelected,
}: {
  data: PlanetData;
  timeSpeed: number;
  onSelect: (name: string) => void;
  isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null);
  const angleRef = useRef(Math.random() * Math.PI * 2);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => new THREE.Color(data.color), [data.color]);
  const emissive = useMemo(() => new THREE.Color(data.emissive || '#000000'), [data.emissive]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Orbit around Sun
    const speed = (1 / data.orbitPeriod) * 0.3;
    angleRef.current += delta * timeSpeed * speed;
    const x = Math.cos(angleRef.current) * data.distance;
    const z = Math.sin(angleRef.current) * data.distance;
    if (groupRef.current) {
      groupRef.current.position.set(x, 0, z);
    }
    // Self rotation
    meshRef.current.rotation.y += delta * timeSpeed * (1 / data.rotationPeriod) * 2;
    // Pulse glow when selected
    if (isSelected && meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshPhongMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.003) * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        rotation={[THREE.MathUtils.degToRad(data.tilt), 0, 0]}
        onClick={() => onSelect(data.name)}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[data.radius, 64, 64]} />
        <meshPhongMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isSelected ? 0.6 : 0.1}
          shininess={data.name === 'Earth' ? 40 : 10}
        />
      </mesh>

      {/* Rings */}
      {data.rings && data.name === 'Saturn' && <SaturnRings planetRadius={data.radius} />}
      {data.rings && data.name === 'Uranus' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[data.radius * 1.4, data.radius * 1.9, 64]} />
          <meshBasicMaterial color="#7de8e8" side={THREE.DoubleSide} transparent opacity={0.2} />
        </mesh>
      )}

      {/* Hover label */}
      {hovered && !isSelected && (
        <Html distanceFactor={30} center>
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '4px 10px',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {data.name}
          </div>
        </Html>
      )}

      {/* Moons */}
      {data.moons?.map(moon => (
        <Moon key={moon.name} data={moon} parentRef={groupRef} timeSpeed={timeSpeed} />
      ))}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sun
// ──────────────────────────────────────────────────────────────────────────────

function Sun() {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.002;
    }
    if (glowRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      {/* Core */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshBasicMaterial color="#fdb813" />
      </mesh>
      {/* Corona glow layer 1 */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.08} />
      </mesh>
      {/* Corona glow layer 2 */}
      <mesh>
        <sphereGeometry args={[3.2, 32, 32]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.04} />
      </mesh>
      {/* Point light from Sun */}
      <pointLight color="#fff5e0" intensity={3} distance={300} decay={0.5} />
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Camera Focus Controller
// ──────────────────────────────────────────────────────────────────────────────

function CameraFocusController({
  targetPlanet,
  planetPositions,
}: {
  targetPlanet: string | null;
  planetPositions: React.MutableRefObject<Record<string, THREE.Vector3>>;
}) {
  const { camera } = useThree();
  const targetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 20, 60));
  const currentTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (targetPlanet && planetPositions.current[targetPlanet]) {
      const pos = planetPositions.current[targetPlanet];
      const planet = PLANETS.find(p => p.name === targetPlanet);
      const offset = planet ? planet.radius * 5 + 4 : 6;
      targetRef.current.set(pos.x + offset, pos.y + offset * 0.4, pos.z + offset);
      currentTarget.current.lerp(pos, 0.05);
    } else {
      targetRef.current.set(0, 20, 60);
      currentTarget.current.lerp(new THREE.Vector3(0, 0, 0), 0.05);
    }
    camera.position.lerp(targetRef.current, 0.04);
    camera.lookAt(currentTarget.current);
  });

  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Planet Position Tracker (invisible component per planet)
// ──────────────────────────────────────────────────────────────────────────────

function PlanetTracker({
  name,
  distance,
  orbitPeriod,
  timeSpeed,
  planetPositions,
}: {
  name: string;
  distance: number;
  orbitPeriod: number;
  timeSpeed: number;
  planetPositions: React.MutableRefObject<Record<string, THREE.Vector3>>;
}) {
  const angleRef = useRef(Math.random() * Math.PI * 2);
  useFrame((_, delta) => {
    angleRef.current += delta * timeSpeed * (1 / orbitPeriod) * 0.3;
    planetPositions.current[name] = new THREE.Vector3(
      Math.cos(angleRef.current) * distance,
      0,
      Math.sin(angleRef.current) * distance,
    );
  });
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Inner Scene
// ──────────────────────────────────────────────────────────────────────────────

function SolarSystemScene({
  timeSpeed,
  selectedPlanet,
  onSelectPlanet,
  autoOrbit,
  planetPositions,
}: {
  timeSpeed: number;
  selectedPlanet: string | null;
  onSelectPlanet: (name: string | null) => void;
  autoOrbit: boolean;
  planetPositions: React.MutableRefObject<Record<string, THREE.Vector3>>;
}) {
  return (
    <>
      <color attach="background" args={['#000008']} />
      <ambientLight intensity={0.1} />
      <Stars radius={200} depth={60} count={6000} factor={4} saturation={0.2} fade speed={0.5} />

      <Sun />
      <AsteroidBelt />

      {PLANETS.map(planet => (
        <React.Fragment key={planet.name}>
          <OrbitRing distance={planet.distance} isSelected={selectedPlanet === planet.name} />
          <Planet
            data={planet}
            timeSpeed={timeSpeed}
            onSelect={(name) => onSelectPlanet(selectedPlanet === name ? null : name)}
            isSelected={selectedPlanet === planet.name}
          />
          <PlanetTracker
            name={planet.name}
            distance={planet.distance}
            orbitPeriod={planet.orbitPeriod}
            timeSpeed={timeSpeed}
            planetPositions={planetPositions}
          />
        </React.Fragment>
      ))}

      {selectedPlanet ? (
        <CameraFocusController targetPlanet={selectedPlanet} planetPositions={planetPositions} />
      ) : (
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={5}
          maxDistance={150}
          autoRotate={autoOrbit}
          autoRotateSpeed={0.3}
          target={[0, 0, 0]}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Planet Info Panel
// ──────────────────────────────────────────────────────────────────────────────

function PlanetInfoPanel({ planet, onClose }: { planet: PlanetData; onClose: () => void }) {
  const color = planet.color;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className="absolute top-6 right-6 bottom-6 w-80 pointer-events-auto z-10"
    >
      <div
        className="h-full rounded-3xl border border-white/10 overflow-y-auto"
        style={{
          background: 'rgba(2, 2, 15, 0.85)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Header */}
        <div className="relative p-8 pb-6">
          <div
            className="absolute top-0 left-0 right-0 h-24 rounded-t-3xl opacity-30"
            style={{ background: `radial-gradient(circle at top, ${color}, transparent)` }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold tracking-[0.4em] uppercase"
                style={{ color }}>
                {planet.type}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <h2 className="text-4xl font-bold mb-3">{planet.name}</h2>
            <p className="text-sm text-white/70 leading-relaxed">{planet.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="px-8 pb-8">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: 'Diameter', value: planet.diameter },
              { label: 'From Sun', value: planet.distanceFromSun },
              { label: 'Year Length', value: planet.yearLength },
              { label: 'Day Length', value: planet.dayLength },
              { label: 'Moons', value: planet.moons_count },
              { label: 'Tilt', value: `${planet.tilt}°` },
            ].map(stat => (
              <div key={stat.label}
                className="p-3 rounded-2xl border border-white/5"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-sm font-bold text-white/90">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Fun fact */}
          <div
            className="p-5 rounded-2xl border"
            style={{
              background: `${color}10`,
              borderColor: `${color}30`
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Info size={14} style={{ color }} />
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
                Fun Fact
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">{planet.funFact}</p>
          </div>

          {/* Moons list */}
          {planet.moons && planet.moons.length > 0 && (
            <div className="mt-5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">
                Notable Moons
              </p>
              <div className="space-y-2">
                {planet.moons.map(moon => (
                  <div key={moon.name}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/5"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="w-5 h-5 rounded-full bg-gray-500/40 flex-shrink-0" />
                    <span className="text-xs font-bold">{moon.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Planet Selector Sidebar
// ──────────────────────────────────────────────────────────────────────────────

function PlanetSelector({
  selectedPlanet,
  onSelect,
}: {
  selectedPlanet: string | null;
  onSelect: (name: string | null) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-auto z-10"
    >
      <div
        className="rounded-3xl border border-white/10 p-3 flex flex-col gap-2"
        style={{ background: 'rgba(0,0,10,0.8)', backdropFilter: 'blur(24px)' }}
      >
        {/* Sun */}
        <button
          onClick={() => onSelect(null)}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
            selectedPlanet === null
              ? 'bg-yellow-500/30 border border-yellow-500/50'
              : 'bg-white/5 border border-white/10 hover:bg-white/10'
          }`}
          title="Reset to Solar System view"
        >
          <div className="w-4 h-4 rounded-full" style={{ background: '#fdb813' }} />
        </button>
        <div className="w-full h-px bg-white/10 my-1" />
        {PLANETS.map(planet => (
          <button
            key={planet.name}
            onClick={() => onSelect(selectedPlanet === planet.name ? null : planet.name)}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              selectedPlanet === planet.name
                ? 'scale-110 border'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
            style={{
              background: selectedPlanet === planet.name ? `${planet.color}30` : undefined,
              borderColor: selectedPlanet === planet.name ? `${planet.color}60` : undefined,
            }}
            title={planet.name}
          >
            <div
              className="rounded-full"
              style={{
                width: `${Math.max(6, Math.min(14, planet.radius * 14))}px`,
                height: `${Math.max(6, Math.min(14, planet.radius * 14))}px`,
                background: planet.color,
              }}
            />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Controls Bar
// ──────────────────────────────────────────────────────────────────────────────

function ControlsBar({
  timeSpeed,
  setTimeSpeed,
  isPlaying,
  setIsPlaying,
  autoOrbit,
  setAutoOrbit,
}: {
  timeSpeed: number;
  setTimeSpeed: (v: number) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  autoOrbit: boolean;
  setAutoOrbit: (v: boolean) => void;
}) {
  const speeds = [0.25, 0.5, 1, 2, 5, 10, 25];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto z-10"
    >
      <div
        className="flex items-center gap-4 px-6 py-3 rounded-2xl border border-white/10"
        style={{ background: 'rgba(0,0,10,0.85)', backdropFilter: 'blur(24px)' }}
      >
        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center hover:bg-orange-500/30 transition-all"
        >
          {isPlaying ? <Pause size={14} className="text-orange-400" /> : <Play size={14} className="text-orange-400" />}
        </button>

        {/* Speed */}
        <div className="flex items-center gap-1">
          {speeds.map(s => (
            <button
              key={s}
              onClick={() => setTimeSpeed(s)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase transition-all ${
                timeSpeed === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10" />

        {/* Auto orbit */}
        <button
          onClick={() => setAutoOrbit(!autoOrbit)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all ${
            autoOrbit
              ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
              : 'bg-white/5 border border-white/10 text-white/50'
          }`}
          title="Auto-rotate camera"
        >
          <RotateCcw size={12} />
          <span>Auto</span>
        </button>

        {/* Reset */}
        <button
          onClick={() => {
            setTimeSpeed(1);
            setIsPlaying(true);
            setAutoOrbit(false);
          }}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
          title="Reset simulation"
        >
          <RotateCcw size={14} className="text-white/50" />
        </button>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Export
// ──────────────────────────────────────────────────────────────────────────────

export default function SolarSystem() {
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const planetPositions = useRef<Record<string, THREE.Vector3>>({});
  const selectedPlanetData = PLANETS.find(p => p.name === selectedPlanet) ?? null;

  const effectiveSpeed = isPlaying ? timeSpeed : 0;

  const handleSelectPlanet = useCallback((name: string | null) => {
    setSelectedPlanet(name);
    if (name) setAutoOrbit(false);
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6 pointer-events-none">
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[9px] font-bold tracking-[0.4em] uppercase text-orange-400">
                Live Simulation
              </span>
            </div>
            <h1 className="text-2xl font-bold mt-1">Solar System Explorer</h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-right pointer-events-none"
          >
            <p className="text-[9px] font-bold tracking-widest uppercase text-white/40">
              {selectedPlanet ? `Viewing: ${selectedPlanet}` : '8 Planets • Click to Explore'}
            </p>
            <p className="text-[9px] text-white/30 mt-0.5">
              Drag to rotate • Scroll to zoom
            </p>
          </motion.div>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 25, 70], fov: 55, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <Suspense fallback={null}>
          <SolarSystemScene
            timeSpeed={effectiveSpeed}
            selectedPlanet={selectedPlanet}
            onSelectPlanet={handleSelectPlanet}
            autoOrbit={autoOrbit}
            planetPositions={planetPositions}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlays */}
      <PlanetSelector selectedPlanet={selectedPlanet} onSelect={handleSelectPlanet} />

      <AnimatePresence>
        {selectedPlanetData && (
          <PlanetInfoPanel
            planet={selectedPlanetData}
            onClose={() => setSelectedPlanet(null)}
          />
        )}
      </AnimatePresence>

      <ControlsBar
        timeSpeed={timeSpeed}
        setTimeSpeed={setTimeSpeed}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        autoOrbit={autoOrbit}
        setAutoOrbit={setAutoOrbit}
      />

      {/* Instructions overlay - auto-hides */}
      <Instructions />
    </div>
  );
}

function Instructions() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-10"
        >
          <div
            className="px-5 py-3 rounded-2xl text-[10px] font-bold tracking-widest uppercase text-white/50"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}
          >
            🪐 Click any planet to explore · Use sidebar to jump between planets
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
