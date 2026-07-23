import type { RunResult, SaveData, TraceModId, WeaponId } from '../shared/types'
import { LEVELS, WEAPONS, getLevel } from './content'

export const SAVE_VERSION = 1
export const SAVE_KEY = 'nighttrace.save.v1'

export type MasteryId = 'clear' | 'trace' | 'aegis'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface MasteryTargets {
  traceLoops: number
  aegisChain: number
  aegisKills: number
}

export interface RunRewardSummary {
  dawnShards: number
  pickupShards: number
  outcomeBonus: number
  firstClearBonus: number
  performanceBonus: number
  masteryBonus: number
  earnedMastery: MasteryId[]
  newlyEarnedMastery: MasteryId[]
}

const DEFAULT_SETTINGS: SaveData['settings'] = {
  masterVolume: 0.85,
  musicVolume: 0.62,
  sfxVolume: 0.82,
  reducedFlash: false,
  reducedShake: false,
  highContrastPickups: false,
  showDamageNumbers: true,
  autoPulse: false,
}

export const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  unlockedLevel: 1,
  completedLevels: [],
  mastery: {},
  dawnShards: 0,
  upgrades: {
    vitality: 0,
    force: 0,
    aegis: 0,
    magnetism: 0,
    pulse: 0,
    'bright-draft': 0,
    'red-shift': 0,
    'parallax-eye': 0,
    'echo-chamber': 0,
    'dawn-within': 0,
  },
  unlockedWeapons: ['helio-lance'],
  settings: DEFAULT_SETTINGS,
}

const CLEAR_REWARDS = [45, 60, 78, 96, 118, 142, 168, 205, 255, 360] as const
const MASTERY_IDS: MasteryId[] = ['clear', 'trace', 'aegis']
const VALID_WEAPONS = new Set(Object.keys(WEAPONS) as WeaponId[])
const UPGRADE_RANK_CAPS = {
  vitality: 5,
  aegis: 5,
  force: 5,
  pulse: 4,
  magnetism: 4,
  'bright-draft': 1,
  'red-shift': 4,
  'parallax-eye': 3,
  'echo-chamber': 3,
  'dawn-within': 1,
} as const

function cloneSave(save: SaveData): SaveData {
  return {
    ...save,
    completedLevels: [...save.completedLevels],
    mastery: Object.fromEntries(
      Object.entries(save.mastery).map(([levelId, mastery]) => [Number(levelId), [...mastery]]),
    ),
    upgrades: { ...save.upgrades },
    unlockedWeapons: [...save.unlockedWeapons],
    settings: { ...save.settings },
  }
}

export function createDefaultSave(): SaveData {
  return cloneSave(DEFAULT_SAVE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => nonNegativeInteger(item, -1)).filter((item) => item >= 1 && item <= LEVELS.length))]
    .sort((left, right) => left - right)
}

function weaponArray(value: unknown): WeaponId[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter((item): item is WeaponId => typeof item === 'string' && VALID_WEAPONS.has(item as WeaponId)),
    ),
  ]
}

function normalizeSettings(value: unknown): SaveData['settings'] {
  const source = isRecord(value) ? value : {}
  return {
    masterVolume: clamp(finiteNumber(source.masterVolume, DEFAULT_SETTINGS.masterVolume), 0, 1),
    musicVolume: clamp(finiteNumber(source.musicVolume, DEFAULT_SETTINGS.musicVolume), 0, 1),
    sfxVolume: clamp(finiteNumber(source.sfxVolume, DEFAULT_SETTINGS.sfxVolume), 0, 1),
    reducedFlash: booleanValue(source.reducedFlash, DEFAULT_SETTINGS.reducedFlash),
    reducedShake: booleanValue(source.reducedShake, DEFAULT_SETTINGS.reducedShake),
    highContrastPickups: booleanValue(source.highContrastPickups, DEFAULT_SETTINGS.highContrastPickups),
    showDamageNumbers: booleanValue(source.showDamageNumbers, DEFAULT_SETTINGS.showDamageNumbers),
    autoPulse: booleanValue(source.autoPulse, DEFAULT_SETTINGS.autoPulse),
  }
}

