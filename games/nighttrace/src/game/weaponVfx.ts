import type { WeaponId } from '../shared/types'

export type WeaponVfxStage = 'solo' | 'combined' | 'mastered' | 'final'

export interface WeaponVfxState {
  stage: WeaponVfxStage
  rank: number
  moduleRank: number
  awakened: boolean
  /**
   * Continuous presentation energy in the inclusive range 0.25–1.
   * This lets ranks II–IV become richer without inventing extra named stages.
   */
  intensity: number
  /**
   * Integer embellishment budget in the inclusive range 0–11.
   * Renderers should use the resolved profile counts instead of multiplying
   * this value directly.
   */
  detail: number
}

export interface WeaponVfxProfile {
  coreColor: number
  glowColor: number
  accentColor: number
  secondaryColor: number
  trailLengthScale: number
  trailWidthScale: number
  projectileScale: number
  orbitCount: number
  particleCount: number
  segmentCount: number
}

export type ReworkedAreaWeaponId = 'ash-halo' | 'null-bell'
export type WeaponVfxMotif = 'graveglass-spires' | 'eclipse-harrow'
export type WeaponVfxAwakeningSignature =
  | 'sepulchral-orchard'
  | 'black-benediction'

export interface WeaponVfxMotifProfile {
  motif: WeaponVfxMotif
  primaryCount: number
  fragmentCount: number
  awakeningSignature: WeaponVfxAwakeningSignature | null
  maxConcurrent: number
  concentricBandCount: 0
  usesClosedRing: false
}

export const ALL_WEAPON_VFX_IDS = Object.freeze([
  'helio-lance',
  'crescent-array',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
  'ash-halo',
  'mirror-bow',
  'null-bell',
] as const satisfies readonly WeaponId[])

export const WEAPON_VFX_PALETTE_NAMES = Object.freeze({
  'helio-lance': 'Solar Crown',
  'crescent-array': 'Eclipse Ice',
  'arc-choir': 'Cathedral Voltage',
  'rift-seeds': 'Astral Judgment',
  'comet-swarm': 'Perihelion Ember',
  'ash-halo': 'Sepulchral Orchard',
  'mirror-bow': 'Infinite Prism',
  'null-bell': 'Black Benediction',
} as const satisfies Readonly<Record<WeaponId, string>>)

interface WeaponVfxBaseProfile extends WeaponVfxProfile {
  readonly coreColor: number
  readonly glowColor: number
  readonly accentColor: number
  readonly secondaryColor: number
  readonly trailLengthScale: number
  readonly trailWidthScale: number
  readonly projectileScale: number
  readonly orbitCount: number
  readonly particleCount: number
  readonly segmentCount: number
}

const BASE_PROFILES = Object.freeze({
  'helio-lance': Object.freeze({
    coreColor: 0xfff9dd,
    glowColor: 0xffcf63,
    accentColor: 0xffa932,
    secondaryColor: 0x72f7df,
    trailLengthScale: 1,
    trailWidthScale: 1,
    projectileScale: 1,
    orbitCount: 0,
    particleCount: 4,
    segmentCount: 1,
  }),
  'crescent-array': Object.freeze({
    coreColor: 0xf2ffff,
    glowColor: 0x8cecff,
    accentColor: 0x59cfff,
    secondaryColor: 0xb18cff,
    trailLengthScale: 0.78,
    trailWidthScale: 1.04,
    projectileScale: 1,
    orbitCount: 1,
    particleCount: 4,
    segmentCount: 3,
  }),
  'arc-choir': Object.freeze({
    coreColor: 0xfaf4ff,
    glowColor: 0x5b2aa6,
    accentColor: 0x8f4ff0,
    secondaryColor: 0xcfadff,
    trailLengthScale: 1.02,
    trailWidthScale: 0.94,
    projectileScale: 1,
    orbitCount: 0,
    particleCount: 5,
    segmentCount: 3,
  }),
  'rift-seeds': Object.freeze({
    coreColor: 0xf7f2ff,
    glowColor: 0x381879,
    accentColor: 0x6d35dc,
    secondaryColor: 0x38c8ef,
    trailLengthScale: 0.72,
    trailWidthScale: 1.12,
    projectileScale: 1.02,
    orbitCount: 0,
    particleCount: 7,
    segmentCount: 7,
  }),
  'comet-swarm': Object.freeze({
    coreColor: 0xfff4de,
    glowColor: 0xff8f70,
    accentColor: 0xff5968,
    secondaryColor: 0xffd25d,
    trailLengthScale: 1.08,
    trailWidthScale: 1,
    projectileScale: 1,
    orbitCount: 0,
    particleCount: 5,
    segmentCount: 3,
  }),
  'ash-halo': Object.freeze({
    coreColor: 0xfff1e6,
    glowColor: 0xe35c68,
    accentColor: 0x9b1f38,
    secondaryColor: 0xffa975,
    trailLengthScale: 0.62,
    trailWidthScale: 1.16,
    projectileScale: 1.02,
    orbitCount: 0,
    particleCount: 7,
    segmentCount: 6,
  }),
  'mirror-bow': Object.freeze({
    coreColor: 0xf7feff,
    glowColor: 0x75dff2,
    accentColor: 0x3b9ed5,
    secondaryColor: 0xb178eb,
    trailLengthScale: 0.82,
    trailWidthScale: 1.18,
    projectileScale: 0.94,
    orbitCount: 0,
    particleCount: 5,
    segmentCount: 2,
  }),
  'null-bell': Object.freeze({
    coreColor: 0xfff0ff,
    glowColor: 0xc269ff,
    accentColor: 0x872354,
    secondaryColor: 0xff79b5,
    trailLengthScale: 0.78,
    trailWidthScale: 1.18,
    projectileScale: 1.04,
    orbitCount: 0,
    particleCount: 7,
    segmentCount: 5,
  }),
} satisfies Readonly<Record<WeaponId, WeaponVfxBaseProfile>>)

