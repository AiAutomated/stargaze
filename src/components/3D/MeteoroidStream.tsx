/**
 * Component: MeteoroidStream
 * Volumetric particle system representing a meteor shower debris field
 * Core "Why Simulator" feature — shows the orbital stream Earth passes through
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSimulation } from '@store/simulation'

interface MeteoroidStreamProps {
  showerName: string
  radiantRA: number      // degrees
  radiantDec: number     // degrees
  streamWidth: number    // visual width of the debris band
  particleCount?: number
  color?: number
}

export function MeteoroidStream({
  showerName,
  radiantRA,
  radiantDec,
  streamWidth = 0.8,
  particleCount = 800,
  color = 0x88aaff,
}: MeteoroidStreamProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const { selectedShower, currentTime } = useSimulation()

  const isActive = selectedShower === showerName

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      // Create a toroidal / stream-like distribution around the radiant
      const angle = (i / particleCount) * Math.PI * 2
      const radius = streamWidth * (0.6 + Math.random() * 0.8)

      // Approximate 3D position of the meteoroid stream (simplified)
      const x = Math.cos(angle) * radius * 12 + (Math.random() - 0.5) * 2
      const y = Math.sin(angle) * radius * 4 + (Math.random() - 0.5) * 1.5
      const z = (Math.random() - 0.5) * 3

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      velocities[i * 3] = (Math.random() - 0.5) * 0.002
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.001
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))
    return geo
  }, [particleCount, streamWidth])

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      color,
      size: 0.035,
      transparent: true,
      opacity: isActive ? 0.9 : 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  }, [color, isActive])

  // Gentle animation of the stream
  useFrame(() => {
    if (pointsRef.current && isActive) {
      const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
      const vel = pointsRef.current.geometry.attributes.velocity as THREE.BufferAttribute

      for (let i = 0; i < particleCount; i++) {
        pos.array[i * 3] += vel.array[i * 3]
        pos.array[i * 3 + 1] += vel.array[i * 3 + 1]
        pos.array[i * 3 + 2] += vel.array[i * 3 + 2]

        // Gentle wrapping
        if (Math.abs(pos.array[i * 3]) > 18) pos.array[i * 3] *= -0.95
      }
      pos.needsUpdate = true
    }
  })

  if (!isActive) return null

  return (
    <points ref={pointsRef} geometry={geometry} material={material} />
  )
}