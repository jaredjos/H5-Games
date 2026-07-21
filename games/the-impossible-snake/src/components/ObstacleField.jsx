import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LEVELS, cellToWorld } from "../game/constants";
import { CachedRoundedBox } from "./CachedRoundedBox";

const obstacleStone = new THREE.MeshStandardMaterial({
  color: "#171814",
  emissive: "#4b2807",
  emissiveIntensity: 0.5,
  metalness: 0.82,
  roughness: 0.24,
});

const obstacleGold = new THREE.MeshStandardMaterial({
  color: "#9b6b24",
  emissive: "#6d3507",
  emissiveIntensity: 0.9,
  metalness: 0.86,
  roughness: 0.2,
});

const crystalMaterial = new THREE.MeshPhysicalMaterial({
  color: "#ffb52d",
  emissive: "#d86308",
  emissiveIntensity: 3.1,
  metalness: 0.38,
  roughness: 0.14,
  clearcoat: 1,
  toneMapped: false,
});

const spireGeometry = new THREE.OctahedronGeometry(0.58, 0);
const collarGeometry = new THREE.CylinderGeometry(0.42, 0.5, 0.09, 4);
const crystalGeometry = new THREE.OctahedronGeometry(0.54, 0);
const MAX_OBSTACLES = Math.max(...LEVELS.map((level) => level.obstacles.length));
const OBSTACLE_POOL = Array.from({ length: MAX_OBSTACLES }, (_, index) => index);
const INACTIVE_CELL = { x: 0, z: 0 };

function Spire({ cell, index }) {
  const crystalRef = useRef(null);
  const active = Boolean(cell);
  const world = cellToWorld(cell ?? INACTIVE_CELL);

  useFrame(({ clock }) => {
    if (!active || !crystalRef.current) return;
    crystalRef.current.rotation.y = clock.elapsedTime * 0.18 + index * 0.7;
    const pulse = 0.96 + Math.sin(clock.elapsedTime * 2.1 + index) * 0.05;
    crystalRef.current.scale.set(0.5 * pulse, 1.02 * pulse, 0.5 * pulse);
  });

  return (
    <group visible={active} position={[world.x, 0, world.z]}>
      <CachedRoundedBox args={[0.86, 0.22, 0.86]} radius={0.06} smoothness={3} position={[0, 0.12, 0]} material={obstacleGold} castShadow receiveShadow />
      <CachedRoundedBox args={[0.66, 0.42, 0.66]} radius={0.05} smoothness={3} position={[0, 0.38, 0]} material={obstacleStone} castShadow receiveShadow />
      <mesh geometry={spireGeometry} material={obstacleStone} position={[0, 0.98, 0]} scale={[0.62, 1.28, 0.62]} rotation-y={Math.PI / 4} castShadow receiveShadow>
      </mesh>
      <mesh geometry={collarGeometry} material={obstacleGold} position={[0, 0.65, 0]} rotation-y={Math.PI / 4}>
      </mesh>
      <mesh ref={crystalRef} geometry={crystalGeometry} material={crystalMaterial} position={[0, 1.68, 0]} castShadow>
      </mesh>
    </group>
  );
}

export const ObstacleField = memo(function ObstacleField({ cells }) {
  return (
    <group>
      {OBSTACLE_POOL.map((index) => (
        <Spire key={index} cell={cells[index] ?? null} index={index} />
      ))}
    </group>
  );
});
