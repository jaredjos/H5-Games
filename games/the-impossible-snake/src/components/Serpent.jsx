import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { INITIAL_SNAKE, LEVELS, cellToWorld } from "../game/constants";
import { CachedRoundedBox } from "./CachedRoundedBox";

const MAX_SNAKE_LENGTH = INITIAL_SNAKE.length + Math.max(...LEVELS.map((level) => level.target));
const MAX_BODY_SAMPLES = Math.max(
  MAX_SNAKE_LENGTH - 1,
  Math.round((MAX_SNAKE_LENGTH - 1) * 1.4),
);
const BODY_SEGMENT_POOL = Array.from({ length: MAX_BODY_SAMPLES }, (_, index) => index);
const INACTIVE_BODY_SAMPLE = {
  position: { x: 0, z: 0 },
  heading: { x: 1, z: 0 },
};

const jade = new THREE.MeshPhysicalMaterial({
  color: "#126247",
  metalness: 0.76,
  roughness: 0.24,
  clearcoat: 0.85,
  clearcoatRoughness: 0.18,
});

const darkJade = new THREE.MeshStandardMaterial({
  color: "#061b16",
  metalness: 0.72,
  roughness: 0.3,
});

const gold = new THREE.MeshStandardMaterial({
  color: "#ffbe44",
  emissive: "#d77b08",
  emissiveIntensity: 3.5,
  metalness: 0.65,
  roughness: 0.2,
  toneMapped: false,
});

const powerColors = {
  aegis: "#ffd45a",
  fang: "#ff6a32",
  phase: "#9b82ff",
};

const powerStyles = {
  aegis: {
    shell: "#87620f",
    dark: "#2f2307",
    emissive: "#f6a51b",
    accent: "#ffd45a",
    opacity: 1,
    speed: 4.2,
  },
  fang: {
    shell: "#7e1c12",
    dark: "#290806",
    emissive: "#e83b20",
    accent: "#ff812c",
    opacity: 1,
    speed: 10.5,
  },
  phase: {
    shell: "#302a78",
    dark: "#0b0925",
    emissive: "#7661ff",
    accent: "#aa94ff",
    opacity: 0.48,
    speed: 8.6,
  },
};

const powerMaterials = Object.fromEntries(
  Object.entries(powerStyles).map(([type, style]) => [
    type,
    {
      shell: new THREE.MeshPhysicalMaterial({
        color: style.shell,
        emissive: style.emissive,
        emissiveIntensity: type === "phase" ? 0.32 : type === "fang" ? 0.24 : 0.16,
        metalness: 0.62,
        roughness: 0.27,
        clearcoat: 0.86,
        clearcoatRoughness: 0.16,
        transparent: type === "phase",
        opacity: style.opacity,
      }),
      dark: new THREE.MeshStandardMaterial({
        color: style.dark,
        emissive: style.emissive,
        emissiveIntensity: 0.12,
        metalness: 0.72,
        roughness: 0.3,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: style.accent,
        emissive: style.emissive,
        emissiveIntensity: 0.32,
        metalness: 0.48,
        roughness: 0.24,
      }),
    },
  ]),
);

function useSmoothTransform(ref, world, heading, active = true) {
  const wasActiveRef = useRef(false);
  const targetPosition = useMemo(
    () => new THREE.Vector3(world.x, 0.42, world.z),
    [world.x, world.z],
  );
  const targetRotation = useMemo(() => {
    const angle = Math.atan2(heading.x, heading.z);
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0));
  }, [heading.x, heading.z]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    if (active && !wasActiveRef.current) {
      ref.current.position.copy(targetPosition);
      ref.current.quaternion.copy(targetRotation);
    }
    wasActiveRef.current = active;
  }, [active, targetPosition, targetRotation]);

  useFrame((_, delta) => {
    if (!active || !ref.current) return;
    const blend = 1 - Math.exp(-18 * delta);
    ref.current.position.lerp(targetPosition, blend);
    ref.current.quaternion.slerp(targetRotation, blend);
  });
}

