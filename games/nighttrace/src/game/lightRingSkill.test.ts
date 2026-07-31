import { describe, expect, it } from 'vitest'
import {
  LIGHT_RING_AWAKENED_RANK,
  LIGHT_RING_PROFILES,
  lightRingDamagePerSecond,
  lightRingProfile,
  lightRingRankForRun,
  lightRingTickDamage,
  lightRingTouchesTarget,
  normalizeLightRingRank,
} from './lightRingSkill'

describe('Dawnward Aegis Combat Lab prototype', () => {
  it('normalizes exactly five spell ranks plus the Awakened state', () => {
    expect(normalizeLightRingRank(undefined)).toBe(0)
    expect(normalizeLightRingRank(Number.NaN)).toBe(0)
    expect(normalizeLightRingRank(-8)).toBe(0)
    expect(normalizeLightRingRank(3.9)).toBe(3)
    expect(normalizeLightRingRank(999)).toBe(LIGHT_RING_AWAKENED_RANK)
    expect(LIGHT_RING_PROFILES.map((profile) => profile.rank)).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
    expect(LIGHT_RING_PROFILES.at(-1)?.awakened).toBe(true)
  })

  it('is forcibly disabled outside Combat Lab', () => {
    expect(lightRingRankForRun('combat-lab', 5)).toBe(5)
    expect(lightRingRankForRun('combat-lab', 6)).toBe(6)
    expect(lightRingRankForRun('campaign', 6)).toBe(0)
    expect(lightRingRankForRun('boss-trial', 6)).toBe(0)
  })

  it('grows diameter, material richness, and damage at every rank', () => {
    for (let index = 1; index < LIGHT_RING_PROFILES.length; index += 1) {
      const previous = LIGHT_RING_PROFILES[index - 1]
      const current = LIGHT_RING_PROFILES[index]
      expect(current.diameter).toBeGreaterThan(previous.diameter)
      expect(current.filamentCount).toBeGreaterThan(previous.filamentCount)
      expect(current.moteCount).toBeGreaterThan(previous.moteCount)
      expect(current.orbitBandCount).toBeGreaterThanOrEqual(
        previous.orbitBandCount,
      )
      expect(current.pulseWaveCount).toBeGreaterThanOrEqual(
        previous.pulseWaveCount,
      )
      expect(current.energyKnotCount).toBeGreaterThan(
        previous.energyKnotCount,
      )
      expect(current.rotationSpeed).toBeGreaterThan(previous.rotationSpeed)
      expect(current.coronaOpacity).toBeGreaterThan(previous.coronaOpacity)
      expect(current.materialOpacity).toBeGreaterThan(previous.materialOpacity)
      expect(lightRingDamagePerSecond(current.rank)).toBeGreaterThan(
        lightRingDamagePerSecond(previous.rank),
      )
    }

    expect(new Set(LIGHT_RING_PROFILES.map(({ orbitBandCount }) => orbitBandCount)).size)
      .toBeGreaterThanOrEqual(4)
    expect(new Set(LIGHT_RING_PROFILES.map(({ pulseWaveCount }) => pulseWaveCount)).size)
      .toBeGreaterThanOrEqual(3)
  })

  it('damages hordes and bosses whose collision circles touch the aura', () => {
    const rankThree = lightRingProfile(3)
    expect(rankThree).toBeDefined()
    expect(
      lightRingTouchesTarget(
        3,
        100,
        100,
        100 + (rankThree?.radius ?? 0) + 18,
        100,
        18,
      ),
    ).toBe(true)
    expect(
      lightRingTouchesTarget(
        3,
        100,
        100,
        100 + (rankThree?.radius ?? 0) + 19,
        100,
        18,
      ),
    ).toBe(false)
    expect(lightRingTickDamage(3)).toBeGreaterThan(0)
    expect(lightRingTickDamage(3, true)).toBeCloseTo(
      lightRingTickDamage(3) * (rankThree?.bossDamageMultiplier ?? 0),
    )
  })
})
