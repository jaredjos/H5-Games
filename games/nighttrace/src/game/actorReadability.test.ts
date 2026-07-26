import { describe, expect, it } from 'vitest'
import {
  DECORATIVE_DENSITY_CAP_BY_STAGE,
  HERO_OVERDRAW_RELEASE_RADIUS,
  INNER_OVERDRAW_ATTENUATION,
  MINIMUM_ACTOR_CLARITY,
  PROTECTED_HERO_RADIUS,
  attenuateOverdrawAlpha,
  capDecorativeDensity,
  heroProtectionWeight,
  overdrawAttenuation,
  sceneVfxEnergyScale,
} from './actorReadability'

describe('hero readability envelope', () => {
  it('defines a protected silhouette followed by a larger release radius', () => {
    expect(PROTECTED_HERO_RADIUS).toBeGreaterThan(0)
    expect(HERO_OVERDRAW_RELEASE_RADIUS).toBeGreaterThan(PROTECTED_HERO_RADIUS)
    expect(MINIMUM_ACTOR_CLARITY).toBeGreaterThan(0)
    expect(MINIMUM_ACTOR_CLARITY).toBeLessThan(1)
    expect(Object.isFrozen(INNER_OVERDRAW_ATTENUATION)).toBe(true)
  })

  it('strongly attenuates dark and bright overdraw inside the hero silhouette', () => {
    expect(overdrawAttenuation(0, 'dark')).toBe(
      INNER_OVERDRAW_ATTENUATION.dark,
    )
    expect(overdrawAttenuation(PROTECTED_HERO_RADIUS, 'bright')).toBe(
      INNER_OVERDRAW_ATTENUATION.bright,
    )
    expect(overdrawAttenuation(0, 'dark')).toBeLessThan(
      overdrawAttenuation(0, 'bright'),
    )
  })

  it('smoothly restores full effects outside the release radius', () => {
    const midpoint =
      PROTECTED_HERO_RADIUS +
      (HERO_OVERDRAW_RELEASE_RADIUS - PROTECTED_HERO_RADIUS) / 2

    expect(heroProtectionWeight(PROTECTED_HERO_RADIUS)).toBe(1)
    expect(heroProtectionWeight(midpoint)).toBeCloseTo(0.5, 8)
    expect(heroProtectionWeight(HERO_OVERDRAW_RELEASE_RADIUS)).toBe(0)
    expect(overdrawAttenuation(midpoint, 'dark')).toBeGreaterThan(
      INNER_OVERDRAW_ATTENUATION.dark,
    )
    expect(overdrawAttenuation(midpoint, 'dark')).toBeLessThan(1)
    expect(overdrawAttenuation(HERO_OVERDRAW_RELEASE_RADIUS + 500, 'bright')).toBe(
      1,
    )
  })

  it('leaves remote source alpha unchanged and clamps malformed values', () => {
    const remoteDistance = HERO_OVERDRAW_RELEASE_RADIUS + 1
    expect(attenuateOverdrawAlpha(0.73, remoteDistance, 'dark')).toBe(0.73)
    expect(attenuateOverdrawAlpha(2, remoteDistance, 'bright')).toBe(1)
    expect(attenuateOverdrawAlpha(-1, remoteDistance, 'dark')).toBe(0)
    expect(attenuateOverdrawAlpha(Number.NaN, remoteDistance, 'bright')).toBe(0)
    expect(attenuateOverdrawAlpha(1, Number.NaN, 'dark')).toBe(
      INNER_OVERDRAW_ATTENUATION.dark,
    )
    expect(attenuateOverdrawAlpha(1, Number.POSITIVE_INFINITY, 'bright')).toBe(1)
  })

  it('keeps maximum inner overdraw below the minimum actor-clarity budget', () => {
    for (const kind of ['dark', 'bright'] as const) {
      const effectiveAlpha = attenuateOverdrawAlpha(1, 0, kind)
      expect(1 - effectiveAlpha, kind).toBeGreaterThanOrEqual(
        MINIMUM_ACTOR_CLARITY,
      )
    }
  })
})

describe('decorative VFX density budget', () => {
  it('uses deterministic monotonic caps for each presentation stage', () => {
    expect(DECORATIVE_DENSITY_CAP_BY_STAGE).toEqual({
      solo: 8,
      combined: 12,
      mastered: 16,
      final: 20,
    })
    expect(Object.isFrozen(DECORATIVE_DENSITY_CAP_BY_STAGE)).toBe(true)
  })

  it('normalizes aggregate scene energy without changing gameplay counts', () => {
    expect(sceneVfxEnergyScale(1, 8)).toBe(1)
    expect(sceneVfxEnergyScale(3, 18)).toBe(1)
    expect(sceneVfxEnergyScale(8, 72)).toBeLessThan(0.55)
    expect(sceneVfxEnergyScale(8, 72)).toBeGreaterThanOrEqual(0.4)
    expect(sceneVfxEnergyScale(80, 800)).toBe(0.4)
    expect(sceneVfxEnergyScale(Number.NaN, Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('preserves requests below the cap and limits requests above it', () => {
    expect(capDecorativeDensity(5, 'solo')).toBe(5)
    expect(capDecorativeDensity(80, 'solo')).toBe(8)
    expect(capDecorativeDensity(80, 'combined')).toBe(12)
    expect(capDecorativeDensity(80, 'mastered')).toBe(16)
    expect(capDecorativeDensity(80, 'final')).toBe(20)
  })

  it('normalizes fractional, negative, and invalid requests safely', () => {
    expect(capDecorativeDensity(7.9, 'solo')).toBe(7)
    expect(capDecorativeDensity(-12, 'final')).toBe(0)
    expect(capDecorativeDensity(Number.NaN, 'mastered')).toBe(0)
    expect(capDecorativeDensity(Number.POSITIVE_INFINITY, 'combined')).toBe(0)
  })
})
