import type { WeaponId } from '../shared/types'
import type { WeaponVfxStage, WeaponVfxState } from './weaponVfx'

export type SpellVisualSilhouette =
  | 'solar-needle'
  | 'split-corona'
  | 'crowned-lance'
  | 'crowned-spear'
  | 'twin-crescent'
  | 'moon-knot'
  | 'eclipse-array'
  | 'eclipse-wheel'
  | 'duet-chain'
  | 'choir-chain'
  | 'cathedral-chain'
  | 'cathedral-storm'
  | 'single-seed'
  | 'orbit-cluster'
  | 'rift-bloom'
  | 'eventide-garden'
  | 'ember-pair'
  | 'comet-flight'
  | 'perihelion-volley'
  | 'perihelion-hunt'
  | 'twin-spires'
  | 'branch-spires'
  | 'graveglass-grove'
  | 'sepulchral-orchard'
  | 'mirror-pair'
  | 'prism-triad'
  | 'refrain-arch'
  | 'infinite-refrain'
  | 'single-harrow'
  | 'crossed-harrow'
  | 'staggered-harrow'
  | 'black-benediction'

export type SpellAwakeningSignature =
  | 'crowned-spear'
  | 'eclipse-wheel'
  | 'cathedral-storm'
  | 'eventide-garden'
  | 'perihelion-hunt'
  | 'sepulchral-orchard'
  | 'infinite-refrain'
  | 'black-benediction'

export type SpellMaterialFrame =
  | 'gather'
  | 'drift-a'
  | 'drift-b'
  | 'impact'
  | 'lance'
  | 'fragments'
  | 'fracture'
  | 'dust'

export interface SpellVisualRecipe {
  readonly stage: WeaponVfxStage
  readonly silhouette: SpellVisualSilhouette
  /**
   * Large, readable authored forms. Renderers use this for gates, seeds,
   * crescents, comets, spires, or execution lanes rather than damage logic.
   */
  readonly structureCount: number
  /**
   * Secondary authored material passes that make Spell Ranks II-IV visibly
   * richer without changing hitboxes or damage.
   */
  readonly materialLayerCount: number
  /**
   * Small satellite forms such as fragments, echo-shards, and orbiting debris.
   */
  readonly satelliteCount: number
  /**
   * Distinct motion/material passes. This is intentionally separate from
   * gameplay projectile count.
   */
  readonly trailPasses: number
  /**
   * Every Spell Rank adds one live-consumed embellishment step.
   */
  readonly rankEmbellishment: number
  readonly materialFrames: readonly SpellMaterialFrame[]
  readonly awakeningSignature: SpellAwakeningSignature | null
}

interface SpellStageRecipe {
  readonly silhouette: SpellVisualSilhouette
  readonly structureCount: number
  readonly materialLayerCount: number
  readonly satelliteCount: number
  readonly trailPasses: number
  readonly materialFrames: readonly SpellMaterialFrame[]
  readonly awakeningSignature?: SpellAwakeningSignature
}

const freezeFrames = (
  frames: readonly SpellMaterialFrame[],
): readonly SpellMaterialFrame[] => Object.freeze([...frames])

const stageRecipe = (
  silhouette: SpellVisualSilhouette,
  structureCount: number,
  materialLayerCount: number,
  satelliteCount: number,
  trailPasses: number,
  materialFrames: readonly SpellMaterialFrame[],
  awakeningSignature?: SpellAwakeningSignature,
): SpellStageRecipe =>
  Object.freeze({
    silhouette,
    structureCount,
    materialLayerCount,
    satelliteCount,
    trailPasses,
    materialFrames: freezeFrames(materialFrames),
    awakeningSignature,
  })

