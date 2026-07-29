import { describe, expect, it } from 'vitest'
import type { TraceModId } from '../shared/types'
import {
  ALL_WEAPON_IDS,
  BASE_FREE_REFRESHES_PER_RUN,
  BRIGHT_DRAFT_BONUS_REFRESHES,
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
    expect(GLOBAL_DIFFICULTY_MULTIPLIER).toBe(1)
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
    expect(ALL_WEAPON_IDS).toEqual(Object.keys(WEAPONS))
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
    const spellRankUpgrade = draft.options.find(
      (option) => option.id === 'weapon:helio-lance:3',
    )

    expect(spellRankUpgrade).toBeDefined()
    expect(spellRankUpgrade?.category).toBe('Spell calibration')
    expect(draft.options.some((option) => option.id === 'module:prism-lens:1')).toBe(true)
  })

  it('guarantees a new universally available weapon in the first campaign draft', () => {
    const firstCampaignSeed = (1 * 0x9e3779b1) >>> 0
    const draft = createUpgradeDraft(
      {
        weapons: [{ id: 'helio-lance', rank: 1 }],
        modules: [],
        traceMods: [],
        hp: 100,
        maxHp: 100,
        shield: 28,
        maxShield: 28,
      },
      firstCampaignSeed,
    )
    const newWeapon = draft.options.find(
      (option) =>
        option.type === 'weapon' &&
        option.rank === 1 &&
        option.weaponId !== 'helio-lance',
    )

    expect(newWeapon?.weaponId).toBeDefined()
    expect(ALL_WEAPON_IDS).toContain(newWeapon?.weaponId)
  })

  it('makes every unowned weapon available without campaign unlock data', () => {
    const offeredWeaponIds = new Set<string>()
    for (let seed = 1; seed <= 48; seed += 1) {
      const draft = createUpgradeDraft(
        {
          weapons: [{ id: 'helio-lance', rank: 5, awakened: true }],
          modules: [{ id: 'prism-lens', rank: 3 }],
          traceMods: ['closed-circuit', 'afterimage', 'crossfire'],
          excludeOptionIds: ['heal:vital-repair', 'heal:aegis-overcharge', 'heal:pulse-prime'],
        },
        seed,
      )
      for (const option of draft.options) {
        if (option.weaponId && option.rank === 1) offeredWeaponIds.add(option.weaponId)
      }
    }

    expect(offeredWeaponIds).toEqual(
      new Set(ALL_WEAPON_IDS.filter((weaponId) => weaponId !== 'helio-lance')),
    )
  })

  it('surfaces all seven alternate starting powers across the free refresh cycle', () => {
    const freshContext = {
      weapons: [{ id: 'helio-lance' as const, rank: 1 }],
      modules: [],
      traceMods: [] as TraceModId[],
      hp: 100,
      maxHp: 100,
      shield: 28,
      maxShield: 28,
    }
    const rejectedIds = new Set<string>()
    const alternateWeapons = new Set<string>()
    let draft = createUpgradeDraft(freshContext, (1 * 0x9e3779b1) >>> 0)

    for (let refresh = 0; refresh <= BASE_FREE_REFRESHES_PER_RUN; refresh += 1) {
      for (const option of draft.options) {
        if (
          option.type === 'weapon' &&
          option.rank === 1 &&
          option.weaponId !== 'helio-lance'
        ) {
          alternateWeapons.add(option.weaponId ?? '')
        }
        rejectedIds.add(option.id)
      }
      if (refresh === BASE_FREE_REFRESHES_PER_RUN) break
      draft = createUpgradeDraft(
        {
          ...freshContext,
          rerollsUsed: refresh,
          excludeOptionIds: [...rejectedIds],
        },
        draft.seed,
        true,
      )
    }

    expect(alternateWeapons).toEqual(
      new Set(ALL_WEAPON_IDS.filter((weaponId) => weaponId !== 'helio-lance')),
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
        traceMods: [],
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
    expect(moduleCapped.options.every((option) => option.type !== 'module')).toBe(true)
    expect(traceCapped.options).toHaveLength(3)
    expect(traceCapped.options.every((option) => option.type !== 'trace')).toBe(true)
  })

  it('consumes three free refreshes and cumulatively excludes rejected cards', () => {
    let draft = createUpgradeDraft(baseContext, 19)
    const rejectedIds = new Set<string>()

    expect(draft.rerollsRemaining).toBe(BASE_FREE_REFRESHES_PER_RUN)
    for (let refresh = 1; refresh <= BASE_FREE_REFRESHES_PER_RUN; refresh += 1) {
      for (const option of draft.options) rejectedIds.add(option.id)
      draft = createUpgradeDraft(
        {
          ...baseContext,
          rerollsUsed: refresh - 1,
          excludeOptionIds: [...rejectedIds],
        },
        draft.seed,
        true,
      )

      expect(draft.options).toHaveLength(3)
      expect(draft.options.every((option) => !rejectedIds.has(option.id))).toBe(true)
      expect(draft.rerollsUsed).toBe(refresh)
      expect(draft.rerollsRemaining).toBe(BASE_FREE_REFRESHES_PER_RUN - refresh)
    }
    expect(draft.rerollAvailable).toBe(false)
  })

  it('rejects a fourth refresh after the free allowance is spent', () => {
    expect(() =>
      createUpgradeDraft(
        {
          ...baseContext,
          rerollsUsed: BASE_FREE_REFRESHES_PER_RUN,
          excludeOptionIds: ['weapon:helio-lance:3'],
        },
        331,
        true,
      ),
    ).toThrow(RangeError)
  })

  it('accepts one additional refresh when Bright Draft raises the run limit', () => {
    const rerollLimit =
      BASE_FREE_REFRESHES_PER_RUN + BRIGHT_DRAFT_BONUS_REFRESHES
    const refreshed = createUpgradeDraft(
      {
        ...baseContext,
        rerollsUsed: rerollLimit - 1,
        rerollLimit,
        excludeOptionIds: ['weapon:helio-lance:3'],
      },
      332,
      true,
    )

    expect(refreshed.rerollsUsed).toBe(rerollLimit)
    expect(refreshed.rerollsRemaining).toBe(0)
    expect(refreshed.rerollAvailable).toBe(false)
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
    expect(draft.rerollsRemaining).toBe(2)
    expect(draft.rerollAvailable).toBe(true)
  })
})
