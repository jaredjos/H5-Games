export const BOSS_PATTERN_COUNT = 10

export type SupportPickupKind = 'dawnheart' | 'gravestar' | 'pulse-core'

export interface SupportPickupChoiceInput {
  hpRatio: number
  activeExperiencePickups: number
  pulseCharge: number
  dropIndex: number
}

export function bossPatternForLevel(levelId: number) {
  const normalizedLevel = Math.max(1, Math.floor(Number.isFinite(levelId) ? levelId : 1))
  return (normalizedLevel - 1) % BOSS_PATTERN_COUNT
}

export function supportPickupFirstDropSeconds(difficulty: number) {
  return 55 + Math.max(1, difficulty) * 4
}

export function supportPickupIntervalSeconds(difficulty: number, progress: number) {
  const safeDifficulty = Math.max(1, difficulty)
  const safeProgress = Math.max(0, Math.min(1, progress))
  return 72 + safeDifficulty * 6 + safeProgress * 20
}

export function chooseSupportPickup({
  hpRatio,
  activeExperiencePickups,
  pulseCharge,
  dropIndex,
}: SupportPickupChoiceInput): SupportPickupKind | undefined {
  if (hpRatio <= 0.52) return 'dawnheart'

  const eligible: SupportPickupKind[] = []
  if (activeExperiencePickups >= 18) eligible.push('gravestar')
  if (pulseCharge <= 68) eligible.push('pulse-core')
  if (hpRatio <= 0.66) eligible.push('dawnheart')
  if (eligible.length === 0) return undefined

  return eligible[Math.max(0, Math.floor(dropIndex)) % eligible.length]
}
