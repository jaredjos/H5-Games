import type { BossId } from '../shared/types'
import {
  bossMaterialTreatment,
  bossPresentation,
} from './enemyPresentation'
import {
  groundedVfxCosmeticUnit,
  sampleGroundedVfxPose,
  type GroundedVfxAssetLod,
  type GroundedVfxStage,
} from './groundedVfxPresentation'
import {
  resolveHostileTelegraphPalette,
  type HostileTelegraphMaterialPalette,
} from './hostileTelegraphPalette'

export const BOSS_TELEGRAPH_PARTICLE_KINDS = Object.freeze([
  'smoke',
  'grit',
  'cinder',
] as const)

export type BossTelegraphParticleKind =
  (typeof BOSS_TELEGRAPH_PARTICLE_KINDS)[number]

export type BossTelegraphFootprint = 'field' | 'lane'

export interface BossTelegraphParticleSampleInput {
  readonly bossId?: BossId
  /** Explicit palette is used by elite/ranged horde warnings. */
  readonly palette?: HostileTelegraphMaterialPalette
  readonly prominence?: 'boss' | 'horde'
  readonly footprint: BossTelegraphFootprint
  readonly stage: GroundedVfxStage
  readonly lod: GroundedVfxAssetLod
  readonly progress: number
  readonly motionTime: number
  readonly seed: number
  readonly reducedFlash?: boolean
  readonly maxParticles?: number
}

/**
 * Coordinates stay footprint-relative so the runtime can map the same physical
 * particle language onto circular fields, lanes, and projectile destinations.
 *
 * Field: u/v are centered normalized coordinates.
 * Lane: u is distance along the lane [0, 1], v is signed half-width [-0.5, 0.5].
 */
export interface BossTelegraphParticle {
  readonly kind: BossTelegraphParticleKind
  readonly u: number
  readonly v: number
  readonly lift: number
  readonly size: number
  readonly stretch: number
  readonly rotation: number
  readonly alpha: number
  readonly tint: number
  readonly glowAlpha: number
}

const STAGE_INDEX = Object.freeze({
  solo: 0,
  combined: 1,
  mastered: 2,
  final: 3,
} as const satisfies Readonly<Record<GroundedVfxStage, number>>)

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const clamp01 = (value: number) => clamp(value, 0, 1)

const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const fractional = (value: number) => value - Math.floor(value)

const smoothstep = (value: number) => {
  const safe = clamp01(value)
  return safe * safe * (3 - 2 * safe)
}

const particleCount = (
  stage: GroundedVfxStage,
  lod: GroundedVfxAssetLod,
  prominence: 'boss' | 'horde',
) => {
  const stageIndex = STAGE_INDEX[stage]
  if (prominence === 'horde') {
    return lod === 'mobile' ? 4 + stageIndex : 7 + stageIndex * 2
  }
  return lod === 'mobile' ? 8 + stageIndex * 2 : 16 + stageIndex * 3
}

