import type { LightRingProfile } from './lightRingSkill'

export type LightRingVisualLod = 'desktop' | 'mobile'

export const LIGHT_RING_PRIMITIVE_BUDGET = Object.freeze({
  desktop: 220,
  mobile: 140,
} as const)

export interface LightRingRenderPlan {
  readonly orbitBandCount: number
  readonly orbitSegmentCount: number
  readonly pulseWaveCount: number
  readonly waveSegmentCount: number
  readonly filamentCount: number
  readonly moteCount: number
  readonly energyKnotCount: number
  readonly petalCount: number
  readonly overlaySegmentCount: number
  readonly estimatedPrimitiveCount: number
  readonly primitiveBudget: number
}

interface LightRingRenderPreset {
  readonly orbitBandCount: number
  readonly orbitSegmentCount: number
  readonly pulseWaveCount: number
  readonly waveSegmentCount: number
  readonly filamentCount: number
  readonly moteCount: number
  readonly energyKnotCount: number
  readonly petalCount: number
  readonly overlaySegmentCount: number
}

const DESKTOP_PRESETS: readonly LightRingRenderPreset[] = Object.freeze([
  { orbitBandCount: 1, orbitSegmentCount: 5, pulseWaveCount: 1, waveSegmentCount: 3, filamentCount: 6, moteCount: 6, energyKnotCount: 2, petalCount: 0, overlaySegmentCount: 3 },
  { orbitBandCount: 2, orbitSegmentCount: 5, pulseWaveCount: 1, waveSegmentCount: 4, filamentCount: 7, moteCount: 8, energyKnotCount: 3, petalCount: 1, overlaySegmentCount: 3 },
  { orbitBandCount: 2, orbitSegmentCount: 6, pulseWaveCount: 2, waveSegmentCount: 4, filamentCount: 8, moteCount: 10, energyKnotCount: 4, petalCount: 2, overlaySegmentCount: 4 },
  { orbitBandCount: 3, orbitSegmentCount: 6, pulseWaveCount: 2, waveSegmentCount: 5, filamentCount: 9, moteCount: 12, energyKnotCount: 5, petalCount: 3, overlaySegmentCount: 4 },
  { orbitBandCount: 4, orbitSegmentCount: 5, pulseWaveCount: 3, waveSegmentCount: 5, filamentCount: 10, moteCount: 14, energyKnotCount: 6, petalCount: 4, overlaySegmentCount: 5 },
  { orbitBandCount: 5, orbitSegmentCount: 5, pulseWaveCount: 3, waveSegmentCount: 5, filamentCount: 13, moteCount: 16, energyKnotCount: 8, petalCount: 5, overlaySegmentCount: 6 },
])

const MOBILE_PRESETS: readonly LightRingRenderPreset[] = Object.freeze([
  { orbitBandCount: 1, orbitSegmentCount: 4, pulseWaveCount: 1, waveSegmentCount: 3, filamentCount: 5, moteCount: 5, energyKnotCount: 2, petalCount: 0, overlaySegmentCount: 3 },
  { orbitBandCount: 1, orbitSegmentCount: 5, pulseWaveCount: 1, waveSegmentCount: 3, filamentCount: 5, moteCount: 6, energyKnotCount: 2, petalCount: 1, overlaySegmentCount: 3 },
  { orbitBandCount: 2, orbitSegmentCount: 4, pulseWaveCount: 1, waveSegmentCount: 4, filamentCount: 6, moteCount: 7, energyKnotCount: 3, petalCount: 1, overlaySegmentCount: 3 },
  { orbitBandCount: 2, orbitSegmentCount: 5, pulseWaveCount: 1, waveSegmentCount: 4, filamentCount: 6, moteCount: 8, energyKnotCount: 3, petalCount: 2, overlaySegmentCount: 4 },
  { orbitBandCount: 2, orbitSegmentCount: 6, pulseWaveCount: 2, waveSegmentCount: 4, filamentCount: 7, moteCount: 9, energyKnotCount: 4, petalCount: 2, overlaySegmentCount: 4 },
  { orbitBandCount: 3, orbitSegmentCount: 5, pulseWaveCount: 2, waveSegmentCount: 4, filamentCount: 8, moteCount: 10, energyKnotCount: 5, petalCount: 3, overlaySegmentCount: 5 },
])

const finiteCount = (value: number) =>
  Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))

export const estimateLightRingPrimitiveCount = (
  preset: Omit<
    LightRingRenderPlan,
    'estimatedPrimitiveCount' | 'primitiveBudget'
  >,
) =>
  1 + // grounded pool
  preset.orbitBandCount * preset.orbitSegmentCount * 3 +
  preset.pulseWaveCount * preset.waveSegmentCount * 2 +
  preset.filamentCount * 2 +
  preset.moteCount * 2 +
  preset.energyKnotCount * 4 +
  preset.petalCount * 2 +
  preset.overlaySegmentCount * 2

export function lightRingRenderPlan(
  profile: LightRingProfile,
  lod: LightRingVisualLod,
): LightRingRenderPlan {
  const presetSource = lod === 'mobile' ? MOBILE_PRESETS : DESKTOP_PRESETS
  const preset = presetSource[Math.max(0, Math.min(5, profile.rank - 1))]
  const bounded = Object.freeze({
    orbitBandCount: Math.min(
      finiteCount(profile.orbitBandCount),
      preset.orbitBandCount,
    ),
    orbitSegmentCount: preset.orbitSegmentCount,
    pulseWaveCount: Math.min(
      finiteCount(profile.pulseWaveCount),
      preset.pulseWaveCount,
    ),
    waveSegmentCount: preset.waveSegmentCount,
    filamentCount: Math.min(
      finiteCount(profile.filamentCount),
      preset.filamentCount,
    ),
    moteCount: Math.min(finiteCount(profile.moteCount), preset.moteCount),
    energyKnotCount: Math.min(
      finiteCount(profile.energyKnotCount),
      preset.energyKnotCount,
    ),
    petalCount: Math.min(
      finiteCount(profile.petalCount),
      preset.petalCount,
    ),
    overlaySegmentCount: preset.overlaySegmentCount,
  })
  const estimatedPrimitiveCount = estimateLightRingPrimitiveCount(bounded)
  const primitiveBudget = LIGHT_RING_PRIMITIVE_BUDGET[lod]

  if (estimatedPrimitiveCount > primitiveBudget) {
    throw new Error(
      `Dawnward Aegis ${lod} render plan exceeds its primitive budget`,
    )
  }

  return Object.freeze({
    ...bounded,
    estimatedPrimitiveCount,
    primitiveBudget,
  })
}
