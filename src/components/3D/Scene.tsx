/**
 * Component: Scene
 * Fully integrated 4D Solar System with advanced Earth, improved Sun, planets, and meteoroid streams
 */

import { Canvas } from '@react-three/fiber'
import { Earth } from './Earth'
import { Sun } from './Sun'
import { Planet } from './Planet'
import { MeteoroidStream } from './MeteoroidStream'
import { useAnimationLoop } from '@hooks/useAnimationLoop'

export function StargazeScene() {
  return (
    <Canvas
      gl={{ antialias: true, alpha: false, pixelRatio: Math.min(window.devicePixelRatio, 2) }}
      camera={{ position: [0, 0, 5], fov: 55, near: 0.001, far: 200000 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#000011']} />

      {/* Lighting */}
      <ambientLight intensity={0.25} />

      {/* Sun (improved with glow) */}
      <Sun scale={0.0000014} />

      {/* Advanced Earth */}
      <Earth scale={0.00000016} />

      {/* Inner Planets */}
      <Planet name="Mercury" radius={0.12} distance={1.8} color={0xaaaaaa} orbitSpeed={0.004} />
      <Planet name="Venus"   radius={0.18} distance={2.4} color={0xe8c89e} orbitSpeed={0.0025} />
      <Planet name="Mars"    radius={0.14} distance={3.6} color={0xc1440e} orbitSpeed={0.0018} />

      {/* Outer Planets (scaled down for visibility) */}
      <Planet name="Jupiter" radius={0.45} distance={5.8} color={0xd8ca9d} orbitSpeed={0.0006} />
      <Planet name="Saturn"  radius={0.38} distance={7.2} color={0xe8d9a0} orbitSpeed={0.00035} />

      {/* Meteoroid Streams (Perseids + Leonids examples) */}
      <MeteoroidStream
        showerName="Perseids"
        radiantRA={48}
        radiantDec={58}
        streamWidth={1.1}
        particleCount={1200}
        color={0x66ccff}
      />
      <MeteoroidStream
        showerName="Leonids"
        radiantRA={152}
        radiantDec={22}
        streamWidth={0.9}
        particleCount={900}
        color={0xffaa66}
      />

      {/* Animation driver */}
      <AnimationLoop />
    </Canvas>
  )
}

/** Animation loop driver */
function AnimationLoop() {
  useAnimationLoop()
  return null
}
