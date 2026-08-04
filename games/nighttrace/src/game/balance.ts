import type {
  EnemyId,
  OwnedModule,
  OwnedWeapon,
  RunMode,
  TraceModId,
} from '../shared/types'
import { WEAPONS } from './content'
import { weaponConnectedDps } from './weaponBalance'

export const BOSS_PATTERN_COUNT = 10
export const ZONE_ONE_CAMPAIGN_DIFFICULTY_MULTIPLIER = 0.8

export type SupportPickupKind = 'dawnheart' | 'gravestar' | 'pulse-core'

export interface HordePressure {
  progress: number
  spawnIntensityFactor: number
  enemyHealthMultiplier: number
  enemySpeedMultiplier: number
  enemyDamageMultiplier: number
}

export interface SectorBaseline {
  spawnRate: number
  enemyHealth: number
}

export interface BossBuildSnapshot {
  playerLevel: number
  weapons: readonly OwnedWeapon[]
  modules: readonly OwnedModule[]
  traceMods: readonly TraceModId[]
  forceRank: number
  bossDamageRank: number
  critRank: number
}

export interface SupportPickupChoiceInput {
  activeExperiencePickups: number
  pulseCharge: number
  dropIndex: number
}

export interface PlannedDawnheartWindow {
  opensAt: number
  closesAt: number
}

export interface PlannedDawnheartEligibilityInput {
  elapsed: number
  hpRatio: number
  activeDawnheart: boolean
  lastReviveAt: number
  window: PlannedDawnheartWindow
}

export const PLANNED_DAWNHEART_HEAL_FRACTION = 0.1
export const PLANNED_DAWNHEART_WINDOW_SECONDS = 12
export const PLANNED_DAWNHEART_LIFETIME_SECONDS = 22
export const PLANNED_DAWNHEART_REVIVE_LOCKOUT_SECONDS = 45
export const PLANNED_DAWNHEART_PROGRESS = Object.freeze([0.45, 0.68] as const)

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function campaignDifficultyMultiplier(
  runMode: RunMode,
  levelId: number,
  testingSurface = false,
) {
  return runMode === 'campaign' && levelId === 1 && !testingSurface
    ? ZONE_ONE_CAMPAIGN_DIFFICULTY_MULTIPLIER
    : 1
}

function smoothstep(value: number) {
  const normalized = clamp01(value)
  return normalized * normalized * (3 - 2 * normalized)
}

/**
 * Keeps the first minute readable, then lets the horde outgrow the player's
 * compounding weapon ranks. The second phase is normalized against the boss
 * arrival rather than total duration, so every sector reaches the same authored
 * late-run pressure before its sovereign enters.
 */
export function hordePressureAt(elapsedSeconds: number, durationSeconds: number): HordePressure {
  const safeElapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0)
  const safeDuration = Math.max(1, Number.isFinite(durationSeconds) ? durationSeconds : 1)
  const progress = clamp01(safeElapsed / safeDuration)
  if (safeElapsed <= 60) {
    const warmup = smoothstep(safeElapsed / 60)
    return {
      progress,
      spawnIntensityFactor: 1.25 + warmup * 0.95,
      enemyHealthMultiplier: 0.82 + warmup * 0.18,
      enemySpeedMultiplier: 0.92 + warmup * 0.08,
      enemyDamageMultiplier: 0.82 + warmup * 0.18,
    }
  }

  const bossArrival = Math.max(61, safeDuration - 38)
  const escalation = clamp01((safeElapsed - 60) / (bossArrival - 60))
  return {
    progress,
    spawnIntensityFactor: 2.2 + escalation * 3 + escalation * escalation * 4,
    enemyHealthMultiplier: 1 + escalation * 0.55 + escalation * escalation * 1.15,
    enemySpeedMultiplier: 1 + escalation * 0.12,
    enemyDamageMultiplier: 1 + escalation * 0.55,
  }
}

