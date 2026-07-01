// Simplified planet positions using Paul Schlyter's method
// http://www.stjarnhimlen.se/comp/ppcomp.html
// Accuracy: ~1° for dates 1990–2030. Good enough for "visible tonight" widget.

const D = Math.PI / 180;
const s  = (x: number) => Math.sin(x * D);
const c  = (x: number) => Math.cos(x * D);
const a2 = (y: number, x: number) => Math.atan2(y, x) / D;
const rev = (x: number) => x - Math.floor(x / 360) * 360;

// Days since J2000.0 (2000 Jan 1 12:00 UT)
const dJ2000 = () => (Date.now() - 946728000000) / 86400000;

// Eccentric anomaly via Newton-Raphson
function eccAnom(M: number, e: number): number {
  let E = M + (180 / Math.PI) * e * s(M) * (1 + e * c(M));
  for (let i = 0; i < 8; i++) {
    const dE = (M - E + (180 / Math.PI) * e * s(E)) / (1 - e * c(E));
    E += dE;
    if (Math.abs(dE) < 1e-5) break;
  }
  return E;
}

// Planet heliocentric ecliptic rectangular coordinates
function planetPos(N: number, i: number, w: number, a: number, e: number, M: number) {
  M = rev(M);
  const E = eccAnom(M, e);
  const xv = a * (c(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * s(E);
  const v  = a2(yv, xv);
  const r  = Math.sqrt(xv * xv + yv * yv);
  return {
    x: r * (c(N) * c(v + w) - s(N) * s(v + w) * c(i)),
    y: r * (s(N) * c(v + w) + c(N) * s(v + w) * c(i)),
    z: r * s(v + w) * s(i),
  };
}

// Sun position (geocentric ecliptic lon in degrees)
function sunLon(d: number): number {
  const w = 282.9404 + 4.70935e-5 * d;
  const M = rev(356.0470 + 0.9856002585 * d);
  const e = 0.016709 - 1.151e-9 * d;
  const E = eccAnom(M, e);
  const xv = c(E) - e; const yv = Math.sqrt(1 - e * e) * s(E);
  return rev(a2(yv, xv) + w);
}

// Earth heliocentric XY
function earthPos(d: number) {
  const lon = sunLon(d) + 180;
  const w = 282.9404 + 4.70935e-5 * d;
  const M = rev(356.0470 + 0.9856002585 * d);
  const e = 0.016709 - 1.151e-9 * d;
  const E = eccAnom(M, e);
  const xv = c(E) - e; const yv = Math.sqrt(1 - e * e) * s(E);
  const r  = Math.sqrt(xv * xv + yv * yv);
  return { x: r * c(lon), y: r * s(lon), z: 0 };
}

export interface PlanetInfo {
  name:        string;
  symbol:      string;
  color:       string;
  elongation:  number;
  direction:   'east' | 'west';
  visibility:  'evening' | 'morning' | 'night' | 'hidden';
  description: string;
  approxMag?:  number;
}

// Keplerian elements at epoch + daily rates (Schlyter Table 1)
const ELEMENTS = [
  {
    name: 'Mercury', symbol: '☿', color: '#9ca3af',
    N: (d: number) => 48.3313 + 3.24587e-5 * d,
    i: (d: number) => 7.0047 + 5.00e-8 * d,
    w: (d: number) => 29.1241 + 1.01444e-5 * d,
    a: 0.387098, e: (d: number) => 0.205635 + 5.59e-10 * d,
    M: (d: number) => rev(168.6562 + 4.0923344368 * d),
    mag: (r: number, R: number, el: number) => -0.36 + 5 * Math.log10(r * R) + 0.027 * el + 2.2e-13 * Math.pow(el, 6),
  },
  {
    name: 'Venus', symbol: '♀', color: '#fde68a',
    N: (d: number) => 76.6799 + 2.46590e-5 * d,
    i: (d: number) => 3.3946 + 2.75e-8 * d,
    w: (d: number) => 54.8910 + 1.38374e-5 * d,
    a: 0.723330, e: (d: number) => 0.006773 - 1.302e-9 * d,
    M: (d: number) => rev(48.0052 + 1.6021302244 * d),
    mag: (r: number, R: number, el: number) => -4.34 + 5 * Math.log10(r * R) + 0.013 * el + 4.2e-7 * Math.pow(el, 3),
  },
  {
    name: 'Mars', symbol: '♂', color: '#f87171',
    N: (d: number) => 49.5574 + 2.11081e-5 * d,
    i: (d: number) => 1.8497 - 1.78e-8 * d,
    w: (d: number) => 286.5016 + 2.92961e-5 * d,
    a: 1.523688, e: (d: number) => 0.093405 + 2.516e-9 * d,
    M: (d: number) => rev(18.6021 + 0.5240207766 * d),
    mag: (r: number, R: number) => -1.51 + 5 * Math.log10(r * R),
  },
  {
    name: 'Jupiter', symbol: '♃', color: '#fed7aa',
    N: (d: number) => 100.4542 + 2.76854e-5 * d,
    i: (d: number) => 1.3030 - 1.557e-7 * d,
    w: (d: number) => 273.8777 + 1.64505e-5 * d,
    a: 5.20256, e: (d: number) => 0.048498 + 4.469e-9 * d,
    M: (d: number) => rev(19.8950 + 0.0830853001 * d),
    mag: (r: number, R: number) => -9.25 + 5 * Math.log10(r * R),
  },
  {
    name: 'Saturn', symbol: '♄', color: '#c4b68a',
    N: (d: number) => 113.6634 + 2.38980e-5 * d,
    i: (d: number) => 2.4886 - 1.081e-7 * d,
    w: (d: number) => 339.3939 + 2.97661e-5 * d,
    a: 9.55475, e: (d: number) => 0.055546 - 9.499e-9 * d,
    M: (d: number) => rev(316.9670 + 0.0334442282 * d),
    mag: (r: number, R: number) => -9.00 + 5 * Math.log10(r * R),
  },
  {
    name: 'Uranus', symbol: '⛢', color: '#7dd3fc',
    N: (d: number) => 74.0005 + 1.3978e-5 * d,
    i: (d: number) => 0.7733 + 1.9e-8 * d,
    w: (d: number) => 96.6612 + 3.0565e-5 * d,
    a: 19.18171 - 1.55e-8, e: (d: number) => 0.047318 + 7.45e-9 * d,
    M: (d: number) => rev(142.5905 + 0.011725806 * d),
    mag: (r: number, R: number) => -7.15 + 5 * Math.log10(r * R),
  },
] as const;

// Ecliptic obliquity (degrees) at J2000 + drift
const obliquity = (d: number) => 23.4393 - 3.563e-7 * d;

export function getPlanets(): PlanetInfo[] {
  const d  = dJ2000();
  const sL = sunLon(d);
  const E  = earthPos(d);
  const ob = obliquity(d);
  const results: PlanetInfo[] = [];

  for (const el of ELEMENTS) {
    const p  = planetPos(el.N(d), el.i(d), el.w(d), el.a as number, el.e(d), el.M(d));
    // Geocentric ecliptic
    const gx = p.x - E.x;
    const gy = p.y - E.y;
    const gz = p.z - E.z;
    // Geocentric distance (AU)
    const R  = Math.sqrt(gx * gx + gy * gy + gz * gz);
    // Ecliptic → equatorial
    const xeq = gx;
    const yeq = gy * c(ob) - gz * s(ob);
    const zeq = gy * s(ob) + gz * c(ob);
    // RA/Dec
    const RA  = rev(a2(yeq, xeq));
    const Dec = a2(zeq, Math.sqrt(xeq * xeq + yeq * yeq));
    // Ecliptic longitude of planet (approx)
    const pLon = rev(a2(gy, gx));
    // Elongation from Sun
    let elong = rev(pLon - sL);
    const dir: 'east' | 'west' = elong < 180 ? 'east' : 'west';
    if (elong > 180) elong = 360 - elong;

    // Heliocentric distance of planet (for magnitude)
    const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    // Phase angle (approx)
    const phaseAngle = elong; // simplified

    let vis: PlanetInfo['visibility'];
    if (elong < 15)        vis = 'hidden';
    else if (elong < 90)   vis = dir === 'east' ? 'evening' : 'morning';
    else if (elong < 150)  vis = 'night';
    else                   vis = 'night'; // near opposition

    const descMap: Record<PlanetInfo['visibility'], string> = {
      hidden:  'Too close to the Sun — not visible',
      evening: 'Evening sky — look west after sunset',
      morning: 'Morning sky — look east before sunrise',
      night:   'Visible most of the night — rises around sunset',
    };

    // Approx magnitude
    let approxMag: number | undefined;
    try {
      const magFn = (el as any).mag;
      if (magFn) approxMag = parseFloat(magFn(r, R, phaseAngle).toFixed(1));
    } catch {}

    results.push({
      name: el.name,
      symbol: el.symbol,
      color: el.color,
      elongation: Math.round(elong),
      direction: dir,
      visibility: vis,
      description: descMap[vis],
      approxMag,
    });
  }

  return results;
}
