# STARGAZE: Technical Architecture & UX Blueprint
## 4D Interactive Solar System Explorer with Educational Meteor Shower Volumetrics

**Version:** 1.0  
**Created:** 2026-05-23  
**Objective:** Transform static astronomy education into an immersive, real-time, physics-accurate interactive experience.

---

## 📋 EXECUTIVE SUMMARY

Stargaze is a WebGL-powered 3D solar system viewer designed to teach orbital mechanics, meteor shower physics, and space exploration through direct manipulation and real-time visualization. The core innovation—the **"Why Simulator"**—lets users scrub through time to watch Earth's position relative to meteoroid streams, making abstract concepts concrete and intuitive.

**Key Differentiators:**
- Time scrubbing reveals *why* meteor showers occur at predictable times (Earth crossing static debris fields)
- Volumetric particle systems visualize meteoroid streams as actual orbital debris, not flat graphics
- Multi-perspective camera system (free roam, locked tracking, constellation view)
- Live telemetry overlays explain orbital velocity, radiant points, parent comets
- Mobile-optimized performance using Three.js Level-of-Detail (LOD) and instanced rendering

---

## PART 1: UX/UI WIREFRAME CONCEPT

### 1.1 Layout & Information Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: "Stargaze" | Mode Selector | Settings ⚙️               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐  │
│  │   3D CANVAS                 │  │  RIGHT SIDEBAR           │  │
│  │   (WebGL Viewport)          │  │  ┌────────────────────┐  │  │
│  │                             │  │  │ TIME SCRUBBER      │  │  │
│  │   • Free orbit camera       │  │  │ [◄─ ━━━ ►]         │  │  │
│  │   • Earth centered (lock)   │  │  │ May 15, 2025       │  │  │
│  │   • Debris field focused    │  │  │ 14:32 UTC          │  │  │
│  │   • ISS track view          │  │  │                    │  │  │
│  │                             │  │  │ ┌─ Play  ⏯  ┐      │  │  │
│  │ [Earth]                     │  │  │ Speed: 1x          │  │  │
│  │  🌍 (blue marble)           │  │  │ ┌──────────┐       │  │  │
│  │                             │  │  │ │ ▢ Real   │       │  │  │
│  │  [ISS]                      │  │  │ │ ▢ 10x    │       │  │  │
│  │  ◇ (orbiting)               │  │  │ │ ▢ 100x   │       │  │  │
│  │                             │  │  │ └──────────┘       │  │  │
│  │  [Debris Fields]            │  │  └────────────────────┘  │  │
│  │  ✦✦✦ (volumetric)          │  │                         │  │
│  │                             │  │  ┌─ TELEMETRY ────────┐  │  │
│  │                             │  │  │ Selected: Perseids  │  │  │
│  │                             │  │  │ Status: Active      │  │  │
│  │                             │  │  │                     │  │  │
│  │                             │  │  │ Parent: 109P/Swift  │  │  │
│  │                             │  │  │ Radiant: Perseus    │  │  │
│  │                             │  │  │ Peak Speed: 59 km/s │  │  │
│  │                             │  │  │ ZHR (Zenith): 100   │  │  │
│  │                             │  │  │                     │  │  │
│  │                             │  │  │ Earth Velocity:     │  │  │
│  │                             │  │  │ 29.78 km/s (orbital)│  │  │
│  │                             │  │  │ 0.465 km/s (axial)  │  │  │
│  │                             │  │  └─────────────────────┘  │  │
│  │                             │  │                         │  │
│  │                             │  │  ┌─ LEGEND ────────────┐  │  │
│  │                             │  │  │ 🌍 Earth            │  │  │
│  │                             │  │  │ ☀️  Sun             │  │  │
│  │                             │  │  │ ◇ ISS              │  │  │
│  │                             │  │  │ ✦ Meteoroid Stream  │  │  │
│  │                             │  │  │ ⭘ Planetary Orbits  │  │  │
│  │                             │  │  └─────────────────────┘  │  │
│  └─────────────────────────────┘  └──────────────────────────┘  │
│                                                                   │
│ BOTTOM BAR: Mode Tabs | Data Source Status | Help              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Interaction Modes (Tabs at Bottom)

| Mode | Purpose | Camera Behavior |
|------|---------|-----------------|
| **Explore** | Free-roaming 360° navigation, user-driven discovery | Orbital camera (mouse drag), scroll zoom, right-click pan |
| **Meteor Showers** | Focus on a specific shower, scrub time to see Earth entry | Auto-focus on debris field, auto-rotate around stream |
| **ISS Tracker** | Watch real-time orbital path, see what astronauts see | Lock to ISS, show ground track, show nadir view |
| **Orbital Mechanics** | Learn how objects move around the sun | Play orbital paths, highlight Kepler elements |
| **Timeline Events** | Pre-built educational moments (closest approaches, eclipses) | Auto-advance through sequence, pause for explanation |

