/**
 * Component: CameraController
 * Manages camera movement and perspective modes
 */

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEarthAsThreeVector } from '@hooks/useEarthPosition'

interface CameraControllerProps {
  mode?: 'free-orbit' | 'earth-locked' | 'top-down'
  distance?: number
  autoRotate?: boolean
}

/**
 * Free-orbit camera controller
 * Mouse drag to rotate, scroll to zoom
 */
export function CameraController({
  mode = 'free-orbit',
  distance = 2e11, // 2 AU
  autoRotate = false,
}: CameraControllerProps) {
  const { camera } = useThree()
  const earthPosition = useEarthAsThreeVector()

  const state = useRef({
    isDown: false,
    prevX: 0,
    prevY: 0,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    distance,
    autoRotateAngle: 0,
  })

  // Initialize camera
  useEffect(() => {
    const s = state.current
    const x = s.distance * Math.sin(s.phi) * Math.cos(s.theta)
    const y = s.distance * Math.cos(s.phi)
    const z = s.distance * Math.sin(s.phi) * Math.sin(s.theta)

    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
  }, [camera])

  // Handle mouse events
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        state.current.isDown = true
        state.current.prevX = e.clientX
        state.current.prevY = e.clientY
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (state.current.isDown) {
        const dx = e.clientX - state.current.prevX
        const dy = e.clientY - state.current.prevY

        state.current.theta -= dx * 0.01
        state.current.phi -= dy * 0.01

        // Clamp phi to avoid gimbal lock
        state.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, state.current.phi))

        state.current.prevX = e.clientX
        state.current.prevY = e.clientY
      }
    }

    const onMouseUp = () => {
      state.current.isDown = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomSpeed = 1.1
      state.current.distance *= e.deltaY > 0 ? zoomSpeed : 1 / zoomSpeed
      state.current.distance = Math.max(1e10, Math.min(state.current.distance, 1e12))
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  // Animation loop
  useFrame(() => {
    const s = state.current

    // Auto-rotate for exploration
    if (autoRotate) {
      s.autoRotateAngle += 0.0005
      s.theta = s.autoRotateAngle
    }

    let targetX, targetY, targetZ, targetLookX, targetLookY, targetLookZ

    if (mode === 'free-orbit') {
      // Orbital camera around origin
      targetX = s.distance * Math.sin(s.phi) * Math.cos(s.theta)
      targetY = s.distance * Math.cos(s.phi)
      targetZ = s.distance * Math.sin(s.phi) * Math.sin(s.theta)
      targetLookX = 0
      targetLookY = 0
      targetLookZ = 0
    } else if (mode === 'earth-locked') {
      // Camera orbiting around Earth
      const offset = new THREE.Vector3(
        s.distance * Math.sin(s.phi) * Math.cos(s.theta),
        s.distance * Math.cos(s.phi),
        s.distance * Math.sin(s.phi) * Math.sin(s.theta)
      )

      targetX = earthPosition.x + offset.x
      targetY = earthPosition.y + offset.y
      targetZ = earthPosition.z + offset.z
      targetLookX = earthPosition.x
      targetLookY = earthPosition.y
      targetLookZ = earthPosition.z
    } else if (mode === 'top-down') {
      // Top-down view
      targetX = earthPosition.x
      targetY = earthPosition.y + s.distance
      targetZ = earthPosition.z
      targetLookX = earthPosition.x
      targetLookY = earthPosition.y
      targetLookZ = earthPosition.z
    }

    // Smooth camera movement
    const lerpFactor = 0.1
    camera.position.lerp(
      new THREE.Vector3(targetX || 0, targetY || 0, targetZ || 0),
      lerpFactor
    )

    camera.lookAt(targetLookX || 0, targetLookY || 0, targetLookZ || 0)
  })

  return null
}
