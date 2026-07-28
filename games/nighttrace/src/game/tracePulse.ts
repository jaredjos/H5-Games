export const TRACE_SAMPLE_DISTANCE = 11
export const TRACE_MINIMUM_POINTS = 10
export const TRACE_MINIMUM_AREA = 2100
export const TRACE_BASE_POINT_ALLOWANCE = Math.round(72 * 1.4)
export const TRACE_MEMORY_POINT_BONUS = 3
export const TRACE_AFTERIMAGE_POINT_BONUS = 22

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

export interface TracePulseRewardInput {
  pointCount: number
  area: number
  enemiesTrapped: number
  primedBonus?: number
}

/**
 * Pulse is awarded only after a mechanically valid enclosure captures an
 * active enemy. Pickup and upgrade bonuses remain dormant until that event.
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
