import { describe, expect, it } from 'vitest'
import {
  DeterministicRandom,
  distanceSquared,
  pointInPolygon,
  polygonArea,
  segmentIntersection,
} from './math'

describe('trace geometry', () => {
  const circuit = [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 60, y: 60 },
    { x: 0, y: 60 },
  ]

  it('measures a circuit large enough for the gameplay closure threshold', () => {
    expect(polygonArea(circuit)).toBe(3600)
    expect(polygonArea([...circuit].reverse())).toBe(3600)
  })

  it('finds exact self-intersections and rejects separated segments', () => {
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 80, y: 80 },
        { x: 0, y: 80 },
        { x: 80, y: 0 },
      ),
    ).toEqual({ x: 40, y: 40 })
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
        { x: 50, y: 0 },
      ),
    ).toBeUndefined()
  })

  it('distinguishes enemies inside and outside a closed trace', () => {
    expect(pointInPolygon({ x: 30, y: 30 }, circuit)).toBe(true)
    expect(pointInPolygon({ x: 90, y: 30 }, circuit)).toBe(false)
  })

  it('supports the 30-pixel magnetic near-return latch', () => {
    expect(distanceSquared({ x: 0, y: 0 }, { x: 18, y: 22 })).toBeLessThan(30 ** 2)
    expect(distanceSquared({ x: 0, y: 0 }, { x: 31, y: 0 })).toBeGreaterThan(30 ** 2)
  })
})

describe('deterministic simulation randomizer', () => {
  it('replays the same sequence for the same sector seed', () => {
    const first = new DeterministicRandom(8017)
    const second = new DeterministicRandom(8017)
    expect(Array.from({ length: 8 }, () => first.next())).toEqual(
      Array.from({ length: 8 }, () => second.next()),
    )
  })
})
