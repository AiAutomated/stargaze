/**
 * Component: Scene
 * Main 3D scene that contains all celestial bodies and manages rendering
 */

import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Earth } from './Earth'
import { Sun } from './Sun'
import { CameraController } from './CameraController'
import { useAnimationLoop } from '@hooks/useAnimationLoop'
import { useSelectedMode } from '@store/simulation'

interface SceneProps {
  showOrbits?: boolean
  showLabels?: boolean
  textureBasePath?: string
}

/**
 * Main 3D Scene Wrapper
 */
export function StargazeScene({
  showOrbits = true,
  showLabels = true,
  textureBasePath = '/textures',
}: SceneProps) {
  return (
    <Canvas
      gl={{
        antialias: true,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        powerPreference: 'high-performance',
      }}
      camera={{
        position: [2e11, 1e11, 2e11],
        far: 1e13,
        near: 1e5,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent
        showOrbits={showOrbits}
        showLabels={showLabels}
        textureBasePath={textureBasePath}
      />
    </Canvas>
  )
}

/**
 * Scene content (inside Canvas context)
 */
function SceneContent({
  showOrbits,
  showLabels,
  textureBasePath,
}: SceneProps) {
  const selectedMode = useSelectedMode()
  useAnimationLoop() // Start animation loop

  // Determine camera mode based on selected mode
  let cameraMode: 'free-orbit' | 'earth-locked' | 'top-down' = 'free-orbit'
  if (selectedMode === 'iss' || selectedMode === 'meteors') {
    cameraMode = 'earth-locked'
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={1} distance={1e12} />

      {/* Celestial bodies */}
      <Sun scale={0.1} />
      <Earth scale={0.1} texturePath={`${textureBasePath}/earth.jpg`} />

      {/* Orbital paths (optional) */}
      {showOrbits && <EarthOrbitLine />}

      {/* Camera controller */}
      <CameraController
        mode={cameraMode}
        distance={2e11}
        autoRotate={selectedMode === 'explore'}
      />

      {/* Background */}
      <StarsBackground />
    </>
  )
}

/**
 * Earth's orbital path visualization
 */
function EarthOrbitLine() {
  const lineGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    const segments = 360
    const AU_TO_METERS = 1.496e11
    const earthOrbitRadius = AU_TO_METERS // 1 AU

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const x = Math.cos(angle) * earthOrbitRadius
      const z = Math.sin(angle) * earthOrbitRadius
      points.push(new THREE.Vector3(x, 0, z))
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    return geometry
  }, [])

  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0x4a5f7f,
      linewidth: 1,
      transparent: true,
      opacity: 0.3,
    })
  }, [])

  return <line geometry={lineGeometry} material={lineMaterial} />
}

/**
 * Starfield background
 */
function StarsBackground() {
  const starsGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const starCount = 5000
    const positions = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4e12 // X
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4e12 // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4e12 // Z
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [])

  const starsMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1e9, // Size in world units
      sizeAttenuation: true,
    })
  }, [])

  return <points geometry={starsGeometry} material={starsMaterial} />
}
