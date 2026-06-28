/**
 * Component: Planet
 * Simple planet with basic color and optional orbit visualization
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface PlanetProps {
  name: string
  radius: number          // relative visual radius
  distance: number        // AU scaled
  color: number
  orbitSpeed?: number
}

export function Planet({ name, radius, distance, color, orbitSpeed = 0.001 }: PlanetProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)

  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 32, 32), [radius])
  const material = useMemo(() => new THREE.MeshPhongMaterial({ color, shininess: 10 }), [color])

  // Simple circular orbit animation
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += orbitSpeed
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={geometry} material={material} position={[distance, 0, 0]} />
      {/* Simple orbit ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[distance - 0.02, distance + 0.02, 64]} />
        <meshBasicMaterial color={0x334455} side={THREE.DoubleSide} transparent opacity={0.3} />
      </mesh>
    </group>
  )
}
