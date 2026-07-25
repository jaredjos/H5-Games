import type { Vec2 } from '../shared/types'

export const WEAPON_PATTERN_STAGES = [
  'solo',
  'combined',
  'mastered',
  'final',
] as const

export type WeaponPatternStage = (typeof WEAPON_PATTERN_STAGES)[number]
export type ReplacementWeaponId = 'ash-halo' | 'null-bell'
export type ReplacementPatternKind = 'graveglass-spires' | 'eclipse-harrow'
export type PatternTargetId = number | string

export interface PatternTarget<
  TId extends PatternTargetId = PatternTargetId,
> extends Vec2 {
  readonly id: TId
  readonly vx?: number
  readonly vy?: number
  readonly active?: boolean
}

export interface PatternBuildInput<
  TId extends PatternTargetId = PatternTargetId,
> {
  readonly origin: Vec2
  readonly targets: readonly PatternTarget<TId>[]
  readonly stage: WeaponPatternStage
  readonly seed?: number
  readonly minimumRange?: number
  readonly clusterRadius?: number
  readonly predictionSeconds?: number
}

interface PatternStrikeBase {
  readonly index: number
  readonly delay: number
}

export interface CirclePatternStrike extends PatternStrikeBase {
  readonly kind: 'circle'
  readonly center: Readonly<Vec2>
  readonly radius: number
  readonly parentIndex: number | null
}

export type HarrowStrikeRole =
  | 'primary'
  | 'echo'
  | 'left-lane'
  | 'center-lane'
  | 'right-lane'
  | 'left-nave'
  | 'right-nave'
  | 'left-vault'
  | 'right-vault'

export interface CapsulePatternStrike extends PatternStrikeBase {
  readonly kind: 'capsule'
  readonly start: Readonly<Vec2>
  readonly end: Readonly<Vec2>
  readonly radius: number
  readonly role: HarrowStrikeRole
}

export type PatternStrike = CirclePatternStrike | CapsulePatternStrike

export interface RemotePatternCluster<
  TId extends PatternTargetId = PatternTargetId,
> {
  readonly anchorId: TId
  readonly center: Readonly<Vec2>
  readonly targetIds: readonly TId[]
  readonly density: number
  readonly spread: number
  readonly predictionSeconds: number
}

export type GraveglassFormation = 'jagged-branch'
export type EclipseHarrowFormation =
  | 'single-lane'
  | 'crossed-lanes'
  | 'staggered-lanes'
  | 'cathedral'

interface ReplacementWeaponPatternBase<
  TId extends PatternTargetId,
  TKind extends ReplacementPatternKind,
  TStrike extends PatternStrike,
  TFormation extends string,
> {
  readonly kind: TKind
  readonly stage: WeaponPatternStage
  readonly formation: TFormation
  readonly origin: Readonly<Vec2>
  readonly aimPoint: Readonly<Vec2>
  readonly aimAngle: number
  readonly cluster: RemotePatternCluster<TId>
  readonly strikes: readonly TStrike[]
}

export type GraveglassSpiresPattern<
  TId extends PatternTargetId = PatternTargetId,
> = ReplacementWeaponPatternBase<
  TId,
  'graveglass-spires',
  CirclePatternStrike,
  GraveglassFormation
>

export type EclipseHarrowPattern<
  TId extends PatternTargetId = PatternTargetId,
> = ReplacementWeaponPatternBase<
  TId,
  'eclipse-harrow',
  CapsulePatternStrike,
  EclipseHarrowFormation
>

export type ReplacementWeaponPattern<
  TId extends PatternTargetId = PatternTargetId,
> = GraveglassSpiresPattern<TId> | EclipseHarrowPattern<TId>

export interface PatternHit<TTarget extends PatternTarget = PatternTarget> {
  readonly target: TTarget
  readonly targetId: TTarget['id']
  readonly strike: PatternStrike
  readonly strikeIndex: number
  readonly delay: number
}

interface PreparedTarget<TId extends PatternTargetId> {
  readonly target: PatternTarget<TId>
  readonly point: Readonly<Vec2>
}

interface ClusterCandidate<TId extends PatternTargetId> {
  readonly anchor: PreparedTarget<TId>
  readonly members: readonly PreparedTarget<TId>[]
  readonly center: Readonly<Vec2>
  readonly spread: number
  readonly distanceFromOriginSquared: number
}

const STAGE_INDEX: Readonly<Record<WeaponPatternStage, number>> = Object.freeze({
  solo: 0,
  combined: 1,
  mastered: 2,
  final: 3,
})

