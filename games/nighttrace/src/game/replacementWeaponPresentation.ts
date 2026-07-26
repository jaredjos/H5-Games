import type { WeaponId } from '../shared/types'
import type { WeaponVfxStage } from './weaponVfx'

export const REPLACEMENT_WEAPON_PRESENTATION_IDS = Object.freeze([
  'ash-halo',
  'null-bell',
] as const satisfies readonly WeaponId[])

export type ReplacementWeaponPresentationId =
  (typeof REPLACEMENT_WEAPON_PRESENTATION_IDS)[number]

export const REPLACEMENT_PRESENTATION_STAGES = Object.freeze([
  'basic',
  'upgraded',
  'mastered',
  'final',
] as const)

export type ReplacementPresentationStage =
  (typeof REPLACEMENT_PRESENTATION_STAGES)[number]

export type ReplacementWeaponMotif =
  | 'graveglass-spires'
  | 'eclipse-harrow'

export interface ReplacementWeaponPalette {
  readonly coreColor: number
  readonly glowColor: number
  readonly accentColor: number
  readonly secondaryColor: number
  readonly shadowColor: number
}

export interface ReplacementWeaponMaterialPresentation {
  /** Final composite opacity before scene-level readability attenuation. */
  readonly opacity: number
  /** Relative luminance of the authored interior material. */
  readonly coreLuminance: number
  /** Relative luminance of the silhouette-defining edge. */
  readonly edgeLuminance: number
  /** Separation between dark body material and emissive detail. */
  readonly surfaceContrast: number
  /** Amount of cracks, runes, or spectral striation in the surface. */
  readonly fractureDensity: number
  /** Perceived front-to-back separation within the effect. */
  readonly depth: number
}

export interface ReplacementWeaponTrailPresentation {
  readonly lengthScale: number
  readonly widthScale: number
  readonly persistence: number
  readonly turbulence: number
  readonly secondaryRibbonAlpha: number
}

export interface ReplacementWeaponParticlePresentation {
  readonly count: number
  readonly velocityScale: number
  readonly lifetimeScale: number
  readonly sizeScale: number
  readonly glowRatio: number
  readonly debrisRatio: number
}

export interface ReplacementWeaponCastPresentation {
  readonly durationScale: number
  readonly footprintScale: number
  readonly layerCount: number
  readonly telegraphAlpha: number
  readonly revealSharpness: number
  readonly secondaryMotifAlpha: number
}

export interface ReplacementWeaponImpactPresentation {
  readonly durationScale: number
  readonly radiusScale: number
  readonly flashAlpha: number
  readonly shockwaveAlpha: number
  readonly debrisCount: number
  readonly decalPersistence: number
}

/**
 * Presentation-only contract for the two remote area weapons.
 *
 * It deliberately contains no damage, cooldown, hit radius, crowd-control,
 * or targeting values. Renderers can consume these numbers without changing
 * simulation or balance.
 */
export interface ReplacementWeaponPresentationProfile {
  readonly weaponId: ReplacementWeaponPresentationId
  readonly displayName: 'Graveglass Spires' | 'Eclipse Harrow'
  readonly motif: ReplacementWeaponMotif
  readonly stage: ReplacementPresentationStage
  readonly intensity: number
  readonly palette: ReplacementWeaponPalette
  readonly material: ReplacementWeaponMaterialPresentation
  readonly trail: ReplacementWeaponTrailPresentation
  readonly particles: ReplacementWeaponParticlePresentation
  readonly cast: ReplacementWeaponCastPresentation
  readonly impact: ReplacementWeaponImpactPresentation
}

type ProfileInput = Omit<ReplacementWeaponPresentationProfile, 'weaponId'>

const freezeProfile = (
  weaponId: ReplacementWeaponPresentationId,
  input: ProfileInput,
): ReplacementWeaponPresentationProfile =>
  Object.freeze({
    weaponId,
    ...input,
    palette: Object.freeze({ ...input.palette }),
    material: Object.freeze({ ...input.material }),
    trail: Object.freeze({ ...input.trail }),
    particles: Object.freeze({ ...input.particles }),
    cast: Object.freeze({ ...input.cast }),
    impact: Object.freeze({ ...input.impact }),
  })

