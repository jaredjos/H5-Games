import { describe, expect, it } from 'vitest'
import {
  GROUNDED_VFX_ASSET_LODS,
  GROUNDED_VFX_KINDS,
  GROUNDED_VFX_STAGES,
  groundedVfxCosmeticUnit,
  groundedVfxMaterialProfile,
  sampleGroundedVfxCues,
  sampleGroundedVfxPose,
  type GroundedVfxCue,
  type GroundedVfxKind,
} from './groundedVfxPresentation'
import {
  ALL_BOSS_PRESENTATION_IDS,
  bossMaterialTreatment,
} from './enemyPresentation'

const FORBIDDEN_CUE_KEYS = new Set([
  'damage',
  'target',
  'targetId',
  'hitIds',
  'points',
  'lineWidth',
  'segments',
])

const numericValues = (cue: GroundedVfxCue) =>
  Object.values(cue).filter((value): value is number => typeof value === 'number')

describe('grounded material VFX profiles', () => {
  it('covers material fields and lanes with desktop and mobile authored assets', () => {
    expect(GROUNDED_VFX_KINDS).toEqual([
      'hostile-field',
      'hostile-lane',
      'graveglass-field',
      'eclipse-lane',
    ])
    expect(GROUNDED_VFX_ASSET_LODS).toEqual(['desktop', 'mobile'])
    expect(GROUNDED_VFX_STAGES).toEqual([
      'solo',
      'combined',
      'mastered',
      'final',
    ])

    for (const kind of GROUNDED_VFX_KINDS) {
      const desktop = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'solo',
      })
      const mobile = groundedVfxMaterialProfile({
        kind,
        lod: 'mobile',
        stage: 'solo',
      })
      expect(desktop.material.assetId).toContain('desktop')
      expect(mobile.material.assetId).toContain('mobile')
      expect(desktop.material.assetId).not.toBe(mobile.material.assetId)
      expect(mobile.dust.count).toBeLessThanOrEqual(desktop.dust.count)
      expect(mobile.debris.count).toBeLessThanOrEqual(desktop.debris.count)
      expect(mobile.material.scale).toBe(desktop.material.scale)
    }
  })

  it('returns deeply frozen, bounded profiles for every supported combination', () => {
    for (const kind of GROUNDED_VFX_KINDS) {
      for (const stage of GROUNDED_VFX_STAGES) {
        for (const lod of GROUNDED_VFX_ASSET_LODS) {
          for (const boss of [false, true]) {
            for (const reducedFlash of [false, true]) {
              const profile = groundedVfxMaterialProfile({
                kind,
                stage,
                lod,
                boss,
                reducedFlash,
              })
              expect(Object.isFrozen(profile)).toBe(true)
              expect(Object.isFrozen(profile.material)).toBe(true)
              expect(Object.isFrozen(profile.dust)).toBe(true)
              expect(Object.isFrozen(profile.debris)).toBe(true)

              for (const value of [
                profile.material.opacity,
                profile.material.emission,
                profile.material.groundShadow,
                profile.material.distortion,
                profile.dust.opacity,
                profile.dust.drift,
                profile.debris.opacity,
                profile.debris.lift,
              ]) {
                expect(Number.isFinite(value), `${kind}:${stage}:${lod}`).toBe(true)
                expect(value).toBeGreaterThanOrEqual(0)
                expect(value).toBeLessThanOrEqual(1)
              }
              for (const value of [
                profile.material.scale,
                profile.dust.scale,
                profile.dust.spread,
                profile.debris.scale,
                profile.debris.spread,
              ]) {
                expect(Number.isFinite(value), `${kind}:${stage}:${lod}`).toBe(true)
                expect(value).toBeGreaterThanOrEqual(0.5)
                expect(value).toBeLessThanOrEqual(1.8)
              }
              for (const count of [profile.dust.count, profile.debris.count]) {
                expect(Number.isInteger(count)).toBe(true)
                expect(count).toBeGreaterThan(0)
                expect(count).toBeLessThanOrEqual(32)
              }
            }
          }
        }
      }
    }
  })

  it('builds Final presence with material scale and physical density', () => {
    for (const kind of [
      'graveglass-field',
      'eclipse-lane',
    ] as const satisfies readonly GroundedVfxKind[]) {
      const solo = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'solo',
      })
      const final = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'final',
      })

      expect(final.material.scale).toBeGreaterThan(solo.material.scale)
      expect(final.dust.count).toBeGreaterThan(solo.dust.count)
      expect(final.debris.count).toBeGreaterThan(solo.debris.count)
      expect(final.material.opacity).toBeGreaterThan(solo.material.opacity)
    }
  })

  it('makes bosses more physically present without changing spell profiles', () => {
    for (const kind of ['hostile-field', 'hostile-lane'] as const) {
      const standard = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'mastered',
      })
      const boss = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'mastered',
        boss: true,
      })
      expect(boss.boss).toBe(true)
      expect(boss.material.scale).toBeGreaterThan(standard.material.scale)
      expect(boss.dust.count).toBeGreaterThan(standard.dust.count)
      expect(boss.debris.count).toBeGreaterThan(standard.debris.count)
    }

    for (const kind of ['graveglass-field', 'eclipse-lane'] as const) {
      const standard = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'mastered',
      })
      const bossFlagIgnored = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'mastered',
        boss: true,
      })
      expect(bossFlagIgnored.boss).toBe(false)
      expect(bossFlagIgnored).toEqual(standard)
    }
  })

  it('applies each boss material treatment to hostile fields and lanes', () => {
    for (const bossId of ALL_BOSS_PRESENTATION_IDS) {
      const treatment = bossMaterialTreatment(bossId)
      const field = groundedVfxMaterialProfile({
        kind: 'hostile-field',
        lod: 'desktop',
        stage: 'mastered',
        bossId,
      })
      const lane = groundedVfxMaterialProfile({
        kind: 'hostile-lane',
        lod: 'desktop',
        stage: 'mastered',
        bossId,
      })

      for (const profile of [field, lane]) {
        expect(profile.boss).toBe(true)
        expect(profile.bossTreatment).toBe(treatment)
        expect(Object.isFrozen(profile.bossTreatment)).toBe(true)
        expect(profile.material.opacity).toBeGreaterThan(0)
        expect(profile.debris.count).toBeGreaterThan(0)
        expect(profile.debris.lift).toBeGreaterThan(0)
      }
      expect(field.bossTreatment?.fieldTint).toBe(treatment.fieldTint)
      expect(lane.bossTreatment?.laneTint).toBe(treatment.laneTint)
    }

    const openingBoss = groundedVfxMaterialProfile({
      kind: 'hostile-field',
      lod: 'desktop',
      stage: 'final',
      bossId: 'gloam-stag',
    })
    const finalBoss = groundedVfxMaterialProfile({
      kind: 'hostile-field',
      lod: 'desktop',
      stage: 'final',
      bossId: 'sun-eater',
    })
    expect(finalBoss.material.scale).toBeGreaterThan(
      openingBoss.material.scale,
    )
    expect(finalBoss.debris.count).toBeGreaterThanOrEqual(
      openingBoss.debris.count,
    )
    expect(finalBoss.debris.lift).toBeGreaterThan(
      openingBoss.debris.lift,
    )
  })

  it('reduces light energy without changing scale, assets, or density', () => {
    for (const kind of GROUNDED_VFX_KINDS) {
      const normal = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'final',
        boss: true,
      })
      const reduced = groundedVfxMaterialProfile({
        kind,
        lod: 'desktop',
        stage: 'final',
        boss: true,
        reducedFlash: true,
      })

      expect(reduced.material.assetId).toBe(normal.material.assetId)
      expect(reduced.material.scale).toBe(normal.material.scale)
      expect(reduced.dust.count).toBe(normal.dust.count)
      expect(reduced.debris.count).toBe(normal.debris.count)
      expect(reduced.material.opacity).toBeLessThan(normal.material.opacity)
      expect(reduced.material.emission).toBeLessThan(normal.material.emission)
      expect(reduced.dust.opacity).toBeLessThan(normal.dust.opacity)
      expect(reduced.debris.opacity).toBeLessThan(normal.debris.opacity)
    }
  })
})