const GRAVEGLASS_STRIKE_COUNTS = Object.freeze([2, 3, 4, 6])
const HARROW_STRIKE_COUNTS = Object.freeze([1, 2, 3, 4])
const GRAVEGLASS_PARENT_INDICES = Object.freeze([
  null,
  0,
  0,
  1,
  2,
  3,
] as const)
const SCORE_EPSILON = 0.000001

const finiteOr = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback

const freezePoint = (point: Vec2): Readonly<Vec2> =>
  Object.freeze({ x: point.x, y: point.y })

const pointDistanceSquared = (first: Vec2, second: Vec2) => {
  const dx = first.x - second.x
  const dy = first.y - second.y
  return dx * dx + dy * dy
}

const stableIdToken = (id: PatternTargetId) =>
  typeof id === 'number' ? `number:${id}` : `string:${id}`

const compareTargetIds = (left: PatternTargetId, right: PatternTargetId) => {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'number') return -1
  if (typeof right === 'number') return 1
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const comparePreparedTargets = (
  left: PreparedTarget<PatternTargetId>,
  right: PreparedTarget<PatternTargetId>,
) => {
  const idComparison = compareTargetIds(left.target.id, right.target.id)
  if (idComparison !== 0) return idComparison
  if (left.point.x !== right.point.x) return left.point.x - right.point.x
  return left.point.y - right.point.y
}

const normalizeSeed = (seed: number | undefined) =>
  Math.trunc(finiteOr(seed, 0)) >>> 0

const hashTargetId = (id: PatternTargetId) => {
  const token = stableIdToken(id)
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const seededUnit = (seed: number, salt: number) => {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296
}

const normalizedDirection = (from: Vec2, to: Vec2, seed: number) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const magnitude = Math.hypot(dx, dy)
  if (magnitude > 0.000001) return { x: dx / magnitude, y: dy / magnitude }
  const fallbackAngle = seededUnit(seed, 97) * Math.PI * 2
  return { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) }
}

const predictedPoint = (
  target: PatternTarget,
  predictionSeconds: number,
): Readonly<Vec2> =>
  freezePoint({
    x: target.x + finiteOr(target.vx, 0) * predictionSeconds,
    y: target.y + finiteOr(target.vy, 0) * predictionSeconds,
  })

const candidateCenter = <TId extends PatternTargetId>(
  members: readonly PreparedTarget<TId>[],
) =>
  freezePoint({
    x: members.reduce((sum, member) => sum + member.point.x, 0) / members.length,
    y: members.reduce((sum, member) => sum + member.point.y, 0) / members.length,
  })

const candidateIsBetter = <TId extends PatternTargetId>(
  candidate: ClusterCandidate<TId>,
  current: ClusterCandidate<TId> | undefined,
) => {
  if (!current) return true
  if (candidate.members.length !== current.members.length) {
    return candidate.members.length > current.members.length
  }
  if (Math.abs(candidate.spread - current.spread) > SCORE_EPSILON) {
    return candidate.spread < current.spread
  }
  if (
    Math.abs(
      candidate.distanceFromOriginSquared - current.distanceFromOriginSquared,
    ) > SCORE_EPSILON
  ) {
    return (
      candidate.distanceFromOriginSquared >
      current.distanceFromOriginSquared
    )
  }
  return compareTargetIds(
    candidate.anchor.target.id,
    current.anchor.target.id,
  ) < 0
}

export function findDensestRemoteCluster<
  TId extends PatternTargetId = PatternTargetId,
