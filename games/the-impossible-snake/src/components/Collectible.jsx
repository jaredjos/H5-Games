import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cellToWorld } from "../game/constants";

export const Collectible = memo(function Collectible({ cell }) {
  const ref = useRef(null);
  const shellRef = useRef(null);
  const world = cellToWorld(cell);
  const target = useMemo(() => new THREE.Vector3(world.x, 0.78, world.z), [world.x, world.z]);

  useLayoutEffect(() => {
    ref.current?.position.copy(target);
  }, []);

  useFrame(({ clock }, delta) => {
    if (!ref.current || !shellRef.current) return;
    const blend = 1 - Math.exp(-12 * delta);
    ref.current.position.lerp(target, blend);
    ref.current.position.y = 0.78 + Math.sin(clock.elapsedTime * 2.7) * 0.13;
    ref.current.rotation.y += delta * 0.82;
    shellRef.current.rotation.x += delta * 0.28;
    shellRef.current.rotation.z -= delta * 0.2;
  });

  return (
    <group ref={ref}>
      <mesh ref={shellRef} castShadow>
        <octahedronGeometry args={[0.62, 0]} />
        <meshPhysicalMaterial
          color="#f14f3b"
          emissive="#8f120a"
          emissiveIntensity={2.2}
          metalness={0.4}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh scale={0.48} rotation-y={Math.PI / 4}>
        <octahedronGeometry args={[0.62, 0]} />
        <meshBasicMaterial color="#ffd36d" toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.82, 0.018, 8, 64]} />
        <meshBasicMaterial color="#ff8a4b" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <Sparkles count={12} scale={1.8} size={2.2} speed={0.36} color="#ff7552" noise={1.2} />
      <pointLight color="#ff4c2f" intensity={4.5} distance={5.5} decay={2} />
    </group>
  );
});
