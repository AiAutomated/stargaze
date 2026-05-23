import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Satellite, Trash2, Sparkles, Loader2, Info, Globe, Eye, 
  X as CloseIcon, RefreshCw, AlertCircle, 
  Navigation, Activity, Search, Settings, Sun, Moon, 
  ChevronRight, Layers, Menu, Map as MapIcon, Database, 
  Zap, MapPin, TrendingUp
} from 'lucide-react';

import meteorShowersData from '../data/meteorShowers.json';
import { calculateOrbitPath, getRoughLocation, SatelliteData } from '../utils/orbital';
import { useOrbitalData } from '../hooks/useOrbitalData';

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
  const [activeTab, setActiveTab] = useState<'satellites' | 'debris' | 'meteors' | 'ufo' | 'news'>('news');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteData | null>(null);
  const [selectedMeteorShower, setSelectedMeteorShower] = useState<any | null>(null);
  const [selectedUFO, setSelectedUFO] = useState<any | null>(null);
  
  const [isMobile, setIsMobile] = useState(false);
  const [showMainPanel, setShowMainPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { loading, satellites, debris, issData, news, newsLoading, fetchError, refresh } = useOrbitalData();

  const [currentLayer, setCurrentLayer] = useState<'satellite' | 'street' | 'dark'>('satellite');
  const [visualSettings, setVisualSettings] = useState({
    atmosphere: true,
    nightLights: true,
    stars: true,
    terrain: true,
    grid: false
  });

  const [isTrackingIss, setIsTrackingIss] = useState(false);
  const [isLockedOnSelected, setIsLockedOnSelected] = useState(false);
  const [ephemeris, setEphemeris] = useState<any>(null);

  const entitiesRef = useRef<Cesium.Entity[]>([]);
  const issTrailEntityRef = useRef<Cesium.Entity | null>(null);
  const issGroundTrailRef = useRef<Cesium.Entity | null>(null);
  const trailEntityRef = useRef<Cesium.Entity | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const flyToLocation = useCallback((lat: number, lon: number, height = 2000000) => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
    });
  }, []);

  // --- CORE CESIUM INIT ---
  useEffect(() => {
    if (!containerRef.current) return;
    let viewer: Cesium.Viewer | null = null;
    let handler: Cesium.ScreenSpaceEventHandler | null = null;

    const initCesium = async () => {
      const ionToken = (import.meta as any).env.VITE_CESIUM_ION_TOKEN || '';
      Cesium.Ion.defaultAccessToken = ionToken;

      viewer = new Cesium.Viewer(containerRef.current!, {
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

      if (!isMounted.current || !viewer || !viewer.scene) {
        viewer?.destroy();
        return;
      }

      (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
      viewer.scene.backgroundColor = Cesium.Color.BLACK;
      viewerRef.current = viewer;

      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handlerRef.current = handler;

      // Interaction Handler
      handler.setInputAction((movement: any) => {
        if (!viewer || viewer.isDestroyed()) return;
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
          const entity = pickedObject.id;
          const props = entity.properties?.getValue(Cesium.JulianDate.now());
          
          if (props?.type === 'meteor') {
            setSelectedMeteorShower(props.data);
            setSelectedSatellite(null);
            setSelectedUFO(null);
            viewer.trackedEntity = undefined;
          } else if (props?.type === 'ufo') {
            setSelectedUFO(props.data);
            setSelectedSatellite(null);
            setSelectedMeteorShower(null);
            viewer.trackedEntity = undefined;
          } else if (props?.line1 && props?.line2) {
            setSelectedSatellite(props);
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
    };

    initCesium();

    return () => {
      if (handler) handler.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      handlerRef.current = null;
    };
  }, []);

  // --- ENGINE UPDATES (Layers, Settings, Telemetry) ---
  useEffect(() => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
    const viewer = viewerRef.current;
    
    if (viewer.scene && !viewer.isDestroyed()) {
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = visualSettings.atmosphere;
      if (viewer.scene.skyBox) (viewer.scene.skyBox as any).show = visualSettings.stars;
    }

    const updateTerrain = async () => {
      if (!viewer || viewer.isDestroyed()) return;
      if (visualSettings.terrain) {
        try {
          viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(Cesium.IonResource.fromAssetId(1), { requestVertexNormals: true });
        } catch (e) {}
      } else {
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      }
    };
    updateTerrain();
  }, [visualSettings]);

  // --- ISS TRACKING & TELEMETRY ---
  useEffect(() => {
    if (!issData || !viewerRef.current || viewerRef.current.isDestroyed()) return;
    const viewer = viewerRef.current;

    const issEntity = viewer.entities.add({
      id: 'ISS_TRACKER',
      name: 'ISS (ZARYA)',
      point: { pixelSize: 14, color: Cesium.Color.fromCssColorString('#FACC15'), outlineColor: Cesium.Color.WHITE, outlineWidth: 3 },
      label: { 
        text: 'ISS (ZARYA)', 
        font: '900 12px Inter, sans-serif', 
        fillColor: Cesium.Color.BLACK, outlineColor: Cesium.Color.WHITE, outlineWidth: 3, 
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -25) 
      }
    });

    const interval = setInterval(() => {
      const now = new Date();
      try {
        const satrec = satellite.twoline2satrec(issData.line1, issData.line2);
        const positionAndVelocity = satellite.propagate(satrec, now);
        if (typeof positionAndVelocity.position === 'object') {
          const gmst = satellite.gstime(now);
          const positionGd = satellite.eciToGeodetic(positionAndVelocity.position as satellite.EciVec3<number>, gmst);
          const lat = satellite.degreesLat(positionGd.latitude);
          const lng = satellite.degreesLong(positionGd.longitude);
          const alt = positionGd.height;
          
          const v = positionAndVelocity.velocity as satellite.EciVec3<number>;
          const vel = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z) * 3600;

          setTelemetry({ lat, lng, alt, vel, location: getRoughLocation(lat, lng), timestamp: now.toISOString() });
          issEntity.position = Cesium.Cartesian3.fromDegrees(lng, lat, alt * 1000) as any;
          if (isTrackingIss) viewer.trackedEntity = issEntity;
        }
      } catch (e) {}
    }, 1000);

    return () => { 
      clearInterval(interval); 
      if (viewer && !viewer.isDestroyed()) {
        try {
          viewer.entities.remove(issEntity); 
        } catch (e) {}
      }
    };
  }, [issData, isTrackingIss]);

  // --- SEARCH HANDLER ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const searchLow = searchQuery.toLowerCase();
    
    const satMatches = satellites.filter(s => s.name.toLowerCase().includes(searchLow));
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=3`);
    const geoData = await geoRes.json();
    
    setSearchResults([...satMatches.slice(0,3).map(s => ({...s, type: 'satellite'})), ...geoData.map((g:any) => ({...g, type: 'location'}))]);
    setIsSearching(false);
  };

  const locations = useMemo(() => [
    { name: 'Roswell, NM', lat: 33.3943, lon: -104.5230, description: 'Famous 1947 crash site' },
    { name: 'Area 51, NV', lat: 37.2431, lon: -115.7930, description: 'Classified Groom Lake facility' },
    { name: 'Rendlesham Forest, UK', lat: 52.0911, lon: 1.4392, description: '1980 binary code detection' },
    { name: 'Phoenix, AZ', lat: 33.4484, lon: -112.0740, description: '1997 "Phoenix Lights" formation' },
  ], []);

  // --- LAYER UPDATER ---
  useEffect(() => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
    const viewer = viewerRef.current;
    const updateLayer = async () => {
      if (viewer.isDestroyed()) return;
      viewer.imageryLayers.removeAll();
      let provider;
      if (currentLayer === 'street') provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer');
      else if (currentLayer === 'dark') provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer');
      else provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer');
      
      if (!viewer.isDestroyed()) {
        viewer.imageryLayers.addImageryProvider(provider);
      }
    };
    updateLayer();
  }, [currentLayer]);

  // --- ENTITY RENDERER ---
  const renderEntities = useCallback(() => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
    const viewer = viewerRef.current;
    
    entitiesRef.current.forEach(e => {
      try {
        if (!viewer.isDestroyed()) viewer.entities.remove(e);
      } catch (e) {}
    });
    entitiesRef.current = [];

    if (activeTab === 'satellites' || activeTab === 'debris') {
      const data = activeTab === 'satellites' ? satellites : debris;
      data.slice(0, 300).forEach(sat => {
        const now = new Date();
        try {
          const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
          const p = satellite.propagate(satrec, now).position;
          if (typeof p === 'object') {
            const gmst = satellite.gstime(now);
            const gd = satellite.eciToGeodetic(p as any, gmst);
            const entity = viewer.entities.add({
              name: sat.name,
              position: Cesium.Cartesian3.fromDegrees(satellite.degreesLong(gd.longitude), satellite.degreesLat(gd.latitude), gd.height * 1000),
              point: { pixelSize: 6, color: activeTab === 'satellites' ? Cesium.Color.fromCssColorString('#FACC15') : Cesium.Color.RED, outlineWidth: 1 },
              properties: new Cesium.PropertyBag({...sat, type: activeTab})
            });
            entitiesRef.current.push(entity);
          }
        } catch(e){}
      });
    }

    if (activeTab === 'meteors') {
      meteorShowersData.forEach(shower => {
        const entity = viewer.entities.add({
          name: shower.name,
          position: Cesium.Cartesian3.fromDegrees(shower.constellation === 'Perseus' ? 48 : 271, 58, 100000) as any, // Simplified radiant coord logic
          point: { pixelSize: 12, color: Cesium.Color.fromCssColorString('#FACC15'), outlineWidth: 3, outlineColor: Cesium.Color.WHITE },
          properties: new Cesium.PropertyBag({type: 'meteor', data: shower})
        });
        entitiesRef.current.push(entity);
      });
    }

    if (activeTab === 'ufo') {
      locations.forEach(loc => {
        const entity = viewer.entities.add({
          name: loc.name,
          position: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat, 50000),
          point: { pixelSize: 10, color: Cesium.Color.CYAN, outlineWidth: 2 },
          properties: new Cesium.PropertyBag({type: 'ufo', data: loc})
        });
        entitiesRef.current.push(entity);
      });
    }
  }, [activeTab, satellites, debris, locations]);

  useEffect(() => { renderEntities(); }, [renderEntities]);

  return (
    <div className="fixed inset-0 z-0 bg-[#050505] overflow-hidden select-none font-sans text-white">
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* --- TOP HUD (Search & Status) --- */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-start justify-between pointer-events-none z-50">
        <div className="flex flex-col gap-4 pointer-events-auto">
          <div className="flex items-center gap-4 bg-black/60 backdrop-blur-2xl p-4 rounded-3xl border border-white/5 shadow-2xl">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-black shadow-lg">
              <Globe size={20} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black uppercase tracking-tighter italic">Stargaze</h1>
              <p className="text-[8px] text-white/30 font-black uppercase tracking-[0.3em]">Orbital Intelligence</p>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-lg mx-6 pointer-events-auto relative group">
           <form onSubmit={handleSearch} className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Identify Object or Coordinate..."
                className="w-full bg-black/40 backdrop-blur-3xl border border-white/5 h-14 rounded-full px-12 text-sm focus:outline-none focus:bg-black/60 transition-all placeholder:text-white/20 italic"
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              {isSearching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-[#FACC15]" size={16} />}
           </form>
           <AnimatePresence>
             {searchResults.length > 0 && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: 10 }}
                 className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-3xl border border-white/5 rounded-[32px] overflow-hidden shadow-2xl"
               >
                 {searchResults.map((res: any, idx: number) => (
                   <button 
                     key={idx}
                     onClick={() => {
                        if (res.type === 'location') flyToLocation(parseFloat(res.lat), parseFloat(res.lon));
                        setSearchResults([]);
                        setSearchQuery('');
                     }}
                     className="w-full text-left p-4 hover:bg-white/5 flex items-center gap-4 border-b border-white/5 last:border-0 transition-colors"
                   >
                     <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                        <MapPin size={14} className="text-white/40" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-xs font-bold truncate">{res.display_name || res.name}</span>
                        <span className="text-[8px] uppercase tracking-widest text-white/30">{res.type}</span>
                     </div>
                   </button>
                 ))}
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
      {/* Layer Picker Overlay */}
      <AnimatePresence>
        {showLayerPicker && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute top-24 right-24 z-[120] w-64 bg-black/80 backdrop-blur-3xl border border-white/5 rounded-[32px] p-6 shadow-2xl"
          >
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-6">Map Vision</h3>
            <div className="space-y-2">
              {[
                { id: 'satellite', label: 'Orbital View', icon: Globe },
                { id: 'street', label: 'Atlas Vector', icon: Navigation },
                { id: 'dark', label: 'Low Light', icon: Moon },
              ].map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => {
                    setCurrentLayer(layer.id as any);
                    setShowLayerPicker(false);
                  }}
                  className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                    currentLayer === layer.id ? 'bg-[#FACC15] text-black shadow-lg shadow-[#FACC15]/20' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <layer.icon size={16} />
                  <span className="text-[10px] font-black uppercase tracking-tight">{layer.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${showSettings ? 'bg-[#FACC15] text-black shadow-[0_0_20px_#FACC1555]' : 'bg-black/40 backdrop-blur-2xl border border-white/5 text-white/40 hover:text-white'}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* --- SELECTED OBJECT HUD --- */}
      <AnimatePresence>
        {(selectedSatellite || selectedMeteorShower || selectedUFO) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] sm:w-[480px]"
          >
            <div className="bg-black/60 backdrop-blur-3xl p-10 rounded-[48px] border border-white/10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FACC15]/40 to-transparent" />
              
              <div className="flex items-start justify-between mb-8">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 bg-[#FACC15] rounded-full animate-pulse shadow-[0_0_10px_#FACC15]" />
                    <span className="text-[10px] text-white/40 font-black uppercase tracking-[0.4em]">Target Identified</span>
                  </div>
                  <h2 className="text-3xl font-bold text-white uppercase tracking-tighter italic leading-none truncate pr-8">
                    {selectedSatellite?.name || selectedMeteorShower?.name || selectedUFO?.name}
                  </h2>
                </div>
                <button 
                  onClick={() => { setSelectedSatellite(null); setSelectedMeteorShower(null); setSelectedUFO(null); if (viewerRef.current) viewerRef.current.trackedEntity = undefined; }}
                  className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-10 border-y border-white/5 py-8">
                <div className="space-y-1">
                   <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">Classification</p>
                   <p className="text-xs font-black uppercase text-[#FACC15] italic">{selectedSatellite ? 'Orbital Node' : selectedMeteorShower ? 'Celestial Event' : 'Unidentified'}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">Status</p>
                   <p className="text-xs font-black uppercase text-green-500 italic">Optimal Link</p>
                </div>
                {selectedSatellite && (
                  <>
                    <div className="space-y-1">
                      <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">Inclination</p>
                      <p className="text-xs font-black font-mono">{selectedSatellite.inclination?.toFixed(2)}°</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">NORAD ID</p>
                      <p className="text-xs font-black font-mono">{selectedSatellite.line1?.substring(2, 7)}</p>
                    </div>
                  </>
                )}
                {selectedMeteorShower && (
                  <>
                    <div className="space-y-1">
                      <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">Intensity</p>
                      <p className="text-xs font-black font-mono">{selectedMeteorShower.zhr} ZHR</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] text-white/20 uppercase font-black tracking-widest">Peak Date</p>
                      <p className="text-xs font-black font-mono">{new Date(selectedMeteorShower.peak).toLocaleDateString()}</p>
                    </div>
                  </>
                )}
              </div>

              <button 
                onClick={() => {
                  const s = selectedSatellite || selectedMeteorShower || selectedUFO;
                  if (s && viewerRef.current) {
                    const entity = entitiesRef.current.find(e => e.name === s.name);
                    if (entity) {
                      viewerRef.current.trackedEntity = entity;
                      viewerRef.current.zoomTo(entity, new Cesium.HeadingPitchRange(0, -0.5, 1000000));
                    }
                  }
                }}
                className="w-full h-16 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-[11px] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Activity size={16} />
                Lock Navigation Vector
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FLOATING BOTTOM MENU --- */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 pointer-events-auto">
        <button 
          onClick={() => setShowMainPanel(!showMainPanel)}
          className={`px-8 h-18 rounded-full flex items-center gap-4 transition-all ${showMainPanel ? 'bg-white text-black shadow-2xl' : 'bg-black/60 backdrop-blur-3xl border border-white/10 text-white/60 hover:text-white'}`}
        >
          <Menu size={20} />
          <span className="text-xs font-black uppercase tracking-widest">Discover Events</span>
        </button>

        {!isMobile && telemetry && (
          <div className="bg-black/60 backdrop-blur-3xl border border-white/10 h-18 rounded-full px-8 flex items-center gap-8 shadow-2xl">
              <div className="flex flex-col">
                <span className="text-[8px] text-white/30 uppercase tracking-[0.2em] font-black">ISS Position</span>
                <span className="text-xs font-black uppercase tracking-tight">{telemetry.location}</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[7px] text-white/20 block uppercase">Altitude</span>
                  <span className="text-[10px] font-mono font-bold">{Math.round(telemetry.alt)} KM</span>
                </div>
                <div>
                  <span className="text-[7px] text-white/20 block uppercase">Velocity</span>
                  <span className="text-[10px] font-mono font-bold">{Math.round(telemetry.vel).toLocaleString()} KM/H</span>
                </div>
              </div>
          </div>
        )}
      </div>

      {/* --- DRAWER PANEL (Core Features) --- */}
      <AnimatePresence>
        {showMainPanel && (
          <motion.div 
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 top-0 sm:top-24 z-[110] p-6 pointer-events-none"
          >
            <div className="w-full h-full max-w-5xl mx-auto bg-black/90 backdrop-blur-3xl rounded-[48px] border border-white/5 shadow-[0_-40px_100px_rgba(0,0,0,0.8)] pointer-events-auto overflow-hidden flex flex-col">
               <div className="p-8 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {['news', 'meteors', 'satellites', 'debris', 'ufo'].map((t) => (
                      <button 
                        key={t}
                        onClick={() => setActiveTab(t as any)}
                        className={`text-xs font-black uppercase tracking-[0.2em] pb-2 transition-all relative ${activeTab === t ? 'text-white' : 'text-white/20 hover:text-white/40'}`}
                      >
                        {t}
                        {activeTab === t && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-[#FACC15] rounded-full" />}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowMainPanel(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                    <CloseIcon size={20} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {/* Tab Content... (omitted detailed list for token limit, but implied) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {activeTab === 'satellites' || activeTab === 'debris' ? (
                        (activeTab === 'satellites' ? satellites : debris).slice(0, 50).map((sat, i) => (
                          <button 
                            key={i} 
                            onClick={() => {
                              setSelectedSatellite(sat);
                              setShowMainPanel(false);
                            }}
                            className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/5 transition-all text-left group"
                          >
                            <p className={`text-[8px] font-black uppercase mb-2 tracking-widest ${activeTab === 'satellites' ? 'text-[#FACC15]' : 'text-red-500'}`}>
                              {activeTab === 'satellites' ? 'Orbital Node' : 'Hazardous Debris'}
                            </p>
                            <h4 className="text-sm font-black uppercase truncate group-hover:text-[#FACC15]">{sat.name}</h4>
                            <div className="flex items-center justify-between mt-4">
                               <span className="text-[10px] text-white/30 font-mono">ID: {sat.line1?.substring(2, 7)}</span>
                               <TrendingUp size={12} className="text-white/10 group-hover:text-[#FACC15]" />
                            </div>
                          </button>
                        ))
                     ) : null}
                     {activeTab === 'ufo' && locations.map((loc, i) => (
                        <button 
                          key={i} 
                          onClick={() => {
                            setSelectedUFO(loc);
                            setShowMainPanel(false);
                            flyToLocation(loc.lat, loc.lon, 100000);
                          }}
                          className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/5 transition-all text-left"
                        >
                          <p className="text-[8px] text-cyan-400 font-black uppercase mb-2 tracking-widest">Anomalous Detection</p>
                          <h4 className="text-sm font-black uppercase">{loc.name}</h4>
                          <p className="text-[10px] text-white/30 mt-3 leading-relaxed">{loc.description}</p>
                        </button>
                     ))}
                     {activeTab === 'news' && news.map((item, i) => (
                       <a key={i} href={item.link} target="_blank" rel="noreferrer" className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/5 transition-all flex flex-col justify-between h-full">
                          <div>
                            <p className="text-[8px] text-[#3B82F6] font-black uppercase mb-3 tracking-[0.3em]">Signal Feed</p>
                            <h4 className="text-xs font-black leading-tight">{item.title}</h4>
                          </div>
                          <span className="text-[10px] text-white/20 mt-6">{new Date(item.pubDate).toLocaleDateString()}</span>
                       </a>
                     ))}
                     {activeTab === 'meteors' && meteorShowersData.map((shower, i) => (
                        <button 
                          key={i} 
                          onClick={() => {
                            setSelectedMeteorShower(shower);
                            setShowMainPanel(false);
                            // Fly to a representative radiant point
                            flyToLocation(shower.constellation === 'Perseus' ? 48 : 271, 58, 2000000);
                          }}
                          className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/5 transition-all text-left"
                        >
                          <h4 className="text-sm font-black uppercase mb-1">{shower.name}</h4>
                          <p className="text-[10px] text-[#FACC15] font-black uppercase mb-4">{shower.zhr} ZHR Intensity</p>
                          <p className="text-[9px] text-white/40 leading-relaxed">{shower.constellation} Constellation</p>
                        </button>
                     ))}
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- OVERLAY SETTINGS --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-24 right-10 z-[120] w-72 bg-black/80 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 shadow-2xl">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-8">Simulation Config</h3>
             <div className="space-y-6">
                {Object.entries(visualSettings).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-white/80">{key}</span>
                    <button 
                      onClick={() => setVisualSettings(p => ({...p, [key]: !val}))}
                      className={`w-12 h-6 rounded-full p-1 transition-all ${val ? 'bg-[#FACC15]' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${val ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- LOADING --- */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-95">
             <div className="flex flex-col items-center gap-8">
                <div className="w-16 h-16 border-2 border-white/5 border-t-[#FACC15] rounded-full animate-spin" />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em] animate-pulse italic">Synchronizing Atlas...</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CesiumGlobe;
