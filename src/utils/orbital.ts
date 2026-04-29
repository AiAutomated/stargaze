import * as satellite from 'satellite.js';
import * as Cesium from 'cesium';

export interface SatelliteData {
  name: string;
  line1: string;
  line2: string;
  inclination?: number;
  eccentricity?: number;
  entity?: Cesium.Entity;
}

export const parseTLE = (text: string): SatelliteData[] => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const results: SatelliteData[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('1 ')) {
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

export const calculateOrbitPath = (sat: SatelliteData, durationHours: number, pastHours: number = 0) => {
  const points: Cesium.Cartesian3[] = [];
  try {
    const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
    const now = new Date();
    
    const startMin = -Math.abs(pastHours) * 60;
    const endMin = durationHours * 60;
    
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

export const getRoughLocation = (lat: number, lng: number) => {
  if (lat > 20 && lat < 50 && lng > -130 && lng < -70) return 'NORTH AMERICA';
  if (lat > 35 && lat < 70 && lng > -10 && lng < 40) return 'EUROPE';
  if (lat > -10 && lat < 40 && lng > 10 && lng < 150) return 'AFRICA / ASIA';
  if (lat > -40 && lat < -10 && lng > 110 && lng < 155) return 'AUSTRALIA';
  if (lat > -60 && lat < 15 && lng > -85 && lng < -35) return 'SOUTH AMERICA';
  if (lat < -60) return 'ANTARCTICA';
  
  if (lat > -60 && lat < 60) {
    if (lng > -70 && lng < 20) return 'ATLANTIC OCEAN';
    if (lng > 20 && lng < 100) return 'INDIAN OCEAN';
    if (lng > 100 || lng < -120) return 'PACIFIC OCEAN';
  }
  return 'INTERNATIONAL WATERS';
};
