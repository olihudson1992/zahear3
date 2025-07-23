"use client"

import { useRef, useEffect, Suspense, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OrbitControls, Text } from "@react-three/drei"
import * as THREE from "three"
import ErrorBoundary from "./error-boundary"

// Physics simulation for gravitational attraction
function useGravity(objects: any[], strength = 0.001) {
  useFrame(() => {
    objects.forEach((obj1, i) => {
      if (!obj1.current) return

      objects.forEach((obj2, j) => {
        if (i === j || !obj2.current) return

        const pos1 = obj1.current.position
        const pos2 = obj2.current.position
        const distance = pos1.distanceTo(pos2)

        if (distance > 0.1) {
          const force = strength / (distance * distance)
          const direction = new THREE.Vector3().subVectors(pos2, pos1).normalize()

          // Apply gravitational force
          pos1.add(direction.multiplyScalar(force))
        }
      })
    })
  })
}

// Three.js compatible loading component
function LoadingText() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.1
    }
  })

  return (
    <group>
      <Text
        position={[0, 0, 0]}
        fontSize={0.5}
        color="black" // Changed from white to black
        anchorX="center"
        anchorY="middle"
        font="/fonts/Inter_Regular.json"
      >
        Loading Elements...
      </Text>
      <mesh ref={meshRef} position={[0, -1, 0]}>
        <torusGeometry args={[0.5, 0.1, 8, 16]} />
        <meshBasicMaterial color={0x000000} wireframe /> {/* Changed from 0xffffff to 0x000000 */}
      </mesh>
    </group>
  )
}

function ElementalObject({
  modelPath,
  position,
  element,
  objectRef,
}: {
  modelPath: string
  position: [number, number, number]
  element: "air" | "water" | "earth" | "fire"
  objectRef: any
}) {
  const meshRef = useRef<THREE.Group>(null)
  const [gltf, setGltf] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<boolean>(false)

  useEffect(() => {
    const loader = new GLTFLoader()
    loader.load(
      modelPath,
      (loadedGltf) => {
        console.log(`Successfully loaded ${modelPath}:`, loadedGltf)
        setGltf(loadedGltf)
        setLoading(false)
        setLoadError(false)
      },
      (progress) => {
        console.log(`Loading ${modelPath}: ${(progress.loaded / progress.total) * 100}%`)
      },
      (error) => {
        console.error(`Critical error loading ${modelPath}:`, error, error.message, error.stack)
        setLoading(false)
        setLoadError(true)
      },
    )
  }, [modelPath])

  useEffect(() => {
    if (meshRef.current) {
      objectRef.current = meshRef.current
    }
  }, [objectRef])

  useFrame((state) => {
    if (!meshRef.current) return

    // Gentle floating animation
    meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0]) * 0.002
    meshRef.current.rotation.y += 0.005

    // Element-specific animations
    switch (element) {
      case "air":
        meshRef.current.rotation.x += 0.01
        break
      case "fire":
        meshRef.current.position.y += Math.sin(state.clock.elapsedTime * 2) * 0.001
        meshRef.current.rotation.z += 0.008
        break
      case "water":
        meshRef.current.rotation.z += 0.008
        meshRef.current.position.x += Math.sin(state.clock.elapsedTime * 0.5) * 0.001
        break
      case "earth":
        meshRef.current.rotation.y += 0.003
        break
    }
  })

  // Always render a fallback if loading or if there was an error
  if (loading || loadError || !gltf) {
    return (
      <group ref={meshRef} position={position}>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={
              element === "air" ? 0x87ceeb : element === "fire" ? 0xff4500 : element === "earth" ? 0x8b4513 : 0x00ff7f
            }
            emissive={
              element === "air" ? 0x87ceeb : element === "fire" ? 0xff4500 : element === "earth" ? 0x8b4513 : 0x00ff7f
            }
            emissiveIntensity={0.3}
            transparent={element === "air" || element === "water"}
            opacity={element === "air" || element === "water" ? 0.7 : 1}
          />
        </mesh>
        {loadError && (
          <Text
            position={[0, 0.7, 0]}
            fontSize={0.2}
            color="red"
            anchorX="center"
            anchorY="middle"
            font="/fonts/Inter_Regular.json"
          >
            Load Failed!
          </Text>
        )}
        {/* Point lights for fallback objects */}
        {element === "air" && <pointLight color={0x87ceeb} intensity={0.5} distance={8} />}
        {element === "fire" && <pointLight color={0xff4500} intensity={0.8} distance={10} />}
        {element === "earth" && <pointLight color={0x8b4513} intensity={0.3} distance={6} />}
        {element === "water" && <pointLight color={0x00ff7f} intensity={0.6} distance={8} />}
      </group>
    )
  }

  // Clone and modify materials based on element
  const scene = gltf.scene.clone()

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material.clone()

      switch (element) {
        case "air":
          material.transparent = true
          material.opacity = 0.6
          material.emissive = new THREE.Color(0x87ceeb)
          material.emissiveIntensity = 0.3
          material.roughness = 0.1
          break
        case "fire":
          material.emissive = new THREE.Color(0xff4500)
          material.emissiveIntensity = 0.6
          material.color = new THREE.Color(0xff6b35)
          material.metalness = 0.8
          material.roughness = 0.2
          break
        case "earth":
          material.emissive = new THREE.Color(0x8b4513)
          material.emissiveIntensity = 0.2
          material.color = new THREE.Color(0x654321)
          material.roughness = 0.9
          material.metalness = 0.1
          break
        case "water":
          material.emissive = new THREE.Color(0x00ff7f)
          material.emissiveIntensity = 0.4
          material.color = new THREE.Color(0x228b22)
          material.transparent = true
          material.opacity = 0.8
          material.roughness = 0.3
          break
      }

      child.material = material
      console.log(`Applied material to ${element} (${modelPath}):`, material)
    }
  })

  return (
    <group ref={meshRef} position={position}>
      <primitive object={scene} scale={1} />

      {/* Point lights for each element */}
      {element === "air" && <pointLight color={0x87ceeb} intensity={0.5} distance={8} />}
      {element === "fire" && <pointLight color={0xff4500} intensity={0.8} distance={10} />}
      {element === "earth" && <pointLight color={0x8b4513} intensity={0.3} distance={6} />}
      {element === "water" && <pointLight color={0x00ff7f} intensity={0.6} distance={8} />}
    </group>
  )
}

