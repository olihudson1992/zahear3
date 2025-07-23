"use client"

import type React from "react"
import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { OrbitControls } from "@react-three/drei"
import { SimplexNoise } from "three-stdlib"

// User controls interface
interface UserControls {
  fire: number
  earth: number
  water: number
  air: number
}

// Internal controls interface
interface ElementControls {
  [key: string]: {
    repelStrength: number
    attractStrength: number
    floatSpeed: number
    floatAmount: number
    gravityStrength: number
    brightness: number
    scale: number
    frozen: boolean
    windStrength?: number
    windDirection?: THREE.Vector3
  }
}

// Audio analysis interface
interface AudioData {
  bass: number
  mid: number
  treble: number
  overall: number
}

// Track interface
interface Track {
  url: string
  name: string
}

const noise = new SimplexNoise()

const tracks: Track[] = [
  { url: "https://rangatracks.b-cdn.net/0_ranga.mp3", name: "0" },
  { url: "https://rangatracks.b-cdn.net/statue%20tracks/CLOUD%20BEAT.mp3", name: "Cloud" },
  {
    url: "https://rangatracks.b-cdn.net/statue%20tracks/30%20min%20dubby%20%5B2025-06-29%20152445%5D.mp3",
    name: "30 mins",
  },
  { url: "https://rangatracks.b-cdn.net/statue%20tracks/WOLLY.mp3", name: "Wolly" },
  { url: "https://rangatracks.b-cdn.net/statue%20tracks/WYRT.mp3", name: "Wyrt" },
]

function ForceAura({
  element,
  forceVector,
  interactionColor,
  currentBackgroundColor,
}: {
  element: string
  forceVector: THREE.Vector3
  interactionColor?: THREE.Color
  currentBackgroundColor?: THREE.Color
}) {
  const meshRef = useRef<THREE.Mesh | THREE.Points>(null)
  const originalPositions = useRef<Float32Array>()

  const auraColorRef = useRef(new THREE.Color())

  useEffect(() => {
    if (interactionColor) {
      auraColorRef.current.copy(interactionColor)
      return
    }

    const baseAuraColor = new THREE.Color(
      element === "fire" ? 0xff4500 : element === "water" ? 0x00bfff : element === "earth" ? 0x8b4513 : 0xffff00,
    )

    if (currentBackgroundColor && (element === "air" || element === "earth")) {
      try {
        // Create a stable color instance only when needed
        const effectiveBackgroundColor = new THREE.Color(
          currentBackgroundColor.r,
          currentBackgroundColor.g,
          currentBackgroundColor.b,
        )

        const bgLuminance = effectiveBackgroundColor.getLuminance()
        const targetColor = new THREE.Color()

        // Adjust HSL based on background luminosity for "inversion"
        const hsl = baseAuraColor.getHSL({ h: 0, s: 0, l: 0 })
        if (bgLuminance < 0.3) {
          // Dark background: make aura brighter and slightly more saturated
          targetColor.setHSL(hsl.h, Math.min(1, hsl.s * 1.2), Math.min(1, hsl.l * 1.5))
        } else if (bgLuminance > 0.7) {
          // Light background: make aura darker and slightly desaturated
          targetColor.setHSL(hsl.h, Math.max(0, hsl.s * 0.8), Math.max(0, hsl.l * 0.5))
        } else {
          // Mid-range background: use base color
          targetColor.copy(baseAuraColor)
        }
        auraColorRef.current.lerp(targetColor, 0.1) // Smooth transition
      } catch (error) {
        console.warn("Failed to calculate luminance, using base color:", error)
        auraColorRef.current.copy(baseAuraColor)
      }
    } else {
      auraColorRef.current.copy(baseAuraColor)
    }
  }, [
    interactionColor,
    element,
    currentBackgroundColor?.r,
    currentBackgroundColor?.g,
    currentBackgroundColor?.b,
    currentBackgroundColor,
  ]) // Only depend on the actual color values, not the object reference

  useEffect(() => {
    if (meshRef.current && meshRef.current.geometry.attributes.position) {
      originalPositions.current = meshRef.current.geometry.attributes.position.array.slice()
    }
  }, [element]) // Re-initialize on element change

  useFrame((state) => {
    if (!meshRef.current || !originalPositions.current) return

    // Special spinning animation for earth cube
    if (element === "earth" && meshRef.current instanceof THREE.Mesh) {
      meshRef.current.rotation.x += 0.01
      meshRef.current.rotation.y += 0.015
      meshRef.current.rotation.z += 0.008
      return // Skip the morphing logic for earth
    }

    const positions = meshRef.current.geometry.attributes.position.array as Float32Array
    const time = state.clock.elapsedTime
    const forceMagnitude = forceVector.length() * 50 // Amplify for visual effect

    // If no force, slowly return to original shape
    if (forceMagnitude < 0.01) {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = THREE.MathUtils.lerp(positions[i], originalPositions.current[i], 0.05)
        positions[i + 1] = THREE.MathUtils.lerp(positions[i + 1], originalPositions.current[i + 1], 0.05)
        positions[i + 2] = THREE.MathUtils.lerp(positions[i + 2], originalPositions.current[i + 2], 0.05)
      }
      meshRef.current.geometry.attributes.position.needsUpdate = true
      if (meshRef.current instanceof THREE.Mesh) {
        meshRef.current.geometry.computeVertexNormals()
      }
      return
    }

    const forceDirection = forceVector.clone().normalize()

    for (let i = 0; i < positions.length; i += 3) {
      const originalVertex = new THREE.Vector3(
        originalPositions.current[i],
        originalPositions.current[i + 1],
        originalPositions.current[i + 2],
      )
      const vertexNormal = originalVertex.clone().normalize()

      let displacement = 0
      const currentVertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2])

      switch (element) {
        case "air":
          // Mist/Swirl: subtle noise, more spread out
          displacement =
            noise.noise3d(
              originalVertex.x * 0.8 + time * 0.5,
              originalVertex.y * 0.8 + time * 0.5,
              originalVertex.z * 0.8 + time * 0.5,
            ) * 0.2
          displacement += forceMagnitude * 0.05 * vertexNormal.dot(forceDirection) // Slight push in force direction
          currentVertex.add(vertexNormal.multiplyScalar(displacement))
          break
        case "water":
          // Fluid Displacement: wave-like motion, increased intensity
          displacement = Math.sin(originalVertex.length() * 5 + time * 2) * 0.3 // Increased from 0.2
          displacement += forceMagnitude * 0.3 * vertexNormal.dot(forceDirection) // Increased from 0.2
          currentVertex.add(vertexNormal.multiplyScalar(displacement))
          break
        case "fire":
          // Flickering Flames: strong upward bias, spiky, increased intensity
          const upwardBias = Math.max(0, vertexNormal.y)
          displacement =
            noise.noise3d(
              originalVertex.x * 1.5 + time * 3,
              originalVertex.y * 1.5 + time * 3,
              originalVertex.z * 1.5 + time * 3,
            ) * 0.8 // Increased from 0.5
          displacement += forceMagnitude * 0.5 * upwardBias * vertexNormal.dot(forceDirection) // Increased from 0.3
          currentVertex.add(vertexNormal.multiplyScalar(displacement))
          break
        case "earth":
          // Jagged/Crystalline: less smooth, more angular
          displacement =
            noise.noise3d(
              originalVertex.x * 2 + time * 0.2,
              originalVertex.y * 2 + time * 0.2,
              originalVertex.z * 2 + time * 0.2,
            ) * 0.15
          displacement += forceMagnitude * 0.08 * vertexNormal.dot(forceDirection)
          currentVertex.add(vertexNormal.multiplyScalar(displacement))
          break
      }

      positions[i] = currentVertex.x
      positions[i + 1] = currentVertex.y
      positions[i + 2] = currentVertex.z
    }

    meshRef.current.geometry.attributes.position.needsUpdate = true
    if (meshRef.current instanceof THREE.Mesh) {
      meshRef.current.geometry.computeVertexNormals()
    }
  })

  if (element === "earth") {
    // Earth as a filled spinning cube with interaction colors
    let earthColor = auraColorRef.current

    // Check for interactions and change color accordingly
    if (interactionColor) {
      earthColor = interactionColor
    }

    return (
      <mesh ref={meshRef as React.MutableRefObject<THREE.Mesh>}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color={earthColor}
          transparent
          opacity={0.6}
          emissive={earthColor}
          emissiveIntensity={0.3}
          wireframe={false}
          depthWrite={false}
        />
      </mesh>
    )
  } else if (element === "air") {
    // Air as a visible silvery sphere with distortions
    const particleCount = 800
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      const r = 1.8 * Math.sqrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }

    return (
      <group>
        {/* Base silvery sphere */}
        <mesh ref={meshRef as React.MutableRefObject<THREE.Mesh>}>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshStandardMaterial
            color={new THREE.Color(0xc0c0c0)}
            transparent
            opacity={0.3}
            emissive={new THREE.Color(0x00ffff)}
            emissiveIntensity={0.2}
            wireframe={false}
            depthWrite={false}
          />
        </mesh>
        {/* Mist particles */}
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <pointsMaterial color={auraColorRef.current} size={0.08} transparent opacity={0.4} depthWrite={false} />
        </points>
      </group>
    )
  } else {
    // Other elements as morphing meshes (unchanged)
    return (
      <mesh ref={meshRef as React.MutableRefObject<THREE.Mesh>}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial
          color={auraColorRef.current}
          transparent
          opacity={element === "fire" ? 0.4 : 0.25}
          emissive={auraColorRef.current}
          emissiveIntensity={0.5}
          wireframe={false}
          depthWrite={false}
        />
      </mesh>
    )
  }
}