const BodySegment = memo(function BodySegment({ position, heading, index, total, powerType, active }) {
  const ref = useRef(null);
  const energyRef = useRef(null);
  useSmoothTransform(ref, position, heading, active);
  const taper = Math.max(0.55, 1 - (index / Math.max(total - 1, 1)) * 0.38);
  const style = powerStyles[powerType];
  const materials = powerMaterials[powerType] ?? { shell: jade, dark: darkJade, accent: gold };
  const profile = powerType === "aegis"
    ? [1.13, 1.08, 1.1]
    : powerType === "phase"
      ? [0.9, 0.92, 0.94]
      : [1, 1, 1];

  useFrame(({ clock }) => {
    if (!active || !style || !energyRef.current) return;
    const wave = (Math.sin(clock.elapsedTime * style.speed - index * 0.72) + 1) * 0.5;
    energyRef.current.position.y = Math.sin(clock.elapsedTime * style.speed - index * 0.48) * 0.035;
    energyRef.current.scale.y = 0.98 + wave * 0.07;
  });

  return (
    <group ref={ref} visible={active} scale={[taper * profile[0], taper * profile[1], taper * profile[2]]}>
      <group ref={energyRef}>
        <CachedRoundedBox args={[0.86, 0.52, 0.78]} radius={0.14} smoothness={4} material={materials.shell} castShadow receiveShadow />
        <CachedRoundedBox args={[0.62, 0.12, 0.48]} radius={0.05} smoothness={3} position={[0, 0.31, -0.02]} material={materials.dark} castShadow />
        {[-0.36, 0.36].map((z) => (
          <CachedRoundedBox key={z} args={[0.7, 0.1, 0.14]} radius={0.04} smoothness={2} position={[0, 0.04, z]} material={materials.accent} />
        ))}
        {style && index % 2 === 0 ? (
          <mesh position={[0, 0.03, 0]}>
            <torusGeometry args={[0.5, 0.018, 6, powerType === "fang" ? 4 : powerType === "aegis" ? 6 : 28]} />
            <meshBasicMaterial color={style.accent} transparent opacity={0.72} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        ) : null}
        {powerType === "aegis" && index % 2 === 0 ? (
          <group position={[0, 0.43, -0.02]} rotation-y={index % 4 === 0 ? 0 : Math.PI / 6}>
            <mesh scale={[1, 0.28, 0.9]} material={materials.accent}>
              <cylinderGeometry args={[0.32, 0.32, 0.12, 6]} />
            </mesh>
            <mesh position={[0, 0.022, 0]} scale={[0.58, 0.32, 0.58]} material={materials.dark}>
              <cylinderGeometry args={[0.32, 0.32, 0.12, 6]} />
            </mesh>
          </group>
        ) : null}
        {powerType === "fang" && index % 3 === 0 ? (
          <mesh position={[0, 0.5, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[0.12, 0.38, 4]} />
            <meshBasicMaterial color={style.accent} transparent opacity={0.88} toneMapped={false} />
          </mesh>
        ) : null}
        {powerType === "phase" ? (
          <group>
            <mesh position={[0, 0.04, -0.13]} scale={[1.12, 1.18, 1.12]}>
              <boxGeometry args={[0.86, 0.52, 0.78]} />
              <meshBasicMaterial color={style.accent} transparent opacity={0.17} wireframe blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.08, -0.28]} scale={[1.02, 1.08, 1.18]}>
              <boxGeometry args={[0.86, 0.52, 0.78]} />
              <meshBasicMaterial color={style.emissive} transparent opacity={0.08} wireframe blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        ) : null}
      </group>
    </group>
  );
});