### 1.3 Educational Overlay System (Non-Intrusive)

**Goals:**
- Surface telemetry without cluttering the 3D view
- Allow users to explore visually first, then dive into data
- Support multiple learning styles (visual + numerical)

**Implementation:**
- **Right Sidebar:** Collapsible, shows only when object is selected
- **Tooltip Annotations:** Hover over objects for quick facts (velocity, distance, constellation)
- **Bottom Sheet (Mobile):** Swipe up for full telemetry on selected object
- **Comparison Mode:** Side-by-side telemetry for two selected objects (e.g., Earth vs. ISS closing speed)

### 1.4 Mobile-First Responsive Design

**Desktop (1200px+):**
- Side-by-side layout (canvas + sidebar)
- Full floating controls in 3D space

**Tablet (768px–1199px):**
- Canvas dominant, sidebar toggles on top
- Touch-friendly controls (larger hit targets)
- Pinch-to-zoom camera

**Mobile (<768px):**
- Canvas full-screen, controls fade after 3 seconds
- Bottom sheet swipes up for telemetry
- Gyroscope support for immersive camera rotation (optional)

---

## PART 2: TECHNICAL IMPLEMENTATION PLAN

### 2.1 Tech Stack Rationale

| Layer | Technology | Why |
|-------|-----------|-----|
| **Rendering Engine** | Three.js (r162+) | Mature, optimized for complex scenes, built-in LOD/instancing |
| **React Integration** | React Three Fiber (R3F) v8+ | Declarative 3D components, hot-reload friendly, Suspense support |
| **State Management** | Zustand + Jotai | Lightweight, decoupled, good for time-based state (frame updates) |
| **Time Simulation** | Custom ECS (Entity-Component-System) | Decouple orbital physics from rendering; easy to pause/rewind |
| **Orbital Data** | Skyfield (Python wrapper) or TS-Orbitals (JS) | Accurate ephemeris for Earth/planets/comets; TLE updates for ISS |
| **UI Framework** | React + Tailwind CSS + Shadcn/ui | Accessible, composable, small bundle size |
| **Data Fetching** | TanStack Query (React Query) | Cache celestial data, handle NASA API rate limits elegantly |
| **Particle Systems** | Three.js BufferGeometry + custom shader | Render millions of particles without lag using instanced rendering |
| **Performance Monitor** | Spline Monitor (custom) or Leva | Debug frame rate, GPU memory, shader compilation |
| **Build Tool** | Vite + esbuild | Fast HMR, small bundle, ESM-native |
| **Deployment** | Vercel (or Netlify) | Edge caching for static assets, serverless for API proxying |

### 2.2 Project Structure

