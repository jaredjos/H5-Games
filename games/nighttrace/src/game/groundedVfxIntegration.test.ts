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

  it('adds shared ground-linked particles to fields, lanes, and projectile destinations', () => {
    const fieldMaterial = section(
      '  private drawGroundedFieldMaterial(',
      '  private drawGroundedLaneMaterial(',
    )
    const laneMaterial = section(
      '  private drawGroundedLaneMaterial(',
      '  private drawGraveglassMaterialSprite(',
    )
    const particleDrawing = section(
      '  private drawHostileFieldParticles(',
      '  private drawGroundedFieldMaterial(',
    )
    const effectDrawing = section(
      '  private drawEffects()',
      '  private drawJoystick()',
    )

    expect(fieldMaterial).toContain('drawHostileFieldParticles')
    expect(laneMaterial).toContain('drawHostileLaneParticles')
    expect(
      particleDrawing.match(/prominence: boss \? 'boss' : 'horde'/g),
    ).toHaveLength(2)
    expect(effectDrawing).toContain('config.destination.x')
    expect(effectDrawing).toContain('config.destination.y')
    expect(effectDrawing).toContain('config.boss ? this.bossLevel.bossId')

    for (const material of [fieldMaterial, laneMaterial]) {
      expect(material).not.toContain('.stroke(')
      expect(material).not.toContain('drawSegmentedRing')
      expect(material).not.toContain('drawRadialTicks')
      expect(material).not.toContain('drawPolyline')
    }
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

  it('removes every broad rectangular actor-ground path and preserves native contact grounding', () => {
    expect(runtimeSource).not.toContain('heroSanctum')
    expect(runtimeSource).not.toContain('createHeroSanctumField')
    expect(runtimeSource).not.toContain('heroGroundShadow')
    expect(runtimeSource).not.toContain('bossGroundShadow')
    expect(runtimeSource).not.toContain('bossHostileAtmosphere')
    expect(runtimeSource).not.toContain('createGroundShadowFilter')
    expect(runtimeSource).not.toContain('createBossHostileField')
    expect(runtimeSource).not.toContain('heroGroundMaterialTexture')
    expect(runtimeSource).toContain(
      '.fill({ color: 0x010307, alpha: 0.24 })',
    )
  })
})
