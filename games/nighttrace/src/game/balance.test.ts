import { describe, expect, it } from 'vitest'
import {
  BOSS_PATTERN_COUNT,
  bossAttackRecoverySeconds,
  bossHealthForBuild,
  bossPatternForLevel,
  bossTargetTtkSeconds,
  chooseSupportPickup,
  eligibleEnemyPool,
  estimateBossDps,
  experienceToNextLevel,
  hordeActiveCap,
  hordePressureAt,
  sectorBaselineAt,
  supportPickupFirstDropSeconds,
  supportPickupIntervalSeconds,
} from './balance'
import { LEVELS } from './content'

describe('boss pattern progression', () => {
  it('assigns a distinct pattern to each starter sector', () => {
    const patterns = Array.from({ length: 10 }, (_, index) => bossPatternForLevel(index + 1))
    expect(BOSS_PATTERN_COUNT).toBe(10)
    expect(patterns).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(new Set(patterns).size).toBe(10)
  })
})

describe('minute-by-minute difficulty curve', () => {
  it('softens the first minute and compounds pressure before every boss', () => {
    for (const level of LEVELS) {
      const opening = hordePressureAt(0, level.duration)
      const minuteOne = hordePressureAt(60, level.duration)
      const bossAt = level.duration - 38
      const bossApproach = hordePressureAt(bossAt, level.duration)
      const oldMinuteProgress = 60 / level.duration
      const oldBossProgress = bossAt / level.duration

      expect(opening.spawnIntensityFactor).toBeCloseTo(1.25)
      expect(opening.enemyHealthMultiplier).toBeCloseTo(0.82)
      expect(minuteOne.spawnIntensityFactor).toBeLessThan(2.1 + oldMinuteProgress * 4.8)
      expect(minuteOne.enemyHealthMultiplier).toBeLessThan(1 + oldMinuteProgress * 0.72)
      expect(bossApproach.spawnIntensityFactor).toBeGreaterThan(
        (2.1 + oldBossProgress * 4.8) * 1.4,
      )
      expect(bossApproach.enemyHealthMultiplier).toBeGreaterThan(
        (1 + oldBossProgress * 0.72) * 1.6,
      )
      expect(bossApproach.enemySpeedMultiplier).toBeCloseTo(1.12)
      expect(bossApproach.enemyDamageMultiplier).toBeCloseTo(1.55)
    }
  })

  it('rises monotonically after the opening and shifts the active cap later', () => {
    for (const level of LEVELS) {
      const bossAt = level.duration - 38
      const samples = [60, (60 + bossAt) * 0.5, bossAt].map((elapsed) =>
        hordePressureAt(elapsed, level.duration),
      )
      for (let index = 1; index < samples.length; index += 1) {
        expect(samples[index].spawnIntensityFactor).toBeGreaterThan(
          samples[index - 1].spawnIntensityFactor,
        )
        expect(samples[index].enemyHealthMultiplier).toBeGreaterThan(
          samples[index - 1].enemyHealthMultiplier,
        )
        expect(samples[index].enemyDamageMultiplier).toBeGreaterThan(
          samples[index - 1].enemyDamageMultiplier,
        )
      }

      expect(hordeActiveCap(level.id, 0)).toBeLessThan(80 + level.id * 18)
      expect(hordeActiveCap(level.id, bossAt / level.duration)).toBeGreaterThan(
        80 + level.id * 18 + Math.floor((bossAt / level.duration) * 120),
      )
    }
  })

  it('keeps high-sector opening throughput within three times sector one', () => {
    const first = sectorBaselineAt(LEVELS[0].spawnRate, LEVELS[0].enemyHealth, 0)
    const final = sectorBaselineAt(LEVELS[9].spawnRate, LEVELS[9].enemyHealth, 0)
    const openingThroughputRatio =
      (final.spawnRate * final.enemyHealth) /
      (first.spawnRate * first.enemyHealth)

    expect(openingThroughputRatio).toBeLessThan(3)
    expect(final.spawnRate).toBeCloseTo(1.31)
    expect(final.enemyHealth).toBeCloseTo(1.5)
    expect(
      sectorBaselineAt(LEVELS[9].spawnRate, LEVELS[9].enemyHealth, 60),
    ).toEqual({
      spawnRate: LEVELS[9].spawnRate,
      enemyHealth: LEVELS[9].enemyHealth,
    })
  })
})

describe('late-run upgrade pacing', () => {
  it('preserves the early hook and increases late rank costs', () => {
    expect(experienceToNextLevel(1)).toBe(12)
    for (let level = 2; level <= 8; level += 1) {
      expect(experienceToNextLevel(level)).toBe(
        Math.round(16 + level * 8 + level ** 1.35 * 2),
      )
    }
    expect(experienceToNextLevel(9)).toBeGreaterThan(
      Math.round(16 + 9 * 8 + 9 ** 1.35 * 2),
    )

    const thresholds = Array.from({ length: 30 }, (_, index) =>
      experienceToNextLevel(index + 1),
    )
    for (let index = 1; index < thresholds.length; index += 1) {
      expect(thresholds[index]).toBeGreaterThan(thresholds[index - 1])
    }
  })
})