describe('grounded material VFX motion', () => {
  it('samples deterministic rise, hold, impact, and decay for every cue kind', () => {
    for (const kind of GROUNDED_VFX_KINDS) {
      const before = sampleGroundedVfxPose(kind, { progress: -0.1 })
      const rise = sampleGroundedVfxPose(kind, { progress: 0.2 })
      const hold = sampleGroundedVfxPose(kind, { progress: 0.55 })
      const decay = sampleGroundedVfxPose(kind, { progress: 0.998 })
      const after = sampleGroundedVfxPose(kind, { progress: 1 })

      expect(before.visible).toBe(false)
      expect(rise.visible).toBe(true)
      expect(hold.visible).toBe(true)
      expect(decay.decay).toBeGreaterThan(0)
      expect(after.visible).toBe(false)
      expect(after.alpha).toBe(0)
      expect(sampleGroundedVfxPose(kind, { progress: 0.55 })).toEqual(hold)
      expect(Object.isFrozen(hold)).toBe(true)
    }
  })

  it('treats normalized progress and local time as equivalent', () => {
    for (const kind of GROUNDED_VFX_KINDS) {
      expect(sampleGroundedVfxPose(kind, { progress: 0.375 })).toEqual(
        sampleGroundedVfxPose(kind, {
          localTime: 0.75,
          duration: 2,
        }),
      )
    }
  })

  it('keeps every pose channel finite and bounded for malformed time inputs', () => {
    for (const kind of GROUNDED_VFX_KINDS) {
      for (const time of [
        { progress: Number.NaN },
        { progress: Number.POSITIVE_INFINITY },
        { localTime: Number.NaN, duration: 1 },
        { localTime: 1, duration: 0 },
        { localTime: -2, duration: 1 },
        { localTime: 5, duration: 1 },
      ]) {
        const pose = sampleGroundedVfxPose(kind, time)
        for (const value of [
          pose.progress,
          pose.rise,
          pose.hold,
          pose.impact,
          pose.decay,
          pose.alpha,
        ]) {
          expect(Number.isFinite(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(1)
        }
        expect(Number.isFinite(pose.scale)).toBe(true)
        expect(pose.scale).toBeGreaterThan(0)
      }
    }
  })
})

describe('grounded material, dust, and debris cues', () => {
  it('emits only frozen material, dust, and debris descriptors', () => {
    for (const kind of GROUNDED_VFX_KINDS) {
      for (const stage of GROUNDED_VFX_STAGES) {
        for (const lod of GROUNDED_VFX_ASSET_LODS) {
          for (const reducedFlash of [false, true]) {
            const cues = sampleGroundedVfxCues({
              kind,
              stage,
              lod,
              reducedFlash,
              boss: true,
              seed: 817,
              progress: 0.46,
            })

            expect(Object.isFrozen(cues)).toBe(true)
            expect(cues.map((cue) => cue.type)).toEqual([
              'material',
              'dust',
              'debris',
            ])
            for (const cue of cues) {
              expect(Object.isFrozen(cue)).toBe(true)
              for (const key of Object.keys(cue)) {
                expect(FORBIDDEN_CUE_KEYS.has(key), `${cue.type}:${key}`).toBe(false)
              }
              for (const value of numericValues(cue)) {
                expect(Number.isFinite(value)).toBe(true)
                expect(value).toBeGreaterThanOrEqual(0)
                expect(value).toBeLessThanOrEqual(
                  cue.type === 'material' && value === cue.scale ? 1.9 : 32,
                )
              }
            }
          }
        }
      }
    }
  })

  it('is deterministic and returns an immutable empty set outside the effect window', () => {
    const input = {
      kind: 'graveglass-field',
      stage: 'final',
      lod: 'desktop',
      seed: 1229,
      progress: 0.48,
    } as const
    const first = sampleGroundedVfxCues(input)
    const second = sampleGroundedVfxCues(input)

    expect(second).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)

    const before = sampleGroundedVfxCues({ ...input, progress: -0.1 })
    const after = sampleGroundedVfxCues({ ...input, progress: 1 })
    expect(before).toEqual([])
    expect(after).toEqual([])
    expect(Object.isFrozen(before)).toBe(true)
    expect(Object.isFrozen(after)).toBe(true)
  })

  it('expresses Final escalation through scale and density only', () => {
    for (const kind of ['graveglass-field', 'eclipse-lane'] as const) {
      const solo = sampleGroundedVfxCues({
        kind,
        stage: 'solo',
        lod: 'desktop',
        seed: 901,
        progress: 0.5,
      })
      const final = sampleGroundedVfxCues({
        kind,
        stage: 'final',
        lod: 'desktop',
        seed: 901,
        progress: 0.5,
      })
      const soloMaterial = solo.find((cue) => cue.type === 'material')
      const finalMaterial = final.find((cue) => cue.type === 'material')
      const soloDust = solo.find((cue) => cue.type === 'dust')
      const finalDust = final.find((cue) => cue.type === 'dust')
      const soloDebris = solo.find((cue) => cue.type === 'debris')
      const finalDebris = final.find((cue) => cue.type === 'debris')

      expect(finalMaterial?.scale).toBeGreaterThan(soloMaterial?.scale ?? 0)
      expect(finalDust?.count).toBeGreaterThan(soloDust?.count ?? 0)
      expect(finalDebris?.count).toBeGreaterThan(soloDebris?.count ?? 0)
      expect(new Set(final.map((cue) => cue.type))).toEqual(
        new Set(['material', 'dust', 'debris']),
      )
    }
  })

  it('keeps cosmetic variation deterministic and isolated by seed and channel', () => {
    const first = Array.from({ length: 32 }, (_, index) =>
      groundedVfxCosmeticUnit(817, index, 3),
    )
    const second = Array.from({ length: 32 }, (_, index) =>
      groundedVfxCosmeticUnit(817, index, 3),
    )

    expect(second).toEqual(first)
    expect(new Set(first).size).toBeGreaterThan(24)
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
    expect(groundedVfxCosmeticUnit(818, 0, 3)).not.toBe(first[0])
    expect(groundedVfxCosmeticUnit(817, 0, 4)).not.toBe(first[0])
  })
})