function normalizeUpgrades(value: unknown): Record<string, number> {
  const defaults: Record<string, number> = Object.fromEntries(
    Object.keys(UPGRADE_RANK_CAPS).map((upgradeId) => [upgradeId, 0]),
  )
  if (!isRecord(value)) return defaults

  for (const [upgradeId, maxRank] of Object.entries(UPGRADE_RANK_CAPS)) {
    defaults[upgradeId] = clamp(nonNegativeInteger(value[upgradeId]), 0, maxRank)
  }
  return defaults
}

function normalizeMastery(value: unknown): SaveData['mastery'] {
  if (!isRecord(value)) return {}
  const mastery: SaveData['mastery'] = {}

  for (const [rawLevelId, rawMastery] of Object.entries(value)) {
    const levelId = Number(rawLevelId)
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > LEVELS.length || !Array.isArray(rawMastery)) continue
    const valid = [
      ...new Set(
        rawMastery.filter(
          (item): item is MasteryId => typeof item === 'string' && MASTERY_IDS.includes(item as MasteryId),
        ),
      ),
    ]
    if (valid.length > 0) mastery[levelId] = valid
  }

  return mastery
}

/**
 * Accepts v1 data as well as the unversioned prototype shape used by early
 * NIGHTTRACE builds. Unknown fields are intentionally ignored.
 */
export function migrateSave(value: unknown): SaveData {
  const source = isRecord(value) ? value : {}
  const completedLevels = numberArray(source.completedLevels ?? source.clearedLevels)
  const rawUnlockedLevel = nonNegativeInteger(source.unlockedLevel ?? source.unlockedChapter, 1)
  const inferredUnlock =
    completedLevels.length === 0 ? 1 : Math.min(LEVELS.length, Math.max(...completedLevels) + 1)
  const unlockedLevel = clamp(Math.max(1, rawUnlockedLevel, inferredUnlock), 1, LEVELS.length)

  const unlockedWeapons = new Set<WeaponId>([
    'helio-lance',
    ...weaponArray(source.unlockedWeapons ?? source.weaponUnlocks),
  ])
  for (const levelId of completedLevels) {
    const weaponId = getLevel(levelId).unlockWeapon
    if (weaponId) unlockedWeapons.add(weaponId)
  }

  const settingsSource =
    source.settings ??
    source.audio ?? {
      masterVolume: source.masterVolume,
      musicVolume: source.musicVolume,
      sfxVolume: source.sfxVolume,
    }

  return {
    version: SAVE_VERSION,
    unlockedLevel,
    completedLevels,
    mastery: normalizeMastery(source.mastery ?? source.stars),
    dawnShards: nonNegativeInteger(source.dawnShards ?? source.shards ?? source.currency),
    upgrades: normalizeUpgrades(source.upgrades ?? source.astrarium),
    unlockedWeapons: [...unlockedWeapons],
    settings: normalizeSettings(settingsSource),
  }
}

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function loadSave(storage?: StorageLike): SaveData {
  const target = resolveStorage(storage)
  if (!target) return createDefaultSave()

  try {
    const serialized = target.getItem(SAVE_KEY)
    if (!serialized) return createDefaultSave()
    return migrateSave(JSON.parse(serialized) as unknown)
  } catch {
    return createDefaultSave()
  }
}

export function saveSave(save: SaveData, storage?: StorageLike): SaveData {
  const normalized = migrateSave(save)
  const target = resolveStorage(storage)
  if (target) {
    try {
      target.setItem(SAVE_KEY, JSON.stringify(normalized))
    } catch {
      // Storage can be unavailable in privacy mode. The in-memory result is
      // still returned so the current session continues without crashing.
    }
  }
  return normalized
}

export function resetSave(storage?: StorageLike): SaveData {
  const target = resolveStorage(storage)
  if (target) {
    try {
      target.removeItem(SAVE_KEY)
    } catch {
      // See saveSave: an inaccessible store must not block a fresh session.
    }
  }
  return createDefaultSave()
}

