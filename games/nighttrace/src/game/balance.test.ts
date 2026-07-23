import { describe, expect, it } from 'vitest'
import {
  BOSS_PATTERN_COUNT,
  bossPatternForLevel,
  chooseSupportPickup,
  supportPickupFirstDropSeconds,
  supportPickupIntervalSeconds,
} from './balance'

describe('boss pattern progression', () => {
  it('assigns a distinct pattern to each starter sector', () => {
    const patterns = Array.from({ length: 10 }, (_, index) => bossPatternForLevel(index + 1))
    expect(BOSS_PATTERN_COUNT).toBe(10)
    expect(patterns).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(new Set(patterns).size).toBe(10)
  })
})

describe('support pickup pacing', () => {
  it('spaces assistance further apart as sector pressure and run time rise', () => {
    expect(supportPickupFirstDropSeconds(1)).toBe(59)
    expect(supportPickupFirstDropSeconds(4.8)).toBeCloseTo(74.2)
    expect(supportPickupIntervalSeconds(4.8, 1)).toBeGreaterThan(
      supportPickupIntervalSeconds(1, 0),
    )
  })

  it('prioritizes the resource the player most needs', () => {
    expect(
      chooseSupportPickup({
        hpRatio: 0.4,
        activeExperiencePickups: 0,
        pulseCharge: 100,
        dropIndex: 0,
      }),
    ).toBe('dawnheart')
    expect(
      chooseSupportPickup({
        hpRatio: 1,
        activeExperiencePickups: 20,
        pulseCharge: 100,
        dropIndex: 0,
      }),
    ).toBe('gravestar')
    expect(
      chooseSupportPickup({
        hpRatio: 1,
        activeExperiencePickups: 0,
        pulseCharge: 12,
        dropIndex: 0,
      }),
    ).toBe('pulse-core')
    expect(
      chooseSupportPickup({
        hpRatio: 1,
        activeExperiencePickups: 4,
        pulseCharge: 100,
        dropIndex: 0,
      }),
    ).toBeUndefined()
  })
})
