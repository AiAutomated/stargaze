/**
 * Orbital Mechanics Library
 * Kepler solver, orbital propagation, and celestial mechanics
 */

import * as THREE from 'three'
import { OrbitalElements } from '@types'

/**
 * Constants
 */
export const AU_TO_METERS = 1.496e11 // Astronomical Unit in meters
export const DEG_TO_RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI
export const EARTH_RADIUS_KM = 6371 // Mean radius

/**
 * Solve Kepler's Equation using Newton-Raphson method
 * Solves: E - e*sin(E) = M for eccentric anomaly E
 *
 * @param M - Mean anomaly (radians)
 * @param e - Eccentricity
 * @param tolerance - Convergence tolerance (default: 1e-10)
 * @returns Eccentric anomaly E (radians)
 */
export function solveKeplersEquation(
  M: number,
  e: number,
  tolerance: number = 1e-10
): number {
  let E = M // Initial guess

  for (let i = 0; i < 100; i++) {
    const sinE = Math.sin(E)
    const cosE = Math.cos(E)

    const f = E - e * sinE - M
    const fPrime = 1 - e * cosE

    const dE = -f / fPrime

    E += dE

    if (Math.abs(dE) < tolerance) {
      break
    }
  }

  return E
}

/**
 * Compute true anomaly from eccentric anomaly
 *
 * @param E - Eccentric anomaly (radians)
 * @param e - Eccentricity
 * @returns True anomaly (radians)
 */
export function trueAnomalyFromEccentric(E: number, e: number): number {
  const sqrt = Math.sqrt((1 + e) / (1 - e))
  const nu = 2 * Math.atan2(sqrt * Math.sin(E / 2), Math.cos(E / 2))
  return nu
}

/**
 * Compute mean anomaly from Julian Date and orbital elements
 *
 * @param jd - Julian Date
 * @param n - Mean motion (degrees/day)
 * @returns Mean anomaly (radians)
 */
export function meanAnomalyAtEpoch(jd: number, n: number): number {
  const J2000_EPOCH = 2451545.0
  const T = jd - J2000_EPOCH
  const M_degrees = (n * T) % 360
  return M_degrees * DEG_TO_RAD
}

/**
 * Apply three Euler rotations to orbital frame coordinates
 * Rotations: argument of perigee (ω), inclination (i), longitude of ascending node (Ω)
 *
 * @param x, y, z - Coordinates in orbital frame
 * @param Omega - Longitude of ascending node (radians)
 * @param i - Inclination (radians)
 * @param omega - Argument of perigee (radians)
 * @returns Rotated vector in inertial frame
 */
export function applyOrbitalRotations(
  x: number,
  y: number,
  z: number,
  Omega: number,
  i: number,
  omega: number
): THREE.Vector3 {
  // First rotation: by argument of perigee (ω) around Z-axis
  const cosOmega = Math.cos(omega)
  const sinOmega = Math.sin(omega)
  const x1 = cosOmega * x - sinOmega * y
  const y1 = sinOmega * x + cosOmega * y
  const z1 = z

  // Second rotation: by inclination (i) around new X-axis
  const cosI = Math.cos(i)
  const sinI = Math.sin(i)
  const x2 = x1
  const y2 = cosI * y1 - sinI * z1
  const z2 = sinI * y1 + cosI * z1

  // Third rotation: by longitude of ascending node (Ω) around Z-axis
  const cosOmega_N = Math.cos(Omega)
  const sinOmega_N = Math.sin(Omega)
  const x3 = cosOmega_N * x2 - sinOmega_N * y2
  const y3 = sinOmega_N * x2 + cosOmega_N * y2
  const z3 = z2

  return new THREE.Vector3(x3, y3, z3)
}

/**
 * Compute orbital position from Keplerian elements and Julian Date
 * Returns position in heliocentric ecliptic coordinates (AU)
 *
 * @param elements - Orbital elements
 * @param jd - Julian Date
 * @returns Position vector in heliocentric coordinates (AU)
 */
export function orbitalPosition(
  elements: OrbitalElements,
  jd: number
): THREE.Vector3 {
  const { a, e, i, Omega, omega, n = 0.01 } = elements

  // Compute mean anomaly
  const M = meanAnomalyAtEpoch(jd, n)

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKeplersEquation(M, e)

  // Compute true anomaly
  const nu = trueAnomalyFromEccentric(E, e)

  // Compute distance from focal point (Kepler's r equation)
  const r = a * (1 - e * Math.cos(E))

  // Orbital frame coordinates
  const x = r * Math.cos(nu)
  const y = r * Math.sin(nu)
  const z = 0

  // Apply three rotations to align with ecliptic plane
  return applyOrbitalRotations(x, y, z, Omega, i, omega)
}

