import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  Suspense,
} from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import {
  Info, X, Play, Pause, RotateCcw, ChevronRight,
  Zap, Calendar, Clock, Star, Telescope, Globe,
  TrendingUp, AlertCircle, CheckCircle, Timer, Menu,
} from 'lucide-react';
import meteorShowers from '../data/meteorShowers.json';
import events2026 from '../data/events2026.json';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CelestialEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  location: string;
  type: 'Meteor Shower' | 'Moon Phase' | 'Eclipse' | 'Planetary Conjunction';
  visibility: string;
}

interface CometData {
  name: string;
  parentShowerName: string;
  parentShowerId: string;
  a: number;
  e: number;
  inclination: number;
  color: string;
  period: string;
  description: string;
  funFact: string;
  closestApproach: string;
  tailLength: string;
}

interface MeteorShower {
  id: string;
  name: string;
  peak: string;
  start: string;
  end: string;
  zhr: number;
  parent: string;
  constellation: string;
  description: string;
  orbitalPeriod: string;
  composition: string;
  historicalStorms: string;
  historicalVisibility: string;
}

interface PlanetData {
  name: string;
  radius: number;
  distance: number;
  color: string;
  emissive?: string;
  orbitPeriod: number;
  rotationPeriod: number;
  tilt: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// Planet Data
// ─────────────────────────────────────────────────────────────────────────────

const PLANETS: PlanetData[] = [
  {
    name: 'Mercury', radius: 0.18, distance: 6, color: '#b5b5b5', emissive: '#3a3a3a',
    orbitPeriod: 0.241, rotationPeriod: 58.6, tilt: 0.034,
    description: 'The smallest planet and closest to the Sun, with extreme temperature swings.',
    type: 'Terrestrial', diameter: '4,879 km', distanceFromSun: '57.9M km',
    yearLength: '88 Earth days', dayLength: '58.6 Earth days', moons_count: '0',
    funFact: 'A year on Mercury is shorter than a single day!',
  },
  {
    name: 'Venus', radius: 0.30, distance: 9.5, color: '#e8c477', emissive: '#7a5a10',
    orbitPeriod: 0.615, rotationPeriod: -243, tilt: 177.4,
    description: 'The hottest planet with a thick toxic atmosphere of CO₂ and sulfuric acid clouds.',
    type: 'Terrestrial', diameter: '12,104 km', distanceFromSun: '108.2M km',
    yearLength: '225 Earth days', dayLength: '243 Earth days', moons_count: '0',
    funFact: 'Venus rotates backwards and slower than it orbits the Sun!',
  },
  {
    name: 'Earth', radius: 0.32, distance: 13.5, color: '#2E5090', emissive: '#072534',
    orbitPeriod: 1, rotationPeriod: 1, tilt: 23.4,
    moons: [{ name: 'Moon', distance: 0.9, size: 0.09, period: 0.0748 }],
    description: 'Our home — the only known planet to harbor life, with liquid water and a protective atmosphere.',
    type: 'Terrestrial', diameter: '12,742 km', distanceFromSun: '149.6M km',
    yearLength: '365.25 days', dayLength: '24 hours', moons_count: '1',
    funFact: 'Earth is the densest planet in our Solar System!',
  },
  {
    name: 'Mars', radius: 0.22, distance: 18, color: '#c1440e', emissive: '#5a1a00',
    orbitPeriod: 1.881, rotationPeriod: 1.026, tilt: 25.2,
    moons: [
      { name: 'Phobos', distance: 0.55, size: 0.04, period: 0.00876 },
      { name: 'Deimos', distance: 0.8, size: 0.03, period: 0.0343 },
    ],
    description: 'The Red Planet — home to the tallest volcano in the Solar System, Olympus Mons.',
    type: 'Terrestrial', diameter: '6,779 km', distanceFromSun: '227.9M km',
    yearLength: '687 Earth days', dayLength: '24.6 hours', moons_count: '2',
    funFact: 'Mars has the largest dust storms in the Solar System, lasting months!',
  },
  {
    name: 'Jupiter', radius: 0.85, distance: 27, color: '#c88b3a', emissive: '#5a3800',
    orbitPeriod: 11.86, rotationPeriod: 0.41, tilt: 3.1,
    moons: [
      { name: 'Io', distance: 1.4, size: 0.08, period: 0.00483 },
      { name: 'Europa', distance: 1.8, size: 0.07, period: 0.00972 },
      { name: 'Ganymede', distance: 2.3, size: 0.1, period: 0.0196 },
      { name: 'Callisto', distance: 2.9, size: 0.09, period: 0.0457 },
    ],
    description: 'The largest planet, a gas giant with the famous Great Red Spot — a storm larger than Earth.',
    type: 'Gas Giant', diameter: '139,820 km', distanceFromSun: '778.5M km',
    yearLength: '11.86 Earth years', dayLength: '9.9 hours', moons_count: '95',
    funFact: "Jupiter's Great Red Spot storm has raged for over 350 years!",
  },
  {
    name: 'Saturn', radius: 0.72, distance: 36, color: '#e8d5a3', emissive: '#6a5a30',
    orbitPeriod: 29.46, rotationPeriod: 0.44, tilt: 26.7,
    rings: true, ringColor: '#c8b88866',
    moons: [
      { name: 'Titan', distance: 1.8, size: 0.1, period: 0.0437 },
      { name: 'Enceladus', distance: 1.3, size: 0.05, period: 0.0127 },
    ],
    description: 'The jewel of the Solar System — spectacular rings of ice and rock orbiting a stunning gas giant.',
    type: 'Gas Giant', diameter: '116,460 km', distanceFromSun: '1.43B km',
    yearLength: '29.46 Earth years', dayLength: '10.7 hours', moons_count: '146',
    funFact: 'Saturn is less dense than water — it would float in a giant ocean!',
  },
  {
    name: 'Uranus', radius: 0.48, distance: 44, color: '#7de8e8', emissive: '#1a6a6a',
    orbitPeriod: 84.01, rotationPeriod: -0.72, tilt: 97.77,
    rings: true, ringColor: '#7de8e820',
    moons: [
      { name: 'Titania', distance: 1.2, size: 0.06, period: 0.0236 },
      { name: 'Oberon', distance: 1.6, size: 0.055, period: 0.0369 },
    ],
    description: 'The sideways planet — it orbits the Sun on its side, with its poles facing the Sun.',
    type: 'Ice Giant', diameter: '50,724 km', distanceFromSun: '2.87B km',
    yearLength: '84 Earth years', dayLength: '17.2 hours', moons_count: '28',
    funFact: 'Uranus rotates on its side with an axial tilt of 98 degrees!',
  },
  {
    name: 'Neptune', radius: 0.45, distance: 52, color: '#4b70dd', emissive: '#1a2a7a',
    orbitPeriod: 164.8, rotationPeriod: 0.67, tilt: 28.3,
    moons: [{ name: 'Triton', distance: 1.3, size: 0.07, period: -0.0163 }],
    description: 'The windiest planet — supersonic winds up to 2,100 km/h rage across this ice giant.',
    type: 'Ice Giant', diameter: '49,244 km', distanceFromSun: '4.5B km',
    yearLength: '164.8 Earth years', dayLength: '16.1 hours', moons_count: '16',
    funFact: 'Neptune has the strongest winds of any planet — up to 2,100 km/h!',
  },
];

const COMETS: CometData[] = [
  {
    name: 'Comet Halley',
    parentShowerName: 'Eta Aquariids & Orionids',
    parentShowerId: 'eta-aquariids',
    a: 22,
    e: 0.967,
    inclination: 18,
    color: '#60a5fa',
    period: '76 years',
    description: 'Perhaps the most famous comet, returning to the inner Solar System every 75-76 years. It is the parent body of both the Eta Aquariids and Orionids meteor showers.',
    funFact: 'Halley is the only naked-eye comet that can appear twice in a human lifetime.',
    closestApproach: '0.587 AU',
    tailLength: 'Millions of km'
  },
  {
    name: 'Comet Swift-Tuttle',
    parentShowerName: 'Perseids',
    parentShowerId: 'perseids',
    a: 28,
    e: 0.963,
    inclination: 55,
    color: '#f97316',
    period: '133 years',
    description: 'A massive comet with a nucleus of 26 km. Its debris trail produces the spectacular Perseids meteor shower each August.',
    funFact: 'Swift-Tuttle is the largest Solar System object (excluding the Moon) that makes repeated close approaches to Earth.',
    closestApproach: '0.009 AU',
    tailLength: 'Extensive dust tail'
  },
  {
    name: 'Asteroid Phaethon',
    parentShowerName: 'Geminids',
    parentShowerId: 'geminids',
    a: 8,
    e: 0.89,
    inclination: 22,
    color: '#eab308',
    period: '1.4 years',
    description: 'An active asteroid with an orbit that brings it closer to the Sun than any other named asteroid. It sheds rocky debris to produce the Geminids.',
    funFact: 'Phaethon behaves like a comet, venting sodium vapor and dust when heated by the Sun.',
    closestApproach: '0.14 AU',
    tailLength: 'Short dust tail at perihelion'
  },
  {
    name: 'Comet Tempel-Tuttle',
    parentShowerName: 'Leonids',
    parentShowerId: 'leonids',
    a: 16,
    e: 0.905,
    inclination: 35,
    color: '#d8b4fe',
    period: '33 years',
    description: 'A small comet whose orbit intersects closely with Earth. Its dense debris bands produce intense Leonid meteor storms every 33 years.',
    funFact: 'In 1966, Tempel-Tuttle debris produced a storm of 144,000 meteors per hour!',
    closestApproach: '0.008 AU',
    tailLength: 'Narrow, high-density stream'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Meteor Shower Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getShowerStatus(shower: MeteorShower): 'active' | 'upcoming' | 'past' {
  const now = new Date();
  const start = new Date(shower.start);
  const end = new Date(shower.end);
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'past';
}

function getDaysUntilPeak(shower: MeteorShower): number {
  const now = new Date();
  const peak = new Date(shower.peak);
  return Math.ceil((peak.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getZHRLabel(zhr: number): string {
  if (zhr >= 100) return 'Exceptional';
  if (zhr >= 50) return 'Excellent';
  if (zhr >= 25) return 'Good';
  if (zhr >= 10) return 'Moderate';
  return 'Low';
}

function getZHRColor(zhr: number): string {
  if (zhr >= 100) return '#f97316';
  if (zhr >= 50) return '#eab308';
  if (zhr >= 25) return '#22c55e';
  return '#60a5fa';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D Scene Components
// ─────────────────────────────────────────────────────────────────────────────

function AsteroidBelt() {
  const meshRef = useRef<THREE.Points>(null);
  const { positions } = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 21 + (Math.random() - 0.5) * 3.5;
      const y = (Math.random() - 0.5) * 0.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return { positions };
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.005;
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

function OrbitRing({ distance, isSelected }: { distance: number; isSelected: boolean }) {
  const points = useMemo<[number, number, number][]>(() => {
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

function SaturnRings({ planetRadius }: { planetRadius: number }) {
  const geo = useMemo(() => new THREE.RingGeometry(planetRadius * 1.3, planetRadius * 2.3, 128, 3), [planetRadius]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#c8b888'),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
  }), []);
  return <mesh geometry={geo} material={mat} rotation={[Math.PI / 3, 0, 0]} />;
}

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
    moonRef.current.position.set(
      parentPos.x + Math.cos(angleRef.current) * data.distance,
      parentPos.y + 0.05,
      parentPos.z + Math.sin(angleRef.current) * data.distance,
    );
  });

  return (
    <mesh ref={moonRef}>
      <sphereGeometry args={[data.size, 16, 16]} />
      <meshPhongMaterial color="#aaaaaa" emissive="#222222" shininess={5} />
    </mesh>
  );
}

function Planet({ data, timeSpeed, onSelect, isSelected }: {
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
    const speed = (1 / data.orbitPeriod) * 0.3;
    angleRef.current += delta * timeSpeed * speed;
    if (groupRef.current) {
      groupRef.current.position.set(
        Math.cos(angleRef.current) * data.distance,
        0,
        Math.sin(angleRef.current) * data.distance,
      );
    }
    meshRef.current.rotation.y += delta * timeSpeed * (1 / data.rotationPeriod) * 2;
    if (isSelected && meshRef.current.material) {
      (meshRef.current.material as THREE.MeshPhongMaterial).emissiveIntensity =
        0.5 + Math.sin(Date.now() * 0.003) * 0.3;
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

      {data.rings && data.name === 'Saturn' && <SaturnRings planetRadius={data.radius} />}
      {data.rings && data.name === 'Uranus' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[data.radius * 1.4, data.radius * 1.9, 64]} />
          <meshBasicMaterial color="#7de8e8" side={THREE.DoubleSide} transparent opacity={0.2} />
        </mesh>
      )}

      {hovered && !isSelected && (
        <Html distanceFactor={30} center>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
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

      {data.moons?.map(moon => (
        <Moon key={moon.name} data={moon} parentRef={groupRef} timeSpeed={timeSpeed} />
      ))}
    </group>
  );
}

function Sun() {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (sunRef.current) sunRef.current.rotation.y += 0.002;
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04);
    }
  });

  return (
    <group>
      <mesh ref={sunRef}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshBasicMaterial color="#fdb813" />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.08} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.2, 32, 32]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.04} />
      </mesh>
      <pointLight color="#fff5e0" intensity={3} distance={300} decay={0.5} />
    </group>
  );
}

