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
  const [activeTab, setActiveTab] = useState<'satellites' | 'debris' | 'meteors' | 'ufo'>('meteors');
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
    grid: false,
    bloom: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showIssTrail, setShowIssTrail] = useState(true);
  const [isTrackingIss, setIsTrackingIss] = useState(false);
  const [isLockedOnSelected, setIsLockedOnSelected] = useState(false);
  const [ephemeris, setEphemeris] = useState<{ az: number, el: number, dist: number, lat: number, lng: number, alt: number } | null>(null);

  const flyToLocation = (lat: number, lon: number, height = 2000000) => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
    });
  };

  // Double-click to fly handler
  useEffect(() => {
    if (!viewerRef.current || !containerRef.current) return;
    const viewer = viewerRef.current;
    
    const doubleClickHandler = (movement: any) => {
      const pickedObject = viewer.scene.pick(movement.position);
      if (!Cesium.defined(pickedObject)) {
        const ray = viewer.camera.getPickRay(movement.position);
        if (ray) {
          const position = viewer.scene.globe.pick(ray, viewer.scene);
          if (position) {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            flyToLocation(
              Cesium.Math.toDegrees(cartographic.latitude), 
              Cesium.Math.toDegrees(cartographic.longitude),
              viewer.camera.positionCartographic.height * 0.5
            );
          }
        }
      }
    };

    const handler = handlerRef.current;
    if (handler) {
      handler.setInputAction(doubleClickHandler, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
  }, []);

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

        // Smoother camera experience
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
        viewer.scene.screenSpaceCameraController.inertiaSpin = 0.9;
        viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.9;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.8;

        // Double-click to fly to location
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handlerRef.current = handler;

        handler.setInputAction((movement: any) => {
          const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
          if (cartesian) {
            viewer.camera.flyTo({
              destination: cartesian,
              duration: 2.0,
              easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
            });
          }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

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
            
            // Smooth fly to radiant
            viewer.camera.flyTo({
              destination: entity.position.getValue(Cesium.JulianDate.now()),
              orientation: {
                heading: viewer.camera.heading,
                pitch: Cesium.Math.toRadians(-45),
                roll: 0.0
              },
              duration: 2.0,
              easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
            });
          } else if (props && props.type === 'ufo') {
            setSelectedUFO(props.data);
            setSelectedSatellite(null);
            setSelectedMeteorShower(null);
            viewer.trackedEntity = undefined;
            viewer.camera.flyTo({
              destination: entity.position.getValue(Cesium.JulianDate.now()),
              duration: 1.5,
              easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
            });
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

  useEffect(() => {
    if (!issData || !viewerRef.current) return;
    const viewer = viewerRef.current;
    
    // Create ISS Entity once
    const issEntity = viewer.entities.add({
      id: 'ISS_TRACKER',
      name: 'ISS (ZARYA)',
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#FACC15'),
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

    // Pulse Effect for ISS (Space Yellow Pulse)
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
        material: Cesium.Color.fromCssColorString('#FACC15').withAlpha(0.05),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#FACC15').withAlpha(0.15),
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

          // Update selected object ephemeris if it's a satellite
          if (selectedSatellite) {
             try {
                const sRec = satellite.twoline2satrec(selectedSatellite.line1, selectedSatellite.line2);
                const pAndV = satellite.propagate(sRec, now);
                if (typeof pAndV.position === 'object') {
                  const pGd = satellite.eciToGeodetic(pAndV.position as satellite.EciVec3<number>, gmst);
                  setEphemeris({
                    lat: satellite.degreesLat(pGd.latitude),
                    lng: satellite.degreesLong(pGd.longitude),
                    alt: pGd.height,
                    az: 0, // Simplified for now
                    el: 0,
                    dist: Math.sqrt(pAndV.position.x**2 + pAndV.position.y**2 + pAndV.position.z**2)
                  });
                }
             } catch (e) {}
          } else {
            setEphemeris(null);
          }

          issEntity.position = Cesium.Cartesian3.fromDegrees(currentLng, currentLat, height * 1000) as any;

          // Sync Tracking
          if (isTrackingIss && viewerRef.current) {
            viewerRef.current.trackedEntity = issEntity;
          }
        }
      } catch (e) {
        console.error('Telemetry update failed', e);
      }
    }, 1000);

    // Initial Zoom to ISS
    setTimeout(() => {
      if (!isTrackingIss) {
        viewer.zoomTo(issEntity, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 2000000));
      }
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
      if (issData) renderSatellites([issData], Cesium.Color.fromCssColorString('#FACC15'));
      renderSatellites(satellites, Cesium.Color.fromCssColorString('#FACC15').withAlpha(0.6));
    } else if (activeTab === 'debris') {
      renderSatellites(debris, Cesium.Color.fromCssColorString('#EF4444').withAlpha(0.8));
    } else if (activeTab === 'meteors') {
      renderMeteors();
    } else if (activeTab === 'ufo') {
      renderUFOs();
    }
  }, [activeTab, satellites, debris, issData]);

  const calculateOrbitPath = (sat: SatelliteData, durationHours: number, pastHours: number = 0) => {
    const points: Cesium.Cartesian3[] = [];
    try {
      const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
      const now = new Date();
      
      const startMin = -Math.abs(pastHours) * 60;
      const endMin = durationHours * 60;
      
      // Calculate points every 1 minute for maximum precision and smooth visualization
      for (let i = startMin; i <= endMin; i += 1) {
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
  const issGroundTrailRef = useRef<Cesium.Entity | null>(null);

  useEffect(() => {
    if (!viewerRef.current || !issData || !showIssTrail) {
      if (viewerRef.current) {
        if (issTrailEntityRef.current) {
          viewerRef.current.entities.remove(issTrailEntityRef.current);
          issTrailEntityRef.current = null;
        }
        if (issGroundTrailRef.current) {
          viewerRef.current.entities.remove(issGroundTrailRef.current);
          issGroundTrailRef.current = null;
        }
      }
      return;
    }
    const viewer = viewerRef.current;

    const updateIssPath = () => {
      if (!viewer || viewer.isDestroyed()) return;
      
      // Remove existing trails
      if (issTrailEntityRef.current) {
        try { viewer.entities.remove(issTrailEntityRef.current); } catch (e) {}
        issTrailEntityRef.current = null;
      }
      if (issGroundTrailRef.current) {
        try { viewer.entities.remove(issGroundTrailRef.current); } catch (e) {}
        issGroundTrailRef.current = null;
      }

      // Calculate path: 1.5 hours past (trail) + 22.5 hours future (prediction) = 24.0 hours total
      const path = calculateOrbitPath(issData, 22.5, 1.5);
      
      if (path.length > 1) {
        // High-altitude orbital trail (Glow)
        issTrailEntityRef.current = viewer.entities.add({
          name: 'ISS 24h Prediction Path',
          polyline: {
            positions: path,
            width: 5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.5,
              color: Cesium.Color.fromCssColorString('#FACC15'),
            }),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000000),
            zIndex: 10
          },
        });

        // Ground Trace (Shadow)
        const groundPositions = path.map(p => {
          const carto = Cesium.Cartographic.fromCartesian(p);
          return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
        });

        issGroundTrailRef.current = viewer.entities.add({
          name: 'ISS Ground Trace',
          polyline: {
             positions: groundPositions,
             width: 2,
             material: new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.fromCssColorString('#FACC15').withAlpha(0.3),
                dashLength: 16
             }),
             clampToGround: true,
             zIndex: 5
          }
        });
      }
    };

    updateIssPath();
    const interval = setInterval(updateIssPath, 60000); // Dynamic update

    return () => {
      clearInterval(interval);
      if (viewer && !viewer.isDestroyed()) {
        if (issTrailEntityRef.current) viewer.entities.remove(issTrailEntityRef.current);
        if (issGroundTrailRef.current) viewer.entities.remove(issGroundTrailRef.current);
        issTrailEntityRef.current = null;
        issGroundTrailRef.current = null;
      }
    };
  }, [issData, showIssTrail]);

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
        const isDebris = debris?.some(d => d.name === selectedSatellite.name);
        const trailColor = isDebris ? Cesium.Color.fromCssColorString('#EF4444') : Cesium.Color.fromCssColorString('#FACC15');

        trailEntityRef.current = viewer.entities.add({
          name: `${selectedSatellite.name} 24h Orbit Path`,
          polyline: {
            positions: path,
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.25,
              color: trailColor,
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
        if (isLockedOnSelected) {
          viewer.trackedEntity = entity;
        }
        viewer.zoomTo(entity, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 1000000));
      }
    } else if (viewer && !viewer.isDestroyed()) {
      if (!isTrackingIss) {
        viewer.trackedEntity = undefined;
      }
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
        'Aquarius': { ra: 338, dec: -1 },
        'Perseus': { ra: 48, dec: 58 },
        'Orion': { ra: 95, dec: 16 },
        'Leo': { ra: 153, dec: 22 },
        'Gemini': { ra: 112, dec: 33 },
        'Ursa Minor': { ra: 217, dec: 76 }
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
          if (active) {
            if (zhr > 80) return Cesium.Color.fromCssColorString('#FACC15'); // Radiant Yellow
            if (zhr > 30) return Cesium.Color.fromCssColorString('#FEF08A'); // Light Yellow
            return Cesium.Color.fromCssColorString('#FEF9C3'); // Extra Light Yellow
          }
          if (upcoming) {
            return Cesium.Color.fromCssColorString('#3B82F6').withAlpha(0.7); // Bright Blue for anticipation
          }
          return Cesium.Color.fromCssColorString('#94A3B8').withAlpha(0.4); // Muted Gray for past/inactive
        };

        const color = getIntensityColor(shower.zhr, isActive, isUpcoming);

        let lon = coords.ra - gmstDeg;
        while (lon < -180) lon += 360;
        while (lon > 180) lon -= 360;
        const lat = coords.dec;

        const radiantPos = Cesium.Cartesian3.fromDegrees(lon, lat, 2000000);
        if (!Cesium.defined(radiantPos)) return;
        
        // --- AMAZING VISUALIZATION ---
        if (isActive) {
           // Radiant Glow Plane
           viewer.entities.add({
             position: radiantPos,
             ellipse: {
               semiMinorAxis: 150000,
               semiMajorAxis: 150000,
               material: color.withAlpha(0.1),
               outline: true,
               outlineColor: color.withAlpha(0.3),
               outlineWidth: 2,
               height: 2000000
             }
           });

           // Volumetric Burst (Fake)
           for (let j = 0; j < 6; j++) {
             const angle = (j / 6) * Math.PI * 2;
             const targetLon = lon + Math.cos(angle) * 8;
             const targetLat = lat + Math.sin(angle) * 8;
             
             viewer.entities.add({
               polyline: {
                 positions: [
                   radiantPos,
                   Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 0)
                 ],
                 width: 2,
                 material: new Cesium.PolylineDashMaterialProperty({
                   color: color.withAlpha(0.05),
                   dashLength: 20,
                   gapColor: Cesium.Color.TRANSPARENT
                 }),
                 distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000)
               }
             });
           }
        }
        
        // Size based on intensity and status
        const baseSize = isActive ? 12 : 8;
        const intensitySize = (shower.zhr / 120) * 14; // Scaled to max ZHR
        const pixelSize = baseSize + intensitySize;

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
            fillColor: isActive ? Cesium.Color.fromCssColorString('#FACC15') : (isUpcoming ? Cesium.Color.LIGHTGRAY : Cesium.Color.BLACK),
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

        // Add status-based glow
        if (isActive || isUpcoming) {
          const glowColor = isActive 
            ? Cesium.Color.fromCssColorString('#FACC15').withAlpha(0.2) 
            : Cesium.Color.fromCssColorString('#3B82F6').withAlpha(0.1);
          
          const glowSize = (shower.zhr / 120) * 800000 + 400000;

          const radiantGlow = viewer.entities.add({
            position: radiantPos,
            ellipse: {
              semiMinorAxis: new Cesium.CallbackProperty((time) => {
                if (!Cesium.defined(time)) return glowSize;
                const pulse = isActive ? Math.sin(time.secondsOfDay * 2) * 200000 : 0;
                return glowSize + pulse;
              }, false),
              semiMajorAxis: new Cesium.CallbackProperty((time) => {
                if (!Cesium.defined(time)) return glowSize;
                const pulse = isActive ? Math.sin(time.secondsOfDay * 2) * 200000 : 0;
                return glowSize + pulse;
              }, false),
              material: glowColor,
              outline: isActive,
              outlineColor: glowColor.withAlpha(0.4),
              zIndex: 1
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
            color: Cesium.Color.fromCssColorString('#FACC15'),
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
              <h3 style="color: #FACC15;">UFO Sighting Report</h3>
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
            material: Cesium.Color.fromCssColorString('#FACC15').withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#FACC15').withAlpha(0.3),
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

      {/* Layer Picker Overlay */}
      <AnimatePresence>
        {showLayerPicker && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 10 }}
            className="absolute top-24 right-[22rem] z-50 w-64 bg-black/80 backdrop-blur-3xl border border-white/5 rounded-3xl p-6 shadow-2xl"
          >
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6 flex items-center gap-2">
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
                    currentLayer === layer.id ? 'bg-[#FACC15] text-black shadow-lg shadow-[#FACC15]/20' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <layer.icon size={14} />
                    <span className="text-[10px] font-black uppercase tracking-tight">{layer.label}</span>
                  </div>
                  <span className={`text-[8px] font-bold uppercase ${currentLayer === layer.id ? 'text-black/80' : 'text-white/20'}`}>{layer.desc}</span>
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
            initial={{ opacity: 0, scale: 0.95, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 10 }}
            className="absolute top-24 right-[22rem] z-50 w-64 bg-black/80 backdrop-blur-3xl border border-white/5 rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Visual Settings</h3>
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
                    <s.icon size={14} className="text-[#FACC15] opacity-50 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] font-black text-white/80 uppercase tracking-tight">{s.label}</span>
                  </div>
                  <button 
                    onClick={() => setVisualSettings(prev => ({ ...prev, [s.key]: !prev[s.key as keyof typeof visualSettings] }))}
                    className={`w-10 h-5 rounded-full transition-all relative ${visualSettings[s.key as keyof typeof visualSettings] ? 'bg-[#FACC15]' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${visualSettings[s.key as keyof typeof visualSettings] ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Technical Sidebar (Left) */}
      <div className={`absolute left-6 top-24 bottom-6 z-40 w-80 pointer-events-none transition-all duration-500 ease-in-out ${
        showSidebar ? 'translate-x-0' : '-translate-x-[calc(100%+40px)]'
      }`}>
        <motion.div className="h-full bg-black/80 shadow-2xl backdrop-blur-3xl rounded-[2.5rem] border border-white/5 p-8 flex flex-col pointer-events-auto overflow-hidden relative">
          {/* Status Rings */}
          <div className="absolute -top-20 -left-20 w-40 h-40 border border-[#FACC15]/5 rounded-full animate-spin-slow pointer-events-none" />
          <div className="absolute -top-10 -left-10 w-20 h-20 border border-[#FACC15]/2 rounded-full animate-reverse-spin pointer-events-none" />

          {/* Sidebar Header */}
          <div className="mb-8 pl-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FACC15]/80 mb-1 font-space italic">Stargaze Intelligence</h2>
            <p className="text-[18px] font-black uppercase tracking-tight text-white leading-none">Event Tracker</p>
          </div>

          {/* Tabs */}
          <div className="space-y-3 mb-10 overflow-y-auto custom-scrollbar pr-2">
            {[
              { id: 'meteors', icon: Sparkles, label: 'Celestial', desc: 'Active & Upcoming Meteor Showers', color: 'orange' },
              { id: 'satellites', icon: Satellite, label: 'Orbital', desc: 'Active Satellite Passages', color: 'green' },
              { id: 'debris', icon: Trash2, label: 'Hazardous', desc: 'Re-entry & Debris Risks', color: 'red' },
              { id: 'ufo', icon: Eye, label: 'Anomalies', desc: 'Unknown & Transient Events', color: 'slate' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full group relative p-5 rounded-3xl transition-all duration-400 border ${
                  activeTab === tab.id 
                    ? 'bg-white/[0.05] shadow-[0_10px_30px_rgba(250,204,21,0.08)] border-[#FACC15]/20' 
                    : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    activeTab === tab.id ? 'bg-[#FACC15] text-black shadow-lg' : 'bg-white/5 text-white/40 group-hover:text-[#FACC15]'
                  }`}>
                    <tab.icon size={18} />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`text-[11px] font-black uppercase tracking-widest ${activeTab === tab.id ? 'text-white' : 'text-white/80'}`}>
                      {tab.label}
                    </p>
                    <p className="text-[9px] text-white/30 font-bold uppercase tracking-tight mt-1">{tab.desc}</p>
                  </div>
                  {tab.id === 'satellites' && (
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[10px] font-mono font-bold text-[#FACC15]">{satellites.length}</span>
                      <div className="flex gap-0.5">
                        <div className="w-1 h-1 bg-[#FACC15] rounded-full animate-pulse" />
                        <div className="w-1 h-1 bg-[#FACC15]/30 rounded-full" />
                        <div className="w-1 h-1 bg-[#FACC15]/30 rounded-full" />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* HUD Section */}
          <div className="mt-auto space-y-6 pt-6 border-t border-white/5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Active Showers</p>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#FACC15] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                  <span className="text-[10px] font-black uppercase text-[#FACC15]">{meteorShowersData.filter(s => {
                    const now = new Date();
                    return now >= new Date(s.start) && now <= new Date(s.end);
                  }).length} Live</span>
                </div>
              </div>
              <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 text-right">
                <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Observation</p>
                <span className="text-[10px] font-black uppercase text-white/60">Optimal</span>
              </div>
            </div>
            
            <button 
              onClick={() => fetchData()}
              disabled={loading}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 group"
            >
              <RefreshCw size={14} className={`text-[#FACC15] ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 group-hover:text-white">Refresh Orbital Layer</span>
            </button>
          </div>
        </motion.div>

        {/* Toggle Hook */}
        <button 
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute top-1/2 -right-12 -translate-y-1/2 w-8 h-20 bg-black/80 shadow-xl backdrop-blur-xl border border-white/5 border-l-0 rounded-r-2xl pointer-events-auto flex items-center justify-center text-white/30 hover:text-[#FACC15] transition-colors"
        >
          <ChevronRight size={18} className={`transition-transform duration-500 ${showSidebar ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Command Sidebar (Right) */}
      <div className={`absolute right-6 top-24 bottom-6 z-40 w-80 pointer-events-none transition-all duration-500 ease-in-out ${
        showRightSidebar ? 'translate-x-0' : 'translate-x-[calc(100%+40px)]'
      }`}>
        <motion.div className="h-full bg-black/80 shadow-2xl backdrop-blur-3xl rounded-[2.5rem] border border-white/5 p-8 flex flex-col pointer-events-auto relative">
          {/* Logo / Title Section */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center text-[#FACC15]">
              <Globe size={24} className="animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black uppercase tracking-[0.2em] leading-none text-white whitespace-nowrap">STARGAZE<span className="text-[#FACC15]">.EVENTS</span></h1>
              <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Celestial Observation Hub</span>
            </div>
          </div>

          {/* Search Section */}
          <div className="space-y-4 mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 px-2">Global Search</h3>
            <div className="relative group">
              <form onSubmit={handleSearch} className="relative">
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Meteor, Satellite, Event..."
                  className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-12 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FACC15]/20 transition-all placeholder:text-white/20 text-white"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FACC15] animate-spin" size={18} />}
              </form>
              
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-black/95 backdrop-blur-3xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl z-[60]"
                  >
                    {searchResults.map((res: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (res.type === 'location') {
                            flyToLocation(parseFloat(res.lat), parseFloat(res.lon), 50000);
                            setSearchQuery(res.display_name);
                          } else {
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
                          <MapIcon size={14} className="text-[#FACC15] mt-1 flex-shrink-0" />
                        ) : (
                          <Satellite size={14} className={res.type === 'debris' ? "text-red-500 mt-1 flex-shrink-0" : "text-[#FACC15] mt-1 flex-shrink-0"} />
                        )}
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-xs font-bold text-white truncate">{res.type === 'location' ? res.display_name : res.name}</span>
                          <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{res.type}</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Action Controls Section */}
          <div className="space-y-4 mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 px-2">Navigation Controls</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowLayerPicker(!showLayerPicker)}
                className={`h-16 flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all ${showLayerPicker ? 'bg-[#FACC15]/10 border-[#FACC15] text-[#FACC15]' : 'bg-white/5 border-transparent text-white/40 hover:text-white'}`}
              >
                <Layers size={18} />
                <span className="text-[8px] font-black uppercase tracking-widest">Layers</span>
              </button>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`h-16 flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all ${showSettings ? 'bg-[#FACC15]/10 border-[#FACC15] text-[#FACC15]' : 'bg-white/5 border-transparent text-white/40 hover:text-white'}`}
              >
                <Settings size={18} />
                <span className="text-[8px] font-black uppercase tracking-widest">Settings</span>
              </button>
              <button 
                onClick={() => {
                  if (viewerRef.current) {
                    viewerRef.current.camera.flyTo({
                      destination: viewerRef.current.camera.position,
                      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
                      duration: 1.5
                    });
                  }
                }}
                className="h-16 flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/5 border border-transparent text-white/40 hover:text-white transition-all"
                title="Reset to North"
              >
                <Navigation size={18} />
                <span className="text-[8px] font-black uppercase tracking-widest">Compass</span>
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => { if (viewerRef.current) viewerRef.current.camera.zoomIn(viewerRef.current.camera.positionCartographic.height * 0.3); }}
                  className="flex-1 h-16 bg-white/5 border border-transparent rounded-2xl flex items-center justify-center text-xl font-black text-white/40 hover:text-white transition-all"
                >
                  +
                </button>
                <button 
                  onClick={() => { if (viewerRef.current) viewerRef.current.camera.zoomOut(viewerRef.current.camera.positionCartographic.height * 0.4); }}
                  className="flex-1 h-16 bg-white/5 border border-transparent rounded-2xl flex items-center justify-center text-xl font-black text-white/40 hover:text-white transition-all"
                >
                  -
                </button>
              </div>
            </div>
          </div>

          {/* Observation Details Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar -mx-4 px-4 space-y-4">
            <AnimatePresence mode="wait">
              {selectedSatellite && (
                <motion.div
                  key="satellite-info"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 text-white relative"
                >
                  <button 
                    onClick={() => setSelectedSatellite(null)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-white"
                  >
                    <CloseIcon size={14} />
                  </button>

                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      debris?.some(d => d.name === selectedSatellite.name) ? 'bg-red-500/20 text-red-400' : 'bg-[#FACC15]/20 text-[#FACC15]'
                    }`}>
                      <Satellite size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-black text-sm uppercase tracking-tight truncate">{selectedSatellite.name}</h3>
                      <p className={`text-[8px] uppercase tracking-widest font-black mt-1 ${
                        debris?.some(d => d.name === selectedSatellite.name) ? 'text-red-400' : 'text-[#FACC15]'
                      }`}>
                        {debris?.some(d => d.name === selectedSatellite.name) ? 'ORBITAL HAZARD' : 'VERIFIED SIGNAL'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[7px] text-white/30 font-bold uppercase mb-1">Inclination</p>
                          <p className="text-xs font-black font-mono text-[#FACC15]">{selectedSatellite.inclination?.toFixed(3)}°</p>
                        </div>
                        <div>
                          <p className="text-[7px] text-white/30 font-bold uppercase mb-1">Eccentricity</p>
                          <p className="text-xs font-black font-mono text-white">{selectedSatellite.eccentricity?.toFixed(4)}</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        const newState = !isLockedOnSelected;
                        setIsLockedOnSelected(newState);
                        if (viewerRef.current) {
                          if (newState) {
                            const entity = entitiesRef.current.find(e => e.name === selectedSatellite.name);
                            if (entity) viewerRef.current.trackedEntity = entity;
                          } else {
                            viewerRef.current.trackedEntity = undefined;
                          }
                        }
                      }}
                      className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 border ${
                        isLockedOnSelected ? 'bg-[#FACC15] text-black border-[#FACC15]' : 'bg-white/5 text-white/60 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      <Navigation size={12} className={isLockedOnSelected ? 'animate-pulse' : ''} />
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        {isLockedOnSelected ? 'Target Locked' : 'Engage Tracking'}
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}

              {selectedMeteorShower && (
                <motion.div
                  key="meteor-info"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-black/80 backdrop-blur-xl p-6 rounded-3xl border border-[#FACC15]/20 text-white relative"
                >
                  <button onClick={() => setSelectedMeteorShower(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-white">
                    <CloseIcon size={14} />
                  </button>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[#FACC15]/20 text-[#FACC15] flex items-center justify-center">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-tight">{selectedMeteorShower.name}</h3>
                      <p className="text-[8px] text-[#FACC15] uppercase tracking-widest font-black">{selectedMeteorShower.status} EVENT</p>
                    </div>
                  </div>
                                   <div className="space-y-3">
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                         <span className="text-[9px] text-white/40 font-bold uppercase">Zenith Hourly Rate</span>
                         <span className="text-lg font-black text-[#FACC15] font-mono">{selectedMeteorShower.zhr} <span className="text-[8px] opacity-40">ZHR</span></span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div style={{ width: `${Math.min(selectedMeteorShower.zhr, 120) / 1.2}%` }} className="h-full bg-[#FACC15] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <p className="text-[7px] text-white/40 uppercase font-black mb-1">Peak</p>
                        <p className="text-[10px] font-bold text-white/80">{new Date(selectedMeteorShower.peak).toLocaleDateString()}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <p className="text-[7px] text-white/40 uppercase font-black mb-1">Parent Body</p>
                        <p className="text-[10px] font-bold text-white/80">{selectedMeteorShower.parent}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[7px] text-white/40 font-black uppercase mb-2">Spectral Composition</p>
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-[#FACC15] animate-pulse" />
                         <span className="text-[10px] font-bold text-white/90">{selectedMeteorShower.composition}</span>
                      </div>
                    </div>

                    {selectedMeteorShower.historicalStorms && (
                      <div className="p-4 bg-[#FACC15]/5 rounded-2xl border border-[#FACC15]/10">
                        <p className="text-[7px] text-[#FACC15] font-black uppercase mb-1">Historical Context</p>
                        <p className="text-[9px] text-white/60 leading-tight italic">"{selectedMeteorShower.historicalStorms}"</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {selectedUFO && (
                <motion.div
                  key="ufo-info"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-black/80 backdrop-blur-xl p-6 rounded-3xl border border-[#FACC15]/20 text-white relative"
                >
                  <button onClick={() => setSelectedUFO(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-white">
                    <CloseIcon size={14} />
                  </button>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[#FACC15]/20 text-[#FACC15] flex items-center justify-center">
                      <Eye size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-xs uppercase tracking-tight">Signal Analysis</h3>
                      <p className="text-[8px] text-[#FACC15] uppercase tracking-widest font-black">Anomalous</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-white mb-2 italic leading-tight">"{selectedUFO.description}"</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Toggle Hook */}
        <button 
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          className="absolute top-1/2 -left-12 -translate-y-1/2 w-8 h-20 bg-black/60 shadow-xl backdrop-blur-xl border border-white/10 border-r-0 rounded-l-2xl pointer-events-auto flex items-center justify-center text-white/30 hover:text-[#FACC15] transition-colors"
        >
          <ChevronRight size={18} className={`transition-transform duration-500 ${showRightSidebar ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Selected Object HUD (Amazing TheSkyLive Feature) */}
      <AnimatePresence>
        {(selectedSatellite || selectedMeteorShower) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 100 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 w-[450px]"
          >
            <div className="technical-panel p-6 rounded-[2rem] border border-[#FACC15]/30 overflow-hidden relative backdrop-blur-xl bg-black/80">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FACC15] to-transparent opacity-50" />
              
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 font-mono text-[9px] uppercase tracking-widest text-[#FACC15]">
                    <span className="w-1.5 h-1.5 bg-[#FACC15] rounded-full animate-pulse" />
                    Target Identification
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight font-space italic">
                    {selectedSatellite?.name || selectedMeteorShower?.name}
                  </h2>
                </div>
                <button 
                  onClick={() => { setSelectedSatellite(null); setSelectedMeteorShower(null); viewerRef.current!.trackedEntity = undefined; setIsLockedOnSelected(false); }}
                  className="p-2 rounded-full hover:bg-white/10 text-white/40 transition-colors"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                {selectedSatellite ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Orbital Latitude</p>
                      <p className="text-sm font-mono text-[#FACC15]">{ephemeris?.lat?.toFixed(4)}°</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Orbital Longitude</p>
                      <p className="text-sm font-mono text-[#FACC15]">{ephemeris?.lng?.toFixed(4)}°</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Current Altitude</p>
                      <p className="text-sm font-mono text-[#FACC15]">{ephemeris?.alt?.toFixed(1)} km</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Vector Distance</p>
                      <p className="text-sm font-mono text-[#FACC15]">{ephemeris?.dist?.toFixed(0)} km</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Zenith rate</p>
                      <p className="text-sm font-mono text-[#FACC15]">{selectedMeteorShower?.zhr} ZHR</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Constellation</p>
                      <p className="text-sm font-mono text-[#FACC15]">{selectedMeteorShower?.constellation}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Parent Body</p>
                      <p className="text-sm font-mono text-[#FACC15] truncate">{selectedMeteorShower?.parent || 'Unknown'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Entry Speed</p>
                      <p className="text-sm font-mono text-[#FACC15]">{selectedMeteorShower?.speed} km/s</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setIsLockedOnSelected(!isLockedOnSelected)}
                  className={`flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
                    isLockedOnSelected ? 'bg-[#FACC15] border-[#FACC15] text-black' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <Navigation size={14} className={isLockedOnSelected ? 'animate-pulse' : ''} />
                  {isLockedOnSelected ? 'Lock Engaged' : 'Engage Lock'}
                </button>
                <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/60">
                   <ExternalLink size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom HUD Telemetry */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-4xl px-6">
        <AnimatePresence>
          {telemetry && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/80 backdrop-blur-3xl p-6 md:p-8 rounded-[2.5rem] border border-white/10 flex flex-col md:flex-row items-center gap-8 md:gap-16 pointer-events-auto relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#FACC15]/5 to-transparent pointer-events-none" />
              
              <div className="flex flex-col min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-1 bg-[#FACC15] rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-[#FACC15] uppercase tracking-widest">Global Vector</span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase truncate leading-none font-space italic">
                  {telemetry.location}
                </h2>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6 flex-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 w-full md:border-l md:border-white/10 md:pl-8">
                  {[
                    { label: 'Altitude', value: Math.round(telemetry.alt), unit: 'KM', color: 'yellow' },
                    { label: 'Velocity', value: Math.round(telemetry.vel / 3.6).toLocaleString(), unit: 'M/S', color: 'yellow' },
                    { label: 'Latitude', value: telemetry.lat.toFixed(3), unit: 'DEG', color: 'white' },
                    { label: 'Longitude', value: telemetry.lng.toFixed(3), unit: 'DEG', color: 'white' },
                  ].map((item) => (
                    <div key={item.label} className="relative">
                      <p className="text-[7px] text-white/30 uppercase tracking-[0.2em] font-black mb-1">{item.label}</p>
                      <div className="flex items-baseline gap-1">
                        <p className={`text-lg md:text-xl font-black font-mono leading-none ${item.color === 'yellow' ? 'text-[#FACC15]' : 'text-white'}`}>
                          {item.value}
                        </p>
                        <span className="text-[8px] font-bold text-white/20">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => {
                      const newState = !isTrackingIss;
                      setIsTrackingIss(newState);
                      if (viewerRef.current) {
                        if (newState) {
                          const iss = viewerRef.current.entities.getById('ISS_TRACKER');
                          if (iss) viewerRef.current.trackedEntity = iss;
                        } else {
                          viewerRef.current.trackedEntity = undefined;
                        }
                      }
                    }}
                    className={`flex-1 md:w-40 h-14 rounded-2xl flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest border border-white/10 ${
                      isTrackingIss ? 'bg-[#FACC15] text-black border-[#FACC15]' : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    <Activity size={14} className={isTrackingIss ? 'animate-pulse' : ''} />
                    {isTrackingIss ? 'Locked on ISS' : 'Follow ISS'}
                  </button>

                  <button 
                    onClick={() => setShowIssTrail(!showIssTrail)}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border border-white/10 ${
                      showIssTrail ? 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/50' : 'bg-white/5 text-white/20'
                    }`}
                    title="Toggle ISS Trail"
                  >
                    <Navigation size={18} className={showIssTrail ? 'rotate-45' : ''} />
                  </button>
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
                <div className="w-24 h-24 border-2 border-[#FACC15]/20 rounded-full animate-pulse" />
                <div className="absolute inset-0 border-2 border-[#FACC15] border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-4 border border-white/10 rounded-full flex items-center justify-center">
                  <Globe className="text-[#FACC15] animate-pulse" size={24} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-black uppercase tracking-[0.4em] text-xs mb-2">INITIALIZING ORBITAL PROTOCOL</p>
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1 h-1 bg-[#FACC15] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-1 bg-[#FACC15] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-1 bg-[#FACC15] rounded-full animate-bounce" />
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
