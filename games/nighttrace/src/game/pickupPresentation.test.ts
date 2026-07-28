import { describe, expect, it } from 'vitest'
import {
  SUPPORT_PICKUP_LIFETIME_SECONDS,
  supportPickupPresentation,
} from './pickupPresentation'

describe('support pickup presentation', () => {
  it('builds a deterministic three-fragment beacon for each rare pickup', () => {
    for (const kind of ['dawnheart', 'gravestar', 'pulse-core'] as const) {
      const first = supportPickupPresentation(kind, 1.5, 47, {
        reducedFlash: false,
        highContrast: false,
      })
      const second = supportPickupPresentation(kind, 1.5, 47, {
        reducedFlash: false,
        highContrast: false,
      })

      expect(first).toEqual(second)
      expect(first.fragments).toHaveLength(3)
      expect(Object.isFrozen(first)).toBe(true)
      expect(Object.isFrozen(first.fragments)).toBe(true)
    }
  })

  it('opens with a bright arrival, settles, then warns before expiry', () => {
    const settings = { reducedFlash: false, highContrast: false }
    const arrival = supportPickupPresentation('gravestar', 0.3, 5, settings)
    const settled = supportPickupPresentation('gravestar', 5, 5, settings)
    const warning = supportPickupPresentation(
      'gravestar',
      SUPPORT_PICKUP_LIFETIME_SECONDS - 1,
      5,
      settings,
    )

    expect(arrival.beamCoreAlpha).toBeGreaterThan(settled.beamCoreAlpha)
    expect(arrival.beamHeight).toBeGreaterThan(settled.beamHeight)
    expect(warning.warning).toBeGreaterThan(0.8)
    expect(warning.beamCoreAlpha).toBeGreaterThan(settled.beamCoreAlpha)
  })

  it('adapts the warning beat to shorter emergency-heart lifetimes', () => {
    const warning = supportPickupPresentation('dawnheart', 21, 5, {
      reducedFlash: false,
      highContrast: false,
      lifetimeSeconds: 22,
    })

    expect(warning.warning).toBeGreaterThan(0.8)
  })

  it('honors reduced-flash and high-contrast accessibility settings', () => {
    const normal = supportPickupPresentation('pulse-core', 0.4, 9, {
      reducedFlash: false,
      highContrast: false,
    })
    const reduced = supportPickupPresentation('pulse-core', 0.4, 9, {
      reducedFlash: true,
      highContrast: false,
    })
    const contrast = supportPickupPresentation('pulse-core', 0.4, 9, {
      reducedFlash: false,
      highContrast: true,
    })

    expect(reduced.beamCoreAlpha).toBeLessThan(normal.beamCoreAlpha)
    expect(reduced.groundGlowAlpha).toBeLessThan(normal.groundGlowAlpha)
    expect(contrast.beamCoreAlpha).toBeGreaterThan(normal.beamCoreAlpha)
  })

  it('never emits NaN or out-of-range alpha from malformed inputs', () => {
    const presentation = supportPickupPresentation('dawnheart', Number.NaN, Number.NaN, {
      reducedFlash: false,
      highContrast: false,
    })

    for (const alpha of [
      presentation.beamBodyAlpha,
      presentation.beamCoreAlpha,
      presentation.groundGlowAlpha,
      presentation.fragmentAlpha,
    ]) {
      expect(Number.isFinite(alpha)).toBe(true)
      expect(alpha).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeLessThanOrEqual(1)
    }
  })
})
