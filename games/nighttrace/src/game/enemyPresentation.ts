import type { BossId, EnemyId } from '../shared/types'

export const HOSTILE_WARNING_COLOR = 0xff405b
export const HOSTILE_SHADOW_COLOR = 0x21030b
export const HOSTILE_IMPACT_COLOR = 0xfff1e8
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

interface HostilePalette {
  readonly reportName: string
  readonly paletteName: string
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
