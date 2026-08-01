import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'
import { LIGHT_RING_PROFILES } from './lightRingSkill'
import {
  LIGHT_RING_PRIMITIVE_BUDGET,
  lightRingRenderPlan,
} from './lightRingPresentation'

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

describe('Dawnward Aegis presentation', () => {
  it('keeps its gameplay boundary readable when the full spell arsenal overlaps', () => {
    expect(runtimeSource).toContain('private readonly lightRingAdditiveGraphics')
    expect(runtimeSource).toContain('private readonly lightRingGraphics')
    expect(runtimeSource).toContain(
      'private readonly lightRingOverlayAdditiveGraphics',
    )
    expect(runtimeSource).toContain('private readonly lightRingOverlayGraphics')
    expect(runtimeSource).toContain('Math.max(0.78, energyScale)')

    const effectComposition = section(
      '      this.effectLayer.addChild(',
      '      this.app.stage.addChild(',
    )
    expect(effectComposition.indexOf('this.lightRingGraphics'))
      .toBeLessThan(effectComposition.indexOf('this.weaponVfxGraphics'))
    expect(effectComposition.indexOf('this.lightRingOverlayAdditiveGraphics'))
      .toBeGreaterThan(effectComposition.indexOf('this.weaponVfxGraphics'))
    expect(effectComposition.indexOf('this.lightRingOverlayGraphics'))
      .toBeGreaterThan(effectComposition.indexOf('this.weaponVfxGraphics'))
  })

  it('uses the authored halo material with moving rank-specific choreography', () => {
    expect(runtimeSource).toContain('HERO_MATERIAL_FRAME.halo')
    expect(runtimeSource).toContain('renderPlan.orbitBandCount')
    expect(runtimeSource).toContain('renderPlan.pulseWaveCount')
    expect(runtimeSource).toContain('renderPlan.energyKnotCount')
    expect(runtimeSource).toContain('profile.rotationSpeed')
    expect(runtimeSource).toContain('quadraticCurveTo(controlX, controlY, endX, endY)')
  })

  it('uses broken physical corona fragments instead of one closed HUD circle', () => {
    const auraSource = runtimeSource.slice(
      runtimeSource.indexOf('private drawLightRingAura('),
      runtimeSource.indexOf('private drawWeaponEffects()'),
    )
    expect(auraSource).toContain("cap: 'round'")
    expect(auraSource).toContain('Staggered, expanding wave fronts')
    expect(auraSource).not.toContain('.circle(x, y, radius)')
  })

  it('keeps every rank inside a strict desktop and mobile primitive budget', () => {
    for (const lod of ['desktop', 'mobile'] as const) {
      const plans = LIGHT_RING_PROFILES.map((profile) =>
        lightRingRenderPlan(profile, lod),
      )
      const primitiveCounts = plans.map(
        ({ estimatedPrimitiveCount }) => estimatedPrimitiveCount,
      )

      expect(primitiveCounts).toEqual(
        [...primitiveCounts].sort((left, right) => left - right),
      )
      expect(new Set(primitiveCounts).size).toBe(LIGHT_RING_PROFILES.length)
      expect(Math.max(...primitiveCounts)).toBeLessThanOrEqual(
        LIGHT_RING_PRIMITIVE_BUDGET[lod],
      )
      for (const plan of plans) {
        expect(plan.estimatedPrimitiveCount).toBeLessThanOrEqual(
          plan.primitiveBudget,
        )
      }
    }
  })

  it('routes every continuous Aegis animation through reduced motion time', () => {
    const auraSource = section(
      '  private drawLightRingAura(',
      '  private drawCombatLabWeaponEffectAccent(',
    )

    expect(auraSource).toContain(
      'const motionTime = this.motionClock * reducedMotionScale',
    )
    expect(auraSource).toContain(
      'motionTime * (0.34 + profile.rank * 0.025)',
    )
    expect(auraSource).toContain(
      'Math.sin(motionTime * (1.2 + drift) + mote * 1.71)',
    )
    expect(auraSource.match(/this\.motionClock/g)).toHaveLength(1)
  })
})
