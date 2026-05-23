import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Satellite, Trash2, Sparkles, AlertTriangle, RefreshCw, X, Info, Radio } from 'lucide-react';
import meteorShowers from '../data/meteorShowers.json';

// Types
interface TLEData { name: string; line1: string; line2: string; }
interface SelectedInfo {
  type: 'satellite' | 'debris' | 'meteor' | 'ufo';
  name: string;
  data?: Record<string, string | number>;
}

interface MeteorShower {
  id: string; name: string; peakDate: string; startDate: string; endDate: string;
  zhr: number; ra: number; dec: number; description: string; constellation: string;
  parentBody: string; orbitalPeriod: number; composition: string;
  historicalStorms: { year: number; zhr: number; notes: string }[];
}

const showers = meteorShowers as MeteorShower[];

const UFO_LOCATIONS = [
  { name: 'Roswell, NM, USA', lat: 33.394, lon: -104.524, year: 1947, type: 'Unidentified Aerial Phenomenon' },
  { name: 'Area 51, NV, USA', lat: 37.235, lon: -115.811, year: 1989, type: 'Classified Airspace Anomaly' },
  { name: 'Rendlesham Forest, UK', lat: 52.086, lon: 1.457, year: 1980, type: 'Ground Trace + Lights' },
  { name: 'Phoenix, AZ, USA', lat: 33.448, lon: -112.074, year: 1997, type: 'Mass Sighting Event' },
  { name: 'Stephenville, TX, USA', lat: 32.220, lon: -98.202, year: 2008, type: 'Radar-Confirmed UAP' },
  { name: 'Nimitz, Pacific Ocean', lat: 32.500, lon: -117.800, year: 2004, type: 'US Navy UAP Encounter' },
  { name: 'Belgium', lat: 50.503, lon: 4.469, year: 1990, type: 'Mass Triangle Sighting' },
  { name: 'Hessdalen, Norway', lat: 62.820, lon: 11.180, year: 1981, type: 'Persistent Light Phenomena' },
];

// Parse TLE lines from text
function parseTLE(text: string): TLEData[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const result: TLEData[] = [];
  for (let i = 0; i < lines.length - 2; i++) {
    if (lines[i+1].startsWith('1 ') && lines[i+2].startsWith('2 ')) {
      result.push({ name: lines[i], line1: lines[i+1], line2: lines[i+2] });
      i += 2;
    }
  }
  return result;
}

// Compute radiant position on Earth's surface (RA/Dec → Lat/Lon via GMST)
function radiantToLatLon(ra: number, dec: number): { lat: number; lon: number } {
  const now = new Date();
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const D = (now.getTime() - J2000.getTime()) / 86400000;
  const GMST_deg = (280.46061837 + 360.98564736629 * D) % 360;
  let lon = ra - GMST_deg;
  while (lon > 180)  lon -= 360;
  while (lon < -180) lon += 360;
  return { lat: dec, lon };
}