function Scene() {
  const airRef = useRef<THREE.Group>(null)
  const waterRef = useRef<THREE.Group>(null)
  const earthRef = useRef<THREE.Group>(null)
  const fireRef = useRef<THREE.Group>(null)

  const objects = [airRef, waterRef, earthRef, fireRef]

  // Apply gravity simulation
  useGravity(objects, 0.0008)

  return (
    <>
      <color attach="background" args={["#ffffff"]} /> {/* Changed from #000000 to #ffffff */}
      {/* Ambient lighting */}
      <ambientLight intensity={0.5} />
      {/* Elemental objects suspended in space */}
      <ElementalObject
        modelPath="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Curved_Fragment_0626084834_generate-dwQmXUXothrCvdU6sqwvbepfVJDbcQ.glb"
        position={[-4, 3, 2]}
        element="air"
        objectRef={airRef}
      />
      <ElementalObject
        modelPath="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Green_Swirl_on_Lavend_0626085100_generate-a6CioFW1QyHM9M5ongbr50gYKMM5f1.glb"
        position={[3, -2, 4]}
        element="water"
        objectRef={waterRef}
      />
      <ElementalObject
        modelPath="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Stone_Fragment_Verdan_0626084156_generate-8oKmkaIWURQGni3vCZYvIi0NPK9M8O.glb"
        position={[-2, -4, -3]}
        element="earth"
        objectRef={earthRef}
      />
      <ElementalObject
        modelPath="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Ancient_Metal_Artifac_0626090143_generate-oM8seyfd52FbEhRzfwjFrS2aPae4Kv.glb"
        position={[4, 2, -2]}
        element="fire"
        objectRef={fireRef}
      />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
    </>
  )
}

export default function Component() {
  return (
    <div className="w-full h-screen">
      <Canvas camera={{ position: [10, 10, 10], fov: 60, near: 0.1, far: 1000 }}>
        <ErrorBoundary
          fallback={
            <Text color="red" fontSize={0.5}>
              Scene Error
            </Text>
          }
        >
          <Suspense fallback={<LoadingText />}>
            <Scene />
          </Suspense>
        </ErrorBoundary>
      </Canvas>

      {/* UI overlay with correct element mapping */}
      <div className="absolute top-4 left-4 text-black bg-white/80 p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-2">Four Elements</h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-sky-300 rounded-full"></div>
            <span>Air - Curved Fragment (Glass)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span>Water - Green Swirl (Wood)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-700 rounded-full"></div>
            <span>Earth - Stone Fragment (Stone)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>Fire - Ancient Metal (Metal)</span>
          </div>
        </div>
        <div className="mt-4 text-xs opacity-75">
          <p>Objects emit light and attract each other through gravity</p>
          <p className="text-red-600">
            Note: GLB models may not load due to CORS policy. Fallback cubes will appear instead.
          </p>
        </div>
      </div>
    </div>
  )
}
