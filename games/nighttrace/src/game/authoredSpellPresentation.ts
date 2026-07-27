import type { AuthoredSpellAssetDataKey } from './authoredSpellAssetData'
import type { CharacterVisualLod } from './visualQuality'
import type { WeaponVfxStage } from './weaponVfx'

export type AuthoredSpellAssetLod = 'desktop' | 'mobile'
export type AuthoredSpellMaterialKind =
  | 'graveglass-spire'
  | 'eclipse-gate'
  | 'eclipse-cathedral'

export interface AuthoredSpellStageMaterialProfile {
  readonly materialScale: number
  readonly opacity: number
  readonly gateCountPerStrike: number
  readonly cathedral: boolean
}

export interface AuthoredSpellMaterialPose {
  readonly visible: boolean
  readonly rise: number
  readonly hold: number
  readonly impact: number
  readonly decay: number
  readonly alpha: number
  readonly scaleX: number
  readonly scaleY: number
  readonly lift: number
}

interface MaterialPhaseTiming {
  readonly start: number
  readonly riseEnd: number
  readonly impactStart: number
  readonly impactEnd: number
  readonly holdEnd: number
  readonly decayEnd: number
}

const STAGE_MATERIAL_PROFILES = Object.freeze({
  solo: Object.freeze({
    materialScale: 0.82,
    opacity: 0.9,
    gateCountPerStrike: 1,
    cathedral: false,
  }),
  combined: Object.freeze({
    materialScale: 0.92,
    opacity: 0.94,
    gateCountPerStrike: 2,
    cathedral: false,
  }),
  mastered: Object.freeze({
    materialScale: 1.02,
    opacity: 0.97,
    gateCountPerStrike: 2,
    cathedral: false,
  }),
  final: Object.freeze({
    materialScale: 1.12,
    opacity: 1,
    gateCountPerStrike: 1,
    cathedral: true,
  }),
} as const satisfies Readonly<
  Record<WeaponVfxStage, AuthoredSpellStageMaterialProfile>
>)

const MATERIAL_PHASE_TIMINGS = Object.freeze({
  'graveglass-spire': Object.freeze({
    start: 0.12,
    riseEnd: 0.34,
    impactStart: 0.14,
    impactEnd: 0.42,
    holdEnd: 0.58,
    decayEnd: 0.92,
  }),
  'eclipse-gate': Object.freeze({
    start: 0.02,
    riseEnd: 0.22,
    impactStart: 0.16,
    impactEnd: 0.4,
    holdEnd: 0.54,
    decayEnd: 0.92,
  }),
  'eclipse-cathedral': Object.freeze({
    start: 0.04,
    riseEnd: 0.3,
    impactStart: 0.2,
    impactEnd: 0.52,
    holdEnd: 0.72,
    decayEnd: 1.16,
  }),
} as const satisfies Readonly<
  Record<AuthoredSpellMaterialKind, MaterialPhaseTiming>
>)

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const smoothstep = (value: number) => {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}

export function resolveAuthoredSpellAssetLod(
  visualLod: CharacterVisualLod,
): AuthoredSpellAssetLod {
  return visualLod === 'mobile' ? 'mobile' : 'desktop'
}

export function authoredSpellAssetDataKey(
  kind: AuthoredSpellMaterialKind,
  lod: AuthoredSpellAssetLod,
): AuthoredSpellAssetDataKey {
  if (kind === 'graveglass-spire') {
    return lod === 'mobile'
      ? 'graveglassSpireMobile'
      : 'graveglassSpireDesktop'
  }
  if (kind === 'eclipse-gate') {
    return lod === 'mobile'
      ? 'eclipseGateMobile'
      : 'eclipseGateDesktop'
  }
  return lod === 'mobile'
    ? 'eclipseCathedralMobile'
    : 'eclipseCathedralDesktop'
}

export function authoredSpellStageMaterialProfile(
  stage: WeaponVfxStage,
): AuthoredSpellStageMaterialProfile {
  return STAGE_MATERIAL_PROFILES[stage]
}

export function sampleAuthoredSpellMaterialPose(
  kind: AuthoredSpellMaterialKind,
  localTime: number,
): AuthoredSpellMaterialPose {
  const timing = MATERIAL_PHASE_TIMINGS[kind]
  const safeTime = Number.isFinite(localTime) ? localTime : -1
  const rise = smoothstep(
    (safeTime - timing.start) / (timing.riseEnd - timing.start),
  )
  const decay = smoothstep(
    (safeTime - timing.holdEnd) / (timing.decayEnd - timing.holdEnd),
  )
  const impactProgress = clamp01(
    (safeTime - timing.impactStart) /
      (timing.impactEnd - timing.impactStart),
  )
  const impact =
    safeTime < timing.impactStart || safeTime > timing.impactEnd
      ? 0
      : Math.sin(impactProgress * Math.PI)
  const hold = rise * (1 - decay)
  const visible =
    safeTime >= timing.start &&
    safeTime < timing.decayEnd &&
    hold > 0.001
  const minimumScaleY = kind === 'eclipse-cathedral' ? 0.06 : 0.1

  return Object.freeze({
    visible,
    rise,
    hold,
    impact,
    decay,
    alpha: hold,
    scaleX: 0.84 + rise * 0.16 + impact * 0.025,
    scaleY: minimumScaleY + rise * (1 - minimumScaleY),
    lift: (1 - rise) * 14 - impact * 2,
  })
}
