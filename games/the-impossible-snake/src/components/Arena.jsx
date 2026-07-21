import { useEffect, useMemo } from "react";
import { RoundedBox, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BOARD_COLS, BOARD_ROWS, CELL_SIZE } from "../game/constants";

const boardWidth = BOARD_COLS * CELL_SIZE;
const boardDepth = BOARD_ROWS * CELL_SIZE;
const facadePanelPositions = Array.from({ length: 9 }, (_, index) => (index - 4) * 2.18);

function CornerTower({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[1.05, 1.55, 1.05]} radius={0.12} smoothness={4} position={[0, -0.23, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#080b0a" metalness={0.82} roughness={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.78, 0.15, 0.78]} radius={0.05} smoothness={3} position={[0, 0.61, 0]} castShadow>
        <meshStandardMaterial color="#7a5a22" metalness={0.95} roughness={0.2} />
      </RoundedBox>
      <mesh position={[0, 0.71, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.16, 0.3, 24]} />
        <meshBasicMaterial color="#ffc85c" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.05, 0]} color="#ffb13d" intensity={3.2} distance={5} decay={2} />
    </group>
  );
}

function Rail({ position, scale }) {
  return (
    <RoundedBox args={scale} radius={0.08} smoothness={3} position={position} castShadow receiveShadow>
      <meshStandardMaterial color="#181713" metalness={0.9} roughness={0.26} />
    </RoundedBox>
  );
}

function ArenaGrid() {
  const geometry = useMemo(() => {
    const points = [];
    const halfWidth = boardWidth / 2;
    const halfDepth = boardDepth / 2;

    for (let column = 0; column <= BOARD_COLS; column += 1) {
      const x = -halfWidth + column * CELL_SIZE;
      points.push(x, 0.038, -halfDepth, x, 0.038, halfDepth);
    }

    for (let row = 0; row <= BOARD_ROWS; row += 1) {
      const z = -halfDepth + row * CELL_SIZE;
      points.push(-halfWidth, 0.038, z, halfWidth, 0.038, z);
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return nextGeometry;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#ded6c3" transparent opacity={0.16} toneMapped={false} />
    </lineSegments>
  );
}

export function Arena() {
  const floorTexture = useTexture(`${import.meta.env.BASE_URL}assets/arena-obsidian.png`);
  const gl = useThree((state) => state.gl);
  const halfWidth = boardWidth / 2;
  const halfDepth = boardDepth / 2;

  useEffect(() => {
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(2.6, 1.85);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    floorTexture.anisotropy = Math.min(12, gl.capabilities.getMaxAnisotropy());
    floorTexture.needsUpdate = true;
  }, [floorTexture, gl]);

  return (
    <group>
      <RoundedBox args={[boardWidth + 1.45, 1.18, boardDepth + 1.45]} radius={0.24} smoothness={5} position={[0, -0.71, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#050706" metalness={0.8} roughness={0.44} />
      </RoundedBox>
      <RoundedBox args={[boardWidth + 0.35, 1.25, boardDepth + 0.35]} radius={0.16} smoothness={4} position={[0, -1.63, 0]} castShadow>
        <meshStandardMaterial color="#030504" metalness={0.74} roughness={0.5} />
      </RoundedBox>

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[boardWidth, boardDepth, 1, 1]} />
        <meshStandardMaterial
          map={floorTexture}
          bumpMap={floorTexture}
          bumpScale={0.075}
          color="#aaa69e"
          metalness={0.28}
          roughness={0.62}
        />
      </mesh>

      <ArenaGrid />

      <Rail position={[0, 0.2, -halfDepth - 0.42]} scale={[boardWidth + 1.25, 0.34, 0.48]} />
      <Rail position={[0, 0.2, halfDepth + 0.42]} scale={[boardWidth + 1.25, 0.34, 0.48]} />
      <Rail position={[-halfWidth - 0.42, 0.2, 0]} scale={[0.48, 0.34, boardDepth + 1.25]} />
      <Rail position={[halfWidth + 0.42, 0.2, 0]} scale={[0.48, 0.34, boardDepth + 1.25]} />

      {facadePanelPositions.map((x) => (
        <group key={x} position={[x, -1.35, halfDepth + 0.76]}>
          <RoundedBox args={[1.55, 0.82, 0.12]} radius={0.06} smoothness={3} castShadow>
            <meshStandardMaterial color="#070908" metalness={0.86} roughness={0.34} />
          </RoundedBox>
          <RoundedBox args={[1.02, 0.055, 0.14]} radius={0.02} smoothness={2} position={[0, 0.25, 0.02]}>
            <meshStandardMaterial color="#8f6424" emissive="#5f3508" emissiveIntensity={0.7} metalness={0.9} roughness={0.24} />
          </RoundedBox>
        </group>
      ))}

      {[
        [-halfWidth - 0.52, -halfDepth - 0.52],
        [halfWidth + 0.52, -halfDepth - 0.52],
        [-halfWidth - 0.52, halfDepth + 0.52],
        [halfWidth + 0.52, halfDepth + 0.52],
      ].map(([x, z]) => (
        <CornerTower key={`${x}:${z}`} x={x} z={z} />
      ))}
    </group>
  );
}
