import { describe, expect, it } from 'vitest'
import {
  HERO_WEAPON_HORIZONTAL_OFFSET,
  HERO_WEAPON_VERTICAL_OFFSET,
  angleFromOriginToTarget,
  heroWeaponOrigin,
} from './heroAttackOrigin'

describe('hero weapon origin', () => {
  const player = { x: 800, y: 500 }

  it('places right- and left-facing launches at the authored weapon position', () => {
    expect(heroWeaponOrigin(player, 1)).toEqual({
      x: player.x + HERO_WEAPON_HORIZONTAL_OFFSET,
      y: player.y + HERO_WEAPON_VERTICAL_OFFSET,
    })
    expect(heroWeaponOrigin(player, -1)).toEqual({
      x: player.x - HERO_WEAPON_HORIZONTAL_OFFSET,
      y: player.y + HERO_WEAPON_VERTICAL_OFFSET,
    })
  })

  it('keeps vertical or neutral facings on the current right-facing pose', () => {
    expect(heroWeaponOrigin(player, 0)).toEqual(heroWeaponOrigin(player, 1))
  })

  it('aims from the weapon point to the selected target', () => {
    const origin = heroWeaponOrigin(player, 1)
    const target = { x: 1040, y: 420 }
    const angle = angleFromOriginToTarget(origin, target)
    const distance = Math.hypot(target.x - origin.x, target.y - origin.y)

    expect(Math.cos(angle)).toBeGreaterThan(0)
    expect(origin.x + Math.cos(angle) * distance).toBeCloseTo(target.x)
    expect(origin.y + Math.sin(angle) * distance).toBeCloseTo(target.y)
  })
})
