export const HOSTILE_BOUNDARY_PARTICLE_KINDS = Object.freeze([
  'filament',
  'mote',
] as const)
export const HOSTILE_BOUNDARY_BRIGHTNESS_GAIN = 2.15
export const HOSTILE_BOUNDARY_FRAME_BUDGET = Object.freeze({
  desktop: 560,
  mobile: 320,
} as const)
export const HOSTILE_BOUNDARY_PRIORITY_MINIMUM = Object.freeze({
  desktop: 12,
  mobile: 8,
} as const)
export const HOSTILE_BOUNDARY_HORDE_MINIMUM = 2

export type HostileBoundaryParticleKind =
  (typeof HOSTILE_BOUNDARY_PARTICLE_KINDS)[number]

export type HostileBoundaryFootprint = 'field' | 'lane'
export type HostileBoundaryProminence = 'boss' | 'horde'
export type HostileBoundaryStage = 0 | 1 | 2 | 3
export type HostileBoundaryLod = 'desktop' | 'mobile'

export interface HostileBoundaryParticleInput {
  readonly footprint: HostileBoundaryFootprint
  readonly prominence: HostileBoundaryProminence
  readonly stage: HostileBoundaryStage
  readonly lod: HostileBoundaryLod
  readonly progress: number
  readonly motionTime: number
  readonly seed: number
  readonly reducedFlash?: boolean
  readonly maxParticles?: number
}

/**
 * Footprint-relative output:
 * - fields use centered normalized coordinates;
 * - lanes use `u` along their length and `v` across their half width.
 *
 * `baseU` and `baseV` are the immutable authored anchors. Reduced-flash mode
 * keeps these anchors intact while reducing animated displacement and alpha.
 */
export interface HostileBoundaryParticle {
  readonly kind: HostileBoundaryParticleKind
  readonly u: number
  readonly v: number
  readonly baseU: number
  readonly baseV: number
  readonly size: number
  readonly stretch: number
  readonly rotation: number
  readonly alpha: number
  readonly glowAlpha: number
}

export interface HostileBoundaryParticleQuotaInput {
  readonly remainingBudget: number
  readonly remainingFootprints: number
}

export interface HostileBoundaryParticleQuotaReservation {
  readonly quota: number
  readonly remainingBudget: number
  readonly remainingFootprints: number
}

const EMPTY_PARTICLES = Object.freeze(
  [] as readonly HostileBoundaryParticle[],
)

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const clamp01 = (value: number) => clamp(value, 0, 1)

const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const finiteCount = (value: number) =>
  Math.floor(Math.max(0, finiteOr(value, 0)))

const fractional = (value: number) => value - Math.floor(value)

const smoothstep = (value: number) => {
  const safe = clamp01(value)
  return safe * safe * (3 - 2 * safe)
}

/**
 * A stable cosmetic hash. It never influences combat geometry or timing.
 */
const cosmeticUnit = (seed: number, index: number, salt: number) =>
  fractional(
    Math.sin(
      Math.trunc(seed) * 12.9898 +
        Math.trunc(index) * 78.233 +
        Math.trunc(salt) * 37.719,
    ) * 43_758.545_312_3,
  )

const requestedParticleCount = (
  prominence: HostileBoundaryProminence,
  stage: HostileBoundaryStage,
  lod: HostileBoundaryLod,
) => {
  if (prominence === 'horde') {
    return lod === 'mobile' ? 18 + stage * 2 : 28 + stage * 4
  }
  return lod === 'mobile' ? 28 + stage * 4 : 48 + stage * 8
}

export interface HostileBoundaryPriorityPoolInput {
  readonly frameBudget: number
  readonly priorityFootprints: number
  readonly hordeFootprints: number
  readonly lod: HostileBoundaryLod
}

export interface HostileBoundaryPriorityPools {
  readonly priorityBudget: number
  readonly hordeBudget: number
  readonly unusedBudget: number
}

const warningEnvelope = (progress: number) => {
  const safe = clamp01(progress)
  const rise = smoothstep(safe / 0.14)
  const releasePressure = smoothstep((safe - 0.42) / 0.5)
  // Establish the dodge boundary quickly, then build restrained pressure into
  // the release. It never disappears during the final decision window.
  return rise * (0.82 + releasePressure * 0.18)
}

/**
 * Reserves the next footprint's fair share of the remaining frame budget.
 * Repeating this operation until no footprints remain produces quotas whose
 * spread is at most one particle while consuming the budget exactly.
 */
