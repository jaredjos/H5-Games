import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import actorAtmosphereSource from './actorAtmosphere.ts?raw'
import {
  createBossHostileField,
  destroyActorAtmosphereField,
  resolveBossHostileFieldParameters,
  updateBossHostileField,
} from './actorAtmosphere'

beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }),
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('hostile boss-field parameters', () => {
  it('uses broad material masses without thin line or diagram geometry', () => {
    const start = actorAtmosphereSource.indexOf(
      'const BOSS_HOSTILE_FRAGMENT = `',
    )
    const end = actorAtmosphereSource.indexOf(
      'const clamp01',
      start,
    )
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    const shader = actorAtmosphereSource.slice(start, end)

    for (const forbidden of [
      'fractureA',
      'fractureB',
      'veins',
      'directionalSurge',
      'sideSurge',
      'widening',
    ]) {
      expect(shader, forbidden).not.toContain(forbidden)
    }
    for (const materialField of [
      'smokeMass',
      'compressedStone',
      'pressureMass',
      'disturbedRubble',
    ]) {
      expect(shader, materialField).toContain(materialField)
    }
  })

  it('raises the restrained idle ceiling for a special attack', () => {
    const idle = resolveBossHostileFieldParameters({
      intensity: 0.55,
      phase: 0.75,
      special: 0,
    })
    const special = resolveBossHostileFieldParameters({
      intensity: 0.55,
      phase: 0.75,
      special: 1,
    })

    expect(idle.alphaCeiling).toBeLessThan(0.2)
    expect(special.alphaCeiling).toBeGreaterThan(idle.alphaCeiling)
    expect(special.alphaCeiling - idle.alphaCeiling).toBeCloseTo(0.2)
    expect(special.alphaCeiling).toBeLessThanOrEqual(0.42)
  })

  it('normalizes malformed state without producing non-finite uniforms', () => {
    const resolved = resolveBossHostileFieldParameters({
      time: Number.NaN,
      intensity: Number.POSITIVE_INFINITY,
      special: Number.NaN,
      attackAngle: Number.NEGATIVE_INFINITY,
      phase: 9,
    })

    expect(resolved).toEqual({
      time: 0,
      intensity: 0.4,
      special: 0,
      attackAngle: 0,
      phase: 1,
      alphaCeiling: 0.184,
    })
    expect(Object.values(resolved).every(Number.isFinite)).toBe(true)
    expect(Object.isFrozen(resolved)).toBe(true)
  })
})

describe('Pixi actor atmosphere fields', () => {
  it('creates a full-resolution boss filter without backbuffer capture', () => {
    const boss = createBossHostileField()

    expect(boss.kind).toBe('boss-hostile')
    expect(boss.filter.resolution).toBe('inherit')
    expect(boss.filter.antialias).toBe('inherit')
    expect(boss.filter.blendRequired).toBe(false)
    expect(boss.filter.padding).toBe(0)
    expect(boss.destroyed).toBe(false)

    destroyActorAtmosphereField(boss)
  })

  it('updates uniforms from sanitized pure parameters', () => {
    const boss = createBossHostileField()

    updateBossHostileField(boss, {
      time: 23,
      intensity: 0.9,
      special: 1,
      attackAngle: -0.7,
      phase: 0.85,
    })

    expect(boss.uniforms.uniforms).toMatchObject({
      uTime: 23,
      uIntensity: 0.9,
      uSpecial: 1,
      uPhase: 0.85,
    })
    expect(boss.uniforms.uniforms.uAttackAngle).toBeCloseTo(-0.7)

    destroyActorAtmosphereField(boss)
  })

  it('allows repeated destruction and ignores updates after destruction', () => {
    const boss = createBossHostileField({ intensity: 0.4 })
    const beforeDestroy = boss.uniforms.uniforms.uIntensity

    destroyActorAtmosphereField(boss)
    destroyActorAtmosphereField(boss)
    updateBossHostileField(boss, { intensity: 1, special: 1 })

    expect(boss.destroyed).toBe(true)
    expect(boss.uniforms.uniforms.uIntensity).toBe(beforeDestroy)
    expect(() => destroyActorAtmosphereField(undefined)).not.toThrow()
    expect(() => updateBossHostileField(undefined, { special: 1 })).not.toThrow()
  })
})
