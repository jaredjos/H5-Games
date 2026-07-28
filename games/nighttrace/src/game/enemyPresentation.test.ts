import { describe, expect, it } from 'vitest'
import { WEAPONS } from './content'
import {
  ALL_BOSS_PRESENTATION_IDS,
  ALL_ENEMY_PRESENTATION_IDS,
  BOSS_MATERIAL_TREATMENTS,
  BOSS_PRESENTATIONS,
  BOSS_RELEASE_TAIL_SECONDS,
  ENEMY_PRESENTATIONS,
  HOSTILE_CRIMSON_COLOR,
  HOSTILE_MATERIAL_FORBIDDEN_GEOMETRY,
  HOSTILE_VENOM_COLOR,
  HOSTILE_VIOLET_COLOR,
  bossImpactProgress,
  bossMaterialTreatment,
  bossPresentation,
  enemyPresentation,
  sampleHostileEnvelope,
  sampleHostileReaction,
} from './enemyPresentation'

const colorLuminance = (color: number) => {
  const red = ((color >> 16) & 0xff) / 255
  const green = ((color >> 8) & 0xff) / 255
  const blue = (color & 0xff) / 255
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

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
      expect(['crimson', 'violet', 'venom']).toContain(profile.colorFamily)
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
      expect(['crimson', 'violet', 'venom']).toContain(profile.colorFamily)
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

  it('keeps the hostile identity inside the crimson, violet, and venom language', () => {
    expect(HOSTILE_CRIMSON_COLOR).toBe(0xd9485c)
    expect(HOSTILE_VIOLET_COLOR).toBe(0x9550a8)
    expect(HOSTILE_VENOM_COLOR).toBe(0x87973b)

    const enemyFamilies = new Set(
      ALL_ENEMY_PRESENTATION_IDS.map(
        (enemyId) => enemyPresentation(enemyId).colorFamily,
      ),
    )
    const bossFamilies = new Set(
      ALL_BOSS_PRESENTATION_IDS.map(
        (bossId) => bossPresentation(bossId).colorFamily,
      ),
    )
    expect(enemyFamilies).toEqual(new Set(['crimson', 'violet']))
    expect(bossFamilies).toEqual(new Set(['crimson', 'violet', 'venom']))
    expect(bossPresentation('mire-cantor').colorFamily).toBe('venom')
  })

  it('covers every boss with a restrained physical material treatment', () => {
    expect(Object.keys(BOSS_MATERIAL_TREATMENTS))
      .toEqual([...ALL_BOSS_PRESENTATION_IDS])
    expect(Object.isFrozen(BOSS_MATERIAL_TREATMENTS)).toBe(true)

    const heroColors = new Set(
      Object.values(WEAPONS).map((weapon) => weapon.color),
    )
    const identities = new Set<string>()
    for (const bossId of ALL_BOSS_PRESENTATION_IDS) {
      const treatment = bossMaterialTreatment(bossId)
      expect(treatment.id).toBe(bossId)
      expect(treatment.materialFamily).toBe('neutral-charcoal')
      expect(treatment.geometryPolicy).toBe('grounded-material-only')
      expect(Object.isFrozen(treatment)).toBe(true)
      expect(colorLuminance(treatment.fieldTint)).toBeLessThan(0.18)
      expect(colorLuminance(treatment.laneTint)).toBeLessThan(0.16)
      expect(treatment.accentCoverage).toBeGreaterThan(0)
      expect(treatment.accentCoverage).toBeLessThanOrEqual(0.1)
      expect(heroColors.has(treatment.fieldTint), bossId).toBe(false)
      expect(heroColors.has(treatment.laneTint), bossId).toBe(false)
      expect(heroColors.has(treatment.smokeTint), bossId).toBe(false)
      expect(heroColors.has(treatment.accentColor), bossId).toBe(false)
      expect(heroColors.has(treatment.debrisTint), bossId).toBe(false)

      for (const scale of [
        treatment.fieldOpacityScale,
        treatment.laneOpacityScale,
        treatment.dustDensityScale,
        treatment.debrisDensityScale,
        treatment.debrisOpacityScale,
        treatment.debrisLiftScale,
        treatment.pressureScale,
      ]) {
        expect(Number.isFinite(scale), bossId).toBe(true)
        expect(scale, bossId).toBeGreaterThanOrEqual(0.5)
        expect(scale, bossId).toBeLessThanOrEqual(1.5)
      }
      identities.add(
        `${treatment.materialName}:${treatment.accentColor.toString(16)}`,
      )
    }
    expect(identities.size).toBe(ALL_BOSS_PRESENTATION_IDS.length)
  })

  it('declares the absolute material-geometry bans', () => {
    expect(HOSTILE_MATERIAL_FORBIDDEN_GEOMETRY).toEqual([
      'rings',
      'spokes',
      'grids',
      'outlines',
      'rails',
      'crosshairs',
      'hard-cones',
    ])
    expect(Object.isFrozen(HOSTILE_MATERIAL_FORBIDDEN_GEOMETRY)).toBe(true)
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

describe('hostile hit and death reactions', () => {
  it('keeps horde hits brief while preserving an immediate readable flash', () => {
    const impact = sampleHostileReaction({
      kind: 'hit',
      progress: 0.04,
    })
    const recovery = sampleHostileReaction({
      kind: 'hit',
      progress: 0.72,
    })

    expect(impact.phase).toBe('impact')
    expect(recovery.phase).toBe('recover')
    expect(impact.recoil).toBeGreaterThan(recovery.recoil)
    expect(impact.flashScale).toBeGreaterThan(recovery.flashScale)
    expect(impact.alpha).toBe(1)
    expect(recovery.dissolve).toBe(0)
  })

  it('gives bosses a longer rupture and later dissolve than horde deaths', () => {
    const hordeMid = sampleHostileReaction({
      kind: 'death',
      progress: 0.56,
    })
    const bossMid = sampleHostileReaction({
      kind: 'death',
      progress: 0.56,
      boss: true,
    })
    const hordeLate = sampleHostileReaction({
      kind: 'death',
      progress: 0.76,
    })
    const bossLate = sampleHostileReaction({
      kind: 'death',
      progress: 0.76,
      boss: true,
    })

    expect(hordeMid.phase).toBe('dissolve')
    expect(bossMid.phase).toBe('collapse')
    expect(bossMid.alpha).toBeGreaterThan(hordeMid.alpha)
    expect(bossLate.alpha).toBeGreaterThan(hordeLate.alpha)
    expect(bossLate.collapse).toBeGreaterThan(0.75)
  })

  it('keeps reaction channels deterministic, finite, bounded, and immutable', () => {
    const progressValues = [
      Number.NEGATIVE_INFINITY,
      0,
      0.18,
      0.5,
      0.82,
      1,
      Number.POSITIVE_INFINITY,
      Number.NaN,
    ]
    for (const kind of ['hit', 'death'] as const) {
      for (const progress of progressValues) {
        const input = {
          kind,
          progress,
          boss: true,
          reducedFlash: false,
          reducedFlashScale: 0.46,
        }
        const first = sampleHostileReaction(input)
        const second = sampleHostileReaction(input)
        expect(first).toEqual(second)
        expect(Object.isFrozen(first)).toBe(true)
        for (const value of [
          first.progress,
          first.recoil,
          first.squash,
          first.rupture,
          first.collapse,
          first.dissolve,
          first.alpha,
          first.flashScale,
        ]) {
          expect(Number.isFinite(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('reduces reaction flashes without changing physical timing', () => {
    const full = sampleHostileReaction({
      kind: 'death',
      progress: 0.18,
      boss: true,
      reducedFlashScale: 0.4,
    })
    const reduced = sampleHostileReaction({
      kind: 'death',
      progress: 0.18,
      boss: true,
      reducedFlash: true,
      reducedFlashScale: 0.4,
    })

    expect(reduced.phase).toBe(full.phase)
    expect(reduced.recoil).toBe(full.recoil)
    expect(reduced.squash).toBe(full.squash)
    expect(reduced.rupture).toBe(full.rupture)
    expect(reduced.collapse).toBe(full.collapse)
    expect(reduced.alpha).toBe(full.alpha)
    expect(reduced.flashScale).toBeCloseTo(full.flashScale * 0.4, 10)
  })
})