export function reserveHostileBoundaryParticleQuota(
  input: HostileBoundaryParticleQuotaInput,
): HostileBoundaryParticleQuotaReservation {
  const remainingBudget = Math.max(
    0,
    Math.floor(finiteOr(input.remainingBudget, 0)),
  )
  const remainingFootprints = Math.max(
    0,
    Math.floor(finiteOr(input.remainingFootprints, 0)),
  )

  if (remainingBudget === 0 || remainingFootprints === 0) {
    return Object.freeze({
      quota: 0,
      remainingBudget,
      remainingFootprints: Math.max(0, remainingFootprints - 1),
    })
  }

  const quota = Math.ceil(remainingBudget / remainingFootprints)
  return Object.freeze({
    quota,
    remainingBudget: remainingBudget - quota,
    remainingFootprints: remainingFootprints - 1,
  })
}

/**
 * Splits the shared warning budget before any footprints render. Boss warnings
 * and every projectile destination receive their readable target density first;
 * elite-horde fields retain a two-particle floor whenever the frame budget can
 * support it. Keeping independent pools makes the result stable regardless of
 * entity iteration order.
 */
export function allocateHostileBoundaryPriorityPools(
  input: HostileBoundaryPriorityPoolInput,
): HostileBoundaryPriorityPools {
  const frameBudget = Math.max(0, finiteCount(input.frameBudget))
  const priorityFootprints = Math.max(
    0,
    finiteCount(input.priorityFootprints),
  )
  const hordeFootprints = Math.max(0, finiteCount(input.hordeFootprints))
  const priorityTargetPerFootprint = input.lod === 'mobile' ? 40 : 72
  const hordeTargetPerFootprint = input.lod === 'mobile' ? 24 : 40
  const priorityDesired = priorityFootprints * priorityTargetPerFootprint
  const hordeDesired = hordeFootprints * hordeTargetPerFootprint

  if (frameBudget === 0 || priorityFootprints + hordeFootprints === 0) {
    return Object.freeze({
      priorityBudget: 0,
      hordeBudget: 0,
      unusedBudget: frameBudget,
    })
  }

  if (priorityDesired + hordeDesired <= frameBudget) {
    return Object.freeze({
      priorityBudget: priorityDesired,
      hordeBudget: hordeDesired,
      unusedBudget: frameBudget - priorityDesired - hordeDesired,
    })
  }

  const priorityFloor =
    priorityFootprints * HOSTILE_BOUNDARY_PRIORITY_MINIMUM[input.lod]
  const hordeFloor = hordeFootprints * HOSTILE_BOUNDARY_HORDE_MINIMUM
  let priorityBudget: number
  let hordeBudget: number

  if (priorityFloor + hordeFloor <= frameBudget) {
    priorityBudget = Math.min(priorityDesired, frameBudget - hordeFloor)
    hordeBudget = Math.min(hordeDesired, frameBudget - priorityBudget)
  } else {
    priorityBudget = Math.min(priorityDesired, priorityFloor, frameBudget)
    hordeBudget = Math.min(hordeDesired, frameBudget - priorityBudget)
  }

  return Object.freeze({
    priorityBudget,
    hordeBudget,
    unusedBudget: frameBudget - priorityBudget - hordeBudget,
  })
}