>(
  origin: Vec2,
  targets: readonly PatternTarget<TId>[],
  {
    minimumRange = 120,
    clusterRadius = 160,
    predictionSeconds = 0,
  }: {
    readonly minimumRange?: number
    readonly clusterRadius?: number
    readonly predictionSeconds?: number
  } = {},
): RemotePatternCluster<TId> | undefined {
  const safeMinimumRange = Math.max(0, finiteOr(minimumRange, 120))
  const safeClusterRadius = Math.max(1, finiteOr(clusterRadius, 160))
  const safePredictionSeconds = Math.max(
    0,
    finiteOr(predictionSeconds, 0),
  )
  const minimumRangeSquared = safeMinimumRange ** 2
  const clusterRadiusSquared = safeClusterRadius ** 2
  const prepared = targets
    .filter(
      (target) =>
        target.active !== false &&
        Number.isFinite(target.x) &&
        Number.isFinite(target.y),
    )
    .map((target) => ({
      target,
      point: predictedPoint(target, safePredictionSeconds),
    }))
    .filter(
      (target) =>
        pointDistanceSquared(target.point, origin) >= minimumRangeSquared,
    )
    .sort((left, right) =>
      comparePreparedTargets(
        left as PreparedTarget<PatternTargetId>,
        right as PreparedTarget<PatternTargetId>,
      ),
    )

  let best: ClusterCandidate<TId> | undefined
  for (const anchor of prepared) {
    const members = prepared.filter(
      (candidate) =>
        pointDistanceSquared(candidate.point, anchor.point) <=
        clusterRadiusSquared,
    )
    const center = candidateCenter(members)
    const spread = members.reduce(
      (sum, member) => sum + pointDistanceSquared(member.point, center),
      0,
    )
    const candidate: ClusterCandidate<TId> = {
      anchor,
      members,
      center,
      spread,
      distanceFromOriginSquared: pointDistanceSquared(center, origin),
    }
    if (candidateIsBetter(candidate, best)) best = candidate
  }

  if (!best) return undefined

  let center = best.center
  const centerDistance = Math.sqrt(pointDistanceSquared(center, origin))
  if (centerDistance < safeMinimumRange) {
    const direction = normalizedDirection(
      origin,
      best.anchor.point,
      hashTargetId(best.anchor.target.id),
    )
    center = freezePoint({
      x: origin.x + direction.x * safeMinimumRange,
      y: origin.y + direction.y * safeMinimumRange,
    })
  }

  return Object.freeze({
    anchorId: best.anchor.target.id,
    center,
    targetIds: Object.freeze(
      best.members.map((member) => member.target.id),
    ),
    density: best.members.length,
    spread: best.spread,
    predictionSeconds: safePredictionSeconds,
  })
}

export const pointInCircle = (
  point: Vec2,
  center: Vec2,
  radius: number,
) => {
  const safeRadius = Math.max(0, finiteOr(radius, 0))
  return pointDistanceSquared(point, center) <= safeRadius ** 2
}

export const pointInCapsule = (
  point: Vec2,
  start: Vec2,
  end: Vec2,
  radius: number,
) => {
  const safeRadius = Math.max(0, finiteOr(radius, 0))
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2
  const projection =
    segmentLengthSquared <= Number.EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * segmentX +
              (point.y - start.y) * segmentY) /
              segmentLengthSquared,
          ),
        )
  const closest = {
    x: start.x + segmentX * projection,
    y: start.y + segmentY * projection,
  }
  return pointDistanceSquared(point, closest) <= safeRadius ** 2
}

export const pointInPatternStrike = (
  point: Vec2,
  strike: PatternStrike,
) =>
  strike.kind === 'circle'
    ? pointInCircle(point, strike.center, strike.radius)
    : pointInCapsule(point, strike.start, strike.end, strike.radius)

const freezeCluster = <TId extends PatternTargetId>(
  cluster: RemotePatternCluster<TId>,
): RemotePatternCluster<TId> =>
  Object.freeze({
    ...cluster,
    center: freezePoint(cluster.center),
    targetIds: Object.freeze([...cluster.targetIds]),
  })

export function buildGraveglassSpires<
  TId extends PatternTargetId = PatternTargetId,
