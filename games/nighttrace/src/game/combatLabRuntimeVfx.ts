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

// These authored Lab treatments have graduated into the shipped modes. The
// internal weapon ids stay stable so existing saves remain compatible.
const LIVE_AUTHORED_IDS = new Set<WeaponId>([
  'arc-choir',
  'rift-seeds',
  'mirror-bow',
])

const MOTIFS = Object.freeze({
  'helio-lance': 'solar-filaments',
  'crescent-array': 'lunar-petals',
  'arc-choir': 'cathedral-branches',
  'rift-seeds': 'astral-verdict',
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
    { core: 0xf7f2ff, glow: 0x5b2aa6, accent: 0x7c3aed, secondary: 0xb794f4 },
    { core: 0xf8f5ff, glow: 0x642eb8, accent: 0x8b4cf0, secondary: 0xc09aff },
    { core: 0xfcf8ff, glow: 0x6d33ca, accent: 0x9957f5, secondary: 0xccaaff },
    { core: 0xfffaff, glow: 0x753ad8, accent: 0xa766f8, secondary: 0xd8bfff },
    { core: 0xfffcff, glow: 0x8045e5, accent: 0xb77cff, secondary: 0xe4d0ff },
  ]),
  'rift-seeds': Object.freeze([
    { core: 0xf4efff, glow: 0x311568, accent: 0x6330cf, secondary: 0x2fbde8 },
    { core: 0xf8f2ff, glow: 0x381879, accent: 0x6d35dc, secondary: 0x38c8ef },
    { core: 0xfcf7ff, glow: 0x401b88, accent: 0x773de8, secondary: 0x45d5f5 },
    { core: 0xfffbff, glow: 0x481e96, accent: 0x8248f2, secondary: 0x55e0fa },
    { core: 0xffffff, glow: 0x5122a5, accent: 0x8e56ff, secondary: 0x6ceaff },
  ]),
  'comet-swarm': Object.freeze([
    { core: 0xffe8cf, glow: 0xd7624f, accent: 0xa83640, secondary: 0xd7a33c },
    { core: 0xffedda, glow: 0xe66e55, accent: 0xc04448, secondary: 0xe3ad43 },
    { core: 0xfff3e5, glow: 0xf47d61, accent: 0xdc5051, secondary: 0xefbd50 },
    { core: 0xfff9ef, glow: 0xff9673, accent: 0xf05e59, secondary: 0xffcf67 },
    { core: 0xffffff, glow: 0xffb18d, accent: 0xff7567, secondary: 0xffe79a },
  ]),
  'mirror-bow': Object.freeze([
    { core: 0xe9fbff, glow: 0x58b8d8, accent: 0x276eaa, secondary: 0x8b52cd },
    { core: 0xf0fdff, glow: 0x67cae7, accent: 0x3186c1, secondary: 0x9c63dc },
    { core: 0xf7feff, glow: 0x79dcef, accent: 0x3c9dd4, secondary: 0xaf75ea },
    { core: 0xffffff, glow: 0x91ecf7, accent: 0x54b7e5, secondary: 0xc18df5 },
    { core: 0xffffff, glow: 0xb8f7ff, accent: 0x76d0f1, secondary: 0xdcb8ff },
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
 * Gives the launched Combat Lab its authored presentation layer. Arc Choir,
 * Astral Verdict and Mirror Bow have also graduated into Campaign and Boss
 * Trials; the remaining Lab experiments still cannot leak into shipped modes.
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
  const preservesAwakenedPalette = weaponId === 'arc-choir'
  const profile = Object.freeze({
    coreColor: awakened ? 0xffffff : palette.core,
    glowColor:
      awakened && !preservesAwakenedPalette ? palette.secondary : palette.glow,
    accentColor:
      awakened && !preservesAwakenedPalette ? palette.core : palette.accent,
    secondaryColor:
      awakened && !preservesAwakenedPalette ? palette.glow : palette.secondary,
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
