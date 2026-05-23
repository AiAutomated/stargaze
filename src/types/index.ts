/**
 * Stargaze Type Definitions
 * Core types for the 4D solar system explorer
 */

import * as THREE from 'three'

/**
 * Simulation State
 */
export interface SimulationState {
  // Time management
  currentTime: number // Julian Date
  baseTime: number // Reference epoch
  isPlaying: boolean
  playSpeed: number // multiplier (1x, 10x, 100x)
  timeRange: number // days (default: 365.25 * 2 for 2 years)

  // Calculated celestial positions
  earthPosition: [number, number, number]
  earthRotation: [number, number, number]
  issPosition: [number, number, number]
  sunPosition: [number, number, number]

  // UI State
  selectedShower: string | null
  selectedMode: 'explore' | 'meteors' | 'iss' | 'orbital' | 'timeline'
  showLabels: boolean
  showOrbits: boolean

  // Actions
  setTime: (jd: number) => void
  setPlaySpeed: (speed: number) => void
  togglePlayback: () => void
  advanceTime: (deltaSeconds: number) => void
  setSelectedShower: (name: string | null) => void
  setMode: (mode: SimulationState['selectedMode']) => void
}

/**
 * Camera Control Modes
 */
export type CameraMode = 'free-orbit' | 'earth-locked' | 'object-locked' | 'top-down'

export interface CameraState {
  mode: CameraMode
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
  zoomLevel: number
}

/**
 * Meteor Shower Data
 */
export interface MeteorShowerData {
  id: string
  name: string
  parentComet: string
  radiationConstellation: string
  peakDate: {
    month: number
    day: number
  }
  peakZHR: number // Zenithal Hourly Rate
  peakSpeed: number // km/s
  duration: number // days
  orbitalElements: OrbitalElements
  color: {
    r: number
    g: number
    b: number
  }
}

/**
 * Keplerian Orbital Elements
 */
export interface OrbitalElements {
  a: number // Semi-major axis (AU)
  e: number // Eccentricity
  i: number // Inclination (radians)
  Omega: number // Longitude of ascending node (radians)
  omega: number // Argument of perigee (radians)
  M?: number // Mean anomaly (radians, computed if not provided)
  n?: number // Mean motion (degrees/day)
}

/**
 * ISS Telemetry
 */
export interface ISSTelemetry {
  position: THREE.Vector3
  velocity: THREE.Vector3
  altitude: number // km above sea level
  speed: number // km/s
  latitude: number // degrees
  longitude: number // degrees
  nextPassTime?: number // Unix timestamp
  nextPassDuration?: number // seconds
  visibilityQuality?: 'poor' | 'fair' | 'good' | 'excellent'
}

/**
 * Celestial Body
 */
export interface CelestialBody {
  name: string
  position: THREE.Vector3
  velocity: THREE.Vector3
  radius: number // meters
  type: 'planet' | 'satellite' | 'sun' | 'meteoroid'
  orbitalElements?: OrbitalElements
  mass?: number // kg
  color?: [number, number, number]
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  fps: number
  frameTime: number // ms
  memoryUsage: number // MB
  drawCalls: number
  triangles: number
  particleCount: number
}

/**
 * Event Emission for time-based events
 */
export interface TimelineEvent {
  id: string
  type: 'meteor-shower' | 'eclipse' | 'conjunction' | 'opposition'
  name: string
  description: string
  dateTime: number // Julian Date
  duration?: number // minutes
  cameraPosition?: [number, number, number]
  cameraTarget?: [number, number, number]
  narration?: string
}

/**
 * UI State for responsive design
 */
export interface UIState {
  isMobile: boolean
  isTablet: boolean
  sidebarOpen: boolean
  showTelemetry: boolean
  showHelp: boolean
}

/**
 * API Response Types
 */
export interface NASA_HorizonsResponse {
  position: {
    x: number
    y: number
    z: number
  }
  velocity: {
    x: number
    y: number
    z: number
  }
  timestamp: string
}

export interface TwoLineElement {
  line1: string
  line2: string
  epochYear: number
  epochDay: number
}
