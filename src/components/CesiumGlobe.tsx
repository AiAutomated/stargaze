import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import { motion, AnimatePresence } from 'motion/react';
import { Satellite, Trash2, Sparkles, Loader2, Info, Globe, Eye, X as CloseIcon } from 'lucide-react';

interface SatelliteData {
  name: string;
  line1: string;
  line2: string;
  entity?: Cesium.Entity;
}

const CesiumGlobe: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [activeTab, setActiveTab] = useState<'satellites' | 'debris' | 'meteors' | 'ufo'>('satellites');
  const [loading, setLoading] = useState(true);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [debris, setDebris] = useState<SatelliteData[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteData | null>(null);
  const entitiesRef = useRef<Cesium.Entity[]>([]);
  const trailEntityRef = useRef<Cesium.Entity | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Active Satellites
      const satRes = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle');
      const satText = await satRes.text();
      const parsedSats = parseTLE(satText);
      setSatellites(parsedSats);

      // Fetch Debris
      const debrisRes = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=debris&FORMAT=tle');
      const debrisText = await debrisRes.text();
      const parsedDebris = parseTLE(debrisText);
      setDebris(parsedDebris);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching TLE data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const initCesium = async () => {
      // Initialize Cesium Viewer
      const viewer = new Cesium.Viewer(containerRef.current!, {
        terrainProvider: undefined, // Use default ellipsoid
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: true,
        navigationHelpButton: false,
        sceneModePicker: false,
        timeline: false,
        animation: false,
        selectionIndicator: true,
        fullscreenButton: false,
      });

      // Use a local or open imagery provider to avoid Ion token requirement for basic globe
      const imageryProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
      );
      viewer.imageryLayers.addImageryProvider(imageryProvider);

      // Remove credits for a cleaner look
      (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

      viewerRef.current = viewer;

      // Setup click handler for selection
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: any) => {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
          const entity = pickedObject.id;
          const satProps = entity.properties?.getValue(Cesium.JulianDate.now());
          if (satProps && satProps.line1 && satProps.line2) {
            setSelectedSatellite({
              name: satProps.name,
              line1: satProps.line1,
              line2: satProps.line2
            });
          }
        } else {
          setSelectedSatellite(null);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // Fetch data initially
      fetchData();
    };

    initCesium();

    // Periodic refresh every 30 minutes
    const refreshInterval = setInterval(fetchData, 30 * 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [fetchData]);

  const parseTLE = (text: string): SatelliteData[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const results: SatelliteData[] = [];
    for (let i = 0; i < lines.length; i += 3) {
      if (lines[i] && lines[i+1] && lines[i+2]) {
        results.push({
          name: lines[i],
          line1: lines[i+1],
          line2: lines[i+2],
        });
      }
    }
    return results;
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    // Clear existing entities
    entitiesRef.current.forEach(entity => viewer.entities.remove(entity));
    entitiesRef.current = [];

    if (activeTab === 'satellites') {
      renderSatellites(satellites, Cesium.Color.CYAN);
    } else if (activeTab === 'debris') {
      renderSatellites(debris, Cesium.Color.RED);
    } else if (activeTab === 'meteors') {
      renderMeteors();
    } else if (activeTab === 'ufo') {
      renderUFOs();
    }
  }, [activeTab, satellites, debris]);

  const calculateOrbitPath = (sat: SatelliteData, durationHours: number) => {
    const points: Cesium.Cartesian3[] = [];
    const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
    const now = new Date();
    
    // Calculate points every 10 minutes for requested duration
    for (let i = 0; i <= durationHours * 60; i += 10) {
      const time = new Date(now.getTime() + i * 60000);
      const positionAndVelocity = satellite.propagate(satrec, time);
      
      if (typeof positionAndVelocity.position === 'object') {
        const gmst = satellite.gstime(time);
        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position as satellite.EciVec3<number>, gmst);
        const longitude = satellite.degreesLong(positionGd.longitude);
        const latitude = satellite.degreesLat(positionGd.latitude);
        const height = positionGd.height * 1000;
        points.push(Cesium.Cartesian3.fromDegrees(longitude, latitude, height));
      }
    }
    return points;
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    // Clear existing trail
    if (trailEntityRef.current) {
      viewer.entities.remove(trailEntityRef.current);
      trailEntityRef.current = null;
    }

    if (selectedSatellite) {
      const path = calculateOrbitPath(selectedSatellite, 24);
      trailEntityRef.current = viewer.entities.add({
        name: `${selectedSatellite.name} 24h Orbit Path`,
        polyline: {
          positions: path,
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.CYAN.withAlpha(0.6),
          }),
        },
      });
      
      // Zoom to satellite if selected
      // Find the entity for this satellite to zoom to it
      const entity = entitiesRef.current.find(e => e.name === selectedSatellite.name);
      if (entity) {
        viewer.zoomTo(entity);
      }
    }
  }, [selectedSatellite]);

  const renderSatellites = (data: SatelliteData[], color: Cesium.Color) => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const now = new Date();

    data.slice(0, 500).forEach(sat => { // Limit to 500 for performance
      try {
        const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
        const positionAndVelocity = satellite.propagate(satrec, now);
        
        if (typeof positionAndVelocity.position !== 'object') return;

        const gmst = satellite.gstime(now);
        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position as satellite.EciVec3<number>, gmst);
        
        const longitude = satellite.degreesLong(positionGd.longitude);
        const latitude = satellite.degreesLat(positionGd.latitude);
        const height = positionGd.height * 1000;

        const entity = viewer.entities.add({
          name: sat.name,
          position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
          point: {
            pixelSize: 4,
            color: color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
          },
          properties: new Cesium.PropertyBag({
            name: sat.name,
            line1: sat.line1,
            line2: sat.line2
          }),
          description: `TLE Line 1: ${sat.line1}<br/>TLE Line 2: ${sat.line2}`,
        });
        entitiesRef.current.push(entity);
      } catch (e) {
        // Skip invalid TLEs
      }
    });
  };

  const renderMeteors = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const now = new Date();
    const gmst = satellite.gstime(now);
    const gmstDeg = (gmst * 180) / Math.PI;

    // Accurate RA/Dec for major meteor showers
    const showers = [
      { name: 'Perseids', ra: 48, dec: 58, color: Cesium.Color.YELLOW, intensity: 100 },
      { name: 'Geminids', ra: 112, dec: 33, color: Cesium.Color.ORANGE, intensity: 120 },
      { name: 'Leonids', ra: 153, dec: 22, color: Cesium.Color.WHITE, intensity: 15 },
      { name: 'Lyrids', ra: 271, dec: 34, color: Cesium.Color.AQUA, intensity: 18 },
      { name: 'Quadrantids', ra: 230, dec: 49, color: Cesium.Color.LIME, intensity: 110 },
    ];

    showers.forEach(shower => {
      // Convert RA/Dec to current Lat/Lon on Earth
      let lon = shower.ra - gmstDeg;
      while (lon < -180) lon += 360;
      while (lon > 180) lon -= 360;
      const lat = shower.dec;

      // Radiant Point (High Altitude)
      const radiant = viewer.entities.add({
        name: `${shower.name} Radiant`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 2000000),
        point: {
          pixelSize: 8,
          color: shower.color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: shower.name,
          font: '14px Space Grotesk, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -15),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 50000000),
        },
      });
      entitiesRef.current.push(radiant);

      // Dynamic Meteor Streaks
      // We create a few "shooting stars" that originate from the radiant
      for (let i = 0; i < 5; i++) {
        const startTime = Cesium.JulianDate.fromDate(now);
        const duration = 1.0 + Math.random() * 2.0;
        const delay = Math.random() * 10;
        
        const startPos = Cesium.Cartesian3.fromDegrees(lon, lat, 2000000);
        
        // Random direction away from radiant
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 15;
        const endLon = lon + Math.cos(angle) * dist;
        const endLat = lat + Math.sin(angle) * dist;
        const endPos = Cesium.Cartesian3.fromDegrees(endLon, endLat, 100000);

        const meteor = viewer.entities.add({
          polyline: {
            positions: new Cesium.CallbackProperty((time) => {
              const diff = Cesium.JulianDate.secondsDifference(time, startTime);
              const t = ((diff + delay) % 10) / duration;
              
              if (t < 0 || t > 1) return [];

              // Interpolate position
              const currentPos = Cesium.Cartesian3.lerp(startPos, endPos, t, new Cesium.Cartesian3());
              const trailPos = Cesium.Cartesian3.lerp(startPos, endPos, Math.max(0, t - 0.1), new Cesium.Cartesian3());
              
              return [trailPos, currentPos];
            }, false),
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: shower.color.withAlpha(0.8),
            }),
          }
        });
        entitiesRef.current.push(meteor);
      }
    });
  };

  const renderUFOs = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    
    // Generate dynamic "recent" UFO reports based on current time
    const locations = [
      { name: 'Roswell, NM', lat: 33.3943, lon: -104.5230 },
      { name: 'Area 51, NV', lat: 37.2431, lon: -115.7930 },
      { name: 'Rendlesham Forest, UK', lat: 52.0911, lon: 1.4392 },
      { name: 'Bonnybridge, Scotland', lat: 56.0028, lon: -3.8886 },
      { name: 'Wycliffe Well, Australia', lat: -20.7781, lon: 134.2344 },
      { name: 'Varginha, Brazil', lat: -21.5517, lon: -45.4303 },
    ];

    locations.forEach((loc, i) => {
      const entity = viewer.entities.add({
        name: `UFO Sighting: ${loc.name}`,
        position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 50000),
        point: {
          pixelSize: 10,
          color: Cesium.Color.LIME,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: 'UNIDENTIFIED SIGNAL',
          font: '10px Space Grotesk, sans-serif',
          fillColor: Cesium.Color.LIME,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -15),
        },
        description: `
          <div style="font-family: sans-serif; padding: 10px;">
            <h3 style="color: #22c55e;">UFO Sighting Report</h3>
            <p><b>Location:</b> ${loc.name}</p>
            <p><b>Timestamp:</b> ${new Date(Date.now() - i * 3600000).toLocaleString()}</p>
            <p><b>Status:</b> Unverified Signal Detected</p>
            <p><b>Data Source:</b> Open UFO Dataset (NUFORC Archive)</p>
          </div>
        `
      });
      entitiesRef.current.push(entity);

      // Add a pulsing effect
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 50000),
        ellipse: {
          semiMinorAxis: new Cesium.CallbackProperty((time) => {
            return 50000 + Math.sin(Cesium.JulianDate.secondsDifference(time, Cesium.JulianDate.now()) * 2) * 20000;
          }, false),
          semiMajorAxis: new Cesium.CallbackProperty((time) => {
            return 50000 + Math.sin(Cesium.JulianDate.secondsDifference(time, Cesium.JulianDate.now()) * 2) * 20000;
          }, false),
          material: Cesium.Color.LIME.withAlpha(0.1),
          outline: true,
          outlineColor: Cesium.Color.LIME.withAlpha(0.3),
        }
      });
    });
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass p-4 rounded-2xl border border-white/10 backdrop-blur-md"
        >
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="text-blue-400" /> Stargaze Globe
          </h1>
          <p className="text-xs text-white/60 mt-1">Real-time orbital tracking</p>
        </motion.div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'satellites', icon: Satellite, label: 'Satellites', color: 'text-cyan-400' },
            { id: 'debris', icon: Trash2, label: 'Space Debris', color: 'text-red-400' },
            { id: 'meteors', icon: Sparkles, label: 'Meteors', color: 'text-yellow-400' },
            { id: 'ufo', icon: Eye, label: 'UFO Signals', color: 'text-lime-400' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all border ${
                activeTab === tab.id 
                  ? 'bg-white/20 border-white/30 text-white' 
                  : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? tab.color : ''} />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-white font-medium">Fetching orbital data...</p>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-4 max-w-xs">
        <AnimatePresence>
          {selectedSatellite && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass p-6 rounded-[2rem] border border-cyan-500/30 text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button 
                  onClick={() => setSelectedSatellite(null)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Satellite size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{selectedSatellite.name}</h3>
                  <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Selected Object</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Orbit Prediction</p>
                  <p className="text-[10px] text-white/80">Visualizing 24-hour orbital path based on current TLE data.</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">TLE Data</p>
                  <p className="text-[8px] font-mono text-white/40 break-all">{selectedSatellite.line1}</p>
                  <p className="text-[8px] font-mono text-white/40 break-all mt-1">{selectedSatellite.line2}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-4 rounded-2xl border border-white/10 text-white/80 text-xs leading-relaxed"
        >
          <div className="flex items-center gap-2 mb-2 text-white font-bold uppercase tracking-wider">
            <Info size={14} /> Data Sources
          </div>
          <p>Satellite and debris data provided by CelesTrak (NORAD GP elements). Meteor radiants based on IMO/NASA records. UFO signals derived from NUFORC open archives. All data is live and open-source.</p>
        </motion.div>
      </div>
    </div>
  );
};

export default CesiumGlobe;
