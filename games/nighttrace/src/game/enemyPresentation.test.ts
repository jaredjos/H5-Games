import { describe, expect, it } from 'vitest'
import { WEAPONS } from './content'
import {
  ALL_BOSS_PRESENTATION_IDS,
  ALL_ENEMY_PRESENTATION_IDS,
  BOSS_PRESENTATIONS,
  BOSS_RELEASE_TAIL_SECONDS,
  ENEMY_PRESENTATIONS,
  bossImpactProgress,
  bossPresentation,
  enemyPresentation,
  sampleHostileEnvelope,
} from './enemyPresentation'

describe('hostile presentation profiles', () => {
  it('covers every horde and boss identity with immutable report data', () => {
    expect(ALL_ENEMY_PRESENTATION_IDS).toEqual([
      'maskling',
      'shardwing',
      'cantor',
      'railjaw',
      'chronowisp',
      'cinder-guard',
    ])
    expect(ALL_BOSS_PRESENTATION_IDS).toEqual([
      'gloam-stag',
      'mire-cantor',
      'railjaw-prime',
      'mirror-matron',
      'tide-apostle',
      'storm-engine',
      'chronophage',
      'furnace-titan',
      'cartographer',
      'sun-eater',
    ])
    expect(Object.keys(ENEMY_PRESENTATIONS)).toHaveLength(6)
    expect(Object.keys(BOSS_PRESENTATIONS)).toHaveLength(10)

    for (const enemyId of ALL_ENEMY_PRESENTATION_IDS) {
      const profile = enemyPresentation(enemyId)
      expect(profile.id).toBe(enemyId)
      expect(profile.reportName.length).toBeGreaterThan(3)
      expect(profile.paletteName.length).toBeGreaterThan(3)
      expect(profile.hordeProminence).toBeGreaterThan(0)
      expect(profile.hordeProminence).toBeLessThan(1)
      expect(profile.reducedFlashScale).toBeGreaterThan(0)
      expect(profile.reducedFlashScale).toBeLessThan(1)
      expect(Object.isFrozen(profile)).toBe(true)
    }

    for (const bossId of ALL_BOSS_PRESENTATION_IDS) {
      const profile = bossPresentation(bossId)
      expect(profile.id).toBe(bossId)
      expect(profile.reportName.length).toBeGreaterThan(3)
      expect(profile.paletteName.length).toBeGreaterThan(3)
      expect(profile.bossProminence).toBeGreaterThan(1)
      expect(profile.reducedFlashScale).toBeGreaterThan(0)
      expect(profile.reducedFlashScale).toBeLessThan(1)
      expect(Object.isFrozen(profile)).toBe(true)
    }
  })

  it('gives every boss a unique motif and palette identity pair', () => {
    const identities = ALL_BOSS_PRESENTATION_IDS.map((bossId) => {
      const profile = bossPresentation(bossId)
      return `${profile.motif}:${profile.paletteName}:${profile.primaryColor.toString(16)}`
    })
    expect(new Set(identities).size).toBe(ALL_BOSS_PRESENTATION_IDS.length)
  })

  it('keeps hostile primary colors distinct from every hero weapon primary color', () => {
    const weaponColors = new Set(Object.values(WEAPONS).map((weapon) => weapon.color))
    for (const enemyId of ALL_ENEMY_PRESENTATION_IDS) {
      expect(weaponColors.has(enemyPresentation(enemyId).primaryColor), enemyId).toBe(false)
    }
    for (const bossId of ALL_BOSS_PRESENTATION_IDS) {
      expect(weaponColors.has(bossPresentation(bossId).primaryColor), bossId).toBe(false)
    }
  })

  it('stores finite Pixi-ready colors and prominence values', () => {
    const profiles = [
      ...ALL_ENEMY_PRESENTATION_IDS.map(enemyPresentation),
      ...ALL_BOSS_PRESENTATION_IDS.map(bossPresentation),
    ]
    for (const profile of profiles) {
      for (const color of [
        profile.primaryColor,
        profile.secondaryColor,
        profile.shadowColor,
        profile.impactColor,
      ]) {
        expect(Number.isInteger(color), profile.reportName).toBe(true)
        expect(color, profile.reportName).toBeGreaterThanOrEqual(0)
        expect(color, profile.reportName).toBeLessThanOrEqual(0xffffff)
      }
    }
  })
})

describe('hostile motion envelope', () => {
  it('derives boss impact progress from warning duration and release tail', () => {
    expect(bossImpactProgress(0.82)).toBeCloseTo(
      0.82 / (0.82 + BOSS_RELEASE_TAIL_SECONDS),
      10,
    )
    expect(bossImpactProgress(0.74)).toBeLessThan(bossImpactProgress(0.82))
    expect(bossImpactProgress(0.66)).toBeLessThan(bossImpactProgress(0.74))
  })

  it('orders gather, release, impact, and decay around the resolved impact', () => {
    const impactProgress = bossImpactProgress(0.74)
    const samples = [
      sampleHostileEnvelope({ progress: 0.2, impactProgress }),
      sampleHostileEnvelope({ progress: impactProgress - 0.08, impactProgress }),
      sampleHostileEnvelope({ progress: impactProgress + 0.03, impactProgress }),
      sampleHostileEnvelope({ progress: 0.94, impactProgress }),
    ]
    expect(samples.map((sample) => sample.phase)).toEqual([
      'gather',
      'release',
      'impact',
      'decay',
    ])
    expect(samples[0].gather).toBeGreaterThan(0)
    expect(samples[1].release).toBeGreaterThan(samples[1].impact)
    expect(samples[2].impact).toBeGreaterThan(samples[2].gather)
    expect(samples[3].decay).toBeGreaterThanOrEqual(0)
  })

  it('keeps every envelope channel finite, bounded, and deterministic', () => {
    const progressValues = [
      Number.NEGATIVE_INFINITY,
      0,
      0.18,
      0.46,
      0.72,
      0.82,
      1,
      Number.POSITIVE_INFINITY,
    ]
    for (const progress of progressValues) {
      const input = {
        progress,
        impactProgress: 0.75,
        reducedFlash: false,
        reducedFlashScale: 0.42,
      }
      const first = sampleHostileEnvelope(input)
      const second = sampleHostileEnvelope(input)
      expect(first).toEqual(second)
      expect(Object.isFrozen(first)).toBe(true)
      for (const value of [
        first.progress,
        first.phaseProgress,
        first.impactProgress,
        first.gather,
        first.release,
        first.impact,
        first.decay,
        first.flashScale,
      ]) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('reduces flash without altering motion phase or geometry weights', () => {
    const profile = bossPresentation('sun-eater')
    const impactProgress = bossImpactProgress(0.66)
    const progress = impactProgress + 0.02
    const full = sampleHostileEnvelope({
      progress,
      impactProgress,
      reducedFlashScale: profile.reducedFlashScale,
    })
    const reduced = sampleHostileEnvelope({
      progress,
      impactProgress,
      reducedFlash: true,
      reducedFlashScale: profile.reducedFlashScale,
    })

    expect(reduced.phase).toBe(full.phase)
    expect(reduced.gather).toBe(full.gather)
    expect(reduced.release).toBe(full.release)
    expect(reduced.impact).toBe(full.impact)
    expect(reduced.decay).toBe(full.decay)
    expect(reduced.flashScale).toBeCloseTo(
      full.flashScale * profile.reducedFlashScale,
      10,
    )
  })
})
