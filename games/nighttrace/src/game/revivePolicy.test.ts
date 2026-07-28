import { describe, expect, it } from 'vitest'
import {
  FREE_REVIVES_PER_LEVEL,
  REVIVE_HEALTH_FRACTION,
  REVIVE_INVULNERABILITY_SECONDS,
  initialFreeRevives,
  revivedHealth,
} from './revivePolicy'

describe('free revive policy', () => {
  it('grants exactly one revive to every mortal level attempt', () => {
    expect(FREE_REVIVES_PER_LEVEL).toBe(1)
    expect(initialFreeRevives('campaign', false)).toBe(1)
    expect(initialFreeRevives('boss-trial', false)).toBe(1)
  })

  it('does not advertise a redundant revive in the invincible combat lab', () => {
    expect(initialFreeRevives('combat-lab', true)).toBe(0)
    expect(initialFreeRevives('campaign', true)).toBe(0)
  })

  it('returns the player with partial vitality and a short re-entry window', () => {
    expect(REVIVE_HEALTH_FRACTION).toBe(0.35)
    expect(revivedHealth(100)).toBe(35)
    expect(revivedHealth(132)).toBeCloseTo(46.2)
    expect(revivedHealth(Number.NaN)).toBe(1)
    expect(REVIVE_INVULNERABILITY_SECONDS).toBeGreaterThanOrEqual(2)
    expect(REVIVE_INVULNERABILITY_SECONDS).toBeLessThanOrEqual(2.5)
  })
})
