import type { BossId, EnemyId } from '../shared/types'

export const HOSTILE_WARNING_COLOR = 0xff405b
export const HOSTILE_SHADOW_COLOR = 0x21030b
export const HOSTILE_IMPACT_COLOR = 0xfff1e8
export const HOSTILE_CRIMSON_COLOR = 0xd9485c
export const HOSTILE_VIOLET_COLOR = 0x9550a8
export const HOSTILE_VENOM_COLOR = 0x87973b
export const BOSS_RELEASE_TAIL_SECONDS = 0.24

export type BossPresentationMotif =
  | 'antler-rays'
  | 'drowned-choir'
  | 'rail-cross'
  | 'shard-mirror'
  | 'undertow-rings'
  | 'storm-comb'
  | 'clock-teeth'
  | 'furnace-cracks'
  | 'void-grid'
  | 'eclipse-corona'

export type HostileMotionPhase = 'gather' | 'release' | 'impact' | 'decay'
export type HostileColorFamily = 'crimson' | 'violet' | 'venom'
export type HostileReactionKind = 'hit' | 'death'
export type HostileReactionPhase =
  | 'impact'
  | 'recover'
  | 'rupture'
  | 'collapse'
  | 'dissolve'

interface HostilePalette {
  readonly reportName: string
  readonly paletteName: string
  readonly colorFamily: HostileColorFamily
  readonly primaryColor: number
  readonly secondaryColor: number
  readonly shadowColor: number
  readonly impactColor: number
  readonly reducedFlashScale: number
}

export interface EnemyPresentationProfile extends HostilePalette {
  readonly id: EnemyId
  readonly hordeProminence: number
}

export interface BossPresentationProfile extends HostilePalette {
  readonly id: BossId
  readonly motif: BossPresentationMotif
  readonly bossProminence: number
}

export interface HostileEnvelopeInput {
  readonly progress: number
  readonly impactProgress: number
  readonly reducedFlash?: boolean
  readonly reducedFlashScale?: number
}

export interface HostileMotionEnvelope {
  readonly phase: HostileMotionPhase
  readonly progress: number
  readonly phaseProgress: number
  readonly impactProgress: number
  readonly gather: number
  readonly release: number
  readonly impact: number
  readonly decay: number
  readonly flashScale: number
}

export interface HostileReactionInput {
  readonly kind: HostileReactionKind
  readonly progress: number
  readonly boss?: boolean
  readonly reducedFlash?: boolean
  readonly reducedFlashScale?: number
}

export interface HostileReactionEnvelope {
  readonly kind: HostileReactionKind
  readonly phase: HostileReactionPhase
  readonly progress: number
  readonly recoil: number
  readonly squash: number
  readonly rupture: number
  readonly collapse: number
  readonly dissolve: number
  readonly alpha: number
  readonly flashScale: number
}

export const ALL_ENEMY_PRESENTATION_IDS = Object.freeze([
  'maskling',
  'shardwing',
  'cantor',
  'railjaw',
  'chronowisp',
  'cinder-guard',
] as const satisfies readonly EnemyId[])

export const ALL_BOSS_PRESENTATION_IDS = Object.freeze([
  'gloam-stag',
  'mire-cantor',
  'railjaw-prime',
  'mirror-matron',
  'tide-apostle',
  'storm-engine',
  'chronophage',
  'furnace-titan',
  'cartographer',
  'sun-eater',
] as const satisfies readonly BossId[])

