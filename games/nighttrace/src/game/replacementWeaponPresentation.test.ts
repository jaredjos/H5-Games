import { describe, expect, it } from 'vitest'
import {
  REPLACEMENT_PRESENTATION_STAGES,
  REPLACEMENT_WEAPON_PRESENTATION_IDS,
  replacementPresentationStageForVfxStage,
  replacementCosmeticUnit,
  replacementWeaponPresentationForVfxStage,
  replacementWeaponPresentationProfile,
  type ReplacementWeaponPresentationProfile,
} from './replacementWeaponPresentation'

const profilesFor = (
  weaponId: (typeof REPLACEMENT_WEAPON_PRESENTATION_IDS)[number],
) =>
  REPLACEMENT_PRESENTATION_STAGES.map((stage) =>
    replacementWeaponPresentationProfile(weaponId, stage),
  )

const expectStrictlyIncreasing = (
  profiles: readonly ReplacementWeaponPresentationProfile[],
  read: (profile: ReplacementWeaponPresentationProfile) => number,
) => {
  for (let index = 1; index < profiles.length; index += 1) {
    expect(read(profiles[index])).toBeGreaterThan(read(profiles[index - 1]))
  }
}

describe('replacement weapon presentation profiles', () => {
  it('covers both remote weapons across basic, upgraded, mastered, and final', () => {
    expect(REPLACEMENT_WEAPON_PRESENTATION_IDS).toEqual([
      'ash-halo',
      'null-bell',
    ])
    expect(REPLACEMENT_PRESENTATION_STAGES).toEqual([
      'basic',
      'upgraded',
      'mastered',
      'final',
    ])

    for (const weaponId of REPLACEMENT_WEAPON_PRESENTATION_IDS) {
      expect(profilesFor(weaponId).map((profile) => profile.stage)).toEqual(
        REPLACEMENT_PRESENTATION_STAGES,
      )
    }
  })

  it('progresses every material, trail, particle, cast, and impact channel monotonically', () => {
    for (const weaponId of REPLACEMENT_WEAPON_PRESENTATION_IDS) {
      const profiles = profilesFor(weaponId)
      const readers = [
        (profile: ReplacementWeaponPresentationProfile) => profile.intensity,
        (profile: ReplacementWeaponPresentationProfile) => profile.material.opacity,
        (profile: ReplacementWeaponPresentationProfile) => profile.material.coreLuminance,
        (profile: ReplacementWeaponPresentationProfile) => profile.material.edgeLuminance,
        (profile: ReplacementWeaponPresentationProfile) => profile.material.surfaceContrast,
        (profile: ReplacementWeaponPresentationProfile) => profile.material.fractureDensity,
        (profile: ReplacementWeaponPresentationProfile) => profile.material.depth,
        (profile: ReplacementWeaponPresentationProfile) => profile.trail.lengthScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.trail.widthScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.trail.persistence,
        (profile: ReplacementWeaponPresentationProfile) => profile.trail.turbulence,
        (profile: ReplacementWeaponPresentationProfile) =>
          profile.trail.secondaryRibbonAlpha,
        (profile: ReplacementWeaponPresentationProfile) => profile.particles.count,
        (profile: ReplacementWeaponPresentationProfile) => profile.particles.velocityScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.particles.lifetimeScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.particles.sizeScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.particles.glowRatio,
        (profile: ReplacementWeaponPresentationProfile) => profile.particles.debrisRatio,
        (profile: ReplacementWeaponPresentationProfile) => profile.cast.durationScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.cast.footprintScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.cast.layerCount,
        (profile: ReplacementWeaponPresentationProfile) => profile.cast.telegraphAlpha,
        (profile: ReplacementWeaponPresentationProfile) => profile.cast.revealSharpness,
        (profile: ReplacementWeaponPresentationProfile) =>
          profile.cast.secondaryMotifAlpha,
        (profile: ReplacementWeaponPresentationProfile) => profile.impact.durationScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.impact.radiusScale,
        (profile: ReplacementWeaponPresentationProfile) => profile.impact.flashAlpha,
        (profile: ReplacementWeaponPresentationProfile) => profile.impact.shockwaveAlpha,
        (profile: ReplacementWeaponPresentationProfile) => profile.impact.debrisCount,
        (profile: ReplacementWeaponPresentationProfile) =>
          profile.impact.decalPersistence,
      ]

      for (const reader of readers) expectStrictlyIncreasing(profiles, reader)
    }
  })

  it('keeps colors, normalized channels, scales, and counts within renderer-safe ranges', () => {
    for (const weaponId of REPLACEMENT_WEAPON_PRESENTATION_IDS) {
      for (const profile of profilesFor(weaponId)) {
        for (const color of Object.values(profile.palette)) {
          expect(Number.isInteger(color), `${weaponId}:${profile.stage}`).toBe(true)
          expect(color).toBeGreaterThanOrEqual(0)
          expect(color).toBeLessThanOrEqual(0xffffff)
        }

        for (const normalized of [
          profile.intensity,
          ...Object.values(profile.material),
          profile.trail.persistence,
          profile.trail.turbulence,
          profile.trail.secondaryRibbonAlpha,
          profile.particles.glowRatio,
          profile.particles.debrisRatio,
          profile.cast.telegraphAlpha,
          profile.cast.revealSharpness,
          profile.cast.secondaryMotifAlpha,
          profile.impact.flashAlpha,
          profile.impact.shockwaveAlpha,
          profile.impact.decalPersistence,
        ]) {
          expect(normalized, `${weaponId}:${profile.stage}`).toBeGreaterThanOrEqual(0)
          expect(normalized, `${weaponId}:${profile.stage}`).toBeLessThanOrEqual(1)
        }

        for (const scale of [
          profile.trail.lengthScale,
          profile.trail.widthScale,
          profile.particles.velocityScale,
          profile.particles.lifetimeScale,
          profile.particles.sizeScale,
          profile.cast.durationScale,
          profile.cast.footprintScale,
          profile.impact.durationScale,
          profile.impact.radiusScale,
        ]) {
          expect(scale, `${weaponId}:${profile.stage}`).toBeGreaterThanOrEqual(0.25)
          expect(scale, `${weaponId}:${profile.stage}`).toBeLessThanOrEqual(2)
        }

        for (const count of [
          profile.particles.count,
          profile.cast.layerCount,
          profile.impact.debrisCount,
        ]) {
          expect(Number.isInteger(count), `${weaponId}:${profile.stage}`).toBe(true)
          expect(count).toBeGreaterThan(0)
          expect(count).toBeLessThanOrEqual(64)
        }
      }
    }
  })

  it('preserves distinct Graveglass and Eclipse visual identities at every stage', () => {
    for (const stage of REPLACEMENT_PRESENTATION_STAGES) {
      const graveglass = replacementWeaponPresentationProfile('ash-halo', stage)
      const eclipse = replacementWeaponPresentationProfile('null-bell', stage)

      expect(graveglass.displayName).toBe('Graveglass Spires')
      expect(graveglass.motif).toBe('graveglass-spires')
      expect(eclipse.displayName).toBe('Eclipse Harrow')
      expect(eclipse.motif).toBe('eclipse-harrow')
      expect(graveglass.palette).not.toEqual(eclipse.palette)
      expect(graveglass.trail.turbulence).toBeGreaterThan(
        eclipse.trail.turbulence,
      )
      expect(graveglass.particles.debrisRatio).toBeGreaterThan(
        eclipse.particles.debrisRatio,
      )
      expect(eclipse.trail.lengthScale).toBeGreaterThan(
        graveglass.trail.lengthScale,
      )
      expect(eclipse.particles.glowRatio).toBeGreaterThan(
        graveglass.particles.glowRatio,
      )
    }
  })

  it('maps the existing VFX stage grammar without changing gameplay state', () => {
    expect(replacementPresentationStageForVfxStage('solo')).toBe('basic')
    expect(replacementPresentationStageForVfxStage('combined')).toBe('upgraded')
    expect(replacementPresentationStageForVfxStage('mastered')).toBe('mastered')
    expect(replacementPresentationStageForVfxStage('final')).toBe('final')

    expect(replacementWeaponPresentationForVfxStage('ash-halo', 'combined')).toBe(
      replacementWeaponPresentationProfile('ash-halo', 'upgraded'),
    )
    expect(replacementWeaponPresentationForVfxStage('null-bell', 'final')).toBe(
      replacementWeaponPresentationProfile('null-bell', 'final'),
    )
  })

  it('returns deterministic, deeply immutable presentation values', () => {
    for (const weaponId of REPLACEMENT_WEAPON_PRESENTATION_IDS) {
      for (const stage of REPLACEMENT_PRESENTATION_STAGES) {
        const first = replacementWeaponPresentationProfile(weaponId, stage)
        const second = replacementWeaponPresentationProfile(weaponId, stage)

        expect(first).toBe(second)
        expect(Object.isFrozen(first)).toBe(true)
        expect(Object.isFrozen(first.palette)).toBe(true)
        expect(Object.isFrozen(first.material)).toBe(true)
        expect(Object.isFrozen(first.trail)).toBe(true)
        expect(Object.isFrozen(first.particles)).toBe(true)
        expect(Object.isFrozen(first.cast)).toBe(true)
        expect(Object.isFrozen(first.impact)).toBe(true)
      }
    }
  })

  it('keeps cosmetic variation deterministic and isolated from gameplay state', () => {
    const first = Array.from({ length: 32 }, (_, index) =>
      replacementCosmeticUnit(817, index, 3),
    )
    const second = Array.from({ length: 32 }, (_, index) =>
      replacementCosmeticUnit(817, index, 3),
    )

    expect(second).toEqual(first)
    expect(new Set(first).size).toBeGreaterThan(24)
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
    expect(replacementCosmeticUnit(818, 0, 3)).not.toBe(first[0])
    expect(replacementCosmeticUnit(817, 0, 4)).not.toBe(first[0])
  })
})
