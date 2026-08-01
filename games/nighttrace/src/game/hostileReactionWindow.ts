export const HOSTILE_SPECIAL_REACTION_BONUS_SECONDS = 0.2

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0

/**
 * Gives boss and elite-horde specials a little more readable anticipation
 * without changing their authored destination, radius, lane, or damage.
 */
export function hostileSpecialReactionWindow(baseSeconds: number) {
  return (
    finiteNonNegative(baseSeconds) +
    HOSTILE_SPECIAL_REACTION_BONUS_SECONDS
  )
}