export const ENEMY_PRESENTATIONS = Object.freeze({
  maskling: Object.freeze({
    id: 'maskling',
    reportName: 'Maskling',
    paletteName: 'Blood Mask',
    colorFamily: 'crimson',
    primaryColor: 0xd9485c,
    secondaryColor: 0x7a2636,
    shadowColor: HOSTILE_SHADOW_COLOR,
    impactColor: HOSTILE_IMPACT_COLOR,
    hordeProminence: 0.46,
    reducedFlashScale: 0.42,
  }),
  shardwing: Object.freeze({
    id: 'shardwing',
    reportName: 'Shardwing',
    paletteName: 'Wineglass Talon',
    colorFamily: 'violet',
    primaryColor: 0xb8486e,
    secondaryColor: 0x64263f,
    shadowColor: HOSTILE_SHADOW_COLOR,
    impactColor: HOSTILE_IMPACT_COLOR,
    hordeProminence: 0.52,
    reducedFlashScale: 0.42,
  }),
  cantor: Object.freeze({
    id: 'cantor',
    reportName: 'Cantor',
    paletteName: 'Bruised Choir',
    colorFamily: 'violet',
    primaryColor: 0x8d55a5,
    secondaryColor: 0x4b2c5d,
    shadowColor: HOSTILE_SHADOW_COLOR,
    impactColor: HOSTILE_IMPACT_COLOR,
    hordeProminence: 0.63,
    reducedFlashScale: 0.45,
  }),
  railjaw: Object.freeze({
    id: 'railjaw',
    reportName: 'Railjaw',
    paletteName: 'Oxide Rail',
    colorFamily: 'crimson',
    primaryColor: 0xc5533f,
    secondaryColor: 0x6f2d26,
    shadowColor: HOSTILE_SHADOW_COLOR,
    impactColor: HOSTILE_IMPACT_COLOR,
    hordeProminence: 0.7,
    reducedFlashScale: 0.44,
  }),
  chronowisp: Object.freeze({
    id: 'chronowisp',
    reportName: 'Chronowisp',
    paletteName: 'Dead Hour',
    colorFamily: 'violet',
    primaryColor: 0x9961a8,
    secondaryColor: 0x50345e,
    shadowColor: HOSTILE_SHADOW_COLOR,
    impactColor: HOSTILE_IMPACT_COLOR,
    hordeProminence: 0.58,
    reducedFlashScale: 0.4,
  }),
  'cinder-guard': Object.freeze({
    id: 'cinder-guard',
    reportName: 'Cinder Guard',
    paletteName: 'Furnace Oath',
    colorFamily: 'crimson',
    primaryColor: 0xc64335,
    secondaryColor: 0x6c241f,
    shadowColor: HOSTILE_SHADOW_COLOR,
    impactColor: HOSTILE_IMPACT_COLOR,
    hordeProminence: 0.78,
    reducedFlashScale: 0.46,
  }),
} as const satisfies Readonly<Record<EnemyId, EnemyPresentationProfile>>)

export const BOSS_PRESENTATIONS = Object.freeze({
  'gloam-stag': Object.freeze({
    id: 'gloam-stag',
    reportName: 'Gloam Stag',
    paletteName: 'Garnet Antler',
    colorFamily: 'crimson',
    motif: 'antler-rays',
    primaryColor: 0xd14b63,
    secondaryColor: 0x772a3c,
    shadowColor: 0x1a0309,
    impactColor: 0xffded8,
    bossProminence: 1.18,
    reducedFlashScale: 0.46,
  }),
  'mire-cantor': Object.freeze({
    id: 'mire-cantor',
    reportName: 'Mire Cantor',
    paletteName: 'Bile Choir',
    colorFamily: 'venom',
    motif: 'drowned-choir',
    primaryColor: 0x7f8d35,
    secondaryColor: 0x41491d,
    shadowColor: 0x101306,
    impactColor: 0xffded8,
    bossProminence: 1.24,
    reducedFlashScale: 0.45,
  }),
  'railjaw-prime': Object.freeze({
    id: 'railjaw-prime',
    reportName: 'Railjaw Prime',
    paletteName: 'Iron Wound',
    colorFamily: 'crimson',
    motif: 'rail-cross',
    primaryColor: 0xc64d42,
    secondaryColor: 0x6e2a25,
    shadowColor: 0x1c0505,
    impactColor: 0xffded8,
    bossProminence: 1.3,
    reducedFlashScale: 0.47,
  }),
  'mirror-matron': Object.freeze({
    id: 'mirror-matron',
    reportName: 'Mirror Matron',
    paletteName: 'Orchid Bruise',
    colorFamily: 'violet',
    motif: 'shard-mirror',
    primaryColor: 0x95509f,
    secondaryColor: 0x50305a,
    shadowColor: 0x150718,
    impactColor: 0xffe1eb,
    bossProminence: 1.36,
    reducedFlashScale: 0.43,
  }),
  'tide-apostle': Object.freeze({
    id: 'tide-apostle',
    reportName: 'Tide Apostle',
    paletteName: 'Funeral Undertow',
    colorFamily: 'violet',
    motif: 'undertow-rings',
    primaryColor: 0x76405f,
    secondaryColor: 0x42243a,
    shadowColor: 0x140711,
    impactColor: 0xffded8,
    bossProminence: 1.4,
    reducedFlashScale: 0.44,
  }),
  'storm-engine': Object.freeze({
    id: 'storm-engine',
    reportName: 'Storm Engine',
    paletteName: 'Thunder Pall',
    colorFamily: 'violet',
    motif: 'storm-comb',
    primaryColor: 0x655a9e,
    secondaryColor: 0x38345e,
    shadowColor: 0x0d0919,
    impactColor: 0xffded8,
    bossProminence: 1.46,
    reducedFlashScale: 0.42,
  }),
  chronophage: Object.freeze({
    id: 'chronophage',
    reportName: 'Chronophage',
    paletteName: 'Mauve Hour',
    colorFamily: 'violet',
    motif: 'clock-teeth',
    primaryColor: 0x85639d,
    secondaryColor: 0x473653,
    shadowColor: 0x110a17,
    impactColor: 0xffe1eb,
    bossProminence: 1.5,
    reducedFlashScale: 0.4,
  }),
  'furnace-titan': Object.freeze({
    id: 'furnace-titan',
    reportName: 'Furnace Titan',
    paletteName: 'Buried Oxide',
    colorFamily: 'crimson',
    motif: 'furnace-cracks',
    primaryColor: 0xb95535,
    secondaryColor: 0x67311f,
    shadowColor: 0x1c0804,
    impactColor: 0xffddce,
    bossProminence: 1.55,
    reducedFlashScale: 0.47,
  }),
  cartographer: Object.freeze({
    id: 'cartographer',
    reportName: 'The Cartographer',
    paletteName: 'Void Meridian',
    colorFamily: 'violet',
    motif: 'void-grid',
    primaryColor: 0x515280,
    secondaryColor: 0x2d2e4c,
    shadowColor: 0x090a14,
    impactColor: 0xffe1eb,
    bossProminence: 1.6,
    reducedFlashScale: 0.4,
  }),
  'sun-eater': Object.freeze({
    id: 'sun-eater',
    reportName: 'The Sun-Eater',
    paletteName: 'Eclipse Wound',
    colorFamily: 'crimson',
    motif: 'eclipse-corona',
    primaryColor: 0xbd3c36,
    secondaryColor: 0x681d1c,
    shadowColor: 0x140202,
    impactColor: 0xffd8cf,
    bossProminence: 1.68,
    reducedFlashScale: 0.48,
  }),
} as const satisfies Readonly<Record<BossId, BossPresentationProfile>>)

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const clamp01 = (value: number) => clamp(value, 0, 1)