```
stargaze/
├── public/
│   ├── data/
│   │   ├── tle-data.json              # ISS + satellite TLEs (updated weekly)
│   │   ├── meteor-showers.json        # 7+ annual showers with peak dates
│   │   ├── comet-orbits.json          # Parent comets for debris fields
│   │   └── planetary-ephem.json       # Pre-computed planetary positions
│   └── models/
│       ├── earth-texture-8k.jpg       # Blue marble texture
│       ├── iss-model.gltf             # ISS 3D geometry
│       └── sun-halo.glb               # Procedural sun geometry
│
├── src/
│   ├── components/
│   │   ├── 3D/
│   │   │   ├── Scene.tsx              # Main Three.js scene wrapper
│   │   │   ├── Earth.tsx              # Earth rendering + rotation
│   │   │   ├── MeteorStream.tsx       # Volumetric debris field
│   │   │   ├── ISS.tsx                # ISS model + orbit
│   │   │   ├── Sun.tsx                # Sun + lighting
│   │   │   ├── OrbitalPaths.tsx       # Orbit line renderers
│   │   │   ├── Camera.tsx             # Camera controller (free/locked)
│   │   │   └── Annotations.tsx        # Hover labels, info tooltips
│   │   │
│   │   ├── UI/
│   │   │   ├── Header.tsx             # Title + mode selector
│   │   │   ├── Sidebar.tsx            # Telemetry + time controls
│   │   │   ├── TimeScrubber.tsx       # Time slider + playback
│   │   │   ├── ModeSelector.tsx       # Tab-based mode switching
│   │   │   ├── Legend.tsx             # Symbol legend
│   │   │   ├── MobileControls.tsx     # Touch gestures + mobile UI
│   │   │   └── DataPanel.tsx          # Detailed telemetry display
│   │   │
│   │   └── Layouts/
│   │       ├── DesktopLayout.tsx      # Side-by-side for >1200px
│   │       ├── TabletLayout.tsx       # Stacked for tablets
│   │       └── MobileLayout.tsx       # Full-screen canvas
│   │
│   ├── hooks/
│   │   ├── useOrbitalTime.ts          # Manage simulation time
│   │   ├── useMeteorShower.ts         # Active shower state + telemetry
│   │   ├── useEarthPosition.ts        # Real-time Earth position/rotation
│   │   ├── useISSTelemetry.ts         # Live ISS data (TLE-based)
│   │   ├── useCamera.ts               # Camera mode & movement
│   │   └── usePerformance.ts          # FPS monitor + optimization hints
│   │
│   ├── lib/
│   │   ├── physics/
│   │   │   ├── orbital.ts             # Kepler solver, position calculations
│   │   │   ├── meteor-geometry.ts     # Generate debris field points
│   │   │   ├── earth-rotation.ts      # GMST, axial tilt, precession
│   │   │   └── collision-detection.ts # Earth-stream intersection tests
│   │   │
│   │   ├── data/
│   │   │   ├── ephemeris.ts           # Pre-computed ephemeris helper
│   │   │   ├── tle-parser.ts          # Parse two-line element sets
│   │   │   ├── shower-catalog.ts      # Meteor shower definitions
│   │   │   └── api-client.ts          # NASA API wrapper (Horizons, etc.)
│   │   │
│   │   ├── shaders/
│   │   │   ├── meteoroid-vertex.glsl  # Vertex shader for particle system
│   │   │   ├── meteoroid-fragment.glsl# Fragment shader (glow/fade)
│   │   │   ├── earth-vertex.glsl      # Earth surface + atmosphere
│   │   │   └── orbit-path.glsl        # Smooth orbit line rendering
│   │   │
│   │   └── utils/
│   │       ├── time-utils.ts          # JD, timestamp conversions
│   │       ├── coord-transforms.ts    # ECI, ECEF, lat/lon conversions
│   │       ├── vector-math.ts         # Vec3 helpers (not Three.Vector3)
│   │       └── performance.ts         # Profiling helpers
│   │
│   ├── store/
│   │   ├── simulation.ts              # Zustand: time, playback, mode
│   │   ├── selection.ts               # Zustand: selected object, view mode
│   │   ├── settings.ts                # Zustand: user prefs (quality, labels)
│   │   └── data.ts                    # Jotai atoms: cached API responses
│   │
│   ├── styles/
│   │   ├── globals.css                # Tailwind setup, custom utilities
│   │   └── animations.css             # Fade-in, slide-in effects
│   │
│   ├── App.tsx                        # Root component + layout selection
│   └── main.tsx                       # Entry point
│
├── tests/
│   ├── physics/
│   │   ├── orbital.test.ts            # Kepler solver accuracy tests
│   │   ├── earth-rotation.test.ts     # Axial tilt, precession validation
│   │   └── meteor-geometry.test.ts    # Debris field generation tests
│   │
│   └── integration/
│       └── meteor-shower.test.ts      # End-to-end meteor shower visualization
│
├── docs/
│   ├── API_SOURCES.md                 # NASA Horizons, JPL Skyfield setup
│   ├── PHYSICS_NOTES.md               # Orbital mechanics breakdown
│   └── SHADER_GUIDE.md                # Custom GLSL shader documentation
│
└── package.json
```

### 2.3 Implementation Phases

#### **Phase 1: Foundation (Weeks 1–2)**
- [ ] Set up React + Three.js + React Three Fiber scaffold
- [ ] Build basic Earth mesh (blue marble texture + rotation)
- [ ] Implement free-roaming camera controller
- [ ] Create time scrubber UI (no physics yet)
- [ ] Set up Zustand stores for simulation time and mode

**Deliverable:** Rotating Earth you can orbit around, scrubber that changes a time display.

#### **Phase 2: Orbital Mechanics (Weeks 3–4)**
- [ ] Integrate Skyfield or TS-Orbitals library
- [ ] Implement Kepler solver for Earth position relative to Sun
- [ ] Build ISS TLE parser and orbital position calculator
- [ ] Add Sun and planetary orbit visualizations
- [ ] Connect time scrubber to orbital position updates

**Deliverable:** Earth orbits the Sun, ISS orbits Earth, all positions accurate to real data.

#### **Phase 3: Meteor Shower Volumetrics (Weeks 5–6)**
- [ ] Define meteor shower catalog (7+ major showers with orbital elements)
- [ ] Implement debris field point generation (sample meteoroid stream coordinates)
- [ ] Build particle system shader (instanced rendering for 1M+ particles)
- [ ] Implement visual highlighting when Earth enters stream
- [ ] Add telemetry overlay (shower name, parent comet, ZHR, radiant constellation)

