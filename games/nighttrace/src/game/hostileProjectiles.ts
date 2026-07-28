export type HostileProjectileLod = 'desktop' | 'mobile'
export type HostileProjectileId = number | string
export type HostileProjectilePhase =
  | 'windup'
  | 'flight'
  | 'impact'
  | 'expired'

export interface HostileProjectilePoint {
  readonly x: number
  readonly y: number
}

export interface HostileProjectileRequest {
  readonly id: HostileProjectileId
  readonly sourceUid: number
  readonly origin: HostileProjectilePoint
  readonly destination: HostileProjectilePoint
  readonly windupSeconds: number
  readonly flightSeconds: number
  readonly impactHoldSeconds?: number
  readonly arcHeight: number
  readonly impactRadius: number
  readonly damage: number
  readonly color: number
  readonly boss: boolean
}

export interface HostileProjectileConfig extends HostileProjectileRequest {
  readonly impactHoldSeconds: number
}

export interface HostileProjectileState {
  readonly config: HostileProjectileConfig
  readonly elapsedSeconds: number
  readonly released: boolean
  readonly impactResolved: boolean
}

export interface HostileProjectilePose {
  readonly phase: HostileProjectilePhase
  readonly position: HostileProjectilePoint
  /** Positive screen-space height above the ground trajectory. */
  readonly arcOffset: number
  readonly flightProgress: number
  readonly windupProgress: number
  readonly shadowPosition: HostileProjectilePoint
  readonly shadowScale: number
  readonly projectileVisible: boolean
  readonly destinationVisible: boolean
}

export interface HostileProjectileReleaseEvent {
  readonly type: 'release'
  readonly projectileId: HostileProjectileId
  readonly sourceUid: number
  readonly origin: HostileProjectilePoint
  readonly destination: HostileProjectilePoint
}

export interface HostileProjectileImpactEvent {
  readonly type: 'impact'
  readonly projectileId: HostileProjectileId
  readonly sourceUid: number
  readonly destination: HostileProjectilePoint
  readonly radius: number
  readonly damage: number
  readonly color: number
  readonly boss: boolean
}

export type HostileProjectileEvent =
  | HostileProjectileReleaseEvent
  | HostileProjectileImpactEvent

export interface HostileProjectileStep {
  readonly state: HostileProjectileState
  readonly pose: HostileProjectilePose
  readonly events: readonly HostileProjectileEvent[]
}

export interface HostileProjectileQueueContext {
  readonly lod: HostileProjectileLod
  readonly activeCount: number
}

export const HOSTILE_PROJECTILE_CAPS = Object.freeze({
  desktop: 48,
  mobile: 24,
} as const satisfies Readonly<Record<HostileProjectileLod, number>>)

const EMPTY_EVENTS = Object.freeze([]) as readonly HostileProjectileEvent[]

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const freezePoint = (
  point: HostileProjectilePoint,
  fallback: HostileProjectilePoint = { x: 0, y: 0 },
) =>
  Object.freeze({
    x: finiteOr(point?.x, fallback.x),
    y: finiteOr(point?.y, fallback.y),
  })

const sanitizeColor = (color: number) =>
  clamp(Math.floor(finiteOr(color, 0x6d294c)), 0, 0xffffff)

const normalizeConfig = (
  request: HostileProjectileRequest,
): HostileProjectileConfig =>
  Object.freeze({
    id: request.id,
    sourceUid: Math.max(
      0,
      Math.floor(finiteOr(request.sourceUid, 0)),
    ),
    origin: freezePoint(request.origin),
    destination: freezePoint(request.destination),
    windupSeconds: clamp(finiteOr(request.windupSeconds, 0), 0, 10),
    flightSeconds: clamp(finiteOr(request.flightSeconds, 0.05), 0.05, 10),
    impactHoldSeconds: clamp(
      finiteOr(request.impactHoldSeconds ?? 0.24, 0.24),
      0,
      5,
    ),
    arcHeight: clamp(finiteOr(request.arcHeight, 0), 0, 1600),
    impactRadius: clamp(finiteOr(request.impactRadius, 2), 2, 1000),
    damage: clamp(finiteOr(request.damage, 0), 0, 1_000_000),
    color: sanitizeColor(request.color),
    boss: Boolean(request.boss),
  })

const freezeState = (
  config: HostileProjectileConfig,
  elapsedSeconds: number,
  released: boolean,
  impactResolved: boolean,
): HostileProjectileState =>
  Object.freeze({
    config,
    elapsedSeconds,
    released,
    impactResolved,
  })

