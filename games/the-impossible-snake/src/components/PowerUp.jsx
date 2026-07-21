import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { POWER_UPS, cellToWorld } from "../game/constants";
import { CachedRoundedBox } from "./CachedRoundedBox";

const INACTIVE_POWER_UP = { type: "aegis", cell: { x: 0, z: 0 } };

function AegisCore() {
  return (
    <>
      <mesh scale={[0.72, 0.94, 0.28]} castShadow>
        <octahedronGeometry args={[0.58, 0]} />
        <meshPhysicalMaterial color="#a97312" emissive="#e68a08" emissiveIntensity={2.1} metalness={0.72} roughness={0.15} clearcoat={1} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.72, 0.04, 8, 6]} />
        <meshBasicMaterial color="#ffe08a" toneMapped={false} />
      </mesh>
    </>
  );
}

function FangCore() {
  return (
    <>
      <mesh castShadow>
        <sphereGeometry args={[0.34, 20, 20]} />
        <meshPhysicalMaterial color="#ff5738" emissive="#d32616" emissiveIntensity={2.8} metalness={0.42} roughness={0.12} clearcoat={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.55, 0.02, 0]} rotation-z={side * -Math.PI / 2} castShadow>
          <coneGeometry args={[0.18, 0.74, 7]} />
          <meshPhysicalMaterial color="#f5dfbc" emissive="#a86227" emissiveIntensity={0.55} metalness={0.54} roughness={0.18} clearcoat={0.8} />
        </mesh>
      ))}
      <mesh rotation-x={Math.PI / 2} rotation-z={Math.PI / 4}>
        <torusGeometry args={[0.72, 0.035, 8, 4]} />
        <meshBasicMaterial color="#ff7d5e" toneMapped={false} />
      </mesh>
    </>
  );
}

function PhaseCore() {
  return (
    <>
      <CachedRoundedBox args={[0.78, 0.78, 0.78]} radius={0.12} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#3b317f" emissive="#6d58f0" emissiveIntensity={2.4} metalness={0.5} roughness={0.1} clearcoat={1} transparent opacity={0.68} />
      </CachedRoundedBox>
      <mesh scale={0.55} rotation-y={Math.PI / 4}>
        <boxGeometry args={[0.78, 0.78, 0.78]} />
        <meshBasicMaterial color="#b7a6ff" wireframe toneMapped={false} />
      </mesh>
    </>
  );
}

export const PowerUp = memo(function PowerUp({ powerUp }) {
  const ref = useRef(null);
  const wasActiveRef = useRef(false);
  const active = Boolean(powerUp);
  const currentPowerUp = powerUp ?? INACTIVE_POWER_UP;
  const world = cellToWorld(currentPowerUp.cell);
  const target = useMemo(() => new THREE.Vector3(world.x, 0.78, world.z), [world.x, world.z]);
  const color = POWER_UPS[currentPowerUp.type].color;

  useLayoutEffect(() => {
    if (active && !wasActiveRef.current) ref.current?.position.copy(target);
    wasActiveRef.current = active;
  }, [active, target]);

  useFrame(({ clock }, delta) => {
    if (!active || !ref.current) return;
    const blend = 1 - Math.exp(-12 * delta);
    ref.current.position.lerp(target, blend);
    ref.current.position.y = 0.78 + Math.sin(clock.elapsedTime * 3.1) * 0.12;
    ref.current.rotation.y += delta * 0.72;
  });

  return (
    <group ref={ref} visible={active}>
      <group visible={currentPowerUp.type === "aegis"}><AegisCore /></group>
      <group visible={currentPowerUp.type === "fang"}><FangCore /></group>
      <group visible={currentPowerUp.type === "phase"}><PhaseCore /></group>
      <Sparkles count={14} scale={1.7} size={2} speed={0.45} color={color} noise={1.1} />
      <pointLight color={color} intensity={4.2} distance={5} decay={2} />
    </group>
  );
});
