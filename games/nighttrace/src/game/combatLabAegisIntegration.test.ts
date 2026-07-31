import { describe, expect, it } from 'vitest'
import screensSource from '../ui/Screens.tsx?raw'

describe('Combat Lab Dawnward Aegis discoverability', () => {
  it('places the complete rank control before the scrolling weapon list', () => {
    const arsenalStart = screensSource.indexOf(
      '<PanelFrame className="combat-lab-arsenal">',
    )
    const aegis = screensSource.indexOf(
      '<CombatLabLightRing',
      arsenalStart,
    )
    const weapons = screensSource.indexOf(
      '<div className="combat-lab-weapon-list">',
      arsenalStart,
    )

    expect(arsenalStart).toBeGreaterThanOrEqual(0)
    expect(aegis).toBeGreaterThan(arsenalStart)
    expect(aegis).toBeLessThan(weapons)
    expect(screensSource).toContain(
      'aria-label="Dawnward Aegis spell rank"',
    )
    expect(screensSource).toContain(
      "{profile.awakened ? 'Awakened' : `Rank ${profile.rank}`}",
    )
  })
})
