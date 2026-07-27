export const GROUNDED_VFX_KINDS = [
  'hostile-field',
  'hostile-lane',
  'graveglass-field',
  'eclipse-lane',
] as const

export const GROUNDED_VFX_ASSET_LODS = ['desktop', 'mobile'] as const
export const GROUNDED_VFX_STAGES = [
  'solo',
  'combined',
  'mastered',
  'final',
] as const

export type GroundedVfxKind = (typeof GROUNDED_VFX_KINDS)[number]
export type GroundedVfxAssetLod = (typeof GROUNDED_VFX_ASSET_LODS)[number]
export type GroundedVfxStage = (typeof GROUNDED_VFX_STAGES)[number]

export interface GroundedVfxProfileInput {
  readonly kind: GroundedVfxKind
  readonly lod: GroundedVfxAssetLod
  readonly stage: GroundedVfxStage
  readonly boss?: boolean
  readonly reducedFlash?: boolean
}

export interface GroundedVfxTimeInput {
  readonly progress?: number
  readonly localTime?: number
  readonly duration?: number
}

export interface GroundedVfxSampleInput
  extends GroundedVfxProfileInput,
    GroundedVfxTimeInput {
  readonly seed: number
}

export interface GroundedMaterialCue {
  readonly type: 'material'
  readonly kind: GroundedVfxKind
  readonly assetId: string
  readonly lod: GroundedVfxAssetLod
  readonly opacity: number
  readonly scale: number
  readonly emission: number
  readonly groundShadow: number
  readonly distortion: number
  readonly variant: number
}

export interface GroundedDustCue {
  readonly type: 'dust'
  readonly kind: GroundedVfxKind
  readonly count: number
  readonly opacity: number
  readonly scale: number
  readonly spread: number
  readonly drift: number
  readonly variant: number
}

export interface GroundedDebrisCue {
  readonly type: 'debris'
  readonly kind: GroundedVfxKind
  readonly count: number
  readonly opacity: number
  readonly scale: number
  readonly spread: number
  readonly lift: number
  readonly variant: number
}

export type GroundedVfxCue =
  | GroundedMaterialCue
  | GroundedDustCue
  | GroundedDebrisCue

export interface GroundedVfxMaterialProfile {
  readonly kind: GroundedVfxKind
  readonly lod: GroundedVfxAssetLod
  readonly stage: GroundedVfxStage
  readonly boss: boolean
  readonly reducedFlash: boolean
  readonly material: Readonly<{
    assetId: string
    opacity: number
    scale: number
    emission: number
    groundShadow: number
    distortion: number
  }>
  readonly dust: Readonly<{
    count: number
    opacity: number
    scale: number
    spread: number
    drift: number
  }>
  readonly debris: Readonly<{
    count: number
    opacity: number
    scale: number
    spread: number
    lift: number
  }>
}

export interface GroundedVfxPose {
  readonly visible: boolean
  readonly progress: number
  readonly rise: number
  readonly hold: number
  readonly impact: number
  readonly decay: number
  readonly alpha: number
  readonly scale: number
}

interface GroundedVfxBaseProfile {
  readonly assetStem: string
  readonly materialOpacity: number
  readonly materialScale: number
  readonly emission: number
  readonly groundShadow: number
  readonly distortion: number
  readonly dustCount: number
  readonly dustOpacity: number
  readonly dustScale: number
  readonly dustSpread: number
  readonly dustDrift: number
  readonly debrisCount: number
  readonly debrisOpacity: number
  readonly debrisScale: number
  readonly debrisSpread: number
  readonly debrisLift: number
}

interface GroundedVfxPhaseTiming {
  readonly riseEnd: number
  readonly impactStart: number
  readonly impactEnd: number
  readonly decayStart: number
}

const BASE_PROFILES = Object.freeze({
  'hostile-field': Object.freeze({
    assetStem: 'hostile-scorch-field',
    materialOpacity: 0.42,
    materialScale: 1,
    emission: 0.32,
    groundShadow: 0.48,
    distortion: 0.18,
    dustCount: 6,
    dustOpacity: 0.34,
    dustScale: 0.92,
    dustSpread: 1.08,
    dustDrift: 0.28,
    debrisCount: 3,
    debrisOpacity: 0.42,
    debrisScale: 0.88,
    debrisSpread: 0.9,
    debrisLift: 0.36,
  }),
  'hostile-lane': Object.freeze({
    assetStem: 'hostile-scorch-lane',
    materialOpacity: 0.38,
    materialScale: 1,
    emission: 0.28,
    groundShadow: 0.52,
    distortion: 0.22,
    dustCount: 7,
    dustOpacity: 0.32,
    dustScale: 0.86,
    dustSpread: 1.18,
    dustDrift: 0.34,
    debrisCount: 3,
    debrisOpacity: 0.38,
    debrisScale: 0.82,
    debrisSpread: 1.04,
    debrisLift: 0.3,
  }),
  'graveglass-field': Object.freeze({
    assetStem: 'graveglass-rupture-field',
    materialOpacity: 0.78,
    materialScale: 0.9,
    emission: 0.66,
    groundShadow: 0.62,
    distortion: 0.2,
    dustCount: 8,
    dustOpacity: 0.42,
    dustScale: 1,
    dustSpread: 1.12,
    dustDrift: 0.25,
    debrisCount: 7,
    debrisOpacity: 0.72,
    debrisScale: 1,
    debrisSpread: 1.08,
    debrisLift: 0.64,
  }),
  'eclipse-lane': Object.freeze({
    assetStem: 'eclipse-ash-lane',
    materialOpacity: 0.66,
    materialScale: 0.94,
    emission: 0.58,
    groundShadow: 0.68,
    distortion: 0.32,
    dustCount: 8,
    dustOpacity: 0.46,
    dustScale: 1.04,
    dustSpread: 1.24,
    dustDrift: 0.42,
    debrisCount: 5,
    debrisOpacity: 0.58,
    debrisScale: 0.94,
    debrisSpread: 1.18,
    debrisLift: 0.48,
  }),
} as const satisfies Readonly<
  Record<GroundedVfxKind, GroundedVfxBaseProfile>
>)

