import type { Vec2 } from '../shared/types'

/**
 * The runtime player point is authored at the hero's feet. Direct spell
 * emissions need a separate visual/physical launch point at the Dawncaster.
 *
 * These offsets are measured from the approved discharge frame: the weapon
 * mirrors horizontally with the hero, but does not rotate around the foot root.
 */
export const HERO_WEAPON_HORIZONTAL_OFFSET = 47
export const HERO_WEAPON_VERTICAL_OFFSET = -50

export function heroWeaponOrigin(player: Vec2, facingX: number): Vec2 {
  const facing = facingX < 0 ? -1 : 1
  return {
    x: player.x + facing * HERO_WEAPON_HORIZONTAL_OFFSET,
    y: player.y + HERO_WEAPON_VERTICAL_OFFSET,
  }
}

export function angleFromOriginToTarget(origin: Vec2, target: Vec2) {
  return Math.atan2(target.y - origin.y, target.x - origin.x)
}
