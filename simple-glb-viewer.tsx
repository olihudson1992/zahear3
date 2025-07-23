"use client"

import { Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"

function ElementalCube({
  position,
  name,
  color,
  element,
}: {
  position: [number, number, number]
  name: string
  color: number
  element: string
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      {/* Add a point light for each element */}
      <pointLight color={color} intensity={0.5} distance={5} />
    </group>
  )
}

function Scene() {
  return (
    <>
      <color attach="background" args={["#ffffff"]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />

      {/* Four elemental objects as colored cubes */}
      <ElementalCube position={[-3, 0, 0]} name="Curved Fragment" color={0x87ceeb} element="air" />

      <ElementalCube position={[3, 0, 0]} name="Green Swirl" color={0x00ff7f} element="water" />

      <ElementalCube position={[0, -3, 0]} name="Stone Fragment" color={0x8b4513} element="earth" />

      <ElementalCube position={[0, 3, 0]} name="Ancient Metal" color={0xff4500} element="fire" />

      <OrbitControls />
    </>
  )
}

export default function Component() {
  return (
    <div className="w-full h-screen">
      <Canvas camera={{ position: [5, 5, 5], fov: 60 }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      {/* Status overlay */}
      <div className="absolute top-4 left-4 text-black bg-white/80 p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-2">Four Elements</h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-sky-300 rounded-full"></div>
            <span>Air - Curved Fragment (Left)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span>Water - Green Swirl (Right)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-700 rounded-full"></div>
            <span>Earth - Stone Fragment (Bottom)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>Fire - Ancient Metal (Top)</span>
          </div>
        </div>
        <div className="mt-4 text-xs opacity-75">
          <p>GLB files replaced with colored cubes due to loading issues</p>
          <p>Use orbit controls to rotate around the scene</p>
        </div>
      </div>
    </div>
  )
}
