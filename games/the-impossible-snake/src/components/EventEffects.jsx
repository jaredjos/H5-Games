import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { POWER_UPS, cellToWorld } from "../game/constants";

const EVENT_COLORS = {
  collect: "#ff8a52",
  crash: "#ff3f27",
  hunter: "#ffbd48",
  levelup: "#ffd879",
  powerend: "#9ac9d8",
  powerup: "#74fff5",
  shield: "#65fff1",
  victory: "#fff0bd",
};

function getEventColor(event) {
  if (["powerup", "powerend"].includes(event.type) && event.power) {
    return POWER_UPS[event.power]?.color ?? EVENT_COLORS[event.type];
  }
  return EVENT_COLORS[event.type];
}

function EventBurst({ event, cell, active }) {
  const groupRef = useRef(null);
  const particlesRef = useRef(null);
  const particleMaterialRef = useRef(null);
  const ringRef = useRef(null);
  const ringMaterialRef = useRef(null);
  const flashRef = useRef(null);
  const flashMaterialRef = useRef(null);
  const ageRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const world = cellToWorld(cell);
  const color = getEventColor(event) ?? "#ffffff";
  const dramatic = ["crash", "levelup", "powerup", "victory"].includes(event.type);
  const life = dramatic ? 1.35 : 0.82;
  const particleCount = dramatic ? 18 : 12;
  const particles = useMemo(
    () => Array.from({ length: 18 }, (_, index) => {
      const angle = (index / 18) * Math.PI * 2 + (index % 3) * 0.21;
      return {
        x: Math.cos(angle),
        z: Math.sin(angle),
        lift: 0.3 + (index % 5) * 0.12,
        speed: 1.8 + (index % 4) * 0.5,
        spin: 0.8 + (index % 6) * 0.4,
      };
    }),
    [],
  );

  useEffect(() => {
    ageRef.current = 0;
    if (groupRef.current) groupRef.current.visible = active;
    if (particlesRef.current) particlesRef.current.visible = active;
    if (ringRef.current) ringRef.current.visible = active;
    if (flashRef.current) flashRef.current.visible = active;
    particleMaterialRef.current?.color.set(color);
    ringMaterialRef.current?.color.set(color);
    flashMaterialRef.current?.color.set(color);
  }, [active, color, event.id]);

  useFrame((_, delta) => {
    if (!active || ageRef.current >= life) return;
    ageRef.current += delta;
    const age = ageRef.current;
    const progress = Math.min(1, age / life);
    const opacity = Math.max(0, 1 - progress);

    if (particlesRef.current) {
      particlesRef.current.visible = age < life;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const travel = particle.speed * age;
        dummy.position.set(
          particle.x * travel,
          0.22 + particle.lift * age + Math.sin(progress * Math.PI) * 0.72,
          particle.z * travel,
        );
        dummy.rotation.set(age * particle.spin, age * particle.spin * 1.4, age * 0.8);
        const scale = index < particleCount
          ? Math.max(0.001, (dramatic ? 0.14 : 0.1) * opacity)
          : 0.001;
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        particlesRef.current.setMatrixAt(index, dummy.matrix);
      }
      particlesRef.current.instanceMatrix.needsUpdate = true;
    }

    if (particleMaterialRef.current) particleMaterialRef.current.opacity = opacity * 0.88;
    if (ringRef.current) {
      const ringScale = 0.8 + progress * (dramatic ? 4.8 : 2.9);
      ringRef.current.scale.setScalar(ringScale);
      ringRef.current.visible = age < life;
    }
    if (ringMaterialRef.current) ringMaterialRef.current.opacity = opacity * 0.76;
    if (flashRef.current) {
      flashRef.current.scale.setScalar(0.35 + Math.sin(progress * Math.PI) * (dramatic ? 1.5 : 0.95));
      flashRef.current.visible = age < life;
    }
    if (flashMaterialRef.current) flashMaterialRef.current.opacity = opacity * 0.35;
    if (age >= life && groupRef.current) groupRef.current.visible = false;
  });

  return (
    <group ref={groupRef} visible={false} position={[world.x, 0.08, world.z]}>
      <instancedMesh ref={particlesRef} args={[null, null, 18]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial ref={particleMaterialRef} color={color} transparent opacity={0.88} toneMapped={false} />
      </instancedMesh>
      <mesh ref={ringRef} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.48, 0.56, 48]} />
        <meshBasicMaterial ref={ringMaterialRef} color={color} transparent opacity={0.76} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={flashRef} position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.52, 18, 18]} />
        <meshBasicMaterial ref={flashMaterialRef} color={color} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export const EventEffects = memo(function EventEffects({ event, cell }) {
  return <EventBurst event={event} cell={cell} active={Boolean(EVENT_COLORS[event.type])} />;
});
