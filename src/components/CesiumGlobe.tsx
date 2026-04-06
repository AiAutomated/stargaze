import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import { motion, AnimatePresence } from 'motion/react';
import { Satellite, Trash2, Sparkles, Loader2, Info, Globe, Eye, X as CloseIcon, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import meteorShowersData from '../data/meteorShowers.json';

interface SatelliteData {
  name: string;
  line1: string;
  line2: string;
  inclination?: number;
  eccentricity?: number;
  entity?: Cesium.Entity;
}

const CesiumGlobe: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  const [activeTab, setActiveTab] = useState<'satellites' | 'debris' | 'meteors' | 'ufo'>('satellites');
  const [loading, setLoading] = useState(true);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [debris, setDebris] = useState<SatelliteData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteData | null>(null);
  const [selectedMeteorShower, setSelectedMeteorShower] = useState<any | null>(null);
  const [selectedUFO, setSelectedUFO] = useState<any | null>(null);
  const entitiesRef = useRef<Cesium.Entity[]>([]);
  const trailEntityRef = useRef<Cesium.Entity | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Fetch Active Satellites with a timeout and fallback
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased to 20s

      let satRes;
      try {
        satRes = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle', {
          signal: controller.signal
        });
      } catch (e) {
        // If 'active' fails (often due to size), try 'visual' which is smaller and more reliable
        console.warn('Active satellites fetch failed, trying visual group...');
        satRes = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle', {
          signal: controller.signal
        });
      }
      
      if (!satRes.ok) throw new Error(`Satellites fetch failed: ${satRes.status} ${satRes.statusText}`);
      const satText = await satRes.text();
      const parsedSats = parseTLE(satText);
      
      if (parsedSats.length === 0) throw new Error('No satellite data parsed');
      setSatellites(parsedSats);

      // Fetch Debris with fallback
      let debrisRes;
      try {
        debrisRes = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=debris&FORMAT=tle', {
          signal: controller.signal
        });
      } catch (e) {
        console.warn('Debris fetch failed, trying smaller group...');
        debrisRes = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle', {
          signal: controller.signal
        });
      }
      
      if (!debrisRes.ok) throw new Error(`Debris fetch failed: ${debrisRes.status} ${debrisRes.statusText}`);
      const debrisText = await debrisRes.text();
      const parsedDebris = parseTLE(debrisText);
      
      setDebris(parsedDebris);
      setLastUpdated(new Date());
      clearTimeout(timeoutId);
    } catch (error: any) {
      console.error('Error fetching TLE data:', error);
      setFetchError(error.message || 'Failed to fetch orbital data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const initCesium = async () => {
      try {
        // Disable Ion to prevent unnecessary network requests and potential crashes
        Cesium.Ion.defaultAccessToken = '';

        // Initialize Cesium Viewer
        const viewer = new Cesium.Viewer(containerRef.current!, {
          terrainProvider: undefined,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          infoBox: false, // Reduced overhead
          navigationHelpButton: false,
          sceneModePicker: false,
          timeline: false,
          animation: false,
          selectionIndicator: false, // Custom logic used instead
          fullscreenButton: false,
        });

        // Use a more reliable imagery provider
        try {
          const imageryProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
          );
          viewer.imageryLayers.removeAll(); // Clear defaults
          viewer.imageryLayers.addImageryProvider(imageryProvider);
        } catch (e) {
          console.warn('Failed to load ArcGIS imagery, falling back to OSM');
          const osmProvider = new Cesium.OpenStreetMapImageryProvider({
            url: 'https://a.tile.openstreetmap.org/'
          });
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(osmProvider);
        }

        // Remove credits for a cleaner look
        (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

        if (!isMounted.current) {
          viewer.destroy();
          return;
        }
        viewerRef.current = viewer;

        // Setup click handler for selection
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handlerRef.current = handler;
        handler.setInputAction((movement: any) => {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
          const entity = pickedObject.id;
          const props = entity.properties?.getValue(Cesium.JulianDate.now());
          
          if (props && props.type === 'meteor') {
            setSelectedMeteorShower(props.data);
            setSelectedSatellite(null);
            setSelectedUFO(null);
            viewer.trackedEntity = undefined;
            viewer.zoomTo(entity);
          } else if (props && props.type === 'ufo') {
            setSelectedUFO(props.data);
            setSelectedSatellite(null);
            setSelectedMeteorShower(null);
            viewer.trackedEntity = undefined;
            viewer.zoomTo(entity);
          } else if (props && props.line1 && props.line2) {
            setSelectedSatellite({
              name: props.name,
              line1: props.line1,
              line2: props.line2,
              inclination: props.inclination,
              eccentricity: props.eccentricity
            });
            setSelectedMeteorShower(null);
            setSelectedUFO(null);
            viewer.trackedEntity = entity;
          }
        } else {
          setSelectedSatellite(null);
          setSelectedMeteorShower(null);
          setSelectedUFO(null);
          viewer.trackedEntity = undefined;
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // Fetch data initially
      fetchData();
    } catch (err) {
      console.error('Cesium initialization failed:', err);
    }
  };

    initCesium();

    // Periodic refresh every 30 minutes
    const refreshInterval = setInterval(fetchData, 30 * 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
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
        const line2 = lines[i+2];
        const inclination = parseFloat(line2.substring(8, 16));
        const eccentricity = parseFloat('0.' + line2.substring(26, 33));
        
        results.push({
          name: lines[i],
          line1: lines[i+1],
          line2: line2,
          inclination,
          eccentricity
        });
      }
    }
    return results;
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    // Clear existing entities safely
    try {
      entitiesRef.current.forEach(entity => {
        if (Cesium.defined(entity) && viewer.entities.contains(entity)) {
          viewer.entities.remove(entity);
        }
      });
    } catch (e) {
      console.warn('Error clearing entities:', e);
    }
    entitiesRef.current = [];

    // Clear selections when switching tabs to prevent stale state
    setSelectedSatellite(null);
    setSelectedMeteorShower(null);
    setSelectedUFO(null);
    viewer.trackedEntity = undefined;

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
    try {
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
          
          if (!isNaN(longitude) && !isNaN(latitude)) {
            points.push(Cesium.Cartesian3.fromDegrees(longitude, latitude, height));
          }
        }
      }
    } catch (e) {
      console.error('Error calculating orbit path:', e);
    }
    return points;
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    const updatePath = () => {
      // Clear existing trail
      if (trailEntityRef.current) {
        viewer.entities.remove(trailEntityRef.current);
        trailEntityRef.current = null;
      }

      if (selectedSatellite) {
        const path = calculateOrbitPath(selectedSatellite, 24);
        const isDebris = debris.some(d => d.name === selectedSatellite.name);
        const trailColor = isDebris ? Cesium.Color.RED : Cesium.Color.CYAN;

        trailEntityRef.current = viewer.entities.add({
          name: `${selectedSatellite.name} 24h Orbit Path`,
          polyline: {
            positions: path,
            width: 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.2,
              color: trailColor.withAlpha(0.6),
            }),
          },
        });
      }
    };

    updatePath();

    // Reset tracking and zoom only on initial selection
    if (selectedSatellite) {
      const entity = entitiesRef.current.find(e => e.name === selectedSatellite.name);
      if (entity) {
        viewer.trackedEntity = entity;
        viewer.zoomTo(entity, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 1000000));
      }
    } else {
      viewer.trackedEntity = undefined;
    }

    // Refresh path every 60 seconds to keep it "dynamic" as time progresses
    const pathInterval = setInterval(updatePath, 60000);

    return () => {
      clearInterval(pathInterval);
      if (trailEntityRef.current && viewerRef.current) {
        viewerRef.current.entities.remove(trailEntityRef.current);
        trailEntityRef.current = null;
      }
    };
  }, [selectedSatellite, debris]);

  const renderSatellites = (data: SatelliteData[], color: Cesium.Color) => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const now = new Date();

    viewer.entities.suspendEvents();
    try {
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

          if (isNaN(longitude) || isNaN(latitude) || isNaN(height)) return;

          const entity = viewer.entities.add({
            name: sat.name,
            position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
            point: {
              pixelSize: 6,
              color: color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
            },
            properties: new Cesium.PropertyBag({
              ...sat,
              type: 'satellite'
            }),
            description: `
              <div style="font-family: sans-serif; padding: 10px;">
                <h3 style="color: #38bdf8;">${sat.name}</h3>
                <p><b>Inclination:</b> ${sat.inclination}°</p>
                <p><b>Eccentricity:</b> ${sat.eccentricity}</p>
                <p><b>Source:</b> CelesTrak Live</p>
              </div>
            `
          });
          entitiesRef.current.push(entity);
        } catch (e) {
          // Skip invalid TLEs
        }
      });
    } finally {
      viewer.entities.resumeEvents();
    }
  };

  const renderMeteors = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const now = new Date();
    const startTime = Cesium.JulianDate.fromDate(now);
    const gmst = satellite.gstime(now);
    const gmstDeg = (gmst * 180) / Math.PI;

    viewer.entities.suspendEvents();
    try {
      const constellationCoords: Record<string, { ra: number, dec: number }> = {
        'Bootes': { ra: 230, dec: 49 },
        'Lyra': { ra: 271, dec: 34 },
        'Aquarius': { ra: 330, dec: -10 },
        'Perseus': { ra: 48, dec: 58 },
        'Orion': { ra: 88, dec: 15 },
        'Leo': { ra: 153, dec: 22 },
        'Gemini': { ra: 112, dec: 33 },
        'Ursa Minor': { ra: 230, dec: 75 }
      };

      meteorShowersData.forEach(shower => {
        const coords = constellationCoords[shower.constellation] || { ra: 0, dec: 0 };
        const showerStart = new Date(shower.start);
        const showerEnd = new Date(shower.end);
        const isActive = now >= showerStart && now <= showerEnd;
        const isUpcoming = now < showerStart && (showerStart.getTime() - now.getTime()) < 30 * 24 * 60 * 60 * 1000;
        const isPast = now > showerEnd;

        if (isPast) return; // Don't render past showers

        const getIntensityColor = (zhr: number, active: boolean, upcoming: boolean) => {
          if (!active && upcoming) return Cesium.Color.GRAY.withAlpha(0.6);
          if (zhr > 100) return Cesium.Color.WHITE;
          if (zhr > 70) return Cesium.Color.YELLOW;
          if (zhr > 40) return Cesium.Color.ORANGE;
          if (zhr > 20) return Cesium.Color.AQUA;
          return Cesium.Color.SKYBLUE;
        };

        const color = getIntensityColor(shower.zhr, isActive, isUpcoming);
        
        // Size based on intensity and status
        const baseSize = isActive ? 10 : 6;
        const intensitySize = Math.min(shower.zhr / 10, 10);
        const pixelSize = baseSize + intensitySize;

        let lon = coords.ra - gmstDeg;
        while (lon < -180) lon += 360;
        while (lon > 180) lon -= 360;
        const lat = coords.dec;

        const radiantPos = Cesium.Cartesian3.fromDegrees(lon, lat, 2000000);
        if (!Cesium.defined(radiantPos)) return;

        const radiant = viewer.entities.add({
          name: `${shower.name} Radiant`,
          position: radiantPos,
          point: {
            pixelSize: pixelSize,
            color: color,
            outlineColor: isActive ? Cesium.Color.WHITE : Cesium.Color.GRAY,
            outlineWidth: isActive ? 3 : 1,
          },
          properties: new Cesium.PropertyBag({
            type: 'meteor',
            data: { ...shower, status: isActive ? 'ACTIVE' : (isUpcoming ? 'UPCOMING' : 'INACTIVE') }
          }),
          label: {
            text: isActive ? `LIVE: ${shower.name}` : (isUpcoming ? `UPCOMING: ${shower.name}` : shower.name),
            font: isActive ? 'bold 16px Space Grotesk, sans-serif' : '12px Space Grotesk, sans-serif',
            fillColor: isActive ? Cesium.Color.YELLOW : (isUpcoming ? Cesium.Color.LIGHTGRAY : Cesium.Color.WHITE),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -pixelSize - 5),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 50000000),
          },
          description: `
            <div style="font-family: sans-serif; padding: 10px;">
              <h3 style="color: #f97316;">${shower.name} Meteor Shower</h3>
              <p><b>Status:</b> ${isActive ? '<span style="color: #22c55e;">ACTIVE NOW</span>' : (isUpcoming ? '<span style="color: #38bdf8;">UPCOMING</span>' : 'Inactive')}</p>
              <p><b>Starts:</b> ${new Date(shower.start).toLocaleDateString()}</p>
              <p><b>Peak Date:</b> ${new Date(shower.peak).toLocaleDateString()}</p>
              <p><b>Intensity:</b> ${shower.zhr} ZHR</p>
              <p><b>Parent Body:</b> ${shower.parent}</p>
              <p><b>Source:</b> International Meteor Organization (IMO)</p>
            </div>
          `
        });
        entitiesRef.current.push(radiant);

        const isNearPeak = Math.abs(now.getTime() - new Date(shower.peak).getTime()) < 3 * 24 * 60 * 60 * 1000;
        
        if (isActive || isNearPeak) {
          const isMajor = shower.zhr > 50;
          const intensityMultiplier = isActive ? (isMajor ? 2.5 : 1.5) : 0.5;
          const meteorCount = Math.floor(Math.max(2, (shower.zhr / 8)) * intensityMultiplier);

          for (let i = 0; i < meteorCount; i++) {
            const duration = (0.15 + Math.random() * 0.45) * (1 - Math.min(shower.zhr / 400, 0.7)); 
            const delay = Math.random() * 30; 
            const startPos = Cesium.Cartesian3.fromDegrees(lon, lat, 2000000);
            
            const angle = Math.random() * Math.PI * 2;
            const distBase = isActive ? (isMajor ? 40 : 25) : 15;
            const dist = (distBase + Math.random() * 30) * (1 + Math.min(shower.zhr / 100, 2.0));
            const endLon = lon + Math.cos(angle) * dist;
            const endLat = lat + Math.sin(angle) * dist;
            const endPos = Cesium.Cartesian3.fromDegrees(endLon, endLat, 100000);

            if (!Cesium.defined(startPos) || !Cesium.defined(endPos)) continue;

            const streakColor = Cesium.Color.lerp(color, Cesium.Color.WHITE, 0.4, new Cesium.Color());
            const glowPower = isActive ? 0.6 + (shower.zhr / 100) : 0.4;
            const streakWidth = isActive ? 6 + (shower.zhr / 30) : 4;

            const meteor = viewer.entities.add({
              polyline: {
                positions: new Cesium.CallbackProperty((time) => {
                  try {
                    if (!Cesium.defined(startPos) || !Cesium.defined(endPos) || !Cesium.defined(time)) return [];
                    const diff = Cesium.JulianDate.secondsDifference(time, startTime);
                    const t = ((diff + delay) % 30) / duration;
                    if (t < 0 || t > 1) return [];
                    
                    const currentPos = Cesium.Cartesian3.lerp(startPos, endPos, t, new Cesium.Cartesian3());
                    const trailLength = 0.3 + (shower.zhr / 300);
                    const trailPos = Cesium.Cartesian3.lerp(startPos, endPos, Math.max(0, t - trailLength), new Cesium.Cartesian3());
                    
                    if (!Cesium.defined(currentPos) || !Cesium.defined(trailPos)) return [];
                    return [trailPos, currentPos];
                  } catch (e) {
                    return [];
                  }
                }, false),
                width: streakWidth,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: glowPower,
                  color: streakColor.withAlpha(isActive ? 0.98 : 0.6),
                }),
              }
            });
            entitiesRef.current.push(meteor);
          }
        }
      });
    } finally {
      viewer.entities.resumeEvents();
    }
  };

  const renderUFOs = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    
    viewer.entities.suspendEvents();
    try {
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
          properties: new Cesium.PropertyBag({
            type: 'ufo',
            data: { ...loc, timestamp: new Date(Date.now() - i * 3600000).toLocaleString() }
          }),
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

        const pulseEntity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 50000),
          ellipse: {
            semiMinorAxis: new Cesium.CallbackProperty((time) => {
              try {
                if (!Cesium.defined(time)) return 1;
                const val = 50000 + Math.sin(time.secondsOfDay * 2) * 20000;
                return Math.max(1, val);
              } catch (e) {
                return 1;
              }
            }, false),
            semiMajorAxis: new Cesium.CallbackProperty((time) => {
              try {
                if (!Cesium.defined(time)) return 1;
                const val = 50000 + Math.sin(time.secondsOfDay * 2) * 20000;
                return Math.max(1, val);
              } catch (e) {
                return 1;
              }
            }, false),
            material: Cesium.Color.LIME.withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.LIME.withAlpha(0.3),
          }
        });
        entitiesRef.current.push(pulseEntity);
      });
    } finally {
      viewer.entities.resumeEvents();
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* UI Overlay */}
      <div className="absolute top-28 left-6 z-10 flex flex-col gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass p-4 rounded-2xl border border-white/10 backdrop-blur-md"
        >
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="text-blue-400" /> Stargaze Globe
          </h1>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-white/60">Real-time orbital tracking</p>
            {lastUpdated && (
              <p className="text-[10px] text-white/40 font-mono">
                Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </motion.div>

        <div className="flex flex-wrap gap-2 items-center">
          {[
            { id: 'satellites', icon: Satellite, label: 'Satellites', color: 'text-cyan-400', source: 'CelesTrak (Live)' },
            { id: 'debris', icon: Trash2, label: 'Space Debris', color: 'text-red-400', source: 'CelesTrak (Live)' },
            { id: 'meteors', icon: Sparkles, label: 'Meteors', color: 'text-yellow-400', source: 'IMO/NASA (Archive)' },
            { id: 'ufo', icon: Eye, label: 'UFO Signals', color: 'text-lime-400', source: 'NUFORC (Historical)' },
          ].map((tab) => (
            <div key={tab.id} className="relative group/btn">
              <button
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-5 py-2.5 rounded-full transition-all border ${
                  activeTab === tab.id 
                    ? 'bg-white/20 border-white/30 text-white shadow-lg shadow-white/5' 
                    : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <div className="relative">
                  <tab.icon size={16} className={activeTab === tab.id ? tab.color : ''} />
                  {tab.source.includes('Live') && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse border border-black" />
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] font-mono">{tab.label}</span>
              </button>
              
              {/* Source Tooltip */}
              <div className="absolute top-full left-0 mt-2 opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-black/90 border border-white/10 px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest text-white/40 whitespace-nowrap flex items-center gap-2">
                  <div className="w-1 h-1 bg-white/20 rounded-full" />
                  Source: {tab.source}
                </div>
              </div>
            </div>
          ))}

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className={`p-2.5 rounded-full border border-white/10 bg-black/40 text-white/60 hover:bg-white/10 hover:text-white transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {fetchError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/20 border border-red-500/30 p-3 rounded-xl flex items-start gap-3 backdrop-blur-md"
            >
              <AlertCircle className="text-red-400 shrink-0" size={16} />
              <div className="flex-1">
                <p className="text-[10px] text-red-200 font-bold uppercase tracking-wider">Fetch Error</p>
                <p className="text-[10px] text-red-200/70 mt-0.5">{fetchError}</p>
                <button 
                  onClick={() => fetchData()}
                  className="text-[9px] text-red-400 font-bold uppercase tracking-widest mt-2 hover:text-red-300 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  debris.some(d => d.name === selectedSatellite.name) ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'
                }`}>
                  <Satellite size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{selectedSatellite.name}</h3>
                  <p className={`text-[10px] uppercase tracking-widest font-bold ${
                    debris.some(d => d.name === selectedSatellite.name) ? 'text-red-400' : 'text-cyan-400'
                  }`}>
                    {debris.some(d => d.name === selectedSatellite.name) ? 'Space Debris' : 'Active Satellite'}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Orbit Prediction</p>
                  <p className="text-[10px] text-white/80">Visualizing 24-hour orbital path based on current TLE data.</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Orbit Parameters</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Inclination:</span>
                    <span className="text-[10px] text-white font-medium">{selectedSatellite.inclination?.toFixed(4)}°</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Eccentricity:</span>
                    <span className="text-[10px] text-white font-medium">{selectedSatellite.eccentricity?.toFixed(7)}</span>
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">TLE Data</p>
                  <p className="text-[8px] font-mono text-white/40 break-all">{selectedSatellite.line1}</p>
                  <p className="text-[8px] font-mono text-white/40 break-all mt-1">{selectedSatellite.line2}</p>
                </div>
              </div>
            </motion.div>
          )}

          {selectedMeteorShower && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass p-6 rounded-[2rem] border border-yellow-500/30 text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button 
                  onClick={() => setSelectedMeteorShower(null)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{selectedMeteorShower.name}</h3>
                  <p className="text-[10px] text-yellow-400 uppercase tracking-widest font-bold">
                    {selectedMeteorShower.status || 'Meteor Shower Radiant'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Timing & Intensity</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Peak Date:</span>
                    <span className="text-[10px] text-white font-medium">{new Date(selectedMeteorShower.peak).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Intensity:</span>
                    <span className="text-[10px] text-yellow-400 font-bold">{selectedMeteorShower.zhr} ZHR</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Status:</span>
                    <span className={`text-[10px] font-bold ${selectedMeteorShower.status === 'ACTIVE' ? 'text-green-400' : 'text-blue-400'}`}>
                      {selectedMeteorShower.status}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Parent Body Details</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Object:</span>
                    <span className="text-[10px] text-white font-medium">{selectedMeteorShower.parent}</span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Orbital Period:</span>
                    <span className="text-[10px] text-white font-medium">{selectedMeteorShower.orbitalPeriod}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Composition:</span>
                    <span className="text-[10px] text-white font-medium">{selectedMeteorShower.composition}</span>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Historical Visibility</p>
                  <p className="text-[10px] text-white/80 leading-relaxed">{selectedMeteorShower.historicalVisibility}</p>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Historical Storms</p>
                  <p className="text-[10px] text-white/80 leading-relaxed">{selectedMeteorShower.historicalStorms}</p>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Observation Data</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Peak Rate:</span>
                    <span className="text-[10px] text-yellow-400 font-bold">{selectedMeteorShower.zhr} ZHR</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Constellation:</span>
                    <span className="text-[10px] text-white font-medium">{selectedMeteorShower.constellation}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {selectedUFO && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass p-6 rounded-[2rem] border border-lime-500/30 text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button 
                  onClick={() => setSelectedUFO(null)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-lime-500/20 flex items-center justify-center text-lime-400">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Unidentified Signal</h3>
                  <p className="text-[10px] text-lime-400 uppercase tracking-widest font-bold">UFO Sighting Report</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Location Details</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Site:</span>
                    <span className="text-[10px] text-white font-medium">{selectedUFO.name}</span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Latitude:</span>
                    <span className="text-[10px] text-white font-medium">{selectedUFO.lat.toFixed(4)}°</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Longitude:</span>
                    <span className="text-[10px] text-white font-medium">{selectedUFO.lon.toFixed(4)}°</span>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Sighting Info</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">Timestamp:</span>
                    <span className="text-[10px] text-white font-medium">{selectedUFO.timestamp}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/60">Status:</span>
                    <span className="text-[10px] text-lime-400 font-bold">UNVERIFIED</span>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Analysis</p>
                  <p className="text-[10px] text-white/80 leading-relaxed">Signal characteristics suggest non-ballistic trajectory. Multiple witness reports archived in NUFORC database.</p>
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