export default function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef    = useRef<unknown>(null);
  const entitiesRef  = useRef<unknown[]>([]);
  const handlerRef   = useRef<unknown>(null);
  const orbitPathRef = useRef<unknown>(null);
  const refreshRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeTab,    setActiveTab]    = useState<'satellites' | 'debris' | 'meteors' | 'ufos'>('satellites');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [tleData,      setTleData]      = useState<{ satellites: TLEData[]; debris: TLEData[] }>({ satellites: [], debris: [] });
  const [selected,     setSelected]     = useState<SelectedInfo | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [cesiumLoaded, setCesiumLoaded] = useState(false);

  // ── Load Cesium dynamically ──
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)['Cesium']) {
      setCesiumLoaded(true);
      return;
    }
    // Cesium is bundled via vite-plugin-cesium, just mark loaded
    const timer = setTimeout(() => setCesiumLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // ── Fetch TLE data ──
  const fetchTLE = useCallback(async (isMounted: { value: boolean }) => {
    const SOURCES = {
      satellites: [
        'https://celestrak.org/SOCRATES/query.php?CODE=&NAME=&MAXPERIGEE=&MINPERIGEE=&MINDURATION=&MAXDURATION=&MINSEP=&MAXSEP=&SORT=MAXSEP&SortDir=DESC&OutType=TLE&action=SEARCH',
        'https://celestrak.org/SOCRATES/query.php',  // fallback will hit visual
        'https://celestrak.org/TLE/visual.txt',
        'https://celestrak.com/TLE/visual.txt',
      ],
      debris: [
        'https://celestrak.org/TLE/iridium-33-debris.txt',
        'https://celestrak.com/TLE/iridium-33-debris.txt',
      ],
    };

    const fetchWithTimeout = async (url: string, ms = 15000): Promise<string> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    };

    const tryFetch = async (urls: string[]): Promise<TLEData[]> => {
      for (const url of urls) {
        try {
          const text = await fetchWithTimeout(url);
          const parsed = parseTLE(text);
          if (parsed.length > 0) return parsed;
        } catch { /* try next */ }
      }
      return [];
    };

    try {
      const [satellites, debris] = await Promise.all([
        tryFetch(SOURCES.satellites),
        tryFetch(SOURCES.debris),
      ]);
      if (!isMounted.value) return;
      setTleData({ satellites, debris });
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      if (!isMounted.value) return;
      setError('Unable to fetch orbital data. Check your connection.');
      console.warn('[Stargaze Globe] TLE fetch failed:', e);
    }
  }, []);

  // ── Initialise Cesium Viewer ──
  useEffect(() => {
    if (!cesiumLoaded || !containerRef.current) return;
    const isMounted = { value: true };

    const init = async () => {
      try {
        // Dynamically import Cesium to avoid SSR issues
        const Cesium = await import('cesium');
        if (!isMounted.value || !containerRef.current) return;

        // Disable default access token requirement
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc4YzciLCJpZCI6NTc5Mywic2NvcGVzIjpbImFzciIsImdjIl0sImlhdCI6MTU0NjQ2ODI4Mn0.u_pONeLiMEd-7HJfgNFCzCiHt5CL1CgR04F5yWJvfWY';

        let imageryProvider: unknown;
        try {
          imageryProvider = new Cesium.ArcGisMapServerImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
          });
        } catch {
          imageryProvider = new Cesium.OpenStreetMapImageryProvider({ url: 'https://a.tile.openstreetmap.org/' });
        }

        const viewer = new Cesium.Viewer(containerRef.current as Element, {
          imageryProvider: imageryProvider as ConstructorParameters<typeof Cesium.Viewer>[1] extends { imageryProvider?: infer T } ? T : never,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          skyBox: new Cesium.SkyBox({
            sources: {
              positiveX: 'https://cesium.com/public/SandcastleSampleData/skybox_px.jpg',
              negativeX: 'https://cesium.com/public/SandcastleSampleData/skybox_mx.jpg',
              positiveY: 'https://cesium.com/public/SandcastleSampleData/skybox_py.jpg',
              negativeY: 'https://cesium.com/public/SandcastleSampleData/skybox_my.jpg',
              positiveZ: 'https://cesium.com/public/SandcastleSampleData/skybox_pz.jpg',
              negativeZ: 'https://cesium.com/public/SandcastleSampleData/skybox_mz.jpg',
            },
          }),
        });

        viewer.scene.globe.enableLighting = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#030014');

        viewerRef.current = viewer;

        // Click handler
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
          const picked = viewer.scene.pick(click.position);
          if (Cesium.defined(picked) && picked.id) {
            const entity = picked.id as Cesium.Entity;
            const props = (entity as unknown as { properties?: Record<string, { getValue: () => unknown }> }).properties;
            if (props) {
              const type = props.type?.getValue() as string;
              const name = (entity.name || 'Unknown') as string;
              const info: Record<string, string | number> = {};
              Object.keys(props).forEach(k => { try { info[k] = props[k].getValue() as string | number; } catch {} });

              if (type === 'meteor') {
                setSelected({ type: 'meteor', name, data: info });
                viewer.trackedEntity = undefined;
              } else if (type === 'ufo') {
                setSelected({ type: 'ufo', name, data: info });
                viewer.trackedEntity = undefined;
              } else if (type === 'satellite' || type === 'debris') {
                setSelected({ type, name, data: info });
                viewer.trackedEntity = entity;
                // Draw 24h orbit path
                drawOrbitPath(Cesium, viewer, info.line1 as string, info.line2 as string, type);
              }
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handlerRef.current = handler;

        setLoading(false);
        await fetchTLE(isMounted);

      } catch (err) {
        console.error('[Stargaze Globe] Init error:', err);
        if (isMounted.value) {
          setError('Failed to initialise 3D globe. Try refreshing the page.');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted.value = false;
      if (handlerRef.current) { (handlerRef.current as { destroy: () => void }).destroy(); }
      if (viewerRef.current)  { (viewerRef.current as { destroy: () => void }).destroy(); viewerRef.current = null; }
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [cesiumLoaded, fetchTLE]);

  // ── Auto-refresh every 30 mins ──
  useEffect(() => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    const isMounted = { value: true };
    refreshRef.current = setInterval(() => fetchTLE(isMounted), 1800000);
    return () => { isMounted.value = false; if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [fetchTLE]);

  // ── Draw orbital path for selected satellite ──
  const drawOrbitPath = async (Cesium: typeof import('cesium'), viewer: Cesium.Viewer, line1: string, line2: string, type: string) => {
    if (!line1 || !line2) return;
    if (orbitPathRef.current) {
      viewer.entities.remove(orbitPathRef.current as Cesium.Entity);
    }
    try {
      const satellite = await import('satellite.js');
      const satrec = satellite.twoline2satrec(line1, line2);
      const positions: Cesium.Cartesian3[] = [];
      const now = new Date();
      for (let m = 0; m <= 1440; m += 5) {
        const time = new Date(now.getTime() + m * 60000);
        const result = satellite.propagate(satrec, time);
        if (!result.position || typeof result.position === 'boolean') continue;
        const pos = result.position as { x: number; y: number; z: number };
        const gmst = satellite.gstime(time);
        const gd = satellite.eciToGeodetic(pos, gmst);
        const lat = Cesium.Math.toDegrees(gd.latitude);
        const lon = Cesium.Math.toDegrees(gd.longitude);
        const alt = gd.height * 1000;
        if (isNaN(lat) || isNaN(lon) || isNaN(alt)) continue;
        positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, alt));
      }
      if (positions.length < 2) return;
      const orbitColor = type === 'debris' ? Cesium.Color.RED.withAlpha(0.7) : Cesium.Color.CYAN.withAlpha(0.7);
      const path = viewer.entities.add({
        polyline: {
          positions,
          width: 1.5,
          material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.15, color: orbitColor }),
        },
      });
      orbitPathRef.current = path;
    } catch (e) {
      console.warn('[Stargaze Globe] Orbit path error:', e);
    }
  };

  // ── Render entities when tab or data changes ──
  useEffect(() => {
    if (!viewerRef.current) return;
    const render = async () => {
      const Cesium = await import('cesium');
      const viewer = viewerRef.current as Cesium.Viewer;
      if (!viewer || viewer.isDestroyed()) return;

      // Clear old entities
      viewer.entities.suspendEvents();
      entitiesRef.current.forEach(e => viewer.entities.remove(e as Cesium.Entity));
      entitiesRef.current = [];
      if (orbitPathRef.current) { viewer.entities.remove(orbitPathRef.current as Cesium.Entity); orbitPathRef.current = null; }
      viewer.trackedEntity = undefined;
      setSelected(null);

      if (activeTab === 'satellites' || activeTab === 'debris') {
        const list = activeTab === 'satellites' ? tleData.satellites : tleData.debris;
        const color = activeTab === 'satellites' ? Cesium.Color.CYAN : Cesium.Color.RED;

        const satellite = await import('satellite.js');
        const now = new Date();
        let added = 0;
        for (const tle of list) {
          if (added >= 300) break; // cap for performance
          try {
            const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
            const result = satellite.propagate(satrec, now);
            if (!result.position || typeof result.position === 'boolean') continue;
            const pos = result.position as { x: number; y: number; z: number };
            const gmst = satellite.gstime(now);
            const gd = satellite.eciToGeodetic(pos, gmst);
            const lat = Cesium.Math.toDegrees(gd.latitude);
            const lon = Cesium.Math.toDegrees(gd.longitude);
            const alt = gd.height * 1000;
            if (isNaN(lat) || isNaN(lon) || isNaN(alt) || alt < 0) continue;

            // Parse inclination/eccentricity from TLE
            let inc = 0, ecc = 0;
            try {
              const parts1 = tle.line1.split(/\s+/);
              const parts2 = tle.line2.split(/\s+/);
              inc = parseFloat(parts2[2] || '0');
              ecc = parseFloat('0.' + (parts2[4] || '0000000'));
              void parts1; // suppress warning
            } catch {}

            const entity = viewer.entities.add({
              name: tle.name,
              position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
              point: { pixelSize: activeTab === 'satellites' ? 3 : 2, color, outlineColor: Cesium.Color.WHITE, outlineWidth: 0.5 },
              properties: { type: activeTab, line1: tle.line1, line2: tle.line2, altitude: Math.round(alt / 1000) + ' km', inclination: inc.toFixed(2) + '°', eccentricity: ecc.toFixed(5) },
            });
            entitiesRef.current.push(entity);
            added++;
          } catch {}
        }

      } else if (activeTab === 'meteors') {
        const now = new Date();
        for (const shower of showers) {
          const { lat, lon } = radiantToLatLon(shower.ra, shower.dec);
          const start = new Date(shower.startDate);
          const end = new Date(shower.endDate);
          const isActive = now >= start && now <= end;
          const isUpcoming = now < start && (start.getTime() - now.getTime()) < 30 * 86400000;
          if (!isActive && !isUpcoming && now > end) continue; // skip past

          const size = Math.max(8, Math.min(shower.zhr / 8, 24));
          const color = isActive ? Cesium.Color.YELLOW : Cesium.Color.fromCssColorString('#93c5fd');
          const label = isActive ? `LIVE: ${shower.name}` : `UPCOMING: ${shower.name}`;

          const entity = viewer.entities.add({
            name: shower.name,
            position: Cesium.Cartesian3.fromDegrees(lon, lat, 100000),
            point: { pixelSize: size, color: color.withAlpha(0.9), outlineColor: isActive ? Cesium.Color.WHITE : Cesium.Color.TRANSPARENT, outlineWidth: 2 },
            label: { text: label, font: '11px Space Grotesk, sans-serif', fillColor: isActive ? Cesium.Color.YELLOW : Cesium.Color.fromCssColorString('#93c5fd'), style: Cesium.LabelStyle.FILL, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -size - 4) },
            properties: {
              type: 'meteor', status: isActive ? 'ACTIVE' : 'UPCOMING',
              peakDate: shower.peakDate, zhr: shower.zhr, constellation: shower.constellation,
              parentBody: shower.parentBody, composition: shower.composition,
              orbitalPeriod: shower.orbitalPeriod + ' yrs',
              historicalStorms: shower.historicalStorms.length,
              description: shower.description.slice(0, 120) + '…',
            },
          });
          entitiesRef.current.push(entity);

          // Meteor streaks
          const streakCount = Math.max(2, Math.min(Math.floor(shower.zhr / 15), isActive ? 15 : 5));
          for (let i = 0; i < streakCount; i++) {
            const streak = viewer.entities.add({
              polyline: {
                positions: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
                  const t = time.secondsOfDay + i * 47.3;
                  const progress = (t % (isActive ? 20 : 40)) / (isActive ? 20 : 40);
                  if (progress < 0.5) return [];
                  const spreadFactor = isActive ? 8 : 5;
                  const sLat = lat + (Math.sin(i * 1.7 + t * 0.1) * spreadFactor);
                  const sLon = lon + (Math.cos(i * 2.3 + t * 0.08) * spreadFactor);
                  const eLat = sLat + Math.sin(i + t * 0.05) * 2;
                  const eLon = sLon + Math.cos(i + t * 0.05) * 2;
                  const alt1 = 120000; const alt2 = 80000;
                  const p = (progress - 0.5) * 2;
                  const sP = Cesium.Cartesian3.fromDegrees(sLon, sLat, alt1);
                  const eP = Cesium.Cartesian3.fromDegrees(eLon, eLat, alt2);
                  const mid = Cesium.Cartesian3.lerp(sP, eP, p, new Cesium.Cartesian3());
                  return [sP, mid];
                }, false) as unknown as Cesium.Property,
                width: isActive ? 2 : 1,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: isActive ? 0.3 : 0.15,
                  color: isActive ? Cesium.Color.YELLOW.withAlpha(0.8) : Cesium.Color.fromCssColorString('#93c5fd').withAlpha(0.5),
                }),
              },
            });
            entitiesRef.current.push(streak);
          }
        }

      } else if (activeTab === 'ufos') {
        for (const loc of UFO_LOCATIONS) {
          const entity = viewer.entities.add({
            name: loc.name,
            position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 5000),
            point: { pixelSize: 10, color: Cesium.Color.LIME.withAlpha(0.9), outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
            label: {
              text: '◉ ' + loc.name,
              font: '10px JetBrains Mono, monospace',
              fillColor: Cesium.Color.LIME,
              style: Cesium.LabelStyle.FILL,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -14),
            },
            ellipse: {
              semiMajorAxis: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
                const t = time.secondsOfDay;
                return 50000 + Math.abs(Math.sin(t * 0.5)) * 30000;
              }, false) as unknown as Cesium.Property,
              semiMinorAxis: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
                const t = time.secondsOfDay;
                return 50000 + Math.abs(Math.sin(t * 0.5)) * 30000;
              }, false) as unknown as Cesium.Property,
              material: Cesium.Color.LIME.withAlpha(0.05),
              outline: true,
              outlineColor: Cesium.Color.LIME.withAlpha(0.3),
              outlineWidth: 1,
              height: 1000,
            },
            properties: { type: 'ufo', year: loc.year, eventType: loc.type, lat: loc.lat.toFixed(3), lon: loc.lon.toFixed(3), source: 'NUFORC Historical Archive' },
          });
          entitiesRef.current.push(entity);
        }
      }

      viewer.entities.resumeEvents();
    };

    render();
  }, [activeTab, tleData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const isMounted = { value: true };
    await fetchTLE(isMounted);
    setRefreshing(false);
  };

  const tabs = [
    { key: 'satellites', label: 'Satellites', icon: Satellite, color: 'text-cyan-400', source: 'CelesTrak (Live)' },
    { key: 'debris',     label: 'Debris',     icon: Trash2,    color: 'text-red-400',  source: 'CelesTrak (Live)' },
    { key: 'meteors',    label: 'Meteors',    icon: Sparkles,  color: 'text-yellow-400', source: 'IMO/NASA (Archive)' },
    { key: 'ufos',       label: 'UAP/UFOs',   icon: Radio,     color: 'text-lime-400', source: 'NUFORC (Historical)' },
  ] as const;

  return (
    <div className="relative w-full h-full bg-space-950">
      {/* Cesium container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-space-950 z-20">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="mb-4">
              <Sparkles size={40} className="text-blue-400" />
            </motion.div>
            <p className="font-space font-semibold text-white text-lg">Initialising 3D Globe</p>
            <p className="text-white/40 text-sm mt-1 font-mono-custom">Loading Cesium + orbital data…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error overlay */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
          <div className="glass rounded-xl px-5 py-4 flex items-center gap-3 border border-red-500/20 max-w-sm">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-white/70 text-sm flex-1">{error}</p>
            <button onClick={handleRefresh} className="text-blue-400 hover:text-blue-300 text-xs whitespace-nowrap">Retry</button>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      {!loading && (
        <div className="absolute top-20 left-4 z-20 space-y-2">
          {/* Header */}
          <div className="glass rounded-xl px-4 py-2 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/60 font-mono-custom text-xs">LIVE</span>
            {lastUpdated && <span className="text-white/30 font-mono-custom text-xs hidden sm:block">{lastUpdated.toLocaleTimeString()}</span>}
            <button onClick={handleRefresh} disabled={refreshing} className="ml-1 text-white/40 hover:text-white/70 transition-colors">
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Tabs */}
          <div className="glass rounded-xl p-1 flex flex-col gap-1">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
                title={`Source: ${tab.source}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-space font-medium transition-all ${activeTab === tab.key ? `bg-white/10 ${tab.color}` : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>
                <tab.icon size={13} />
                <span className="hidden sm:block">{tab.label}</span>
                {(tab.key === 'satellites' || tab.key === 'debris') && (
                  <span className="ml-auto hidden sm:block">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Entity count */}
          <div className="glass rounded-xl px-3 py-1.5">
            <span className="text-white/30 font-mono-custom text-xs">{entitiesRef.current.length} objects</span>
          </div>
        </div>
      )}

      {/* Selected Info Panel */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
            className="absolute top-20 right-4 z-20 w-72">
            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-mono-custom uppercase ${selected.type === 'satellite' ? 'text-cyan-400' : selected.type === 'debris' ? 'text-red-400' : selected.type === 'meteor' ? 'text-yellow-400' : 'text-lime-400'}`}>
                      {selected.type === 'ufo' ? 'UAP Signal' : selected.type}
                    </span>
                    {(selected.type === 'satellite' || selected.type === 'debris') && <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  </div>
                  <p className="text-white font-space font-semibold text-sm leading-tight">{selected.name}</p>
                </div>
                <button onClick={() => { setSelected(null); if (viewerRef.current) { (viewerRef.current as { trackedEntity: unknown }).trackedEntity = undefined; } }} className="text-white/30 hover:text-white/70">
                  <X size={14} />
                </button>
              </div>

              {selected.data && (
                <div className="space-y-1.5">
                  {Object.entries(selected.data)
                    .filter(([k]) => !['type', 'line1', 'line2', 'description'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <span className="text-white/30 text-xs capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-white/80 text-xs font-mono-custom text-right max-w-36 truncate">{String(v)}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* TLE data for satellites */}
              {(selected.type === 'satellite' || selected.type === 'debris') && selected.data?.line1 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-white/20 text-[9px] font-mono-custom mb-1">TLE DATA</p>
                  <pre className="text-white/30 text-[9px] font-mono-custom overflow-hidden leading-relaxed">
                    {String(selected.data.line1).slice(0, 50)}…
                  </pre>
                </div>
              )}

              {selected.type === 'meteor' && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-white/40 text-xs leading-relaxed">{String(selected.data?.description || '')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {!loading && !selected && (
        <div className="absolute bottom-8 right-4 z-20">
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
            <Info size={12} className="text-white/30" />
            <span className="text-white/30 text-xs font-mono-custom">Click any object for details</span>
          </div>
        </div>
      )}
    </div>
  );
}
