import { describe, expect, it } from 'vitest'
import {
  ALL_BOSS_PRESENTATION_IDS,
} from './enemyPresentation'
import {
  BOSS_TELEGRAPH_PARTICLE_KINDS,
  sampleBossTelegraphParticles,
  type BossTelegraphParticle,
} from './bossTelegraphParticles'
import {
  GROUNDED_VFX_ASSET_LODS,
  GROUNDED_VFX_STAGES,
} from './groundedVfxPresentation'
import { resolveHostileTelegraphPalette } from './hostileTelegraphPalette'

const FORBIDDEN_GEOMETRY_KEYS = new Set([
  'points',
  'segments',
  'lineWidth',
  'radius',
  'angleStart',
  'angleEnd',
  'ticks',
  'grid',
  'outline',
])

const numericValues = (particle: BossTelegraphParticle) =>
  Object.values(particle).filter(
    (value): value is number => typeof value === 'number',
  )

describe('boss telegraph particles', () => {
  it('covers every boss, stage, footprint, and LOD with bounded physical particles', () => {
    expect(BOSS_TELEGRAPH_PARTICLE_KINDS).toEqual([
      'smoke',
      'grit',
      'cinder',
    ])

    for (const bossId of ALL_BOSS_PRESENTATION_IDS) {
      for (const stage of GROUNDED_VFX_STAGES) {
        for (const lod of GROUNDED_VFX_ASSET_LODS) {
          for (const footprint of ['field', 'lane'] as const) {
            const particles = sampleBossTelegraphParticles({
              bossId,
              footprint,
              stage,
              lod,
              progress: 0.72,
              motionTime: 8.4,
              seed: 817,
            })

            expect(Object.isFrozen(particles)).toBe(true)
            expect(particles.length).toBeGreaterThan(0)
            expect(new Set(particles.map((particle) => particle.kind))).toEqual(
              new Set(['smoke', 'grit', 'cinder']),
            )
            for (const particle of particles) {
              expect(Object.isFrozen(particle)).toBe(true)
              for (const key of Object.keys(particle)) {
                expect(FORBIDDEN_GEOMETRY_KEYS.has(key), `${bossId}:${key}`).toBe(
                  false,
                )
              }
              for (const value of numericValues(particle)) {
                expect(Number.isFinite(value), `${bossId}:${stage}:${lod}`).toBe(
                  true,
                )
              }
              expect(particle.alpha).toBeGreaterThanOrEqual(0)
              expect(particle.alpha).toBeLessThanOrEqual(1)
              expect(particle.glowAlpha).toBeGreaterThanOrEqual(0)
              expect(particle.glowAlpha).toBeLessThanOrEqual(1)
              expect(particle.tint).toBeGreaterThanOrEqual(0)
              expect(particle.tint).toBeLessThanOrEqual(0xffffff)
              expect(particle.size).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })

  it('is deterministic, animated, and preserves footprint coordinate contracts', () => {
    for (const footprint of ['field', 'lane'] as const) {
      const input = {
        bossId: 'gloam-stag',
        footprint,
        stage: 'mastered',
        lod: 'desktop',
        progress: 0.72,
        motionTime: 3.5,
        seed: 127,
      } as const
      const first = sampleBossTelegraphParticles(input)
      const second = sampleBossTelegraphParticles(input)
      const later = sampleBossTelegraphParticles({
        ...input,
        motionTime: input.motionTime + 0.5,
      })

      expect(second).toEqual(first)
      expect(later).not.toEqual(first)
      for (const particle of first) {
        if (footprint === 'field') {
          expect(Math.hypot(particle.u, particle.v)).toBeLessThanOrEqual(1)
        } else {
          expect(particle.u).toBeGreaterThanOrEqual(0)
          expect(particle.u).toBeLessThanOrEqual(1)
          expect(particle.v).toBeGreaterThanOrEqual(-0.5)
          expect(particle.v).toBeLessThanOrEqual(0.5)
        }
      }
    }
  })

  it('uses fewer particles on mobile and obeys a shared frame budget', () => {
    const base = {
      bossId: 'sun-eater',
      footprint: 'field',
      stage: 'final',
      progress: 0.72,
      motionTime: 7,
      seed: 991,
    } as const
    const desktop = sampleBossTelegraphParticles({
      ...base,
      lod: 'desktop',
    })
    const mobile = sampleBossTelegraphParticles({
      ...base,
      lod: 'mobile',
    })
    const budgeted = sampleBossTelegraphParticles({
      ...base,
      lod: 'desktop',
      maxParticles: 4,
    })

    expect(mobile.length).toBeLessThan(desktop.length)
    expect(budgeted).toHaveLength(4)
  })

  it('keeps boss cues readable and gives elite horde warnings restrained physical particles', () => {
    const boss = sampleBossTelegraphParticles({
      bossId: 'gloam-stag',
      footprint: 'lane',
      stage: 'solo',
      lod: 'desktop',
      progress: 0.72,
      motionTime: 4.25,
      seed: 117,
    })
    expect(boss).toHaveLength(16)
    expect(boss.filter((particle) => particle.kind === 'cinder').length)
      .toBeGreaterThanOrEqual(3)
    expect(Math.max(...boss.map((particle) => particle.alpha)))
      .toBeGreaterThan(0.12)

    const hordePalette = resolveHostileTelegraphPalette({
      family: 'violet',
      actorColor: 0x6b355f,
      emphasis: 0.18,
    })
    const horde = sampleBossTelegraphParticles({
      palette: hordePalette,
      prominence: 'horde',
      footprint: 'field',
      stage: 'solo',
      lod: 'desktop',
      progress: 0.72,
      motionTime: 4.25,
      seed: 119,
    })
    expect(horde).toHaveLength(7)
    expect(new Set(horde.map((particle) => particle.kind))).toEqual(
      new Set(['smoke', 'grit', 'cinder']),
    )
    expect(Math.max(...horde.map((particle) => particle.alpha)))
      .toBeLessThan(Math.max(...boss.map((particle) => particle.alpha)))
  })

  it('reduces luminous energy without changing spatial placement', () => {
    const input = {
      bossId: 'mirror-matron',
      footprint: 'lane',
      stage: 'final',
      lod: 'desktop',
      progress: 0.78,
      motionTime: 6.25,
      seed: 443,
    } as const
    const normal = sampleBossTelegraphParticles(input)
    const reduced = sampleBossTelegraphParticles({
      ...input,
      reducedFlash: true,
    })

    expect(reduced).toHaveLength(normal.length)
    for (let index = 0; index < normal.length; index += 1) {
      expect(reduced[index].kind).toBe(normal[index].kind)
      expect(reduced[index].u).toBe(normal[index].u)
      expect(reduced[index].v).toBe(normal[index].v)
      expect(reduced[index].lift).toBe(normal[index].lift)
      expect(reduced[index].alpha).toBeLessThanOrEqual(normal[index].alpha)
      expect(reduced[index].glowAlpha).toBeLessThanOrEqual(
        normal[index].glowAlpha,
      )
    }
  })

  it('returns an immutable empty set outside the warning window', () => {
    const base = {
      bossId: 'gloam-stag',
      footprint: 'field',
      stage: 'solo',
      lod: 'desktop',
      motionTime: 0,
      seed: 1,
    } as const
    const before = sampleBossTelegraphParticles({
      ...base,
      progress: -0.1,
    })
    const after = sampleBossTelegraphParticles({
      ...base,
      progress: 1,
    })

    expect(before).toEqual([])
    expect(after).toEqual([])
    expect(Object.isFrozen(before)).toBe(true)
    expect(Object.isFrozen(after)).toBe(true)
  })
})
