import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Satellite, Trash2, Sparkles, Loader2, Info, Globe, Eye, 
  X as CloseIcon, ExternalLink, RefreshCw, AlertCircle, 
  Navigation, Activity, Search, Settings, Sun, Moon, 
  Maximize, ChevronRight, Map as MapIcon, Database, Layers
} from 'lucide-react';
import meteorShowersData from '../data/meteorShowers.json';
import tleBackup from '../data/tleBackup.json';

interface SatelliteData {
  name: string;
  line1: string;
  line2: string;
  inclination?: number;
  eccentricity?: number;
  entity?: Cesium.Entity;
}

interface TelemetryData {
  lat: number;
  lng: number;
  alt: number;
  vel: number;
  location: string;
  timestamp: string;
}

const CesiumGlobe: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  const [activeTab, setActiveTab] = useState<'satellites' | 'debris' | 'meteors' | 'ufo'>('satellites');
  const [loading, setLoading] = useState(true);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [debris, setDebris] = useState<SatelliteData[]>([]);
  const [issData, setIssData] = useState<SatelliteData | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteData | null>(null);
  const [selectedMeteorShower, setSelectedMeteorShower] = useState<any | null>(null);
  const [selectedUFO, setSelectedUFO] = useState<any | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<'satellite' | 'street' | 'dark'>('satellite');
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [visualSettings, setVisualSettings] = useState({
    atmosphere: true,
    nightLights: true,
    stars: true,
    terrain: true,
    grid: false
  });
  const [showSettings, setShowSettings] = useState(false);

  const flyToLocation = (lat: number, lon: number, height = 2000000) => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    // Satellite Search First
    const satMatches = satellites.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const debrisMatches = debris.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
      const geoData = await res.json();
      
      const combinedResults = [
        ...satMatches.slice(0, 3).map(s => ({ ...s, type: 'satellite' })),
        ...debrisMatches.slice(0, 3).map(s => ({ ...s, type: 'debris' })),
        ...geoData.map((g: any) => ({ ...g, type: 'location' }))
      ];
      
      setSearchResults(combinedResults);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([...satMatches.map(s => ({ ...s, type: 'satellite' }))]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    
    // Atmosphere & Sky
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = visualSettings.atmosphere;
    if (viewer.scene.sun) viewer.scene.sun.show = visualSettings.atmosphere;
    if (viewer.scene.moon) viewer.scene.moon.show = visualSettings.atmosphere;
    
    // Toggle Stars (using any to bypass missing property in some types)
    if (viewer.scene.skyBox) {
      (viewer.scene.skyBox as any).show = visualSettings.stars;
    }

    // Terrain Handling
    const updateTerrain = async () => {
      try {
        if (visualSettings.terrain) {
          viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
            Cesium.IonResource.fromAssetId(1), // Ion World Terrain
            { requestVertexNormals: true, requestWaterMask: true }
          );
        } else {
          viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }
      } catch (e) {
        console.warn('Terrain update failed', e);
      }
    };
    updateTerrain();

    // Night Lights
    if (viewer.imageryLayers.length > 1) {
      const nightLayer = viewer.imageryLayers.get(1);
      nightLayer.show = visualSettings.nightLights;
    }
  }, [visualSettings]);
  const entitiesRef = useRef<Cesium.Entity[]>([]);
  const trailEntityRef = useRef<Cesium.Entity | null>(null);
  const issTrailEntityRef = useRef<Cesium.Entity | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    if (!isMounted.current) return;
    setLoading(true);
    setFetchError(null);

    const fetchTLE = async (url: string, timeout = 15000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { 
          signal: controller.signal,
          // Adding cache: 'no-cache' can sometimes help with 403s if they are cached blocks
          cache: 'no-cache'
        });
        clearTimeout(id);
        return response;
      } catch (e: any) {
        clearTimeout(id);
        if (e.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        throw e;
      }
    };

    try {
      // Fetch datasets in parallel for better performance and robustness
      const [issRes, satRes, debrisRes] = await Promise.allSettled([
        fetchTLE('/api/tle?catnr=25544'),
        fetchTLE('/api/tle?group=active'),
        fetchTLE('/api/tle?group=debris')
      ]);

      // 0. Process ISS
      if (issRes.status === 'fulfilled' && issRes.value.ok) {
        const text = await issRes.value.text();
        const parsed = parseTLE(text);
        if (parsed.length > 0) setIssData(parsed[0]);
      } else {
        console.warn('ISS TLE fetch failed, using backup');
        setIssData(tleBackup.find(s => s.name.includes('ISS')) as any);
      }

      // 1. Process Active Satellites
      if (satRes.status === 'fulfilled' && satRes.value.ok) {
        const satText = await satRes.value.text();
        if (satText && satText.length > 100) {
          const parsedSats = parseTLE(satText);
          setSatellites(parsedSats);
        }
      } else if (satellites.length === 0) {
        console.warn('Active satellites fetch failed, using backup');
        setSatellites(tleBackup.slice(0, 200) as any);
      }

      // 2. Process Debris
      if (debrisRes.status === 'fulfilled' && debrisRes.value.ok) {
        const debrisText = await debrisRes.value.text();
        if (debrisText && debrisText.length > 100) {
          setDebris(parseTLE(debrisText));
        }
      }
      
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Critical orbital data fetch error:', error);
      if (satellites.length === 0) {
        setSatellites(tleBackup as any);
        setFetchError('Limited satellite data available (offline mode).');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    const updateLayer = async () => {
      viewer.imageryLayers.removeAll();
      try {
        let provider;
        switch (currentLayer) {
          case 'street':
            provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
            );
            break;
          case 'dark':
            provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
              'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer'
            );
            break;
          case 'satellite':
          default:
            provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
            );
            break;
        }
        viewer.imageryLayers.addImageryProvider(provider);

        // Re-add Night Lights on top of all layers
        const ionToken = (import.meta as any).env.VITE_CESIUM_ION_TOKEN || '';
        if (ionToken) {
          try {
            const nightLights = await Cesium.IonImageryProvider.fromAssetId(2);
            const nightLayer = viewer.imageryLayers.addImageryProvider(nightLights);
            nightLayer.alpha = 0.5;
            nightLayer.show = visualSettings.nightLights;
          } catch (e) {}
        }
      } catch (e) {
        console.warn('Imagery layer update failed', e);
      }
    };

    updateLayer();
  }, [currentLayer, visualSettings.nightLights]);

  useEffect(() => {
    if (!containerRef.current) return;

    const initCesium = async () => {
      try {
        // Use user token if available, otherwise fallback
        const ionToken = (import.meta as any).env.VITE_CESIUM_ION_TOKEN || '';
        Cesium.Ion.defaultAccessToken = ionToken;

        // Initialize Cesium Viewer
        const viewer = new Cesium.Viewer(containerRef.current!, {
          terrainProvider: undefined,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          timeline: false,
          animation: false,
          selectionIndicator: false,
          fullscreenButton: false,
          scene3DOnly: true,
          shouldAnimate: true,
          skyAtmosphere: new Cesium.SkyAtmosphere() as any,
          showRenderLoopErrors: false,
          orderIndependentTranslucency: true,
        });

        // Use high-end imagery
        try {
          if (ionToken) {
            const terrainProvider = await Cesium.createWorldTerrainAsync({
              requestVertexNormals: true,
              requestWaterMask: true
            });
            viewer.terrainProvider = terrainProvider;
          }
        } catch (e) {
          console.warn('Terrain loading skipped or failed (Ion token may be missing)');
        }

        try {
          const imageryProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
          );
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(imageryProvider);
        } catch (e) {
          console.warn('ArcGIS Imagery failed, using default');
        }
        
        // Add Night Lights Layer (Optional)
        if (ionToken) {
          try {
            const nightLights = await Cesium.IonImageryProvider.fromAssetId(2);
            const nightLayer = viewer.imageryLayers.addImageryProvider(nightLights);
            nightLayer.alpha = 0.5;
          } catch (e) {
            console.warn('Night Lights layer failed (Ion token issue)');
          }
        }

        // Visual Tweaks for "Dark Sky" look
        viewer.scene.backgroundColor = Cesium.Color.BLACK;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0001;
        viewer.scene.skyAtmosphere.brightnessShift = -0.1;
        
        // Better lighting
        viewer.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(1, 0, 0) // Static light for better readability
        });

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
            
            // Zoom behavior refinement
            if (activeTab === 'debris') {
               viewer.zoomTo(entity, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 500000));
            }
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

  useEffect(() => {
    if (!issData || !viewerRef.current) return;
    const viewer = viewerRef.current;
    
    // Create ISS Entity once
    const issEntity = viewer.entities.add({
      id: 'ISS_TRACKER',
      name: 'ISS (ZARYA)',
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#22C55E'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
      },
      label: {
        text: 'ISS (ZARYA)',
        font: '900 12px Inter, sans-serif',
        fillColor: Cesium.Color.BLACK,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -25),
      }
    });

    // Pulse Effect for ISS (RYY Green Pulse)
    const pulseEntity = viewer.entities.add({
      position: issEntity.position,
      ellipse: {
        semiMinorAxis: new Cesium.CallbackProperty((time) => {
          if (!Cesium.defined(time)) return 1;
          const val = 120000 + Math.sin(time.secondsOfDay * 3) * 50000;
          return Math.max(1, val);
        }, false),
        semiMajorAxis: new Cesium.CallbackProperty((time) => {
          if (!Cesium.defined(time)) return 1;
          const val = 120000 + Math.sin(time.secondsOfDay * 3) * 50000;
          return Math.max(1, val);
        }, false),
        material: Cesium.Color.fromCssColorString('#22C55E').withAlpha(0.05),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#22C55E').withAlpha(0.15),
      }
    });

    let currentLat = 0;
    let currentLng = 0;

    const interval = setInterval(() => {
      const now = new Date();
      try {
        const satrec = satellite.twoline2satrec(issData.line1, issData.line2);
        const positionAndVelocity = satellite.propagate(satrec, now);
        
        if (typeof positionAndVelocity.position === 'object' && typeof positionAndVelocity.velocity === 'object') {
          const gmst = satellite.gstime(now);
          const positionGd = satellite.eciToGeodetic(positionAndVelocity.position as satellite.EciVec3<number>, gmst);
          
          currentLng = satellite.degreesLong(positionGd.longitude);
          currentLat = satellite.degreesLat(positionGd.latitude);
          const height = positionGd.height; // in km
          
          // Calculate Velocity
          const v = positionAndVelocity.velocity as satellite.EciVec3<number>;
          const velKmS = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
          const velKmH = velKmS * 3600;

          // Simple location guessing
          const getRoughLocation = (lat: number, lng: number) => {
            if (lat > 20 && lat < 50 && lng > -130 && lng < -70) return 'NORTH AMERICA';
            if (lat > 35 && lat < 70 && lng > -10 && lng < 40) return 'EUROPE';
            if (lat > -10 && lat < 40 && lng > 10 && lng < 150) return 'AFRICA / ASIA';
            if (lat > -40 && lat < -10 && lng > 110 && lng < 155) return 'AUSTRALIA';
            if (lat > -60 && lat < 15 && lng > -85 && lng < -35) return 'SOUTH AMERICA';
            if (lat < -60) return 'ANTARCTICA';
            
            // Oceans
            if (lat > -60 && lat < 60) {
              if (lng > -70 && lng < 20) return 'ATLANTIC OCEAN';
              if (lng > 20 && lng < 100) return 'INDIAN OCEAN';
              if (lng > 100 || lng < -120) return 'PACIFIC OCEAN';
            }
            return 'INTERNATIONAL WATERS';
          };

          setTelemetry({
            lat: currentLat,
            lng: currentLng,
            alt: height,
            vel: velKmH,
            timestamp: now.toISOString(),
            location: getRoughLocation(currentLat, currentLng)
          });

          issEntity.position = Cesium.Cartesian3.fromDegrees(currentLng, currentLat, height * 1000) as any;
        }
      } catch (e) {
        console.error('Telemetry update failed', e);
      }
    }, 1000);

    // Initial Zoom to ISS
    setTimeout(() => {
      viewer.zoomTo(issEntity, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 2000000));
    }, 2000);

    return () => {
      clearInterval(interval);
      if (viewer && !viewer.isDestroyed()) {
        try {
          viewer.entities.remove(issEntity);
          viewer.entities.remove(pulseEntity);
        } catch (e) {}
      }
    };
  }, [issData]);

  const parseTLE = (text: string): SatelliteData[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const results: SatelliteData[] = [];
    
    // Attempt to handle 3-line format (Name, L1, L2) or 2-line format (L1, L2)
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('1 ')) {
        // L1 found, check if L2 is next
        if (lines[i+1] && lines[i+1].startsWith('2 ')) {
          const l1 = line;
          const l2 = lines[i+1];
          const name = (i > 0 && !lines[i-1].startsWith('1 ') && !lines[i-1].startsWith('2 ')) 
            ? lines[i-1] 
            : `OBJECT ${l1.substring(2, 7)}`;
            
          const inclination = parseFloat(l2.substring(8, 16));
          const eccentricity = parseFloat('0.' + l2.substring(26, 33));
          
          results.push({ name, line1: l1, line2: l2, inclination, eccentricity });
          i += 2;
          continue;
        }
      }
      i++;
    }
    return results;
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    // Clear existing entities safely
    try {
      if (viewer && !viewer.isDestroyed()) {
        entitiesRef.current.forEach(entity => {
          if (Cesium.defined(entity) && viewer.entities.contains(entity)) {
            viewer.entities.remove(entity);
          }
        });
      }
    } catch (e) {
      console.warn('Error clearing entities:', e);
    }
    entitiesRef.current = [];

    // Clear selections when switching tabs to prevent stale state
    setSelectedSatellite(null);
    setSelectedMeteorShower(null);
    setSelectedUFO(null);
    if (viewer && !viewer.isDestroyed()) {
      viewer.trackedEntity = undefined;
    }

    if (activeTab === 'satellites') {
      if (issData) renderSatellites([issData], Cesium.Color.fromCssColorString('#22C55E'));
      renderSatellites(satellites, Cesium.Color.fromCssColorString('#22C55E').withAlpha(0.6));
    } else if (activeTab === 'debris') {
      renderSatellites(debris, Cesium.Color.fromCssColorString('#EF4444').withAlpha(0.8));
    } else if (activeTab === 'meteors') {
      renderMeteors();
    } else if (activeTab === 'ufo') {
      renderUFOs();
    }
  }, [activeTab, satellites, debris, issData]);

  const calculateOrbitPath = (sat: SatelliteData, durationHours: number) => {
    const points: Cesium.Cartesian3[] = [];
    try {
      const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
      const now = new Date();
      
      // Calculate points every 2 minutes for better resolution
      for (let i = 0; i <= durationHours * 60; i += 2) {
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

  // Dedicated ISS Trail Effect
  useEffect(() => {
    if (!viewerRef.current || !issData) return;
    const viewer = viewerRef.current;

    const updateIssPath = () => {
      if (!viewer || viewer.isDestroyed()) return;
      
      // Remove existing trail
      if (issTrailEntityRef.current) {
        try {
          viewer.entities.remove(issTrailEntityRef.current);
        } catch (e) {}
        issTrailEntityRef.current = null;
      }

      const path = calculateOrbitPath(issData, 24);
      if (path.length > 1) {
        issTrailEntityRef.current = viewer.entities.add({
          name: 'ISS 24h Prediction Path',
          polyline: {
            positions: path,
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.fromCssColorString('#22C55E').withAlpha(0.4),
            }),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000000),
          },
        });
      }
    };

    updateIssPath();
    const interval = setInterval(updateIssPath, 300000); // Update every 5 mins

    return () => {
      clearInterval(interval);
      if (issTrailEntityRef.current && viewer && !viewer.isDestroyed()) {
        try {
          viewer.entities.remove(issTrailEntityRef.current);
        } catch (e) {}
        issTrailEntityRef.current = null;
      }
    };
  }, [issData]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    const updatePath = () => {
      if (!viewer || viewer.isDestroyed()) return;
      // Clear existing trail
      if (trailEntityRef.current) {
        viewer.entities.remove(trailEntityRef.current);
        trailEntityRef.current = null;
      }

      if (selectedSatellite) {
        const path = calculateOrbitPath(selectedSatellite, 24);
        const isDebris = debris.some(d => d.name === selectedSatellite.name);
        const trailColor = isDebris ? Cesium.Color.fromCssColorString('#EF4444') : Cesium.Color.fromCssColorString('#22C55E');

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
      if (entity && viewer && !viewer.isDestroyed()) {
        viewer.trackedEntity = entity;
        viewer.zoomTo(entity, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 1000000));
      }
    } else if (viewer && !viewer.isDestroyed()) {
      viewer.trackedEntity = undefined;
    }

    // Refresh path every 60 seconds to keep it "dynamic" as time progresses
    const pathInterval = setInterval(updatePath, 60000);

    return () => {
      clearInterval(pathInterval);
      if (trailEntityRef.current && viewerRef.current && !viewerRef.current.isDestroyed()) {
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
      if (viewer.isDestroyed()) return;
      data.slice(0, 500).forEach(sat => { // Limit to 500 for performance
        try {
          if (viewer.isDestroyed()) return;
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
              pixelSize: color.red > 0.8 ? 8 : 6, // Larger for debris
              color: color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: color.red > 0.8 ? 2 : 1,
            },
            label: color.red > 0.8 ? {
              text: 'DEBRIS',
              font: '900 8px Inter, sans-serif',
              fillColor: Cesium.Color.RED,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -10),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2000000),
            } : undefined,
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
      if (!viewer.isDestroyed()) {
        viewer.entities.resumeEvents();
      }
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
      if (viewer.isDestroyed()) return;
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
          if (!active && upcoming) return Cesium.Color.fromCssColorString('#94A3B8').withAlpha(0.6);
          if (zhr > 100) return Cesium.Color.fromCssColorString('#22C55E');
          if (zhr > 70) return Cesium.Color.fromCssColorString('#4ADE80');
          if (zhr > 40) return Cesium.Color.fromCssColorString('#86EFAC');
          if (zhr > 20) return Cesium.Color.fromCssColorString('#BBF7D0');
          return Cesium.Color.fromCssColorString('#DCFCE7');
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
          label: {
            text: isActive ? `LIVE: ${shower.name}` : (isUpcoming ? `UPCOMING: ${shower.name}` : shower.name),
            font: isActive ? '900 16px Inter, sans-serif' : '12px Inter, sans-serif',
            fillColor: isActive ? Cesium.Color.fromCssColorString('#22C55E') : (isUpcoming ? Cesium.Color.LIGHTGRAY : Cesium.Color.BLACK),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -pixelSize - 10),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 50000000),
          },
          properties: new Cesium.PropertyBag({
            type: 'meteor',
            data: { ...shower, status: isActive ? 'ACTIVE' : (isUpcoming ? 'UPCOMING' : 'INACTIVE') }
          })
        });
        entitiesRef.current.push(radiant);

        // Add secondary glow for active radiants
        if (isActive) {
          const radiantGlow = viewer.entities.add({
            position: radiantPos,
            ellipse: {
              semiMinorAxis: new Cesium.CallbackProperty((time) => {
                if (!Cesium.defined(time)) return 100000;
                return 400000 + Math.sin(time.secondsOfDay * 2) * 200000;
              }, false),
              semiMajorAxis: new Cesium.CallbackProperty((time) => {
                if (!Cesium.defined(time)) return 100000;
                return 400000 + Math.sin(time.secondsOfDay * 2) * 200000;
              }, false),
              material: Cesium.Color.fromCssColorString('#22C55E').withAlpha(0.15),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('#22C55E').withAlpha(0.3),
            }
          });
          entitiesRef.current.push(radiantGlow);
        }

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
      if (!viewer.isDestroyed()) {
        viewer.entities.resumeEvents();
      }
    }
  };

  const renderUFOs = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    
    viewer.entities.suspendEvents();
    try {
      if (viewer.isDestroyed()) return;
      const locations = [
        { name: 'Roswell, NM', lat: 33.3943, lon: -104.5230, description: 'Famous 1947 crash site' },
        { name: 'Area 51, NV', lat: 37.2431, lon: -115.7930, description: 'Classified Groom Lake facility' },
        { name: 'Rendlesham Forest, UK', lat: 52.0911, lon: 1.4392, description: '1980 binary code detection' },
        { name: 'Bonnybridge, Scotland', lat: 56.0028, lon: -3.8886, description: 'High frequency sighting corridor' },
        { name: 'Wycliffe Well, Australia', lat: -20.7781, lon: 134.2344, description: 'UFO Capital of Australia' },
        { name: 'Varginha, Brazil', lat: -21.5517, lon: -45.4303, description: '1996 entity encounter report' },
        { name: 'Tehran, Iran', lat: 35.6892, lon: 51.3890, description: '1976 radar intercept event' },
        { name: 'Phoenix, AZ', lat: 33.4484, lon: -112.0740, description: '1997 "Phoenix Lights" formation' },
      ];

      locations.forEach((loc, i) => {
        const entity = viewer.entities.add({
          name: `UFO Sighting: ${loc.name}`,
          position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 50000),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString('#22C55E'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: 'UNIDENTIFIED SIGNAL',
            font: '900 10px Inter, sans-serif',
            fillColor: Cesium.Color.BLACK,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
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
            material: Cesium.Color.fromCssColorString('#22C55E').withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#22C55E').withAlpha(0.3),
          }
        });
        entitiesRef.current.push(pulseEntity);
      });
    } finally {
      if (!viewer.isDestroyed()) {
        viewer.entities.resumeEvents();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-0 bg-[#050505] overflow-hidden select-none font-sans text-white">
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* Modern Top Search & Command Bar */}
      <div className="absolute top-6 left-6 right-6 z-50 flex flex-col md:flex-row items-center gap-4 pointer-events-none">
        {/* Logo / Title */}
        <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl pointer-events-auto h-14">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Globe size={18} className="animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] leading-none">STARGAZE<span className="text-cyan-400">.OPS</span></h1>
            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Orbital Command & Control</span>
          </div>
        </div>

        {/* Global Search */}
        <div className="relative w-full md:w-96 pointer-events-auto group">
          <form onSubmit={handleSearch} className="relative">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location, satellite, or coordinates..."
              className="w-full h-14 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl px-12 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder:text-white/20"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
            {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin" size={18} />}
          </form>

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
              >
                {searchResults.map((res: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (res.type === 'location') {
                        flyToLocation(parseFloat(res.lat), parseFloat(res.lon), 50000);
                        setSearchQuery(res.display_name);
                      } else {
                        // Find entity of satellite
                        const entity = entitiesRef.current.find(e => e.name === res.name);
                        if (entity && viewerRef.current) {
                          viewerRef.current.trackedEntity = entity;
                          viewerRef.current.zoomTo(entity, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 1000000));
                          setSelectedSatellite(res);
                        }
                        setSearchQuery(res.name);
                      }
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-5 py-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex items-start gap-3"
                  >
                    {res.type === 'location' ? (
                      <MapIcon size={14} className="text-cyan-400 mt-1 flex-shrink-0" />
                    ) : (
                      <Satellite size={14} className={res.type === 'debris' ? "text-red-400 mt-1 flex-shrink-0" : "text-cyan-400 mt-1 flex-shrink-0"} />
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white/90">{res.type === 'location' ? res.display_name : res.name}</span>
                      <span className="text-[10px] text-white/30 uppercase tracking-widest">{res.type}</span>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl pointer-events-auto h-14">
          <button 
            onClick={() => setShowLayerPicker(!showLayerPicker)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${showLayerPicker ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/40 hover:text-white/80'}`}
          >
            <Layers size={18} />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${showSettings ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/40 hover:text-white/80'}`}
          >
            <Settings size={18} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button 
            onClick={() => {
              if (viewerRef.current) {
                viewerRef.current.camera.flyTo({
                  destination: viewerRef.current.camera.position,
                  orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(-90),
                    roll: 0
                  },
                  duration: 1.5
                });
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white/40 hover:text-white/80 transition-all"
            title="Reset to North"
          >
            <Navigation size={18} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button 
            onClick={() => {
              if (viewerRef.current) {
                viewerRef.current.camera.zoomIn(viewerRef.current.camera.positionCartographic.height * 0.3);
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white/40 hover:text-white/80 transition-all font-black text-lg"
            title="Zoom In"
          >
            +
          </button>
          <button 
            onClick={() => {
              if (viewerRef.current) {
                viewerRef.current.camera.zoomOut(viewerRef.current.camera.positionCartographic.height * 0.4);
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white/40 hover:text-white/80 transition-all font-black text-lg"
            title="Zoom Out"
          >
            -
          </button>
        </div>
      </div>

      {/* Layer Picker Overlay */}
      <AnimatePresence>
        {showLayerPicker && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-24 right-44 z-50 w-64 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-2xl"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
              <Layers size={12} /> Map Layers
            </h3>
            <div className="space-y-2">
              {[
                { id: 'satellite', label: 'Immersive Satellite', icon: Globe, desc: 'High-res orbital imagery' },
                { id: 'street', label: 'Global Streets', icon: Navigation, desc: 'Detailed road network' },
                { id: 'dark', label: 'Vector Dark', icon: Moon, desc: 'Low-light minimalist view' },
              ].map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => {
                    setCurrentLayer(layer.id as any);
                    setShowLayerPicker(false);
                  }}
                  className={`w-full p-4 rounded-2xl flex flex-col items-start gap-1 transition-all ${
                    currentLayer === layer.id ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <layer.icon size={14} />
                    <span className="text-[10px] font-black uppercase tracking-tight">{layer.label}</span>
                  </div>
                  <span className={`text-[8px] font-bold uppercase ${currentLayer === layer.id ? 'text-black/60' : 'text-white/20'}`}>{layer.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 20 }}
            className="absolute top-24 right-6 z-50 w-64 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Visual Settings</h3>
              <CloseIcon size={14} className="text-white/20 cursor-pointer hover:text-white" onClick={() => setShowSettings(false)} />
            </div>
            <div className="space-y-4">
              {[
                { key: 'atmosphere', label: 'Atmosphere', icon: Sun },
                { key: 'nightLights', label: 'City Lights', icon: Moon },
                { key: 'stars', label: 'Space Stars', icon: Sparkles },
                { key: 'terrain', label: '3D Terrain', icon: MapIcon },
              ].map((s) => (
                <div key={s.key} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <s.icon size={14} className="text-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-tight">{s.label}</span>
                  </div>
                  <button 
                    onClick={() => setVisualSettings(prev => ({ ...prev, [s.key]: !prev[s.key as keyof typeof visualSettings] }))}
                    className={`w-10 h-5 rounded-full transition-all relative ${visualSettings[s.key as keyof typeof visualSettings] ? 'bg-cyan-500' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${visualSettings[s.key as keyof typeof visualSettings] ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Technical Sidebar */}
      <div className={`absolute left-6 top-24 bottom-6 z-40 w-80 pointer-events-none transition-all duration-500 ease-in-out ${
        showSidebar ? 'translate-x-0' : '-translate-x-[calc(100%+40px)]'
      }`}>
        <motion.div className="h-full bg-black/60 shadow-2xl backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-8 flex flex-col pointer-events-auto overflow-hidden relative">
          {/* Status Rings */}
          <div className="absolute -top-20 -left-20 w-40 h-40 border border-cyan-500/10 rounded-full animate-spin-slow pointer-events-none" />
          <div className="absolute -top-10 -left-10 w-20 h-20 border border-cyan-500/5 rounded-full animate-reverse-spin pointer-events-none" />

          {/* Tabs */}
          <div className="space-y-3 mb-10 overflow-y-auto custom-scrollbar pr-2">
            {[
              { id: 'satellites', icon: Satellite, label: 'Tracking', desc: 'Active Satellite Constellations', color: 'cyan' },
              { id: 'debris', icon: Trash2, label: 'Hazardous', desc: 'Space Debris & Fragments', color: 'red' },
              { id: 'meteors', icon: Sparkles, label: 'Celestial', desc: 'Active Meteor Showers', color: 'orange' },
              { id: 'ufo', icon: Eye, label: 'Anomalies', desc: 'Unverified Signals', color: 'green' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full group relative p-5 rounded-3xl transition-all duration-300 border ${
                  activeTab === tab.id 
                    ? 'bg-cyan-500/10 border-cyan-500/30' 
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    activeTab === tab.id ? 'bg-cyan-500 text-black' : 'bg-white/5 text-white/40 group-hover:text-cyan-400'
                  }`}>
                    <tab.icon size={18} />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`text-xs font-black uppercase tracking-widest ${activeTab === tab.id ? 'text-cyan-400' : 'text-white/80'}`}>
                      {tab.label}
                    </p>
                    <p className="text-[9px] text-white/30 font-medium uppercase tracking-tight mt-1">{tab.desc}</p>
                  </div>
                  {tab.id === 'satellites' && (
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[10px] font-mono text-cyan-500/80">{satellites.length}</span>
                      <div className="flex gap-0.5">
                        <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" />
                        <div className="w-1 h-1 bg-cyan-500/30 rounded-full" />
                        <div className="w-1 h-1 bg-cyan-500/30 rounded-full" />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* System Info HUD */}
          <div className="mt-auto space-y-6 pt-6 border-t border-white/10">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Signal Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                  <span className="text-[10px] font-black uppercase text-cyan-400">Stable</span>
                </div>
              </div>
              <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 text-right">
                <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Network</p>
                <span className="text-[10px] font-black uppercase text-white/60">CELESTRAK-V4</span>
              </div>
            </div>
            
            <button 
              onClick={() => fetchData()}
              disabled={loading}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 group"
            >
              <RefreshCw size={14} className={`text-cyan-400 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 group-hover:text-white">Refresh Orbital Layer</span>
            </button>
          </div>
        </motion.div>

        {/* Toggle Hook */}
        <button 
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute top-1/2 -right-12 -translate-y-1/2 w-8 h-20 bg-black/60 shadow-xl backdrop-blur-xl border border-white/10 border-l-0 rounded-r-2xl pointer-events-auto flex items-center justify-center text-white/30 hover:text-cyan-400 transition-colors"
        >
          <ChevronRight size={18} className={`transition-transform duration-500 ${showSidebar ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Bottom HUD HUD Telemetry */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-4xl px-6">
        <AnimatePresence>
          {telemetry && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/60 backdrop-blur-3xl p-6 md:p-8 rounded-[2.5rem] border border-white/10 flex flex-col md:flex-row items-center gap-8 md:gap-16 pointer-events-auto relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />
              
              <div className="flex flex-col min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Global Vector</span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase truncate leading-none">
                  {telemetry.location}
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 w-full">
                {[
                  { label: 'Altitude', value: Math.round(telemetry.alt), unit: 'KM', color: 'cyan' },
                  { label: 'Velocity', value: Math.round(telemetry.vel).toLocaleString(), unit: 'M/S', color: 'cyan' },
                  { label: 'Latitude', value: telemetry.lat.toFixed(3), unit: 'DEG', color: 'white' },
                  { label: 'Longitude', value: telemetry.lng.toFixed(3), unit: 'DEG', color: 'white' },
                ].map((item) => (
                  <div key={item.label} className="relative">
                    <p className="text-[7px] text-white/30 uppercase tracking-[0.2em] font-black mb-1">{item.label}</p>
                    <div className="flex items-baseline gap-1">
                      <p className={`text-lg md:text-xl font-black font-mono leading-none ${item.color === 'cyan' ? 'text-cyan-400' : 'text-white'}`}>
                        {item.value}
                      </p>
                      <span className="text-[8px] font-bold text-white/20">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Observation Cards */}
      <div className={`absolute top-24 right-6 bottom-24 z-50 w-80 pointer-events-none flex flex-col gap-4 transition-transform duration-500 ${
        selectedSatellite || selectedMeteorShower || setSelectedUFO ? 'translate-x-0' : 'translate-x-[calc(100%+40px)]'
      }`}>
        <AnimatePresence mode="wait">
          {selectedSatellite && (
            <motion.div
              key="satellite-info"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="bg-black/80 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/10 text-white relative flex flex-col pointer-events-auto shadow-2xl h-fit max-h-full overflow-y-auto custom-scrollbar"
            >
              <div className="absolute top-6 right-6">
                <button 
                  onClick={() => setSelectedSatellite(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-white"
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="flex items-center gap-5 mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  debris.some(d => d.name === selectedSatellite.name) ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'
                }`}>
                  <Satellite size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg leading-tight uppercase tracking-tight truncate max-w-[160px]">{selectedSatellite.name}</h3>
                  <p className={`text-[9px] uppercase tracking-[0.2em] font-black mt-1 ${
                    debris.some(d => d.name === selectedSatellite.name) ? 'text-red-400' : 'text-cyan-400 font-bold'
                  }`}>
                    {debris.some(d => d.name === selectedSatellite.name) ? 'ORBITAL HAZARD' : 'VERIFIED SIGNAL'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5">
                  <p className="text-[8px] text-white/20 uppercase tracking-widest font-black mb-4 text-center">Telemetry Profile</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center border-r border-white/5 px-2">
                      <p className="text-[8px] text-white/40 font-bold uppercase mb-1">Inclination</p>
                      <p className="text-sm font-black font-mono text-cyan-400">{selectedSatellite.inclination?.toFixed(3)}°</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-[8px] text-white/40 font-bold uppercase mb-1">Eccentricity</p>
                      <p className="text-sm font-black font-mono text-white">{selectedSatellite.eccentricity?.toFixed(4)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5">
                  <p className="text-[9px] text-white/20 uppercase tracking-widest font-black mb-3">Orbital Elements</p>
                  <div className="space-y-3">
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-[7px] text-white/30 font-bold uppercase mb-1 tracking-widest">NORAD TLE 1</p>
                      <p className="text-[10px] font-mono text-white/60 break-all leading-relaxed">{selectedSatellite.line1}</p>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-[7px] text-white/30 font-bold uppercase mb-1 tracking-widest">NORAD TLE 2</p>
                      <p className="text-[10px] font-mono text-white/60 break-all leading-relaxed">{selectedSatellite.line2}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button className="flex-1 py-5 bg-cyan-500 text-black rounded-2xl flex items-center justify-center gap-3 transition-all hover:bg-cyan-400 active:scale-95">
                    <Navigation size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Engage Vector</span>
                  </button>
                  <button className="w-16 py-5 bg-white/5 rounded-2xl flex items-center justify-center text-white/30 hover:text-white transition-all shadow-xl">
                    <ExternalLink size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {selectedMeteorShower && (
            <motion.div
              key="meteor-info"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/80 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-orange-500/20 text-white relative flex flex-col pointer-events-auto h-fit shadow-2xl"
            >
              <div className="absolute top-6 right-6">
                <button onClick={() => setSelectedMeteorShower(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-white">
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg leading-tight uppercase tracking-tight">{selectedMeteorShower.name}</h3>
                  <p className="text-[9px] text-orange-400 uppercase tracking-[0.2em] font-black">Major Celestial Event</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-orange-500/5 rounded-3xl border border-orange-500/10">
                  <div className="flex justify-between items-center mb-3">
                     <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Zenith Rate</span>
                     <span className="text-xl font-black text-orange-400 font-mono">{selectedMeteorShower.zhr} <span className="text-[9px] opacity-40">ZHR</span></span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(selectedMeteorShower.zhr, 100)}%` }}
                      className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                    <p className="text-[8px] text-white/20 uppercase font-black mb-1">Parent Body</p>
                    <p className="text-xs font-black text-white truncate">{selectedMeteorShower.parent}</p>
                  </div>
                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                    <p className="text-[8px] text-white/20 uppercase font-black mb-1">Constellation</p>
                    <p className="text-xs font-black text-white">{selectedMeteorShower.constellation}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {selectedUFO && (
            <motion.div
              key="ufo-info"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/80 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-green-500/20 text-white relative flex flex-col pointer-events-auto h-fit shadow-2xl"
            >
              <div className="absolute top-6 right-6">
                <button onClick={() => setSelectedUFO(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-white">
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 text-green-400 flex items-center justify-center">
                  <Eye size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg leading-tight uppercase tracking-tight">Signal Analysis</h3>
                  <p className="text-[9px] text-green-400 uppercase tracking-[0.2em] font-black">Anomalous Detection</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black text-white mb-2 uppercase italic tracking-tight">"{selectedUFO.description}"</p>
                  <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">- ARCHIVE REPORT</p>
                </div>
                <div className="p-6 bg-green-500/5 rounded-3xl border border-green-500/10 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 blur-3xl pointer-events-none" />
                  <p className="text-[9px] font-bold text-green-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                    <Activity size={10} /> Active Monitoring
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-black/40 rounded-xl">
                      <p className="text-[7px] text-white/40 uppercase font-black mb-1">LAT Signature</p>
                      <p className="text-xs font-black font-mono text-white">{selectedUFO.lat.toFixed(4)}</p>
                    </div>
                    <div className="p-3 bg-black/40 rounded-xl">
                      <p className="text-[7px] text-white/40 uppercase font-black mb-1">LON Signature</p>
                      <p className="text-xs font-black font-mono text-white">{selectedUFO.lon.toFixed(4)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modern Loading System */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl"
          >
            <div className="flex flex-col items-center gap-8">
              <div className="relative">
                <div className="w-24 h-24 border-2 border-cyan-500/20 rounded-full animate-pulse" />
                <div className="absolute inset-0 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-4 border border-white/10 rounded-full flex items-center justify-center">
                  <Globe className="text-cyan-400 animate-pulse" size={24} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-black uppercase tracking-[0.4em] text-xs mb-2">INITIALIZING ORBITAL PROTOCOL</p>
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CesiumGlobe;