export function getMasteryTargets(levelId: number): MasteryTargets {
  const level = getLevel(levelId)
  return {
    traceLoops: 2 + Math.ceil(level.difficulty * 1.25),
    aegisChain: 30 + Math.round(level.difficulty * 18),
    aegisKills: Math.round(level.duration * level.spawnRate * 0.58),
  }
}

export function getEarnedMastery(result: RunResult): MasteryId[] {
  if (!result.victory) return []
  const targets = getMasteryTargets(result.levelId)
  const earned: MasteryId[] = ['clear']
  if (result.closedLoops >= targets.traceLoops) earned.push('trace')
  if (result.largestChain >= targets.aegisChain && result.kills >= targets.aegisKills) earned.push('aegis')
  return earned
}

export function getLevelMastery(save: SaveData, levelId: number): MasteryId[] {
  return [...(save.mastery[levelId] ?? [])]
}

export function hasMastery(save: SaveData, levelId: number, masteryId: MasteryId): boolean {
  return save.mastery[levelId]?.includes(masteryId) ?? false
}

export function getMasteryCount(save: SaveData): number {
  return Object.values(save.mastery).reduce((count, mastery) => count + mastery.length, 0)
}

export function calculateRunReward(result: RunResult, previousSave?: SaveData): RunRewardSummary {
  const level = getLevel(result.levelId)
  const clearReward = CLEAR_REWARDS[level.id - 1]
  const pickupShards = nonNegativeInteger(result.dawnShards)
  const performanceBonus = Math.min(
    80,
    Math.floor(nonNegativeInteger(result.kills) / 75) +
      nonNegativeInteger(result.closedLoops) * 2 +
      Math.floor(nonNegativeInteger(result.largestChain) / 40),
  )
  const outcomeBonus = result.victory ? clearReward : Math.max(5, Math.floor(clearReward * 0.2))
  const firstClearBonus =
    result.victory && previousSave && !previousSave.completedLevels.includes(level.id)
      ? Math.ceil(clearReward * 0.45)
      : 0
  const earnedMastery = getEarnedMastery(result)
  const existingMastery = new Set(previousSave?.mastery[level.id] ?? [])
  const newlyEarnedMastery = earnedMastery.filter((mastery) => !existingMastery.has(mastery))
  const masteryBonus = newlyEarnedMastery.length * (8 + level.id * 2)

  return {
    dawnShards: pickupShards + outcomeBonus + firstClearBonus + performanceBonus + masteryBonus,
    pickupShards,
    outcomeBonus,
    firstClearBonus,
    performanceBonus,
    masteryBonus,
    earnedMastery,
    newlyEarnedMastery,
  }
}

/**
 * Applies campaign progression immutably. Failed runs keep their earned and
 * performance shards, while only victories unlock chapters, weapons, and
 * mastery seals.
 */
export function applyPersistentReward(save: SaveData, result: RunResult): SaveData {
  const current = migrateSave(save)
  const reward = calculateRunReward(result, current)
  const next = cloneSave(current)
  next.dawnShards += reward.dawnShards

  if (!result.victory) return next

  const level = getLevel(result.levelId)
  if (!next.completedLevels.includes(level.id)) {
    next.completedLevels = [...next.completedLevels, level.id].sort((left, right) => left - right)
  }
  next.unlockedLevel = Math.max(next.unlockedLevel, Math.min(LEVELS.length, level.id + 1))

  if (level.unlockWeapon && !next.unlockedWeapons.includes(level.unlockWeapon)) {
    next.unlockedWeapons = [...next.unlockedWeapons, level.unlockWeapon]
  }

  const mastery = new Set<MasteryId>(next.mastery[level.id] ?? [])
  for (const masteryId of reward.earnedMastery) mastery.add(masteryId)
  next.mastery = { ...next.mastery, [level.id]: MASTERY_IDS.filter((masteryId) => mastery.has(masteryId)) }

  return next
}

// Keeps this module's public vocabulary discoverable for UI code that renders
// trace-mod summaries next to persistent mastery. The type itself remains
// sourced from shared/types.ts.
export type PersistentTraceModId = TraceModId
