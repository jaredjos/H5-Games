import { describe, expect, it } from 'vitest'
import {
  ALL_WEAPON_VFX_IDS,
  resolveWeaponVfxState,
} from './weaponVfx'
import { spellVisualRecipe } from './spellVisualRecipe'
import {
  SPELL_VISUAL_MILESTONES,
  spellVisualCapturePlan,
  spellVisualFingerprints,
  spellVisualMilestoneState,
  type AuthoredSpellAtlasSelection,
} from './spellVisualProgression'

const RANK_MILESTONES = SPELL_VISUAL_MILESTONES.slice(0, 5)
const AWAKENED_MILESTONE = SPELL_VISUAL_MILESTONES[5]

describe('premium spell visual progression contract', () => {
  it('gives every adjacent Spell Rank a distinct live choreography and material fingerprint', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const fingerprints = RANK_MILESTONES.map((milestone) =>
        spellVisualFingerprints(
          weaponId,
          spellVisualMilestoneState(milestone),
        ),
      )

      expect(
        new Set(fingerprints.map((entry) => entry.choreography)).size,
        `${weaponId} choreography`,
      ).toBe(RANK_MILESTONES.length)
      expect(
        new Set(fingerprints.map((entry) => entry.material)).size,
        `${weaponId} material`,
      ).toBe(RANK_MILESTONES.length)

      for (let index = 1; index < fingerprints.length; index += 1) {
        expect(
          fingerprints[index].live,
          `${weaponId} Rank ${index} -> ${index + 1}`,
        ).not.toBe(fingerprints[index - 1].live)
      }
    }
  })

  it('keeps Helio Lance visibly progressive instead of five identical rank reads', () => {
    const states = RANK_MILESTONES.map(spellVisualMilestoneState)
    const recipes = states.map((state) =>
      spellVisualRecipe('helio-lance', state),
    )
    const fingerprints = states.map((state) =>
      spellVisualFingerprints('helio-lance', state),
    )

    expect(new Set(fingerprints.map((entry) => entry.live))).toHaveLength(5)
    expect(new Set(fingerprints.map((entry) => entry.choreography))).toHaveLength(5)
    expect(new Set(fingerprints.map((entry) => entry.material))).toHaveLength(5)

    for (let index = 1; index < recipes.length; index += 1) {
      expect(recipes[index].satelliteCount).toBeGreaterThan(
        recipes[index - 1].satelliteCount,
      )
      expect(recipes[index].materialLayerCount).toBeGreaterThanOrEqual(
        recipes[index - 1].materialLayerCount,
      )
      expect(recipes[index].trailPasses).toBeGreaterThanOrEqual(
        recipes[index - 1].trailPasses,
      )
    }
  })

  it('requires every awakened spell to break from Spell Rank V with an authored signature', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const masteredState = resolveWeaponVfxState(5, 0, false)
      const awakenedState = spellVisualMilestoneState(AWAKENED_MILESTONE)
      const masteredRecipe = spellVisualRecipe(weaponId, masteredState)
      const awakenedRecipe = spellVisualRecipe(weaponId, awakenedState)
      const mastered = spellVisualFingerprints(weaponId, masteredState)
      const awakened = spellVisualFingerprints(weaponId, awakenedState)

      expect(awakenedRecipe.awakeningSignature, weaponId).not.toBeNull()
      expect(awakenedRecipe.silhouette, weaponId).not.toBe(
        masteredRecipe.silhouette,
      )
      expect(awakened.choreography, weaponId).not.toBe(mastered.choreography)
      expect(awakened.material, weaponId).not.toBe(mastered.material)
      expect(awakened.live, weaponId).not.toBe(mastered.live)
    }
  })

  it('includes future authored-atlas selections in both fingerprint halves', () => {
    const state = resolveWeaponVfxState(3, 0, false)
    const first: AuthoredSpellAtlasSelection = {
      atlasId: 'premium-spells-a',
      choreographyFrame: 'helio-rank-iii-cast-a',
      materialFrame: 'helio-rank-iii-material-a',
    }
    const choreographyVariant: AuthoredSpellAtlasSelection = {
      ...first,
      choreographyFrame: 'helio-rank-iii-cast-b',
    }
    const materialVariant: AuthoredSpellAtlasSelection = {
      ...first,
      materialFrame: 'helio-rank-iii-material-b',
    }

    const baseline = spellVisualFingerprints('helio-lance', state, first)
    const changedChoreography = spellVisualFingerprints(
      'helio-lance',
      state,
      choreographyVariant,
    )
    const changedMaterial = spellVisualFingerprints(
      'helio-lance',
      state,
      materialVariant,
    )

    expect(changedChoreography.choreography).not.toBe(baseline.choreography)
    expect(changedChoreography.material).toBe(baseline.material)
    expect(changedMaterial.material).not.toBe(baseline.material)
    expect(changedMaterial.choreography).toBe(baseline.choreography)
  })

  it('defines deterministic screenshot loadouts for Ranks I-V and Awakened', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const first = spellVisualCapturePlan(weaponId)
      const second = spellVisualCapturePlan(weaponId)

      expect(first).toEqual(second)
      expect(first).toHaveLength(6)
      expect(new Set(first.map((entry) => entry.outputSlug))).toHaveLength(6)
      expect(first.map((entry) => entry.state.rank)).toEqual([1, 2, 3, 4, 5, 5])
      expect(first.slice(0, 5).every((entry) =>
        entry.loadout.modules.length === 0 &&
        !entry.loadout.weapons[0].awakened
      )).toBe(true)

      const awakened = first[5]
      expect(awakened.state.awakened).toBe(true)
      expect(awakened.state.moduleRank).toBe(1)
      expect(awakened.loadout.weapons).toEqual([
        { id: weaponId, rank: 5, awakened: true },
      ])
      expect(awakened.loadout.modules).toHaveLength(1)
      expect(awakened.loadout.modules[0].rank).toBe(1)
      expect(new Set(first.map((entry) => entry.captureSeconds))).toHaveLength(1)
      expect(first.every(Object.isFrozen)).toBe(true)
    }
  })
})
