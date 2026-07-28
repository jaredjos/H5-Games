import type { OwnedWeapon, WeaponId } from '../shared/types'
import { WEAPONS } from './content'

export const NORMALIZED_WEAPON_BASE_DPS = 52
export const NORMALIZED_MODULE_DAMAGE_PER_RANK = 0.08

const clampRank = (rank: number, maximum: number) =>
  Math.max(0, Math.min(maximum, Math.floor(Number.isFinite(rank) ? rank : 0)))

export function weaponRankDamageMultiplier(rank: number) {
  return 1 + Math.max(0, clampRank(rank, 5) - 1) * 0.31
}

export function weaponModuleDamageMultiplier(moduleRank: number) {
  return 1 + clampRank(moduleRank, 3) * NORMALIZED_MODULE_DAMAGE_PER_RANK
}

export function weaponCooldownSeconds(
  weaponId: WeaponId,
  rank: number,
  moduleRank: number,
  awakened: boolean,
  cadenceScale = 1,
) {
  const definition = WEAPONS[weaponId]
  const safeRank = Math.max(1, clampRank(rank, 5))
  const safeModuleRank = clampRank(moduleRank, 3)
  return (
    definition.cooldown *
    Math.max(0.45, 1 - (safeRank - 1) * 0.055 - safeModuleRank * 0.035) *
    (awakened ? 0.68 : 1) *
    Math.max(0.2, Number.isFinite(cadenceScale) ? cadenceScale : 1)
  )
}

/**
 * The value returned here is a cast-wide damage budget, not per projectile.
 * Runtime weapon choreography distributes this budget across every connected
 * projectile, chain link, piercing hit, spire, or execution gate. That keeps
 * all eight powers on one sustained-damage curve while preserving different
 * targeting, control, and synergy identities.
 */
export function weaponCastDamageBudget(
  owned: OwnedWeapon,
  moduleRank: number,
) {
  const definition = WEAPONS[owned.id]
  return (
    definition.damage *
    weaponRankDamageMultiplier(owned.rank) *
    weaponModuleDamageMultiplier(moduleRank) *
    (owned.awakened ? 1.5 : 1)
  )
}

export function weaponConnectedDps(
  owned: OwnedWeapon,
  moduleRank: number,
  cadenceScale = 1,
) {
  return (
    weaponCastDamageBudget(owned, moduleRank) /
    weaponCooldownSeconds(
      owned.id,
      owned.rank,
      moduleRank,
      Boolean(owned.awakened),
      cadenceScale,
    )
  )
}

export function weightedFalloffTotal(
  count: number,
  minimum = 0.48,
  step = 0.09,
) {
  const safeCount = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1))
  let total = 0
  for (let index = 0; index < safeCount; index += 1) {
    total += Math.max(minimum, 1 - index * step)
  }
  return total
}

