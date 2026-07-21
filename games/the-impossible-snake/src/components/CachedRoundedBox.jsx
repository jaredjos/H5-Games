import { forwardRef } from "react";
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const EPSILON = 0.00001;
const geometryCache = new Map();

function createRoundedShape(width, height, radiusValue) {
  const shape = new THREE.Shape();
  const radius = radiusValue - EPSILON;

  shape.absarc(EPSILON, EPSILON, EPSILON, -Math.PI / 2, -Math.PI, true);
  shape.absarc(EPSILON, height - radius * 2, EPSILON, Math.PI, Math.PI / 2, true);
  shape.absarc(width - radius * 2, height - radius * 2, EPSILON, Math.PI / 2, 0, true);
  shape.absarc(width - radius * 2, EPSILON, EPSILON, 0, -Math.PI / 2, true);
  return shape;
}

function getRoundedBoxGeometry({
  args = [],
  radius = 0.05,
  steps = 1,
  smoothness = 4,
  bevelSegments = 4,
  creaseAngle = 0.4,
}) {
  const [width = 1, height = 1, depth = 1] = args;
  const key = [
    width,
    height,
    depth,
    radius,
    steps,
    smoothness,
    bevelSegments,
    creaseAngle,
  ].join(":");

  if (!geometryCache.has(key)) {
    const geometry = new THREE.ExtrudeGeometry(createRoundedShape(width, height, radius), {
      depth: depth - radius * 2,
      bevelEnabled: true,
      bevelSegments: bevelSegments * 2,
      steps,
      bevelSize: radius - EPSILON,
      bevelThickness: radius,
      curveSegments: smoothness,
    });
    geometry.center();
    toCreasedNormals(geometry, creaseAngle);
    geometryCache.set(key, geometry);
  }

  return geometryCache.get(key);
}

export const CachedRoundedBox = forwardRef(function CachedRoundedBox({
  args,
  radius,
  steps,
  smoothness,
  bevelSegments,
  creaseAngle,
  children,
  ...props
}, ref) {
  const geometry = getRoundedBoxGeometry({
    args,
    radius,
    steps,
    smoothness,
    bevelSegments,
    creaseAngle,
  });

  return (
    <mesh ref={ref} geometry={geometry} {...props}>
      {children}
    </mesh>
  );
});