export function sampleHostileBoundaryParticles(
  input: HostileBoundaryParticleInput,
): readonly HostileBoundaryParticle[] {
  const progress = finiteOr(input.progress, 0)
  if (progress <= 0 || progress >= 1) return EMPTY_PARTICLES

  const stage = clamp(
    Math.floor(finiteOr(input.stage, 0)),
    0,
    3,
  ) as HostileBoundaryStage
  const requested = requestedParticleCount(
    input.prominence,
    stage,
    input.lod,
  )
  const maxParticles =
    input.maxParticles === undefined
      ? requested
      : Math.max(0, Math.floor(finiteOr(input.maxParticles, 0)))
  const count = Math.min(requested, maxParticles)
  if (count === 0) return EMPTY_PARTICLES

  const filamentCount =
    count === 1
      ? 1
      : Math.min(count - 1, Math.max(1, Math.ceil(count * 0.62)))
  const envelope = warningEnvelope(progress)
  const reducedEnergy = input.reducedFlash ? 0.72 : 1
  const motionScale = input.reducedFlash ? 0.36 : 1
  const prominenceGain = input.prominence === 'boss' ? 1 : 0.9
  const motionTime = finiteOr(input.motionTime, 0)
  const seed = Math.trunc(finiteOr(input.seed, 0))
  const particles: HostileBoundaryParticle[] = []

  for (let index = 0; index < count; index += 1) {
    const kind: HostileBoundaryParticleKind =
      index < filamentCount ? 'filament' : 'mote'
    const phase = cosmeticUnit(seed, index, 11) * Math.PI * 2
    const speed =
      kind === 'filament'
        ? 0.42 + cosmeticUnit(seed, index, 13) * 0.34
        : 0.16 + cosmeticUnit(seed, index, 17) * 0.2
    const oscillation = Math.sin(motionTime * speed + phase)
    const secondaryOscillation = Math.cos(
      motionTime * speed * 0.71 + phase * 1.37,
    )

    let baseU: number
    let baseV: number
    let u: number
    let v: number
    let rotation: number

    if (input.footprint === 'field') {
      const angle = cosmeticUnit(seed, index, 19) * Math.PI * 2
      const tangentX = -Math.sin(angle)
      const tangentY = Math.cos(angle)

      if (kind === 'filament') {
        const baseRadius = 0.925 + cosmeticUnit(seed, index, 23) * 0.1
        const radialMotion =
          oscillation *
          (0.004 + cosmeticUnit(seed, index, 29) * 0.008) *
          motionScale
        const tangentMotion =
          secondaryOscillation *
          (0.004 + cosmeticUnit(seed, index, 31) * 0.007) *
          motionScale
        const radius = clamp(baseRadius + radialMotion, 0.91, 1.04)
        baseU = Math.cos(angle) * baseRadius
        baseV = Math.sin(angle) * baseRadius
        u = Math.cos(angle) * radius + tangentX * tangentMotion
        v = Math.sin(angle) * radius + tangentY * tangentMotion
        rotation =
          angle +
          Math.PI * 0.5 +
          oscillation * 0.08 * motionScale
      } else {
        const baseRadius = 0.82 + cosmeticUnit(seed, index, 37) * 0.24
        const outwardMotion =
          (0.008 + cosmeticUnit(seed, index, 41) * 0.028) *
          oscillation *
          motionScale
        const tangentMotion =
          secondaryOscillation *
          (0.006 + cosmeticUnit(seed, index, 43) * 0.014) *
          motionScale
        baseU = Math.cos(angle) * baseRadius
        baseV = Math.sin(angle) * baseRadius
        u =
          Math.cos(angle) * (baseRadius + outwardMotion) +
          tangentX * tangentMotion
        v =
          Math.sin(angle) * (baseRadius + outwardMotion) +
          tangentY * tangentMotion -
          (0.006 + cosmeticUnit(seed, index, 47) * 0.012) *
            motionScale *
            oscillation
        rotation = angle
      }
    } else {
      const along = 0.04 + cosmeticUnit(seed, index, 53) * 0.92

      if (kind === 'filament') {
        const filamentIndex = index
        const side = filamentIndex % 2 === 0 ? -1 : 1
        const edge = 0.465 + cosmeticUnit(seed, index, 59) * 0.04
        const alongMotion =
          oscillation *
          (0.004 + cosmeticUnit(seed, index, 61) * 0.012) *
          motionScale
        const edgeMotion =
          secondaryOscillation *
          (0.002 + cosmeticUnit(seed, index, 67) * 0.009) *
          motionScale
        baseU = along
        baseV = side * edge
        u = clamp(along + alongMotion, 0.02, 0.98)
        v = side * clamp(edge + edgeMotion, 0.44, 0.52)
        rotation =
          oscillation *
          (0.08 + cosmeticUnit(seed, index, 71) * 0.08) *
          motionScale
      } else {
        const side = cosmeticUnit(seed, index, 73) < 0.5 ? -1 : 1
        const edge = 0.4 + cosmeticUnit(seed, index, 79) * 0.18
        baseU = along
        baseV = side * edge
        u = clamp(
          along +
            oscillation *
              (0.008 + cosmeticUnit(seed, index, 83) * 0.02) *
              motionScale,
          0.01,
          0.99,
        )
        v =
          side *
          clamp(
            edge +
              secondaryOscillation *
                (0.006 + cosmeticUnit(seed, index, 89) * 0.018) *
                motionScale,
            0.36,
            0.62,
          )
        rotation = 0
      }
    }

    const sizeUnit = cosmeticUnit(seed, index, 97)
    const twinkle =
      0.74 +
      smoothstep(
        Math.sin(
          motionTime * (kind === 'filament' ? 1.7 : 1.08) + phase,
        ) *
          0.5 +
          0.5,
      ) *
        0.26
    const alpha =
      envelope *
      prominenceGain *
      reducedEnergy *
      twinkle *
      (kind === 'filament'
        ? 0.64 + sizeUnit * 0.28
        : 0.38 + sizeUnit * 0.28)

    particles.push(
      Object.freeze({
        kind,
        u,
        v,
        baseU,
        baseV,
        size:
          kind === 'filament'
            ? 0.0055 + sizeUnit * 0.0065
            : 0.008 + sizeUnit * 0.011,
        stretch:
          kind === 'filament'
            ? 4.2 + cosmeticUnit(seed, index, 101) * 5.6
            : 0.72 + cosmeticUnit(seed, index, 103) * 0.6,
        rotation,
        alpha: clamp01(alpha),
        glowAlpha: clamp01(
          (kind === 'filament' ? 0.62 : 0.46) *
            prominenceGain *
            reducedEnergy,
        ),
      }),
    )
  }

  return Object.freeze(particles)
}
