import { describe, expect, it } from 'vitest'
import { HOSTILE_MATERIAL_FORBIDDEN_GEOMETRY } from './enemyPresentation'
import {
  hostileColorLuminance,
  resolveHostileTelegraphPalette,
} from './hostileTelegraphPalette'

const ACTOR_COLORS = {
  crimson: 0xd9485c,
  violet: 0x9550a8,
  venom: 0x87973b,
} as const

describe('hostile telegraph material palettes', () => {
  it('maps every hostile family into bounded, immutable material chroma', () => {
    for (const [family, actorColor] of Object.entries(ACTOR_COLORS)) {
      const palette = resolveHostileTelegraphPalette({
        family: family as keyof typeof ACTOR_COLORS,
        actorColor,
        emphasis: 1,
      })

      expect(Object.isFrozen(palette)).toBe(true)
      expect(palette.geometryPolicy).toBe('grounded-material-only')
      expect(hostileColorLuminance(palette.groundTint)).toBeLessThan(0.08)
      expect(hostileColorLuminance(palette.smokeTint)).toBeLessThan(0.15)
      expect(hostileColorLuminance(palette.seepTint)).toBeLessThan(0.28)
      expect(hostileColorLuminance(palette.impactTint)).toBeLessThan(0.5)
      expect(palette.accentCoverage).toBeGreaterThan(0)
      expect(palette.accentCoverage).toBeLessThanOrEqual(0.1)

      for (const value of [
        palette.groundOpacity,
        palette.smokeOpacity,
        palette.seepOpacity,
        palette.impactOpacity,
        palette.emission,
        palette.accentCoverage,
      ]) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps sovereign emphasis in opacity and coverage rather than geometry', () => {
    const horde = resolveHostileTelegraphPalette({
      family: 'crimson',
      actorColor: ACTOR_COLORS.crimson,
      emphasis: 0,
    })
    const boss = resolveHostileTelegraphPalette({
      family: 'crimson',
      actorColor: ACTOR_COLORS.crimson,
      emphasis: 1,
    })

    expect(boss.groundTint).toBe(horde.groundTint)
    expect(boss.smokeTint).toBe(horde.smokeTint)
    expect(boss.seepTint).toBe(horde.seepTint)
    expect(boss.impactTint).toBe(horde.impactTint)
    expect(boss.groundOpacity).toBeGreaterThan(horde.groundOpacity)
    expect(boss.smokeOpacity).toBeGreaterThan(horde.smokeOpacity)
    expect(boss.seepOpacity).toBeGreaterThan(horde.seepOpacity)
    expect(boss.impactOpacity).toBeGreaterThan(horde.impactOpacity)
    expect(boss.accentCoverage).toBeGreaterThan(horde.accentCoverage)
  })

  it('retains actor identity without accepting unbounded actor brightness', () => {
    const darkActor = resolveHostileTelegraphPalette({
      family: 'violet',
      actorColor: 0x341344,
      emphasis: 0.7,
    })
    const brightActor = resolveHostileTelegraphPalette({
      family: 'violet',
      actorColor: 0xffffff,
      emphasis: 0.7,
    })

    expect(brightActor.seepTint).not.toBe(darkActor.seepTint)
    expect(brightActor.impactTint).not.toBe(darkActor.impactTint)
    expect(hostileColorLuminance(brightActor.groundTint)).toBeLessThan(0.1)
    expect(hostileColorLuminance(brightActor.smokeTint)).toBeLessThan(0.2)
    expect(hostileColorLuminance(brightActor.seepTint)).toBeLessThan(0.35)
    expect(hostileColorLuminance(brightActor.impactTint)).toBeLessThan(0.6)
  })

  it('returns no diagrammatic geometry controls', () => {
    const palette = resolveHostileTelegraphPalette({
      family: 'crimson',
      actorColor: ACTOR_COLORS.crimson,
      emphasis: 1,
    })
    const keys = Object.keys(palette).map((key) => key.toLowerCase())

    for (const forbidden of HOSTILE_MATERIAL_FORBIDDEN_GEOMETRY) {
      expect(
        keys.some((key) => key.includes(forbidden.replace('-', ''))),
        forbidden,
      ).toBe(false)
    }
    expect(keys).not.toContain('radius')
    expect(keys).not.toContain('width')
    expect(keys).not.toContain('segments')
  })

  it('sanitizes malformed color and emphasis input deterministically', () => {
    const malformed = resolveHostileTelegraphPalette({
      family: 'violet',
      actorColor: Number.NaN,
      emphasis: Number.POSITIVE_INFINITY,
    })
    const repeated = resolveHostileTelegraphPalette({
      family: 'violet',
      actorColor: Number.NaN,
      emphasis: Number.POSITIVE_INFINITY,
    })

    expect(repeated).toEqual(malformed)
    expect(malformed.accentCoverage).toBe(0.05)
    for (const color of [
      malformed.groundTint,
      malformed.smokeTint,
      malformed.seepTint,
      malformed.impactTint,
    ]) {
      expect(Number.isInteger(color)).toBe(true)
      expect(color).toBeGreaterThanOrEqual(0)
      expect(color).toBeLessThanOrEqual(0xffffff)
    }
  })
})
