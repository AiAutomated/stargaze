/**
 * Hook: useAnimationLoop
 * Drives the animation loop for simulation updates
 * Must be called from within a Canvas context (React Three Fiber)
 */

import { useFrame } from '@react-three/fiber'
import { useSimulation } from '@store/simulation'
import { useEarthPosition } from './useEarthPosition'

/**
 * Main animation loop hook
 * Should be called from a component inside Canvas
 */
export function useAnimationLoop() {
  const { isPlaying, advanceTime } = useSimulation()
  useEarthPosition() // Update Earth position every frame

  useFrame(({ clock }) => {
    if (isPlaying) {
      const deltaSeconds = clock.getDelta()
      advanceTime(deltaSeconds)
    }
  })
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMetrics() {
  const metrics = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
  }

  useFrame(({ gl }) => {
    if (gl.info) {
      metrics.triangles = gl.info.render.triangles
      metrics.drawCalls = gl.info.render.calls
    }
  })

  return metrics
}
