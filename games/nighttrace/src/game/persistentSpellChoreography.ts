export interface OrbitingCometProfile {
  readonly count: number
  readonly innerRadius: number
  readonly outerRadius: number
  readonly angularSpeed: number
  readonly footprint: number
  readonly counterRotating: boolean
}

export interface CinderwakeReaverProfile {
  readonly count: number
  readonly speed: number
  readonly turnRate: number
  readonly spinRate: number
  readonly footprint: number
  readonly scale: number
}

/**
 * Shared material and layer budget for the Cinderwake review Theater and the
 * native Pixi presentation. `visualDiameter` is the final on-screen footprint
 * after the Theater's authored sprite size and scale have both been applied.
 */
export interface CinderwakeReaverPresentationProfile {
  readonly count: number
  readonly duration: number
  readonly scale: number
  readonly cinders: number
  readonly ambientParticleBudget: number
  readonly visualDiameter: number
}

const clampRank = (rank: number) =>
  Math.max(1, Math.min(5, Math.round(Number.isFinite(rank) ? rank : 1)))

const CINDERWAKE_REAVER_PRESENTATIONS = Object.freeze([
  Object.freeze({
    count: 1, duration: 5.2, scale: 0.72, cinders: 1,
    ambientParticleBudget: 5, visualDiameter: 49,
  }),
  Object.freeze({
    count: 1, duration: 4.45, scale: 0.82, cinders: 2,
    ambientParticleBudget: 7, visualDiameter: 57.4,
  }),
  Object.freeze({
    count: 2, duration: 4.05, scale: 0.78, cinders: 2,
    ambientParticleBudget: 9, visualDiameter: 56.2,
  }),
  Object.freeze({
    count: 2, duration: 3.45, scale: 0.86, cinders: 3,
    ambientParticleBudget: 11, visualDiameter: 63.6,
  }),
  Object.freeze({
    count: 3, duration: 3.05, scale: 0.9, cinders: 4,
    ambientParticleBudget: 13, visualDiameter: 68.4,
  }),
  Object.freeze({
    count: 4, duration: 2.48, scale: 1, cinders: 6,
    ambientParticleBudget: 18, visualDiameter: 76,
  }),
] satisfies readonly CinderwakeReaverPresentationProfile[])

/**
 * Rank changes improve coverage and visual choreography only. Damage remains
 * attached to one cast-wide budget, so adding stones never multiplies DPS.
 */
export function orbitingCometProfile(
  rank: number,
  awakened: boolean,
): OrbitingCometProfile {
  const safeRank = clampRank(rank)
  const counts = [2, 3, 3, 4, 5] as const
  const innerRadii = [76, 84, 92, 94, 104] as const
  const outerRadii = [76, 96, 112, 128, 144] as const
  const angularSpeeds = [1.15, 1.34, 1.53, 1.7, 1.84] as const

  return Object.freeze({
    count: awakened ? 6 : counts[safeRank - 1],
    innerRadius: awakened ? 106 : innerRadii[safeRank - 1],
    outerRadius: awakened ? 158 : outerRadii[safeRank - 1],
    angularSpeed: awakened ? 2.02 : angularSpeeds[safeRank - 1],
    footprint: awakened ? 22 : 17 + safeRank * 0.7,
    counterRotating: awakened || safeRank >= 4,
  })
}

/**
 * Cinderwake Reavers remain in the arena and bounce from its edges. Rank
 * changes improve coverage, steering and count; damage is still one shared
 * cast budget regardless of how many blades are visible.
 */
export function cinderwakeReaverProfile(
  rank: number,
  awakened: boolean,
): CinderwakeReaverProfile {
  const safeRank = clampRank(rank)
  const counts = [1, 1, 2, 2, 3] as const
  const speeds = [270, 300, 320, 350, 378] as const
  const turns = [1.45, 1.72, 1.92, 2.14, 2.36] as const

  return Object.freeze({
    count: awakened ? 4 : counts[safeRank - 1],
    speed: awakened ? 408 : speeds[safeRank - 1],
    turnRate: awakened ? 2.62 : turns[safeRank - 1],
    // Theater and native Pixi share the same 0.72-second forged-blade turn.
    // Keeping one cadence makes the authored red edge light readable in both.
    spinRate: (Math.PI * 2) / 0.72,
    footprint: awakened ? 22 : 18 + safeRank * 0.55,
    scale: awakened ? 0.9 : 0.72 + safeRank * 0.025,
  })
}

/**
 * Resolves the exact authored Theater presentation for Ranks I-V and the
 * Awakened state. Keeping these values beside the gameplay choreography lets
 * every renderer reproduce one Cinderwake material profile instead of
 * maintaining visually divergent local tables.
 */
export function cinderwakeReaverPresentationProfile(
  rank: number,
  awakened: boolean,
): CinderwakeReaverPresentationProfile {
  const safeRank = clampRank(rank)
  const index = awakened ? 5 : safeRank - 1
  return CINDERWAKE_REAVER_PRESENTATIONS[index]
}

/** One window is permitted to deliver no more than its authored cast budget. */
export function persistentWindowDamage(
  castDamageBudget: number,
  connectedTargetCount: number,
) {
  const safeBudget = Math.max(
    0,
    Number.isFinite(castDamageBudget) ? castDamageBudget : 0,
  )
  const safeTargetCount = Math.max(
    0,
    Math.floor(Number.isFinite(connectedTargetCount) ? connectedTargetCount : 0),
  )
  if (safeTargetCount === 0) return Object.freeze([] as number[])
  const share = safeBudget / safeTargetCount
  return Object.freeze(Array.from({ length: safeTargetCount }, () => share))
}
