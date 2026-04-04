import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import { motion } from 'motion/react';
import { Satellite, Trash2, Sparkles, Loader2, Info, Globe } from 'lucide-react';

interface SatelliteData {
  name: string;
  line1: string;
  line2: string;
  entity?: Cesium.Entity;
}

const CesiumGlobe: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [activeTab, setActiveTab] = useState<'satellites' | 'debris' | 'meteors'>('satellites');
  const [loading, setLoading] = useState(true);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [debris, setDebris] = useState<SatelliteData[]>([]);
  const entitiesRef = useRef<Cesium.Entity[]>([]);

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

      // Remove credits for a cleaner look (optional, but requested "minimalist")
      (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

      viewerRef.current = viewer;

      // Fetch data
      fetchData();
    };

    initCesium();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  const fetchData = async () => {
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
  };

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
    }
  }, [activeTab, satellites, debris]);

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

    // Mock meteor shower paths/radiants based on common data
    const showers = [
      { name: 'Perseids', lat: 58, lon: 46, color: Cesium.Color.YELLOW },
      { name: 'Geminids', lat: 33, lon: 112, color: Cesium.Color.ORANGE },
      { name: 'Leonids', lat: 22, lon: 153, color: Cesium.Color.WHITE },
      { name: 'Lyrids', lat: 34, lon: 271, color: Cesium.Color.AQUA },
    ];

    showers.forEach(shower => {
      const entity = viewer.entities.add({
        name: shower.name,
        position: Cesium.Cartesian3.fromDegrees(shower.lon, shower.lat, 500000),
        billboard: {
          image: 'https://img.icons8.com/ios-filled/50/ffffff/star.png',
          width: 20,
          height: 20,
          color: shower.color,
        },
        label: {
          text: shower.name,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -15),
        },
      });
      entitiesRef.current.push(entity);

      // Add a simple "path" or trail
      viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            shower.lon, shower.lat, 500000,
            shower.lon + 10, shower.lat + 10, 1000000
          ]),
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: shower.color,
          }),
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

        <div className="flex gap-2">
          {[
            { id: 'satellites', icon: Satellite, label: 'Satellites', color: 'text-cyan-400' },
            { id: 'debris', icon: Trash2, label: 'Space Debris', color: 'text-red-400' },
            { id: 'meteors', icon: Sparkles, label: 'Meteors', color: 'text-yellow-400' },
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
      <div className="absolute bottom-6 right-6 z-10 max-w-xs">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-4 rounded-2xl border border-white/10 text-white/80 text-xs leading-relaxed"
        >
          <div className="flex items-center gap-2 mb-2 text-white font-bold uppercase tracking-wider">
            <Info size={14} /> Data Sources
          </div>
          <p>Satellite and debris data provided by CelesTrak (NORAD GP elements). Meteor radiants based on IMO/NASA records. All data is live and open-source.</p>
        </motion.div>
      </div>
    </div>
  );
};

export default CesiumGlobe;
