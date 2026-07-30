import { describe, expect, it } from 'vitest'
import type { WeaponId } from '../shared/types'
import type { AuthoredSpellAtlasSelection } from './spellVisualProgression'
import {
  PREMIUM_SPELL_ASSET_LODS,
  PREMIUM_SPELL_MATERIAL_FRAMES_BY_STATE,
  PREMIUM_SPELL_MATERIAL_LAYOUTS,
  PREMIUM_SPELL_PALETTES,
  PREMIUM_SPELL_PROJECTILE_ASSETS,
  PREMIUM_SPELL_PROJECTILE_LAYOUTS,
  PREMIUM_SPELL_STATES,
  premiumSpellAtlasSelection,
  premiumSpellChoreography,
  premiumSpellMaterialAssetPath,
  premiumSpellProjectileAssetPath,
  premiumSpellProjectileFrame,
  premiumSpellState,
  type PremiumSpellAtlasSelection,
} from './premiumSpellVfx'
import { ALL_WEAPON_VFX_IDS } from './weaponVfx'

const EXPECTED_PALETTES: Readonly<Record<WeaponId, string>> = {
  'helio-lance': 'helio',
  'crescent-array': 'crescent',
  'arc-choir': 'arc',
  'rift-seeds': 'rift',
  'comet-swarm': 'comet',
  'ash-halo': 'graveglass',
  'mirror-bow': 'mirror',
  'null-bell': 'eclipse',
}

