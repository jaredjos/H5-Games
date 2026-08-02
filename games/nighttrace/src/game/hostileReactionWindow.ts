import type { RunMode } from '../shared/types'

/** Combat Lab keeps the longer inspection window used by the existing build. */
export const HOSTILE_SPECIAL_REACTION_BONUS_SECONDS = 0.2
export const HOSTILE_SPECIAL_REACTION_LEVEL_ONE_SECONDS = 0.15
export const HOSTILE_SPECIAL_REACTION_LEVEL_TEN_SECONDS = 0.1

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0

/**
 * Gives boss and elite-horde specials a little more readable anticipation
 * without changing their authored destination, radius, lane, or damage.
 */
export function hostileSpecialReactionBonusSeconds(
  runMode: RunMode,
  levelId: number,
) {
  if (runMode === 'combat-lab') {
    return HOSTILE_SPECIAL_REACTION_BONUS_SECONDS
  }

  const normalizedLevel = Number.isFinite(levelId)
    ? Math.min(10, Math.max(1, levelId))
    : 1
  const progress = (normalizedLevel - 1) / 9
  return (
    HOSTILE_SPECIAL_REACTION_LEVEL_ONE_SECONDS +
    (HOSTILE_SPECIAL_REACTION_LEVEL_TEN_SECONDS -
      HOSTILE_SPECIAL_REACTION_LEVEL_ONE_SECONDS) *
      progress
  )
}

export function hostileSpecialReactionWindow(
  baseSeconds: number,
  bonusSeconds = HOSTILE_SPECIAL_REACTION_BONUS_SECONDS,
) {
  return (
    finiteNonNegative(baseSeconds) +
    finiteNonNegative(bonusSeconds)
  )
}
