import { describe, expect, it } from 'vitest'
import { distributeRemoteCastDamage } from './remoteSpellDamage'

describe('remote spell cast damage budget', () => {
  it('never exceeds the cast-wide budget when a boss and adds overlap', () => {
    const damage = distributeRemoteCastDamage(120, [
      { isBoss: true },
      { isBoss: false },
      { isBoss: false },
      { isBoss: false },
    ])

    expect(damage.reduce((total, value) => total + value, 0)).toBeCloseTo(120)
    expect(damage[0]).toBeGreaterThan(damage[1])
    expect(damage[1]).toBe(damage[2])
  })

  it('gives a lone boss the complete spell budget', () => {
    expect(distributeRemoteCastDamage(80, [{ isBoss: true }])).toEqual([80])
    expect(distributeRemoteCastDamage(80, [])).toEqual([])
  })
})
