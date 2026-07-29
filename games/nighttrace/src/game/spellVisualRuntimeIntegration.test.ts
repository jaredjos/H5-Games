import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'
import recipeSource from './spellVisualRecipe.ts?raw'
import { ALL_WEAPON_VFX_IDS } from './weaponVfx'

describe('live spell-rank visual integration', () => {
  it('resolves one shared spell recipe inside the live effect renderer', () => {
    expect(runtimeSource).toContain(
      "import {\n  spellVisualRecipe,",
    )
    expect(runtimeSource).toContain(
      'const recipe = spellVisualRecipe(effect.weaponId, state)',
    )
    expect(runtimeSource).toContain(
      'recipe.structureCount + recipe.rankEmbellishment',
    )
    expect(runtimeSource).toContain('recipe.awakeningSignature')
  })

  it('uses the shared recipe for authored area spells and projectile detail', () => {
    expect(runtimeSource).toContain(
      'spellVisualRecipe(effect.weaponId, effect.visualState)',
    )
    expect(runtimeSource).toContain(
      'spellVisualRecipe(\n      projectile.weaponId,',
    )
    expect(runtimeSource).toContain(
      'recipe.rankEmbellishment /\n          Math.max(1, recipe.satelliteCount)',
    )
  })

  it('keeps all eight spell definitions in the live recipe table', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      expect(recipeSource, weaponId).toContain(`'${weaponId}':`)
    }
  })

  it('gives weak legacy cases explicit awakened choreography', () => {
    expect(runtimeSource).toContain(
      "recipe.awakeningSignature === 'eventide-garden'",
    )
    expect(runtimeSource).toContain(
      "recipe.awakeningSignature === 'perihelion-hunt'",
    )
    expect(runtimeSource).toContain(
      "recipe.awakeningSignature === 'infinite-refrain'",
    )
  })
})

