import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'
import {
  TRACE_AFTERIMAGE_POINT_BONUS,
  TRACE_BASE_POINT_ALLOWANCE,
  TRACE_MEMORY_POINT_BONUS,
  pulseChargeFromExperience,
  pulseChargeFromNormalKill,
  tracePointAllowance,
  tracePulseReward,
} from './tracePulse'

describe('trace allowance', () => {
  it('starts forty percent longer and preserves every progression increment', () => {
    expect(TRACE_BASE_POINT_ALLOWANCE).toBe(101)
    expect(tracePointAllowance(0, false)).toBe(101)
    expect(tracePointAllowance(1, false) - tracePointAllowance(0, false))
      .toBe(TRACE_MEMORY_POINT_BONUS)
    expect(tracePointAllowance(0, true) - tracePointAllowance(0, false))
      .toBe(TRACE_AFTERIMAGE_POINT_BONUS)
  })

  it('normalizes malformed progression inputs', () => {
    expect(tracePointAllowance(Number.NaN, false)).toBe(101)
    expect(tracePointAllowance(-4, true)).toBe(123)
  })
})

describe('enemy-gated Pulse rewards', () => {
  const validTrace = {
    pointCount: 10,
    area: 2100,
    enemiesTrapped: 1,
  }

  it('awards no Pulse for empty, short, or undersized closures', () => {
    expect(tracePulseReward({ ...validTrace, enemiesTrapped: 0 })).toBe(0)
    expect(tracePulseReward({ ...validTrace, pointCount: 9 })).toBe(0)
    expect(tracePulseReward({ ...validTrace, area: 2099 })).toBe(0)
    expect(
      tracePulseReward({
        pointCount: Number.NaN,
        area: Number.POSITIVE_INFINITY,
        enemiesTrapped: -3,
        primedBonus: 100,
      }),
    ).toBe(0)
  })

  it('awards the existing capture curve and caps its chain component', () => {
    expect(tracePulseReward(validTrace)).toBeCloseTo(19.8)
    expect(tracePulseReward({ ...validTrace, enemiesTrapped: 100 })).toBe(63)
  })

  it('releases a primed bonus only on a successful enemy capture', () => {
    expect(
      tracePulseReward({ ...validTrace, enemiesTrapped: 0, primedBonus: 35 }),
    ).toBe(0)
    expect(tracePulseReward({ ...validTrace, primedBonus: 35 })).toBeCloseTo(54.8)
  })

  it('restores XP and normal-kill charge without adding an instant-upgrade fill', () => {
    const positiveChargeMutations = runtimeSource.match(
      /this\.player\.pulseCharge\s*=\s*clamp\(/g,
    )

    expect(positiveChargeMutations).toHaveLength(3)
    expect(runtimeSource).toContain('pulseChargeFromExperience(value)')
    expect(runtimeSource).toContain('pulseChargeFromNormalKill()')
    expect(runtimeSource).not.toContain('this.player.pulseCharge = 100')
    expect(runtimeSource).toContain('const pulseReward = tracePulseReward({')
  })

  it('uses the original XP and normal-kill charge rates safely', () => {
    expect(pulseChargeFromExperience(4)).toBeCloseTo(0.64)
    expect(pulseChargeFromExperience(-2)).toBe(0)
    expect(pulseChargeFromExperience(Number.NaN)).toBe(0)
    expect(pulseChargeFromNormalKill()).toBe(1.1)
  })
})
