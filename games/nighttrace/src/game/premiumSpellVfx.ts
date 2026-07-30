import type { WeaponId } from '../shared/types'
import type {
  AuthoredSpellAtlasSelection,
  SpellVisualMilestoneId,
} from './spellVisualProgression'
import { ALL_WEAPON_VFX_IDS } from './weaponVfx'

export const PREMIUM_SPELL_ASSET_LODS = ['desktop', 'mobile'] as const
export const PREMIUM_SPELL_STATES = [
  'rank-i',
  'rank-ii',
  'rank-iii',
  'rank-iv',
  'rank-v',
  'awakened',
] as const satisfies readonly SpellVisualMilestoneId[]

export type PremiumSpellAssetLod =
  (typeof PREMIUM_SPELL_ASSET_LODS)[number]
export type PremiumSpellState = (typeof PREMIUM_SPELL_STATES)[number]
export type PremiumSpellPaletteId =
  | 'helio'
  | 'crescent'
  | 'arc'
  | 'rift'
  | 'comet'
  | 'graveglass'
  | 'mirror'
  | 'eclipse'

export interface PremiumSpellAtlasLayout {
  readonly width: number
  readonly height: number
  readonly columns: number
  readonly rows: number
  readonly cellWidth: number
  readonly cellHeight: number
  readonly frameCount: number
}

export interface PremiumSpellPaletteProfile {
  readonly paletteId: PremiumSpellPaletteId
  readonly desktop: string
  readonly mobile: string
}

export interface PremiumSpellMaterialFrames {
  readonly primary: number
  readonly secondary: number
  readonly impact: number
}

export interface PremiumSpellProjectileFrame {
  readonly row: number
  readonly column: number
  readonly frameIndex: number
}

export type PremiumSpellFormation =
  | 'solar-rails'
  | 'crescent-wheel'
  | 'sigil-choir'
  | 'void-orbit'
  | 'comet-fan'
  | 'graveglass-cluster'
  | 'mirror-gates'
  | 'eclipse-harrows'

export interface PremiumSpellChoreography {
  readonly formation: PremiumSpellFormation
  readonly structureCount: number
  readonly scale: number
  readonly spread: number
  readonly holdScale: number
}

export interface PremiumSpellAtlasSelection
  extends AuthoredSpellAtlasSelection {
  readonly weaponId: WeaponId
  readonly state: PremiumSpellState
  readonly lod: PremiumSpellAssetLod
  readonly paletteId: PremiumSpellPaletteId
  readonly materialAssetPath: string
  readonly projectileAssetPath: string
  readonly material: PremiumSpellMaterialFrames
  readonly projectile: PremiumSpellProjectileFrame
}

const assetPath = (fileName: string) =>
  `assets/spell-vfx/premium/${fileName}`

export const PREMIUM_SPELL_PALETTES = Object.freeze({
  'helio-lance': Object.freeze({
    paletteId: 'helio',
    desktop: assetPath('spell-material-helio-v3-desktop.webp'),
    mobile: assetPath('spell-material-helio-v3-mobile.webp'),
  }),
  'crescent-array': Object.freeze({
    paletteId: 'crescent',
    desktop: assetPath('spell-material-crescent-v3-desktop.webp'),
    mobile: assetPath('spell-material-crescent-v3-mobile.webp'),
  }),
  'arc-choir': Object.freeze({
    paletteId: 'arc',
    desktop: assetPath('spell-material-arc-v3-desktop.webp'),
    mobile: assetPath('spell-material-arc-v3-mobile.webp'),
  }),
  'rift-seeds': Object.freeze({
    paletteId: 'rift',
    desktop: assetPath('spell-material-rift-v3-desktop.webp'),
    mobile: assetPath('spell-material-rift-v3-mobile.webp'),
  }),
  'comet-swarm': Object.freeze({
    paletteId: 'comet',
    desktop: assetPath('spell-material-comet-v3-desktop.webp'),
    mobile: assetPath('spell-material-comet-v3-mobile.webp'),
  }),
  'ash-halo': Object.freeze({
    paletteId: 'graveglass',
    desktop: assetPath('spell-material-graveglass-v3-desktop.webp'),
    mobile: assetPath('spell-material-graveglass-v3-mobile.webp'),
  }),
  'mirror-bow': Object.freeze({
    paletteId: 'mirror',
    desktop: assetPath('spell-material-mirror-v3-desktop.webp'),
    mobile: assetPath('spell-material-mirror-v3-mobile.webp'),
  }),
  'null-bell': Object.freeze({
    paletteId: 'eclipse',
    desktop: assetPath('spell-material-eclipse-v3-desktop.webp'),
    mobile: assetPath('spell-material-eclipse-v3-mobile.webp'),
  }),
} as const satisfies Readonly<Record<WeaponId, PremiumSpellPaletteProfile>>)