>(
  input: PatternBuildInput<TId>,
): GraveglassSpiresPattern<TId> | undefined {
  const stageIndex = STAGE_INDEX[input.stage]
  const cluster = findDensestRemoteCluster(input.origin, input.targets, {
    minimumRange: input.minimumRange ?? 120,
    clusterRadius: input.clusterRadius ?? 165,
    predictionSeconds: 0,
  })
  if (!cluster) return undefined

  const strikeCount = GRAVEGLASS_STRIKE_COUNTS[stageIndex]
  const patternSeed =
    normalizeSeed(input.seed) ^ hashTargetId(cluster.anchorId)
  const direction = normalizedDirection(
    input.origin,
    cluster.center,
    patternSeed,
  )
  const tangent = { x: -direction.y, y: direction.x }
  const spacing = 42 + stageIndex * 4
  const midpoint = (strikeCount - 1) * 0.5
  const mirror = seededUnit(patternSeed, 3) >= 0.5 ? 1 : -1
  const delayStep = 0.086 - stageIndex * 0.008
  const strikes: CirclePatternStrike[] = []

  for (let index = 0; index < strikeCount; index += 1) {
    const branchPosition = index - midpoint
    const along =
      branchPosition * spacing * 0.76 +
      (seededUnit(patternSeed, 11 + index) - 0.5) * 8
    const alternatingDirection =
      (index + (mirror < 0 ? 1 : 0)) % 2 === 0 ? -1 : 1
    const branchStrength =
      index === 0 ? 0.16 : 0.48 + (index % 3) * 0.15
    const side =
      alternatingDirection *
      mirror *
      spacing *
      branchStrength *
      (0.9 + seededUnit(patternSeed, 31 + index) * 0.2)
    const center = freezePoint({
      x: cluster.center.x + direction.x * along + tangent.x * side,
      y: cluster.center.y + direction.y * along + tangent.y * side,
    })
    strikes.push(
      Object.freeze({
        kind: 'circle',
        index,
        center,
        radius:
          36 +
          stageIndex * 4 +
          seededUnit(patternSeed, 59 + index) * 4,
        delay:
          index * delayStep +
          seededUnit(patternSeed, 83 + index) * 0.006,
        parentIndex: GRAVEGLASS_PARENT_INDICES[index],
      }),
    )
  }

  return Object.freeze({
    kind: 'graveglass-spires',
    stage: input.stage,
    formation: 'jagged-branch',
    origin: freezePoint(input.origin),
    aimPoint: freezePoint(cluster.center),
    aimAngle: Math.atan2(direction.y, direction.x),
    cluster: freezeCluster(cluster),
    strikes: Object.freeze(strikes),
  })
}

const capsuleStrike = ({
  index,
  center,
  angle,
  length,
  radius,
  delay,
  role,
}: {
  readonly index: number
  readonly center: Vec2
  readonly angle: number
  readonly length: number
  readonly radius: number
  readonly delay: number
  readonly role: HarrowStrikeRole
}): CapsulePatternStrike => {
  const halfLength = length * 0.5
  const direction = { x: Math.cos(angle), y: Math.sin(angle) }
  return Object.freeze({
    kind: 'capsule',
    index,
    start: freezePoint({
      x: center.x - direction.x * halfLength,
      y: center.y - direction.y * halfLength,
    }),
    end: freezePoint({
      x: center.x + direction.x * halfLength,
      y: center.y + direction.y * halfLength,
    }),
    radius,
    delay,
    role,
  })
}

const harrowFormation = (
  stage: WeaponPatternStage,
): EclipseHarrowFormation => {
  if (stage === 'solo') return 'single-lane'
  if (stage === 'combined') return 'crossed-lanes'
  if (stage === 'mastered') return 'staggered-lanes'
  return 'cathedral'
}

export function buildEclipseHarrow<
  TId extends PatternTargetId = PatternTargetId,