**Deliverable:** Volumetric meteor showers render as glowing particle clouds; time scrubbing shows Earth moving through them.

#### **Phase 4: Educational UI & Polish (Weeks 7–8)**
- [ ] Implement telemetry sidebar with dynamic data
- [ ] Add mode tabs (Explore, Meteor Showers, ISS, Orbital Mechanics, Timeline Events)
- [ ] Build responsive layouts (desktop, tablet, mobile)
- [ ] Add annotations and hover tooltips
- [ ] Optimize rendering (LOD, culling, instancing)

**Deliverable:** Full-featured UI, responsive design, smooth on desktop and mobile.

#### **Phase 5: Live Data & Polish (Weeks 9–10)**
- [ ] Integrate NASA APIs (optional: live ISS position, current date defaults)
- [ ] Add animation polish (smooth transitions, easing)
- [ ] Build educational timeline (pre-built "moments" like lunar eclipses)
- [ ] Performance audit and optimization
- [ ] Deploy to Vercel

**Deliverable:** Live, production-ready web app.

### 2.4 Core Component Deep Dives

#### **2.4.1 MeteorStream.tsx (Volumetric Particle System)**

```typescript
// Pseudocode structure
export function MeteorStream({ showerData, earthPosition, isActive }) {
  const particleCount = 500_000; // Scale based on device capability
  
  // Generate debris field points (orbit sampled, cloud-like distribution)
  const positions = useMemo(() => {
    return generateMeteorStreamGeometry(
      showerData.parentComet,
      showerData.peakDate,
      showerData.inclination,
      particleCount
    );
  }, [showerData]);

  // Check collision: is Earth moving through the stream?
  const isIntersecting = useMemo(() => {
    return checkStreamIntersection(earthPosition, showerData.orbitElements);
  }, [earthPosition, showerData]);

  // Instanced buffer geometry for performance
  const instancedGeometry = new THREE.InstancedBufferGeometry();
  // ... populate with positions, colors, scales

  // Custom shader: fade particles based on distance to camera
  const material = new THREE.ShaderMaterial({
    vertexShader: meteoroidVertexShader,
    fragmentShader: meteoroidFragmentShader,
    uniforms: {
      isActive: { value: isActive },
      intensity: { value: isIntersecting ? 1.0 : 0.4 },
      time: { value: 0 },
    },
  });

  return (
    <instancedMesh geometry={instancedGeometry} material={material} />
  );
}
```

**Why This Works:**
- **Instanced rendering:** Draw 500K particles in a single draw call instead of 500K draw calls
- **Custom shader:** GPU-side animation and fading reduces CPU overhead
- **Collision detection:** Simple sphere/AABB test to highlight active streams

#### **2.4.2 TimeScrubber.tsx (Time Control)**

```typescript
export function TimeScrubber() {
  const { time, setTime, isPlaying, setIsPlaying, playSpeed } = useOrbitalTime();
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (value: number) => {
    const newTime = baseTime + (value / 100) * (365.25 * 86400); // 1 year range
    setTime(newTime);
    // All orbital positions update reactively
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    // requestAnimationFrame loop advances time by (deltaTime * playSpeed)
  };

  return (
    <div className="time-control">
      <button onClick={togglePlay}>{isPlaying ? '⏸' : '⏯'}</button>
      
      <input
        type="range"
        min="0"
        max="100"
        value={isDragging ? dragValue : currentSliderPosition}
        onChange={(e) => handleDrag(parseFloat(e.target.value))}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
      />
      
      <div>{formatDate(time)}</div>
      
      <select onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}>
        <option value={1}>1x (Real Time)</option>
        <option value={10}>10x</option>
        <option value={100}>100x</option>
      </select>
    </div>
  );
}
```

**Why This Works:**
- **Decoupled from rendering:** Time state changes update all orbital calculations reactively
- **Smooth dragging:** isDragging flag prevents jumpiness when user is scrubbing
- **Playback modes:** Real-time, sped-up, or paused—all use the same math underneath

#### **2.4.3 useEarthPosition.ts (Physics Hook)**

