import { describe, expect, it } from 'vitest'
import {
  CHARACTER_VISUAL_PROFILES,
  characterMaterialFrameAt,
  resolveCharacterVisualLod,
} from './visualQuality'

describe('character visual quality tiers', () => {
  it('selects a cinematic desktop, a balanced laptop and a mobile phone tier', () => {
    expect(
      resolveCharacterVisualLod({
        viewportWidth: 1600,
        viewportHeight: 900,
        devicePixelRatio: 1.5,
        hardwareConcurrency: 12,
        deviceMemory: 8,
        pointerCoarse: false,
      }),
    ).toBe('cinematic')
    expect(
      resolveCharacterVisualLod({
        viewportWidth: 1100,
        viewportHeight: 700,
        devicePixelRatio: 2,
        hardwareConcurrency: 6,
        deviceMemory: 4,
        pointerCoarse: false,
      }),
    ).toBe('balanced')
    expect(
      resolveCharacterVisualLod({
        viewportWidth: 844,
        viewportHeight: 390,
        devicePixelRatio: 3,
        hardwareConcurrency: 8,
        deviceMemory: 8,
        pointerCoarse: true,
      }),
    ).toBe('mobile')
  })

  it('keeps every tier at a crisp full-resolution floor', () => {
    const tiers = [
      CHARACTER_VISUAL_PROFILES.mobile,
      CHARACTER_VISUAL_PROFILES.balanced,
      CHARACTER_VISUAL_PROFILES.cinematic,
    ]

    for (const profile of tiers) {
      expect(profile.atlasVariant).toBe('desktop')
      expect(profile.rendererResolutionCap).toBeGreaterThanOrEqual(2)
      expect(profile.rendererAntialias).toBe(true)
      expect(profile.generatedTextureResolution).toBeGreaterThanOrEqual(2)
      expect(profile.materialFilterResolution).toBe('inherit')
      expect(profile.bloomStrength).toBe(0)
      expect(profile.refraction).toBe(false)
      expect(profile.screenGrade).toBe(false)
    }
  })

  it('never decreases raster quality as capability increases', () => {
    const tiers = [
      CHARACTER_VISUAL_PROFILES.mobile,
      CHARACTER_VISUAL_PROFILES.balanced,
      CHARACTER_VISUAL_PROFILES.cinematic,
    ]

    for (let index = 1; index < tiers.length; index += 1) {
      expect(tiers[index].rendererResolutionCap).toBeGreaterThanOrEqual(
        tiers[index - 1].rendererResolutionCap,
      )
      expect(tiers[index].generatedTextureResolution).toBeGreaterThanOrEqual(
        tiers[index - 1].generatedTextureResolution,
      )
    }
  })
})

describe('authored character material atlas sampling', () => {
  const base = {
    actor: 'boss' as const,
    time: 0,
    moving: 0,
    attackProgress: -1,
    hitProgress: -1,
    deathProgress: -1,
    fps: 8,
  }

  it('maps idle, locomotion, attacks and reactions to their authored rows', () => {
    expect(characterMaterialFrameAt(base)).toBe(0)
    expect(characterMaterialFrameAt({ ...base, time: 0.13 })).toBe(1)
    expect(characterMaterialFrameAt({ ...base, moving: 1 })).toBe(4)
    expect(characterMaterialFrameAt({ ...base, attackProgress: 0.62 })).toBe(10)
    expect(characterMaterialFrameAt({ ...base, hitProgress: 0.2 })).toBe(12)
    expect(
      characterMaterialFrameAt({
        ...base,
        attackProgress: 0.8,
        deathProgress: 0.99,
      }),
    ).toBe(15)
  })

  it('keeps mobile and desktop atlases frame-compatible', () => {
    for (const fps of [
      CHARACTER_VISUAL_PROFILES.mobile.overlayFps,
      CHARACTER_VISUAL_PROFILES.cinematic.overlayFps,
    ]) {
      for (const time of [0, 0.1, 0.35, 0.9, 4.2]) {
        const frame = characterMaterialFrameAt({ ...base, fps, time, moving: 1 })
        expect(frame).toBeGreaterThanOrEqual(4)
        expect(frame).toBeLessThanOrEqual(7)
      }
    }
  })
})
