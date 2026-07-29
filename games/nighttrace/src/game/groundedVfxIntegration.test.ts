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
    ).toHaveLength(4)
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

  it('routes every hostile footprint through the matching boundary-particle sink', () => {
    const effectDrawing = section(
      '  private drawEffects()',
      '  private drawJoystick()',
    )
    const telegraphStart = effectDrawing.indexOf(
      'for (const telegraph of this.telegraphs)',
    )
    const projectileStart = effectDrawing.indexOf(
      'for (const projectile of this.hostileProjectiles)',
      telegraphStart,
    )
    const groundedFrameEnd = effectDrawing.indexOf(
      'this.finishGroundedVfxFrame()',
      projectileStart,
    )
    expect(telegraphStart).toBeGreaterThanOrEqual(0)
    expect(projectileStart).toBeGreaterThan(telegraphStart)
    expect(groundedFrameEnd).toBeGreaterThan(projectileStart)
    const telegraphDrawing = effectDrawing.slice(
      telegraphStart,
      projectileStart,
    )
    const projectileDestinationDrawing = effectDrawing.slice(
      projectileStart,
      groundedFrameEnd,
    )
    const boundaryParticleDrawing = section(
      '  private drawHostileBoundaryParticle(',
      '  private hostileBoundaryStage(',
    )
    const fieldParticleDrawing = section(
      '  private drawHostileFieldParticles(',
      '  private drawHostileLaneParticles(',
    )
    const laneParticleDrawing = section(
      '  private drawHostileLaneParticles(',
      '  private drawGroundedFieldMaterial(',
    )

    expect(telegraphDrawing).toMatch(
      /if\s*\(telegraph\.kind === 'circle'\)[\s\S]*?drawGroundedFieldMaterial\(/,
    )
    expect(telegraphDrawing).toMatch(
      /else\s*\{[\s\S]*?drawGroundedLaneMaterial\(/,
    )
    expect(telegraphDrawing.match(/drawGroundedFieldMaterial\(/g)).toHaveLength(
      1,
    )
    expect(telegraphDrawing.match(/drawGroundedLaneMaterial\(/g)).toHaveLength(
      1,
    )

    expect(projectileDestinationDrawing).toContain(
      'if (!pose.destinationVisible) continue',
    )
    expect(projectileDestinationDrawing).toMatch(
      /drawGroundedFieldMaterial\([\s\S]*?'hostile-field'[\s\S]*?config\.destination\.x,[\s\S]*?config\.destination\.y,[\s\S]*?config\.impactRadius,/,
    )
    expect(projectileDestinationDrawing).not.toContain(
      'drawGroundedLaneMaterial(',
    )

    for (const [drawing, footprint] of [
      [fieldParticleDrawing, 'field'],
      [laneParticleDrawing, 'lane'],
    ] as const) {
      expect(drawing.match(/reserveHostileBoundaryQuota\(\)/g)).toHaveLength(1)
      expect(drawing.match(/sampleHostileBoundaryParticles\(\{/g)).toHaveLength(
        1,
      )
      expect(drawing).toContain(`footprint: '${footprint}'`)
      expect(drawing).toContain('maxParticles: boundaryQuota')
      expect(drawing).toContain('this.drawHostileBoundaryParticle(')
    }

    expect(boundaryParticleDrawing).toContain(
      "particle.kind === 'mote'",
    )
    expect(boundaryParticleDrawing).toContain('.ellipse(')
    expect(boundaryParticleDrawing).toContain('.poly(')
    expect(boundaryParticleDrawing).not.toContain('.stroke(')
    expect(boundaryParticleDrawing).not.toContain('.circle(')
    expect(boundaryParticleDrawing).not.toContain('drawPolyline')
    expect(boundaryParticleDrawing).not.toContain('drawSegmentedRing')
    expect(boundaryParticleDrawing).not.toContain('drawRadialTicks')
  })

  it('pre-counts hostile footprints and allocates fair quotas before drawing any zone', () => {
    const effectDrawing = section(
      '  private drawEffects()',
      '  private drawJoystick()',
    )
    const quotaPreCount = section(
      '  private allocateHostileBoundaryParticleQuotas()',
      '  private reserveHostileBoundaryQuota()',
    )
    const quotaReservation = section(
      '  private reserveHostileBoundaryQuota()',
      '  private drawBossTelegraphParticle(',
    )
    const firstTelegraphDraw = effectDrawing.indexOf(
      'for (const telegraph of this.telegraphs)',
    )
    const firstProjectileDraw = effectDrawing.indexOf(
      'for (const projectile of this.hostileProjectiles)',
    )
    const quotaAllocation = effectDrawing.indexOf(
      'allocateHostileBoundaryParticleQuotas',
    )

    expect(quotaAllocation).toBeGreaterThanOrEqual(0)
    expect(quotaAllocation).toBeLessThan(firstTelegraphDraw)
    expect(quotaAllocation).toBeLessThan(firstProjectileDraw)
    expect(quotaPreCount).toMatch(
      /this\.telegraphs\.reduce\([\s\S]*?telegraph\.active/,
    )
    expect(quotaPreCount).toMatch(
      /this\.hostileProjectiles\.reduce\([\s\S]*?destinationVisible/,
    )
    expect(quotaReservation).toContain(
      'reserveHostileBoundaryParticleQuota({',
    )
    expect(quotaReservation).toContain(
      'remainingBudget: this.groundedVfxBoundaryBudget',
    )
    expect(quotaReservation).toContain(
      'remainingFootprints: this.hostileBoundaryFootprintsRemaining',
    )
    expect(quotaReservation).toContain(
      'reservation.remainingFootprints',
    )
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
