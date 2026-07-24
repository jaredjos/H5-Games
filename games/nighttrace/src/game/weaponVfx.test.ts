import { describe, expect, it } from 'vitest'
import type { WeaponId } from '../shared/types'
import {
  ALL_WEAPON_VFX_IDS,
  WEAPON_VFX_PALETTE_NAMES,
  resolveWeaponVfxState,
  weaponVfxProfile,
  type WeaponVfxState,
} from './weaponVfx'

const SHOWCASE_STATES = [
  resolveWeaponVfxState(1, 0, false),
  resolveWeaponVfxState(1, 1, false),
  resolveWeaponVfxState(5, 0, false),
  resolveWeaponVfxState(5, 3, true),
] as const

const profileFor = (weaponId: WeaponId, state: WeaponVfxState) =>
  weaponVfxProfile(weaponId, state)

describe('weapon VFX state resolution', () => {
  it('maps every weapon showcase state to the documented presentation stage', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const [solo, combined, mastered, final] = SHOWCASE_STATES
      expect(solo.stage, weaponId).toBe('solo')
      expect(combined.stage, weaponId).toBe('combined')
      expect(mastered.stage, weaponId).toBe('mastered')
      expect(final.stage, weaponId).toBe('final')
    }
  })

  it('increases intensity and detail monotonically through the showcase states', () => {
    for (let index = 1; index < SHOWCASE_STATES.length; index += 1) {
      expect(SHOWCASE_STATES[index].intensity).toBeGreaterThan(
        SHOWCASE_STATES[index - 1].intensity,
      )
      expect(SHOWCASE_STATES[index].detail).toBeGreaterThan(
        SHOWCASE_STATES[index - 1].detail,
      )
    }
  })

  it('clamps malformed or out-of-range ranks to supported visual bounds', () => {
    expect(resolveWeaponVfxState(Number.NaN, Number.NaN, false)).toMatchObject({
      rank: 1,
      moduleRank: 0,
      stage: 'solo',
    })
    expect(resolveWeaponVfxState(99, 99, true)).toMatchObject({
      rank: 5,
      moduleRank: 3,
      stage: 'final',
      intensity: 1,
      detail: 11,
    })
  })

  it('is deterministic and returns immutable state values', () => {
    const first = resolveWeaponVfxState(4, 2, false)
    const second = resolveWeaponVfxState(4, 2, false)
    expect(first).toEqual(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(second)).toBe(true)
  })
})

describe('weapon VFX profiles', () => {
  it('covers every weapon with a distinct named palette', () => {
    expect(ALL_WEAPON_VFX_IDS).toHaveLength(8)
    const paletteNames = ALL_WEAPON_VFX_IDS.map(
      (weaponId) => WEAPON_VFX_PALETTE_NAMES[weaponId],
    )
    expect(paletteNames).toEqual([
      'Solar Crown',
      'Eclipse Ice',
      'Cathedral Voltage',
      'Eventide Viridian',
      'Perihelion Ember',
      'Cinder Seraph',
      'Infinite Prism',
      'Midnight Absolute',
    ])
    expect(new Set(paletteNames).size).toBe(ALL_WEAPON_VFX_IDS.length)
    expect(Object.isFrozen(WEAPON_VFX_PALETTE_NAMES)).toBe(true)
  })

  it('increases every scalable detail channel through the four showcase states', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const profiles = SHOWCASE_STATES.map((state) => profileFor(weaponId, state))
      for (let index = 1; index < profiles.length; index += 1) {
        const previous = profiles[index - 1]
        const current = profiles[index]
        expect(current.trailLengthScale, weaponId).toBeGreaterThan(
          previous.trailLengthScale,
        )
        expect(current.trailWidthScale, weaponId).toBeGreaterThan(
          previous.trailWidthScale,
        )
        expect(current.projectileScale, weaponId).toBeGreaterThan(
          previous.projectileScale,
        )
        expect(current.orbitCount, weaponId).toBeGreaterThan(previous.orbitCount)
        expect(current.particleCount, weaponId).toBeGreaterThan(previous.particleCount)
        expect(current.segmentCount, weaponId).toBeGreaterThan(previous.segmentCount)
      }
    }
  })

  it('returns deterministic, immutable, Pixi-ready primitive data', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const state = resolveWeaponVfxState(5, 3, true)
      const first = profileFor(weaponId, state)
      const second = profileFor(weaponId, state)
      expect(first).toEqual(second)
      expect(Object.isFrozen(first)).toBe(true)
      for (const color of [
        first.coreColor,
        first.glowColor,
        first.accentColor,
        first.secondaryColor,
      ]) {
        expect(Number.isInteger(color), weaponId).toBe(true)
        expect(color, weaponId).toBeGreaterThanOrEqual(0)
        expect(color, weaponId).toBeLessThanOrEqual(0xffffff)
      }
      expect(Number.isInteger(first.orbitCount), weaponId).toBe(true)
      expect(Number.isInteger(first.particleCount), weaponId).toBe(true)
      expect(Number.isInteger(first.segmentCount), weaponId).toBe(true)
    }
  })
})
