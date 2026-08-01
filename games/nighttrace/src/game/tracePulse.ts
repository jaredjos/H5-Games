export const TRACE_SAMPLE_DISTANCE = 11
export const TRACE_MAX_CONTIGUOUS_SEGMENT = 72
export const TRACE_MINIMUM_POINTS = 10
export const TRACE_MINIMUM_AREA = 2100
export const TRACE_BASE_POINT_ALLOWANCE = Math.round(72 * 1.4)
export const TRACE_MEMORY_POINT_BONUS = 3
export const TRACE_AFTERIMAGE_POINT_BONUS = 22
export const PULSE_CHARGE_PER_EXPERIENCE = 0.16
export const PULSE_CHARGE_PER_NORMAL_KILL = 1.1

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0

/**
 * The first trace is 40% longer than the original 72-point allowance while
 * retaining every existing Long Memory and Afterimage increment.
 */
export function tracePointAllowance(memoryRank: number, hasAfterimage: boolean) {
  const safeMemoryRank = Math.floor(finiteNonNegative(memoryRank))
  return (
    TRACE_BASE_POINT_ALLOWANCE +
    safeMemoryRank * TRACE_MEMORY_POINT_BONUS +
    (hasAfterimage ? TRACE_AFTERIMAGE_POINT_BONUS : 0)
  )
}

export interface TracePoint {
  readonly x: number
  readonly y: number
}

/**
 * Teleports, scene resets, and pointer re-acquisition must begin a fresh trace
 * instead of joining the old and new anchors with one long diagonal streak.
 */
export function traceSegmentIsDiscontinuous(
  previous: TracePoint | undefined,
  next: TracePoint,
) {
  if (!previous) return false
  if (
    !Number.isFinite(previous.x) ||
    !Number.isFinite(previous.y) ||
    !Number.isFinite(next.x) ||
    !Number.isFinite(next.y)
  ) {
    return true
  }
  return (
    (next.x - previous.x) ** 2 + (next.y - previous.y) ** 2 >
    TRACE_MAX_CONTIGUOUS_SEGMENT ** 2
  )
}

export function pulseChargeFromExperience(value: number) {
  return finiteNonNegative(value) * PULSE_CHARGE_PER_EXPERIENCE
}

export function pulseChargeFromNormalKill() {
  return PULSE_CHARGE_PER_NORMAL_KILL
}

export interface TracePulseRewardInput {
  pointCount: number
  area: number
  enemiesTrapped: number
  primedBonus?: number
}

/**
 * Trace and primed upgrade rewards are awarded only after a mechanically
 * valid enclosure captures an active enemy. XP and normal kills remain
 * supplemental charge sources and do not weaken that enclosure gate.
 */
export function tracePulseReward({
  pointCount,
  area,
  enemiesTrapped,
  primedBonus = 0,
}: TracePulseRewardInput) {
  const safePointCount = Math.floor(finiteNonNegative(pointCount))
  const safeArea = finiteNonNegative(area)
  const safeEnemiesTrapped = Math.floor(finiteNonNegative(enemiesTrapped))
  if (
    safePointCount < TRACE_MINIMUM_POINTS ||
    safeArea < TRACE_MINIMUM_AREA ||
    safeEnemiesTrapped < 1
  ) {
    return 0
  }

  return (
    17 +
    Math.min(46, safeEnemiesTrapped * 2.8) +
    finiteNonNegative(primedBonus)
  )
}