export const PREMIUM_SPELL_MATERIAL_LAYOUTS = Object.freeze({
  desktop: Object.freeze({
    width: 1536,
    height: 768,
    columns: 6,
    rows: 3,
    cellWidth: 256,
    cellHeight: 256,
    frameCount: 18,
  }),
  mobile: Object.freeze({
    width: 768,
    height: 384,
    columns: 6,
    rows: 3,
    cellWidth: 128,
    cellHeight: 128,
    frameCount: 18,
  }),
} as const satisfies Readonly<
  Record<PremiumSpellAssetLod, PremiumSpellAtlasLayout>
>)

export const PREMIUM_SPELL_PROJECTILE_LAYOUTS = Object.freeze({
  desktop: Object.freeze({
    width: 1536,
    height: 1024,
    columns: 6,
    rows: 8,
    cellWidth: 256,
    cellHeight: 128,
    frameCount: 48,
  }),
  mobile: Object.freeze({
    width: 768,
    height: 512,
    columns: 6,
    rows: 8,
    cellWidth: 128,
    cellHeight: 64,
    frameCount: 48,
  }),
} as const satisfies Readonly<
  Record<PremiumSpellAssetLod, PremiumSpellAtlasLayout>
>)

export const PREMIUM_SPELL_PROJECTILE_ASSETS = Object.freeze({
  desktop: assetPath('spell-projectiles-v3-desktop.webp'),
  mobile: assetPath('spell-projectiles-v3-mobile.webp'),
} as const satisfies Readonly<Record<PremiumSpellAssetLod, string>>)

const PREMIUM_SPELL_CHOREOGRAPHY = Object.freeze({
  'helio-lance': Object.freeze({
    formation: 'solar-rails',
    counts: Object.freeze([1, 2, 3, 4, 5, 7]),
    spread: 0.78,
  }),
  'crescent-array': Object.freeze({
    formation: 'crescent-wheel',
    counts: Object.freeze([3, 5, 7, 9, 12, 14]),
    spread: 1,
  }),
  'arc-choir': Object.freeze({
    formation: 'sigil-choir',
    counts: Object.freeze([2, 3, 4, 5, 6, 8]),
    spread: 0.92,
  }),
  'rift-seeds': Object.freeze({
    formation: 'void-orbit',
    counts: Object.freeze([1, 2, 3, 4, 5, 7]),
    spread: 0.86,
  }),
  'comet-swarm': Object.freeze({
    formation: 'comet-fan',
    counts: Object.freeze([2, 3, 4, 5, 7, 9]),
    spread: 1.08,
  }),
  'ash-halo': Object.freeze({
    formation: 'graveglass-cluster',
    counts: Object.freeze([2, 3, 4, 5, 6, 8]),
    spread: 0.82,
  }),
  'mirror-bow': Object.freeze({
    formation: 'mirror-gates',
    counts: Object.freeze([2, 3, 4, 5, 7, 9]),
    spread: 1,
  }),
  'null-bell': Object.freeze({
    formation: 'eclipse-harrows',
    counts: Object.freeze([1, 2, 3, 4, 6, 8]),
    spread: 1.12,
  }),
} as const satisfies Readonly<
  Record<
    WeaponId,
    {
      readonly formation: PremiumSpellFormation
      readonly counts: readonly number[]
      readonly spread: number
    }
  >
>)

/**
 * Every authored material atlas is a 6x3 sheet. Columns are Rank I-V and
 * Awakened; rows are primary, secondary and impact. A state's three semantic
 * frames therefore share one column while remaining structurally distinct.
 */
