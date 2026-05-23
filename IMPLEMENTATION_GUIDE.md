# STARGAZE: Quick-Reference Implementation Guide
## Copy-Paste Ready Code Patterns

This guide provides actual, runnable code snippets for the core Stargaze features. Each section is self-contained and can be adapted to your project structure.

---

## 1. TIME SCRUBBER STATE (Zustand Store)

```typescript
// src/store/simulation.ts

import create from 'zustand';

interface SimulationState {
  // Time management
  currentTime: number; // Julian Date
  baseTime: number; // Reference epoch (default: today)
  isPlaying: boolean;
  playSpeed: number; // multiplier (1x, 10x, 100x)
  
  // Calculated values
  earthPosition: THREE.Vector3;
  earthRotation: THREE.Euler;
  issPosition: THREE.Vector3;
  
  // Actions
  setTime: (jd: number) => void;
  setPlaySpeed: (speed: number) => void;
  togglePlayback: () => void;
  advanceTime: (deltaSeconds: number) => void;
}

export const useSimulation = create<SimulationState>((set, get) => ({
  currentTime: dateToJulianDate(new Date()),
  baseTime: dateToJulianDate(new Date()),
  isPlaying: false,
  playSpeed: 1,
  
  earthPosition: new THREE.Vector3(),
  earthRotation: new THREE.Euler(),
  issPosition: new THREE.Vector3(),
  
  setTime: (jd: number) => {
    set({ currentTime: jd });
    // Derived calculations happen in useEffect hooks
  },
  
  setPlaySpeed: (speed: number) => {
    set({ playSpeed: speed });
  },
  
  togglePlayback: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },
  
  advanceTime: (deltaSeconds: number) => {
    set((state) => {
      const deltaJD = deltaSeconds / 86400; // Convert seconds to Julian days
      return {
        currentTime: state.currentTime + deltaJD * state.playSpeed,
      };
    });
  },
}));

// Helper: Convert Date to Julian Date
function dateToJulianDate(date: Date): number {
  const unixTime = date.getTime();
  const unixEpochJD = 2440587.5; // Jan 1, 1970 as JD
  return unixEpochJD + unixTime / (1000 * 86400);
}

// Helper: Convert Julian Date back to Date
function julianDateToDate(jd: number): Date {
  const unixEpochJD = 2440587.5;
  const unixTime = (jd - unixEpochJD) * (1000 * 86400);
  return new Date(unixTime);
}
```

---

## 2. EARTH POSITION CALCULATION (useEffect Hook)

