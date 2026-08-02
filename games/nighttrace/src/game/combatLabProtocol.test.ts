import { describe, expect, it } from 'vitest'
import gameCanvasSource from './GameCanvas.tsx?raw'
import gameUiSource from '../ui/GameUI.tsx?raw'
import {
  COMBAT_LAB_FULL_SECTOR_BOSS_SECONDS,
  COMBAT_LAB_FULL_SECTOR_OPENING_HORDE,
  bossArrivalSeconds,
  hasUnlimitedVitality,
  openingHordeSize,
} from './combatLabProtocol'

describe('Combat Lab survival protocol', () => {
  const labSector = { mode: 'combat-lab' as const, bossOnly: false }

  it('opens Full Sector with a deliberately massive horde', () => {
    expect(openingHordeSize(labSector)).toBe(
      COMBAT_LAB_FULL_SECTOR_OPENING_HORDE,
    )
    expect(openingHordeSize({ mode: 'campaign', bossOnly: false })).toBe(4)
    expect(openingHordeSize({ mode: 'boss-trial', bossOnly: true })).toBe(0)
  })

  it('summons a Full Sector Lab boss at one minute without changing other modes', () => {
    expect(bossArrivalSeconds(labSector, 450)).toBe(
      COMBAT_LAB_FULL_SECTOR_BOSS_SECONDS,
    )
    expect(bossArrivalSeconds(labSector, 450, true)).toBe(60)
    expect(
      bossArrivalSeconds({ mode: 'campaign', bossOnly: false }, 240),
    ).toBe(202)
    expect(
      bossArrivalSeconds({ mode: 'campaign', bossOnly: false }, 240, true),
    ).toBe(45)
  })

  it('shows infinity only for an invincible Combat Lab run', () => {
    expect(hasUnlimitedVitality('combat-lab', true)).toBe(true)
    expect(hasUnlimitedVitality('combat-lab', false)).toBe(false)
    expect(hasUnlimitedVitality('campaign', true)).toBe(false)
    expect(hasUnlimitedVitality('boss-trial', true)).toBe(false)
  })

  it('wires the Lab-only timings and opening density into the runtime', () => {
    expect(gameCanvasSource).toContain('openingHordeSize(this.runConfig)')
    expect(gameCanvasSource).toContain('bossArrivalSeconds(\n      this.runConfig,')
  })

  it('wires the invincibility toggle into finite HP and armor readouts', () => {
    expect(gameUiSource).toContain(
      'hasUnlimitedVitality(\n    snapshot.runMode,\n    snapshot.invincible,',
    )
    expect(gameUiSource).toContain("isMortalCombatLab ? ' HP' : ''")
    expect(gameUiSource).toContain("isMortalCombatLab ? ' ARMOR' : ''")
    expect(gameUiSource).toContain("'Mortal calibration'")
    expect(gameUiSource).toContain("'Damage active'")
  })
})
