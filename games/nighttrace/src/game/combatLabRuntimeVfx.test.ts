import { describe, expect, it } from 'vitest'
import type { WeaponId } from '../shared/types'
import {
  COMBAT_LAB_RUNTIME_VFX_IDS,
  resolveCombatLabRuntimeVfx,
} from './combatLabRuntimeVfx'
import { resolveWeaponVfxState, weaponVfxProfile } from './weaponVfx'

const untouchedIds: readonly WeaponId[] = [
  'ash-halo',
  'null-bell',
]

const rgb = (color: number) => ({
  red: (color >> 16) & 0xff,
  green: (color >> 8) & 0xff,
  blue: color & 0xff,
})

const expectViolet = (color: number) => {
  const { red, green, blue } = rgb(color)
  expect(red).toBeGreaterThan(green)
  expect(blue).toBeGreaterThan(green)
}

describe('launched Combat Lab runtime spell presentation', () => {
  it('gives every requested spell six distinct runtime fingerprints', () => {
    for (const weaponId of COMBAT_LAB_RUNTIME_VFX_IDS) {
      const states = [1, 2, 3, 4, 5].map((rank) =>
        resolveWeaponVfxState(rank, 0, false),
      )
      states.push(resolveWeaponVfxState(5, 3, true))
      const presentations = states.map((state) =>
        resolveCombatLabRuntimeVfx(
          'combat-lab',
          weaponId,
          state,
          weaponVfxProfile(weaponId, state),
        ),
      )
      const fingerprints = presentations.map(({ profile, ...presentation }) =>
        JSON.stringify({
          ...presentation,
          profile,
        }),
      )

      expect(new Set(fingerprints).size, weaponId).toBe(6)
      expect(presentations.every((presentation) => presentation.enabled)).toBe(true)
      expect(presentations.at(-1)?.awakened).toBe(true)
      expect(presentations.at(-1)?.energyScale).toBeGreaterThan(
        presentations[4].energyScale,
      )
    }
  })

  it('materially separates Astral Verdict and Mirror Bow visual motifs', () => {
    const state = resolveWeaponVfxState(5, 3, true)
    const rift = resolveCombatLabRuntimeVfx(
      'combat-lab',
      'rift-seeds',
      state,
      weaponVfxProfile('rift-seeds', state),
    )
    const mirror = resolveCombatLabRuntimeVfx(
      'combat-lab',
      'mirror-bow',
      state,
      weaponVfxProfile('mirror-bow', state),
    )

    expect(rift.motif).toBe('astral-verdict')
    expect(mirror.motif).toBe('prismatic-fletching')
    expect(rift.profile).not.toEqual(mirror.profile)
  })

  it('promotes the three approved authored identities outside Combat Lab', () => {
    const promotedIds: readonly WeaponId[] = [
      'arc-choir',
      'rift-seeds',
      'mirror-bow',
    ]
    for (const mode of ['campaign', 'boss-trial'] as const) {
      for (const weaponId of promotedIds) {
        const state = resolveWeaponVfxState(4, 2, false)
        const original = weaponVfxProfile(weaponId, state)
        const presentation = resolveCombatLabRuntimeVfx(
          mode,
          weaponId,
          state,
          original,
        )
        expect(presentation.enabled).toBe(true)
        expect(presentation.profile).not.toBe(original)
      }
    }
  })

  it('keeps Arc Choir violet in every rank, awakening and shipped mode', () => {
    const states = [1, 2, 3, 4, 5].map((rank) =>
      resolveWeaponVfxState(rank, 0, false),
    )
    states.push(resolveWeaponVfxState(5, 3, true))

    for (const state of states) {
      const presentations = (
        ['combat-lab', 'campaign', 'boss-trial'] as const
      ).map((mode) =>
        resolveCombatLabRuntimeVfx(
          mode,
          'arc-choir',
          state,
          weaponVfxProfile('arc-choir', state),
        ),
      )

      expect(presentations[1].profile).toEqual(presentations[0].profile)
      expect(presentations[2].profile).toEqual(presentations[0].profile)
      for (const presentation of presentations) {
        expectViolet(presentation.profile.glowColor)
        expectViolet(presentation.profile.accentColor)
        expectViolet(presentation.profile.secondaryColor)
        const core = rgb(presentation.profile.coreColor)
        expect(Math.min(core.red, core.green, core.blue)).toBeGreaterThanOrEqual(0xe8)
      }
    }
  })

  it('keeps the remaining Lab experiments isolated from shipped modes', () => {
    const labOnlyIds: readonly WeaponId[] = [
      'helio-lance',
      'crescent-array',
      'comet-swarm',
    ]
    for (const mode of ['campaign', 'boss-trial'] as const) {
      for (const weaponId of labOnlyIds) {
        const state = resolveWeaponVfxState(4, 2, false)
        const original = weaponVfxProfile(weaponId, state)
        const presentation = resolveCombatLabRuntimeVfx(
          mode,
          weaponId,
          state,
          original,
        )
        expect(presentation.enabled).toBe(false)
        expect(presentation.profile).toBe(original)
      }
    }
  })

  it('does not touch Graveglass Spires or Eclipse Harrow in the Lab', () => {
    const state = resolveWeaponVfxState(5, 3, true)
    for (const weaponId of untouchedIds) {
      const original = weaponVfxProfile(weaponId, state)
      const presentation = resolveCombatLabRuntimeVfx(
        'combat-lab',
        weaponId,
        state,
        original,
      )
      expect(presentation.enabled).toBe(false)
      expect(presentation.profile).toBe(original)
    }
  })
})