function GravityAnchor({ position, strength }: { position: THREE.Vector3; strength: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current && strength > 0) {
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1
      meshRef.current.scale.setScalar(scale * strength * 0.5)
    }
  })

  if (strength === 0) return null

  return (
    <mesh ref={meshRef} position={[position.x, position.y, position.z]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color={0xc0c0c0} transparent opacity={0.5} />
    </mesh>
  )
}

function WindField({ windStrength, windDirection }: { windStrength: number; windDirection: THREE.Vector3 }) {
  const particlesRef = useRef<THREE.Points>(null)
  const particleCount = 100

  useFrame((state) => {
    if (particlesRef.current && windStrength > 0) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
      const time = state.clock.elapsedTime

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        // Move particles in wind direction
        positions[i3] += windDirection.x * windStrength * 0.1
        positions[i3 + 1] += windDirection.y * windStrength * 0.1 + Math.sin(time + i) * 0.02
        positions[i3 + 2] += windDirection.z * windStrength * 0.1

        // Reset particles that go too far
        if (Math.abs(positions[i3]) > 20 || Math.abs(positions[i3 + 1]) > 20 || Math.abs(positions[i3 + 2]) > 20) {
          positions[i3] = (Math.random() - 0.5) * 20
          positions[i3 + 1] = (Math.random() - 0.5) * 20
          positions[i3 + 2] = (Math.random() - 0.5) * 20
        }
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  if (windStrength === 0) return null

  const positions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20
  }

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={0xffffff} size={0.1} transparent opacity={0.3} />
    </points>
  )
}

