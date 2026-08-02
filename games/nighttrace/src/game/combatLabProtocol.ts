import type { RunConfig, RunMode } from '../shared/types'

export const COMBAT_LAB_FULL_SECTOR_BOSS_SECONDS = 60
export const COMBAT_LAB_FULL_SECTOR_OPENING_HORDE = 48

type EncounterProtocol = Pick<RunConfig, 'mode' | 'bossOnly'>

export function isCombatLabFullSector(config: EncounterProtocol) {
  return config.mode === 'combat-lab' && !config.bossOnly
}

export function openingHordeSize(config: EncounterProtocol) {
  if (config.bossOnly) return 0
  return isCombatLabFullSector(config)
    ? COMBAT_LAB_FULL_SECTOR_OPENING_HORDE
    : 4
}

export function bossArrivalSeconds(
  config: EncounterProtocol,
  levelDuration: number,
  qaMode = false,
) {
  if (isCombatLabFullSector(config)) {
    return COMBAT_LAB_FULL_SECTOR_BOSS_SECONDS
  }
  if (qaMode) return Math.min(45, levelDuration * 0.2)
  return Math.max(45, levelDuration - 38)
}

export function hasUnlimitedVitality(runMode: RunMode, invincible: boolean) {
  return runMode === 'combat-lab' && invincible
}
