/**
 * Hook: useEarthPosition
 * Computes Earth's position and rotation at a given Julian Date
 */

import { useEffect } from 'react'
import * as THREE from 'three'
import { useSimulation } from '@store/simulation'
import {
  earthOrbitalPosition,
  earthRotation,
  AU_TO_METERS,
} from '@lib/physics/orbital'

/**
 * Updates Earth's position and rotation in the simulation store
 */
export function useEarthPosition() {
  const { currentTime, setTime } = useSimulation()

  useEffect(() => {
    // Compute Earth's heliocentric position (AU)
    const positionAU = earthOrbitalPosition(currentTime)

    // Convert to meters
    const positionMeters: [number, number, number] = [
      positionAU.x * AU_TO_METERS,
      positionAU.y * AU_TO_METERS,
      positionAU.z * AU_TO_METERS,
    ]

    // Compute Earth's rotation
    const rotation = earthRotation(currentTime)
    const rotationEuler: [number, number, number] = [rotation.x, rotation.y, rotation.z]

    // Update store
    useSimulation.setState({
      earthPosition: positionMeters,
      earthRotation: rotationEuler,
    })
  }, [currentTime, setTime])
}

/**
 * Hook: useCurrentDate
 * Returns the current date based on currentTime
 */
export function useCurrentDate(): Date {
  const currentTime = useSimulation((state) => state.currentTime)

  const unixEpochJD = 2440587.5 // Jan 1, 1970 as JD
  const unixTime = (currentTime - unixEpochJD) * (1000 * 86400)
  return new Date(unixTime)
}

/**
 * Hook: useEarthAsThreeVector
 * Returns Earth's position as a Three.Vector3 (useful for 3D components)
 */
export function useEarthAsThreeVector(): THREE.Vector3 {
  const [x, y, z] = useSimulation((state) => state.earthPosition)
  return new THREE.Vector3(x, y, z)
}

/**
 * Hook: useEarthRotationAsEuler
 * Returns Earth's rotation as a Three.Euler
 */
export function useEarthRotationAsEuler(): THREE.Euler {
  const [x, y, z] = useSimulation((state) => state.earthRotation)
  return new THREE.Euler(x, y, z, 'YXZ')
}
