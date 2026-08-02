import type { Vec2 } from '../shared/types'

export const TRACE_POINT_LIFETIME_SECONDS = 12
export const TRACE_FADE_WINDOW_SECONDS = 2

const TRACE_FULL_OPACITY_SECONDS =
  TRACE_POINT_LIFETIME_SECONDS - TRACE_FADE_WINDOW_SECONDS

/**
 * A trace sample remains a Vec2 everywhere geometry is consumed while carrying
 * the monotonic game time at which that particular sample was created.
 */
export interface TimestampedTracePoint extends Vec2 {
  bornAt: number
}

const isFiniteTime = (value: number) => Number.isFinite(value)

const pointAlphaAt = (point: TimestampedTracePoint, now: number) => {
  if (!isFiniteTime(now)) return 1
  if (!isFiniteTime(point.bornAt)) return 0

  // A clock correction must not prematurely fade a point dated in the future.
  const age = Math.max(0, now - point.bornAt)
  if (age <= TRACE_FULL_OPACITY_SECONDS) return 1
  if (age >= TRACE_POINT_LIFETIME_SECONDS) return 0

  return (
    (TRACE_POINT_LIFETIME_SECONDS - age) /
    TRACE_FADE_WINDOW_SECONDS
  )
}

/**
 * Removes each sample when its own lifetime elapses. Object identity and input
 * order are preserved for every surviving point so geometry code can safely
 * consume the returned array. A broken clock never wipes a valid trail, while
 * malformed point timestamps are discarded once a valid clock is available.
 */
export function pruneExpiredTracePoints<T extends TimestampedTracePoint>(
  points: readonly T[],
  now: number,
): T[] {
  if (!isFiniteTime(now)) return points.slice()

  return points.filter(
    (point) =>
      isFiniteTime(point.bornAt) &&
      now - point.bornAt < TRACE_POINT_LIFETIME_SECONDS,
  )
}

/**
 * Pixi draws a segment with one opacity, so its alpha is the mean of the
 * endpoint opacities. This lets the older end recede before the younger end,
 * producing a smooth tail instead of deleting an entire segment at once.
 */
export function traceSegmentAlpha(
  first: TimestampedTracePoint,
  second: TimestampedTracePoint,
  now: number,
) {
  const firstAlpha = pointAlphaAt(first, now)
  const secondAlpha = pointAlphaAt(second, now)
  return (firstAlpha + secondAlpha) * 0.5
}

/** The final sample disappears at this timestamp, exactly 12 seconds later. */
export function finalTracePointExpiresAt(
  finalPoint: TimestampedTracePoint | undefined,
) {
  if (!finalPoint || !isFiniteTime(finalPoint.bornAt)) return undefined

  const expiresAt = finalPoint.bornAt + TRACE_POINT_LIFETIME_SECONDS
  return isFiniteTime(expiresAt) ? expiresAt : undefined
}
