export type HostileSpecialFootprint = 'field' | 'lane'
export type HostileSpecialEnergyLod = 'desktop' | 'mobile'

export interface HostileSpecialEnergyMark {
  /** Angular turn for fields; normalized distance along the lane for lanes. */
  readonly anchor: number
  /** Radial depth for fields; signed edge selection for lanes. */
  readonly edge: number
  readonly span: number
  readonly bend: number
  readonly alpha: number
  readonly width: number
  readonly color: number
  readonly mote: boolean
}

export interface HostileSpecialEnergyRequest {
  readonly footprint: HostileSpecialFootprint
  readonly progress: number
  readonly motionTime: number
  readonly seed: number
  readonly lod: HostileSpecialEnergyLod
  readonly reducedFlash: boolean
  readonly active: boolean
}

export const HOSTILE_SPECIAL_CRIMSON = 0xa21f47
export const HOSTILE_SPECIAL_VIOLET = 0x6d348f

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const unitHash = (seed: number, index: number, salt: number) => {
  const value = Math.sin(
    (finiteOr(seed, 0) + index * 53.17 + salt * 97.31) * 12.9898,
  ) * 43_758.5453
  return value - Math.floor(value)
}

/**
 * Samples short, separated hostile-energy filaments. The marks deliberately
 * never join into a continuous ring or lane outline; the bone-white boundary
 * layer remains the dominant dodge-readable edge above them.
 */
export function sampleHostileSpecialEnergy(
  request: HostileSpecialEnergyRequest,
) {
  if (!request.active) return Object.freeze([]) as readonly HostileSpecialEnergyMark[]
  const progress = clamp(finiteOr(request.progress, 0), 0, 1)
  const count = request.lod === 'mobile'
    ? request.footprint === 'field' ? 7 : 8
    : request.footprint === 'field' ? 12 : 14
  const flashScale = request.reducedFlash ? 0.7 : 1
  const warningEnvelope = 0.58 + progress * 0.42
  const marks: HostileSpecialEnergyMark[] = []

  for (let index = 0; index < count; index += 1) {
    const drift = Math.sin(
      finiteOr(request.motionTime, 0) * (0.72 + (index % 3) * 0.13) +
        unitHash(request.seed, index, 5) * Math.PI * 2,
    )
    const side = unitHash(request.seed, index, 11) < 0.5 ? -1 : 1
    marks.push(Object.freeze({
      anchor:
        (unitHash(request.seed, index, 17) + drift * 0.012 + 1) % 1,
      edge:
        request.footprint === 'field'
          ? 0.7 + unitHash(request.seed, index, 23) * 0.24
          : side * (0.39 + unitHash(request.seed, index, 23) * 0.13),
      span:
        request.footprint === 'field'
          ? 0.026 + unitHash(request.seed, index, 29) * 0.035
          : 0.028 + unitHash(request.seed, index, 29) * 0.055,
      bend: (unitHash(request.seed, index, 31) - 0.5) * 2,
      alpha:
        flashScale *
        warningEnvelope *
        (0.24 + unitHash(request.seed, index, 37) * 0.2),
      width: 0.9 + unitHash(request.seed, index, 41) * 0.9,
      color:
        index % 3 === 0 ? HOSTILE_SPECIAL_VIOLET : HOSTILE_SPECIAL_CRIMSON,
      mote: index % 3 === 1,
    }))
  }

  return Object.freeze(marks) as readonly HostileSpecialEnergyMark[]
}