const STAGE_PROFILE = Object.freeze({
  solo: Object.freeze({
    opacity: 0.84,
    scale: 0.82,
    density: 0.72,
    emission: 0.84,
  }),
  combined: Object.freeze({
    opacity: 0.9,
    scale: 0.92,
    density: 0.9,
    emission: 0.91,
  }),
  mastered: Object.freeze({
    opacity: 0.96,
    scale: 1.02,
    density: 1.08,
    emission: 0.97,
  }),
  final: Object.freeze({
    opacity: 1,
    scale: 1.14,
    density: 1.34,
    emission: 1.06,
  }),
} as const)

const PHASE_TIMINGS = Object.freeze({
  'hostile-field': Object.freeze({
    riseEnd: 0.3,
    impactStart: 0.72,
    impactEnd: 0.99,
    decayStart: 0.995,
  }),
  'hostile-lane': Object.freeze({
    riseEnd: 0.24,
    impactStart: 0.74,
    impactEnd: 0.99,
    decayStart: 0.995,
  }),
  'graveglass-field': Object.freeze({
    riseEnd: 0.28,
    impactStart: 0.18,
    impactEnd: 0.48,
    decayStart: 0.66,
  }),
  'eclipse-lane': Object.freeze({
    riseEnd: 0.22,
    impactStart: 0.2,
    impactEnd: 0.5,
    decayStart: 0.7,
  }),
} as const satisfies Readonly<
  Record<GroundedVfxKind, GroundedVfxPhaseTiming>
>)

const KIND_SALT = Object.freeze({
  'hostile-field': 0x4f1bbcdc,
  'hostile-lane': 0x651e95c9,
  'graveglass-field': 0x9f6abc1d,
  'eclipse-lane': 0xc2b2ae35,
} as const satisfies Readonly<Record<GroundedVfxKind, number>>)

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const clamp01 = (value: number) => clamp(value, 0, 1)

const smoothstep = (value: number) => {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}

const finiteOr = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback

const densityCount = (count: number, density: number, lod: GroundedVfxAssetLod) =>
  Math.max(1, Math.round(count * density * (lod === 'mobile' ? 0.58 : 1)))

const normalizedProgress = (time: GroundedVfxTimeInput) => {
  if (time.progress !== undefined && Number.isFinite(time.progress)) {
    return time.progress
  }
  const duration = finiteOr(time.duration, 0)
  const localTime = finiteOr(time.localTime, -1)
  return duration > 0 ? localTime / duration : -1
}

export function groundedVfxCosmeticUnit(
  seed: number,
  index: number,
  channel = 0,
): number {
  let value =
    (Math.trunc(finiteOr(seed, 0)) ^
      Math.imul(Math.trunc(finiteOr(index, 0)) + 1, 0x9e3779b1) ^
      Math.imul(Math.trunc(finiteOr(channel, 0)) + 1, 0x85ebca6b)) >>>
    0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296
}