>(
  input: PatternBuildInput<TId>,
): EclipseHarrowPattern<TId> | undefined {
  const stageIndex = STAGE_INDEX[input.stage]
  const predictionSeconds = Math.max(
    0,
    finiteOr(input.predictionSeconds, 0.38),
  )
  const cluster = findDensestRemoteCluster(input.origin, input.targets, {
    minimumRange: input.minimumRange ?? 150,
    clusterRadius: input.clusterRadius ?? 190,
    predictionSeconds,
  })
  if (!cluster) return undefined

  const patternSeed =
    normalizeSeed(input.seed) ^ hashTargetId(cluster.anchorId)
  const direction = normalizedDirection(
    input.origin,
    cluster.center,
    patternSeed,
  )
  const tangent = { x: -direction.y, y: direction.x }
  const aimAngle = Math.atan2(direction.y, direction.x)
  const strikeCount = HARROW_STRIKE_COUNTS[stageIndex]
  const baseLength = 310 + stageIndex * 42
  const baseRadius = 27 + stageIndex * 3
  const strikes: CapsulePatternStrike[] = []

  if (input.stage === 'solo') {
    strikes.push(
      capsuleStrike({
        index: 0,
        center: cluster.center,
        angle: aimAngle,
        length: baseLength,
        radius: baseRadius,
        delay: 0,
        role: 'primary',
      }),
    )
  } else if (input.stage === 'combined') {
    for (let index = 0; index < strikeCount; index += 1) {
      const side = index === 0 ? -1 : 1
      strikes.push(
        capsuleStrike({
          index,
          center: {
            x: cluster.center.x + tangent.x * side * 11,
            y: cluster.center.y + tangent.y * side * 11,
          },
          angle: aimAngle + side * 0.38,
          length: baseLength,
          radius: baseRadius,
          delay: index * 0.115,
          role: index === 0 ? 'primary' : 'echo',
        }),
      )
    }
  } else if (input.stage === 'mastered') {
    const offsets = [-52, 0, 52]
    const roles = [
      'left-lane',
      'center-lane',
      'right-lane',
    ] as const
    for (let index = 0; index < strikeCount; index += 1) {
      const forwardOffset = (index - 1) * 18
      strikes.push(
        capsuleStrike({
          index,
          center: {
            x:
              cluster.center.x +
              tangent.x * offsets[index] +
              direction.x * forwardOffset,
            y:
              cluster.center.y +
              tangent.y * offsets[index] +
              direction.y * forwardOffset,
          },
          angle: aimAngle + (index - 1) * 0.035,
          length: baseLength + (index === 1 ? 28 : 0),
          radius: baseRadius,
          delay: index * 0.095,
          role: roles[index],
        }),
      )
    }
  } else {
    const cathedralSpecs = [
      {
        side: -1,
        angleOffset: 0,
        lengthScale: 1.08,
        delay: 0,
        role: 'left-nave',
      },
      {
        side: 1,
        angleOffset: 0,
        lengthScale: 1.08,
        delay: 0.075,
        role: 'right-nave',
      },
      {
        side: -1,
        angleOffset: -0.58,
        lengthScale: 0.96,
        delay: 0.16,
        role: 'left-vault',
      },
      {
        side: 1,
        angleOffset: 0.58,
        lengthScale: 0.96,
        delay: 0.235,
        role: 'right-vault',
      },
    ] as const
    for (let index = 0; index < strikeCount; index += 1) {
      const spec = cathedralSpecs[index]
      const sideOffset = index < 2 ? 48 : 14
      const forwardOffset = index < 2 ? -8 : 16
      strikes.push(
        capsuleStrike({
          index,
          center: {
            x:
              cluster.center.x +
              tangent.x * spec.side * sideOffset +
              direction.x * forwardOffset,
            y:
              cluster.center.y +
              tangent.y * spec.side * sideOffset +
              direction.y * forwardOffset,
          },
          angle: aimAngle + spec.angleOffset,
          length: baseLength * spec.lengthScale,
          radius: baseRadius + (index >= 2 ? 2 : 0),
          delay: spec.delay,
          role: spec.role,
        }),
      )
    }
  }

  return Object.freeze({
    kind: 'eclipse-harrow',
    stage: input.stage,
    formation: harrowFormation(input.stage),
    origin: freezePoint(input.origin),
    aimPoint: freezePoint(cluster.center),
    aimAngle,
    cluster: freezeCluster(cluster),
    strikes: Object.freeze(strikes),
  })
}

export function buildReplacementWeaponPattern<
  TId extends PatternTargetId = PatternTargetId,
>(
  weaponId: ReplacementWeaponId,
  input: PatternBuildInput<TId>,
): ReplacementWeaponPattern<TId> | undefined {
  return weaponId === 'ash-halo'
    ? buildGraveglassSpires(input)
    : buildEclipseHarrow(input)
}

export function resolvePatternHits<
  TTarget extends PatternTarget = PatternTarget,
>(
  targets: readonly TTarget[],
  strikes: readonly PatternStrike[],
): readonly PatternHit<TTarget>[] {
  const orderedStrikes = strikes
    .map((strike, strikeIndex) => ({ strike, strikeIndex }))
    .sort(
      (left, right) =>
        left.strike.delay - right.strike.delay ||
        left.strike.index - right.strike.index ||
        left.strikeIndex - right.strikeIndex,
    )
  const orderedTargets = [...targets]
    .filter(
      (target) =>
        target.active !== false &&
        Number.isFinite(target.x) &&
        Number.isFinite(target.y),
    )
    .sort((left, right) => {
      const idComparison = compareTargetIds(left.id, right.id)
      if (idComparison !== 0) return idComparison
      if (left.x !== right.x) return left.x - right.x
      return left.y - right.y
    })
  const hitTargetIds = new Set<string>()
  const hits: PatternHit<TTarget>[] = []

  for (const target of orderedTargets) {
    const targetToken = stableIdToken(target.id)
    if (hitTargetIds.has(targetToken)) continue
    const match = orderedStrikes.find(({ strike }) =>
      pointInPatternStrike(target, strike),
    )
    if (!match) continue
    hitTargetIds.add(targetToken)
    hits.push(
      Object.freeze({
        target,
        targetId: target.id,
        strike: match.strike,
        strikeIndex: match.strikeIndex,
        delay: match.strike.delay,
      }),
    )
  }

  return Object.freeze(hits)
}
