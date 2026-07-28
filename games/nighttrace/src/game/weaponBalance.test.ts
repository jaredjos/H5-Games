import { describe, expect, it } from 'vitest'
import type { WeaponId } from '../shared/types'
import { ALL_WEAPON_IDS, WEAPONS } from './content'
import {
  NORMALIZED_WEAPON_BASE_DPS,
  weaponCastDamageBudget,
  weaponConnectedDps,
  weightedFalloffTotal,
} from './weaponBalance'

const stages = [
  { name: 'solo', rank: 1, moduleRank: 0, awakened: false },
  { name: 'combined', rank: 1, moduleRank: 1, awakened: false },
  { name: 'mastered', rank: 5, moduleRank: 0, awakened: false },
  { name: 'final', rank: 5, moduleRank: 3, awakened: true },
] as const

describe('normalized weapon damage budgets', () => {
  it('authors every base cast against the same sustained-DPS budget', () => {
    for (const weaponId of ALL_WEAPON_IDS) {
      expect(WEAPONS[weaponId].damage / WEAPONS[weaponId].cooldown)
        .toBeCloseTo(NORMALIZED_WEAPON_BASE_DPS, 5)
    }
  })

  it.each(stages)('keeps all eight $name states on one connected-DPS curve', (stage) => {
    const values = ALL_WEAPON_IDS.map((id) =>
      weaponConnectedDps(
        { id: id as WeaponId, rank: stage.rank, awakened: stage.awakened },
        stage.moduleRank,
      ),
    )
    const minimum = Math.min(...values)
    const maximum = Math.max(...values)
    expect(minimum).toBeGreaterThan(0)
    expect(maximum / minimum).toBeLessThan(1.00001)
  })

  it('is monotonic through solo, combined, mastered, and final states', () => {
    for (const id of ALL_WEAPON_IDS) {
      const values = stages.map((stage) =>
        weaponConnectedDps(
          { id, rank: stage.rank, awakened: stage.awakened },
          stage.moduleRank,
        ),
      )
      expect(values[1]).toBeGreaterThan(values[0])
      expect(values[2]).toBeGreaterThan(values[1])
      expect(values[3]).toBeGreaterThan(values[2])
      expect(
        weaponCastDamageBudget({ id, rank: 5, awakened: true }, 3),
      ).toBeGreaterThan(
        weaponCastDamageBudget({ id, rank: 1 }, 0),
      )
    }
  })

  it('normalizes chained falloff without losing the first strike', () => {
    expect(weightedFalloffTotal(1)).toBe(1)
    expect(weightedFalloffTotal(5)).toBeCloseTo(4.1)
    expect(weightedFalloffTotal(10)).toBeGreaterThan(5)
  })
})
