import { describe, expect, it } from 'vitest'
import type { RunResult } from '../shared/types'
import {
  DEFAULT_SAVE,
  SAVE_KEY,
  applyPersistentReward,
  calculateRunReward,
  createDefaultSave,
  getEarnedMastery,
  getMasteryCount,
  getMasteryTargets,
  hasMastery,
  loadSave,
  migrateSave,
  resetSave,
  saveSave,
  type StorageLike,
} from './save'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function runResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    victory: false,
    levelId: 1,
    survivalTime: 150,
    kills: 120,
    closedLoops: 2,
    largestChain: 38,
    dawnShards: 7,
    weaponDamage: [{ id: 'helio-lance', damage: 1200 }],
    ...overrides,
  }
}

describe('versioned saves', () => {
  it('returns independent defaults when no save exists', () => {
    const storage = new MemoryStorage()
    const first = loadSave(storage)
    first.completedLevels.push(1)
    first.settings.masterVolume = 0

    const second = loadSave(storage)
    expect(second).toEqual(DEFAULT_SAVE)
    expect(second.completedLevels).toEqual([])
    expect(second.settings.masterVolume).toBe(DEFAULT_SAVE.settings.masterVolume)
  })

  it('round-trips normalized data through storage', () => {
    const storage = new MemoryStorage()
    const save = createDefaultSave()
    save.dawnShards = 321
    save.upgrades.force = 4
    save.settings.musicVolume = 0.35

    const stored = saveSave(save, storage)
    const loaded = loadSave(storage)

    expect(storage.values.has(SAVE_KEY)).toBe(true)
    expect(loaded).toEqual(stored)
    expect(loaded.dawnShards).toBe(321)
    expect(loaded.upgrades.force).toBe(4)
  })

  it('falls back safely when serialized storage is corrupt', () => {
    const storage = new MemoryStorage()
    storage.setItem(SAVE_KEY, '{definitely-not-json')
    expect(loadSave(storage)).toEqual(DEFAULT_SAVE)
  })

  it('migrates the unversioned prototype shape and repairs unlocks', () => {
    const migrated = migrateSave({
      unlockedChapter: 2,
      clearedLevels: [1, 99, 1],
      shards: 12.9,
      weaponUnlocks: ['arc-choir', 'not-a-weapon'],
      astrarium: { force: 3.8 },
      stars: { 1: ['clear', 'bogus'] },
      audio: { masterVolume: 4, musicVolume: -2, sfxVolume: 0.4 },
    })

    expect(migrated.version).toBe(2)
    expect(migrated.unlockedLevel).toBe(2)
    expect(migrated.completedLevels).toEqual([1])
    expect(migrated.dawnShards).toBe(12)
    expect(migrated.unlockedWeapons).toEqual(
      expect.arrayContaining(['helio-lance', 'crescent-array', 'arc-choir']),
    )
    expect(migrated.upgrades.force).toBe(3)
    expect(migrated.mastery[1]).toEqual(['clear'])
    expect(migrated.settings.masterVolume).toBe(1)
    expect(migrated.settings.musicVolume).toBe(0)
    expect(migrated.settings.sfxVolume).toBe(0.4)
  })

  it('starts music at 50% and migrates only the former v1 default', () => {
    expect(createDefaultSave().settings.musicVolume).toBe(0.5)
    expect(migrateSave({ version: 1, settings: { musicVolume: 0.62 } }).settings.musicVolume).toBe(0.5)
    expect(migrateSave({ version: 1, settings: { musicVolume: 0.35 } }).settings.musicVolume).toBe(0.35)
    expect(migrateSave({ version: 2, settings: { musicVolume: 0.62 } }).settings.musicVolume).toBe(0.62)
    expect(migrateSave({ settings: {} }).settings.musicVolume).toBe(0.5)
  })

  it('clamps Astrarium ranks and discards unknown upgrade ids', () => {
    const migrated = migrateSave({
      upgrades: {
        vitality: 99,
        pulse: 12,
        'dawn-within': 7,
        'untrusted-relic': 88,
      },
    })

    expect(migrated.upgrades.vitality).toBe(5)
    expect(migrated.upgrades.pulse).toBe(4)
    expect(migrated.upgrades['dawn-within']).toBe(1)
    expect(migrated.upgrades['untrusted-relic']).toBeUndefined()
  })

  it('removes the persisted save on reset', () => {
    const storage = new MemoryStorage()
    saveSave({ ...createDefaultSave(), dawnShards: 500 }, storage)
    const reset = resetSave(storage)

    expect(storage.getItem(SAVE_KEY)).toBeNull()
    expect(reset).toEqual(DEFAULT_SAVE)
  })
})

describe('run rewards and mastery', () => {
  it('pays a failed run without unlocking campaign progress', () => {
    const save = createDefaultSave()
    const next = applyPersistentReward(save, runResult())

    expect(next.dawnShards).toBeGreaterThan(0)
    expect(next.completedLevels).toEqual([])
    expect(next.unlockedLevel).toBe(1)
    expect(next.unlockedWeapons).toEqual(['helio-lance'])
    expect(save.dawnShards).toBe(0)
  })

  it('unlocks the next level, weapon, and all earned mastery on victory', () => {
    const targets = getMasteryTargets(1)
    const result = runResult({
      victory: true,
      survivalTime: 240,
      kills: targets.aegisKills,
      closedLoops: targets.traceLoops,
      largestChain: targets.aegisChain,
    })
    const next = applyPersistentReward(createDefaultSave(), result)

    expect(next.completedLevels).toEqual([1])
    expect(next.unlockedLevel).toBe(2)
    expect(next.unlockedWeapons).toContain('crescent-array')
    expect(next.mastery[1]).toEqual(['clear', 'trace', 'aegis'])
    expect(getMasteryCount(next)).toBe(3)
    expect(hasMastery(next, 1, 'trace')).toBe(true)
    expect(next.dawnShards).toBeGreaterThan(result.dawnShards)
  })

  it('does not award mastery for a failed run', () => {
    const targets = getMasteryTargets(4)
    const result = runResult({
      levelId: 4,
      victory: false,
      kills: targets.aegisKills * 2,
      closedLoops: targets.traceLoops * 2,
      largestChain: targets.aegisChain * 2,
    })

    expect(getEarnedMastery(result)).toEqual([])
  })

  it('only grants first-clear and new-mastery bonuses once', () => {
    const targets = getMasteryTargets(1)
    const result = runResult({
      victory: true,
      survivalTime: 240,
      kills: targets.aegisKills,
      closedLoops: targets.traceLoops,
      largestChain: targets.aegisChain,
    })
    const firstSave = applyPersistentReward(createDefaultSave(), result)
    const repeatedReward = calculateRunReward(result, firstSave)

    expect(repeatedReward.firstClearBonus).toBe(0)
    expect(repeatedReward.masteryBonus).toBe(0)
    expect(repeatedReward.newlyEarnedMastery).toEqual([])
  })
})
