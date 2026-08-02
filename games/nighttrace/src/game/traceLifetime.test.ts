import { describe, expect, it } from 'vitest'
import {
  TRACE_FADE_WINDOW_SECONDS,
  TRACE_POINT_LIFETIME_SECONDS,
  finalTracePointExpiresAt,
  pruneExpiredTracePoints,
  traceSegmentAlpha,
  type TimestampedTracePoint,
} from './traceLifetime'

const point = (bornAt: number, x = bornAt): TimestampedTracePoint => ({
  x,
  y: x * 2,
  bornAt,
})

describe('timestamped trace lifetime', () => {
  it('keeps a moving history in order while pruning every point by its own age', () => {
    const history = [point(0), point(4), point(8), point(11)]
    const survivors = pruneExpiredTracePoints(history, 12)

    expect(TRACE_POINT_LIFETIME_SECONDS).toBe(12)
    expect(survivors).toEqual([history[1], history[2], history[3]])
    expect(survivors[0]).toBe(history[1])
    expect(survivors[2]).toBe(history[3])
  })

  it('fully disappears when stationary exactly twelve seconds after the final point', () => {
    const history = [point(1), point(2), point(3)]
    const finalPoint = history.at(-1)

    expect(finalTracePointExpiresAt(finalPoint)).toBe(15)
    expect(pruneExpiredTracePoints(history, 15 - 0.001)).toEqual([
      finalPoint,
    ])
    expect(pruneExpiredTracePoints(history, 15)).toEqual([])
  })

  it('fades gradually and linearly during the final two seconds', () => {
    const older = point(0)
    const younger = point(1)

    expect(TRACE_FADE_WINDOW_SECONDS).toBe(2)
    expect(traceSegmentAlpha(older, younger, 10)).toBe(1)
    expect(traceSegmentAlpha(older, younger, 11)).toBeCloseTo(0.75)
    expect(traceSegmentAlpha(older, younger, 12)).toBeCloseTo(0.25)
    expect(traceSegmentAlpha(older, younger, 13)).toBe(0)
  })

  it('never becomes brighter as time advances and always stays bounded', () => {
    const older = point(2)
    const younger = point(2.75)
    const samples = [9, 10, 11, 12, 13, 14, 15].map((now) =>
      traceSegmentAlpha(older, younger, now),
    )

    for (const alpha of samples) {
      expect(alpha).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeLessThanOrEqual(1)
    }
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeLessThanOrEqual(samples[index - 1])
    }
  })

  it('fails safely for invalid clock and point timestamps', () => {
    const history = [point(0), point(Number.NaN), point(4)]

    expect(pruneExpiredTracePoints(history, Number.NaN)).toEqual(history)
    expect(pruneExpiredTracePoints(history, Number.POSITIVE_INFINITY)).toEqual(
      history,
    )
    expect(pruneExpiredTracePoints(history, 6)).toEqual([
      history[0],
      history[2],
    ])
    expect(traceSegmentAlpha(point(0), point(1), Number.NaN)).toBe(1)
    expect(finalTracePointExpiresAt(point(Number.NaN))).toBeUndefined()
    expect(finalTracePointExpiresAt(undefined)).toBeUndefined()
  })
})