const safeUnitValue = (value: number, fallback: number) =>
  Number.isFinite(value) ? clamp01(value) : fallback

const smoothStep = (value: number) => {
  const progress = clamp01(value)
  return progress * progress * (3 - 2 * progress)
}

const easeOutCubic = (value: number) => 1 - (1 - clamp01(value)) ** 3

export function enemyPresentation(enemyId: EnemyId): EnemyPresentationProfile {
  return ENEMY_PRESENTATIONS[enemyId]
}

export function bossPresentation(bossId: BossId): BossPresentationProfile {
  return BOSS_PRESENTATIONS[bossId]
}

export function bossImpactProgress(
  warningDuration: number,
  releaseTailSeconds = BOSS_RELEASE_TAIL_SECONDS,
) {
  const safeWarning = Number.isFinite(warningDuration)
    ? Math.max(0.05, warningDuration)
    : 0.76
  const safeTail = Number.isFinite(releaseTailSeconds)
    ? Math.max(0.01, releaseTailSeconds)
    : BOSS_RELEASE_TAIL_SECONDS
  return safeWarning / (safeWarning + safeTail)
}

export function sampleHostileEnvelope({
  progress,
  impactProgress,
  reducedFlash = false,
  reducedFlashScale = 0.44,
}: HostileEnvelopeInput): HostileMotionEnvelope {
  const safeProgress = safeUnitValue(progress, 0)
  const safeImpactProgress = clamp(
    Number.isFinite(impactProgress) ? impactProgress : 0.75,
    0.36,
    0.9,
  )
  const gatherEnd = Math.max(0.12, safeImpactProgress - 0.18)
  const impactEnd = Math.min(0.97, safeImpactProgress + 0.07)
  const safeReducedFlashScale = clamp(
    Number.isFinite(reducedFlashScale) ? reducedFlashScale : 0.44,
    0,
    1,
  )

  let phase: HostileMotionPhase
  let phaseProgress: number
  let gather = 0
  let release = 0
  let impact = 0
  let decay = 0

  if (safeProgress < gatherEnd) {
    phase = 'gather'
    phaseProgress = safeProgress / gatherEnd
    gather = smoothStep(phaseProgress)
  } else if (safeProgress < safeImpactProgress) {
    phase = 'release'
    phaseProgress =
      (safeProgress - gatherEnd) /
      Math.max(0.001, safeImpactProgress - gatherEnd)
    gather = 1 - smoothStep(phaseProgress)
    release = easeOutCubic(phaseProgress)
  } else if (safeProgress < impactEnd) {
    phase = 'impact'
    phaseProgress =
      (safeProgress - safeImpactProgress) /
      Math.max(0.001, impactEnd - safeImpactProgress)
    release = 1 - smoothStep(phaseProgress)
    impact = 1 - smoothStep(phaseProgress) * 0.18
  } else {
    phase = 'decay'
    phaseProgress =
      (safeProgress - impactEnd) /
      Math.max(0.001, 1 - impactEnd)
    impact = (1 - smoothStep(phaseProgress)) * 0.82
    decay = 1 - smoothStep(phaseProgress)
  }

  const unscaledFlash = Math.max(release * 0.36, impact)
  const flashScale =
    unscaledFlash * (reducedFlash ? safeReducedFlashScale : 1)

  return Object.freeze({
    phase,
    progress: safeProgress,
    phaseProgress: clamp01(phaseProgress),
    impactProgress: safeImpactProgress,
    gather: clamp01(gather),
    release: clamp01(release),
    impact: clamp01(impact),
    decay: clamp01(decay),
    flashScale: clamp01(flashScale),
  })
}

