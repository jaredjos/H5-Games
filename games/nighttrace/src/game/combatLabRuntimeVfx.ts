import type { RunMode, WeaponId } from '../shared/types'
import type { WeaponVfxProfile, WeaponVfxState } from './weaponVfx'

export const COMBAT_LAB_RUNTIME_VFX_IDS = Object.freeze([
  'helio-lance',
  'crescent-array',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
  'mirror-bow',
] as const satisfies readonly WeaponId[])

export type CombatLabRuntimeVfxId =
  (typeof COMBAT_LAB_RUNTIME_VFX_IDS)[number]

export type CombatLabRuntimeMotif =
  | 'solar-filaments'
  | 'lunar-petals'
  | 'cathedral-branches'
  | 'astral-verdict'
  | 'plasma-embers'
  | 'cinderwake-reavers'

export interface CombatLabRuntimeVfxPresentation {
  readonly enabled: boolean
  readonly rank: number
  readonly awakened: boolean
  readonly motif: CombatLabRuntimeMotif | null
  readonly ornamentCount: number
  readonly laneCount: number
  readonly energyScale: number
  /** Hero-relative scale applied only to ornamental runtime geometry. */
  readonly geometryScale: number
  readonly profile: WeaponVfxProfile
}

interface RankPalette {
  readonly core: number
  readonly glow: number
  readonly accent: number
  readonly secondary: number
}

const TARGET_IDS = new Set<WeaponId>(COMBAT_LAB_RUNTIME_VFX_IDS)

// These authored Lab treatments have graduated into the shipped modes. The
// internal weapon ids stay stable so existing saves remain compatible.
const LIVE_AUTHORED_IDS = new Set<WeaponId>([
  'crescent-array',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
  'mirror-bow',
])

const MOTIFS = Object.freeze({
  'helio-lance': 'solar-filaments',
  'crescent-array': 'lunar-petals',
  'arc-choir': 'cathedral-branches',
  'rift-seeds': 'astral-verdict',
  'comet-swarm': 'plasma-embers',
  'mirror-bow': 'cinderwake-reavers',
} as const satisfies Readonly<Record<CombatLabRuntimeVfxId, CombatLabRuntimeMotif>>)

const RANK_PALETTES = Object.freeze({
  'helio-lance': Object.freeze([
    { core: 0xfff4bd, glow: 0xe4a943, accent: 0xc67c20, secondary: 0x78d9d1 },
    { core: 0xffffdc, glow: 0xf0c95a, accent: 0xdf9231, secondary: 0x83e9df },
    { core: 0xffffee, glow: 0xffd978, accent: 0xf2a844, secondary: 0xa4f8ed },
    { core: 0xffffff, glow: 0xffe6a0, accent: 0xffba54, secondary: 0xc6fff5 },
    { core: 0xffffff, glow: 0xffefc2, accent: 0xffcf70, secondary: 0xe1ffff },
  ]),
  'crescent-array': Object.freeze([
    { core: 0xe8fbff, glow: 0x6bc9e8, accent: 0x3696c7, secondary: 0x7b69be },
    { core: 0xf1ffff, glow: 0x79ddf5, accent: 0x47acd9, secondary: 0x8b76d4 },
    { core: 0xf8ffff, glow: 0x8cecff, accent: 0x58c7e9, secondary: 0x9a84ea },
    { core: 0xffffff, glow: 0xb0f5ff, accent: 0x72dbf2, secondary: 0xb099ff },
    { core: 0xffffff, glow: 0xd3fbff, accent: 0x94edff, secondary: 0xd2bdff },
  ]),
  'arc-choir': Object.freeze([
    { core: 0xf7f2ff, glow: 0x5b2aa6, accent: 0x7c3aed, secondary: 0xb794f4 },
    { core: 0xf8f5ff, glow: 0x642eb8, accent: 0x8b4cf0, secondary: 0xc09aff },
    { core: 0xfcf8ff, glow: 0x6d33ca, accent: 0x9957f5, secondary: 0xccaaff },
    { core: 0xfffaff, glow: 0x753ad8, accent: 0xa766f8, secondary: 0xd8bfff },
    { core: 0xfffcff, glow: 0x8045e5, accent: 0xb77cff, secondary: 0xe4d0ff },
  ]),
  'rift-seeds': Object.freeze([
    { core: 0xdff8ff, glow: 0x102c75, accent: 0x2878de, secondary: 0x53c8f2 },
    { core: 0xe7faff, glow: 0x123584, accent: 0x3189e8, secondary: 0x61d4f7 },
    { core: 0xeffcff, glow: 0x153f96, accent: 0x3c9bf2, secondary: 0x73defa },
    { core: 0xf5fdff, glow: 0x1949a8, accent: 0x49acf8, secondary: 0x8be8ff },
    { core: 0xf9feff, glow: 0x1e56bb, accent: 0x5bbdff, secondary: 0xa5f0ff },
  ]),
  'comet-swarm': Object.freeze([
    { core: 0xffbd62, glow: 0xb83d16, accent: 0xd65018, secondary: 0xf0781f },
    { core: 0xffc36b, glow: 0xc74618, accent: 0xe15c1b, secondary: 0xf58223 },
    { core: 0xffc975, glow: 0xd14e19, accent: 0xeb671d, secondary: 0xfa8c28 },
    { core: 0xffcf80, glow: 0xdd581d, accent: 0xf17322, secondary: 0xff982f },
    { core: 0xffd68e, glow: 0xe76420, accent: 0xfa8128, secondary: 0xffa63a },
  ]),
  'mirror-bow': Object.freeze([
    { core: 0xffb07a, glow: 0x160407, accent: 0x8e1f2a, secondary: 0x5c225f },
    { core: 0xffb985, glow: 0x1c0509, accent: 0xa12631, secondary: 0x6b286d },
    { core: 0xffc38f, glow: 0x22060b, accent: 0xb72e39, secondary: 0x7b2e7c },
    { core: 0xffce9d, glow: 0x29070d, accent: 0xca3742, secondary: 0x8d358d },
    { core: 0xffd9ad, glow: 0x310810, accent: 0xde424c, secondary: 0x9f3da0 },
  ]),
} as const satisfies Readonly<Record<CombatLabRuntimeVfxId, readonly RankPalette[]>>)