```typescript
export function useEarthPosition(julianDate: number) {
  const [position, setPosition] = useState<Vector3>(new THREE.Vector3());
  const [rotation, setRotation] = useState<Euler>(new THREE.Euler());

  useEffect(() => {
    // Use Skyfield (or TS-Orbitals) to compute Earth's position relative to Sun
    const ephemeris = computeEarthEphemeris(julianDate);
    
    // AU to meters (1 AU ≈ 1.496e11 m)
    const positionMeters = new THREE.Vector3(
      ephemeris.x * AU_TO_METERS,
      ephemeris.y * AU_TO_METERS,
      ephemeris.z * AU_TO_METERS
    );

    // Axial tilt + Greenwich Mean Sidereal Time
    const gmst = computeGMST(julianDate);
    const axialTilt = 23.44 * THREE.MathUtils.DEG2RAD;
    const rotationEuler = new THREE.Euler(axialTilt, gmst, 0, 'YXZ');

    setPosition(positionMeters);
    setRotation(rotationEuler);
  }, [julianDate]);

  return { position, rotation };
}
```

---

## PART 3: MATHEMATICAL & PHYSICS FOUNDATION

### 3.1 Coordinate Systems

We use three primary coordinate systems:

| System | Origin | Use Case |
|--------|--------|----------|
| **Heliocentric Ecliptic (ECI)** | Sun's center, J2000 epoch | Planetary orbits, comet orbits |
| **Geocentric Equatorial (ECI)** | Earth's center, J2000 epoch | ISS orbit, Earth-relative calculations |
| **Earth-Centered Fixed (ECEF)** | Earth's center, rotates with Earth | Surface coordinates (lat/lon) |
| **Topocentric Horizon (SEZ)** | Observer's location | What you see in the night sky (altitude/azimuth) |

**Transformations:**
```
Heliocentric Ecliptic ──(subtract Earth pos)──> Geocentric Equatorial
Geocentric Equatorial ──(apply GMST rotation)──> ECEF
ECEF ──(geodetic conversion)──> Lat/Lon/Height
ECEF ──(observer matrix)──> Topocentric Horizon (Alt/Az)
```

### 3.2 Kepler Solver (Orbital Propagation)

**Input:** Keplerian orbital elements (a, e, i, Ω, ω, M) + Julian Date  
**Output:** Position (x, y, z) and velocity (vx, vy, vz)

```
1. Convert mean anomaly (M) to eccentric anomaly (E) using Newton-Raphson
   E = M + e * sin(E)  [iterate until convergence]

2. Convert eccentric anomaly to true anomaly (ν)
   tan(ν/2) = sqrt((1+e)/(1-e)) * tan(E/2)

3. Compute distance from focal point (r)
   r = a * (1 - e * cos(E))

4. Convert to Cartesian coordinates (orbital frame)
   x' = r * cos(ν)
   y' = r * sin(ν)
   z' = 0

5. Apply three rotations to align with reference frame
   [rotation by argument of perigee (ω)]
   [rotation by inclination (i)]
   [rotation by longitude of ascending node (Ω)]

6. Result: (x, y, z) in heliocentric coordinates
```

**Code Snippet (TypeScript):**
```typescript
function keplerSolve(meanAnomaly: number, eccentricity: number): number {
  let E = meanAnomaly; // Initial guess
  for (let i = 0; i < 10; i++) {
    const delta = (E - eccentricity * Math.sin(E) - meanAnomaly) /
                  (1 - eccentricity * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return E;
}

function orbitalPosition(
  a: number, e: number, i: number, Ω: number, ω: number, M: number
): THREE.Vector3 {
  const E = keplerSolve(M, e);
  const ν = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
  const r = a * (1 - e * Math.cos(E));

  // Orbital plane coordinates
  const x = r * Math.cos(ν);
  const y = r * Math.sin(ν);
  const z = 0;

  // Rotate by three Euler angles
  const c1 = Math.cos(Ω), s1 = Math.sin(Ω);
  const c2 = Math.cos(i), s2 = Math.sin(i);
  const c3 = Math.cos(ω), s3 = Math.sin(ω);

  return new THREE.Vector3(
    (c1 * c3 - s1 * s3 * c2) * x + (-c1 * s3 - s1 * c3 * c2) * y,
    (s1 * c3 + c1 * s3 * c2) * x + (-s1 * s3 + c1 * c3 * c2) * y,
    s3 * s2 * x + c3 * s2 * y
  );
}
```

### 3.3 Earth Rotation (GMST & Axial Tilt)

**Greenwich Mean Sidereal Time (GMST):**
Used to rotate from inertial (ECI) to fixed (ECEF) coordinates.

```
GMST(JD) = 18.697374558 + 24110.54841 * (JD - 2451545) / 86400
           + 0.093104 * (JD - 2451545)² / 86400² [seconds]

Then convert to radians and apply as rotation around Z-axis.
```

**Axial Tilt (Obliquity):**
Earth's axis tilts 23.44° from its orbital plane. This causes:
- Seasons
- Changing latitude of subsolar point
- Varying observer altitude/azimuth for same object