describe('enemy roster escalation', () => {
  it('holds specialist enemies until their intended run phase', () => {
    const fullPool = [
      'maskling',
      'shardwing',
      'cantor',
      'railjaw',
      'chronowisp',
      'cinder-guard',
    ] as const

    expect(eligibleEnemyPool(fullPool, 0)).toEqual(['maskling', 'shardwing'])
    expect(eligibleEnemyPool(fullPool, 0.21)).toEqual([
      'maskling',
      'shardwing',
      'cantor',
    ])
    expect(eligibleEnemyPool(fullPool, 0.45)).toEqual(fullPool)
  })
})

describe('build-aware boss durability', () => {
  const starterBuild = {
    playerLevel: 1,
    weapons: [{ id: 'helio-lance', rank: 1 }],
    modules: [],
    traceMods: [],
    forceRank: 0,
    bossDamageRank: 0,
    critRank: 0,
  } as const
  const awakenedBuild = {
    playerLevel: 8,
    weapons: [{ id: 'helio-lance', rank: 5, awakened: true }],
    modules: [{ id: 'prism-lens', rank: 1 }],
    traceMods: ['closed-circuit'],
    forceRank: 0,
    bossDamageRank: 0,
    critRank: 0,
  } as const

  it('recognizes meaningful rank, module, and awakening growth', () => {
    const starterDps = estimateBossDps(starterBuild)
    const awakenedDps = estimateBossDps(awakenedBuild)

    expect(starterDps).toBeGreaterThan(35)
    expect(awakenedDps).toBeGreaterThan(starterDps * 12)
  })

  it('targets a real fight while retaining floor and anti-sponge bounds', () => {
    const baseHealth = 1242
    const starterDps = estimateBossDps(starterBuild)
    const awakenedDps = estimateBossDps(awakenedBuild)
    const weakHealth = bossHealthForBuild(baseHealth, starterDps, 1)
    const awakenedHealth = bossHealthForBuild(baseHealth, awakenedDps, 1)

    expect(weakHealth).toBeGreaterThan(baseHealth)
    expect(awakenedHealth).toBeGreaterThan(weakHealth * 5)
    expect(awakenedHealth).toBeLessThanOrEqual(baseHealth * 16)
    expect(awakenedHealth / awakenedDps).toBeGreaterThan(12)
    expect(awakenedHealth / awakenedDps).toBeLessThan(bossTargetTtkSeconds(1))
  })

  it('keeps the intended encounter window rising across the campaign', () => {
    expect(bossTargetTtkSeconds(1)).toBeCloseTo(20.1)
    expect(bossTargetTtkSeconds(10)).toBeCloseTo(30)
  })

  it('paces longer fights without overlapping late-phase casts', () => {
    for (const level of LEVELS) {
      const phaseOne = bossAttackRecoverySeconds(level.id, 1)
      const phaseTwo = bossAttackRecoverySeconds(level.id, 2)
      const phaseThree = bossAttackRecoverySeconds(level.id, 3)

      expect(phaseOne).toBeGreaterThanOrEqual(phaseTwo)
      expect(phaseTwo).toBeGreaterThan(phaseThree)
      expect(phaseThree).toBeGreaterThanOrEqual(0.98)
      expect(phaseOne).toBeLessThanOrEqual(2)
    }
    expect(bossAttackRecoverySeconds(10, 3)).toBeGreaterThan(1.3)
  })
})

describe('support pickup pacing', () => {
  it('spaces assistance further apart as sector pressure and run time rise', () => {
    expect(supportPickupFirstDropSeconds(1)).toBe(45.25)
    expect(supportPickupFirstDropSeconds(4.8)).toBe(50)
    expect(supportPickupIntervalSeconds(4.8, 1)).toBeGreaterThan(
      supportPickupIntervalSeconds(1, 0),
    )
  })

  it('prioritizes the resource the player most needs', () => {
    expect(
      chooseSupportPickup({
        hpRatio: 0.4,
        activeExperiencePickups: 0,
        pulseCharge: 100,
        dropIndex: 0,
      }),
    ).toBe('dawnheart')
    expect(
      chooseSupportPickup({
        hpRatio: 1,
        activeExperiencePickups: 20,
        pulseCharge: 100,
        dropIndex: 0,
      }),
    ).toBe('gravestar')
    expect(
      chooseSupportPickup({
        hpRatio: 1,
        activeExperiencePickups: 0,
        pulseCharge: 12,
        dropIndex: 0,
      }),
    ).toBe('pulse-core')
    expect(
      chooseSupportPickup({
        hpRatio: 1,
        activeExperiencePickups: 4,
        pulseCharge: 100,
        dropIndex: 0,
      }),
    ).toBeUndefined()
  })
})