export const PREMIUM_SPELL_MATERIAL_FRAMES_BY_STATE = Object.freeze({
  'rank-i': Object.freeze({
    primary: 0,
    secondary: 6,
    impact: 12,
  }),
  'rank-ii': Object.freeze({
    primary: 1,
    secondary: 7,
    impact: 13,
  }),
  'rank-iii': Object.freeze({
    primary: 2,
    secondary: 8,
    impact: 14,
  }),
  'rank-iv': Object.freeze({
    primary: 3,
    secondary: 9,
    impact: 15,
  }),
  'rank-v': Object.freeze({
    primary: 4,
    secondary: 10,
    impact: 16,
  }),
  awakened: Object.freeze({
    primary: 5,
    secondary: 11,
    impact: 17,
  }),
} as const satisfies Readonly<
  Record<PremiumSpellState, PremiumSpellMaterialFrames>
>)

const projectileRowByWeapon = Object.freeze(
  Object.fromEntries(
    ALL_WEAPON_VFX_IDS.map((weaponId, row) => [weaponId, row]),
  ) as Record<WeaponId, number>,
)

const stateColumn = (state: PremiumSpellState) =>
  PREMIUM_SPELL_STATES.indexOf(state)

export function premiumSpellState(
  spellRank: number,
  awakened = false,
): PremiumSpellState {
  if (awakened) return 'awakened'
  if (!Number.isFinite(spellRank)) return 'rank-i'
  const rank = Math.max(1, Math.min(5, Math.round(spellRank)))
  return PREMIUM_SPELL_STATES[rank - 1]
}

export function premiumSpellMaterialAssetPath(
  weaponId: WeaponId,
  lod: PremiumSpellAssetLod,
) {
  return PREMIUM_SPELL_PALETTES[weaponId][lod]
}

export function premiumSpellProjectileAssetPath(
  lod: PremiumSpellAssetLod,
) {
  return PREMIUM_SPELL_PROJECTILE_ASSETS[lod]
}

export function premiumSpellMaterialFrames(
  state: PremiumSpellState,
): PremiumSpellMaterialFrames {
  return PREMIUM_SPELL_MATERIAL_FRAMES_BY_STATE[state]
}

export function premiumSpellProjectileFrame(
  weaponId: WeaponId,
  state: PremiumSpellState,
): PremiumSpellProjectileFrame {
  const row = projectileRowByWeapon[weaponId]
  const column = stateColumn(state)
  return Object.freeze({
    row,
    column,
    frameIndex: row * PREMIUM_SPELL_STATES.length + column,
  })
}

export function premiumSpellChoreography(
  weaponId: WeaponId,
  state: PremiumSpellState,
): PremiumSpellChoreography {
  const definition = PREMIUM_SPELL_CHOREOGRAPHY[weaponId]
  const stateIndex = PREMIUM_SPELL_STATES.indexOf(state)
  return Object.freeze({
    formation: definition.formation,
    structureCount: definition.counts[stateIndex],
    scale: 0.9 + stateIndex * 0.115 + (state === 'awakened' ? 0.12 : 0),
    spread: definition.spread * (0.88 + stateIndex * 0.045),
    holdScale: 1 + stateIndex * 0.055 + (state === 'awakened' ? 0.16 : 0),
  })
}

export function premiumSpellAtlasSelection(
  weaponId: WeaponId,
  state: PremiumSpellState,
  lod: PremiumSpellAssetLod,
): PremiumSpellAtlasSelection {
  const palette = PREMIUM_SPELL_PALETTES[weaponId]
  const material = premiumSpellMaterialFrames(state)
  const projectile = premiumSpellProjectileFrame(weaponId, state)
  const materialFrame =
    `${palette.paletteId}:${material.primary}/${material.secondary}/${material.impact}`
  const choreographyFrame =
    `projectile:${projectile.row}/${projectile.column}/${projectile.frameIndex}`

  return Object.freeze({
    weaponId,
    state,
    lod,
    paletteId: palette.paletteId,
    materialAssetPath: palette[lod],
    projectileAssetPath: PREMIUM_SPELL_PROJECTILE_ASSETS[lod],
    material,
    projectile,
    atlasId: `premium-spell-vfx-v3:${lod}`,
    choreographyFrame,
    materialFrame,
    awakeningFrame: state === 'awakened'
      ? `${choreographyFrame}|${materialFrame}|awakened`
      : null,
  })
}
