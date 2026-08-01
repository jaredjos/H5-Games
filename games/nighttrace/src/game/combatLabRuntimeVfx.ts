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
  | 'event-horizon-seeds'
  | 'plasma-embers'
  | 'prismatic-fletching'

export interface CombatLabRuntimeVfxPresentation {
  readonly enabled: boolean
  readonly rank: number
  readonly awakened: boolean
  readonly motif: CombatLabRuntimeMotif | null
  readonly ornamentCount: number
  readonly laneCount: number
  readonly energyScale: number
  readonly profile: WeaponVfxProfile
}

interface RankPalette {
  readonly core: number
  readonly glow: number
  readonly accent: number
  readonly secondary: number
}

const TARGET_IDS = new Set<WeaponId>(COMBAT_LAB_RUNTIME_VFX_IDS)

const MOTIFS = Object.freeze({
  'helio-lance': 'solar-filaments',
  'crescent-array': 'lunar-petals',
  'arc-choir': 'cathedral-branches',
  'rift-seeds': 'event-horizon-seeds',
  'comet-swarm': 'plasma-embers',
  'mirror-bow': 'prismatic-fletching',
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
    { core: 0xefe8ff, glow: 0x8a66d7, accent: 0x5c3cae, secondary: 0x4bbacb },
    { core: 0xf5edff, glow: 0x9c75e8, accent: 0x6d4ac5, secondary: 0x59cbdb },
    { core: 0xfaf4ff, glow: 0xaf86fa, accent: 0x805bd9, secondary: 0x69ddeb },
    { core: 0xffffff, glow: 0xc7a1ff, accent: 0x9470ed, secondary: 0x82eff7 },
    { core: 0xffffff, glow: 0xe0c6ff, accent: 0xb295ff, secondary: 0xb5ffff },
  ]),
  'rift-seeds': Object.freeze([
    { core: 0xccf5e7, glow: 0x3eaa87, accent: 0x126950, secondary: 0x5c4596 },
    { core: 0xddfff1, glow: 0x4fc49a, accent: 0x168066, secondary: 0x7055b1 },
    { core: 0xeafff7, glow: 0x63dbaa, accent: 0x199878, secondary: 0x8568cd },
    { core: 0xf4fffb, glow: 0x7cebc0, accent: 0x21ae8b, secondary: 0xa083e6 },
    { core: 0xffffff, glow: 0xa2ffdc, accent: 0x39c9a4, secondary: 0xc0a5ff },
  ]),
  'comet-swarm': Object.freeze([
    { core: 0xffe8cf, glow: 0xd7624f, accent: 0xa83640, secondary: 0xd7a33c },
    { core: 0xffedda, glow: 0xe66e55, accent: 0xc04448, secondary: 0xe3ad43 },
    { core: 0xfff3e5, glow: 0xf47d61, accent: 0xdc5051, secondary: 0xefbd50 },
    { core: 0xfff9ef, glow: 0xff9673, accent: 0xf05e59, secondary: 0xffcf67 },
    { core: 0xffffff, glow: 0xffb18d, accent: 0xff7567, secondary: 0xffe79a },
  ]),
  'mirror-bow': Object.freeze([
    { core: 0xe5f1f6, glow: 0x7297aa, accent: 0x497384, secondary: 0x735c9d },
    { core: 0xf0f8fb, glow: 0x82aec1, accent: 0x558b9e, secondary: 0x866db4 },
    { core: 0xf9fdff, glow: 0x95c6d9, accent: 0x61a4b7, secondary: 0x9b7dca },
    { core: 0xffffff, glow: 0xadddec, accent: 0x72bfd0, secondary: 0xb092df },
    { core: 0xffffff, glow: 0xd2f4ff, accent: 0x91dce9, secondary: 0xd0b8ff },
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
 * Gives the launched Combat Lab its own authored presentation layer. Campaign,
 * Boss Trials and the three approved spells deliberately receive the exact
 * original profile object so their presentation cannot drift through this lab.
 */
export function resolveCombatLabRuntimeVfx(
  mode: RunMode,
  weaponId: WeaponId,
  state: WeaponVfxState,
  baseProfile: WeaponVfxProfile,
): CombatLabRuntimeVfxPresentation {
  if (mode !== 'combat-lab' || !isCombatLabRuntimeVfxId(weaponId)) {
    return Object.freeze({
      enabled: false,
      rank: clampRank(state.rank),
      awakened: Boolean(state.awakened),
      motif: null,
      ornamentCount: 0,
      laneCount: 0,
      energyScale: 1,
      profile: baseProfile,
    })
  }

  const rank = clampRank(state.rank)
  const awakened = Boolean(state.awakened)
  const palette = RANK_PALETTES[weaponId][rank - 1]
  const awakeningLift = awakened ? 1 : 0
  const profile = Object.freeze({
    coreColor: awakened ? 0xffffff : palette.core,
    glowColor: awakened ? palette.secondary : palette.glow,
    accentColor: awakened ? palette.core : palette.accent,
    secondaryColor: awakened ? palette.glow : palette.secondary,
    trailLengthScale: baseProfile.trailLengthScale * (1 + rank * 0.055 + awakeningLift * 0.18),
    trailWidthScale: baseProfile.trailWidthScale * (1 + rank * 0.04 + awakeningLift * 0.14),
    projectileScale: baseProfile.projectileScale * (1 + rank * 0.025 + awakeningLift * 0.09),
    orbitCount: baseProfile.orbitCount + rank + awakeningLift * 2,
    particleCount: baseProfile.particleCount + rank * 2 + awakeningLift * 5,
    segmentCount: baseProfile.segmentCount + rank + awakeningLift * 3,
  })

  return Object.freeze({
    enabled: true,
    rank,
    awakened,
    motif: MOTIFS[weaponId],
    ornamentCount: Math.min(8, 1 + rank + awakeningLift * 2),
    laneCount: Math.min(5, 1 + Math.floor(rank / 2) + awakeningLift),
    energyScale: 0.82 + rank * 0.08 + awakeningLift * 0.22,
    profile,
  })
}
