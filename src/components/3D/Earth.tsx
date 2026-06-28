/**
 * Component: Earth
 * Renders a rotating Earth with blue marble texture
 */

import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEarthRotationAsEuler, useEarthAsThreeVector } from '@hooks/useEarthPosition'
import { useSimulation } from '@store/simulation'

interface EarthProps {
  scale?: number
  texturePath?: string
}

/**
 * Earth Component
 * Positioned at the Sun's origin, rotates based on current simulation time
 */
export function Earth({ scale = 1, texturePath = '/textures/earth.jpg' }: EarthProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const rotation = useEarthRotationAsEuler()
  const earthPosition = useEarthAsThreeVector()

  // Create Earth geometry and material
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(6371000 * scale, 64, 64) // Earth radius with scale
  }, [scale])

  const material = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial({
      color: 0x2E5090,           // Ocean blue as base color
      emissive: 0x072534,        // Dark blue glow
      shininess: 5,
      wireframe: false,
    })

    // Load texture asynchronously with error handling
    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(
      texturePath,
      (texture) => {
        // Success: texture loaded
        mat.map = texture
        mat.needsUpdate = true
      },
      undefined,
      (error) => {
        // Error: texture not found, but Earth is still visible with base color
        console.warn('Earth texture not found, using fallback color')
      }
    )

    return mat
  }, [texturePath])

  // Update position and rotation from store every frame
  useFrame(() => {
    if (meshRef.current) {
      // Position is centered at Sun origin (0, 0, 0)
      meshRef.current.position.set(0, 0, 0)

      // Apply Earth's rotation (axial tilt + GMST)
      meshRef.current.rotation.copy(rotation)
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry} material={material}>
      {/* Optional: Add atmosphere layer */}
      <AtmosphereLayer scale={scale} />
    </mesh>
  )
}

/**
 * Simple atmosphere glow layer
 */
function AtmosphereLayer({ scale }: { scale: number }) {
  const atmosphereRef = useRef<THREE.Mesh>(null)

  const atmosphereGeometry = useMemo(() => {
    return new THREE.SphereGeometry(6371000 * scale * 1.05, 32, 32)
  }, [scale])

  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x1e90ff) },
        glowPower: { value: 4.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float glowPower;
        varying vec3 vNormal;

        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), glowPower);
          gl_FragColor = vec4(glowColor, intensity * 0.3);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    })
  }, [])

  return (
    <mesh
      ref={atmosphereRef}
      geometry={atmosphereGeometry}
      material={atmosphereMaterial}
      position={[0, 0, 0]}
    />
  )
}
