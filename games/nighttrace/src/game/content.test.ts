import { describe, expect, it } from 'vitest'
import type { TraceModId } from '../shared/types'
import {
  GLOBAL_DIFFICULTY_MULTIPLIER,
  LEVELS,
  MODULE_SLOT_CAP,
  MODULES,
  TRACE_MOD_SLOT_CAP,
  TRACE_MODS,
  WEAPON_SLOT_CAP,
  WEAPONS,
  createSeededRng,
  createUpgradeDraft,
  formatTime,
  getLevel,
} from './content'

describe('NIGHTTRACE content catalog', () => {
  it('defines the ten-stage campaign balance curve', () => {
    expect(GLOBAL_DIFFICULTY_MULTIPLIER).toBe(1.1)
    expect(LEVELS).toHaveLength(10)
    expect(LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(new Set(LEVELS.map((level) => level.name)).size).toBe(10)
    expect(new Set(LEVELS.map((level) => level.bossId)).size).toBe(10)
    expect(LEVELS.map((level) => level.duration)).toEqual([240, 270, 300, 300, 330, 360, 360, 390, 420, 450])
    expect(LEVELS.map((level) => level.enemyHealth)).toEqual([
      0.9, 1, 1.12, 1.26, 1.42, 1.6, 1.82, 2.05, 2.3, 2.6,
    ])
    expect(LEVELS.map((level) => level.spawnRate)).toEqual([
      0.82, 0.9, 1, 1.1, 1.22, 1.34, 1.46, 1.6, 1.75, 1.9,
    ])

    for (const [index, level] of LEVELS.entries()) {
      expect(level.enemyPool.length).toBeGreaterThanOrEqual(2)
      expect(level.hazards.length).toBeGreaterThan(0)
      expect(level.reward.length).toBeGreaterThan(8)
      if (index > 0) {
        expect(level.duration).toBeGreaterThanOrEqual(LEVELS[index - 1].duration)
        expect(level.difficulty).toBeGreaterThan(LEVELS[index - 1].difficulty)
        expect(level.enemyHealth).toBeGreaterThan(LEVELS[index - 1].enemyHealth)
        expect(level.spawnRate).toBeGreaterThan(LEVELS[index - 1].spawnRate)
      }
    }
  })

  it('provides every typed weapon, module, and trace mod', () => {
    expect([WEAPON_SLOT_CAP, MODULE_SLOT_CAP, TRACE_MOD_SLOT_CAP]).toEqual([4, 4, 3])
    expect(Object.keys(WEAPONS)).toHaveLength(8)
    expect(Object.keys(MODULES)).toHaveLength(8)
    expect(Object.keys(TRACE_MODS)).toHaveLength(8)

    for (const weapon of Object.values(WEAPONS)) {
      expect(MODULES[weapon.moduleId]).toBeDefined()
      expect(weapon.awakening.length).toBeGreaterThan(4)
      expect(weapon.damage).toBeGreaterThan(0)
      expect(weapon.cooldown).toBeGreaterThan(0)
    }
  })

  it('clamps level lookup and formats stage time safely', () => {
    expect(getLevel(-5).id).toBe(1)
    expect(getLevel(6).name).toBe('Stormrail')
    expect(getLevel(99).id).toBe(10)
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(65.9)).toBe('01:05')
    expect(formatTime(450)).toBe('07:30')
    expect(formatTime(Number.NaN)).toBe('00:00')
  })
})