/**
 * Deterministic hit/death timing shared by the sprite pose and hostile VFX layers.
 *
 * Hit reactions stay short so a large horde does not become visual noise. Deaths
 * give bosses a longer rupture and later dissolve, leaving room for a sovereign
 * defeat burst without making ordinary enemies equally prominent.
 */
export function sampleHostileReaction({
  kind,
  progress,
  boss = false,
  reducedFlash = false,
  reducedFlashScale = 0.44,
}: HostileReactionInput): HostileReactionEnvelope {
  const safeProgress = safeUnitValue(progress, 0)
  const safeReducedFlashScale = clamp(
    Number.isFinite(reducedFlashScale) ? reducedFlashScale : 0.44,
    0,
    1,
  )
  const flashMultiplier = reducedFlash ? safeReducedFlashScale : 1

  if (kind === 'hit') {
    const impactEnd = boss ? 0.24 : 0.18
    const impactProgress = clamp01(safeProgress / impactEnd)
    const recoverProgress = clamp01(
      (safeProgress - impactEnd) / Math.max(0.001, 1 - impactEnd),
    )
    const recoil = 1 - smoothStep(safeProgress)
    const squash = peakWindow(safeProgress, boss ? 0.64 : 0.52)
    const flash = (1 - smoothStep(impactProgress)) * flashMultiplier

    return Object.freeze({
      kind,
      phase: safeProgress < impactEnd ? 'impact' : 'recover',
      progress: safeProgress,
      recoil: clamp01(recoil),
      squash: clamp01(squash * (1 - recoverProgress * 0.32)),
      rupture: 0,
      collapse: 0,
      dissolve: 0,
      alpha: 1,
      flashScale: clamp01(flash),
    })
  }

  const ruptureEnd = boss ? 0.34 : 0.26
  const collapseStart = boss ? 0.1 : 0.07
  const collapseEnd = boss ? 0.82 : 0.7
  const dissolveStart = boss ? 0.62 : 0.46
  const rupture = peakWindow(safeProgress, ruptureEnd)
  const collapse = smoothStep(
    (safeProgress - collapseStart) /
      Math.max(0.001, collapseEnd - collapseStart),
  )
  const dissolve = smoothStep(
    (safeProgress - dissolveStart) /
      Math.max(0.001, 1 - dissolveStart),
  )
  const recoil = (1 - smoothStep(safeProgress / ruptureEnd)) * (1 - collapse)
  const squash = Math.max(rupture * 0.76, collapse * (boss ? 0.52 : 0.72))
  const flash = Math.max(
    rupture * (boss ? 0.94 : 0.68),
    (1 - smoothStep(safeProgress / 0.1)) * 0.54,
  )
  const phase: HostileReactionPhase =
    safeProgress < ruptureEnd
      ? 'rupture'
      : safeProgress < dissolveStart
        ? 'collapse'
        : 'dissolve'

  return Object.freeze({
    kind,
    phase,
    progress: safeProgress,
    recoil: clamp01(recoil),
    squash: clamp01(squash),
    rupture: clamp01(rupture),
    collapse: clamp01(collapse),
    dissolve: clamp01(dissolve),
    alpha: clamp01(1 - dissolve),
    flashScale: clamp01(flash * flashMultiplier),
  })
}

const peakWindow = (progress: number, duration: number) =>
  Math.sin(clamp01(progress / Math.max(0.001, duration)) * Math.PI)
