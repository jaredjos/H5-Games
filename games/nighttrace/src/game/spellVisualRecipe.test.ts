import { describe, expect, it } from 'vitest'
import { ALL_WEAPON_VFX_IDS, resolveWeaponVfxState } from './weaponVfx'
import { spellVisualRecipe } from './spellVisualRecipe'

const SHOWCASE_STATES = [
  resolveWeaponVfxState(1, 0, false),
  resolveWeaponVfxState(1, 1, false),
  resolveWeaponVfxState(5, 0, false),
  resolveWeaponVfxState(5, 3, true),
] as const

const recipeFingerprint = (
  recipe: ReturnType<typeof spellVisualRecipe>,
) =>
  JSON.stringify({
    silhouette: recipe.silhouette,
    structureCount: recipe.structureCount,
    materialLayerCount: recipe.materialLayerCount,
    satelliteCount: recipe.satelliteCount,
    trailPasses: recipe.trailPasses,
    materialFrames: recipe.materialFrames,
    awakeningSignature: recipe.awakeningSignature,
  })

describe('spell visual recipes', () => {
  it('gives every spell four structurally distinct showcase identities', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const recipes = SHOWCASE_STATES.map((state) =>
        spellVisualRecipe(weaponId, state),
      )
      expect(
        new Set(recipes.map(recipeFingerprint)).size,
        weaponId,
      ).toBe(recipes.length)
      expect(
        new Set(recipes.map((recipe) => recipe.silhouette)).size,
        weaponId,
      ).toBe(recipes.length)
    }
  })

  it('requires an authored awakening signature and a structural final upgrade', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const mastered = spellVisualRecipe(weaponId, SHOWCASE_STATES[2])
      const final = spellVisualRecipe(weaponId, SHOWCASE_STATES[3])

      expect(final.awakeningSignature, weaponId).not.toBeNull()
      expect(final.silhouette, weaponId).not.toBe(mastered.silhouette)
      expect(final.structureCount, weaponId).toBeGreaterThan(
        mastered.structureCount,
      )
      expect(final.materialLayerCount, weaponId).toBeGreaterThan(
        mastered.materialLayerCount,
      )
      expect(final.satelliteCount, weaponId).toBeGreaterThan(
        mastered.satelliteCount,
      )
    }
  })

  it('makes each adjacent Spell Rank change live presentation detail', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const rankRecipes = [1, 2, 3, 4, 5].map((rank) =>
        spellVisualRecipe(
          weaponId,
          resolveWeaponVfxState(rank, 0, false),
        ),
      )
      for (let index = 1; index < rankRecipes.length; index += 1) {
        const previous = rankRecipes[index - 1]
        const current = rankRecipes[index]
        expect(current.rankEmbellishment, weaponId).toBeGreaterThan(
          previous.rankEmbellishment,
        )
        expect(current.satelliteCount, weaponId).toBeGreaterThan(
          previous.satelliteCount,
        )
      }
    }
  })

  it('is deterministic and immutable presentation-only data', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const state = resolveWeaponVfxState(5, 3, true)
      const first = spellVisualRecipe(weaponId, state)
      const second = spellVisualRecipe(weaponId, state)

      expect(first).toEqual(second)
      expect(Object.isFrozen(first), weaponId).toBe(true)
      expect(Object.isFrozen(first.materialFrames), weaponId).toBe(true)
      expect('damage' in first, weaponId).toBe(false)
      expect('radius' in first, weaponId).toBe(false)
      expect('cooldown' in first, weaponId).toBe(false)
    }
  })
})

