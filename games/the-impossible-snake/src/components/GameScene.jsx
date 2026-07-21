import { memo, useEffect, useMemo, useRef } from "react";
import { ContactShadows, Preload } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { cellToWorld } from "../game/constants";
import { Arena } from "./Arena";
import { Collectible } from "./Collectible";
import { EventEffects } from "./EventEffects";
import { Hunters } from "./Hunters";
import { ObstacleField } from "./ObstacleField";
import { PowerUp } from "./PowerUp";
import { Serpent } from "./Serpent";

const powerLightColors = {
  aegis: "#ffc64a",
  fang: "#ff4226",
  phase: "#7965ff",
};

function CameraRig({ threat, event, powerType, presentationMode, reducedMotion }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const targetPosition = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const impactRef = useRef(0);

  useEffect(() => {
    const strength = event.type === "crash"
      ? 1
      : event.type === "shield" || event.type === "hunter"
        ? 0.58
        : event.type === "powerup" || event.type === "levelup" || event.type === "victory"
          ? 0.28
          : 0;
    impactRef.current = Math.max(impactRef.current, strength);
  }, [event.id, event.type]);

  useFrame(({ clock }, delta) => {
    const aspect = size.width / size.height;
    const portrait = aspect < 0.78;
    impactRef.current = THREE.MathUtils.damp(impactRef.current, 0, 5.6, delta);
    const powerDrive = powerType ? (powerType === "fang" ? 0.045 : 0.026) : 0;
    const shake = reducedMotion ? 0 : threat * 0.045 + impactRef.current * 0.16 + powerDrive;
    const shakeX = Math.sin(clock.elapsedTime * 38) * shake;
    const shakeY = Math.cos(clock.elapsedTime * 31) * shake * 0.42;

    if (portrait) {
      targetPosition.set(shakeX, 37 + shakeY, 23);
      lookTarget.set(0, 0, 0.5);
    } else if (presentationMode) {
      targetPosition.set(-4.2 + shakeX, 16.8 + shakeY, 22.8);
      lookTarget.set(-2.2, -0.25, 0);
    } else {
      targetPosition.set(shakeX, 18 + shakeY, 22.5);
      lookTarget.set(0, -0.2, 0);
    }

    const blend = 1 - Math.exp(-5 * delta);
    camera.position.lerp(targetPosition, blend);
    const powerFov = powerType && !reducedMotion ? 0.7 + Math.sin(clock.elapsedTime * 4.8) * 0.24 : 0;
    const targetFov = (portrait ? 55 : presentationMode ? 42 : 39) + threat * 0.65 + impactRef.current * 0.9 + powerFov;
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 5, delta);
    camera.lookAt(lookTarget);
    camera.updateProjectionMatrix();
  });

  return null;
}

function PowerLight({ activePower, head }) {
  const ref = useRef(null);
  const world = cellToWorld(head);
  const target = useMemo(() => new THREE.Vector3(world.x, 1.3, world.z), [world.x, world.z]);

  useFrame(({ clock }, delta) => {
    if (!ref.current || !activePower) return;
    ref.current.position.lerp(target, 1 - Math.exp(-16 * delta));
    const speed = activePower.type === "fang" ? 10 : activePower.type === "phase" ? 7 : 5;
    ref.current.intensity = 1.1 + Math.sin(clock.elapsedTime * speed) * 0.3;
  });

  if (!activePower) return null;
  return (
    <pointLight
      ref={ref}
      position={[world.x, 1.3, world.z]}
      color={powerLightColors[activePower.type]}
      intensity={1.1}
      distance={activePower.type === "fang" ? 9 : 11}
      decay={2}
    />
  );
}

function ThreatLight({ threat }) {
  const lightRef = useRef(null);

  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const pulse = 0.82 + Math.sin(clock.elapsedTime * (5 + threat * 4)) * 0.18;
    lightRef.current.intensity = threat * 4.2 * pulse;
  });

  return <pointLight ref={lightRef} position={[0, 4, 0]} color="#ff3822" intensity={0} distance={22} decay={2} />;
}

function FloatingShards({ reducedMotion }) {
  const ref = useRef(null);
  const shards = useMemo(
    () => Array.from({ length: 20 }, (_, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const lane = Math.floor(index / 2);
      return {
        position: [
          side * (13.5 + (lane % 4) * 2.2),
          -2.5 - (lane % 5) * 1.15,
          -7 + ((lane * 3.1) % 19),
        ],
        rotation: [index * 0.31, index * 0.57, index * 0.19],
        scale: 0.28 + (index % 4) * 0.14,
      };
    }),
    [],
  );

  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y += delta * 0.012;
    ref.current.rotation.z = Math.sin(performance.now() * 0.00008) * 0.018;
  });

  return (
    <group ref={ref}>
      {shards.map((shard, index) => (
        <mesh
          key={index}
          position={shard.position}
          rotation={shard.rotation}
          scale={shard.scale}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#090b0a"
            emissive="#6f430d"
            emissiveIntensity={0.22}
            metalness={0.75}
            roughness={0.52}
          />
        </mesh>
      ))}
    </group>
  );
}

function FloatingStage({ state, reducedMotion }) {
  const ref = useRef(null);

  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.36) * 0.055 - 0.1;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.16) * 0.0025;
  });

  return (
    <group ref={ref}>
      <Arena />
      <ObstacleField cells={state.obstacles} />
      <Hunters enemies={state.enemies} />
      <Serpent
        snake={state.snake}
        direction={state.direction}
        status={state.status}
        activePower={state.activePower}
      />
      <Collectible cell={state.food} />
      <PowerUp powerUp={state.powerUp} />
      <EventEffects event={state.event} cell={state.snake[0]} />
      <ContactShadows
        position={[0, 0.045, 0]}
        opacity={0.72}
        scale={26}
        blur={2.2}
        far={5.5}
        resolution={512}
        color="#000000"
      />
    </group>
  );
}

export const GameScene = memo(function GameScene({
  state,
  threat,
  presentationMode = false,
  reducedMotion = false,
}) {
  return (
    <div className="scene-layer" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 18, 22.5], fov: 41, near: 0.1, far: 120 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        shadows
      >
        <fog attach="fog" args={["#050606", 31, 78]} />
        <ambientLight intensity={0.34} color="#d6e1d8" />
        <directionalLight
          position={[-9, 16, 9]}
          color="#ffe1a4"
          intensity={3.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={42}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
        />
        <spotLight position={[12, 12, -8]} color="#4fd69d" intensity={2.6} angle={0.42} penumbra={0.72} distance={42} />
        <pointLight position={[-12, 2, 8]} color="#ff9633" intensity={4} distance={18} decay={2} />
        <ThreatLight threat={threat} />
        <PowerLight activePower={state.activePower} head={state.snake[0]} />

        <CameraRig
          threat={threat}
          event={state.event}
          powerType={state.activePower?.type}
          presentationMode={presentationMode}
          reducedMotion={reducedMotion}
        />
        <FloatingShards reducedMotion={reducedMotion} />
        <FloatingStage state={state} reducedMotion={reducedMotion} />

        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.84} luminanceSmoothing={0.2} intensity={1.18 + threat * 0.34} radius={0.58} />
          <Vignette eskil={false} offset={0.16} darkness={0.62 + threat * 0.08} />
          <Noise opacity={0.018} />
        </EffectComposer>
        <Preload all />
      </Canvas>
    </div>
  );
});