/**
 * Compute Greenwich Mean Sidereal Time (GMST)
 * Used to rotate from inertial (ECI) to Earth-fixed (ECEF) coordinates
 *
 * @param jd - Julian Date
 * @returns GMST in radians (0 to 2π)
 */
export function computeGMST(jd: number): number {
  const J2000_EPOCH = 2451545.0

  // Julian centuries since J2000
  const T = (jd - J2000_EPOCH) / 36525

  // GMST in seconds (USNO Circular 163)
  const gmst_seconds =
    67310.54841 +
    (876600 * 3600 + 8640184.812866) * T +
    0.093104 * T * T -
    (6.2e-6) * T * T * T

  // Convert to hours (0-24)
  const gmst_hours = (gmst_seconds / 3600) % 24

  // Convert to radians
  const gmst_rad = (gmst_hours / 24) * 2 * Math.PI

  return gmst_rad
}

/**
 * Compute Earth's position relative to the Sun at a given Julian Date
 * Uses simplified Kepler equations (Earth's orbit is nearly circular)
 *
 * @param jd - Julian Date
 * @returns Position in heliocentric ecliptic coordinates (AU)
 */
export function earthOrbitalPosition(jd: number): THREE.Vector3 {
  // Earth's mean orbital elements (J2000 epoch)
  const earthElements: OrbitalElements = {
    a: 1.00000261, // AU
    e: 0.01671123,
    i: 0, // ecliptic plane
    Omega: 348.73936 * DEG_TO_RAD,
    omega: 102.94719 * DEG_TO_RAD,
    n: 0.98560025, // mean motion (degrees/day)
  }

  return orbitalPosition(earthElements, jd)
}

/**
 * Compute Earth's rotation (Euler angles)
 * Combines axial tilt and GMST rotation
 *
 * @param jd - Julian Date
 * @returns Euler angles [axialTilt, gmst, 0] in radians
 */
export function earthRotation(jd: number): THREE.Euler {
  const gmst = computeGMST(jd)
  const axialTilt = 23.44 * DEG_TO_RAD // Earth's obliquity

  // Return as Euler angles: (axialTilt around X, gmst around Z, 0)
  return new THREE.Euler(axialTilt, gmst, 0, 'YXZ')
}

/**
 * Check if a point is within a sphere (simple intersection test)
 *
 * @param point - Point in space
 * @param sphereCenter - Center of sphere
 * @param sphereRadius - Radius of sphere
 * @returns True if point is within sphere
 */
export function pointInSphere(
  point: THREE.Vector3,
  sphereCenter: THREE.Vector3,
  sphereRadius: number
): boolean {
  return point.distanceTo(sphereCenter) <= sphereRadius
}

/**
 * Convert from one coordinate system to another
 * ECI (Earth-Centered Inertial) -> ECEF (Earth-Centered Earth-Fixed)
 *
 * @param eciVector - Position in ECI coordinates
 * @param gmst - Greenwich Mean Sidereal Time (radians)
 * @returns Position in ECEF coordinates
 */
export function eciToEcef(eciVector: THREE.Vector3, gmst: number): THREE.Vector3 {
  const cos = Math.cos(-gmst)
  const sin = Math.sin(-gmst)

  return new THREE.Vector3(
    cos * eciVector.x - sin * eciVector.y,
    sin * eciVector.x + cos * eciVector.y,
    eciVector.z
  )
}

/**
 * Convert from ECEF to geodetic coordinates (lat, lon, height)
 *
 * @param ecefVector - Position in ECEF coordinates (meters)
 * @returns { latitude, longitude, height } in degrees and meters
 */
export function ecefToGeodetic(
  ecefVector: THREE.Vector3
): { latitude: number; longitude: number; height: number } {
  const a = 6378137.0 // WGS84 semi-major axis (meters)
  const b = 6356752.314245 // WGS84 semi-minor axis
  const e2 = 1 - (b * b) / (a * a) // First eccentricity squared

  const p = Math.sqrt(ecefVector.x * ecefVector.x + ecefVector.y * ecefVector.y)
  const theta = Math.atan2(ecefVector.z * a, p * b)

  const latitude = Math.atan2(
    ecefVector.z + e2 * a * Math.sin(theta) * Math.sin(theta) * Math.sin(theta),
    p - e2 * a * Math.cos(theta) * Math.cos(theta) * Math.cos(theta)
  )

  const N = a / Math.sqrt(1 - e2 * Math.sin(latitude) * Math.sin(latitude))
  const height = p / Math.cos(latitude) - N

  const longitude = Math.atan2(ecefVector.y, ecefVector.x)

  return {
    latitude: latitude * RAD_TO_DEG,
    longitude: longitude * RAD_TO_DEG,
    height,
  }
}