const SPELL_STAGE_RECIPES = Object.freeze({
  'helio-lance': Object.freeze({
    solo: stageRecipe('solar-needle', 1, 1, 0, 1, ['lance']),
    combined: stageRecipe('split-corona', 2, 2, 2, 2, ['lance', 'fragments']),
    mastered: stageRecipe('crowned-lance', 3, 3, 4, 3, ['gather', 'lance', 'fragments']),
    final: stageRecipe('crowned-spear', 5, 4, 7, 4, ['gather', 'lance', 'fragments', 'impact'], 'crowned-spear'),
  }),
  'crescent-array': Object.freeze({
    solo: stageRecipe('twin-crescent', 3, 1, 1, 1, ['drift-a']),
    combined: stageRecipe('moon-knot', 5, 2, 2, 2, ['drift-a', 'fragments']),
    mastered: stageRecipe('eclipse-array', 7, 3, 4, 3, ['gather', 'drift-a', 'fragments']),
    final: stageRecipe('eclipse-wheel', 10, 4, 7, 4, ['gather', 'drift-a', 'fragments', 'fracture'], 'eclipse-wheel'),
  }),
  'arc-choir': Object.freeze({
    solo: stageRecipe('duet-chain', 2, 1, 1, 1, ['impact']),
    combined: stageRecipe('choir-chain', 3, 2, 2, 2, ['impact', 'drift-a']),
    mastered: stageRecipe('cathedral-chain', 4, 3, 4, 3, ['impact', 'drift-a', 'fragments']),
    final: stageRecipe('cathedral-storm', 6, 4, 7, 4, ['gather', 'impact', 'drift-a', 'fragments'], 'cathedral-storm'),
  }),
  'rift-seeds': Object.freeze({
    solo: stageRecipe('single-seed', 1, 1, 1, 1, ['drift-b']),
    combined: stageRecipe('orbit-cluster', 2, 2, 3, 2, ['drift-b', 'fragments']),
    mastered: stageRecipe('rift-bloom', 3, 3, 5, 3, ['gather', 'drift-b', 'fragments']),
    final: stageRecipe('eventide-garden', 5, 4, 9, 4, ['gather', 'drift-b', 'fragments', 'fracture'], 'eventide-garden'),
  }),
  'comet-swarm': Object.freeze({
    solo: stageRecipe('ember-pair', 2, 1, 1, 1, ['drift-b']),
    combined: stageRecipe('comet-flight', 3, 2, 3, 2, ['drift-b', 'dust']),
    mastered: stageRecipe('perihelion-volley', 5, 3, 5, 3, ['gather', 'drift-b', 'dust']),
    final: stageRecipe('perihelion-hunt', 7, 4, 8, 4, ['gather', 'drift-b', 'dust', 'impact'], 'perihelion-hunt'),
  }),
  'ash-halo': Object.freeze({
    solo: stageRecipe('twin-spires', 2, 1, 4, 1, ['fracture']),
    combined: stageRecipe('branch-spires', 3, 2, 6, 2, ['fracture', 'dust']),
    mastered: stageRecipe('graveglass-grove', 4, 3, 8, 3, ['gather', 'fracture', 'dust']),
    final: stageRecipe('sepulchral-orchard', 6, 4, 12, 4, ['gather', 'fracture', 'dust', 'impact'], 'sepulchral-orchard'),
  }),
  'mirror-bow': Object.freeze({
    solo: stageRecipe('mirror-pair', 2, 1, 1, 1, ['fragments']),
    combined: stageRecipe('prism-triad', 3, 2, 3, 2, ['fragments', 'drift-a']),
    mastered: stageRecipe('refrain-arch', 5, 3, 5, 3, ['gather', 'fragments', 'drift-a']),
    final: stageRecipe('infinite-refrain', 7, 4, 9, 4, ['gather', 'fragments', 'drift-a', 'fracture'], 'infinite-refrain'),
  }),
  'null-bell': Object.freeze({
    solo: stageRecipe('single-harrow', 1, 1, 3, 1, ['fracture']),
    combined: stageRecipe('crossed-harrow', 2, 2, 5, 2, ['fracture', 'drift-b']),
    mastered: stageRecipe('staggered-harrow', 3, 3, 7, 3, ['gather', 'fracture', 'drift-b']),
    final: stageRecipe('black-benediction', 4, 4, 10, 4, ['gather', 'fracture', 'drift-b', 'impact'], 'black-benediction'),
  }),
} as const satisfies Readonly<
  Record<WeaponId, Readonly<Record<WeaponVfxStage, SpellStageRecipe>>>
>)

export function spellVisualRecipe(
  weaponId: WeaponId,
  state: WeaponVfxState,
): SpellVisualRecipe {
  const base = SPELL_STAGE_RECIPES[weaponId][state.stage]
  const rankEmbellishment = Math.max(0, Math.min(4, state.rank - 1))
  const intermediateLayer =
    state.stage === 'solo' || state.stage === 'combined'
      ? Math.floor(rankEmbellishment / 2)
      : 0

  return Object.freeze({
    stage: state.stage,
    silhouette: base.silhouette,
    structureCount: base.structureCount,
    materialLayerCount:
      base.materialLayerCount + intermediateLayer,
    satelliteCount: base.satelliteCount + rankEmbellishment,
    trailPasses: base.trailPasses + Number(rankEmbellishment >= 3),
    rankEmbellishment,
    materialFrames: base.materialFrames,
    awakeningSignature: base.awakeningSignature ?? null,
  })
}