export function sectorBaselineAt(
  authoredSpawnRate: number,
  authoredEnemyHealth: number,
  elapsedSeconds: number,
): SectorBaseline {
  const spawnRate = Math.max(0.1, Number.isFinite(authoredSpawnRate) ? authoredSpawnRate : 0.1)
  const enemyHealth = Math.max(
    0.1,
    Number.isFinite(authoredEnemyHealth) ? authoredEnemyHealth : 0.1,
  )
  const warmup = smoothstep(Math.max(0, elapsedSeconds) / 60)
  const openingSpawnRate = Math.min(spawnRate, 1.31)
  const openingEnemyHealth = Math.min(enemyHealth, 1.5)

  return {
    spawnRate: openingSpawnRate + (spawnRate - openingSpawnRate) * warmup,
    enemyHealth: openingEnemyHealth + (enemyHealth - openingEnemyHealth) * warmup,
  }
}

export function hordeActiveCap(levelId: number, progress: number) {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(levelId) ? levelId : 1))
  const safeProgress = clamp01(progress)
  return Math.min(
    380,
    62 + safeLevel * 16 + Math.floor(safeProgress * 80 + safeProgress * safeProgress * 95),
  )
}

const enemyUnlockProgress: Record<EnemyId, number> = {
  maskling: 0,
  shardwing: 0,
  cantor: 0.1,
  railjaw: 0.22,
  chronowisp: 0.3,
  'cinder-guard': 0.45,
}

export function eligibleEnemyPool(enemyPool: readonly EnemyId[], progress: number) {
  const safeProgress = clamp01(progress)
  const eligible = enemyPool.filter((enemyId) => safeProgress >= enemyUnlockProgress[enemyId])
  return eligible.length ? eligible : enemyPool.slice(0, 1)
}

export function experienceToNextLevel(playerLevel: number) {
  const safeLevel = Math.max(
    1,
    Math.floor(Number.isFinite(playerLevel) ? playerLevel : 1),
  )
  if (safeLevel === 1) return 12
  const base = Math.round(16 + safeLevel * 8 + safeLevel ** 1.35 * 2)
  const lateRunTax =
    safeLevel <= 8 ? 0 : Math.round(4 * (safeLevel - 8) ** 1.55)
  return base + lateRunTax
}

/**
 * Estimates sustained single-target damage instead of using horde damage,
 * which would overvalue chains and area weapons. Every power now consumes the
 * same cast-wide connected-damage budget; its targeting, coverage, control and
 * synergy remain distinct without making one visual pattern a hidden DPS tax.
 */
export function estimateBossDps({
  playerLevel,
  weapons,
  modules,
  traceMods,
  forceRank,
  bossDamageRank,
  critRank,
}: BossBuildSnapshot) {
  const moduleRanks = new Map(modules.map((module) => [module.id, module.rank]))
  let weaponDps = 0

  for (const owned of weapons) {
    const definition = WEAPONS[owned.id]
    const moduleRank = Math.max(0, Math.min(3, moduleRanks.get(definition.moduleId) ?? 0))
    weaponDps += weaponConnectedDps(
      owned,
      moduleRank,
      traceMods.includes('red-shift') ? 0.9 : 1,
    )
  }

  const critChance = Math.min(
    0.22,
    Math.max(0, critRank) * 0.015 + (traceMods.includes('nightglass') ? 0.06 : 0),
  )
  const metaMultiplier =
    (1 + Math.max(0, forceRank) * 0.02) *
    (1 + Math.max(0, bossDamageRank) * 0.08) *
    (1 + critChance * 0.75)
  const activeSkillDps =
    (4 + Math.max(1, playerLevel) * 1.1) *
    (1 + Math.min(3, traceMods.length) * 0.08)

  // Roughly 45% of horde pressure remains during a boss. Boss focus keeps the
  // estimator from treating every automatic volley as perfect sovereign uptime.
  return Math.max(20, weaponDps * metaMultiplier * 0.72 + activeSkillDps)
}

export function bossTargetTtkSeconds(levelId: number) {
  const safeLevel = Math.max(1, Math.min(10, Math.floor(Number.isFinite(levelId) ? levelId : 1)))
  return 19 + safeLevel * 1.1
}