```
Tilt angle = 23.44° ≈ 0.409 radians
Apply as Euler rotation (axial tilt around X, then GMST around Z)
```

### 3.4 Meteor Stream Intersection (The "Why" Simulator)

**Problem:** Given Earth's position and a meteoroid stream's orbital elements, determine if Earth is intersecting the stream.

**Solution:** Geometric intersection test.

```
1. Define the meteoroid stream as a tube with:
   - Orbital elements (same as comet that created it)
   - Radius (dispersal width, ~0.01 AU)
   - Half-length along orbit

2. Compute closest point on stream's orbit to Earth's position
   P_stream = orbitalPosition(streamElements, julianDate)
   
3. Test if Earth is within radius of stream
   distance = ||Earth - P_stream||
   isIntersecting = (distance < streamRadius)

4. For visual feedback, vary shader intensity:
   intensity = 1.0 if distance < streamRadius
            = fade(distance) otherwise
```

**Why This Is Intuitive:**
- Shows *exactly* when Earth crosses the stream's path
- Explains why peaks occur on predictable calendar dates
- Shows how Earth's axial tilt affects peak visibility by latitude

### 3.5 Two-Line Element (TLE) Format for ISS

**Format:**
```
ISS (ZARYA)
1 25544U 98067A   26143.50000000  .00005005  00000-0  93675-4 0  9990
2 25544  51.6404 169.4720 0002317  54.8816 124.2908 15.54222062443558
```

**Parsing:**
```typescript
function parseTLE(line1: string, line2: string) {
  const satnumFromLine1 = parseInt(line1.substring(2, 7));
  const epochYear = parseInt(line1.substring(18, 20));
  const epochDay = parseFloat(line1.substring(20, 32));
  const inclination = parseFloat(line2.substring(8, 16));
  const raan = parseFloat(line2.substring(17, 25));
  const eccentricity = parseFloat("0." + line2.substring(26, 33));
  const argPerigee = parseFloat(line2.substring(34, 42));
  const meanAnomaly = parseFloat(line2.substring(43, 51));
  const meanMotion = parseFloat(line2.substring(52, 63));
  
  return { epochYear, epochDay, inclination, raan, eccentricity, argPerigee, meanAnomaly, meanMotion };
}
```

**Propagation:** Use SGP4/SDP4 algorithms (simplify with existing libraries like `satellite.js`)

---

## PART 4: DATA ARCHITECTURE & API INTEGRATION

### 4.1 Data Sources

| Data | Source | Update Frequency | Format |
|------|--------|------------------|--------|
| **Planetary Positions** | NASA Horizons API (via Python backend) | Weekly | Ephemeris tables (x,y,z) |
| **ISS Orbit** | Space-Track TLE API | Daily | Two-Line Element sets |
| **Meteor Shower Calendar** | IAU Meteor Data Center + custom catalog | Yearly | JSON with orbital elements |
| **Comet Orbits** | JPL Horizons, MPC | Yearly | Orbital elements |
| **Earth Texture** | NOAA (Blue Marble) | Static | 8K JPEG |
| **ISS 3D Model** | NASA 3D Resources (GLTF) | Static | GLTF/GLB |

### 4.2 Caching Strategy

```
┌──────────────┐
│ Browser Disk │  (IndexedDB)
│   Cache      │  • Meteor shower catalog (static)
│ (1-month TTL)│  • Comet orbits (yearly updates)
└──────────────┘
       ↓
┌──────────────┐
│ API Proxy    │  (Vercel Serverless)
│ (Edge Cache) │  • Rate-limit NASA APIs
│  (1-week TTL)│  • Transform responses to JSON
└──────────────┘
       ↓
┌──────────────┐
│ External APIs│  (On-demand)
│              │  • NASA Horizons
│              │  • Space-Track TLEs
└──────────────┘
```

### 4.3 Real-Time Data Pipeline

```typescript
// React Query hook for ISS TLE data
export function useISSTelemetry() {
  return useQuery({
    queryKey: ['iss-tle'],
    queryFn: async () => {
      const response = await fetch('/api/tle/iss');
      return response.json(); // { epoch, inclination, raan, ... }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchInterval: 1000 * 60 * 60 * 24, // Refetch daily
  });
}
```

---

## PART 5: PERFORMANCE OPTIMIZATION STRATEGY

### 5.1 Rendering Optimizations

| Technique | Implementation | Benefit |
|-----------|---|---|
| **Instanced Rendering** | Meteoroid particles as InstancedBufferGeometry | 500K → 1 draw call |
| **Level-of-Detail (LOD)** | Swap high-poly Earth for low-poly at distance | ~60% GPU load reduction |
| **Frustum Culling** | Skip objects outside camera view | Skip invisible objects |
| **Occlusion Culling** | Skip objects hidden behind Earth | Further reduce draw calls |
| **Texture Atlasing** | Combine small textures into one atlas | Fewer texture binds |
| **Lazy Loading** | Load ISS model only when entering ISS mode | Faster initial page load |