function CameraFocusController({ targetPlanet, planetPositions }: {
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

function PlanetTracker({ name, distance, orbitPeriod, timeSpeed, planetPositions }: {
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

function Comet({ data, timeSpeed, onSelect, isSelected, planetPositions }: {
  data: CometData;
  timeSpeed: number;
  onSelect: (name: string) => void;
  isSelected: boolean;
  planetPositions: React.MutableRefObject<Record<string, THREE.Vector3>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Points>(null);
  const angleRef = useRef(Math.random() * Math.PI * 2);
  const [hovered, setHovered] = useState(false);

  const orbitPoints = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    const b = data.a * Math.sqrt(1 - data.e * data.e);
    const incRad = (data.inclination * Math.PI) / 180;
    for (let i = 0; i <= 128; i++) {
      const theta = (i / 128) * Math.PI * 2;
      const xObj = data.a * Math.cos(theta) - data.a * data.e;
      const zObj = b * Math.sin(theta);
      
      const x = xObj;
      const y = zObj * Math.sin(incRad);
      const z = zObj * Math.cos(incRad);
      pts.push([x, y, z]);
    }
    return pts;
  }, [data.a, data.e, data.inclination]);

  const tailParticles = useMemo(() => {
    const count = 30;
    const pos = new Float32Array(count * 3);
    return { pos, count };
  }, []);

  useFrame((state, delta) => {
    if (!coreRef.current) return;
    
    const b = data.a * Math.sqrt(1 - data.e * data.e);
    const theta = angleRef.current;
    
    const xObj = data.a * Math.cos(theta) - data.a * data.e;
    const zObj = b * Math.sin(theta);
    const r = Math.sqrt(xObj * xObj + zObj * zObj);
    
    const speed = (18 / Math.max(r, 2.5)) * timeSpeed * (1 / parseFloat(data.period)) * 0.15;
    angleRef.current += delta * speed;
    
    const incRad = (data.inclination * Math.PI) / 180;
    const posX = xObj;
    const posY = zObj * Math.sin(incRad);
    const posZ = zObj * Math.cos(incRad);
    
    coreRef.current.position.set(posX, posY, posZ);
    
    planetPositions.current[data.name] = new THREE.Vector3(posX, posY, posZ);

    if (tailRef.current) {
      const corePos = new THREE.Vector3(posX, posY, posZ);
      const toSun = corePos.clone().normalize();
      const geo = tailRef.current.geometry as THREE.BufferGeometry;
      const positions = geo.getAttribute('position').array as Float32Array;
      
      const time = state.clock.getElapsedTime();
      for (let i = 0; i < tailParticles.count; i++) {
        const age = (time * 1.5 + i * 0.12) % 1.0;
        const offset = toSun.clone().multiplyScalar(age * 3.5);
        
        const spread = age * 0.35;
        const wobbleX = Math.sin(time * 6 + i) * 0.08 * age + (Math.random() - 0.5) * spread;
        const wobbleY = Math.cos(time * 5 + i) * 0.08 * age + (Math.random() - 0.5) * spread;
        const wobbleZ = Math.sin(time * 7 + i) * 0.08 * age + (Math.random() - 0.5) * spread;

        positions[i * 3] = posX + offset.x + wobbleX;
        positions[i * 3 + 1] = posY + offset.y + wobbleY;
        positions[i * 3 + 2] = posZ + offset.z + wobbleZ;
      }
      geo.getAttribute('position').needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <Line
        points={orbitPoints}
        color={data.color}
        opacity={isSelected ? 0.6 : 0.2}
        transparent
        lineWidth={isSelected ? 1.2 : 0.6}
        dashed={!isSelected}
        dashScale={2}
        gapSize={1}
      />
      
      <mesh
        ref={coreRef}
        onClick={(e) => { e.stopPropagation(); onSelect(data.name); }}
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <points ref={tailRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[tailParticles.pos, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={data.color}
          size={0.065}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {hovered && !isSelected && (
        <Html distanceFactor={30} center>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${data.color}50`,
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
            {data.name} (Parent)
          </div>
        </Html>
      )}
    </group>
  );
}

function SolarSystemScene({ timeSpeed, selectedPlanet, onSelectPlanet, autoOrbit, planetPositions }: {
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

      {COMETS.map(comet => (
        <React.Fragment key={comet.name}>
          <Comet
            data={comet}
            timeSpeed={timeSpeed}
            onSelect={(name) => onSelectPlanet(selectedPlanet === name ? null : name)}
            isSelected={selectedPlanet === comet.name}
            planetPositions={planetPositions}
          />
        </React.Fragment>
      ))}

      {selectedPlanet ? (
        <CameraFocusController targetPlanet={selectedPlanet} planetPositions={planetPositions} />
      ) : (
        <OrbitControls
          enablePan enableZoom enableRotate
          minDistance={5} maxDistance={150}
          autoRotate={autoOrbit} autoRotateSpeed={0.3}
          target={[0, 0, 0]}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Planet Info Panel
// ─────────────────────────────────────────────────────────────────────────────

function PlanetInfoPanel({ planet, onClose }: { planet: PlanetData; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className="absolute top-16 right-3 bottom-20 w-72 md:w-80 pointer-events-auto z-20 md:top-6 md:right-6 md:bottom-6"
    >
      <div
        className="h-full rounded-2xl border border-white/10 overflow-y-auto"
        style={{ background: 'rgba(2,2,15,0.9)', backdropFilter: 'blur(24px)' }}
      >
        <div className="relative p-6 pb-4">
          <div
            className="absolute top-0 left-0 right-0 h-24 rounded-t-2xl opacity-30"
            style={{ background: `radial-gradient(circle at top, ${planet.color}, transparent)` }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold tracking-[0.4em] uppercase" style={{ color: planet.color }}>
                {planet.type}
              </span>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
            <h2 className="text-3xl font-bold mb-2">{planet.name}</h2>
            <p className="text-xs text-white/60 leading-relaxed">{planet.description}</p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-2 mb-5">
            {[
              { label: 'Diameter', value: planet.diameter },
              { label: 'From Sun', value: planet.distanceFromSun },
              { label: 'Year', value: planet.yearLength },
              { label: 'Day', value: planet.dayLength },
              { label: 'Moons', value: planet.moons_count },
              { label: 'Tilt', value: `${planet.tilt}°` },
            ].map(stat => (
              <div key={stat.label} className="p-3 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-xs font-bold text-white/90">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border" style={{ background: `${planet.color}10`, borderColor: `${planet.color}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <Info size={13} style={{ color: planet.color }} />
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: planet.color }}>Fun Fact</span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">{planet.funFact}</p>
          </div>

          {planet.moons && planet.moons.length > 0 && (
            <div className="mt-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-3">Notable Moons</p>
              <div className="space-y-1.5">
                {planet.moons.map(moon => (
                  <div key={moon.name} className="flex items-center gap-3 p-2.5 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="w-4 h-4 rounded-full bg-gray-500/40 flex-shrink-0" />
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

function CometInfoPanel({ comet, onClose }: { comet: CometData; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className="absolute top-16 right-3 bottom-20 w-72 md:w-80 pointer-events-auto z-20 md:top-6 md:right-6 md:bottom-6"
    >
      <div
        className="h-full rounded-2xl border border-white/10 overflow-y-auto"
        style={{ background: 'rgba(2,2,15,0.9)', backdropFilter: 'blur(24px)' }}
      >
        <div className="relative p-6 pb-4">
          <div
            className="absolute top-0 left-0 right-0 h-24 rounded-t-2xl opacity-30"
            style={{ background: `radial-gradient(circle at top, ${comet.color}, transparent)` }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold tracking-[0.4em] uppercase" style={{ color: comet.color }}>
                Cometary Body
              </span>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
            <h2 className="text-2xl font-bold mb-2">{comet.name}</h2>
            <p className="text-xs text-white/60 leading-relaxed">{comet.description}</p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Orbital Period', value: comet.period },
              { label: 'Closest Approach', value: comet.closestApproach },
              { label: 'Tail Length', value: comet.tailLength },
              { label: 'Parent Shower', value: comet.parentShowerName },
            ].map(stat => (
              <div key={stat.label} className="p-3 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-xs font-bold text-white/90">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border" style={{ background: `${comet.color}10`, borderColor: `${comet.color}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <Info size={13} style={{ color: comet.color }} />
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: comet.color }}>Fun Fact</span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">{comet.funFact}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Planet Selector Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function PlanetSelector({ selectedPlanet, onSelect }: {
  selectedPlanet: string | null;
  onSelect: (name: string | null) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-auto z-10"
    >
      <div className="rounded-2xl border border-white/10 p-2.5 flex flex-col gap-1.5"
        style={{ background: 'rgba(0,0,10,0.8)', backdropFilter: 'blur(24px)' }}>
        <button
          onClick={() => onSelect(null)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
            selectedPlanet === null
              ? 'bg-yellow-500/30 border border-yellow-500/50'
              : 'bg-white/5 border border-white/10 hover:bg-white/10'
          }`}
          title="Reset to Solar System view"
        >
          <div className="w-3.5 h-3.5 rounded-full" style={{ background: '#fdb813' }} />
        </button>
        <div className="w-full h-px bg-white/10" />
        {PLANETS.map(planet => (
          <button
            key={planet.name}
            onClick={() => onSelect(selectedPlanet === planet.name ? null : planet.name)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
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
                width: `${Math.max(5, Math.min(13, planet.radius * 14))}px`,
                height: `${Math.max(5, Math.min(13, planet.radius * 14))}px`,
                background: planet.color,
              }}
            />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Controls Bar
// ─────────────────────────────────────────────────────────────────────────────

function ControlsBar({ timeSpeed, setTimeSpeed, isPlaying, setIsPlaying, autoOrbit, setAutoOrbit }: {
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
      className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto z-10 w-[calc(100%-2rem)] max-w-lg"
    >
      <div
        className="flex items-center justify-center gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 rounded-2xl border border-white/10 overflow-x-auto"
        style={{ background: 'rgba(0,0,10,0.85)', backdropFilter: 'blur(24px)' }}
      >
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center hover:bg-orange-500/30 transition-all flex-shrink-0"
        >
          {isPlaying ? <Pause size={13} className="text-orange-400" /> : <Play size={13} className="text-orange-400" />}
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {speeds.map(s => (
            <button
              key={s}
              onClick={() => setTimeSpeed(s)}
              className={`px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase transition-all ${
                timeSpeed === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-white/10 flex-shrink-0" />

        <button
          onClick={() => setAutoOrbit(!autoOrbit)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all flex-shrink-0 ${
            autoOrbit
              ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
              : 'bg-white/5 border border-white/10 text-white/50'
          }`}
        >
          <RotateCcw size={11} />
          <span className="hidden sm:inline">Auto</span>
        </button>

        <button
          onClick={() => { setTimeSpeed(1); setIsPlaying(true); setAutoOrbit(false); }}
          className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all flex-shrink-0"
          title="Reset"
        >
          <RotateCcw size={13} className="text-white/50" />
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Meteor Shower Detail Card
// ─────────────────────────────────────────────────────────────────────────────

function ShowerDetailPanel({ shower, onClose, onViewComet }: {
  shower: MeteorShower;
  onClose: () => void;
  onViewComet: (cometName: string) => void;
}) {
  const status = getShowerStatus(shower);
  const daysUntilPeak = getDaysUntilPeak(shower);
  const zhrColor = getZHRColor(shower.zhr);
  const zhrLabel = getZHRLabel(shower.zhr);
  const associatedComet = COMETS.find(c => c.parentShowerId === shower.id);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'rgba(5,5,20,0.97)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-white/5">
          <div
            className="absolute inset-0 opacity-10"
            style={{ background: `radial-gradient(ellipse at top left, ${zhrColor}, transparent 70%)` }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {status === 'active' && (
                  <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active Now
                  </span>
                )}
                {status === 'upcoming' && (
                  <span className="text-[9px] font-bold tracking-widest uppercase text-orange-400">
                    Upcoming
                  </span>
                )}
                {status === 'past' && (
                  <span className="text-[9px] font-bold tracking-widest uppercase text-white/30">
                    Completed
                  </span>
                )}
                <span className="text-[9px] text-white/30">•</span>
                <span className="text-[9px] text-white/40 uppercase tracking-widest">{shower.constellation}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold">{shower.name}</h2>
              <p className="text-sm text-white/50 mt-1">{shower.parent}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 grid sm:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          {/* Left col */}
          <div className="space-y-4">
            <p className="text-sm text-white/70 leading-relaxed">{shower.description}</p>

            {/* ZHR Gauge */}
            <div className="p-4 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/40 uppercase tracking-widest">Peak Rate (ZHR)</span>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: zhrColor }}>{zhrLabel}</span>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black" style={{ color: zhrColor }}>{shower.zhr}</span>
                <span className="text-sm text-white/40 mb-1">meteors/hr</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (shower.zhr / 150) * 100)}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${zhrColor}80, ${zhrColor})` }}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Start', value: formatDate(shower.start), icon: <Calendar size={12} /> },
                { label: 'Peak', value: formatDate(shower.peak), icon: <Star size={12} /> },
                { label: 'End', value: formatDate(shower.end), icon: <Calendar size={12} /> },
                { label: daysUntilPeak > 0 ? 'Days to Peak' : 'Days Since Peak',
                  value: Math.abs(daysUntilPeak).toString(),
                  icon: <Timer size={12} /> },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center gap-1.5 mb-1 text-white/40">{item.icon}
                    <span className="text-[9px] uppercase tracking-widest">{item.label}</span>
                  </div>
                  <p className="text-xs font-bold text-white/90">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-white/5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {[
                { icon: <Globe size={13} className="text-blue-400" />, label: 'Parent Body', value: shower.parent },
                { icon: <Telescope size={13} className="text-purple-400" />, label: 'Constellation', value: shower.constellation },
                { icon: <Clock size={13} className="text-yellow-400" />, label: 'Orbital Period', value: shower.orbitalPeriod },
                { icon: <TrendingUp size={13} className="text-emerald-400" />, label: 'Composition', value: shower.composition },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                  <div>
                    <p className="text-[9px] text-white/40 uppercase tracking-widest mb-0.5">{item.label}</p>
                    <p className="text-xs text-white/80 font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl border border-orange-500/20" style={{ background: 'rgba(249,115,22,0.05)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={13} className="text-orange-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400">Historical Storms</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{shower.historicalStorms}</p>
            </div>

            {associatedComet && (
              <button
                onClick={() => {
                  onViewComet(associatedComet.name);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 transition-colors text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Telescope size={12} />
                View Parent Orbit in 3D
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
function ShowerCard({ shower, onClick }: { shower: MeteorShower; onClick: () => void }) {
  const status = getShowerStatus(shower);
  const daysUntilPeak = getDaysUntilPeak(shower);
  const zhrColor = getZHRColor(shower.zhr);

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border transition-all group"
      style={{
        background: status === 'active'
          ? 'rgba(16,185,129,0.05)'
          : status === 'upcoming'
            ? 'rgba(249,115,22,0.04)'
            : 'rgba(255,255,255,0.02)',
        borderColor: status === 'active'
          ? 'rgba(16,185,129,0.25)'
          : status === 'upcoming'
            ? 'rgba(249,115,22,0.2)'
            : 'rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {status === 'active' && (
              <span className="flex items-center gap-1 text-[8px] font-bold tracking-widest uppercase text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
            {status === 'upcoming' && (
              <span className="text-[8px] font-bold tracking-widest uppercase text-orange-400">Soon</span>
            )}
            <span className="text-[8px] text-white/30 uppercase tracking-widest">{shower.constellation}</span>
          </div>
          <h3 className="font-bold text-white/95 text-sm sm:text-base">{shower.name}</h3>
          <p className="text-xs text-white/40 mt-0.5 truncate">{shower.parent}</p>

          <div className="flex items-center gap-3 mt-2.5">
            <div className="flex items-center gap-1.5">
              <Star size={10} className="text-white/30" />
              <span className="text-[10px] text-white/40">Peak {formatDate(shower.peak)}</span>
            </div>
            {status !== 'past' && (
              <div className="flex items-center gap-1">
                <Timer size={10} style={{ color: zhrColor }} />
                <span className="text-[10px] font-medium" style={{ color: zhrColor }}>
                  {daysUntilPeak > 0 ? `${daysUntilPeak}d away` : 'This week'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right — ZHR */}
        <div className="flex-shrink-0 text-right">
          <div
            className="inline-flex flex-col items-center justify-center w-14 h-14 rounded-xl border"
            style={{ background: `${zhrColor}12`, borderColor: `${zhrColor}30` }}
          >
            <span className="text-lg font-black leading-none" style={{ color: zhrColor }}>{shower.zhr}</span>
            <span className="text-[8px] text-white/30 uppercase tracking-widest mt-0.5">ZHR</span>
          </div>
          <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors mt-1 ml-auto" />
        </div>
      </div>

      {/* Progress bar showing activity window */}
      {status !== 'past' && (
        <div className="mt-3">
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: status === 'active' ? '60%' : '20%',
                background: `linear-gradient(90deg, ${zhrColor}60, ${zhrColor})`,
              }}
            />
          </div>
        </div>
      )}
    </motion.button>
  );
}

function EventCard({ event, onClick }: { event: CelestialEvent; onClick: () => void }) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'Moon Phase':
        const isFull = event.title.toLowerCase().includes('full');
        return (
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 flex-shrink-0">
            <div className={`w-5 h-5 rounded-full ${isFull ? 'bg-white shadow-[0_0_10px_#fff]' : 'border-2 border-white/30 bg-transparent'}`} />
          </div>
        );
      case 'Eclipse':
        return (
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 flex-shrink-0 relative overflow-hidden">
            <div className="w-5 h-5 rounded-full bg-black border-2 border-orange-500 shadow-[0_0_8px_#f97316]" />
          </div>
        );
      case 'Planetary Conjunction':
        return (
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 flex-shrink-0">
            <Globe size={18} className="text-blue-400" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 flex-shrink-0">
            <Zap size={18} className="text-yellow-400" />
          </div>
        );
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'Moon Phase': return '#ffffff';
      case 'Eclipse': return '#f97316';
      case 'Planetary Conjunction': return '#60a5fa';
      default: return '#eab308';
    }
  };

  const color = getEventColor(event.type);

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border transition-all group flex items-start gap-4"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {getEventIcon(event.type)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[8px] font-bold tracking-widest uppercase text-white/40">{event.type}</span>
          <span className="text-[8px] text-white/20">•</span>
          <span className="text-[8px] text-white/40 uppercase tracking-widest truncate">{event.location}</span>
        </div>
        <h3 className="font-bold text-white/95 text-sm sm:text-base">{event.title}</h3>
        <p className="text-xs text-white/40 mt-1 truncate">{event.description}</p>
        <div className="flex items-center gap-2.5 mt-3">
          <div className="flex items-center gap-1">
            <Calendar size={10} className="text-white/30" />
            <span className="text-[10px] text-white/40">{formatDate(event.date)}</span>
          </div>
          <span className="text-white/25 text-[10px]">•</span>
          <span className="text-[10px] font-medium" style={{ color }}>Visibility: {event.visibility}</span>
        </div>
      </div>
      <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors mt-3 ml-auto flex-shrink-0" />
    </motion.button>
  );
}

function EventDetailPanel({ event, onClose, onOpenCalculator }: {
  event: CelestialEvent;
  onClose: () => void;
  onOpenCalculator: (eventTitle: string, moonIllum: number) => void;
}) {
  const getEventColor = (type: string) => {
    switch (type) {
      case 'Moon Phase': return '#ffffff';
      case 'Eclipse': return '#f97316';
      case 'Planetary Conjunction': return '#60a5fa';
      default: return '#eab308';
    }
  };

  const color = getEventColor(event.type);
  const isMoonPhase = event.type === 'Moon Phase';
  const isFullMoon = event.title.toLowerCase().includes('full');

  const moonIllum = isMoonPhase ? (isFullMoon ? 100 : 0) : 15;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-xl rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'rgba(5,5,20,0.97)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-white/5">
          <div
            className="absolute inset-0 opacity-10"
            style={{ background: `radial-gradient(ellipse at top left, ${color}, transparent 70%)` }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-bold tracking-widest uppercase text-white/50">{event.type}</span>
                <span className="text-[9px] text-white/30">•</span>
                <span className="text-[9px] text-white/40 uppercase tracking-widest">{event.location}</span>
              </div>
              <h2 className="text-2xl font-bold">{event.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-white/70 leading-relaxed">{event.description}</p>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Date', value: formatDate(event.date), icon: <Calendar size={12} /> },
              { label: 'Visibility Rating', value: event.visibility, icon: <Telescope size={12} /> },
              { label: 'Observation Location', value: event.location, icon: <Globe size={12} /> },
              { label: 'Event Classification', value: event.type, icon: <Star size={12} /> },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-1.5 mb-1 text-white/40">{item.icon}
                  <span className="text-[9px] uppercase tracking-widest">{item.label}</span>
                </div>
                <p className="text-xs font-bold text-white/90">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Stargazing Advice */}
          <div className="p-4 rounded-xl border" style={{ background: `${color}10`, borderColor: `${color}30` }}>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color }}>Stargazing Advice</h4>
            <p className="text-xs text-white/60 leading-relaxed mb-3">
              {event.type === 'Moon Phase' && (
                isFullMoon 
                  ? 'A Full Moon washes out the night sky with light pollution. Faint deep-sky objects and minor meteor showers will be very difficult to spot. Focus on lunar features, craters, and bright planets.'
                  : 'A New Moon is the absolute best time for stargazing! The sky is naturally at its darkest, allowing you to see the Milky Way, faint nebulas, and meteor showers clearly.'
              )}
              {event.type === 'Eclipse' && (
                'Lunar eclipses are perfectly safe to view with the naked eye, binoculars, or a telescope. Solar eclipses require ISO-certified solar viewing glasses at all times except during the brief phase of totality.'
              )}
              {event.type === 'Planetary Conjunction' && (
                'Conjunctions bring planets close together in the sky. They are excellent targets for wide-field photography or telescope observing, showing multiple celestial bodies in a single field of view.'
              )}
              {event.type === 'Meteor Shower' && (
                'To view meteor showers, find a dark location away from city lights. Lie flat on your back and look up. Allow 20-30 minutes for your eyes to adapt to the dark. Avoid looking at your phone.'
              )}
            </p>
            <button
              onClick={() => {
                onOpenCalculator(event.title, moonIllum);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all flex items-center gap-2 hover:opacity-90"
              style={{ background: color, color: '#000' }}
            >
              <Timer size={12} />
              Diagnose Sky Conditions
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function VisibilityCalculator({ selectedEventTitle, defaultMoonIllum, onClose }: {
  selectedEventTitle?: string;
  defaultMoonIllum?: number;
  onClose?: () => void;
}) {
  const [cloudCover, setCloudCover] = useState(20);
  const [bortleScale, setBortleScale] = useState(4);
  const [moonIllum, setMoonIllum] = useState(defaultMoonIllum ?? 15);

  useEffect(() => {
    if (defaultMoonIllum !== undefined) {
      setMoonIllum(defaultMoonIllum);
    }
  }, [defaultMoonIllum]);

  const score = useMemo(() => {
    if (cloudCover >= 90) return 0;
    const moonPenalty = (moonIllum / 100) * 50;
    
    let lightPollutionPenalty = 0;
    if (bortleScale === 1 || bortleScale === 2) lightPollutionPenalty = 0;
    else if (bortleScale === 3 || bortleScale === 4) lightPollutionPenalty = 15;
    else if (bortleScale === 5 || bortleScale === 6) lightPollutionPenalty = 35;
    else if (bortleScale === 7 || bortleScale === 8) lightPollutionPenalty = 60;
    else if (bortleScale === 9) lightPollutionPenalty = 80;

    let base = 100 - moonPenalty - lightPollutionPenalty;
    base = Math.max(5, base);
    
    return Math.round(base * (1 - cloudCover / 100));
  }, [cloudCover, bortleScale, moonIllum]);

  const rating = useMemo(() => {
    if (cloudCover >= 90) return { text: 'Overcast (Zero View)', color: '#ef4444', advice: 'Sky is fully covered by clouds. Observing is impossible.' };
    if (score >= 80) return { text: 'Pristine Dark Sky', color: '#10b981', advice: 'Excellent conditions. Faint meteors and deep sky objects will be visible.' };
    if (score >= 60) return { text: 'Good Conditions', color: '#22c55e', advice: 'Very good conditions. Major showers will show prominent trails.' };
    if (score >= 40) return { text: 'Fair Viewing', color: '#eab308', advice: 'Sky is partially compromised. Only brighter meteors and planetary events will be visible.' };
    if (score >= 20) return { text: 'Poor Sky Quality', color: '#f97316', advice: 'Heavy light pollution or moonlight. Recommend driving to a darker rural area.' };
    return { text: 'Sub-Optimal/Impossible', color: '#ef4444', advice: 'Too bright or cloudy. Only the brightest planets or Moon will be visible.' };
  }, [score, cloudCover]);

  const bortleLabel = [
    '',
    'Bortle 1 (Excellent Dark)',
    'Bortle 2 (Typical Dark)',
    'Bortle 3 (Rural Sky)',
    'Bortle 4 (Rural/Suburban)',
    'Bortle 5 (Suburban)',
    'Bortle 6 (Bright Suburban)',
    'Bortle 7 (Suburban/Urban)',
    'Bortle 8 (City Sky)',
    'Bortle 9 (Inner-City)'
  ][bortleScale];

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Telescope size={15} className="text-orange-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-white">Stargaze Diagnostic</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/40 hover:text-white text-[10px] uppercase font-bold tracking-widest">
            Close
          </button>
        )}
      </div>

      {selectedEventTitle && (
        <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-left">
          <p className="text-[8px] text-white/30 uppercase tracking-widest">Diagnosing Event</p>
          <p className="text-xs font-bold text-orange-400 truncate">{selectedEventTitle}</p>
        </div>
      )}

      {/* Circle Gauge & Rating */}
      <div className="flex items-center gap-4 bg-white/[0.01] p-3 rounded-xl border border-white/5">
        <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="40" cy="40" r={radius} className="stroke-white/5" strokeWidth="5" fill="transparent" />
            <circle
              cx="40" cy="40" r={radius}
              stroke={rating.color} strokeWidth="5" fill="transparent"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round" className="transition-all duration-500"
            />
          </svg>
          <span className="absolute text-sm font-black" style={{ color: rating.color }}>{score}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-[8px] text-white/40 uppercase tracking-widest">Visibility Index</p>
          <p className="text-sm font-extrabold truncate" style={{ color: rating.color }}>{rating.text}</p>
          <p className="text-[10px] text-white/50 leading-tight mt-0.5">{rating.advice}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Cloud Cover Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-white/40">
            <span>Cloud Cover</span>
            <span className="font-bold text-white/80">{cloudCover}%</span>
          </div>
          <input
            type="range" min="0" max="100" value={cloudCover}
            onChange={e => setCloudCover(parseInt(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>

        {/* Bortle Scale Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-white/40">
            <span>Light Pollution</span>
            <span className="font-bold text-white/80">{bortleLabel}</span>
          </div>
          <input
            type="range" min="1" max="9" value={bortleScale}
            onChange={e => setBortleScale(parseInt(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>

        {/* Moon Illumination Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-white/40">
            <span>Moon Phase Illum</span>
            <span className="font-bold text-white/80">{moonIllum}%</span>
          </div>
          <input
            type="range" min="0" max="100" value={moonIllum}
            onChange={e => setMoonIllum(parseInt(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>
      </div>
    </div>
  );
}

function MeteorDataPanel({ onViewComet }: { onViewComet: (cometName: string) => void }) {
  const [viewMode, setViewMode] = useState<'showers' | 'all-events'>('showers');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'zhr' | 'name'>('date');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'past'>('all');
  const [eventFilter, setEventFilter] = useState<'all' | 'shower' | 'moon' | 'eclipse' | 'conjunction'>('all');
  
  const [selectedShower, setSelectedShower] = useState<MeteorShower | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CelestialEvent | null>(null);
  
  // Visibility Diagnostic Widget State
  const [calcEvent, setCalcEvent] = useState<{ title: string; moonIllum: number } | null>(null);

  const showers = meteorShowers as MeteorShower[];
  const events = events2026 as CelestialEvent[];

  const activeCount = showers.filter(s => getShowerStatus(s) === 'active').length;
  const upcomingCount = showers.filter(s => getShowerStatus(s) === 'upcoming').length;
  const nextShower = showers
    .filter(s => getShowerStatus(s) === 'upcoming')
    .sort((a, b) => new Date(a.peak).getTime() - new Date(b.peak).getTime())[0];
  const bestZHR = Math.max(...showers.map(s => s.zhr));

  // Filter Showers
  const filteredShowers = useMemo(() => {
    let list = [...showers];
    
    if (filter !== 'all') {
      list = list.filter(s => getShowerStatus(s) === filter);
    }
    
    if (selectedMonth !== null) {
      list = list.filter(s => new Date(s.peak).getMonth() === selectedMonth);
    }
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.parent.toLowerCase().includes(q) ||
        s.constellation.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    
    list.sort((a, b) => {
      if (sortBy === 'zhr') return b.zhr - a.zhr;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(a.peak).getTime() - new Date(b.peak).getTime();
    });
    
    return list;
  }, [showers, filter, selectedMonth, searchQuery, sortBy]);

  // Filter Celestial Events
  const filteredEvents = useMemo(() => {
    let list = [...events];
    
    if (eventFilter !== 'all') {
      const typeMap: Record<string, string> = {
        shower: 'Meteor Shower',
        moon: 'Moon Phase',
        eclipse: 'Eclipse',
        conjunction: 'Planetary Conjunction'
      };
      list = list.filter(e => e.type === typeMap[eventFilter]);
    }
    
    if (selectedMonth !== null) {
      list = list.filter(e => new Date(e.date).getMonth() === selectedMonth);
    }
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => 
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q)
      );
    }
    
    list.sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
    return list;
  }, [events, eventFilter, selectedMonth, searchQuery, sortBy]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* View Mode Tabs (Showers vs Events) */}
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex gap-1.5 p-1 rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <button
              onClick={() => { setViewMode('showers'); setSearchQuery(''); setSortBy('date'); }}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${
                viewMode === 'showers' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/40 hover:text-white/70'
              }`}
            >
              Major Showers
            </button>
            <button
              onClick={() => { setViewMode('all-events'); setSearchQuery(''); setSortBy('date'); }}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${
                viewMode === 'all-events' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/40 hover:text-white/70'
              }`}
            >
              All 2026 Events ({events.length})
            </button>
          </div>
          <span className="text-[9px] uppercase tracking-[0.3em] text-white/30 hidden sm:inline">Celestial Database</span>
        </div>

        {/* Stats row */}
        {viewMode === 'showers' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Showers', value: showers.length, icon: <Star size={16} className="text-orange-400" />, color: '#f97316' },
              { label: 'Active Now', value: activeCount, icon: <CheckCircle size={16} className="text-emerald-400" />, color: '#10b981' },
              { label: 'Upcoming', value: upcomingCount, icon: <AlertCircle size={16} className="text-blue-400" />, color: '#60a5fa' },
              { label: 'Best ZHR', value: bestZHR, icon: <Zap size={16} className="text-yellow-400" />, color: '#eab308' },
            ].map(stat => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl border border-white/5"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex items-center gap-2 mb-2">{stat.icon}
                  <span className="text-[9px] text-white/40 uppercase tracking-widest">{stat.label}</span>
                </div>
                <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Events', value: events.length, icon: <Star size={16} className="text-white/60" />, color: '#ffffff' },
              { label: 'Eclipses', value: events.filter(e => e.type === 'Eclipse').length, icon: <AlertCircle size={16} className="text-orange-400" />, color: '#f97316' },
              { label: 'Moon Phases', value: events.filter(e => e.type === 'Moon Phase').length, icon: <CheckCircle size={16} className="text-emerald-400" />, color: '#10b981' },
              { label: 'oppositions/Conjunctions', value: events.filter(e => e.type === 'Planetary Conjunction').length, icon: <Globe size={16} className="text-blue-400" />, color: '#60a5fa' },
            ].map(stat => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl border border-white/5"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex items-center gap-2 mb-2">{stat.icon}
                  <span className="text-[9px] text-white/40 uppercase tracking-widest">{stat.label}</span>
                </div>
                <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Next upcoming highlight (Showers mode only) */}
        {viewMode === 'showers' && nextShower && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-2xl border border-orange-500/20 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            style={{ background: 'rgba(249,115,22,0.04)' }}
            onClick={() => {
              setSelectedShower(nextShower);
              setCalcEvent({ title: nextShower.name, moonIllum: 15 });
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[9px] font-bold tracking-widest uppercase text-orange-400">Next Major Event</span>
              </div>
              <h3 className="text-xl font-bold mb-1">{nextShower.name}</h3>
              <p className="text-xs text-white/50">
                Peaks {formatDate(nextShower.peak)} · radiant constellation: {nextShower.constellation} · parent: {nextShower.parent}
              </p>
            </div>
            <div className="sm:text-right flex-shrink-0 flex items-center sm:block gap-2">
              <p className="text-3xl font-black text-orange-400 leading-none">{getDaysUntilPeak(nextShower)}</p>
              <p className="text-[9px] text-white/40 uppercase tracking-widest sm:mt-1">days away</p>
            </div>
          </motion.div>
        )}

        {/* 2026 Year Timeline with interactive Month filter */}
        <div className="p-5 rounded-2xl border border-white/5" style={{ background: 'rgba(255,255,255,0.01)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">
              2026 Timeline {selectedMonth !== null && `(Filtered: ${new Date(2026, selectedMonth, 1).toLocaleString('default', { month: 'long' })})`}
            </p>
            {selectedMonth !== null && (
              <button 
                onClick={() => setSelectedMonth(null)}
                className="text-[9px] font-bold text-orange-400 hover:text-orange-300 uppercase tracking-widest"
              >
                Clear Month Filter
              </button>
            )}
          </div>
          <div className="flex gap-1 h-12 overflow-hidden rounded-xl border border-white/5 bg-black/20 p-1">
            {Array.from({ length: 12 }, (_, monthIdx) => {
              const monthShowers = showers.filter(s => new Date(s.peak).getMonth() === monthIdx);
              const monthEvents = events.filter(e => new Date(e.date).getMonth() === monthIdx);
              const totalItems = viewMode === 'showers' ? monthShowers.length : monthEvents.length;

              const hasActive = monthShowers.some(s => getShowerStatus(s) === 'active');
              const hasUpcoming = monthShowers.some(s => getShowerStatus(s) === 'upcoming');
              
              let barColor = 'rgba(255,255,255,0.04)';
              if (viewMode === 'showers') {
                if (hasActive) barColor = 'rgba(16,185,129,0.5)';
                else if (hasUpcoming) barColor = 'rgba(249,115,22,0.4)';
                else if (monthShowers.length > 0) barColor = 'rgba(255,255,255,0.12)';
              } else {
                if (monthEvents.some(e => e.type === 'Eclipse')) barColor = 'rgba(249,115,22,0.4)';
                else if (monthEvents.some(e => e.type === 'Planetary Conjunction')) barColor = 'rgba(96,165,250,0.3)';
                else if (totalItems > 0) barColor = 'rgba(255,255,255,0.12)';
              }

              return (
                <div
                  key={monthIdx}
                  onClick={() => setSelectedMonth(selectedMonth === monthIdx ? null : monthIdx)}
                  className={`flex-1 flex flex-col items-center justify-end group relative cursor-pointer rounded-lg transition-all ${
                    selectedMonth === monthIdx ? 'bg-white/10 scale-105' : 'hover:bg-white/5'
                  }`}
                >
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: totalItems > 0 ? `${Math.min(90, 30 + totalItems * 18)}%` : '15%',
                      background: barColor,
                    }}
                  />
                  <span className="text-[7px] text-white/30 font-medium mt-1">
                    {new Date(2026, monthIdx, 1).toLocaleString('default', { month: 'short' }).substring(0, 1)}
                  </span>
                  
                  {totalItems > 0 && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-black/90 px-2 py-1 rounded-lg text-[8px] text-white whitespace-nowrap border border-white/10 shadow-xl pointer-events-none">
                      {viewMode === 'showers' 
                        ? monthShowers.map(s => s.name).join(', ')
                        : `${totalItems} events in ${new Date(2026, monthIdx, 1).toLocaleString('default', { month: 'short' })}`
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Search, Sort, Filters toolbar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
          {/* Search bar */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={viewMode === 'showers' ? "Search by shower name, parent body..." : "Search all events, eclipses, conjunctions..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Dropdown */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-2">
              <span className="text-[9px] uppercase tracking-widest text-white/30 px-1 font-bold">Sort</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-white/80 py-1.5 focus:outline-none cursor-pointer border-none"
              >
                <option value="date" className="bg-[#020208]">By Date</option>
                {viewMode === 'showers' && <option value="zhr" className="bg-[#020208]">By ZHR Rate</option>}
                <option value="name" className="bg-[#020208]">By Name</option>
              </select>
            </div>

            {/* Shower Filters */}
            {viewMode === 'showers' ? (
              <div className="flex gap-1">
                {(['all', 'active', 'upcoming', 'past'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all ${
                      filter === f ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-1 overflow-x-auto max-w-full">
                {(['all', 'shower', 'moon', 'eclipse', 'conjunction'] as const).map(f => {
                  const labelMap = { all: 'All', shower: 'Meteors', moon: 'Moons', eclipse: 'Eclipses', conjunction: 'Conjunctions' };
                  return (
                    <button
                      key={f}
                      onClick={() => setEventFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all whitespace-nowrap ${
                        eventFilter === f ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {labelMap[f]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Grid: Left is list of cards, Right is diagnostic widget */}
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* List col */}
          <div className="lg:col-span-2 space-y-3">
            {viewMode === 'showers' ? (
              filteredShowers.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {filteredShowers.map(shower => (
                    <ShowerCard
                      key={shower.id}
                      shower={shower}
                      onClick={() => {
                        setSelectedShower(shower);
                        setCalcEvent({ title: shower.name, moonIllum: shower.zhr > 80 ? 10 : 30 });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-white/30 text-xs">
                  No meteor showers match your search/filter criteria.
                </div>
              )
            ) : (
              filteredEvents.length > 0 ? (
                <div className="space-y-3">
                  {filteredEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => {
                        setSelectedEvent(event);
                        const isMoon = event.type === 'Moon Phase';
                        const isFull = event.title.toLowerCase().includes('full');
                        setCalcEvent({ title: event.title, moonIllum: isMoon ? (isFull ? 100 : 0) : 15 });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-white/30 text-xs">
                  No celestial events match your search/filter criteria.
                </div>
              )
            )}
          </div>

          {/* Diagnostic calculator widget */}
          <div className="lg:col-span-1">
            <VisibilityCalculator
              selectedEventTitle={calcEvent?.title}
              defaultMoonIllum={calcEvent?.moonIllum}
              onClose={calcEvent ? () => setCalcEvent(null) : undefined}
            />
          </div>
        </div>

        {/* Data note */}
        <p className="text-center text-[10px] text-white/20 mt-8 pb-2">
          ZHR = Zenithal Hourly Rate under perfect conditions · All dates UTC · 2026 season
        </p>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedShower && (
          <ShowerDetailPanel
            shower={selectedShower}
            onClose={() => setSelectedShower(null)}
            onViewComet={onViewComet}
          />
        )}
        {selectedEvent && (
          <EventDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onOpenCalculator={(title, illum) => setCalcEvent({ title, moonIllum: illum })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Instructions Toast
// ─────────────────────────────────────────────────────────────────────────────

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
          className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none z-10"
        >
          <div className="px-4 py-2.5 rounded-2xl text-[10px] font-bold tracking-widest uppercase text-white/50"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}>
            🪐 Click any planet to explore · Scroll to zoom
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

type Tab = '3d' | 'meteors';

export default function SolarSystem() {
  const [activeTab, setActiveTab] = useState<Tab>('3d');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const planetPositions = useRef<Record<string, THREE.Vector3>>({});
  const selectedPlanetData = PLANETS.find(p => p.name === selectedPlanet) ?? null;
  const selectedCometData = COMETS.find(c => c.name === selectedPlanet) ?? null;
  const effectiveSpeed = isPlaying ? timeSpeed : 0;

  const showers = meteorShowers as MeteorShower[];
  const activeShower = showers.find(s => getShowerStatus(s) === 'active');

  const handleSelectPlanet = useCallback((name: string | null) => {
    setSelectedPlanet(name);
    if (name) {
      setAutoOrbit(false);
      setActiveTab('3d');
    }
  }, []);

  return (
    <div className="flex flex-col w-full h-screen bg-[#020208] overflow-hidden">

      {/* ── Page Header ── */}
      <div
        className="flex-shrink-0 border-b border-white/8"
        style={{ background: 'rgba(2,2,15,0.95)', backdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-xs">✦</span>
              </div>
              <span className="font-black text-sm tracking-tight hidden sm:block group-hover:text-orange-400 transition-colors">STARGAZE</span>
            </Link>
            <div className="w-px h-5 bg-white/10 hidden sm:block" />
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[8px] font-bold tracking-[0.4em] uppercase text-orange-400">Live</span>
              </div>
              <p className="text-xs font-bold leading-none">Solar System</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl border border-white/10"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <button
              onClick={() => setActiveTab('3d')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${
                activeTab === '3d'
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Globe size={12} />
              <span className="hidden sm:inline">3D View</span>
            </button>
            <button
              onClick={() => setActiveTab('meteors')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all relative ${
                activeTab === 'meteors'
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Zap size={12} />
              <span className="hidden sm:inline">Meteor Data</span>
              {activeShower && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-[#020208] animate-pulse" />
              )}
            </button>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            <nav className="flex items-center gap-1">
              {[{ to: '/live', label: 'Live' }, { to: '/calendar', label: 'Calendar' }, { to: '/about', label: 'About' }].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase text-white/40 hover:text-white hover:bg-white/8 transition-all hidden sm:block"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="sm:hidden border-t border-white/5 overflow-hidden"
              style={{ background: 'rgba(2,2,12,0.98)' }}
            >
              <div className="flex flex-col gap-1 p-4">
                {[
                  { to: '/', label: 'Home', icon: <Globe size={14} className="text-orange-500" /> },
                  { to: '/live', label: 'Live Sightings', icon: <Globe size={14} className="text-orange-500" /> },
                  { to: '/calendar', label: 'Meteor Calendar', icon: <Calendar size={14} className="text-orange-500" /> },
                  { to: '/about', label: 'About Stargaze', icon: <Info size={14} className="text-orange-500" /> },
                ].map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                  >
                    {item.icon}
                    <span className="text-[10px] font-bold tracking-widest uppercase">{item.label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Content Area ── */}
      <AnimatePresence mode="wait">
        {activeTab === '3d' ? (
          <motion.div
            key="3d"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex-1 overflow-hidden"
          >
            {/* 3D Canvas */}
            <Canvas
              camera={{ position: [0, 25, 70], fov: 55, near: 0.1, far: 2000 }}
              gl={{ antialias: true, alpha: false }}
              dpr={[1, Math.min(window.devicePixelRatio, 2)]}
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
                <PlanetInfoPanel planet={selectedPlanetData} onClose={() => setSelectedPlanet(null)} />
              )}
              {selectedCometData && (
                <CometInfoPanel comet={selectedCometData} onClose={() => setSelectedPlanet(null)} />
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

            <Instructions />

            {/* Active shower badge */}
            {activeShower && (
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setActiveTab('meteors')}
                className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-widest uppercase pointer-events-auto z-10 hover:bg-emerald-500/10 transition-colors"
                style={{ background: 'rgba(16,185,129,0.08)', backdropFilter: 'blur(12px)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeShower.name} Active
                <ChevronRight size={11} />
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="meteors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 overflow-hidden flex flex-col"
            style={{ background: 'rgba(2,2,10,1)' }}
          >
            <MeteorDataPanel onViewComet={handleSelectPlanet} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