export function sampleBossTelegraphParticles(
  input: BossTelegraphParticleSampleInput,
): readonly BossTelegraphParticle[] {
  const kind =
    input.footprint === 'field' ? 'hostile-field' : 'hostile-lane'
  const pose = sampleGroundedVfxPose(kind, {
    progress: finiteOr(input.progress, 0),
  })
  if (!pose.visible) return Object.freeze([])

  const prominence =
    input.prominence ?? (input.bossId ? 'boss' : 'horde')
  const presentation = input.bossId
    ? bossPresentation(input.bossId)
    : undefined
  const treatment = input.bossId
    ? bossMaterialTreatment(input.bossId)
    : undefined
  const palette =
    input.palette ??
    (presentation
      ? resolveHostileTelegraphPalette({
          family: presentation.colorFamily,
          actorColor: presentation.primaryColor,
          emphasis: 1,
        })
      : undefined)
  if (!palette) return Object.freeze([])
  const requested = particleCount(input.stage, input.lod, prominence)
  const limit = clamp(
    Math.floor(finiteOr(input.maxParticles ?? requested, requested)),
    0,
    requested,
  )
  if (limit === 0) return Object.freeze([])

  const reducedEnergy = input.reducedFlash ? 0.62 : 1
  const accentCoverage = Math.min(
    treatment?.accentCoverage ?? palette.accentCoverage,
    palette.accentCoverage,
  )
  const accentCount = Math.min(
    prominence === 'boss'
      ? input.lod === 'mobile'
        ? 2
        : 3
      : input.lod === 'mobile'
        ? 1
        : 2,
    Math.max(1, Math.round(limit * accentCoverage * 3.4)),
  )
  const nonAccentCount = Math.max(0, limit - accentCount)
  const smokeCount = Math.ceil(nonAccentCount * 0.48)
  const warningGain =
    (prominence === 'boss'
      ? 0.68 + pose.rise * 0.24 + pose.impact * 0.36
      : 0.5 + pose.rise * 0.2 + pose.impact * 0.28) * pose.alpha
  const motionTime = finiteOr(input.motionTime, 0)
  const seed = Math.trunc(finiteOr(input.seed, 0))
  const particles: BossTelegraphParticle[] = []

  for (let index = 0; index < limit; index += 1) {
    const isAccent = index >= limit - accentCount
    const particleKind: BossTelegraphParticleKind = isAccent
      ? 'cinder'
      : index < smokeCount
        ? 'smoke'
        : 'grit'
    const speed =
      particleKind === 'smoke'
        ? 0.2 + groundedVfxCosmeticUnit(seed, index, 11) * 0.12
        : particleKind === 'cinder'
          ? 0.48 + groundedVfxCosmeticUnit(seed, index, 13) * 0.18
          : 0.3 + groundedVfxCosmeticUnit(seed, index, 17) * 0.16
    const cycle = fractional(
      motionTime * speed + groundedVfxCosmeticUnit(seed, index, 19),
    )
    const cycleEnvelope = Math.sin(cycle * Math.PI)
    const sideDrift =
      Math.sin(
        motionTime * (0.42 + index * 0.013) +
          groundedVfxCosmeticUnit(seed, index, 23) * Math.PI * 2,
      ) *
      (particleKind === 'smoke' ? 0.045 : 0.018)

    let u: number
    let v: number
    if (input.footprint === 'field') {
      const angle =
        groundedVfxCosmeticUnit(seed, index, 29) * Math.PI * 2
      const radial =
        Math.sqrt(groundedVfxCosmeticUnit(seed, index, 31)) *
        (particleKind === 'cinder' ? 0.72 : 0.88)
      const inward = particleKind === 'smoke' ? cycle * 0.06 : 0
      u = Math.cos(angle) * Math.max(0.08, radial - inward) + sideDrift
      v =
        Math.sin(angle) *
          Math.max(0.08, radial - inward) *
          0.82 -
        cycle * (particleKind === 'smoke' ? 0.035 : 0.012)
    } else {
      const travelDirection =
        groundedVfxCosmeticUnit(seed, index, 37) > 0.5 ? 1 : -1
      u = clamp(
        0.07 +
          groundedVfxCosmeticUnit(seed, index, 41) * 0.86 +
          travelDirection * cycle * 0.028,
        0.04,
        0.97,
      )
      v = clamp(
        (groundedVfxCosmeticUnit(seed, index, 43) - 0.5) * 0.86 +
          sideDrift,
        -0.48,
        0.48,
      )
    }

    const baseSize = groundedVfxCosmeticUnit(seed, index, 47)
    const size =
      particleKind === 'smoke'
        ? (prominence === 'boss' ? 0.066 : 0.052) +
          baseSize * (prominence === 'boss' ? 0.074 : 0.058)
        : particleKind === 'cinder'
          ? (prominence === 'boss' ? 0.018 : 0.014) +
            baseSize * (prominence === 'boss' ? 0.018 : 0.013)
          : (prominence === 'boss' ? 0.024 : 0.019) +
            baseSize * (prominence === 'boss' ? 0.027 : 0.022)
    const stretch =
      particleKind === 'smoke'
        ? 1.55 + groundedVfxCosmeticUnit(seed, index, 53) * 0.9
        : particleKind === 'cinder'
          ? 0.62 + groundedVfxCosmeticUnit(seed, index, 59) * 0.42
          : 1.1 + groundedVfxCosmeticUnit(seed, index, 61) * 0.72
    const lift =
      cycleEnvelope *
      (particleKind === 'smoke'
        ? 0.1 + baseSize * 0.08
        : particleKind === 'cinder'
          ? 0.16 + baseSize * 0.1
          : 0.025 + baseSize * 0.04)
    const twinkle =
      particleKind === 'cinder'
        ? 0.58 +
          smoothstep(
            Math.sin(
              motionTime * 2.1 +
                groundedVfxCosmeticUnit(seed, index, 67) * Math.PI * 2,
            ) *
              0.5 +
              0.5,
          ) *
            0.42
        : 1
    const alpha =
      particleKind === 'smoke'
        ? palette.smokeOpacity *
          (0.58 + pose.impact * 0.3) *
          cycleEnvelope *
          warningGain
        : particleKind === 'cinder'
          ? palette.impactOpacity *
            (0.72 + pose.impact * 0.34) *
            twinkle *
            warningGain
          : (0.2 + palette.groundOpacity * 0.28) *
            (0.68 + cycleEnvelope * 0.32) *
            warningGain
    const tint =
      particleKind === 'smoke'
        ? treatment?.smokeTint ?? palette.smokeTint
        : particleKind === 'cinder'
          ? index % 2 === 0
            ? palette.impactTint
            : treatment?.accentColor ?? palette.seepTint
          : treatment?.debrisTint ?? palette.groundTint
    const glowAlpha =
      particleKind === 'cinder'
        ? clamp01(
            (0.2 + palette.emission * 0.62 + pose.impact * 0.18) *
              reducedEnergy,
          )
        : 0

    particles.push(
      Object.freeze({
        kind: particleKind,
        u,
        v,
        lift,
        size,
        stretch,
        rotation:
          (groundedVfxCosmeticUnit(seed, index, 71) - 0.5) *
          Math.PI *
          0.72,
        alpha: clamp01(alpha * reducedEnergy),
        tint,
        glowAlpha,
      }),
    )
  }

  return Object.freeze(particles)
}
