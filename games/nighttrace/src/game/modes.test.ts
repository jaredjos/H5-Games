import { describe, expect, it } from 'vitest'
import type { StartingLoadout, WeaponId } from '../shared/types'
import {
  GLOBAL_DIFFICULTY_MULTIPLIER,
  LEVELS,
  MODULES,
  TRACE_MODS,
  WEAPONS,
} from './content'
import { bossHealthForBuild, estimateBossDps } from './balance'
import {
  BOSS_TRIAL_LOADOUTS,
  BOSS_TRIAL_PLAYER_LEVELS,
  COMBAT_LAB_ARENAS,
  COMBAT_LAB_BOSSES,
  COMBAT_LAB_BOSS_HEALTH_MAX,
  COMBAT_LAB_BOSS_HEALTH_MIN,
  COMBAT_LAB_PLAYER_LEVEL_MAX,
  COMBAT_LAB_PRESETS,
  DEFAULT_COMBAT_LAB_CONFIG,
  advanceBossTrialProgress,
  buildBossTrialRunConfig,
  buildCombatLabRunConfig,
  getBossTrialLoadout,
  getBossTrialUnlockedLevel,
  getCombatLabPresetLoadout,
  isBossTrialUnlocked,
  normalizeBossTrialClears,
  normalizeCombatLabConfig,
  normalizeStartingLoadout,
  resolveArenaLevel,
  resolveBossLevel,
} from './modes'

describe('starting-loadout normalization', () => {
  it('clamps ranks, removes unknown entries, and merges duplicates at their highest rank', () => {
    const source = {
      weapons: [
        { id: 'helio-lance', rank: 0, awakened: true },
        { id: 'helio-lance', rank: 99, branch: 'hunter' },
        { id: 'arc-choir', rank: 3, awakened: true },
        { id: 'not-a-weapon', rank: 5 },
      ],
      modules: [
        { id: 'prism-lens', rank: 99 },
        { id: 'prism-lens', rank: 2 },
        { id: 'resonance-coil', rank: 0 },
        { id: 'not-a-module', rank: 3 },
      ],
      traceMods: [
        'closed-circuit',
        'closed-circuit',
        'afterimage',
        'not-a-trace',
      ],
    }
    const original = structuredClone(source)

    expect(normalizeStartingLoadout(source)).toEqual({
      weapons: [
        {
          id: 'helio-lance',
          rank: 5,
          branch: 'hunter',
          awakened: true,
        },
        { id: 'arc-choir', rank: 3 },
      ],
      modules: [
        { id: 'prism-lens', rank: 3 },
        { id: 'resonance-coil', rank: 1 },
      ],
      traceMods: ['closed-circuit', 'afterimage'],
    })
    expect(source).toEqual(original)
  })

  it('permits awakening only at Rank V with the paired module present', () => {
    const rankFour = normalizeStartingLoadout({
      weapons: [{ id: 'helio-lance', rank: 4, awakened: true }],
      modules: [{ id: 'prism-lens', rank: 1 }],
      traceMods: [],
    })
    const missingPair = normalizeStartingLoadout({
      weapons: [{ id: 'helio-lance', rank: 5, awakened: true }],
      modules: [{ id: 'gyro-crown', rank: 3 }],
      traceMods: [],
    })
    const valid = normalizeStartingLoadout({
      weapons: [{ id: 'helio-lance', rank: 5, awakened: true }],
      modules: [{ id: 'prism-lens', rank: 1 }],
      traceMods: [],
    })

    expect(rankFour.weapons[0].awakened).toBeUndefined()
    expect(missingPair.weapons[0].awakened).toBeUndefined()
    expect(valid.weapons[0].awakened).toBe(true)
  })

  it('falls back to a playable Rank I Helio Lance for malformed or empty input', () => {
    expect(normalizeStartingLoadout(undefined)).toEqual({
      weapons: [{ id: 'helio-lance', rank: 1 }],
      modules: [],
      traceMods: [],
    })
    expect(normalizeStartingLoadout({
      weapons: [{ id: 'unknown', rank: Number.NaN }],
      modules: 'bad',
      traceMods: {},
    })).toEqual({
      weapons: [{ id: 'helio-lance', rank: 1 }],
      modules: [],
      traceMods: [],
    })
  })
})

