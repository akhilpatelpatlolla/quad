import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Environment,
  Float,
  MeshDistortMaterial,
  Sparkles,
  Stars
} from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { getSpatialFrame } from "../spatial/spatialFrame";

export type NexusMode = "cinematic" | "hud";

type Props = {
  mode: NexusMode;
  isDark: boolean;
};

function NexusRig() {
  const ref = useRef<THREE.Group>(null);
  const reduce = useReducedMotion();

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const { rx, ry } = getSpatialFrame();
    const smooth = 0.05;
    const tx = (reduce ? 0 : rx) * 0.45 + Math.sin(t * 0.1) * 0.06;
    const tyy = (reduce ? 0 : ry) * 0.22 + Math.cos(t * 0.075) * 0.032;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, reduce ? t * 0.05 : tx, smooth);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, tyy, smooth);
    g.position.y = Math.sin(t * 0.16) * 0.1;
  });

  return (
    <group ref={ref}>
      <Float speed={1.5} rotationIntensity={0.45} floatIntensity={0.75} floatingRange={[-0.1, 0.12]}>
        <mesh castShadow>
          <torusKnotGeometry args={[0.75, 0.22, 192, 32]} />
          <MeshDistortMaterial
            color="#5eead4"
            emissive="#312e81"
            emissiveIntensity={0.45}
            metalness={0.85}
            roughness={0.18}
            distort={0.38}
            speed={reduce ? 0.15 : 2.3}
          />
        </mesh>
      </Float>
      <Float speed={1.1} rotationIntensity={0.32} floatIntensity={0.48} floatingRange={[-0.08, 0.08]}>
        <mesh position={[1.35, 0.2, -0.6]} scale={0.38} castShadow>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#7c3aed"
            emissive="#0ea5e9"
            emissiveIntensity={0.25}
            metalness={0.9}
            roughness={0.12}
            wireframe
          />
        </mesh>
      </Float>
    </group>
  );
}

export default function NexusScene({ mode, isDark }: Props) {
  const reduce = useReducedMotion();
  const sparkles = mode === "cinematic" && !reduce ? 520 : 200;
  const starCount = mode === "cinematic" && !reduce ? 8000 : 3000;
  const bg = isDark ? "#050a14" : "#eef6ff";
  const fogD = isDark ? 0.055 : 0.034;
  const chroma = new THREE.Vector2(0.0009, 0.0012);

  return (
    <>
      <color attach="background" args={[bg]} />
      <fogExp2 attach="fog" args={[bg, fogD]} />

      <ambientLight intensity={isDark ? 0.22 : 0.45} color="#c4d4ff" />
      <directionalLight position={[5, 8, 6]} intensity={1.6} color="#fff7ed" castShadow />
      <spotLight position={[-6, 4, 2]} intensity={0.8} color="#22d3ee" angle={0.4} penumbra={0.6} />
      <spotLight position={[4, 2, -5]} intensity={0.55} color="#a78bfa" angle={0.5} penumbra={1} />

      <Environment preset={isDark ? "night" : "dawn"} environmentIntensity={0.9} />
      <NexusRig />
      <Sparkles
        count={sparkles}
        speed={reduce ? 0.2 : 0.6}
        opacity={0.75}
        scale={14}
        size={2.2}
        color={isDark ? "#67e8f9" : "#3b82f6"}
        position={[0, 0.1, 0]}
      />
      <Stars
        radius={80}
        depth={50}
        count={starCount}
        factor={3.2}
        saturation={0.15}
        fade
        speed={reduce ? 0.05 : 0.35}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.3, 0]} receiveShadow>
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial
          color={isDark ? "#0a1220" : "#d8e6ff"}
          metalness={0.35}
          roughness={0.75}
          transparent
          opacity={0.35}
        />
      </mesh>

      {!reduce && (
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={mode === "cinematic" ? 0.9 : 0.45} levels={6} radius={0.45} />
          <Vignette eskil={false} offset={0.12} darkness={0.45} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={chroma} radialModulation={false} modulationOffset={0.12} />
          <Noise blendFunction={BlendFunction.OVERLAY} opacity={0.04} />
        </EffectComposer>
      )}
    </>
  );
}
