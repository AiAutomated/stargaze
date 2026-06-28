/**
 * Component: Sun
 * Renders the Sun at the origin with glow effect
 */

import { useRef, useMemo } from 'react'
import * as THREE from 'three'

interface SunProps {
  scale?: number
}

/**
 * Sun Component
 * Positioned at origin (0, 0, 0) with glow
 */
export function Sun({ scale = 1 }: SunProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Sun geometry and material
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(696000 * scale, 32, 32) // Sun radius with scale
  }, [scale])

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0xfdb813,
      // MeshBasicMaterial is unaffected by lights, making it perfect for self-illuminating Sun
      // The PointLight below provides illumination to other objects
    })
  }, [])

  // Light sources
  const pointLight = useMemo(() => {
    const light = new THREE.PointLight(0xffffff, 2, 0)
    light.intensity = 1
    return light
  }, [])

  return (
    <group>
      {/* Sun mesh */}
      <mesh ref={meshRef} geometry={geometry} material={material} position={[0, 0, 0]}>
        {/* Add glow effect */}
        <SunGlowLayer scale={scale} />
      </mesh>

      {/* Point light at Sun position */}
      <primitive object={pointLight} position={[0, 0, 0]} />
    </group>
  )
}

/**
 * Glow effect around the Sun using billboard geometry
 */
function SunGlowLayer({ scale }: { scale: number }) {
  const glowGeometry = useMemo(() => {
    return new THREE.SphereGeometry(696000 * scale * 1.5, 16, 16)
  }, [scale])

  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0xfdb813) },
        glowPower: { value: 3.0 },
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
          float intensity = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), glowPower);
          gl_FragColor = vec4(glowColor, intensity * 0.5);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    })
  }, [])

  return <mesh geometry={glowGeometry} material={glowMaterial} />
}