function Model({
  url,
  position,
  element,
  allObjects,
  controls,
  resetPositions,
  gravityAnchor,
  gravityStrength,
  audioData,
  showAuras,
  lockedElements,
  setLockedElements,
  currentBackgroundColor,
  onModelLoad,
}: {
  url: string
  position: [number, number, number]
  element: "air" | "water" | "fire" | "earth"
  allObjects: React.MutableRefObject<{ [key: string]: THREE.Group | null }>
  controls: ElementControls
  resetPositions: boolean
  gravityAnchor: THREE.Vector3
  gravityStrength: number
  audioData?: AudioData
  showAuras: boolean
  lockedElements: Set<string>
  setLockedElements: React.Dispatch<React.SetStateAction<Set<string>>>
  currentBackgroundColor?: THREE.Color
  onModelLoad?: () => void
}) {
  const { scene, nodes } = useGLTF(url)
  const meshRef = useRef<THREE.Group>(null)
  const originalPosition = useRef(new THREE.Vector3(...position))
  const velocity = useRef(new THREE.Vector3())
  const { camera, gl } = useThree()
  const [netForce, setNetForce] = useState(new THREE.Vector3())
  const [interactionColor, setInteractionColor] = useState<THREE.Color | undefined>(undefined)

  const [isDragging, setIsDragging] = useState(false)

  const handleDoubleClick = useCallback((event: any) => {
    event.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseMove = useCallback(
    (event: any) => {
      if (isDragging && meshRef.current) {
        const plane = new THREE.Plane(
          camera.getWorldDirection(new THREE.Vector3()),
          -meshRef.current.position.dot(camera.getWorldDirection(new THREE.Vector3())),
        )
        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2(
          (event.clientX / window.innerWidth) * 2 - 1,
          -(event.clientY / window.innerHeight) * 2 + 1,
        )
        raycaster.setFromCamera(mouse, camera)
        const intersectPoint = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
          meshRef.current.position.copy(intersectPoint)
        }
      }
    },
    [isDragging, camera],
  )

  useEffect(() => {
    gl.domElement.addEventListener("mousemove", handleMouseMove)
    gl.domElement.addEventListener("mouseup", handleMouseUp)
    return () => {
      gl.domElement.removeEventListener("mousemove", handleMouseMove)
      gl.domElement.removeEventListener("mouseup", handleMouseUp)
    }
  }, [gl.domElement, handleMouseMove, handleMouseUp])

  useEffect(() => {
    if (resetPositions && meshRef.current) {
      meshRef.current.position.copy(originalPosition.current)
      velocity.current.set(0, 0, 0)
    }
  }, [resetPositions])

  useEffect(() => {
    if (meshRef.current) {
      allObjects.current[element] = meshRef.current
    }
  }, [element, allObjects])

  useFrame((state) => {
    if (!meshRef.current || !allObjects.current || !controls[element]) return

    const elementControls = controls[element]
    const isCurrentlyLocked = lockedElements.has(element)

    if (isCurrentlyLocked || isDragging) {
      velocity.current.set(0, 0, 0)
      setNetForce(new THREE.Vector3()) // No force when locked
      return
    }

    // Earth time dilation effect - exponentially slow everything when earth goes left
    const earthValue = controls?.earth?.attractStrength || 0.5
    const earthLeftIntensity = earthValue < 0.5 ? (0.5 - earthValue) * 2 : 0 // 0 to 1 scale
    const timeSlowFactor = Math.pow(0.1, earthLeftIntensity * 0.8) // Exponential slowdown, min 0.1x speed
    const deltaMultiplier = timeSlowFactor

    // Apply time dilation to all movement
    velocity.current.multiplyScalar(deltaMultiplier)

    if (element === "earth" && gravityAnchor && gravityStrength > 0) {
      const targetPosition = gravityAnchor.clone()
      meshRef.current.position.lerp(targetPosition, 0.02)
      velocity.current.set(0, 0, 0)
      setNetForce(new THREE.Vector3())
      return
    }

    const force = new THREE.Vector3()
    const damping = 0.92

    // Wind effects from Air slider
    const windStrength = controls?.air?.windStrength || 0
    const windDirection = controls?.air?.windDirection || new THREE.Vector3(1, 0, 0)
    if (windStrength > 0) {
      const windForce = windDirection.clone().multiplyScalar(windStrength * 0.01)

      // Different elements respond to wind differently
      switch (element) {
        case "air":
          windForce.multiplyScalar(2.0) // Air moves with wind easily
          break
        case "fire":
          windForce.multiplyScalar(1.5) // Fire is pushed by wind
          break
        case "water":
          windForce.multiplyScalar(0.3) // Water resists wind
          break
        case "earth":
          windForce.multiplyScalar(0.1) // Earth barely affected by wind
          break
      }

      force.add(windForce)
    }

    // Enhanced gravity response to audio highs - smoothed
    if (gravityStrength > 0 && gravityAnchor) {
      const direction = new THREE.Vector3().subVectors(gravityAnchor, meshRef.current.position)
      const distance = direction.length()
      direction.normalize()

      // Smoothed audio-enhanced gravity - less jittery
      const audioGravityMultiplier = audioData ? 1 + (audioData.treble + audioData.overall) * 0.8 : 1
      const maxDistance = 25
      // Reduced base gravity strength slightly
      const gravityForce = gravityStrength * Math.exp(-distance * 0.1) * 0.003 * audioGravityMultiplier
      force.add(direction.multiplyScalar(gravityForce))
    }

    // --- Start of new interaction color logic ---
    let newInteractionColor: THREE.Color | undefined = undefined
    const fireElement = allObjects.current["fire"]
    const waterElement = allObjects.current["water"]
    const airElement = allObjects.current["air"]

    // Fire-Water proximity color change: Water slider affects fire color
    if (element === "fire" && waterElement && meshRef.current) {
      const fireWaterDistance = meshRef.current.position.distanceTo(waterElement.position)
      const maxInteractionDistance = 6 // Distance for color interaction
      if (fireWaterDistance < maxInteractionDistance) {
        const waterSliderValue = controls["water"]?.attractStrength || 0.5
        // Red (0xff0000) -> Yellow (0xffff00) -> Light Green (0x90ee90)
        if (waterSliderValue < 0.5) {
          // Red to Yellow
          const t = waterSliderValue * 2 // 0 to 1
          newInteractionColor = new THREE.Color(0xff0000).lerp(new THREE.Color(0xffff00), t)
        } else {
          // Yellow to Light Green
          const t = (waterSliderValue - 0.5) * 2 // 0 to 1
          newInteractionColor = new THREE.Color(0xffff00).lerp(new THREE.Color(0x90ee90), t)
        }
      }
    }

    // Air-Water proximity color change: Air slider affects water color
    if (element === "water" && airElement && meshRef.current) {
      const airWaterDistance = meshRef.current.position.distanceTo(airElement.position)
      const maxInteractionDistance = 6 // Distance for color interaction
      if (airWaterDistance < maxInteractionDistance) {
        const airSliderValue = controls["air"]?.repelStrength || 0
        // Aqua (0x00ffff) to Deep Blue (0x000080)
        const t = Math.min(1, airSliderValue) // Normalize to 0-1
        newInteractionColor = new THREE.Color(0x00ffff).lerp(new THREE.Color(0x000080), t)
      }
    }

    // Earth interaction colors
    if (element === "earth" && meshRef.current) {
      const fireElement = allObjects.current["fire"]
      const airElement = allObjects.current["air"]
      const waterElement = allObjects.current["water"]

      let earthInteractionColor: THREE.Color | undefined = undefined

      // Check fire proximity - earth turns gold/green
      if (fireElement) {
        const earthFireDistance = meshRef.current.position.distanceTo(fireElement.position)
        if (earthFireDistance < 6) {
          earthInteractionColor = new THREE.Color(0xffd700) // Gold
        }
      }

      // Check air proximity - earth turns green
      if (airElement && !earthInteractionColor) {
        const earthAirDistance = meshRef.current.position.distanceTo(airElement.position)
        if (earthAirDistance < 6) {
          earthInteractionColor = new THREE.Color(0x32cd32) // Green
        }
      }

      // Check water proximity - earth turns neon aqua
      if (waterElement) {
        const earthWaterDistance = meshRef.current.position.distanceTo(waterElement.position)
        if (earthWaterDistance < 6) {
          earthInteractionColor = new THREE.Color(0x00ffff) // Neon aqua
        }
      }

      if (earthInteractionColor && !newInteractionColor) {
        newInteractionColor = earthInteractionColor
      }
    }

    setInteractionColor(newInteractionColor)
    // --- End of new interaction color logic ---

    // Element interactions - each element affects others based on their own slider values
    const collisionOptions = {
      air: { mass: 0.1, elasticity: 0.9, friction: 0.05 }, // Very light, bouncy, low friction
      water: { mass: 0.5, elasticity: 0.8, friction: 0.9 }, // Medium mass, more elastic, high friction
      fire: { mass: 0.3, elasticity: 1.0, friction: 0.05 }, // Light, very bouncy, low friction
      earth: { mass: 0.9, elasticity: 0.2, friction: 0.8 }, // Very heavy, low bounce, high friction
    }

    const currentElementProps = collisionOptions[element]

    Object.entries(allObjects.current).forEach(([otherElement, otherMesh]) => {
      if (otherElement === element || !otherMesh || !controls[otherElement]) return

      const distance = meshRef.current.position.distanceTo(otherMesh.position)
      if (distance > 15) return

      const direction = new THREE.Vector3().subVectors(meshRef.current.position, otherMesh.position)
      const directionNormalized = direction.clone().normalize()

      // Enhanced collision system with proper boundaries
      const minDistance = element === "water" ? 1.2 : 1.0 // Water needs slightly more space
      if (distance < minDistance) {
        const overlap = minDistance - distance
        const otherElementProps = collisionOptions[otherElement as keyof typeof collisionOptions]

        // Mass-based collision response with momentum conservation
        const totalMass = currentElementProps.mass + otherElementProps.mass
        const forceRatio = otherElementProps.mass / totalMass
        const pushForce = overlap * 0.08 * forceRatio * currentElementProps.elasticity

        // Directional collision - consider relative velocity
        const relativeVelocity = velocity.current.clone()
        const velocityAlongCollision = relativeVelocity.dot(directionNormalized)

        // Only apply collision force if objects are moving towards each other
        if (velocityAlongCollision < 0) {
          const collisionResponse = directionNormalized
            .clone()
            .multiplyScalar(-velocityAlongCollision * currentElementProps.elasticity * 0.5)
          velocity.current.add(collisionResponse)
        }

        // Friction-based damping
        velocity.current.multiplyScalar(1 - currentElementProps.friction * 0.1)

        force.add(directionNormalized.multiplyScalar(pushForce))
      }

      // Directional element interactions
      if (otherElement === "fire") {
        let fireStrength = controls["fire"].repelStrength || 0
        const waterElement = allObjects.current["water"]
        if (waterElement && element !== "water") {
          const fireWaterDistance = otherMesh.position.distanceTo(waterElement.position)
          const maxDampeningDistance = 8 // Max distance for dampening
          const minDampeningDistance = 1.5 // Min distance for dampening (where locking starts)

          if (fireWaterDistance < maxDampeningDistance) {
            // Water reduces fire's effect
            const reductionFactor = Math.max(
              0,
              (fireWaterDistance - minDampeningDistance) / (maxDampeningDistance - minDampeningDistance),
            )
            fireStrength *= reductionFactor
          }
        }

        if (fireStrength > 0) {
          if (element === "earth" || element === "water") {
            // Fire creates directional heat waves - stronger in front, weaker behind
            const fireDirection = new THREE.Vector3(1, 0.2, 0) // Fire pushes forward and slightly up
            const alignment = directionNormalized.dot(fireDirection)
            const directionalMultiplier = 0.5 + alignment * 0.5 // 0.5 to 1.0 based on direction

            const repelForce = (fireStrength * 0.15 * directionalMultiplier) / Math.max(distance, 0.5)
            force.add(directionNormalized.multiplyScalar(repelForce))
          }
          if (element === "air") {
            // Fire creates updrafts and draws in air from sides
            const fireToAir = directionNormalized.clone()
            const verticalComponent = Math.abs(fireToAir.y)
            const horizontalComponent = Math.sqrt(fireToAir.x * fireToAir.x + fireToAir.z * fireToAir.z)

            if (verticalComponent > 0.5) {
              // Air above fire gets pushed up (updraft)
              const updraftForce = fireStrength * 0.1
              force.y += updraftForce
            } else {
              // Air to the sides gets drawn in
              const attractForce = -(fireStrength * 0.25) / Math.max(distance * distance, 0.05)
              force.add(directionNormalized.multiplyScalar(attractForce))
            }
          }
        }
      }

      // WATER EFFECTS with flow dynamics
      if (otherElement === "water") {
        const waterStrength = controls["water"].attractStrength || 0
        const fireElement = allObjects.current["fire"]

        // Water-Fire Locking Logic
        if (element === "fire" && fireElement && meshRef.current) {
          const fireWaterDistance = meshRef.current.position.distanceTo(waterElement.position)
          const lockThreshold = 1.5 // Distance at which they lock

          if (fireWaterDistance < lockThreshold) {
            // Lock fire and water
            setLockedElements((prev) => new Set(prev).add("fire").add("water"))
          }
        }

        if (waterStrength > 0) {
          if (element === "air" || element === "earth") {
            // Water creates currents - stronger flow in certain directions
            const waterFlow = new THREE.Vector3(0, -0.3, 0.7) // Water flows down and forward
            const flowAlignment = directionNormalized.dot(waterFlow)
            const flowMultiplier = 0.7 + flowAlignment * 0.3

            const attractForce = -(waterStrength * 0.1 * flowMultiplier) / Math.max(distance * distance, 0.1)
            force.add(directionNormalized.multiplyScalar(attractForce))
          }
          // Water no longer repels fire directly, but dampens its forces
        }
      }

      // EARTH EFFECTS with gravitational pull
      if (otherElement === "earth") {
        const earthStrength = controls["earth"].attractStrength || 0
        if (earthStrength > 0) {
          if (element === "fire" || element === "water" || element === "air") {
            // Earth creates strong gravitational wells - much stronger pull
            const earthPull = directionNormalized.clone()
            earthPull.y -= 0.4 // Stronger downward component
            earthPull.normalize()

            const attractForce = -(earthStrength * 0.15) / Math.max(distance * distance, 0.1) // Increased from 0.08
            force.add(earthPull.multiplyScalar(attractForce))
          }
        }
      }

      // AIR EFFECTS with pressure systems and UNLOCKING
      if (otherElement === "air") {
        const airStrength = controls["air"].repelStrength || 0

        // Check if air can unlock fire/water
        if (lockedElements.has("fire") && lockedElements.has("water")) {
          const fireElement = allObjects.current["fire"]
          const waterElement = allObjects.current["water"]
          if (fireElement && waterElement) {
            const airToFireDistance = meshRef.current.position.distanceTo(fireElement.position)
            const airToWaterDistance = meshRef.current.position.distanceTo(waterElement.position)
            const unlockThreshold = 3.0 // Air needs to be close to unlock

            if (airToFireDistance < unlockThreshold || airToWaterDistance < unlockThreshold) {
              setLockedElements(new Set()) // Unlock both
            }
          }
        }

        if (airStrength > 0) {
          // Air creates pressure waves - omnidirectional but with turbulence
          const turbulence = new THREE.Vector3(
            Math.sin(state.clock.elapsedTime * 2 + meshRef.current.position.x) * 0.1,
            Math.sin(state.clock.elapsedTime * 1.5 + meshRef.current.position.y) * 0.1,
            Math.sin(state.clock.elapsedTime * 1.8 + meshRef.current.position.z) * 0.1,
          )

          const pressureDirection = directionNormalized.clone().add(turbulence).normalize()
          const repelForce = (airStrength * 0.08) / Math.max(distance, 0.5)
          force.add(pressureDirection.multiplyScalar(repelForce))

          // Air makes everything more floaty with directional lift
          const liftForce = airStrength * 0.02
          force.y += liftForce
          velocity.current.multiplyScalar(1 + airStrength * 0.1)
        }
      }
    })

    // Exponential boundary forces to prevent floating away
    const maxDistance = 20 // Increased boundary
    const currentDistance = meshRef.current.position.length()
    if (currentDistance > maxDistance) {
      const returnDirection = meshRef.current.position.clone().normalize().multiplyScalar(-1)
      const excessDistance = currentDistance - maxDistance
      const returnForce = Math.pow(excessDistance, 1.5) * 0.01 // Exponential return force
      force.add(returnDirection.multiplyScalar(returnForce))
    }

    // Gentle return force even within boundaries
    if (currentDistance > 10) {
      const returnDirection = meshRef.current.position.clone().normalize().multiplyScalar(-1)
      const gentleReturn = (currentDistance - 10) * 0.001
      force.add(returnDirection.multiplyScalar(gentleReturn))
    }

    velocity.current.add(force)
    velocity.current.multiplyScalar(damping)
    meshRef.current.position.add(velocity.current)
    setNetForce(force)
  })

  const elementControls = controls[element] || {}

  useEffect(() => {
    if (onModelLoad) {
      onModelLoad()
    }
  }, [onModelLoad])

  return (
    <group ref={meshRef} position={position} onDoubleClick={handleDoubleClick}>
      <group scale={1.2}>
        <primitive object={scene} />
        {showAuras && (
          <ForceAura
            element={element}
            forceVector={netForce}
            interactionColor={interactionColor}
            currentBackgroundColor={currentBackgroundColor}
          />
        )}
      </group>
      {element === "fire" && (
        <pointLight
          color={interactionColor || 0xff0000}
          intensity={2 * (elementControls.brightness || 1)}
          distance={8}
          decay={2}
          castShadow
        />
      )}
      {element === "water" && (
        <pointLight
          color={interactionColor || 0x00ff7f}
          intensity={1.5 * (elementControls.brightness || 1)}
          distance={6}
          decay={2}
          castShadow
        />
      )}
      {element === "air" && (
        <pointLight
          color={0xffd700}
          intensity={1.2 * (elementControls.brightness || 1)}
          distance={5}
          decay={2}
          castShadow
        />
      )}
      {element === "earth" && (
        <pointLight
          color={0x8b4513}
          intensity={0.8 * (elementControls.brightness || 1)}
          distance={4}
          decay={2}
          castShadow
        />
      )}
    </group>
  )
}

function Scene({
  controls,
  resetPositions,
  gravityAnchor,
  gravityStrength,
  onGravityAnchorPlace,
  audioEnabled,
  onBackgroundColorChange,
  audioData,
  showAuras,
  lockedElements,
  setLockedElements,
  currentBackgroundColor,
  onModelLoad,
}: {
  controls: ElementControls
  resetPositions: boolean
  gravityAnchor: THREE.Vector3
  gravityStrength: number
  onGravityAnchorPlace: (position: THREE.Vector3) => void
  audioEnabled: boolean
  onBackgroundColorChange: (color: THREE.Color) => void
  audioData?: AudioData
  showAuras: boolean
  lockedElements: Set<string>
  setLockedElements: React.Dispatch<React.SetStateAction<Set<string>>>
  currentBackgroundColor: THREE.Color
  onModelLoad?: () => void
}) {
  const allObjects = useRef<{ [key: string]: THREE.Group | null }>({})
  const { camera, gl } = useThree()

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (event.detail > 1) return // Ignore double clicks
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2(
        (event.clientX / gl.domElement.clientWidth) * 2 - 1,
        -(event.clientY / gl.domElement.clientHeight) * 2 + 1,
      )
      raycaster.setFromCamera(mouse, camera)
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const intersectPoint = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
        onGravityAnchorPlace(intersectPoint)
      }
    },
    [camera, gl, onGravityAnchorPlace],
  )

  useEffect(() => {
    gl.domElement.addEventListener("click", handleClick)
    return () => gl.domElement.removeEventListener("click", handleClick)
  }, [gl, handleClick])

  useFrame((state) => {
    if (audioEnabled) {
      // Background color animation - now with brighter colors and faster transitions
      const time = state.clock.elapsedTime * 0.1 // Slower animation

      const colors = [
        new THREE.Color(0x4a00b4), // Vibrant Purple
        new THREE.Color(0x8a2be2), // Blue Violet
        new THREE.Color(0x00bfff), // Deep Sky Blue
        new THREE.Color(0x00ced1), // Dark Turquoise
        new THREE.Color(0x32cd32), // Lime Green
        new THREE.Color(0xff69b4), // Hot Pink
      ]

      const segmentDuration = 8 // 8 seconds per color transition
      const currentSegment = Math.floor(time / segmentDuration) % colors.length
      const t = (time % segmentDuration) / segmentDuration

      const currentColor = colors[currentSegment].clone()
      const nextColor = colors[(currentSegment + 1) % colors.length]

      currentColor.lerp(nextColor, t)

      // If audio is enabled, make colors more vibrant
      if (audioData && audioData.overall > 0.02) {
        const intensity = 1 + audioData.overall * 0.5
        currentColor.multiplyScalar(intensity)
      }

      onBackgroundColorChange(currentColor)
    } else {
      // If audio is not enabled, set background to plain white
      onBackgroundColorChange(new THREE.Color(0xffffff))
    }
  })

  const windStrength = controls?.air?.windStrength || 0
  const windDirection = controls?.air?.windDirection || new THREE.Vector3(1, 0, 0)

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1.0} castShadow />
      <GravityAnchor position={gravityAnchor} strength={gravityStrength} />
      <WindField windStrength={windStrength} windDirection={windDirection} />
      <Suspense fallback={null}>
        <Model
          url="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Curved_Fragment_0626084834_generate-dwQmXUXothrCvdU6sqwvbepfVJDbcQ.glb"
          position={[-4, 2, 0]}
          element="air"
          allObjects={allObjects}
          controls={controls}
          resetPositions={resetPositions}
          gravityAnchor={gravityAnchor}
          gravityStrength={gravityStrength}
          audioData={audioData}
          showAuras={showAuras}
          lockedElements={lockedElements}
          setLockedElements={setLockedElements}
          currentBackgroundColor={currentBackgroundColor}
          onModelLoad={onModelLoad}
        />
        <Model
          url="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Green_Swirl_on_Lavend_0626085100_generate-a6CioFW1QyHM9M5ongbr50gYKMM5f1.glb"
          position={[4, 2, 0]}
          element="water"
          allObjects={allObjects}
          controls={controls}
          resetPositions={resetPositions}
          gravityAnchor={gravityAnchor}
          gravityStrength={gravityStrength}
          audioData={audioData}
          showAuras={showAuras}
          lockedElements={lockedElements}
          setLockedElements={setLockedElements}
          currentBackgroundColor={currentBackgroundColor}
          onModelLoad={onModelLoad}
        />
        <Model
          url="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Stone_Fragment_Verdan_0626084156_generate-8oKmkaIWURQGni3vCZYvIi0NPK9M8O.glb"
          position={[-4, -2, 0]}
          element="earth"
          allObjects={allObjects}
          controls={controls}
          resetPositions={resetPositions}
          gravityAnchor={gravityAnchor}
          gravityStrength={gravityStrength}
          audioData={audioData}
          showAuras={showAuras}
          lockedElements={lockedElements}
          setLockedElements={setLockedElements}
          currentBackgroundColor={currentBackgroundColor}
          onModelLoad={onModelLoad}
        />
        <Model
          url="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Ancient_Metal_Artifac_0626090143_generate-oM8seyfd52FbEhRzfwjFrS2aPae4Kv.glb"
          position={[4, -2, 0]}
          element="fire"
          allObjects={allObjects}
          controls={controls}
          resetPositions={resetPositions}
          gravityAnchor={gravityAnchor}
          gravityStrength={gravityStrength}
          audioData={audioData}
          showAuras={showAuras}
          lockedElements={lockedElements}
          setLockedElements={setLockedElements}
          currentBackgroundColor={currentBackgroundColor}
          onModelLoad={onModelLoad}
        />
      </Suspense>
      <OrbitControls />
    </>
  )
}

