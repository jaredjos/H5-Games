import type { RunMode } from '../shared/types'

export const FREE_REVIVES_PER_LEVEL = 1
export const REVIVE_HEALTH_FRACTION = 0.35
export const REVIVE_INVULNERABILITY_SECONDS = 2.2
export const REVIVE_SANCTUARY_RADIUS = 240

export function initialFreeRevives(runMode: RunMode, invincible: boolean) {
  return invincible || runMode === 'combat-lab' ? 0 : FREE_REVIVES_PER_LEVEL
}

export function revivedHealth(maxHp: number) {
  const safeMaxHp = Math.max(1, Number.isFinite(maxHp) ? maxHp : 1)
  return Math.max(1, safeMaxHp * REVIVE_HEALTH_FRACTION)
}