export function bossAttackRecoverySeconds(levelId: number, phase: number) {
  const safeLevel = Math.max(1, Math.min(10, Math.floor(Number.isFinite(levelId) ? levelId : 1)))
  const safePhase = Math.max(1, Math.min(3, Math.floor(Number.isFinite(phase) ? phase : 1)))
  const phaseMultiplier = [1.12, 1, 0.86][safePhase - 1]
  const targetCasts = 9 + safeLevel

  return Math.max(
    0.98,
    Math.min(2, (bossTargetTtkSeconds(safeLevel) / targetCasts) * phaseMultiplier),
  )
}

/**
 * Reference DPS sets a predictable campaign baseline. Sublinear adaptation
 * gives mastered builds shorter fights without letting their compounding output
 * erase every phase, while the authored-health floor and hard ceiling protect
 * against degenerate inputs.
 */
export function bossHealthForBuild(baseHealth: number, estimatedDps: number, levelId: number) {
  const safeBaseHealth = Math.max(1, Number.isFinite(baseHealth) ? baseHealth : 1)
  const safeDps = Math.max(0, Number.isFinite(estimatedDps) ? estimatedDps : 0)
  const safeLevel = Math.max(1, Math.min(10, Math.floor(Number.isFinite(levelId) ? levelId : 1)))
  const referenceDps = [95, 110, 140, 155, 185, 215, 245, 295, 340, 400][safeLevel - 1]
  const powerRatio = Math.max(0.7, Math.min(6, safeDps / referenceDps))
  const adaptiveHealth =
    referenceDps *
    bossTargetTtkSeconds(safeLevel) *
    powerRatio ** 0.82 *
    1.06

  return Math.round(
    Math.max(safeBaseHealth * 1.05, Math.min(adaptiveHealth, safeBaseHealth * 16)),
  )
}

export function bossPatternForLevel(levelId: number) {
  const normalizedLevel = Math.max(1, Math.floor(Number.isFinite(levelId) ? levelId : 1))
  return (normalizedLevel - 1) % BOSS_PATTERN_COUNT
}

export function supportPickupFirstDropSeconds(difficulty: number) {
  return 44 + Math.max(1, difficulty) * 1.25
}

export function supportPickupIntervalSeconds(difficulty: number, progress: number) {
  const safeDifficulty = Math.max(1, difficulty)
  const safeProgress = Math.max(0, Math.min(1, progress))
  return 72 + safeDifficulty * 6 + safeProgress * 20
}

export function plannedDawnheartWindows(durationSeconds: number): PlannedDawnheartWindow[] {
  const safeDuration = Math.max(1, Number.isFinite(durationSeconds) ? durationSeconds : 1)
  const bossArrival = Math.max(45, safeDuration - 38)
  return PLANNED_DAWNHEART_PROGRESS.map((progress) => {
    const opensAt = bossArrival * progress
    return {
      opensAt,
      closesAt: opensAt + PLANNED_DAWNHEART_WINDOW_SECONDS,
    }
  })
}

export function canSpawnPlannedDawnheart({
  elapsed,
  hpRatio,
  activeDawnheart,
  lastReviveAt,
  window,
}: PlannedDawnheartEligibilityInput) {
  const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0)
  const safeHpRatio = clamp01(Number.isFinite(hpRatio) ? hpRatio : 1)
  const revivedRecently =
    Number.isFinite(lastReviveAt) &&
    safeElapsed - lastReviveAt < PLANNED_DAWNHEART_REVIVE_LOCKOUT_SECONDS
  return (
    safeElapsed >= window.opensAt &&
    safeElapsed <= window.closesAt &&
    safeHpRatio <= 0.52 &&
    !activeDawnheart &&
    !revivedRecently
  )
}

export function chooseSupportPickup({
  activeExperiencePickups,
  pulseCharge,
  dropIndex,
}: SupportPickupChoiceInput): SupportPickupKind | undefined {
  const eligible: SupportPickupKind[] = []
  if (activeExperiencePickups >= 18) eligible.push('gravestar')
  if (pulseCharge <= 68) eligible.push('pulse-core')
  if (eligible.length === 0) return undefined

  return eligible[Math.max(0, Math.floor(dropIndex)) % eligible.length]
}