describe('seeded upgrade drafts', () => {
  const baseContext = {
    weapons: [{ id: 'helio-lance' as const, rank: 2 }],
    modules: [],
    traceMods: [] as TraceModId[],
    unlockedWeapons: ['helio-lance' as const, 'crescent-array' as const],
    hp: 80,
    maxHp: 100,
    shield: 40,
    maxShield: 50,
  }

  it('generates deterministic random sequences', () => {
    const first = createSeededRng('first-beacon')
    const second = createSeededRng('first-beacon')
    const other = createSeededRng('glassreed-mire')

    const firstSequence = [first.next(), first.next(), first.int(3, 9)]
    const secondSequence = [second.next(), second.next(), second.int(3, 9)]
    const otherSequence = [other.next(), other.next(), other.int(3, 9)]

    expect(firstSequence).toEqual(secondSequence)
    expect(otherSequence).not.toEqual(firstSequence)
  })

  it('always returns three unique choices for the same seed and state', () => {
    const first = createUpgradeDraft(baseContext, 7341)
    const second = createUpgradeDraft(baseContext, 7341)

    expect(first).toEqual(second)
    expect(first.options).toHaveLength(3)
    expect(new Set(first.options.map((option) => option.id)).size).toBe(3)
    expect(first.rerollAvailable).toBe(true)
  })

  it('advances an owned weapon and offers its missing synergy module', () => {
    const draft = createUpgradeDraft(baseContext, 41)

    expect(draft.options.some((option) => option.id === 'weapon:helio-lance:3')).toBe(true)
    expect(draft.options.some((option) => option.id === 'module:prism-lens:1')).toBe(true)
  })

  it('defaults omitted unlock data to owned weapons plus Helio Lance only', () => {
    const draft = createUpgradeDraft(
      {
        weapons: [{ id: 'crescent-array', rank: 2 }],
        modules: [],
        traceMods: ['closed-circuit', 'afterimage', 'crossfire'],
        excludeOptionIds: ['heal:vital-repair', 'heal:aegis-overcharge', 'heal:pulse-prime'],
      },
      73,
    )
    const offeredWeaponIds = draft.options
      .filter((option) => option.type === 'weapon')
      .map((option) => option.weaponId)

    expect(new Set(offeredWeaponIds)).toEqual(new Set(['crescent-array', 'helio-lance']))
    expect(offeredWeaponIds.every((weaponId) => weaponId === 'crescent-array' || weaponId === 'helio-lance')).toBe(
      true,
    )
  })

  it('guarantees an awakening when a mastered weapon has its module', () => {
    const draft = createUpgradeDraft(
      {
        ...baseContext,
        weapons: [{ id: 'helio-lance', rank: 5 }],
        modules: [{ id: 'prism-lens', rank: 1 }],
      },
      91,
    )

    const awakening = draft.options.find((option) => option.id === 'awaken:helio-lance')
    expect(awakening?.title).toBe('Crowned Spear')
    expect(awakening?.rarity).toBe('awakening')
  })

  it('supports trace-only drafting when the build is otherwise complete', () => {
    const draft = createUpgradeDraft(
      {
        weapons: [{ id: 'helio-lance', rank: 5, awakened: true }],
        modules: [{ id: 'prism-lens', rank: 3 }],
        traceMods: [],
        unlockedWeapons: ['helio-lance'],
        excludeOptionIds: ['heal:vital-repair', 'heal:aegis-overcharge', 'heal:pulse-prime'],
      },
      122,
    )

    expect(draft.options).toHaveLength(3)
    expect(draft.options.every((option) => option.type === 'trace')).toBe(true)
  })

  it('enforces four weapon slots, four module slots, and three trace slots', () => {
    const excludedUtilities = ['heal:vital-repair', 'heal:aegis-overcharge', 'heal:pulse-prime']
    const weaponCapped = createUpgradeDraft(
      {
        weapons: [
          { id: 'helio-lance', rank: 5, awakened: true },
          { id: 'crescent-array', rank: 5, awakened: true },
          { id: 'arc-choir', rank: 5, awakened: true },
          { id: 'rift-seeds', rank: 5, awakened: true },
        ],
        modules: [
          { id: 'prism-lens', rank: 3 },
          { id: 'gyro-crown', rank: 3 },
          { id: 'resonance-coil', rank: 3 },
          { id: 'grav-anchor', rank: 3 },
        ],
        traceMods: ['closed-circuit', 'afterimage', 'crossfire'],
        unlockedWeapons: Object.keys(WEAPONS) as (keyof typeof WEAPONS)[],
        excludeOptionIds: excludedUtilities,
      },
      201,
    )
    const moduleCapped = createUpgradeDraft(
      {
        weapons: [{ id: 'helio-lance', rank: 5, awakened: true }],
        modules: [
          { id: 'gyro-crown', rank: 3 },
          { id: 'resonance-coil', rank: 3 },
          { id: 'grav-anchor', rank: 3 },
          { id: 'guidance-filament', rank: 3 },
        ],
        traceMods: ['closed-circuit', 'afterimage', 'crossfire'],
        unlockedWeapons: ['helio-lance'],
        excludeOptionIds: excludedUtilities,
      },
      202,
    )
    const traceCapped = createUpgradeDraft(
      {
        weapons: [{ id: 'helio-lance', rank: 5, awakened: true }],
        modules: [{ id: 'prism-lens', rank: 3 }],
        traceMods: ['closed-circuit', 'afterimage', 'crossfire'],
        unlockedWeapons: ['helio-lance'],
        excludeOptionIds: excludedUtilities,
      },
      203,
    )

    expect(weaponCapped.options).toHaveLength(3)
    expect(weaponCapped.options.every((option) => option.type === 'heal')).toBe(true)
    expect(moduleCapped.options).toHaveLength(3)
    expect(moduleCapped.options.every((option) => option.type === 'heal')).toBe(true)
    expect(traceCapped.options).toHaveLength(3)
    expect(traceCapped.options.every((option) => option.type === 'heal')).toBe(true)
  })

  it('consumes one reroll and excludes the prior three cards', () => {
    const first = createUpgradeDraft(baseContext, 19)
    const second = createUpgradeDraft(
      {
        ...baseContext,
        excludeOptionIds: first.options.map((option) => option.id),
      },
      first.seed,
      true,
    )
    const firstIds = new Set(first.options.map((option) => option.id))

    expect(second.options).toHaveLength(3)
    expect(second.options.every((option) => !firstIds.has(option.id))).toBe(true)
    expect(second.rerollsUsed).toBe(1)
    expect(second.rerollAvailable).toBe(false)
  })

  it('rejects a second reroll after the run reroll is spent', () => {
    expect(() =>
      createUpgradeDraft(
        {
          ...baseContext,
          rerollsUsed: 1,
          excludeOptionIds: ['weapon:helio-lance:3'],
        },
        331,
        true,
      ),
    ).toThrow(RangeError)
  })

  it('returns three valid recovery choices when a saturated build exhausts fresh cards', () => {
    const draft = createUpgradeDraft(
      {
        weapons: [
          { id: 'helio-lance', rank: 5, awakened: true },
          { id: 'crescent-array', rank: 5, awakened: true },
          { id: 'arc-choir', rank: 5, awakened: true },
          { id: 'rift-seeds', rank: 5, awakened: true },
        ],
        modules: [
          { id: 'prism-lens', rank: 3 },
          { id: 'gyro-crown', rank: 3 },
          { id: 'resonance-coil', rank: 3 },
          { id: 'grav-anchor', rank: 3 },
        ],
        traceMods: ['closed-circuit', 'afterimage', 'crossfire'],
        unlockedWeapons: Object.keys(WEAPONS) as (keyof typeof WEAPONS)[],
        excludeOptionIds: ['heal:vital-repair', 'heal:aegis-overcharge', 'heal:pulse-prime'],
      },
      404,
      true,
    )

    expect(draft.options).toHaveLength(3)
    expect(new Set(draft.options.map((option) => option.id)).size).toBe(3)
    expect(draft.options.every((option) => option.type === 'heal')).toBe(true)
    expect(draft.rerollsUsed).toBe(1)
    expect(draft.rerollAvailable).toBe(false)
  })
})