function useAudioAnalysis(audioRef: React.RefObject<HTMLAudioElement>): AudioData {
  const [audioData, setAudioData] = useState<AudioData>({
    bass: 0,
    mid: 0,
    treble: 0,
    overall: 0,
  })

  useEffect(() => {
    if (!audioRef.current) return

    const audio = audioRef.current
    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let source: MediaElementAudioSourceNode | null = null
    let intervalId: NodeJS.Timeout | null = null

    const initAudio = () => {
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        analyser = audioContext.createAnalyser()
        source = audioContext.createMediaElementSource(audio)

        source.connect(analyser)
        analyser.connect(audioContext.destination)

        analyser.fftSize = 256
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const updateAudioData = () => {
          if (analyser) {
            analyser.getByteFrequencyData(dataArray)

            const bassRange = dataArray.slice(0, 32)
            const midRange = dataArray.slice(32, 96)
            const trebleRange = dataArray.slice(96, 128)

            const bass = bassRange.reduce((a, b) => a + b, 0) / bassRange.length / 255
            const mid = midRange.reduce((a, b) => a + b, 0) / midRange.length / 255
            const treble = trebleRange.reduce((a, b) => a + b, 0) / trebleRange.length / 255
            const overall = dataArray.reduce((a, b) => a + b, 0) / bufferLength / 255

            setAudioData({ bass, mid, treble, overall })
          }
        }

        intervalId = setInterval(updateAudioData, 50)
      }
    }

    audio.addEventListener("play", initAudio)

    return () => {
      audio.removeEventListener("play", initAudio)
      if (intervalId) clearInterval(intervalId)
      if (audioContext) audioContext.close()
    }
  }, [audioRef])

  return audioData
}

