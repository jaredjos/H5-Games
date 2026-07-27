import { describe, expect, it } from 'vitest'
import {
  authoredSpellAssetDataKey,
  authoredSpellStageMaterialProfile,
  resolveAuthoredSpellAssetLod,
  sampleAuthoredSpellMaterialPose,
  type AuthoredSpellMaterialKind,
} from './authoredSpellPresentation'

describe('authored spell material presentation', () => {
  it('uses mobile assets only for the mobile visual LOD', () => {
    expect(resolveAuthoredSpellAssetLod('mobile')).toBe('mobile')
    expect(resolveAuthoredSpellAssetLod('balanced')).toBe('desktop')
    expect(resolveAuthoredSpellAssetLod('cinematic')).toBe('desktop')
  })

  it('maps every material and LOD to the embedded production asset', () => {
    expect(authoredSpellAssetDataKey('graveglass-spire', 'desktop')).toBe(
      'graveglassSpireDesktop',
    )
    expect(authoredSpellAssetDataKey('graveglass-spire', 'mobile')).toBe(
      'graveglassSpireMobile',
    )
    expect(authoredSpellAssetDataKey('eclipse-gate', 'desktop')).toBe(
      'eclipseGateDesktop',
    )
    expect(authoredSpellAssetDataKey('eclipse-gate', 'mobile')).toBe(
      'eclipseGateMobile',
    )
    expect(authoredSpellAssetDataKey('eclipse-cathedral', 'desktop')).toBe(
      'eclipseCathedralDesktop',
    )
    expect(authoredSpellAssetDataKey('eclipse-cathedral', 'mobile')).toBe(
      'eclipseCathedralMobile',
    )
  })

  it('increases authored material presence by stage and reserves the cathedral for final', () => {
    const stages = ['solo', 'combined', 'mastered', 'final'] as const
    const profiles = stages.map(authoredSpellStageMaterialProfile)

    expect(profiles.map((profile) => profile.cathedral)).toEqual([
      false,
      false,
      false,
      true,
    ])
    for (let index = 1; index < profiles.length; index += 1) {
      expect(profiles[index].materialScale).toBeGreaterThan(
        profiles[index - 1].materialScale,
      )
      expect(profiles[index].opacity).toBeGreaterThan(
        profiles[index - 1].opacity,
      )
    }
  })

  it.each([
    ['graveglass-spire', 0.12, 0.34, 0.76, 0.93],
    ['eclipse-gate', 0.02, 0.22, 0.72, 0.93],
    ['eclipse-cathedral', 0.04, 0.3, 0.9, 1.17],
  ] as const)(
    'samples deterministic rise, hold, impact and decay for %s',
    (kind, start, holdTime, decayTime, endTime) => {
      const before = sampleAuthoredSpellMaterialPose(kind, start - 0.01)
      const hold = sampleAuthoredSpellMaterialPose(kind, holdTime)
      const decay = sampleAuthoredSpellMaterialPose(kind, decayTime)
      const after = sampleAuthoredSpellMaterialPose(kind, endTime)

      expect(before.visible).toBe(false)
      expect(hold.visible).toBe(true)
      expect(hold.rise).toBe(1)
      expect(hold.alpha).toBeGreaterThan(decay.alpha)
      expect(decay.decay).toBeGreaterThan(0)
      expect(after.visible).toBe(false)
      expect(after.alpha).toBe(0)
      expect(sampleAuthoredSpellMaterialPose(kind, holdTime)).toEqual(hold)
    },
  )

  it('returns finite bounded poses for every material across the effect window', () => {
    const kinds: AuthoredSpellMaterialKind[] = [
      'graveglass-spire',
      'eclipse-gate',
      'eclipse-cathedral',
    ]
    for (const kind of kinds) {
      for (let step = -2; step <= 14; step += 1) {
        const pose = sampleAuthoredSpellMaterialPose(kind, step * 0.1)
        for (const value of [
          pose.rise,
          pose.hold,
          pose.impact,
          pose.decay,
          pose.alpha,
        ]) {
          expect(Number.isFinite(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(1)
        }
        expect(pose.scaleX).toBeGreaterThan(0)
        expect(pose.scaleY).toBeGreaterThan(0)
      }
    }
  })
})
