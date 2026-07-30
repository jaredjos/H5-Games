import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(
    endMarker,
    start + startMarker.length,
  )
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

const callCount = (source: string, token: string) =>
  source.split(token).length - 1

describe('premium spell v3 runtime integration', () => {
  it('advertises the exact v3 atlas contract for proof capture', () => {
    expect(runtimeSource).toContain(
      "this.host.dataset.premiumSpellVfx = 'v3'",
    )
    expect(runtimeSource).toContain(
      "this.host.dataset.premiumSpellAtlasId = 'premium-spell-vfx-v3'",
    )
    expect(runtimeSource).toContain(
      'this.host.dataset.premiumSpellMaterialWeapon = effect.weaponId',
    )
    expect(runtimeSource).toContain(
      'this.host.dataset.premiumSpellMaterialRank = String(',
    )
    expect(runtimeSource).toContain(
      'this.host.dataset.premiumSpellMaterialAwakened = String(',
    )
  })

  it('renders a macro cell once instead of cloning it as satellites', () => {
    const macro = section(
      '  private drawPremiumSpellMacro(',
      '  private beginGroundedVfxFrame()',
    )

    expect(callCount(macro, 'this.drawHeroPowerMaterialEvent({')).toBe(1)
    expect(macro).not.toContain('for (')
    expect(runtimeSource).not.toContain('drawSpellRecipeSatellites')
    expect(macro).not.toContain('this.hero.alpha')
  })

  it.each([
    ['Helio cast', "        case 'helio-gate':", "        case 'helio-impact':"],
    [
      'Helio impact',
      "        case 'helio-impact':",
      "        case 'crescent-orbit':",
    ],
    [
      'Crescent cast',
      "        case 'crescent-orbit':",
      "        case 'crescent-impact':",
    ],
    [
      'Crescent impact',
      "        case 'crescent-impact':",
      "        case 'arc-chain':",
    ],
    ['Arc Choir', "        case 'arc-chain':", "        case 'rift-cast':"],
    ['Rift Seeds', "        case 'rift-cast':", "        case 'comet-launch':"],
    [
      'Comet cast',
      "        case 'comet-launch':",
      "        case 'comet-impact':",
    ],
    [
      'Comet impact',
      "        case 'comet-impact':",
      "        case 'graveglass-eruption':",
    ],
    [
      'Mirror cast',
      "        case 'mirror-gate':",
      "        case 'mirror-impact':",
    ],
    [
      'Mirror impact',
      "        case 'mirror-impact':",
      "        case 'eclipse-harrow':",
    ],
  ] as const)(
    'uses one premium macro in the %s effect scope',
    (_label, startMarker, endMarker) => {
      expect(
        callCount(
          section(startMarker, endMarker),
          'this.drawPremiumSpellMacro(',
        ),
      ).toBe(1)
    },
  )

  it('keeps one premium macro and one physical structure for each area spell', () => {
    const graveglass = section(
      '  private drawGraveglassPresentation(',
      '  private drawEclipsePresentation(',
    )
    const eclipse = section(
      '  private drawEclipsePresentation(',
      '  private drawSupportPickupBeacon(',
    )
    const graveglassStructure = section(
      '  private drawGraveglassMaterialSprite(',
      '  private drawEclipseGateMaterialSprites(',
    )
    const eclipseStructure = section(
      '  private drawEclipseGateMaterialSprites(',
      '  private drawEclipseCathedralMaterialSprite(',
    )

    expect(callCount(graveglass, 'this.drawPremiumSpellMacro(')).toBe(1)
    expect(callCount(eclipse, 'this.drawPremiumSpellMacro(')).toBe(1)
    expect(graveglassStructure).toContain(
      'if (strike.index !== 0) return',
    )
    expect(eclipseStructure).toContain(
      "if (strike.index !== 0 || effect.visualState.stage === 'final') return",
    )
  })

  it('keeps the hero opacity protected from spell-rank rendering', () => {
    expect(runtimeSource).toContain(
      'this.hero.alpha = Math.max(0.96, heroPose.alpha)',
    )
  })
})