### 5.2 Physics Optimizations

| Technique | Implementation | Benefit |
|-----------|---|---|
| **Pre-computed Ephemeris** | Cache orbital positions for 1-year range at 1-day intervals | Avoid Kepler solver every frame |
| **Interpolation** | Linear interpolation between cached positions for smooth animation | No loss of smoothness, huge perf gain |
| **Web Worker** | Offload Kepler solver to Worker thread | Don't block UI during heavy computation |
| **Time Quantization** | Snap time to nearest hour during playback | Reduce recalculation frequency |

### 5.3 Memory Budget

```
Target: <100MB loaded data

Desktop Allocation:
├── Earth texture (8K): 64 MB
├── ISS model (GLTF): 5 MB
├── Particle buffer (500K): 12 MB
├── Ephemeris cache: 8 MB
└── JS + React bundle: 9 MB
   Total: ~98 MB ✓

Mobile Allocation (downscaled):
├── Earth texture (2K): 4 MB
├── ISS model (decimated): 1 MB
├── Particle buffer (100K): 2.4 MB
├── Ephemeris cache (reduced range): 2 MB
└── JS + React bundle (minified): 6 MB
   Total: ~15 MB ✓
```

---

## PART 6: EDUCATIONAL FEATURES BREAKDOWN

### 6.1 The "Why Simulator" Interaction Flow

```
User clicks "Perseids" in mode selector
  ↓
UI highlights Perseids meteor stream in 3D
  ↓
Telemetry sidebar shows:
  - Parent comet: 109P/Swift-Tuttle
  - Peak date: August 11-13
  - Radiant point: Perseus constellation
  - ZHR (peak rate): ~100 meteors/hour
  ↓
User drags time scrubber to August 11
  ↓
Earth visibly moves into the debris field (volumetric glow)
  ↓
Sidebar updates:
  - "Earth is intersecting stream: YES"
  - Relative velocity: 41 km/s
  - Predicted local peak time (varies by latitude)
  ↓
User rotates camera to observer latitude (e.g., 40°N)
  ↓
Predictions update:
  - "Best viewing: 22:00 - 04:00 local time"
  - "Radiant altitude: 60° above horizon"
```

### 6.2 ISS Real-Time Tracker Mode

```
Timeline of interaction:
1. User enters ISS Tracker mode
2. Camera auto-locks to ISS
3. Two panels appear:
   a) 3D: ISS model orbiting Earth (ground track highlighted)
   b) Telemetry:
      - Altitude: 408 km
      - Speed: 7.66 km/s
      - Orbital period: 92.9 minutes
      - Current location: Over Atlantic Ocean
      - Next city pass: NYC (4 min 23 sec)
4. User clicks "What do astronauts see?"
5. Camera switches to nadir view (looking down at Earth)
6. Shows real-time ground track with daylight terminator
```

### 6.3 Educational Timeline Events (Pre-Built Scenarios)

```json
{
  "events": [
    {
      "id": "lunar-eclipse-2025",
      "title": "Total Lunar Eclipse",
      "date": "2025-03-14",
      "description": "Watch Earth's shadow sweep across the Moon",
      "camera": {
        "position": [1e11, 0.5e11, 0.5e11],
        "lookAt": "earth"
      },
      "narration": "A lunar eclipse occurs when Earth passes between the Sun and Moon..."
    },
    {
      "id": "perseids-peak-2025",
      "title": "Perseids Meteor Shower Peak",
      "date": "2025-08-12",
      "description": "Earth plows through the Swift-Tuttle debris field",
      "focus": "meteor-shower-perseids"
    }
  ]
}
```

---

## PART 7: DEPLOYMENT & MAINTENANCE

### 7.1 Build & Deploy Pipeline

```yaml
# .github/workflows/deploy.yml
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci && npm run build
      - run: npm run test
      - uses: vercel/action@main
        with:
          production: true
```

### 7.2 Data Update Pipeline

```bash
# Update meteor shower data yearly
# Update ISS TLE data weekly via cron job
0 0 * * 0  fetch-tle-data.sh > /var/log/tle-update.log 2>&1

# Precompute ephemeris for next 2 years
npm run compute-ephemeris
```

---

## PART 8: SUCCESS METRICS

### 8.1 Performance Targets