```typescript
// src/hooks/useEarthPosition.ts

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useSimulation } from '../store/simulation';

// Constants
const AU_TO_METERS = 1.496e11; // Astronomical Unit in meters
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute Earth's position relative to Sun at a given Julian Date.
 * Uses simplified Kepler solver (sufficient for Earth's nearly circular orbit).
 */
export function useEarthPosition(julianDate: number) {
  const [position, setPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  const [rotation, setRotation] = useState<THREE.Euler>(new THREE.Euler());

  useEffect(() => {
    // Earth's mean orbital elements (J2000 epoch)
    // Semi-major axis: 1.00000261 AU
    // Eccentricity: 0.01671123
    // Inclination: 0.0 (ecliptic plane)
    // Longitude of ascending node: 348.73936 degrees
    // Argument of perihelion: 102.94719 degrees
    // Mean anomaly: varies with time

    const EARTH_ELEMENTS = {
      a: 1.00000261, // AU
      e: 0.01671123,
      i: 0 * DEG_TO_RAD,
      Omega: 348.73936 * DEG_TO_RAD,
      omega: 102.94719 * DEG_TO_RAD,
      n: 0.98560025, // mean motion (degrees/day)
    };

    // Calculate days since J2000 epoch (January 1, 2000, 12:00 TT)
    const T = julianDate - 2451545.0;

    // Mean anomaly at current time
    const M = ((EARTH_ELEMENTS.n * T) % 360) * DEG_TO_RAD;

    // Solve Kepler's equation for eccentric anomaly
    const E = solveKeplersEquation(M, EARTH_ELEMENTS.e);

    // True anomaly
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + EARTH_ELEMENTS.e) * Math.sin(E / 2),
      Math.sqrt(1 - EARTH_ELEMENTS.e) * Math.cos(E / 2)
    );

    // Distance from Sun
    const r = EARTH_ELEMENTS.a * (1 - EARTH_ELEMENTS.e * Math.cos(E));

    // Orbital frame coordinates
    const x = r * Math.cos(nu);
    const y = r * Math.sin(nu);
    const z = 0;

    // Apply rotation matrices (Euler rotations: Ω, i, ω)
    const posInertial = applyOrbitalRotations(
      x,
      y,
      z,
      EARTH_ELEMENTS.Omega,
      EARTH_ELEMENTS.i,
      EARTH_ELEMENTS.omega
    );

    // Convert AU to meters
    const posMeters = posInertial.multiplyScalar(AU_TO_METERS);

    // Earth's rotation
    const gmst = computeGMST(julianDate);
    const axialTilt = 23.44 * DEG_TO_RAD;
    const rotEuler = new THREE.Euler(axialTilt, gmst, 0, 'YXZ');

    setPosition(posMeters);
    setRotation(rotEuler);
  }, [julianDate]);

  return { position, rotation };
}

/**
 * Kepler's equation solver using Newton-Raphson method.
 * Solves: E - e*sin(E) = M for eccentric anomaly E.
 */
function solveKeplersEquation(M: number, e: number, tolerance = 1e-10): number {
  let E = M; // Initial guess
  
  for (let i = 0; i < 100; i++) {
    const f = E - e * Math.sin(E) - M;
    const fPrime = 1 - e * Math.cos(E);
    const dE = -f / fPrime;
    E += dE;
    
    if (Math.abs(dE) < tolerance) break;
  }
  
  return E;
}

/**
 * Apply three Euler rotations (Omega, i, omega) to orbital coordinates.
 */
function applyOrbitalRotations(
  x: number,
  y: number,
  z: number,
  Omega: number,
  i: number,
  omega: number
): THREE.Vector3 {
  // Rotation by argument of perigee (omega) in XY plane
  const x1 = Math.cos(omega) * x - Math.sin(omega) * y;
  const y1 = Math.sin(omega) * x + Math.cos(omega) * y;
  const z1 = z;

  // Rotation by inclination (i) around new X axis
  const x2 = x1;
  const y2 = Math.cos(i) * y1 - Math.sin(i) * z1;
  const z2 = Math.sin(i) * y1 + Math.cos(i) * z1;

  // Rotation by longitude of ascending node (Omega) around Z axis
  const x3 = Math.cos(Omega) * x2 - Math.sin(Omega) * y2;
  const y3 = Math.sin(Omega) * x2 + Math.cos(Omega) * y2;
  const z3 = z2;

  return new THREE.Vector3(x3, y3, z3);
}

/**
 * Greenwich Mean Sidereal Time (GMST).
 * Converts from inertial (ECI) to Earth-fixed (ECEF) coordinates.
 */
function computeGMST(jd: number): number {
  // Julian centuries since J2000
  const T = (jd - 2451545.0) / 36525;

  // GMST in seconds (USNO circular 163)
  const gmst_seconds =
    67310.54841 +
    (876600 * 3600 + 8640184.812866) * T +
    0.093104 * T * T -
    (6.2e-6) * T * T * T;

  // Convert to radians (24 hours = 2π radians)
  const gmst_rad = ((gmst_seconds / 86400) % 1) * 2 * Math.PI;

  return gmst_rad;
}
```

---

## 3. METEOR STREAM VOLUMETRIC PARTICLES