const STAGE_INDEX: Readonly<Record<WeaponVfxStage, number>> = Object.freeze({
  solo: 0,
  combined: 1,
  mastered: 2,
  final: 3,
})

const REWORKED_AREA_MOTIFS = Object.freeze({
  'ash-halo': Object.freeze({
    motif: 'graveglass-spires',
    primaryCounts: Object.freeze([2, 3, 4, 6]),
    fragmentCounts: Object.freeze([4, 6, 8, 12]),
    awakeningSignature: 'sepulchral-orchard',
  }),
  'null-bell': Object.freeze({
    motif: 'eclipse-harrow',
    primaryCounts: Object.freeze([1, 2, 3, 4]),
    fragmentCounts: Object.freeze([3, 5, 7, 10]),
    awakeningSignature: 'black-benediction',
  }),
} as const satisfies Readonly<Record<
  ReworkedAreaWeaponId,
  {
    motif: WeaponVfxMotif
    primaryCounts: readonly number[]
    fragmentCounts: readonly number[]
    awakeningSignature: WeaponVfxAwakeningSignature
  }
>>)

const roundTo = (value: number, places = 3) => {
  const magnitude = 10 ** places
  return Math.round(value * magnitude) / magnitude
}

const clampInteger = (value: number, minimum: number, maximum: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

const mixColor = (from: number, to: number, amount: number) => {
  const mixChannel = (shift: number) => {
    const start = (from >> shift) & 0xff
    const end = (to >> shift) & 0xff
    return Math.round(start + (end - start) * amount)
  }
  return (mixChannel(16) << 16) | (mixChannel(8) << 8) | mixChannel(0)
}

export function resolveWeaponVfxState(
  rank: number,
  moduleRank: number,
  awakened: boolean,
): WeaponVfxState {
  const resolvedRank = clampInteger(rank, 1, 5, 1)
  const resolvedModuleRank = clampInteger(moduleRank, 0, 3, 0)
  const resolvedAwakened = Boolean(awakened)
  const rankProgress = (resolvedRank - 1) / 4
  const moduleProgress = resolvedModuleRank / 3
  const intensity = roundTo(
    Math.min(
      1,
      0.25 + rankProgress * 0.4 + moduleProgress * 0.15 + (resolvedAwakened ? 0.2 : 0),
    ),
  )
  const detail =
    (resolvedRank - 1) +
    resolvedModuleRank +
    (resolvedAwakened ? 4 : 0)
  const stage: WeaponVfxStage = resolvedAwakened
    ? 'final'
    : resolvedRank >= 5
      ? 'mastered'
      : resolvedModuleRank > 0
        ? 'combined'
        : 'solo'

  return Object.freeze({
    stage,
    rank: resolvedRank,
    moduleRank: resolvedModuleRank,
    awakened: resolvedAwakened,
    intensity,
    detail,
  })
}

export function weaponVfxProfile(
  weaponId: WeaponId,
  state: WeaponVfxState,
): WeaponVfxProfile {
  const base = BASE_PROFILES[weaponId]
  const stageIndex = STAGE_INDEX[state.stage]
  const visualProgress = Math.min(1, Math.max(0, (state.intensity - 0.25) / 0.75))
  const finalColorLift = state.stage === 'final' ? 0.24 : visualProgress * 0.06

  return Object.freeze({
    coreColor: mixColor(base.coreColor, 0xffffff, visualProgress * 0.12),
    glowColor: mixColor(base.glowColor, base.secondaryColor, finalColorLift),
    accentColor: base.accentColor,
    secondaryColor: base.secondaryColor,
    trailLengthScale: roundTo(
      base.trailLengthScale * (1 + visualProgress * 0.45),
    ),
    trailWidthScale: roundTo(
      base.trailWidthScale * (1 + visualProgress * 0.35),
    ),
    projectileScale: roundTo(
      base.projectileScale * (1 + visualProgress * 0.18),
    ),
    orbitCount: base.orbitCount + stageIndex + Math.floor(state.detail / 4),
    particleCount: base.particleCount + state.detail + stageIndex,
    segmentCount:
      base.segmentCount +
      Math.ceil(state.detail / 2) +
      stageIndex,
  })
}

export function weaponVfxMotifProfile(
  weaponId: ReworkedAreaWeaponId,
  state: WeaponVfxState,
): WeaponVfxMotifProfile {
  const definition = REWORKED_AREA_MOTIFS[weaponId]
  const stageIndex = STAGE_INDEX[state.stage]

  return Object.freeze({
    motif: definition.motif,
    primaryCount: definition.primaryCounts[stageIndex],
    fragmentCount: definition.fragmentCounts[stageIndex],
    awakeningSignature:
      state.stage === 'final' ? definition.awakeningSignature : null,
    maxConcurrent: 2,
    concentricBandCount: 0,
    usesClosedRing: false,
  })
}