export function groundedVfxMaterialProfile(
  input: GroundedVfxProfileInput,
): GroundedVfxMaterialProfile {
  const base = BASE_PROFILES[input.kind]
  const stage = STAGE_PROFILE[input.stage]
  const isHostile =
    input.kind === 'hostile-field' || input.kind === 'hostile-lane'
  const boss = Boolean(input.boss && isHostile)
  const reducedFlash = Boolean(input.reducedFlash)
  const bossScale = boss ? 1.12 : 1
  const bossDensity = boss ? 1.28 : 1
  const bossOpacity = boss ? 1.08 : 1
  const flashOpacity = reducedFlash ? 0.68 : 1
  const flashEmission = reducedFlash ? 0.46 : 1

  const material = Object.freeze({
    assetId: `${base.assetStem}-${input.lod}`,
    opacity: clamp01(
      base.materialOpacity *
        stage.opacity *
        bossOpacity *
        flashOpacity,
    ),
    scale: clamp(base.materialScale * stage.scale * bossScale, 0.5, 1.8),
    emission: clamp01(
      base.emission *
        stage.emission *
        bossOpacity *
        flashEmission,
    ),
    groundShadow: clamp01(base.groundShadow * (boss ? 1.08 : 1)),
    distortion: clamp01(
      base.distortion * (boss ? 1.12 : 1) * (reducedFlash ? 0.78 : 1),
    ),
  })
  const dust = Object.freeze({
    count: densityCount(
      base.dustCount,
      stage.density * bossDensity,
      input.lod,
    ),
    opacity: clamp01(
      base.dustOpacity *
        stage.opacity *
        bossOpacity *
        (reducedFlash ? 0.74 : 1),
    ),
    scale: clamp(base.dustScale * stage.scale, 0.5, 1.8),
    spread: clamp(base.dustSpread * bossScale, 0.5, 1.8),
    drift: clamp01(base.dustDrift * (boss ? 1.12 : 1)),
  })
  const debris = Object.freeze({
    count: densityCount(
      base.debrisCount,
      stage.density * bossDensity,
      input.lod,
    ),
    opacity: clamp01(
      base.debrisOpacity *
        stage.opacity *
        bossOpacity *
        (reducedFlash ? 0.76 : 1),
    ),
    scale: clamp(base.debrisScale * stage.scale, 0.5, 1.8),
    spread: clamp(base.debrisSpread * bossScale, 0.5, 1.8),
    lift: clamp01(base.debrisLift * (boss ? 1.1 : 1)),
  })

  return Object.freeze({
    kind: input.kind,
    lod: input.lod,
    stage: input.stage,
    boss,
    reducedFlash,
    material,
    dust,
    debris,
  })
}

export function sampleGroundedVfxPose(
  kind: GroundedVfxKind,
  time: GroundedVfxTimeInput,
): GroundedVfxPose {
  const rawProgress = normalizedProgress(time)
  const progress = clamp01(rawProgress)
  const timing = PHASE_TIMINGS[kind]
  const rise = smoothstep(progress / timing.riseEnd)
  const decay = smoothstep(
    (progress - timing.decayStart) / (1 - timing.decayStart),
  )
  const impactProgress = clamp01(
    (progress - timing.impactStart) /
      (timing.impactEnd - timing.impactStart),
  )
  const impact =
    progress < timing.impactStart || progress > timing.impactEnd
      ? 0
      : Math.sin(impactProgress * Math.PI)
  const hold = rise * (1 - decay)
  const visible = rawProgress >= 0 && rawProgress < 1 && hold > 0.001

  return Object.freeze({
    visible,
    progress,
    rise,
    hold,
    impact,
    decay,
    alpha: visible ? clamp01(hold) : 0,
    scale: 0.76 + rise * 0.24 + impact * 0.035,
  })
}

export function sampleGroundedVfxCues(
  input: GroundedVfxSampleInput,
): readonly GroundedVfxCue[] {
  const pose = sampleGroundedVfxPose(input.kind, input)
  if (!pose.visible) return Object.freeze([])

  const profile = groundedVfxMaterialProfile(input)
  const cosmeticSeed = Math.trunc(finiteOr(input.seed, 0)) ^ KIND_SALT[input.kind]
  const material = Object.freeze<GroundedMaterialCue>({
    type: 'material',
    kind: input.kind,
    assetId: profile.material.assetId,
    lod: input.lod,
    opacity: clamp01(
      profile.material.opacity * pose.alpha * (0.96 + pose.impact * 0.04),
    ),
    scale: clamp(profile.material.scale * pose.scale, 0.5, 1.9),
    emission: clamp01(
      profile.material.emission * pose.alpha * (0.72 + pose.impact * 0.28),
    ),
    groundShadow: clamp01(profile.material.groundShadow * pose.alpha),
    distortion: clamp01(
      profile.material.distortion * pose.alpha * (0.7 + pose.impact * 0.3),
    ),
    variant: Math.floor(groundedVfxCosmeticUnit(cosmeticSeed, 0, 0) * 4),
  })
  const dust = Object.freeze<GroundedDustCue>({
    type: 'dust',
    kind: input.kind,
    count: profile.dust.count,
    opacity: clamp01(profile.dust.opacity * pose.alpha),
    scale: clamp(profile.dust.scale * pose.scale, 0.5, 1.9),
    spread: profile.dust.spread,
    drift: profile.dust.drift,
    variant: Math.floor(groundedVfxCosmeticUnit(cosmeticSeed, 1, 1) * 4),
  })
  const debris = Object.freeze<GroundedDebrisCue>({
    type: 'debris',
    kind: input.kind,
    count: profile.debris.count,
    opacity: clamp01(
      profile.debris.opacity * pose.alpha * (0.78 + pose.impact * 0.22),
    ),
    scale: clamp(profile.debris.scale * pose.scale, 0.5, 1.9),
    spread: profile.debris.spread,
    lift: profile.debris.lift,
    variant: Math.floor(groundedVfxCosmeticUnit(cosmeticSeed, 2, 2) * 4),
  })

  return Object.freeze([material, dust, debris])
}