// Helper to get initial positions for characters
function getCharacterPositions() {
  const positions = []
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight
  const spacing = 40 // Space between characters

  // Top edge
  for (let x = 0; x < screenWidth; x += spacing) {
    positions.push({ x, y: 20, key: `top-${x}` })
  }

  // Bottom edge
  for (let x = 0; x < screenWidth; x += spacing) {
    positions.push({ x, y: screenHeight - 20, key: `bottom-${x}` })
  }

  // Left edge
  for (let y = spacing; y < screenHeight - spacing; y += spacing) {
    positions.push({ x: 20, y, key: `left-${y}` })
  }

  // Right edge
  for (let y = spacing; y < screenHeight - spacing; y += spacing) {
    const panelWidth = 200 // Approximate width of the control panel
    const panelHeight = 400 // Approximate height of the control panel
    const panelTop = screenHeight / 2 - panelHeight / 2
    const panelBottom = screenHeight / 2 + panelHeight / 2

    if (y < panelTop || y > panelBottom) {
      positions.push({ x: screenWidth - 20, y, key: `right-${y}` })
    }
  }
  return positions
}

// Debounce utility
function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
  let timeout: NodeJS.Timeout | null
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      timeout = null
      func.apply(this, args)
    }, delay)
  }
}

// Simple Sand Timer Component
function SandTimer() {
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => (prev + 5) % 360)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center">
      <div className="w-12 h-16 relative mb-4" style={{ transform: `rotate(${rotation}deg)` }}>
        {/* Hourglass shape */}
        <div className="absolute inset-0 border-2 border-white/60 rounded-lg">
          {/* Top sand */}
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-8 h-3 bg-yellow-300/60 rounded-sm"></div>
          {/* Falling sand line */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-yellow-300/40"></div>
          {/* Bottom sand */}
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-2 bg-yellow-300/60 rounded-sm"></div>
        </div>
      </div>
      <div className="text-lg luminari-font opacity-80" style={{ color: "#87ceeb" }}>
        Loading...
      </div>
    </div>
  )
}