describe('premium spell VFX atlas contract', () => {
  it('maps all eight spells to their own desktop and mobile material atlases', () => {
    expect(Object.keys(PREMIUM_SPELL_PALETTES)).toEqual([
      ...ALL_WEAPON_VFX_IDS,
    ])

    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const palette = PREMIUM_SPELL_PALETTES[weaponId]
      expect(palette.paletteId).toBe(EXPECTED_PALETTES[weaponId])

      for (const lod of PREMIUM_SPELL_ASSET_LODS) {
        const path = premiumSpellMaterialAssetPath(weaponId, lod)
        expect(path).toBe(palette[lod])
        expect(path).toBe(
          `assets/spell-vfx/premium/spell-material-${palette.paletteId}-v3-${lod}.webp`,
        )
      }
    }

    expect(new Set(
      ALL_WEAPON_VFX_IDS.map((weaponId) =>
        PREMIUM_SPELL_PALETTES[weaponId].paletteId,
      ),
    )).toHaveLength(8)
  })

  it('defines the authored 6x3 material and 6x8 projectile sheet geometry for both LODs', () => {
    for (const lod of PREMIUM_SPELL_ASSET_LODS) {
      const material = PREMIUM_SPELL_MATERIAL_LAYOUTS[lod]
      expect(material.columns).toBe(6)
      expect(material.rows).toBe(3)
      expect(material.frameCount).toBe(18)
      expect(material.cellWidth * material.columns).toBe(material.width)
      expect(material.cellHeight * material.rows).toBe(material.height)

      const projectile = PREMIUM_SPELL_PROJECTILE_LAYOUTS[lod]
      expect(projectile.columns).toBe(6)
      expect(projectile.rows).toBe(8)
      expect(projectile.frameCount).toBe(48)
      expect(projectile.cellWidth * projectile.columns).toBe(projectile.width)
      expect(projectile.cellHeight * projectile.rows).toBe(projectile.height)
      expect(premiumSpellProjectileAssetPath(lod)).toBe(
        PREMIUM_SPELL_PROJECTILE_ASSETS[lod],
      )
      expect(PREMIUM_SPELL_PROJECTILE_ASSETS[lod]).toBe(
        `assets/spell-vfx/premium/spell-projectiles-v3-${lod}.webp`,
      )
    }
  })

  it('selects every row, column and flattened projectile frame exactly once', () => {
    const selectedFrames = new Set<number>()

    for (const [row, weaponId] of ALL_WEAPON_VFX_IDS.entries()) {
      for (const [column, state] of PREMIUM_SPELL_STATES.entries()) {
        const frame = premiumSpellProjectileFrame(weaponId, state)
        expect(frame.row).toBe(row)
        expect(frame.column).toBe(column)
        expect(frame.frameIndex).toBe(row * 6 + column)
        expect(frame.frameIndex).toBeGreaterThanOrEqual(0)
        expect(frame.frameIndex).toBeLessThan(48)
        selectedFrames.add(frame.frameIndex)
      }
    }

    expect(selectedFrames).toHaveLength(48)
  })

  it('defines spell-specific macro formations with strict Rank I-V and Awakened growth', () => {
    const formations = new Set<string>()
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const choreography = PREMIUM_SPELL_STATES.map((state) =>
        premiumSpellChoreography(weaponId, state),
      )
      formations.add(choreography[0].formation)
      for (let index = 1; index < choreography.length; index += 1) {
        expect(
          choreography[index].structureCount,
          `${weaponId} ${PREMIUM_SPELL_STATES[index]}`,
        ).toBeGreaterThan(choreography[index - 1].structureCount)
        expect(choreography[index].scale).toBeGreaterThan(
          choreography[index - 1].scale,
        )
        expect(choreography[index].holdScale).toBeGreaterThan(
          choreography[index - 1].holdScale,
        )
      }
      expect(Object.isFrozen(choreography[0])).toBe(true)
    }
    expect(formations).toHaveLength(ALL_WEAPON_VFX_IDS.length)
  })

  it('keeps all material frame roles in bounds and changes every adjacent state', () => {
    const materialFrameCount =
      PREMIUM_SPELL_MATERIAL_LAYOUTS.desktop.frameCount
    const signatures = PREMIUM_SPELL_STATES.map((state) => {
      const frames = PREMIUM_SPELL_MATERIAL_FRAMES_BY_STATE[state]
      for (const frame of [
        frames.primary,
        frames.secondary,
        frames.impact,
      ]) {
        expect(frame).toBeGreaterThanOrEqual(0)
        expect(frame).toBeLessThan(materialFrameCount)
      }
      return `${frames.primary}/${frames.secondary}/${frames.impact}`
    })

    expect(new Set(signatures)).toHaveLength(PREMIUM_SPELL_STATES.length)
    for (let index = 1; index < signatures.length; index += 1) {
      expect(signatures[index]).not.toBe(signatures[index - 1])
    }
    expect(signatures.at(-1)).not.toBe(signatures.at(-2))
    for (const role of ['primary', 'secondary', 'impact'] as const) {
      expect(
        new Set(
          PREMIUM_SPELL_STATES.map(
            (state) => PREMIUM_SPELL_MATERIAL_FRAMES_BY_STATE[state][role],
          ),
        ),
        `${role} semantic frame`,
      ).toHaveLength(PREMIUM_SPELL_STATES.length)
    }
  })

  it('maps each state column to primary, secondary and impact rows', () => {
    expect(
      PREMIUM_SPELL_STATES.map(
        (state) => PREMIUM_SPELL_MATERIAL_FRAMES_BY_STATE[state].primary,
      ),
    ).toEqual([0, 1, 2, 3, 4, 5])
    expect(
      PREMIUM_SPELL_STATES.map(
        (state) => PREMIUM_SPELL_MATERIAL_FRAMES_BY_STATE[state].secondary,
      ),
    ).toEqual([6, 7, 8, 9, 10, 11])
    expect(
      PREMIUM_SPELL_STATES.map(
        (state) => PREMIUM_SPELL_MATERIAL_FRAMES_BY_STATE[state].impact,
      ),
    ).toEqual([12, 13, 14, 15, 16, 17])
  })

  it('returns a fingerprint-compatible, immutable selection for every spell, state and LOD', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      for (const state of PREMIUM_SPELL_STATES) {
        for (const lod of PREMIUM_SPELL_ASSET_LODS) {
          const selection: PremiumSpellAtlasSelection =
            premiumSpellAtlasSelection(weaponId, state, lod)
          const fingerprintSelection: AuthoredSpellAtlasSelection = selection

          expect(fingerprintSelection.atlasId).toBe(
            `premium-spell-vfx-v3:${lod}`,
          )
          expect(selection.weaponId).toBe(weaponId)
          expect(selection.state).toBe(state)
          expect(selection.paletteId).toBe(
            PREMIUM_SPELL_PALETTES[weaponId].paletteId,
          )
          expect(selection.materialAssetPath).toBe(
            premiumSpellMaterialAssetPath(weaponId, lod),
          )
          expect(selection.projectileAssetPath).toBe(
            premiumSpellProjectileAssetPath(lod),
          )
          expect(selection.choreographyFrame).toContain(
            `${selection.projectile.row}/${selection.projectile.column}/${selection.projectile.frameIndex}`,
          )
          expect(selection.materialFrame).toContain(
            `${selection.material.primary}/${selection.material.secondary}/${selection.material.impact}`,
          )
          expect(selection.awakeningFrame === null).toBe(
            state !== 'awakened',
          )
          expect(Object.isFrozen(selection)).toBe(true)
        }
      }
    }
  })

  it('makes adjacent authored selections and every Awakened read materially distinct', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const selections = PREMIUM_SPELL_STATES.map((state) =>
        premiumSpellAtlasSelection(weaponId, state, 'desktop'),
      )
      const signatures = selections.map((selection) => JSON.stringify({
        choreography: selection.choreographyFrame,
        material: selection.materialFrame,
        awakening: selection.awakeningFrame,
      }))

      expect(new Set(signatures), weaponId).toHaveLength(6)
      for (let index = 1; index < signatures.length; index += 1) {
        expect(
          signatures[index],
          `${weaponId}: ${PREMIUM_SPELL_STATES[index - 1]} -> ${PREMIUM_SPELL_STATES[index]}`,
        ).not.toBe(signatures[index - 1])
      }
      expect(selections[5].projectile.column).toBe(5)
      expect(selections[5].awakeningFrame).not.toBeNull()
      expect(selections[5].materialFrame).not.toBe(
        selections[4].materialFrame,
      )
    }
  })

  it('normalizes runtime Spell Rank inputs to the six authored states', () => {
    expect([
      premiumSpellState(1),
      premiumSpellState(2),
      premiumSpellState(3),
      premiumSpellState(4),
      premiumSpellState(5),
      premiumSpellState(5, true),
    ]).toEqual([...PREMIUM_SPELL_STATES])
    expect(premiumSpellState(Number.NaN)).toBe('rank-i')
    expect(premiumSpellState(-4)).toBe('rank-i')
    expect(premiumSpellState(99)).toBe('rank-v')
    expect(premiumSpellState(1, true)).toBe('awakened')
  })
})
