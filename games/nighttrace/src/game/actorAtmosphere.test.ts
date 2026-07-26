import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createBossHostileField,
  createHeroSanctumField,
  destroyActorAtmosphereField,
  resolveBossHostileFieldParameters,
  resolveHeroSanctumParameters,
  updateBossHostileField,
  updateHeroSanctumField,
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

describe('hero sanctum parameters', () => {
  it('keeps the idle field restrained and deterministic', () => {
    const first = resolveHeroSanctumParameters({})
    const second = resolveHeroSanctumParameters({})

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      time: 0,
      intensity: 0.32,
      pulse: 0,
      facingAngle: 0,
    })
    expect(first.alphaCeiling).toBeLessThan(0.14)
    expect(Object.isFrozen(first)).toBe(true)
  })

  it('clamps energy and wraps time and direction safely', () => {
    const resolved = resolveHeroSanctumParameters({
      time: 8197,
      intensity: 4,
      pulse: -2,
      facingAngle: Math.PI * 5,
    })

    expect(resolved.time).toBe(5)
    expect(resolved.intensity).toBe(1)
    expect(resolved.pulse).toBe(0)
    expect(resolved.facingAngle).toBeCloseTo(-Math.PI)
    expect(resolved.alphaCeiling).toBeCloseTo(0.18)
  })
})

describe('hostile boss-field parameters', () => {
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
  it('creates full-resolution hero and boss filters without backbuffer capture', () => {
    const hero = createHeroSanctumField()
    const boss = createBossHostileField()

    expect(hero.kind).toBe('hero-sanctum')
    expect(boss.kind).toBe('boss-hostile')
    for (const field of [hero, boss]) {
      expect(field.filter.resolution).toBe('inherit')
      expect(field.filter.antialias).toBe('inherit')
      expect(field.filter.blendRequired).toBe(false)
      expect(field.filter.padding).toBe(0)
      expect(field.destroyed).toBe(false)
    }

    destroyActorAtmosphereField(hero)
    destroyActorAtmosphereField(boss)
  })

  it('updates uniforms from sanitized pure parameters', () => {
    const hero = createHeroSanctumField()
    const boss = createBossHostileField()

    updateHeroSanctumField(hero, {
      time: 17,
      intensity: 0.8,
      pulse: 0.6,
      facingAngle: 1.2,
    })
    updateBossHostileField(boss, {
      time: 23,
      intensity: 0.9,
      special: 1,
      attackAngle: -0.7,
      phase: 0.85,
    })

    expect(hero.uniforms.uniforms).toMatchObject({
      uTime: 17,
      uIntensity: 0.8,
      uPulse: 0.6,
    })
    expect(hero.uniforms.uniforms.uFacingAngle).toBeCloseTo(1.2)
    expect(boss.uniforms.uniforms).toMatchObject({
      uTime: 23,
      uIntensity: 0.9,
      uSpecial: 1,
      uPhase: 0.85,
    })
    expect(boss.uniforms.uniforms.uAttackAngle).toBeCloseTo(-0.7)

    destroyActorAtmosphereField(hero)
    destroyActorAtmosphereField(boss)
  })

  it('allows repeated destruction and ignores updates after destruction', () => {
    const hero = createHeroSanctumField({ intensity: 0.4 })
    const beforeDestroy = hero.uniforms.uniforms.uIntensity

    destroyActorAtmosphereField(hero)
    destroyActorAtmosphereField(hero)
    updateHeroSanctumField(hero, { intensity: 1, pulse: 1 })

    expect(hero.destroyed).toBe(true)
    expect(hero.uniforms.uniforms.uIntensity).toBe(beforeDestroy)
    expect(() => destroyActorAtmosphereField(undefined)).not.toThrow()
    expect(() => updateBossHostileField(undefined, { special: 1 })).not.toThrow()
  })
})