const clampRank = (rank: number) =>
  Math.min(5, Math.max(1, Number.isFinite(rank) ? Math.round(rank) : 1))

export function isCombatLabRuntimeVfxId(
  weaponId: WeaponId,
): weaponId is CombatLabRuntimeVfxId {
  return TARGET_IDS.has(weaponId)
}

/**
 * Gives the launched Combat Lab its authored presentation layer. Crescent Array,
 * Arc Choir, Astral Verdict and Cinderwake Reavers have also graduated into
 * Campaign and Boss Trials; the remaining Lab experiments still cannot leak
 * into shipped modes.
 */
export function resolveCombatLabRuntimeVfx(
  mode: RunMode,
  weaponId: WeaponId,
  state: WeaponVfxState,
  baseProfile: WeaponVfxProfile,
): CombatLabRuntimeVfxPresentation {
  const authoredInMode =
    mode === 'combat-lab' || LIVE_AUTHORED_IDS.has(weaponId)
  if (!authoredInMode || !isCombatLabRuntimeVfxId(weaponId)) {
    return Object.freeze({
      enabled: false,
      rank: clampRank(state.rank),
      awakened: Boolean(state.awakened),
      motif: null,
      ornamentCount: 0,
      laneCount: 0,
      energyScale: 1,
      geometryScale: 1,
      profile: baseProfile,
    })
  }

  const rank = clampRank(state.rank)
  const awakened = Boolean(state.awakened)
  const palette = RANK_PALETTES[weaponId][rank - 1]
  const awakeningLift = awakened ? 1 : 0
  // Arc Choir's saturated violet body is its authored identity. The generic
  // awakening remap intentionally inverts other spell palettes, but that made
  // Cathedral Storm read as a white/cyan (and occasionally warm) beam in the
  // arena. Keep its violet hierarchy intact and lift only the white-hot core.
  const preservesAwakenedPalette =
    weaponId === 'arc-choir' ||
    weaponId === 'rift-seeds' ||
    weaponId === 'comet-swarm' ||
    weaponId === 'mirror-bow'
  const preservesAwakenedCore =
    weaponId === 'rift-seeds' ||
    weaponId === 'comet-swarm' ||
    weaponId === 'mirror-bow'
  const keepsV116ProjectileScale =
    weaponId === 'helio-lance' || weaponId === 'comet-swarm'
  const profile = Object.freeze({
    coreColor: awakened && !preservesAwakenedCore ? 0xffffff : palette.core,
    glowColor:
      awakened && !preservesAwakenedPalette ? palette.secondary : palette.glow,
    accentColor:
      awakened && !preservesAwakenedPalette ? palette.core : palette.accent,
    secondaryColor:
      awakened && !preservesAwakenedPalette ? palette.glow : palette.secondary,
    trailLengthScale: keepsV116ProjectileScale
      ? baseProfile.trailLengthScale
      : baseProfile.trailLengthScale * (1 + rank * 0.055 + awakeningLift * 0.18),
    trailWidthScale: keepsV116ProjectileScale
      ? baseProfile.trailWidthScale
      : baseProfile.trailWidthScale * (1 + rank * 0.04 + awakeningLift * 0.14),
    projectileScale: keepsV116ProjectileScale
      ? baseProfile.projectileScale
      : baseProfile.projectileScale * (1 + rank * 0.025 + awakeningLift * 0.09),
    orbitCount: baseProfile.orbitCount + rank + awakeningLift * 2,
    particleCount: baseProfile.particleCount + rank * 2 + awakeningLift * 5,
    segmentCount: baseProfile.segmentCount + rank + awakeningLift * 3,
  })

  const ornamentCount = weaponId === 'arc-choir'
    ? Math.min(5, 2 + Math.ceil(rank / 2) + awakeningLift)
    : weaponId === 'mirror-bow'
      ? Math.min(4, 1 + Math.ceil(rank / 2) + awakeningLift)
      : Math.min(8, 1 + rank + awakeningLift * 2)
  const laneCount = weaponId === 'arc-choir'
    ? awakened
      ? 2
      : Math.min(3, 1 + Math.floor(rank / 2))
    : weaponId === 'rift-seeds'
      ? Math.min(4, 1 + Math.floor(rank / 2) + awakeningLift)
      : Math.min(5, 1 + Math.floor(rank / 2) + awakeningLift)
  const geometryScale = {
    'helio-lance': 0.72,
    'crescent-array': 0.9,
    'arc-choir': awakened ? 0.78 : 0.86,
    'rift-seeds': 0.9,
    'comet-swarm': 0.7,
    'mirror-bow': 0.72,
  }[weaponId]

  return Object.freeze({
    enabled: true,
    rank,
    awakened,
    motif: MOTIFS[weaponId],
    ornamentCount,
    laneCount,
    energyScale: 0.82 + rank * 0.08 + awakeningLift * 0.22,
    geometryScale,
    profile,
  })
}
