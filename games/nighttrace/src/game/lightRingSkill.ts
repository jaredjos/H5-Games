import type { RunMode } from '../shared/types'

export const LIGHT_RING_SKILL_ID = 'dawnward-aegis'
export const LIGHT_RING_SKILL_NAME = 'Dawnward Aegis'
export const LIGHT_RING_AWAKENING_NAME = 'Covenant of First Light'
export const LIGHT_RING_AWAKENED_RANK = 6

export type LightRingRank = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface LightRingProfile {
  rank: Exclude<LightRingRank, 0>
  label: string
  radius: number
  diameter: number
  damagePerTick: number
  tickSeconds: number
  bossDamageMultiplier: number
  filamentCount: number
  moteCount: number
  petalCount: number
  materialOpacity: number
  awakened: boolean
}

const PROFILE_SOURCE = [
  {
    rank: 1,
    label: 'Rank I',
    radius: 96,
    damagePerTick: 12,
    tickSeconds: 0.42,
    bossDamageMultiplier: 0.7,
    filamentCount: 6,
    moteCount: 6,
    petalCount: 0,
    materialOpacity: 0.08,
    awakened: false,
  },
  {
    rank: 2,
    label: 'Rank II',
    radius: 112,
    damagePerTick: 14,
    tickSeconds: 0.4,
    bossDamageMultiplier: 0.7,
    filamentCount: 7,
    moteCount: 9,
    petalCount: 0,
    materialOpacity: 0.095,
    awakened: false,
  },
  {
    rank: 3,
    label: 'Rank III',
    radius: 130,
    damagePerTick: 17,
    tickSeconds: 0.38,
    bossDamageMultiplier: 0.7,
    filamentCount: 8,
    moteCount: 12,
    petalCount: 2,
    materialOpacity: 0.115,
    awakened: false,
  },
  {
    rank: 4,
    label: 'Rank IV',
    radius: 150,
    damagePerTick: 20,
    tickSeconds: 0.36,
    bossDamageMultiplier: 0.7,
    filamentCount: 9,
    moteCount: 15,
    petalCount: 3,
    materialOpacity: 0.135,
    awakened: false,
  },
  {
    rank: 5,
    label: 'Rank V',
    radius: 172,
    damagePerTick: 24,
    tickSeconds: 0.34,
    bossDamageMultiplier: 0.7,
    filamentCount: 10,
    moteCount: 19,
    petalCount: 4,
    materialOpacity: 0.16,
    awakened: false,
  },
  {
    rank: 6,
    label: 'Awakened',
    radius: 202,
    damagePerTick: 31,
    tickSeconds: 0.3,
    bossDamageMultiplier: 0.7,
    filamentCount: 13,
    moteCount: 24,
    petalCount: 6,
    materialOpacity: 0.2,
    awakened: true,
  },
] as const

export const LIGHT_RING_PROFILES: readonly LightRingProfile[] = Object.freeze(
  PROFILE_SOURCE.map((profile) =>
    Object.freeze({
      ...profile,
      diameter: profile.radius * 2,
    }),
  ),
)

export function normalizeLightRingRank(value: unknown): LightRingRank {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(
    LIGHT_RING_AWAKENED_RANK,
    Math.max(0, Math.trunc(value)),
  ) as LightRingRank
}

/**
 * The prototype must never leak into campaign or Sovereign Trials while it is
 * still being tuned. Combat Lab is the only mode allowed to resolve a rank.
 */
export function lightRingRankForRun(
  mode: RunMode,
  requestedRank: unknown,
): LightRingRank {
  return mode === 'combat-lab' ? normalizeLightRingRank(requestedRank) : 0
}

export function lightRingProfile(
  rank: unknown,
): LightRingProfile | undefined {
  const normalized = normalizeLightRingRank(rank)
  return normalized > 0
    ? LIGHT_RING_PROFILES[normalized - 1]
    : undefined
}

export function lightRingDamagePerSecond(rank: unknown, boss = false) {
  const profile = lightRingProfile(rank)
  if (!profile) return 0
  const multiplier = boss ? profile.bossDamageMultiplier : 1
  return (profile.damagePerTick * multiplier) / profile.tickSeconds
}

export function lightRingTouchesTarget(
  rank: unknown,
  playerX: number,
  playerY: number,
  targetX: number,
  targetY: number,
  targetRadius = 0,
) {
  const profile = lightRingProfile(rank)
  if (!profile) return false
  const safeTargetRadius = Math.max(
    0,
    Number.isFinite(targetRadius) ? targetRadius : 0,
  )
  const reach = profile.radius + safeTargetRadius
  const dx = targetX - playerX
  const dy = targetY - playerY
  return dx * dx + dy * dy <= reach * reach
}

export function lightRingTickDamage(rank: unknown, boss = false) {
  const profile = lightRingProfile(rank)
  if (!profile) return 0
  return profile.damagePerTick * (boss ? profile.bossDamageMultiplier : 1)
}
