import type {
  OwnedModule,
  OwnedWeapon,
  WeaponId,
} from '../shared/types'
import { WEAPONS } from './content'
import {
  spellVisualRecipe,
  type SpellVisualRecipe,
} from './spellVisualRecipe'
import { showcaseCaptureSeconds } from './showcase'
import {
  resolveWeaponVfxState,
  weaponVfxProfile,
  type WeaponVfxProfile,
  type WeaponVfxState,
} from './weaponVfx'

export type SpellVisualMilestoneId =
  | 'rank-i'
  | 'rank-ii'
  | 'rank-iii'
  | 'rank-iv'
  | 'rank-v'
  | 'awakened'

export interface SpellVisualMilestone {
  readonly id: SpellVisualMilestoneId
  readonly spellRank: 1 | 2 | 3 | 4 | 5
  readonly moduleRank: 0 | 1
  readonly awakened: boolean
  readonly label: string
}

export const SPELL_VISUAL_MILESTONES: readonly SpellVisualMilestone[] =
  Object.freeze([
    Object.freeze({
      id: 'rank-i',
      spellRank: 1,
      moduleRank: 0,
      awakened: false,
      label: 'Spell Rank I',
    }),
    Object.freeze({
      id: 'rank-ii',
      spellRank: 2,
      moduleRank: 0,
      awakened: false,
      label: 'Spell Rank II',
    }),
    Object.freeze({
      id: 'rank-iii',
      spellRank: 3,
      moduleRank: 0,
      awakened: false,
      label: 'Spell Rank III',
    }),
    Object.freeze({
      id: 'rank-iv',
      spellRank: 4,
      moduleRank: 0,
      awakened: false,
      label: 'Spell Rank IV',
    }),
    Object.freeze({
      id: 'rank-v',
      spellRank: 5,
      moduleRank: 0,
      awakened: false,
      label: 'Spell Rank V',
    }),
    Object.freeze({
      id: 'awakened',
      spellRank: 5,
      moduleRank: 1,
      awakened: true,
      label: 'Awakened',
    }),
  ] satisfies readonly SpellVisualMilestone[])

/**
 * Optional authored-atlas selection data. The renderer can supply these fields
 * once a rank chooses concrete premium frames. They participate in regression
 * fingerprints without coupling this contract to a specific Pixi loader.
 */
export interface AuthoredSpellAtlasSelection {
  readonly atlasId: string
  readonly choreographyFrame: string
  readonly materialFrame: string
  readonly awakeningFrame?: string | null
}

export interface SpellVisualFingerprints {
  readonly choreography: string
  readonly material: string
  readonly live: string
}

export interface SpellVisualCaptureLoadout {
  readonly weapons: readonly OwnedWeapon[]
  readonly modules: readonly OwnedModule[]
}

export interface SpellVisualCapturePlanEntry {
  readonly milestone: SpellVisualMilestone
  readonly state: WeaponVfxState
  readonly loadout: SpellVisualCaptureLoadout
  readonly captureSeconds: number
  readonly outputSlug: string
}

const milestoneById = (
  milestoneId: SpellVisualMilestoneId,
): SpellVisualMilestone => {
  const milestone = SPELL_VISUAL_MILESTONES.find(
    (candidate) => candidate.id === milestoneId,
  )
  if (!milestone) {
    throw new Error(`Unknown spell visual milestone: ${milestoneId}`)
  }
  return milestone
}

export function spellVisualMilestoneState(
  milestone: SpellVisualMilestone,
): WeaponVfxState {
  return resolveWeaponVfxState(
    milestone.spellRank,
    milestone.moduleRank,
    milestone.awakened,
  )
}

const atlasFingerprint = (
  atlas: AuthoredSpellAtlasSelection | undefined,
) => atlas
  ? {
      atlasId: atlas.atlasId,
      choreographyFrame: atlas.choreographyFrame,
      materialFrame: atlas.materialFrame,
      awakeningFrame: atlas.awakeningFrame ?? null,
    }
  : null

/**
 * Deliberately excludes milestone names and rankEmbellishment bookkeeping.
 * A fingerprint changes only when data consumed by live choreography,
 * authored materials, or the VFX profile changes.
 */
export function spellVisualFingerprints(
  weaponId: WeaponId,
  state: WeaponVfxState,
  atlas?: AuthoredSpellAtlasSelection,
): SpellVisualFingerprints {
  const recipe: SpellVisualRecipe = spellVisualRecipe(weaponId, state)
  const profile: WeaponVfxProfile = weaponVfxProfile(weaponId, state)
  const atlasSelection = atlasFingerprint(atlas)

  const choreography = JSON.stringify({
    stage: recipe.stage,
    silhouette: recipe.silhouette,
    structureCount: recipe.structureCount,
    satelliteCount: recipe.satelliteCount,
    trailPasses: recipe.trailPasses,
    trailLengthScale: profile.trailLengthScale,
    trailWidthScale: profile.trailWidthScale,
    projectileScale: profile.projectileScale,
    orbitCount: profile.orbitCount,
    segmentCount: profile.segmentCount,
    authoredAtlas: atlasSelection
      ? {
          atlasId: atlasSelection.atlasId,
          frame: atlasSelection.choreographyFrame,
          awakeningFrame: atlasSelection.awakeningFrame,
        }
      : null,
  })
  const material = JSON.stringify({
    materialLayerCount: recipe.materialLayerCount,
    materialFrames: recipe.materialFrames,
    particleCount: profile.particleCount,
    coreColor: profile.coreColor,
    glowColor: profile.glowColor,
    accentColor: profile.accentColor,
    secondaryColor: profile.secondaryColor,
    awakeningSignature: recipe.awakeningSignature,
    authoredAtlas: atlasSelection
      ? {
          atlasId: atlasSelection.atlasId,
          frame: atlasSelection.materialFrame,
          awakeningFrame: atlasSelection.awakeningFrame,
        }
      : null,
  })

  return Object.freeze({
    choreography,
    material,
    live: JSON.stringify({ choreography, material }),
  })
}

export function spellVisualCaptureLoadout(
  weaponId: WeaponId,
  milestoneId: SpellVisualMilestoneId,
): SpellVisualCaptureLoadout {
  const milestone = milestoneById(milestoneId)
  const weapon: OwnedWeapon = {
    id: weaponId,
    rank: milestone.spellRank,
    ...(milestone.awakened ? { awakened: true } : {}),
  }
  const modules: readonly OwnedModule[] = milestone.moduleRank > 0
    ? Object.freeze([Object.freeze({
        id: WEAPONS[weaponId].moduleId,
        rank: milestone.moduleRank,
      })])
    : Object.freeze([])

  return Object.freeze({
    weapons: Object.freeze([Object.freeze(weapon)]),
    modules,
  })
}

/**
 * Rank-complete deterministic capture inputs. The existing local showcase
 * capture time is reused so adding a rank-aware query hook does not change the
 * authored readability beat for that spell.
 */
export function spellVisualCapturePlan(
  weaponId: WeaponId,
): readonly SpellVisualCapturePlanEntry[] {
  return Object.freeze(SPELL_VISUAL_MILESTONES.map((milestone) =>
    Object.freeze({
      milestone,
      state: spellVisualMilestoneState(milestone),
      loadout: spellVisualCaptureLoadout(weaponId, milestone.id),
      captureSeconds: showcaseCaptureSeconds(weaponId),
      outputSlug: `${weaponId}-${milestone.id}`,
    }),
  ))
}