export default function Component() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioData = useAudioAnalysis(audioRef)

  const [manualControls, setManualControls] = useState<UserControls>({
    fire: 0.5,
    earth: 0.5,
    water: 0.5,
    air: 0.5,
  })
  const [effectiveControls, setEffectiveControls] = useState<UserControls>(manualControls)

  const [resetPositions, setResetPositions] = useState(false)
  const [gravityAnchor, setGravityAnchor] = useState(new THREE.Vector3(0, 0, 0))
  const [gravityStrength, setGravityStrength] = useState(0)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [backgroundColorValues, setBackgroundColorValues] = useState({ r: 1, g: 1, b: 1 })

  const currentBackgroundColor = useMemo(() => {
    return new THREE.Color(backgroundColorValues.r, backgroundColorValues.g, backgroundColorValues.b)
  }, [backgroundColorValues.r, backgroundColorValues.g, backgroundColorValues.b])
  const [showAuras, setShowAuras] = useState(false)
  const [lockedElements, setLockedElements] = useState<Set<string>>(new Set())

  const [showWelcome, setShowWelcome] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [showBrowserWarning, setShowBrowserWarning] = useState(false)
  const [pageLoaded, setPageLoaded] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [loadingCount, setLoadingCount] = useState(4) // 4 models to load

  // Browser compatibility check
  useEffect(() => {
    const checkCompatibility = () => {
      // Check for WebGL support
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")

      // Check for other required features
      const hasWebGL = !!gl
      const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext)
      const hasRequestAnimationFrame = !!window.requestAnimationFrame

      if (!hasWebGL || !hasAudioContext || !hasRequestAnimationFrame) {
        setTimeout(() => {
          if (!pageLoaded) {
            setShowBrowserWarning(true)
          }
        }, 5000) // Show warning after 5 seconds if page hasn't loaded
      }
    }

    checkCompatibility()
  }, [pageLoaded])

  // Mark page as loaded when models are loaded
  useEffect(() => {
    if (modelsLoaded) {
      setPageLoaded(true)
    }
  }, [modelsLoaded])

  // Track management
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isTrackLoading, setIsTrackLoading] = useState(false)

  const mysticalCharacters = [
    "艺",
    "术",
    "ç",
    "ø",
    "ř",
    "ǎ",
    "ŧ",
    "ÿ",
    "ŵ",
    "ž",
    "ᛉ",
    "д",
    "л",
    "и",
    "ж",
    "э",
    "ю",
    "я",
    "ф",
    "т",
    "щ",
    "з",
    "х",
    "ч",
    "ש",
    "ת",
    "ג",
    "ר",
    "פ",
    "ע",
    "ס",
    "ד",
    "ק",
    "מ",
    "ל",
    "נ",
    "م",
    "ل",
    "ي",
    "ن",
    "ب",
    "س",
    "ك",
    "ف",
    "ع",
    "ت",
    "ح",
    "ᚠ",
    "ᚢ",
    "ᚦ",
    "ᚨ",
    "ᚱ",
    "ᚷ",
    "ᚹ",
    "ᚺ",
    "ᛉ",
    "ß",
    "þ",
    "ð",
    "ø",
    "ł",
    "ſ",
    "ƀ",
    "ƃ",
    "ƈ",
    "ƒ",
    "ȝ",
    "ʒ",
    "ʃ",
    "ʎ",
    "ʀ",
    "ʁ",
    "ʂ",
    "ʉ",
    "ʊ",
    "ʌ",
    "ʍ",
    "ʎ",
    "ʐ",
    "Θ",
    "ж",
    "ن",
    "ת",
    "α",
    "ι",
    "ɐ",
    "ɨ",
    "ʍ",
    "ᛁ",
    "ס",
    "צ",
  ]

  const [characterData, setCharacterData] = useState<
    Array<{ id: string; x: number; y: number; currentChar: string; targetChar: string; revealTime: number }>
  >([])

  // Initialize character positions and their initial state on mount
  useEffect(() => {
    const initialPositions = getCharacterPositions()
    const initialCharacterData = initialPositions.map((pos) => ({
      id: pos.key, // Use key as id
      x: pos.x,
      y: pos.y,
      currentChar: mysticalCharacters[Math.floor(Math.random() * mysticalCharacters.length)],
      targetChar: "", // Will be set on first trigger
      revealTime: 0, // Will be set on first trigger
    }))
    setCharacterData(initialCharacterData)
  }, [])

  // Effect to handle the actual visual update of characters based on revealTime
  useEffect(() => {
    const interval = setInterval(() => {
      setCharacterData((prevData) => {
        let changed = false
        const newData = prevData.map((charItem) => {
          if (charItem.revealTime > 0 && Date.now() >= charItem.revealTime) {
            changed = true
            return {
              ...charItem,
              currentChar: charItem.targetChar,
              revealTime: Number.POSITIVE_INFINITY, // Mark as revealed, won't trigger again until new interaction
            }
          }
          return charItem
        })
        // Only update state if something actually changed to prevent unnecessary re-renders
        return changed ? newData : prevData
      })
    }, 50) // Check every 50ms for characters to reveal

    return () => clearInterval(interval)
  }, []) // Run once on mount

  // Debounced function to trigger character updates
  const debouncedTriggerCharacterUpdate = useCallback(
    debounce(() => {
      setCharacterData((prevData) => {
        return prevData.map((charItem) => {
          const newTargetChar = mysticalCharacters[Math.floor(Math.random() * mysticalCharacters.length)]
          const delay = Math.random() * 1000 // Random delay up to 1 second
          const newRevealTime = Date.now() + delay
          return {
            ...charItem,
            targetChar: newTargetChar,
            revealTime: newRevealTime,
          }
        })
      })
    }, 500), // Debounce for 500ms
    [mysticalCharacters],
  )

  // Track management effects
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = tracks[currentTrackIndex].url
      if (audioEnabled) {
        setIsTrackLoading(true)
        audioRef.current.load()
        audioRef.current
          .play()
          .then(() => {
            setIsTrackLoading(false)
          })
          .catch(() => {
            setIsTrackLoading(false)
          })
      }
    }
  }, [currentTrackIndex, audioEnabled])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTrackEnd = () => {
      // Move to next track instead of looping
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length)
    }

    // Remove loop attribute and add ended event listener
    audio.loop = false
    audio.addEventListener("ended", handleTrackEnd)
    return () => audio.removeEventListener("ended", handleTrackEnd)
  }, [])

  const handleWelcomeClick = () => {
    setShowWelcome(false)
    debouncedTriggerCharacterUpdate() // Reveal all characters
  }

  useEffect(() => {
    if (audioEnabled && audioData.overall > 0.02) {
      // Restored audio effects - back to previous higher reactivity
      const audioEffects = {
        earth: 0.5 + audioData.bass * 0.6, // Restored from 0.3
        water: 0.5 + audioData.mid * 0.55, // Restored from 0.25
        fire: 0.5 + audioData.treble * 0.65, // Restored from 0.35
        air: 0.5 + (audioData.treble + audioData.overall * 0.5) * 0.5, // Restored from 0.25
      }

      setEffectiveControls({
        fire: Math.max(0, Math.min(1, manualControls.fire + (audioEffects.fire - 0.5))),
        earth: Math.max(0, Math.min(1, manualControls.earth + (audioEffects.earth - 0.5))),
        water: Math.max(0, Math.min(1, manualControls.water + (audioEffects.water - 0.5))),
        air: Math.max(0, Math.min(1, manualControls.air + (audioEffects.air - 0.5))),
      })
    } else if (audioEnabled && audioData.overall <= 0.02) {
      // Gentle decay when audio is quiet
      setEffectiveControls((prevEffective) => ({
        fire: Math.max(manualControls.fire, prevEffective.fire * 0.98),
        earth: Math.max(manualControls.earth, prevEffective.earth * 0.98),
        water: Math.max(manualControls.water, prevEffective.water * 0.98),
        air: Math.max(manualControls.air, prevEffective.air * 0.98),
      }))
    } else {
      // No audio - use manual controls only
      setEffectiveControls(manualControls)
    }
  }, [audioData, audioEnabled, manualControls])

  const controls: ElementControls = {
    air: {
      repelStrength: Math.abs(effectiveControls?.air - 0.5) * 1.6, // Repulsion based on distance from center
      attractStrength: 0,
      floatSpeed: 0.5 + Math.abs(effectiveControls?.air - 0.5) * 4,
      floatAmount: 0.003 + Math.abs(effectiveControls?.air - 0.5) * 0.016,
      gravityStrength: 0.00001,
      brightness: 1 + Math.abs(effectiveControls?.air - 0.5) * 3,
      scale: 1,
      frozen: false,
      // Wind is now controlled by the air slider
      windStrength: Math.abs(effectiveControls?.air - 0.5) * 2.0,
      windDirection:
        effectiveControls?.air < 0.5
          ? new THREE.Vector3(-1, 0.1, 0) // Left wind with slight lift
          : new THREE.Vector3(1, 0.2, 0.3), // Right wind with upward/forward component
    },
    water: {
      repelStrength: effectiveControls?.water < 0.5 ? Math.abs(effectiveControls?.water - 0.5) * 1.2 : 0,
      attractStrength: effectiveControls?.water > 0.5 ? (effectiveControls?.water - 0.5) * 1.6 : 0,
      floatSpeed: 0.1 + Math.abs(effectiveControls?.water - 0.5) * 0.6,
      floatAmount: 0.001 + Math.abs(effectiveControls?.water - 0.5) * 0.004,
      gravityStrength: 0.00002,
      brightness: 1 + Math.abs(effectiveControls?.water - 0.5) * 2.0,
      scale: 1,
      frozen: false,
    },
    fire: {
      repelStrength: Math.abs(effectiveControls?.fire - 0.5) * 2.0,
      attractStrength: 0,
      floatSpeed: 0.3 + Math.abs(effectiveControls?.fire - 0.5) * 3,
      floatAmount: 0.002 + Math.abs(effectiveControls?.fire - 0.5) * 0.01,
      gravityStrength: 0.00005,
      brightness: 1 + Math.abs(effectiveControls?.fire - 0.5) * 8,
      scale: 1,
      frozen: false,
    },
    earth: {
      repelStrength: effectiveControls?.earth < 0.5 ? Math.abs(effectiveControls?.earth - 0.5) * 1.2 : 0,
      attractStrength: effectiveControls?.earth > 0.5 ? (effectiveControls?.earth - 0.5) * 2.0 : 0,
      floatSpeed: 0.02,
      floatAmount: Math.max(0.0001, 0.0003 - Math.abs(effectiveControls?.earth - 0.5) * 0.0004),
      gravityStrength: 0.004 + Math.abs(effectiveControls?.earth - 0.5) * 0.02, // Increased earth's own gravity
      brightness: 1 + Math.abs(effectiveControls?.earth - 0.5) * 1.6,
      scale: 1,
      frozen: false,
    },
  }

  const handleManualControlChange = (element: keyof UserControls, value: number) => {
    setManualControls((prev) => ({
      ...prev,
      [element]: value,
    }))
    debouncedTriggerCharacterUpdate() // Trigger character change with debounce
  }

  const handleReset = () => {
    setResetPositions(true)
    setTimeout(() => setResetPositions(false), 100)
    setLockedElements(new Set()) // Unlock elements on reset
    debouncedTriggerCharacterUpdate() // Trigger character change on reset
  }

  const handleGravityAnchorPlace = useCallback((position: THREE.Vector3) => {
    setGravityAnchor(new THREE.Vector3(position.x, position.y, position.z))
  }, [])

  const handleBackgroundColorChange = useCallback((color: THREE.Color) => {
    setBackgroundColorValues({ r: color.r, g: color.g, b: color.b })
  }, [])

  const toggleAudio = () => {
    if (audioRef.current) {
      if (audioEnabled) {
        audioRef.current.pause()
        setAudioEnabled(false)
      } else {
        setAudioEnabled(true)
        setIsTrackLoading(true)
        audioRef.current
          .play()
          .then(() => {
            setIsTrackLoading(false)
          })
          .catch(() => {
            setIsTrackLoading(false)
          })
      }
      debouncedTriggerCharacterUpdate() // Trigger character change on play/pause
    }
  }

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length)
  }

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length)
  }

  const [showTopMenu, setShowTopMenu] = useState(false)
  const [showBottomMenu, setShowBottomMenu] = useState(false)

  const handleModelLoad = useCallback(() => {
    setLoadingCount((prev) => {
      const newCount = prev - 1
      if (newCount <= 0) {
        setModelsLoaded(true)
      }
      return newCount
    })
  }, [])

  return (
    <div className="w-full h-screen relative">
      {showWelcome && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div
            className="cursor-pointer hover:scale-105 transition-transform duration-300 mb-8"
            onClick={handleWelcomeClick}
          >
            <h1 className="text-8xl font-bold luminari-font text-center">
              <span style={{ color: "#ffd700" }}>Zahear</span>
              <span style={{ color: "#87ceeb" }}>?</span>
            </h1>
          </div>

          <div className="absolute bottom-8">
            <a
              href="https://www.linktr.ee/wyrdode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg hover:underline transition-all duration-300"
              style={{ color: "#87ceeb" }}
            >
              linktr.ee/wyrdode
            </a>
          </div>
        </div>
      )}

      {showBrowserWarning && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 max-w-md text-center">
            <h2 className="text-2xl font-bold luminari-font mb-4" style={{ color: "#ff6b6b" }}>
              Browser Compatibility Issue
            </h2>
            <p className="text-white mb-6">This experience requires a modern browser with WebGL support. Please try:</p>
            <ul className="text-left text-white/80 mb-6 space-y-2">
              <li>• Chrome (recommended)</li>
              <li>• Firefox</li>
              <li>• Safari (latest version)</li>
              <li>• Edge</li>
            </ul>
            <p className="text-sm text-white/60 mb-4">
              Make sure hardware acceleration is enabled in your browser settings.
            </p>
            <button
              onClick={() => setShowBrowserWarning(false)}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors duration-300 text-white"
            >
              Try Anyway
            </button>
          </div>
        </div>
      )}

      {!modelsLoaded && !showWelcome && <SandTimer />}

      <div className="w-full h-full">
        <Canvas camera={{ position: [8, 8, 8], fov: 60 }} shadows>
          <color attach="background" args={[currentBackgroundColor.getHex()]} />
          <Scene
            controls={controls}
            resetPositions={resetPositions}
            gravityAnchor={gravityAnchor}
            gravityStrength={gravityStrength}
            onGravityAnchorPlace={handleGravityAnchorPlace}
            audioEnabled={audioEnabled}
            onBackgroundColorChange={handleBackgroundColorChange}
            audioData={audioData}
            showAuras={showAuras}
            lockedElements={lockedElements}
            setLockedElements={setLockedElements}
            currentBackgroundColor={currentBackgroundColor}
            onModelLoad={handleModelLoad}
          />
        </Canvas>
      </div>

      <audio ref={audioRef} crossOrigin="anonymous" />

      {/* Desktop Layout */}
      <div className="hidden md:block">
        {/* Desktop Hamburger Menu Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-4 right-4 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg flex items-center justify-center z-40"
        >
          <div className="flex flex-col gap-1">
            <div
              className="w-6 h-0.5 bg-black transition-transform duration-300"
              style={{
                transform: sidebarCollapsed ? "rotate(45deg) translate(2px, 2px)" : "none",
              }}
            />
            <div
              className="w-6 h-0.5 bg-black transition-opacity duration-300"
              style={{
                opacity: sidebarCollapsed ? 0 : 1,
              }}
            />
            <div
              className="w-6 h-0.5 bg-black transition-transform duration-300"
              style={{
                transform: sidebarCollapsed ? "rotate(-45deg) translate(2px, -2px)" : "none",
              }}
            />
          </div>
        </button>

        {/* Desktop Track display */}
        <div
          className={`absolute top-1/2 right-8 transform translate-y-64 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg transition-transform duration-300 ${
            sidebarCollapsed ? "translate-x-full opacity-0" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={prevTrack}
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
              style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb" }}
            >
              ‹
            </button>
            <div
              className="text-sm font-medium luminari-font"
              style={{ color: "#000000", minWidth: "60px", textAlign: "center" }}
            >
              {isTrackLoading ? "..." : tracks[currentTrackIndex].name}
            </div>
            <button
              onClick={nextTrack}
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
              style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb" }}
            >
              ›
            </button>
          </div>
        </div>

        {/* Desktop Control bar */}
        <div
          className={`absolute top-1/2 right-8 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg transition-transform duration-300 ${
            sidebarCollapsed ? "translate-x-full opacity-0" : ""
          }`}
        >
          <div className="flex gap-3 mb-4 justify-center">
            <button
              onClick={toggleAudio}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"
              style={{
                backgroundColor: "#ffffff",
                border: "2px solid #e5e7eb",
              }}
            >
              <img
                src="/images/play-button.png"
                alt={audioEnabled ? "Pause" : "Play"}
                className="w-6 h-6"
                style={{
                  filter: audioEnabled ? "none" : "grayscale(100%)",
                  opacity: audioEnabled ? 1 : 0.7,
                }}
              />
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm luminari-font shadow-md hover:shadow-lg transition-shadow"
              style={{ backgroundColor: "#f3f4f6", color: "#000000", border: "2px solid #e5e7eb" }}
            >
              Reset
            </button>
            <button
              onClick={() => setShowAuras(!showAuras)}
              className="px-4 py-2 rounded-lg text-sm luminari-font shadow-md hover:shadow-lg transition-shadow"
              style={{
                backgroundColor: showAuras ? "#c7d2fe" : "#f3f4f6",
                color: "#000000",
                border: "2px solid #e5e7eb",
              }}
            >
              Auras
            </button>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2 luminari-font text-center" style={{ color: "#000000" }}>
              Gravity
            </h3>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={gravityStrength}
              onChange={(e) => {
                setGravityStrength(Number.parseFloat(e.target.value))
                debouncedTriggerCharacterUpdate()
              }}
              className="w-full h-6 rounded appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #e5e7eb 0%, #c0c0c0 ${(gravityStrength / 10) * 100}%, #e5e7eb ${(gravityStrength / 10) * 100}%)`,
              }}
            />
          </div>

          <div className="space-y-4">
            {Object.entries(manualControls || {}).map(([element, value]) => (
              <div key={element}>
                <h3
                  className="text-lg font-medium mb-2 capitalize luminari-font text-center"
                  style={{ color: "#000000" }}
                >
                  {element}
                </h3>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value || 0.5}
                    onChange={(e) =>
                      handleManualControlChange(element as keyof UserControls, Number.parseFloat(e.target.value))
                    }
                    className="w-full h-6 rounded appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, 
                        ${element === "fire" ? "#ff6b35" : element === "water" ? "#4da6ff" : element === "earth" ? "#cd853f" : element === "air" ? "#ffd700" : "#ffffff"} 0%, 
                        #e5e7eb 45%, 
                        #e5e7eb 55%, 
                        ${element === "fire" ? "#ff4500" : element === "water" ? "#0066ff" : element === "earth" ? "#8b4513" : element === "air" ? "#ffd700" : "#ffffff"} 100%)`,
                    }}
                  />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-black opacity-50 pointer-events-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Top Mobile Controls */}
        <div className="absolute top-0 left-0 right-0 z-40">
          {/* Top Hamburger */}
          <button
            onClick={() => setShowTopMenu(!showTopMenu)}
            className={`absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg flex items-center justify-center transition-all duration-300 ${
              showTopMenu ? "z-50" : "z-40"
            }`}
          >
            <div className="flex flex-col gap-1">
              <div
                className="w-5 h-0.5 bg-black transition-transform duration-300"
                style={{
                  transform: showTopMenu ? "rotate(45deg) translate(1.5px, 1.5px)" : "none",
                }}
              />
              <div
                className="w-5 h-0.5 bg-black transition-opacity duration-300"
                style={{
                  opacity: showTopMenu ? 0 : 1,
                }}
              />
              <div
                className="w-5 h-0.5 bg-black transition-transform duration-300"
                style={{
                  transform: showTopMenu ? "rotate(-45deg) translate(1.5px, -1.5px)" : "none",
                }}
              />
            </div>
          </button>

          {/* Top Menu Panel */}
          <div
            className={`bg-white/95 backdrop-blur-sm shadow-lg transition-transform duration-300 ${
              showTopMenu ? "translate-y-0" : "-translate-y-full"
            }`}
          >
            <div className="p-4 pt-16">
              <div className="flex gap-2 mb-4 justify-center">
                <button
                  onClick={toggleAudio}
                  className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                  style={{ backgroundColor: "#ffffff", border: "2px solid #e5e7eb" }}
                >
                  <img
                    src="/images/play-button.png"
                    alt={audioEnabled ? "Pause" : "Play"}
                    className="w-5 h-5"
                    style={{
                      filter: audioEnabled ? "none" : "grayscale(100%)",
                      opacity: audioEnabled ? 1 : 0.7,
                    }}
                  />
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-2 rounded-lg text-xs luminari-font shadow-md"
                  style={{ backgroundColor: "#f3f4f6", color: "#000000", border: "2px solid #e5e7eb" }}
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowAuras(!showAuras)}
                  className="px-3 py-2 rounded-lg text-xs luminari-font shadow-md"
                  style={{
                    backgroundColor: showAuras ? "#c7d2fe" : "#f3f4f6",
                    color: "#000000",
                    border: "2px solid #e5e7eb",
                  }}
                >
                  Auras
                </button>
              </div>

              {/* Track Controls */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={prevTrack}
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb" }}
                >
                  ‹
                </button>
                <div
                  className="text-sm font-medium luminari-font px-3"
                  style={{ color: "#000000", minWidth: "60px", textAlign: "center" }}
                >
                  {isTrackLoading ? "..." : tracks[currentTrackIndex].name}
                </div>
                <button
                  onClick={nextTrack}
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb" }}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Mobile Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-40">
          {/* Bottom Menu Panel */}
          <div
            className={`bg-white/95 backdrop-blur-sm shadow-lg transition-transform duration-300 ${
              showBottomMenu ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="p-4 pb-16">
              {/* Element Sliders in 2 rows */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {Object.entries(manualControls || {}).map(([element, value]) => (
                  <div key={element} className="space-y-1">
                    <h3
                      className="text-sm font-medium capitalize luminari-font text-center"
                      style={{ color: "#000000" }}
                    >
                      {element}
                    </h3>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={value || 0.5}
                        onChange={(e) =>
                          handleManualControlChange(element as keyof UserControls, Number.parseFloat(e.target.value))
                        }
                        className="w-full h-4 rounded appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, 
                            ${element === "fire" ? "#ff6b35" : element === "water" ? "#4da6ff" : element === "earth" ? "#cd853f" : element === "air" ? "#ffd700" : "#ffffff"} 0%, 
                            #e5e7eb 45%, 
                            #e5e7eb 55%, 
                            ${element === "fire" ? "#ff4500" : element === "water" ? "#0066ff" : element === "earth" ? "#8b4513" : element === "air" ? "#ffd700" : "#ffffff"} 100%)`,
                        }}
                      />
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 bg-black opacity-50 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Gravity Slider */}
              <div className="space-y-1">
                <h3 className="text-sm font-medium luminari-font text-center" style={{ color: "#000000" }}>
                  Gravity
                </h3>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={gravityStrength}
                  onChange={(e) => {
                    setGravityStrength(Number.parseFloat(e.target.value))
                    debouncedTriggerCharacterUpdate()
                  }}
                  className="w-full h-4 rounded appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #e5e7eb 0%, #c0c0c0 ${(gravityStrength / 10) * 100}%, #e5e7eb ${(gravityStrength / 10) * 100}%)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Hamburger */}
          <button
            onClick={() => setShowBottomMenu(!showBottomMenu)}
            className="absolute bottom-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg flex items-center justify-center"
          >
            <div className="flex flex-col gap-1">
              <div
                className="w-5 h-0.5 bg-black transition-transform duration-300"
                style={{
                  transform: showBottomMenu ? "rotate(45deg) translate(1.5px, 1.5px)" : "none",
                }}
              />
              <div
                className="w-5 h-0.5 bg-black transition-opacity duration-300"
                style={{
                  opacity: showBottomMenu ? 0 : 1,
                }}
              />
              <div
                className="w-5 h-0.5 bg-black transition-transform duration-300"
                style={{
                  transform: showBottomMenu ? "rotate(-45deg) translate(1.5px, -1.5px)" : "none",
                }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mystical characters around screen edges */}
      <div className="absolute inset-0 pointer-events-none">
        {characterData.map(({ currentChar, x, y, id }) => (
          <div
            key={id}
            className="absolute text-white text-lg font-bold opacity-60"
            style={{
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
              textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
              fontFamily: "serif",
            }}
          >
            {currentChar}
          </div>
        ))}
      </div>
    </div>
  )
}
