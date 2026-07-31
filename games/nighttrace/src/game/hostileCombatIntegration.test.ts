import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

describe('hostile combat runtime integration', () => {
  it('directs every boss cast through the expanding repeat-safe repertoire', () => {
    const bossAttack = section(
      '  private bossAttack(enemy: EnemyEntity)',
      '  private mirroredPlayerPoint(',
    )

    expect(bossAttack).toContain('directBossPattern({')
    expect(bossAttack).toContain('levelId: this.bossLevel.id')
    expect(bossAttack).toContain('phase: enemy.phase')
    expect(bossAttack).toContain('state: this.bossPatternDirectorState')
    expect(bossAttack).toContain(
      'this.bossPatternDirectorState = patternDecision.state',
    )
    expect(bossAttack.match(/this\.launchHostileProjectile\(/g)?.length)
      .toBeGreaterThanOrEqual(5)
  })

  it('gives late horde specialists visible fixed-destination ranged attacks', () => {
    const hordeSpecials = section(
      '  private performEnemySpecial(',
      '  private updateWeapons(',
    )

    for (const enemyId of [
      "'cantor'",
      "'shardwing'",
      "'chronowisp'",
      "'cinder-guard'",
    ]) {
      expect(hordeSpecials).toContain(`enemy.id === ${enemyId}`)
    }
    expect(hordeSpecials).toContain('this.predictedPlayerPoint(')
    expect(hordeSpecials.match(/this\.launchHostileProjectile\(/g)?.length)
      .toBeGreaterThanOrEqual(4)
    expect(hordeSpecials).toContain('this.level.id >= 7')
    expect(hordeSpecials).toContain('this.level.id >= 5')
  })

  it('renders warnings as textured ground material with bounded hostile chroma', () => {
    const effects = section(
      '  private telegraphMaterialPalette(',
      '    this.screenFlash.alpha =',
    )
    const fieldMaterial = section(
      '  private drawGroundedFieldMaterial(',
      '  private drawGroundedLaneMaterial(',
    )
    const laneMaterial = section(
      '  private drawGroundedLaneMaterial(',
      '  private drawGraveglassMaterialSprite(',
    )

    expect(effects).toContain('resolveHostileTelegraphPalette({')
    expect(effects).toContain('projectile.palette')
    expect(fieldMaterial).toContain('hostilePalette.seepTint')
    expect(fieldMaterial).toContain('hostilePalette?.smokeTint')
    expect(laneMaterial).toContain('hostilePalette.seepTint')
    expect(laneMaterial).toContain('hostilePalette?.smokeTint')
    expect(fieldMaterial).not.toContain('.stroke(')
    expect(laneMaterial).not.toContain('.stroke(')
  })

  it('applies projectile damage once at the authored impact event', () => {
    const update = section(
      '  private updateHostileProjectiles(',
      '  private drawHostileProjectiles(',
    )

    expect(update).toContain('advanceHostileProjectile(')
    expect(update).toContain("if (event.type === 'release')")
    expect(update).toContain('this.damagePlayer(event.damage, {')
    expect(update).toContain("kind: 'projectile'")
    expect(update.match(/this\.damagePlayer\(event\.damage,\s*\{/g)).toHaveLength(
      1,
    )
  })

  it('keeps telegraph timing, hit geometry, and damage resolution unchanged', () => {
    const update = section(
      '  private updateTelegraphs(',
      '  private launchHostileProjectile(',
    )

    expect(update).toMatch(/telegraph\.life\s*-=\s*delta/)
    expect(update).toContain('if (telegraph.life > 0) continue')
    expect(update).toMatch(
      /playerDeltaX\s*\*\*\s*2\s*\+\s*playerDeltaY\s*\*\*\s*2\s*<=\s*\(telegraph\.radius\s*\+\s*HERO_HIT_RADIUS\)\s*\*\*\s*2/,
    )
    expect(update).toMatch(/localX\s*>=\s*0/)
    expect(update).toMatch(/localX\s*<=\s*telegraph\.length/)
    expect(update).toMatch(
      /Math\.abs\(localY\)\s*<=\s*telegraph\.width\s*\*\s*0\.5\s*\+\s*HERO_HIT_RADIUS/,
    )
    expect(
      update.match(/this\.damagePlayer\(telegraph\.damage,\s*\{/g),
    ).toHaveLength(1)
    expect(update).toContain("kind: 'telegraph'")
    expect(update).not.toContain('sampleHostileBoundaryParticles')
    expect(update).not.toContain('allocateHostileBoundaryParticleQuotas')
  })

  it('keeps hostile-warning drawing cosmetic and read-only', () => {
    const effects = section(
      '  private drawEffects()',
      '  private drawJoystick()',
    )
    const hostileDrawingStart = effects.indexOf(
      'for (const telegraph of this.telegraphs)',
    )
    const hostileDrawingEnd = effects.indexOf(
      'this.finishGroundedVfxFrame()',
      hostileDrawingStart,
    )
    expect(hostileDrawingStart).toBeGreaterThanOrEqual(0)
    expect(hostileDrawingEnd).toBeGreaterThan(hostileDrawingStart)
    const hostileDrawing = effects.slice(
      hostileDrawingStart,
      hostileDrawingEnd,
    )

    expect(hostileDrawing).not.toContain('damagePlayer(')
    expect(hostileDrawing).not.toContain('advanceHostileProjectile(')
    expect(hostileDrawing).not.toMatch(
      /telegraph\.(?:life|total|radius|length|width|damage)\s*(?:[+\-*/]?=|\+\+|--)/,
    )
    expect(hostileDrawing).not.toMatch(
      /projectile\.state\s*(?:[+\-*/]?=|\+\+|--)/,
    )
  })

  it('preserves the authored boss multi-zone count formulas', () => {
    const bossAttack = section(
      '  private bossAttack(enemy: EnemyEntity)',
      '  private mirroredPlayerPoint(',
    )

    expect(bossAttack.match(/const circles = 3 \+ enemy\.phase/g)).toHaveLength(
      1,
    )
    expect(
      bossAttack.match(/const clusterCount = 2 \+ enemy\.phase/g),
    ).toHaveLength(1)
    expect(
      bossAttack.match(/const spiralCount = 4 \+ enemy\.phase/g),
    ).toHaveLength(1)
    expect(bossAttack).toMatch(
      /const spiralCount = 4 \+ enemy\.phase[\s\S]*?for\s*\(let index = 0; index < spiralCount; index \+= 1\)[\s\S]*?if\s*\(enemy\.phase >= 3\)[\s\S]*?this\.launchHostileProjectile\([\s\S]*?\{\s*x: this\.player\.x,\s*y: this\.player\.y\s*\}/,
    )
    expect(bossAttack).not.toContain('sampleHostileBoundaryParticles')
    expect(bossAttack).not.toContain('allocateHostileBoundaryParticleQuotas')
  })
})