| Metric | Target | How to Measure |
|--------|--------|---|
| **FPS (Desktop)** | 60 FPS @ 1440p | Chrome DevTools Performance |
| **FPS (Mobile)** | 30 FPS @ 1080p | iOS Safari, Android Chrome |
| **Time to Interactive** | <2s | Lighthouse audit |
| **Bundle Size** | <12 MB (gzipped) | `webpack-bundle-analyzer` |
| **Memory (Peak)** | <100 MB (desktop), <50 MB (mobile) | DevTools Memory tab |

### 8.2 User Engagement Metrics

| Metric | Goal |
|--------|------|
| **Avg. Session Duration** | >10 min |
| **Bounce Rate** | <20% |
| **Return Visits** | >40% weekly active users |
| **Feature Usage** | >70% of users try meteor shower mode |

### 8.3 Educational Effectiveness

| Metric | Measure | Goal |
|--------|---------|------|
| **Concept Retention** | Post-visit quiz on meteor showers | >80% correct answers |
| **Engagement per Feature** | Time spent in each mode | Balanced across modes |
| **User Feedback** | NPS survey | >50 NPS |

---

## APPENDIX A: Recommended Learning Resources

1. **Orbital Mechanics:**
   - Vallado et al., "Fundamentals of Astrodynamics and Applications" (Ch. 1-4)
   - Curtis, "Orbital Mechanics for Engineering Students" (Ch. 2-3)

2. **Three.js & WebGL:**
   - Three.js Documentation: https://threejs.org/docs/
   - Real-Time Rendering (Akenine-Möller et al.)

3. **Astronomical Data:**
   - NASA Horizons System: https://ssd.jpl.nasa.gov/horizons/
   - JPL Skyfield: https://github.com/skyfielders/python-skyfield
   - Space-Track TLE Data: https://www.space-track.org/

4. **Meteor Showers:**
   - IAU Meteor Data Center: https://www.ta3.sk/IAUC22/
   - American Meteor Society: https://www.amsmeteors.org/

---

## APPENDIX B: Sample Code References

### Kepler Solver (Full Implementation)

```typescript
// lib/physics/orbital.ts

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function meanAnomalyAtEpoch(julianDate: number): number {
  const n0 = 10; // mean motion (rev/day) for a default low-Earth orbit
  const T = julianDate - 2451545.0; // Days since J2000
  return ((n0 * T) % 360) * DEG_TO_RAD;
}

export function eccentricAnomalyFromMean(
  M: number,
  e: number,
  tolerance = 1e-10
): number {
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

export function trueAnomalyFromEccentric(E: number, e: number): number {
  const sqrt = Math.sqrt((1 + e) / (1 - e));
  return 2 * Math.atan2(sqrt * Math.sin(E / 2), Math.cos(E / 2));
}

export function orbitalPositionFromElements(
  a: number,
  e: number,
  i: number,
  Omega: number,
  omega: number,
  M: number
): THREE.Vector3 {
  const E = eccentricAnomalyFromMean(M, e);
  const nu = trueAnomalyFromEccentric(E, e);
  const r = a * (1 - e * Math.cos(E));

  const cosOmega = Math.cos(Omega);
  const sinOmega = Math.sin(Omega);
  const cosOmegaPeri = Math.cos(omega);
  const sinOmegaPeri = Math.sin(omega);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);
  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);

  const x =
    r *
    (cosOmega * cosOmegaPeri - sinOmega * sinOmegaPeri * cosI) * cosNu +
    r * (-cosOmega * sinOmegaPeri - sinOmega * cosOmegaPeri * cosI) * sinNu;

  const y =
    r *
    (sinOmega * cosOmegaPeri + cosOmega * sinOmegaPeri * cosI) * cosNu +
    r * (-sinOmega * sinOmegaPeri + cosOmega * cosOmegaPeri * cosI) * sinNu;

  const z = r * sinI * sinOmegaPeri * cosNu + r * sinI * cosOmegaPeri * sinNu;

  return new THREE.Vector3(x, y, z);
}
```

---

## FINAL NOTES

This blueprint is **intentionally detailed** so you have concrete direction for implementation. Key decisions made:

1. **React Three Fiber** over raw Three.js for component reusability
2. **Instanced rendering** to handle 500K+ particles without performance death
3. **Pre-computed ephemeris** + interpolation to avoid constant Kepler solving
4. **Modular data architecture** (IndexedDB → API proxy → external APIs) to scale

**Next steps:**
1. Validate tech stack with a quick prototype (Earth + ISS + basic time scrubber)
2. Implement meteor stream geometry generation
3. Build out educational modes iteratively
4. Performance audit early and often

The "Why Simulator" is the heart of this—everything else is scaffolding to make that interaction possible.

---

*End of Blueprint Document*
