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
    expect(update).toContain('this.damagePlayer(event.damage)')
    expect(update.match(/this\.damagePlayer\(event\.damage\)/g)).toHaveLength(1)
  })
})
