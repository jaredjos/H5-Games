import { describe, expect, it } from 'vitest'
import {
  HOSTILE_SPECIAL_CRIMSON,
  HOSTILE_SPECIAL_VIOLET,
  sampleHostileSpecialEnergy,
} from './hostileSpecialEnergy'

describe('hostile special energy', () => {
  const base = {
    footprint: 'field' as const,
    progress: 0.5,
    motionTime: 2,
    seed: 41,
    lod: 'desktop' as const,
    reducedFlash: false,
    active: true,
  }

  it('exists only for explicitly special hostile footprints', () => {
    expect(sampleHostileSpecialEnergy({ ...base, active: false })).toHaveLength(0)
    expect(sampleHostileSpecialEnergy(base)).toHaveLength(12)
    expect(sampleHostileSpecialEnergy({
      ...base,
      footprint: 'lane',
      lod: 'mobile',
    })).toHaveLength(8)
  })

  it('uses restrained crimson and violet marks with bounded opacity', () => {
    const marks = sampleHostileSpecialEnergy(base)
    expect(new Set(marks.map(({ color }) => color))).toEqual(
      new Set([HOSTILE_SPECIAL_CRIMSON, HOSTILE_SPECIAL_VIOLET]),
    )
    expect(marks.every(({ alpha }) => alpha >= 0.14 && alpha < 0.45)).toBe(true)
    expect(marks.every(({ span }) => span > 0 && span < 0.1)).toBe(true)
    expect(Math.max(...marks.map(({ alpha }) => alpha))).toBeGreaterThan(0.25)
  })

  it('is deterministic and respects reduced-flash accessibility', () => {
    expect(sampleHostileSpecialEnergy(base)).toEqual(
      sampleHostileSpecialEnergy(base),
    )
    const full = sampleHostileSpecialEnergy(base)
    const reduced = sampleHostileSpecialEnergy({ ...base, reducedFlash: true })
    expect(reduced[0].alpha).toBeLessThan(full[0].alpha)
  })
})
