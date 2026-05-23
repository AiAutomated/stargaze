/**
 * Simulation Store (Zustand)
 * Manages all simulation state: time, celestial positions, UI modes
 */

import { create } from 'zustand'
import { SimulationState } from '@types'

/**
 * Constants
 */
const J2000_EPOCH = 2451545.0 // January 1, 2000, 12:00 TT in Julian Date
const SECONDS_PER_DAY = 86400

/**
 * Helper: Convert Date to Julian Date
 */
function dateToJulianDate(date: Date): number {
  const unixTime = date.getTime()
  const unixEpochJD = 2440587.5 // Jan 1, 1970 as JD
  return unixEpochJD + unixTime / (1000 * SECONDS_PER_DAY)
}

/**
 * Helper: Convert Julian Date to Date
 */
function julianDateToDate(jd: number): Date {
  const unixEpochJD = 2440587.5
  const unixTime = (jd - unixEpochJD) * (1000 * SECONDS_PER_DAY)
  return new Date(unixTime)
}

/**
 * Create Zustand simulation store
 */
export const useSimulation = create<SimulationState>((set, get) => {
  const now = new Date()
  const baseTime = dateToJulianDate(now)

  return {
    // Initial state
    currentTime: baseTime,
    baseTime,
    isPlaying: false,
    playSpeed: 1,
    timeRange: 365.25 * 2, // 2 years

    earthPosition: [0, 0, 0],
    earthRotation: [0, 0, 0],
    issPosition: [0, 0, 0],
    sunPosition: [0, 0, 0],

    selectedShower: null,
    selectedMode: 'explore',
    showLabels: true,
    showOrbits: true,

    // Actions
    setTime: (jd: number) => {
      set({ currentTime: jd })
    },

    setPlaySpeed: (speed: number) => {
      set({ playSpeed: Math.max(0.1, Math.min(speed, 10000)) })
    },

    togglePlayback: () => {
      set((state) => ({ isPlaying: !state.isPlaying }))
    },

    advanceTime: (deltaSeconds: number) => {
      set((state) => {
        if (!state.isPlaying) return {}

        const deltaJD = (deltaSeconds * state.playSpeed) / SECONDS_PER_DAY
        const newTime = state.currentTime + deltaJD

        // Clamp time to reasonable bounds (2 years from base)
        const minTime = state.baseTime - (state.timeRange / 365.25) / 2
        const maxTime = state.baseTime + (state.timeRange / 365.25) / 2

        return {
          currentTime: Math.max(minTime, Math.min(newTime, maxTime)),
        }
      })
    },

    setSelectedShower: (name: string | null) => {
      set({ selectedShower: name })
    },

    setMode: (mode: SimulationState['selectedMode']) => {
      set({ selectedMode: mode })
    },
  }
})

/**
 * Selectors for derived state
 */
export const useCurrentDate = () => {
  const currentTime = useSimulation((state) => state.currentTime)
  return julianDateToDate(currentTime)
}

export const useIsPlaying = () => useSimulation((state) => state.isPlaying)
export const usePlaySpeed = () => useSimulation((state) => state.playSpeed)
export const useEarthPosition = () => useSimulation((state) => state.earthPosition)
export const useSelectedShower = () => useSimulation((state) => state.selectedShower)
export const useSelectedMode = () => useSimulation((state) => state.selectedMode)