export function hostileProjectileCap(lod: HostileProjectileLod) {
  return HOSTILE_PROJECTILE_CAPS[lod]
}

export function canQueueHostileProjectile(
  activeCount: number,
  lod: HostileProjectileLod,
) {
  const normalizedCount = Math.max(
    0,
    Math.floor(Number.isFinite(activeCount) ? activeCount : 0),
  )
  return normalizedCount < hostileProjectileCap(lod)
}

export function queueHostileProjectile(
  request: HostileProjectileRequest,
  context: HostileProjectileQueueContext = {
    lod: 'desktop',
    activeCount: 0,
  },
): HostileProjectileState | undefined {
  if (!canQueueHostileProjectile(context.activeCount, context.lod)) {
    return undefined
  }
  return freezeState(normalizeConfig(request), 0, false, false)
}

export function hostileProjectilePoseAt(
  state: HostileProjectileState,
): HostileProjectilePose {
  const { config } = state
  const impactAt = config.windupSeconds + config.flightSeconds
  const expiresAt = impactAt + config.impactHoldSeconds
  const elapsed = clamp(
    finiteOr(state.elapsedSeconds, 0),
    0,
    expiresAt,
  )
  const phase: HostileProjectilePhase =
    elapsed < config.windupSeconds
      ? 'windup'
      : elapsed < impactAt
        ? 'flight'
        : elapsed < expiresAt
          ? 'impact'
          : 'expired'
  const windupProgress =
    config.windupSeconds <= 0
      ? 1
      : clamp(elapsed / config.windupSeconds, 0, 1)
  const flightProgress = clamp(
    (elapsed - config.windupSeconds) / config.flightSeconds,
    0,
    1,
  )
  const groundX =
    config.origin.x +
    (config.destination.x - config.origin.x) * flightProgress
  const groundY =
    config.origin.y +
    (config.destination.y - config.origin.y) * flightProgress
  const arcOffset =
    phase === 'flight'
      ? 4 * config.arcHeight * flightProgress * (1 - flightProgress)
      : 0
  const position =
    phase === 'windup'
      ? config.origin
      : phase === 'flight'
        ? freezePoint({ x: groundX, y: groundY - arcOffset })
        : config.destination
  const shadowPosition =
    phase === 'windup'
      ? config.origin
      : phase === 'flight'
        ? freezePoint({ x: groundX, y: groundY })
        : config.destination

  return Object.freeze({
    phase,
    position,
    arcOffset,
    flightProgress,
    windupProgress,
    shadowPosition,
    shadowScale:
      phase === 'flight'
        ? 0.62 + Math.sin(flightProgress * Math.PI) * 0.28
        : 0.62,
    projectileVisible: phase === 'flight',
    destinationVisible: phase === 'windup' || phase === 'flight',
  })
}

export function advanceHostileProjectile(
  state: HostileProjectileState,
  deltaSeconds: number,
): HostileProjectileStep {
  const previousElapsed = state.elapsedSeconds
  const impactAt =
    state.config.windupSeconds + state.config.flightSeconds
  const expiresAt = impactAt + state.config.impactHoldSeconds
  const delta = Math.max(0, finiteOr(deltaSeconds, 0))
  const elapsed = clamp(previousElapsed + delta, 0, expiresAt)
  const advanced = elapsed > previousElapsed
  const released =
    state.released ||
    (advanced &&
      previousElapsed <= state.config.windupSeconds &&
      elapsed >= state.config.windupSeconds)
  const impactNow =
    !state.impactResolved &&
    advanced &&
    previousElapsed < impactAt &&
    elapsed >= impactAt
  const impactResolved = state.impactResolved || impactNow
  const events: HostileProjectileEvent[] = []

  if (!state.released && released) {
    events.push(
      Object.freeze({
        type: 'release',
        projectileId: state.config.id,
        sourceUid: state.config.sourceUid,
        origin: state.config.origin,
        destination: state.config.destination,
      }),
    )
  }
  if (impactNow) {
    events.push(
      Object.freeze({
        type: 'impact',
        projectileId: state.config.id,
        sourceUid: state.config.sourceUid,
        destination: state.config.destination,
        radius: state.config.impactRadius,
        damage: state.config.damage,
        color: state.config.color,
        boss: state.config.boss,
      }),
    )
  }

  const nextState = freezeState(
    state.config,
    elapsed,
    released,
    impactResolved,
  )
  return Object.freeze({
    state: nextState,
    pose: hostileProjectilePoseAt(nextState),
    events: events.length ? Object.freeze(events) : EMPTY_EVENTS,
  })
}