describe('Combat Lab presets and normalization', () => {
  it('defines the Solo, Combined, Mastered, and Final progression', () => {
    expect(COMBAT_LAB_PRESETS.map((preset) => preset.label)).toEqual([
      'Solo',
      'Combined',
      'Mastered',
      'Final',
    ])

    for (const weaponId of Object.keys(WEAPONS) as WeaponId[]) {
      const pairedModule = WEAPONS[weaponId].moduleId
      expect(getCombatLabPresetLoadout('solo', weaponId)).toEqual({
        weapons: [{ id: weaponId, rank: 1 }],
        modules: [],
        traceMods: [],
      })
      expect(getCombatLabPresetLoadout('combined', weaponId)).toEqual({
        weapons: [{ id: weaponId, rank: 1 }],
        modules: [{ id: pairedModule, rank: 1 }],
        traceMods: [],
      })
      expect(getCombatLabPresetLoadout('mastered', weaponId)).toEqual({
        weapons: [{ id: weaponId, rank: 5 }],
        modules: [],
        traceMods: [],
      })
      expect(getCombatLabPresetLoadout('final', weaponId)).toEqual({
        weapons: [{ id: weaponId, rank: 5, awakened: true }],
        modules: [{ id: pairedModule, rank: 3 }],
        traceMods: [],
      })
    }
  })

  it('provides a deterministic, playable default configuration', () => {
    expect(DEFAULT_COMBAT_LAB_CONFIG).toEqual({
      arenaLevelId: 1,
      bossLevelId: 1,
      encounter: 'boss',
      playerLevel: 1,
      bossHealthMultiplier: 1,
      loadout: {
        weapons: [{ id: 'helio-lance', rank: 1 }],
        modules: [],
        traceMods: [],
      },
    })
    expect(normalizeCombatLabConfig(undefined)).toEqual(DEFAULT_COMBAT_LAB_CONFIG)
  })

  it('clamps every numeric control and repairs malformed configuration', () => {
    const normalized = normalizeCombatLabConfig({
      arenaLevelId: 999,
      bossLevelId: -5,
      encounter: 'invalid',
      playerLevel: 999.8,
      bossHealthMultiplier: 99,
      loadout: {
        weapons: [{ id: 'null-bell', rank: -8 }],
        modules: [{ id: 'deep-capacitor', rank: 12 }],
        traceMods: ['red-shift', 'red-shift'],
      },
    })

    expect(normalized).toEqual({
      arenaLevelId: LEVELS.length,
      bossLevelId: 1,
      encounter: 'boss',
      playerLevel: COMBAT_LAB_PLAYER_LEVEL_MAX,
      bossHealthMultiplier: COMBAT_LAB_BOSS_HEALTH_MAX,
      loadout: {
        weapons: [{ id: 'null-bell', rank: 1 }],
        modules: [{ id: 'deep-capacitor', rank: 3 }],
        traceMods: ['red-shift'],
      },
    })
    expect(normalizeCombatLabConfig({
      bossHealthMultiplier: -10,
    }).bossHealthMultiplier).toBe(COMBAT_LAB_BOSS_HEALTH_MIN)
  })
})

describe('arena and sovereign resolution', () => {
  it('exposes every authored arena and every unique sovereign in level order', () => {
    expect(COMBAT_LAB_ARENAS).toHaveLength(10)
    expect(COMBAT_LAB_BOSSES).toHaveLength(10)
    expect(COMBAT_LAB_ARENAS.map((arena) => arena.levelId)).toEqual(
      LEVELS.map((level) => level.id),
    )
    expect(COMBAT_LAB_BOSSES.map((boss) => boss.bossId)).toEqual(
      LEVELS.map((level) => level.bossId),
    )
    expect(new Set(COMBAT_LAB_BOSSES.map((boss) => boss.bossId))).toHaveLength(10)
  })

  it('resolves all ten levels and safely clamps invalid identifiers', () => {
    for (const level of LEVELS) {
      expect(resolveArenaLevel(level.id)).toBe(level)
      expect(resolveBossLevel(level.id)).toBe(level)
    }
    expect(resolveArenaLevel(Number.NaN).id).toBe(1)
    expect(resolveArenaLevel(99).id).toBe(10)
    expect(resolveBossLevel(-99).id).toBe(1)
    expect(resolveBossLevel(4.9).id).toBe(4)
  })
})