```typescript
// src/components/3D/MeteorStream.tsx

import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulation } from '../../store/simulation';

interface MeteorStreamProps {
  showerName: string;
  parentCometOrbitalElements: {
    a: number;
    e: number;
    i: number;
    Omega: number;
    omega: number;
    peakDate: { month: number; day: number };
  };
  peakZHR: number; // Zenithal Hourly Rate
}

export function MeteorStream(props: MeteorStreamProps) {
  const { currentTime, earthPosition } = useSimulation();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const PARTICLE_COUNT = 500_000;
  const STREAM_RADIUS = 0.01; // AU

  // Generate meteoroid stream points
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    // Sample points along comet's orbit path + random dispersion
    const peakJD = dateToJulianDate(
      new Date(
        new Date().getFullYear(),
        props.parentCometOrbitalElements.peakDate.month - 1,
        props.parentCometOrbitalElements.peakDate.day
      )
    );

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Distribute particles along a ±30 day window around peak
      const t = peakJD + (Math.random() * 60 - 30);

      // Compute comet position at this time
      const cometPos = orbitalPosition(
        props.parentCometOrbitalElements.a,
        props.parentCometOrbitalElements.e,
        props.parentCometOrbitalElements.i,
        props.parentCometOrbitalElements.Omega,
        props.parentCometOrbitalElements.omega,
        t
      );

      // Add random dispersion (cloud-like distribution)
      const dispersion = STREAM_RADIUS * (Math.random() - 0.5);
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * dispersion;

      const x = cometPos.x + distance * Math.cos(angle);
      const y = cometPos.y + distance * Math.sin(angle);
      const z = cometPos.z + distance * Math.sin(Math.random() * Math.PI);

      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color: yellow to orange glow
      colors[i * 3 + 0] = 0.8 + Math.random() * 0.2; // R
      colors[i * 3 + 1] = 0.6 + Math.random() * 0.2; // G
      colors[i * 3 + 2] = 0.1 + Math.random() * 0.1; // B
    }

    return { positions, colors };
  }, [props]);

  // Check if Earth is intersecting the stream
  const isIntersecting = useMemo(() => {
    // Simple distance test: is Earth within stream radius?
    const streamCenterPos = orbitalPosition(
      props.parentCometOrbitalElements.a,
      props.parentCometOrbitalElements.e,
      props.parentCometOrbitalElements.i,
      props.parentCometOrbitalElements.Omega,
      props.parentCometOrbitalElements.omega,
      currentTime
    );

    const distance = earthPosition.distanceTo(streamCenterPos);
    return distance < STREAM_RADIUS;
  }, [currentTime, earthPosition]);

  // Custom shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        varying float vDistance;

        void main() {
          vColor = color;
          vDistance = length(gl_Vertex);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(gl_Vertex, 1.0);
          gl_PointSize = 2.0;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vDistance;
        uniform bool isActive;
        uniform float time;

        void main() {
          float r = length(gl_PointCoord - vec2(0.5));
          if (r > 0.5) discard;
          
          float alpha = (1.0 - r * 2.0);
          if (isActive) {
            alpha *= 0.8 + 0.2 * sin(time * 5.0); // Pulsing glow when active
          } else {
            alpha *= 0.3;
          }
          
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      uniforms: {
        isActive: { value: isIntersecting },
        time: { value: 0 },
      },
    });
  }, [isIntersecting]);

  // Update shader time uniform
  useFrame(({ clock }) => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.time.value = clock.getElapsedTime();
    }
  });

  // Create InstancedBufferGeometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  return (
    <points
      ref={meshRef}
      geometry={geometry}
      material={shaderMaterial}
      scale={1.496e11} // Scale AU to meters
    />
  );
}

// Helper function: compute orbital position from Keplerian elements
// (See useEarthPosition.ts above for full implementation)
function orbitalPosition(
  a: number,
  e: number,
  i: number,
  Omega: number,
  omega: number,
  jd: number
): THREE.Vector3 {
  const T = jd - 2451545.0;
  const n = 0.01; // approximate mean motion
  const M = ((n * T) % 360) * (Math.PI / 180);

  // ... (use solveKeplersEquation and applyOrbitalRotations from above)
  // Simplified for readability
  return new THREE.Vector3(0, 0, 0); // Placeholder
}

function dateToJulianDate(date: Date): number {
  const unixTime = date.getTime();
  const unixEpochJD = 2440587.5;
  return unixEpochJD + unixTime / (1000 * 86400);
}
```

---

## 4. TIME SCRUBBER UI

```typescript
// src/components/UI/TimeScrubber.tsx

import React, { useState, useEffect } from 'react';
import { useSimulation } from '../../store/simulation';

export function TimeScrubber() {
  const { currentTime, baseTime, isPlaying, playSpeed, setTime, togglePlayback, setPlaySpeed } =
    useSimulation();
  const [isDragging, setIsDragging] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  // Convert current time to slider position (0-100)
  const timeRange = 365.25 * 2; // 2-year range
  const daysSinceBase = (currentTime - baseTime) * 365.25;
  const sliderPosition = (daysSinceBase / timeRange) * 100;

  useEffect(() => {
    if (!isDragging) {
      setDisplayValue(sliderPosition);
    }
  }, [sliderPosition, isDragging]);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleSliderChange = (value: number) => {
    setDisplayValue(value);

    // Convert slider position back to Julian Date
    const daysFromBase = (value / 100) * timeRange;
    const newJD = baseTime + daysFromBase / 365.25;
    setTime(newJD);
  };

  const handlePlayClick = () => {
    togglePlayback();
  };

  const currentDate = new Date(baseTime * 86400 * 1000 - 2440587.5 * 86400 * 1000);

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
      {/* Play/Pause Button */}
      <button
        onClick={handlePlayClick}
        className={`px-4 py-2 rounded font-semibold transition-colors ${
          isPlaying
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Date Display */}
      <div className="text-center">
        <p className="text-sm text-gray-400">Date</p>
        <p className="text-lg font-mono font-bold">
          {currentDate.toLocaleDateString()} {currentDate.toLocaleTimeString()}
        </p>
      </div>

      {/* Time Slider */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="100"
          value={displayValue}
          onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
          className="flex-1 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #8b5cf6 ${displayValue}%, #4b5563 ${displayValue}%, #4b5563 100%)`,
          }}
        />
      </div>

      {/* Speed Control */}
      <div>
        <label className="text-sm text-gray-400">Playback Speed</label>
        <select
          value={playSpeed}
          onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
          className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
        >
          <option value={1}>1x (Real Time)</option>
          <option value={10}>10x</option>
          <option value={100}>100x</option>
          <option value={1000}>1000x</option>
        </select>
      </div>
    </div>
  );
}
```

---

## 5. METEOR SHOWER TELEMETRY DISPLAY

```typescript
// src/components/UI/TelemetryPanel.tsx