const graveglass = (
  input: Omit<ProfileInput, 'displayName' | 'motif'>,
): ReplacementWeaponPresentationProfile =>
  freezeProfile('ash-halo', {
    displayName: 'Graveglass Spires',
    motif: 'graveglass-spires',
    ...input,
  })

const harrow = (
  input: Omit<ProfileInput, 'displayName' | 'motif'>,
): ReplacementWeaponPresentationProfile =>
  freezeProfile('null-bell', {
    displayName: 'Eclipse Harrow',
    motif: 'eclipse-harrow',
    ...input,
  })

const GRAVEGLASS_PALETTE = Object.freeze({
  coreColor: 0xffeee4,
  glowColor: 0xff7468,
  accentColor: 0xc62d3d,
  secondaryColor: 0x6d1d32,
  shadowColor: 0x080406,
} as const satisfies ReplacementWeaponPalette)

const ECLIPSE_PALETTE = Object.freeze({
  coreColor: 0xffefff,
  glowColor: 0xdf8aff,
  accentColor: 0xa32c83,
  secondaryColor: 0x4f1d69,
  shadowColor: 0x05030a,
} as const satisfies ReplacementWeaponPalette)

const PRESENTATION_PROFILES = Object.freeze({
  'ash-halo': Object.freeze({
    basic: graveglass({
      stage: 'basic',
      intensity: 0.32,
      palette: GRAVEGLASS_PALETTE,
      material: {
        opacity: 0.78,
        coreLuminance: 0.54,
        edgeLuminance: 0.7,
        surfaceContrast: 0.66,
        fractureDensity: 0.24,
        depth: 0.42,
      },
      trail: {
        lengthScale: 0.76,
        widthScale: 0.9,
        persistence: 0.34,
        turbulence: 0.4,
        secondaryRibbonAlpha: 0.18,
      },
      particles: {
        count: 8,
        velocityScale: 0.78,
        lifetimeScale: 0.76,
        sizeScale: 0.88,
        glowRatio: 0.28,
        debrisRatio: 0.58,
      },
      cast: {
        durationScale: 0.76,
        footprintScale: 0.84,
        layerCount: 3,
        telegraphAlpha: 0.34,
        revealSharpness: 0.64,
        secondaryMotifAlpha: 0.22,
      },
      impact: {
        durationScale: 0.74,
        radiusScale: 0.82,
        flashAlpha: 0.42,
        shockwaveAlpha: 0.3,
        debrisCount: 6,
        decalPersistence: 0.4,
      },
    }),
    upgraded: graveglass({
      stage: 'upgraded',
      intensity: 0.52,
      palette: GRAVEGLASS_PALETTE,
      material: {
        opacity: 0.84,
        coreLuminance: 0.64,
        edgeLuminance: 0.78,
        surfaceContrast: 0.74,
        fractureDensity: 0.42,
        depth: 0.58,
      },
      trail: {
        lengthScale: 0.94,
        widthScale: 1.02,
        persistence: 0.46,
        turbulence: 0.54,
        secondaryRibbonAlpha: 0.3,
      },
      particles: {
        count: 12,
        velocityScale: 0.9,
        lifetimeScale: 0.9,
        sizeScale: 1,
        glowRatio: 0.36,
        debrisRatio: 0.66,
      },
      cast: {
        durationScale: 0.9,
        footprintScale: 1,
        layerCount: 4,
        telegraphAlpha: 0.42,
        revealSharpness: 0.72,
        secondaryMotifAlpha: 0.34,
      },
      impact: {
        durationScale: 0.88,
        radiusScale: 0.98,
        flashAlpha: 0.5,
        shockwaveAlpha: 0.4,
        debrisCount: 9,
        decalPersistence: 0.54,
      },
    }),
    mastered: graveglass({
      stage: 'mastered',
      intensity: 0.76,
      palette: GRAVEGLASS_PALETTE,
      material: {
        opacity: 0.9,
        coreLuminance: 0.74,
        edgeLuminance: 0.86,
        surfaceContrast: 0.82,
        fractureDensity: 0.64,
        depth: 0.76,
      },
      trail: {
        lengthScale: 1.14,
        widthScale: 1.16,
        persistence: 0.6,
        turbulence: 0.68,
        secondaryRibbonAlpha: 0.44,
      },
      particles: {
        count: 18,
        velocityScale: 1.06,
        lifetimeScale: 1.04,
        sizeScale: 1.12,
        glowRatio: 0.46,
        debrisRatio: 0.76,
      },
      cast: {
        durationScale: 1.04,
        footprintScale: 1.18,
        layerCount: 6,
        telegraphAlpha: 0.5,
        revealSharpness: 0.82,
        secondaryMotifAlpha: 0.48,
      },
      impact: {
        durationScale: 1.04,
        radiusScale: 1.16,
        flashAlpha: 0.58,
        shockwaveAlpha: 0.5,
        debrisCount: 13,
        decalPersistence: 0.68,
      },
    }),
    final: graveglass({
      stage: 'final',
      intensity: 1,
      palette: GRAVEGLASS_PALETTE,
      material: {
        opacity: 0.96,
        coreLuminance: 0.86,
        edgeLuminance: 0.96,
        surfaceContrast: 0.92,
        fractureDensity: 0.9,
        depth: 0.94,
      },
      trail: {
        lengthScale: 1.38,
        widthScale: 1.32,
        persistence: 0.76,
        turbulence: 0.84,
        secondaryRibbonAlpha: 0.62,
      },
      particles: {
        count: 26,
        velocityScale: 1.24,
        lifetimeScale: 1.22,
        sizeScale: 1.26,
        glowRatio: 0.58,
        debrisRatio: 0.88,
      },
      cast: {
        durationScale: 1.22,
        footprintScale: 1.42,
        layerCount: 8,
        telegraphAlpha: 0.6,
        revealSharpness: 0.94,
        secondaryMotifAlpha: 0.68,
      },
      impact: {
        durationScale: 1.22,
        radiusScale: 1.4,
        flashAlpha: 0.68,
        shockwaveAlpha: 0.64,
        debrisCount: 18,
        decalPersistence: 0.84,
      },
    }),
  }),
  'null-bell': Object.freeze({
    basic: harrow({
      stage: 'basic',
      intensity: 0.3,
      palette: ECLIPSE_PALETTE,
      material: {
        opacity: 0.74,
        coreLuminance: 0.58,
        edgeLuminance: 0.72,
        surfaceContrast: 0.7,
        fractureDensity: 0.2,
        depth: 0.46,
      },
      trail: {
        lengthScale: 0.9,
        widthScale: 0.7,
        persistence: 0.4,
        turbulence: 0.24,
        secondaryRibbonAlpha: 0.24,
      },
      particles: {
        count: 6,
        velocityScale: 0.72,
        lifetimeScale: 0.82,
        sizeScale: 0.72,
        glowRatio: 0.42,
        debrisRatio: 0.26,
      },
      cast: {
        durationScale: 0.82,
        footprintScale: 0.9,
        layerCount: 3,
        telegraphAlpha: 0.4,
        revealSharpness: 0.72,
        secondaryMotifAlpha: 0.3,
      },
      impact: {
        durationScale: 0.8,
        radiusScale: 0.76,
        flashAlpha: 0.48,
        shockwaveAlpha: 0.24,
        debrisCount: 4,
        decalPersistence: 0.34,
      },
    }),
    upgraded: harrow({
      stage: 'upgraded',
      intensity: 0.5,
      palette: ECLIPSE_PALETTE,
      material: {
        opacity: 0.82,
        coreLuminance: 0.68,
        edgeLuminance: 0.8,
        surfaceContrast: 0.78,
        fractureDensity: 0.36,
        depth: 0.62,
      },
      trail: {
        lengthScale: 1.08,
        widthScale: 0.82,
        persistence: 0.52,
        turbulence: 0.34,
        secondaryRibbonAlpha: 0.38,
      },
      particles: {
        count: 10,
        velocityScale: 0.84,
        lifetimeScale: 0.96,
        sizeScale: 0.82,
        glowRatio: 0.52,
        debrisRatio: 0.34,
      },
      cast: {
        durationScale: 0.96,
        footprintScale: 1.08,
        layerCount: 5,
        telegraphAlpha: 0.48,
        revealSharpness: 0.8,
        secondaryMotifAlpha: 0.42,
      },
      impact: {
        durationScale: 0.94,
        radiusScale: 0.92,
        flashAlpha: 0.56,
        shockwaveAlpha: 0.34,
        debrisCount: 7,
        decalPersistence: 0.48,
      },
    }),
    mastered: harrow({
      stage: 'mastered',
      intensity: 0.74,
      palette: ECLIPSE_PALETTE,
      material: {
        opacity: 0.9,
        coreLuminance: 0.8,
        edgeLuminance: 0.9,
        surfaceContrast: 0.86,
        fractureDensity: 0.56,
        depth: 0.8,
      },
      trail: {
        lengthScale: 1.3,
        widthScale: 0.96,
        persistence: 0.66,
        turbulence: 0.46,
        secondaryRibbonAlpha: 0.54,
      },
      particles: {
        count: 15,
        velocityScale: 0.98,
        lifetimeScale: 1.1,
        sizeScale: 0.94,
        glowRatio: 0.64,
        debrisRatio: 0.44,
      },
      cast: {
        durationScale: 1.12,
        footprintScale: 1.28,
        layerCount: 7,
        telegraphAlpha: 0.58,
        revealSharpness: 0.9,
        secondaryMotifAlpha: 0.56,
      },
      impact: {
        durationScale: 1.1,
        radiusScale: 1.1,
        flashAlpha: 0.66,
        shockwaveAlpha: 0.46,
        debrisCount: 10,
        decalPersistence: 0.62,
      },
    }),
    final: harrow({
      stage: 'final',
      intensity: 1,
      palette: ECLIPSE_PALETTE,
      material: {
        opacity: 0.97,
        coreLuminance: 0.92,
        edgeLuminance: 1,
        surfaceContrast: 0.95,
        fractureDensity: 0.82,
        depth: 0.96,
      },
      trail: {
        lengthScale: 1.56,
        widthScale: 1.12,
        persistence: 0.82,
        turbulence: 0.6,
        secondaryRibbonAlpha: 0.72,
      },
      particles: {
        count: 22,
        velocityScale: 1.14,
        lifetimeScale: 1.28,
        sizeScale: 1.08,
        glowRatio: 0.78,
        debrisRatio: 0.56,
      },
      cast: {
        durationScale: 1.3,
        footprintScale: 1.52,
        layerCount: 10,
        telegraphAlpha: 0.68,
        revealSharpness: 1,
        secondaryMotifAlpha: 0.74,
      },
      impact: {
        durationScale: 1.28,
        radiusScale: 1.32,
        flashAlpha: 0.78,
        shockwaveAlpha: 0.6,
        debrisCount: 14,
        decalPersistence: 0.78,
      },
    }),
  }),
} as const satisfies Readonly<
  Record<
    ReplacementWeaponPresentationId,
    Readonly<
      Record<
        ReplacementPresentationStage,
        ReplacementWeaponPresentationProfile
      >
    >
  >
>)

