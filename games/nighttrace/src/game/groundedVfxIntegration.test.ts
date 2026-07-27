import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

describe('grounded VFX runtime integration', () => {
  it('places material warnings below weapon structures and every actor layer', () => {
    const worldComposition = section(
      '      this.world.addChild(',
      '      this.trailLayer.addChild(',
    )
    expect(worldComposition.indexOf('this.threatGroundLayer'))
      .toBeLessThan(worldComposition.indexOf('this.weaponMaterialLayer'))
    expect(worldComposition.indexOf('this.threatGroundLayer'))
      .toBeLessThan(worldComposition.indexOf('this.enemyLayer'))
    expect(worldComposition.indexOf('this.threatGroundLayer'))
      .toBeLessThan(worldComposition.indexOf('this.actorLayer'))
  })

  it('renders boss warnings with authored field and lane materials only', () => {
    const effectDrawing = section(
      '  private drawEffects()',
      '  private drawJoystick()',
    )
    expect(effectDrawing).toContain("'hostile-field'")
    expect(effectDrawing).toContain("'hostile-lane'")
    expect(effectDrawing).toContain('drawGroundedFieldMaterial')
    expect(effectDrawing).toContain('drawGroundedLaneMaterial')
    expect(effectDrawing).not.toContain('telegraphGraphics')
    expect(effectDrawing).not.toContain('drawSegmentedRing')
    expect(effectDrawing).not.toContain('drawRadialTicks')
  })

  it('keeps Graveglass and Eclipse silhouettes while removing duplicate vector choreography', () => {
    const graveglass = section(
      '  private drawGraveglassPresentation(',
      '  private drawEclipsePresentation(',
    )
    const eclipse = section(
      '  private drawEclipsePresentation(',
      '  private drawSupportPickupBeacon(',
    )

    expect(graveglass).toContain("'graveglass-field'")
    expect(graveglass).toContain('drawGraveglassMaterialSprite')
    expect(eclipse).toContain("'eclipse-lane'")
    expect(eclipse).toContain('drawEclipseGateMaterialSprites')

    for (const spell of [graveglass, eclipse]) {
      expect(spell).not.toContain('drawPolyline')
      expect(spell).not.toContain('drawStarburst')
      expect(spell).not.toContain('drawSegmentedRing')
      expect(spell).not.toContain('drawDiamondGlyph')
    }
  })

  it('does not restore vector warnings after hostile damage resolves', () => {
    const update = section(
      '  private updateTelegraphs(',
      '  private updateVisualEffects(',
    )
    expect(update).not.toContain('this.rings.push')
    expect(update).not.toContain('this.loopEffects.push')
    expect(update).toContain('ashColor')
  })

  it('removes procedural boss signature and antler line systems', () => {
    expect(runtimeSource).not.toContain('drawBossSignatureMotif')
    expect(runtimeSource).not.toContain('drawBossSpecialChoreography')
    expect(runtimeSource).not.toContain("case 'antler-prowl'")
  })
})