import React, { useMemo } from 'react';
import { useSimulation } from '../../store/simulation';

interface MeteorShowerTelemetry {
  name: string;
  parentComet: string;
  radiationConstellation: string;
  peakZHR: number;
  peakSpeed: number; // km/s
  isActive: boolean;
  relativeVelocity: number; // km/s
}

export function TelemetryPanel({ shower }: { shower: MeteorShowerTelemetry }) {
  const { earthPosition } = useSimulation();

  const earthVelocity = useMemo(() => {
    // Earth's orbital velocity (roughly 29.78 km/s, varies slightly)
    return 29.78;
  }, []);

  const closingSpeed = useMemo(() => {
    // Simplified: closing speed ≈ relative velocity between Earth and meteors
    return shower.peakSpeed + earthVelocity;
  }, [shower.peakSpeed, earthVelocity]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
      <h3 className="text-xl font-bold text-purple-400">{shower.name}</h3>

      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            shower.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
          }`}
        />
        <span className="text-sm">
          {shower.isActive ? 'Earth in Stream' : 'Not Active'}
        </span>
      </div>

      {/* Shower Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Parent Comet:</span>
          <span className="font-mono font-bold">{shower.parentComet}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Radiant:</span>
          <span className="font-mono font-bold">{shower.radiationConstellation}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Peak ZHR:</span>
          <span className="font-mono font-bold">{shower.peakZHR} meteors/hr</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Meteoroid Velocity:</span>
          <span className="font-mono font-bold">{shower.peakSpeed} km/s</span>
        </div>
      </div>

      {/* Earth Dynamics */}
      <hr className="border-slate-700" />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Earth Orbital Velocity:</span>
          <span className="font-mono font-bold">{earthVelocity.toFixed(2)} km/s</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Closing Speed:</span>
          <span className="font-mono font-bold text-orange-400">
            {closingSpeed.toFixed(2)} km/s
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Distance:</span>
          <span className="font-mono font-bold">
            {(earthPosition.length() / 1.496e11).toFixed(2)} AU
          </span>
        </div>
      </div>

      {/* Why Simulator Insight */}
      {shower.isActive && (
        <div className="mt-4 p-3 bg-green-900 bg-opacity-30 border-l-4 border-green-500 rounded">
          <p className="text-sm text-green-300">
            💡 <strong>Why it's happening:</strong> Earth is passing through the orbital path
            of debris left by {shower.parentComet}. These particles will collide with our
            atmosphere, creating meteors.
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 6. ANIMATION LOOP (useFrame Hook)

```typescript
// src/components/3D/Scene.tsx - Animation Loop Pattern

import { useFrame } from '@react-three/fiber';
import { useSimulation } from '../../store/simulation';

export function Scene() {
  const { isPlaying, playSpeed, advanceTime } = useSimulation();

  useFrame(({ clock }) => {
    if (isPlaying) {
      const deltaSeconds = clock.getDelta();
      advanceTime(deltaSeconds); // Zustand will update derived state
    }
  });

  return (
    <>
      {/* 3D Components here */}
    </>
  );
}
```

---

## 7. ISS TLE PARSING & PROPAGATION

```typescript
// src/lib/data/tle-parser.ts

import * as satellite from 'satellite.js';

interface TLEData {
  satnum: number;
  epochYear: number;
  epochDay: number;
  inclination: number;
  raan: number; // Right Ascension of Ascending Node
  eccentricity: number;
  argOfPerigee: number;
  meanAnomaly: number;
  meanMotion: number;
  revolutionAtEpoch: number;
}

/**
 * Parse ISS TLE (Two-Line Element) data
 * Example:
 * ISS (ZARYA)
 * 1 25544U 98067A   26143.50000000  .00005005  00000-0  93675-4 0  9990
 * 2 25544  51.6404 169.4720 0002317  54.8816 124.2908 15.54222062443558
 */
export function parseTLE(line1: string, line2: string): TLEData {
  const satnum = parseInt(line1.substring(2, 7));
  const epochYear = parseInt(line1.substring(18, 20));
  const epochDay = parseFloat(line1.substring(20, 32));
  const inclination = parseFloat(line2.substring(8, 16));
  const raan = parseFloat(line2.substring(17, 25));
  const eccentricity = parseFloat('0.' + line2.substring(26, 33));
  const argOfPerigee = parseFloat(line2.substring(34, 42));
  const meanAnomaly = parseFloat(line2.substring(43, 51));
  const meanMotion = parseFloat(line2.substring(52, 63));
  const revolutionAtEpoch = parseInt(line2.substring(63, 68));

  return {
    satnum,
    epochYear,
    epochDay,
    inclination,
    raan,
    eccentricity,
    argOfPerigee,
    meanAnomaly,
    meanMotion,
    revolutionAtEpoch,
  };
}

/**
 * Propagate ISS position at a given Julian Date using SGP4
 */
export function propagateISS(tleData: TLEData, julianDate: number): {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
} {
  // Convert TLE epoch to Date
  const epochYear = tleData.epochYear + (tleData.epochYear < 70 ? 2000 : 1900);
  const epochDate = new Date(epochYear, 0, 1);
  epochDate.setTime(epochDate.getTime() + (tleData.epochDay - 1) * 86400000);

  // Convert Julian Date to Date
  const jsDate = new Date((julianDate - 2440587.5) * 86400000);

  // Use satellite.js SGP4 propagator
  const satrec = satellite.twoline2satrec(
    `1 ${tleData.satnum}U 98067A   ${String(tleData.epochYear).padStart(2, '0')}${String(
      tleData.epochDay
    ).padStart(12, '0')} .00005005  00000-0  93675-4 0  9990`,
    `2 ${tleData.satnum}  ${String(tleData.inclination).padStart(8, ' ')} ${String(
      tleData.raan
    ).padStart(8, ' ')} 0002317  ${String(tleData.argOfPerigee).padStart(8, ' ')} ${String(
      tleData.meanAnomaly
    ).padStart(8, ' ')} 15.54222062443558`
  );

  const positionAndVelocity = satellite.propagate(satrec, jsDate);

  // Return ECI coordinates (km) converted to meters
  if (positionAndVelocity.position && positionAndVelocity.velocity) {
    return {
      position: new THREE.Vector3(
        (positionAndVelocity.position as any).x * 1000,
        (positionAndVelocity.position as any).y * 1000,
        (positionAndVelocity.position as any).z * 1000
      ),
      velocity: new THREE.Vector3(
        (positionAndVelocity.velocity as any).x * 1000,
        (positionAndVelocity.velocity as any).y * 1000,
        (positionAndVelocity.velocity as any).z * 1000
      ),
    };
  }

  // Fallback
  return {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
  };
}
```

---

## 8. QUICK DEBUG CHECKLIST

Before deploying, verify:

- [ ] **Time accuracy:** Compare computed Earth position with NASA Horizons for same date
- [ ] **Frame rate:** Monitor FPS in DevTools → Performance; target 60 FPS desktop, 30+ mobile
- [ ] **Particle count:** Reduce from 500K if FPS drops below target
- [ ] **Mobile responsiveness:** Test on actual device, not just Chrome dev tools
- [ ] **Data freshness:** ISS TLE updates daily; meteor shower catalog yearly
- [ ] **User feedback:** Time scrubber responsive, meteor glow visible when active

---

## 9. COMMON PITFALLS & SOLUTIONS

| Issue | Cause | Fix |
|-------|-------|-----|
| Earth doesn't orbit correctly | Wrong Kepler coefficients | Use tested astronomical data; validate against NASA |
| Particles lag on mobile | Instancing not working | Verify `InstancedBufferGeometry` support; fallback to simple `Points` |
| Time scrubber jumps | State not decoupled from physics | Use Zustand, don't call physics every frame |
| ISS disappears | TLE parsing error | Log parsed values; cross-check with `satellite.js` test |
| Meteor stream always visible | Intersection test too broad | Debug sphere radius; add console logging |

---

## 10. NEXT STEPS

1. **Fork/Clone the scaffold:** Use the Stargaze repo as your base
2. **Implement Phase 1 (foundation):** Earth + rotating camera + time scrubber UI
3. **Add Phase 2 (physics):** Integrate Skyfield or TS-Orbitals, validate Earth position
4. **Build Phase 3 (particles):** Implement meteor stream volumetrics with shader
5. **Deploy & iterate:** Push to Vercel, collect user feedback, refine

---

**Good luck! 🚀**