function PowerAura({ type }) {
  const ref = useRef(null);
  const materialRef = useRef(null);
  const secondaryRef = useRef(null);
  const color = powerColors[type];

  useFrame(({ clock }, delta) => {
    if (!ref.current || !materialRef.current) return;
    ref.current.rotation.y += delta * (type === "fang" ? 2.8 : type === "phase" ? 1.8 : 0.9);
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 2.2) * (type === "phase" ? 0.38 : 0.22);
    const pulse = 0.96 + Math.sin(clock.elapsedTime * (type === "fang" ? 8.4 : 5.2)) * 0.09;
    ref.current.scale.setScalar(pulse);
    materialRef.current.opacity = 0.34 + Math.sin(clock.elapsedTime * 4.2) * 0.08;
    if (secondaryRef.current) secondaryRef.current.rotation.z -= delta * (type === "fang" ? 3.6 : 1.6);
  });

  return (
    <group ref={ref}>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.02, 0.045, 8, type === "fang" ? 5 : type === "aegis" ? 6 : 56]} />
        <meshBasicMaterial ref={materialRef} color={color} transparent opacity={0.36} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={secondaryRef}>
        <mesh rotation={[Math.PI / 2, Math.PI / 3, 0]}>
          <torusGeometry args={[type === "phase" ? 1.18 : 0.82, 0.022, 6, type === "fang" ? 4 : 40]} />
          <meshBasicMaterial color={color} transparent opacity={type === "phase" ? 0.48 : 0.28} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, -Math.PI / 3, Math.PI / 2]}>
          <torusGeometry args={[type === "aegis" ? 1.12 : 0.74, 0.018, 6, type === "fang" ? 3 : 36]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {type === "aegis" ? (
        <group>
          <mesh scale={[1.18, 0.82, 1.36]}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={color} transparent opacity={0.19} wireframe blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh rotation-x={Math.PI / 2}>
            <ringGeometry args={[0.52, 0.72, 6]} />
            <meshBasicMaterial color="#fff0a3" transparent opacity={0.26} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
      {type === "fang" ? (
        <group position={[0, 0.04, 0.5]}>
          {[-0.46, 0, 0.46].map((x, index) => (
            <mesh key={x} position={[x, 0.1 + Math.abs(x) * 0.18, -index * 0.12]} rotation={[Math.PI * 0.12, 0, x * 0.7]}>
              <coneGeometry args={[0.11, 0.72, 4]} />
              <meshBasicMaterial color={index === 1 ? "#fff0a8" : color} transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ) : null}
      {type === "phase" ? (
        <mesh scale={[1.3, 0.74, 1.48]}>
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial color={color} transparent opacity={0.11} wireframe blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

const SerpentHead = memo(function SerpentHead({ cell, heading, status, powerType }) {
  const ref = useRef(null);
  const pulseRef = useRef(null);
  const world = cellToWorld(cell);
  const style = powerStyles[powerType];
  const materials = powerMaterials[powerType];
  useSmoothTransform(ref, world, heading);

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const pulse = powerType
      ? 1 + Math.sin(clock.elapsedTime * style.speed) * 0.22
      : status === "ready"
        ? 1 + Math.sin(clock.elapsedTime * 2.4) * 0.18
        : 1;
    pulseRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={ref}>
      {powerType ? <PowerAura type={powerType} /> : null}
      {style ? (
        <CachedRoundedBox args={[1.18, 0.66, 1.42]} radius={0.2} smoothness={5} material={materials.shell} castShadow receiveShadow />
      ) : (
        <CachedRoundedBox args={[1.18, 0.66, 1.42]} radius={0.2} smoothness={5} material={jade} castShadow receiveShadow />
      )}
      <mesh position={[0, 0.08, 0.62]} scale={[0.88, 0.48, 0.88]} castShadow>
        <dodecahedronGeometry args={[0.62, 1]} />
        {style ? (
          <primitive object={materials.shell} attach="material" />
        ) : (
          <primitive object={jade} attach="material" />
        )}
      </mesh>
      {style ? (
        <CachedRoundedBox args={[0.72, 0.15, 0.65]} radius={0.06} smoothness={3} position={[0, 0.36, -0.08]} material={materials.dark} castShadow />
      ) : (
        <CachedRoundedBox args={[0.72, 0.15, 0.65]} radius={0.06} smoothness={3} position={[0, 0.36, -0.08]} material={darkJade} castShadow />
      )}
      {style ? (
        <CachedRoundedBox args={[0.72, 0.1, 0.18]} radius={0.04} smoothness={2} position={[0, 0.05, -0.54]} material={materials.accent} />
      ) : (
        <CachedRoundedBox args={[0.72, 0.1, 0.18]} radius={0.04} smoothness={2} position={[0, 0.05, -0.54]} material={gold} />
      )}

      {powerType === "aegis" ? (
        <group position={[0, 0.52, -0.04]}>
          <mesh scale={[1.25, 0.28, 1]} material={materials.accent}>
            <cylinderGeometry args={[0.42, 0.42, 0.14, 6]} />
          </mesh>
          <mesh position={[0, 0.026, 0]} scale={[0.68, 0.32, 0.55]} material={materials.dark}>
            <cylinderGeometry args={[0.42, 0.42, 0.14, 6]} />
          </mesh>
        </group>
      ) : null}
      {powerType === "phase" ? (
        <mesh position={[0, 0.08, -0.34]} scale={[1.14, 0.76, 1.2]}>
          <dodecahedronGeometry args={[0.82, 0]} />
          <meshBasicMaterial color={style.accent} transparent opacity={0.16} wireframe blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}

      {[-0.34, 0.34].map((x) => (
        <group key={x} ref={x < 0 ? pulseRef : undefined} position={[x, 0.2, 0.69]}>
          <mesh>
            <sphereGeometry args={[0.09, 18, 18]} />
            <meshBasicMaterial color={style?.accent ?? "#ffd778"} toneMapped={false} />
          </mesh>
          <pointLight color={style?.emissive ?? "#ff9f2f"} intensity={powerType ? 2.4 : 1.2} distance={powerType ? 3.8 : 2.5} decay={2} />
        </group>
      ))}
    </group>
  );
});

function TailAura({ cell, powerType }) {
  const ref = useRef(null);
  const materialRef = useRef(null);
  const world = cellToWorld(cell);
  const style = powerStyles[powerType];
  const target = useMemo(() => new THREE.Vector3(world.x, 0.09, world.z), [world.x, world.z]);

  useLayoutEffect(() => {
    ref.current?.position.copy(target);
  }, []);

  useFrame(({ clock }, delta) => {
    if (!ref.current || !materialRef.current) return;
    const blend = 1 - Math.exp(-14 * delta);
    ref.current.position.lerp(target, blend);
    ref.current.rotation.y -= delta * (style ? style.speed * 0.28 : 0.7);
    const pulse = 0.92 + Math.sin(clock.elapsedTime * (style?.speed ?? 3.2)) * (style ? 0.16 : 0.1);
    ref.current.scale.setScalar(pulse);
    materialRef.current.opacity = (style ? 0.5 : 0.34) + Math.sin(clock.elapsedTime * (style?.speed ?? 2.8)) * 0.08;
  });

  return (
    <group ref={ref}>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.78, 0.025, 8, 64]} />
        <meshBasicMaterial ref={materialRef} color={style?.emissive ?? "#ffc85c"} transparent opacity={0.42} blending={style ? THREE.AdditiveBlending : THREE.NormalBlending} depthWrite={!style} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} scale={0.68}>
        <torusGeometry args={[0.78, 0.014, 8, 48]} />
        <meshBasicMaterial color={style?.accent ?? "#fff0b4"} transparent opacity={style ? 0.46 : 0.28} blending={style ? THREE.AdditiveBlending : THREE.NormalBlending} depthWrite={!style} toneMapped={false} />
      </mesh>
    </group>
  );
}

function useSnakeCurve(snake, height) {
  return useMemo(() => {
    if (snake.length < 2) return null;
    const points = snake.map((cell) => {
      const world = cellToWorld(cell);
      return new THREE.Vector3(world.x, height, world.z);
    });
    return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.45);
  }, [height, snake]);
}

function PowerTrail({ snake, powerType }) {
  const materialRef = useRef(null);
  const curve = useSnakeCurve(snake, 0.18);
  const style = powerStyles[powerType];

  useFrame(({ clock }) => {
    if (!materialRef.current || !style) return;
    const wave = (Math.sin(clock.elapsedTime * style.speed) + 1) * 0.5;
    materialRef.current.opacity = (powerType === "phase" ? 0.2 : powerType === "aegis" ? 0.48 : 0.42) + wave * 0.2;
  });

  if (!curve || !style) return null;
  const radius = powerType === "phase" ? 0.045 : powerType === "aegis" ? 0.11 : 0.06;

  return (
    <mesh>
      <tubeGeometry args={[curve, Math.max(36, snake.length * 5), radius, 7, false]} />
      <meshBasicMaterial
        ref={materialRef}
        color={style.emissive}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

const POWER_SPARK_COUNT = 30;

function PowerSparks({ snake, powerType }) {
  const ref = useRef(null);
  const materialRef = useRef(null);
  const curve = useSnakeCurve(snake, 0.44);
  const style = powerStyles[powerType];
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!ref.current || !materialRef.current || !curve || !style) return;
    const travelSpeed = powerType === "fang" ? 0.25 : powerType === "phase" ? 0.22 : 0.11;
    const orbitRadius = powerType === "phase" ? 0.82 : powerType === "aegis" ? 0.34 : 0.4;
    for (let index = 0; index < POWER_SPARK_COUNT; index += 1) {
      const progress = (clock.elapsedTime * travelSpeed + index / POWER_SPARK_COUNT) % 1;
      curve.getPointAt(progress, point);
      const angle = clock.elapsedTime * style.speed + index * 2.17;
      dummy.position.set(
        point.x + Math.cos(angle) * orbitRadius,
        point.y + Math.sin(angle * 1.6) * (powerType === "phase" ? 0.58 : powerType === "aegis" ? 0.18 : 0.28),
        point.z + Math.sin(angle) * orbitRadius,
      );
      dummy.rotation.set(angle * 0.6, angle, -angle * 0.4);
      const pulse = 0.7 + (Math.sin(angle * 1.8) + 1) * 0.22;
      dummy.scale.setScalar((powerType === "fang" ? 0.11 : 0.085) * pulse);
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    materialRef.current.opacity = 0.55 + Math.sin(clock.elapsedTime * style.speed) * 0.14;
  });

  if (!curve || !style) return null;

  return (
    <instancedMesh ref={ref} args={[null, null, POWER_SPARK_COUNT]} frustumCulled={false}>
      {powerType === "aegis" ? <octahedronGeometry args={[1, 0]} /> : <tetrahedronGeometry args={[1, 0]} />}
      <meshBasicMaterial
        ref={materialRef}
        color={style.accent}
        transparent
        opacity={0.68}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export const Serpent = memo(function Serpent({ snake, direction, status, activePower }) {
  const powerType = activePower?.type ?? null;
  const bodySamples = useMemo(() => {
    if (snake.length < 2) return [];
    const points = snake.map((cell) => {
      const world = cellToWorld(cell);
      return new THREE.Vector3(world.x, 0.42, world.z);
    });
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.45);
    const sampleCount = Math.max(snake.length - 1, Math.round((snake.length - 1) * 1.4));

    return Array.from({ length: sampleCount }, (_, index) => {
      const t = (index + 1) / sampleCount;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      return {
        position: { x: point.x, z: point.z },
        heading: { x: tangent.x, z: tangent.z },
      };
    });
  }, [snake]);

  return (
    <group>
      {powerType ? <PowerTrail snake={snake} powerType={powerType} /> : null}
      {powerType ? <PowerSparks snake={snake} powerType={powerType} /> : null}
      <TailAura cell={snake[snake.length - 1]} powerType={powerType} />
      <SerpentHead cell={snake[0]} heading={direction} status={status} powerType={powerType} />
      {BODY_SEGMENT_POOL.map((index) => {
        const sample = bodySamples[index] ?? INACTIVE_BODY_SAMPLE;
        return (
          <BodySegment
            key={`segment-${index}`}
            position={sample.position}
            heading={sample.heading}
            index={index}
            total={bodySamples.length}
            powerType={powerType}
            active={index < bodySamples.length}
          />
        );
      })}
    </group>
  );
});
