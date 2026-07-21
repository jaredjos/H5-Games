import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DIRECTIONS, LEVELS, cellToWorld } from "../game/constants";
import { CachedRoundedBox } from "./CachedRoundedBox";

const shell = new THREE.MeshStandardMaterial({
  color: "#d0cbc0",
  metalness: 0.82,
  roughness: 0.24,
});

const undercarriage = new THREE.MeshStandardMaterial({
  color: "#171513",
  metalness: 0.88,
  roughness: 0.3,
});

const legTip = new THREE.MeshStandardMaterial({
  color: "#4d4840",
  metalness: 0.88,
  roughness: 0.24,
});

const hunterBodyGeometry = new THREE.DodecahedronGeometry(0.58, 1);
const legTipGeometry = new THREE.ConeGeometry(0.13, 0.48, 5);
const coreGeometry = new THREE.SphereGeometry(0.16, 20, 20);
const crownRingGeometry = new THREE.RingGeometry(0.11, 0.22, 24);
const crownCoreGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const groundRingGeometry = new THREE.RingGeometry(0.62, 0.68, 32);
const intentOuterGeometry = new THREE.RingGeometry(0.33, 0.48, 40);
const intentInnerGeometry = new THREE.RingGeometry(0.12, 0.17, 24);
const intentBeamGeometry = new THREE.CylinderGeometry(0.025, 0.085, 0.72, 14, 1, true);
const MAX_HUNTERS = Math.max(...LEVELS.map((level) => level.hunters.length));
const HUNTER_POOL = Array.from({ length: MAX_HUNTERS }, (_, index) => index);
const INACTIVE_ENEMY = {
  id: "inactive",
  x: 0,
  z: 0,
  direction: DIRECTIONS.left,
  intent: null,
};
const INACTIVE_CELL = { x: 0, z: 0 };

function HunterIntent({ cell, index }) {
  const ref = useRef(null);
  const materialRef = useRef(null);
  const active = Boolean(cell);
  const world = cellToWorld(cell ?? INACTIVE_CELL);

  useFrame(({ clock }) => {
    if (!active || !ref.current || !materialRef.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 8 + index) * 0.13;
    ref.current.scale.setScalar(pulse);
    ref.current.rotation.y = clock.elapsedTime * 0.75 + index;
    materialRef.current.opacity = 0.58 + Math.sin(clock.elapsedTime * 8 + index) * 0.22;
  });

  return (
    <group ref={ref} visible={active} position={[world.x, 0.085, world.z]}>
      <mesh geometry={intentOuterGeometry} rotation-x={-Math.PI / 2}>
        <meshBasicMaterial ref={materialRef} color="#ff3c24" transparent opacity={0.8} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={intentInnerGeometry} position={[0, 0.13, 0]} rotation-x={-Math.PI / 2}>
        <meshBasicMaterial color="#fff0cb" transparent opacity={0.92} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={intentBeamGeometry} position={[0, 0.4, 0]}>
        <meshBasicMaterial color="#ff3c24" transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.28, 0]} color="#ff351f" intensity={2.8} distance={2.8} decay={2} />
    </group>
  );
}

function Hunter({ enemy, index }) {
  const ref = useRef(null);
  const coreRef = useRef(null);
  const previousEnemyIdRef = useRef(null);
  const active = Boolean(enemy);
  const currentEnemy = enemy ?? INACTIVE_ENEMY;
  const world = cellToWorld(currentEnemy);
  const target = useMemo(() => new THREE.Vector3(world.x, 0.48, world.z), [world.x, world.z]);
  const targetRotation = useMemo(
    () => new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, Math.atan2(currentEnemy.direction.x, currentEnemy.direction.z), 0),
    ),
    [currentEnemy.direction.x, currentEnemy.direction.z],
  );

  useLayoutEffect(() => {
    if (!ref.current) return;
    if (active && previousEnemyIdRef.current !== currentEnemy.id) {
      ref.current.position.copy(target);
      ref.current.quaternion.copy(targetRotation);
    }
    previousEnemyIdRef.current = active ? currentEnemy.id : null;
  }, [active, currentEnemy.id, target, targetRotation]);

  useFrame(({ clock }, delta) => {
    if (!active || !ref.current || !coreRef.current) return;
    const blend = 1 - Math.exp(-14 * delta);
    ref.current.position.lerp(target, blend);
    ref.current.position.y = 0.5 + Math.sin(clock.elapsedTime * 3.4 + index) * 0.045;
    ref.current.quaternion.slerp(targetRotation, blend);
    const corePulse = currentEnemy.intent ? 10 : 7;
    coreRef.current.scale.setScalar(0.92 + Math.sin(clock.elapsedTime * corePulse + index) * (currentEnemy.intent ? 0.28 : 0.18));
  });

  return (
    <>
      <HunterIntent cell={currentEnemy.intent} index={index} />
      <group ref={ref} visible={active} scale={1.2}>
        <mesh geometry={hunterBodyGeometry} material={shell} scale={[0.82, 0.38, 0.92]} castShadow receiveShadow>
        </mesh>
        <CachedRoundedBox args={[0.52, 0.18, 0.62]} radius={0.06} smoothness={3} position={[0, -0.13, 0]} material={undercarriage} castShadow />

        {[-1, 1].flatMap((side) => [-1, 1].map((front) => (
          <group key={`${side}:${front}`} position={[side * 0.5, -0.08, front * 0.3]} rotation-y={side * front * 0.22}>
            <CachedRoundedBox
              args={[0.48, 0.12, 0.18]}
              radius={0.05}
              smoothness={3}
              rotation-z={side * -0.52}
              position={[side * 0.12, -0.08, 0]}
              material={shell}
              castShadow
            />
            <mesh geometry={legTipGeometry} material={legTip} position={[side * 0.34, -0.2, 0]} rotation-z={side * -0.55} castShadow>
            </mesh>
          </group>
        )))}

        <mesh ref={coreRef} geometry={coreGeometry} position={[0, 0.02, 0.52]}>
          <meshBasicMaterial color="#ff3c24" toneMapped={false} />
        </mesh>
        <mesh geometry={crownRingGeometry} position={[0, 0.3, 0]} rotation-x={-Math.PI / 2}>
          <meshBasicMaterial color="#ff4a2c" toneMapped={false} />
        </mesh>
        <mesh geometry={crownCoreGeometry} position={[0, 0.29, 0]}>
          <meshBasicMaterial color="#fff0cb" toneMapped={false} />
        </mesh>
        <mesh geometry={groundRingGeometry} position={[0, -0.39, 0]} rotation-x={-Math.PI / 2}>
          <meshBasicMaterial color="#ff3c24" transparent opacity={0.48} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0.28, 0.2]} color="#ff351f" intensity={currentEnemy.intent ? 6.4 : 4.4} distance={4.8} decay={2} />
      </group>
    </>
  );
}

export const Hunters = memo(function Hunters({ enemies }) {
  return (
    <group>
      {HUNTER_POOL.map((index) => (
        <Hunter key={index} enemy={enemies[index] ?? null} index={index} />
      ))}
    </group>
  );
});