const VFX_STAGE_TO_PRESENTATION_STAGE = Object.freeze({
  solo: 'basic',
  combined: 'upgraded',
  mastered: 'mastered',
  final: 'final',
} as const satisfies Readonly<Record<WeaponVfxStage, ReplacementPresentationStage>>)

export function replacementPresentationStageForVfxStage(
  stage: WeaponVfxStage,
): ReplacementPresentationStage {
  return VFX_STAGE_TO_PRESENTATION_STAGE[stage]
}

export function replacementWeaponPresentationProfile(
  weaponId: ReplacementWeaponPresentationId,
  stage: ReplacementPresentationStage,
): ReplacementWeaponPresentationProfile {
  return PRESENTATION_PROFILES[weaponId][stage]
}

export function replacementWeaponPresentationForVfxStage(
  weaponId: ReplacementWeaponPresentationId,
  stage: WeaponVfxStage,
): ReplacementWeaponPresentationProfile {
  return replacementWeaponPresentationProfile(
    weaponId,
    replacementPresentationStageForVfxStage(stage),
  )
}

/**
 * Stable presentation-only noise for particles, material chips, and secondary
 * motion. This intentionally has no dependency on the simulation RNG so
 * increasing cosmetic density cannot change targets, damage, drops, or timing.
 */
export function replacementCosmeticUnit(
  seed: number,
  index: number,
  channel = 0,
): number {
  let value =
    (Math.trunc(seed) ^
      Math.imul(Math.trunc(index) + 1, 0x9e3779b1) ^
      Math.imul(Math.trunc(channel) + 1, 0x85ebca6b)) >>>
    0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296
}
