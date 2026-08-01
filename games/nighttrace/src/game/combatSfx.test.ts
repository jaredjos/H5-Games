import { describe, expect, it } from 'vitest'
import type { WeaponId } from '../shared/types'
import {
  COMBAT_SFX_MAX_TONE_VOICES,
  COMBAT_SFX_PROFILES,
  canAdmitCombatTone,
  combatSfxProfile,
  hostileSpecialSfxCue,
} from './combatSfx'

const WEAPONS: WeaponId[] = [
  'helio-lance',
  'crescent-array',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
  'ash-halo',
  'mirror-bow',
  'null-bell',
]

describe('combat SFX profiles', () => {
  it('gives all eight spells distinct authored tone signatures', () => {
    const signatures = WEAPONS.map((weaponId) =>
      combatSfxProfile(weaponId).tones
        .map(({ frequency, endFrequency, type }) => `${frequency}:${endFrequency}:${type}`)
        .join('|'),
    )
    expect(new Set(signatures)).toHaveLength(WEAPONS.length)
  })

  it('includes a restrained pulsing Aegis identity', () => {
    const profile = combatSfxProfile('dawnward-aegis')
    expect(profile.cooldownSeconds).toBeGreaterThanOrEqual(0.2)
    expect(profile.tones).toHaveLength(2)
    expect(profile.tones.every(({ type }) => type === 'sine' || type === 'triangle'))
      .toBe(true)
  })

  it('prioritizes boss and elite releases over simultaneous hero spell tones', () => {
    expect(COMBAT_SFX_PROFILES['boss-field'].priority)
      .toBeGreaterThan(COMBAT_SFX_PROFILES['elite-field'].priority)
    expect(COMBAT_SFX_PROFILES['elite-field'].priority)
      .toBeGreaterThan(COMBAT_SFX_PROFILES['helio-lance'].priority)
    expect(hostileSpecialSfxCue('boss', 'projectile')).toBe('boss-projectile')
  })

  it('gives every boss and elite release footprint a distinct high-priority signature', () => {
    const cueIds = [
      'boss-field',
      'boss-lane',
      'boss-projectile',
      'boss-melee',
      'elite-field',
      'elite-lane',
      'elite-projectile',
      'elite-blink',
    ] as const
    const signatures = cueIds.map((cueId) =>
      combatSfxProfile(cueId).tones
        .map(({ frequency, endFrequency, type }) => `${frequency}:${endFrequency}:${type}`)
        .join('|'),
    )
    expect(new Set(signatures)).toHaveLength(cueIds.length)
    expect(cueIds.slice(0, 4).every((cueId) =>
      combatSfxProfile(cueId).priority === 4)).toBe(true)
    expect(cueIds.slice(4).every((cueId) =>
      combatSfxProfile(cueId).priority === 3)).toBe(true)
    expect(hostileSpecialSfxCue('boss', 'melee')).toBe('boss-melee')
    expect(hostileSpecialSfxCue('elite', 'blink')).toBe('elite-blink')
  })
})

describe('combat SFX polyphony admission', () => {
  it('admits under cap, rejects equal-priority pile-up, and lets threats preempt', () => {
    expect(canAdmitCombatTone([], 2)).toBe(true)
    const saturated = Array(COMBAT_SFX_MAX_TONE_VOICES).fill(2)
    expect(canAdmitCombatTone(saturated, 2)).toBe(false)
    expect(canAdmitCombatTone(saturated, 4)).toBe(true)
  })
})