describe('curated Boss Trial progression', () => {
  it('provides ten independent valid loadouts with monotonically rising output', () => {
    expect(BOSS_TRIAL_LOADOUTS).toHaveLength(10)
    expect(BOSS_TRIAL_PLAYER_LEVELS).toHaveLength(10)

    const dpsValues = LEVELS.map((level) => {
      const runConfig = buildBossTrialRunConfig(level.id)
      const loadout = runConfig.startingLoadout as StartingLoadout
      expect(loadout).toEqual(getBossTrialLoadout(level.id))
      expect(loadout.weapons.every((weapon) => weapon.id in WEAPONS)).toBe(true)
      expect(loadout.modules.every((module) => module.id in MODULES)).toBe(true)
      expect(loadout.traceMods.every((traceMod) => traceMod in TRACE_MODS)).toBe(true)

      return estimateBossDps({
        playerLevel: runConfig.playerLevel,
        weapons: loadout.weapons,
        modules: loadout.modules,
        traceMods: loadout.traceMods,
        forceRank: 0,
        bossDamageRank: 0,
        critRank: 0,
      })
    })

    for (let index = 1; index < dpsValues.length; index += 1) {
      expect(dpsValues[index]).toBeGreaterThan(dpsValues[index - 1])
    }
  })

  it('holds every curated sovereign near the intended encounter window', () => {
    for (const level of LEVELS) {
      const runConfig = buildBossTrialRunConfig(level.id)
      const loadout = runConfig.startingLoadout as StartingLoadout
      const estimatedDps = estimateBossDps({
        playerLevel: runConfig.playerLevel,
        weapons: loadout.weapons,
        modules: loadout.modules,
        traceMods: loadout.traceMods,
        forceRank: 0,
        bossDamageRank: 0,
        critRank: 0,
      })
      const authoredBaseHealth =
        1120 *
        level.enemyHealth *
        (1 + level.id * 0.12) *
        GLOBAL_DIFFICULTY_MULTIPLIER
      const health = bossHealthForBuild(
        authoredBaseHealth,
        estimatedDps,
        level.id,
      )
      const estimatedTtk = health / estimatedDps

      expect(estimatedTtk).toBeGreaterThanOrEqual(22)
      expect(estimatedTtk).toBeLessThanOrEqual(28)
    }
  })

  it('unlocks one strict contiguous step at a time', () => {
    expect(normalizeBossTrialClears(-9)).toBe(0)
    expect(normalizeBossTrialClears(99)).toBe(10)
    expect(getBossTrialUnlockedLevel(0)).toBe(1)
    expect(getBossTrialUnlockedLevel(1)).toBe(2)
    expect(getBossTrialUnlockedLevel(10)).toBe(10)
    expect(isBossTrialUnlocked(1, 0)).toBe(true)
    expect(isBossTrialUnlocked(2, 0)).toBe(false)
    expect(isBossTrialUnlocked(7, 6)).toBe(true)
    expect(isBossTrialUnlocked(8, 6)).toBe(false)
    expect(isBossTrialUnlocked(0, 10)).toBe(false)
    expect(isBossTrialUnlocked(11, 10)).toBe(false)

    expect(advanceBossTrialProgress(0, 1, true)).toBe(1)
    expect(advanceBossTrialProgress(1, 2, true)).toBe(2)
    expect(advanceBossTrialProgress(1, 1, true)).toBe(1)
    expect(advanceBossTrialProgress(1, 3, true)).toBe(1)
    expect(advanceBossTrialProgress(1, 2, false)).toBe(1)
    expect(advanceBossTrialProgress(9, 10, true)).toBe(10)
    expect(advanceBossTrialProgress(10, 10, true)).toBe(10)
  })
})

describe('RunConfig builders', () => {
  it('builds an invincible fixed-loadout Combat Lab run', () => {
    const run = buildCombatLabRunConfig({
      arenaLevelId: 8,
      bossLevelId: 3,
      encounter: 'sector',
      playerLevel: 14,
      bossHealthMultiplier: 1.75,
      loadout: getCombatLabPresetLoadout('final', 'rift-seeds'),
    })

    expect(run).toEqual({
      mode: 'combat-lab',
      arenaLevelId: 8,
      bossLevelId: 3,
      bossOnly: false,
      invincible: true,
      fixedLoadout: true,
      playerLevel: 14,
      bossHealthMultiplier: 1.75,
      startingLoadout: {
        weapons: [{ id: 'rift-seeds', rank: 5, awakened: true }],
        modules: [{ id: 'grav-anchor', rank: 3 }],
        traceMods: [],
      },
    })
  })

  it('builds a mortal boss-only trial using the selected sovereign and arena', () => {
    const run = buildBossTrialRunConfig(10)
    expect(run.mode).toBe('boss-trial')
    expect(run.arenaLevelId).toBe(10)
    expect(run.bossLevelId).toBe(10)
    expect(run.bossOnly).toBe(true)
    expect(run.invincible).toBe(false)
    expect(run.fixedLoadout).toBe(true)
    expect(run.playerLevel).toBe(12)
    expect(run.bossHealthMultiplier).toBe(1)
    expect(run.startingLoadout).toEqual(getBossTrialLoadout(10))
  })

  it('returns fresh loadout collections rather than shared preset state', () => {
    const first = buildBossTrialRunConfig(1)
    const second = buildBossTrialRunConfig(1)
    first.startingLoadout?.weapons.push({ id: 'null-bell', rank: 5 })

    expect(second.startingLoadout?.weapons).toEqual([
      { id: 'helio-lance', rank: 2 },
    ])
    expect(getBossTrialLoadout(1).weapons).toEqual([
      { id: 'helio-lance', rank: 2 },
    ])
  })
})
