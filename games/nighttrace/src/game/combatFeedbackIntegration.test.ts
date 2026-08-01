import { describe, expect, it } from 'vitest'
import audioSource from './audio.ts?raw'
import runtimeSource from './GameCanvas.tsx?raw'

const section = (source: string, startMarker: string, endMarker: string) => {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('combat feedback runtime integration', () => {
  it('resets only discontinuous traces before Pixi can draw a stray diagonal', () => {
    const updateTrace = section(
      runtimeSource,
      '  private updateTrace()',
      '  private closeLoop(',
    )
    expect(updateTrace).toContain('traceSegmentIsDiscontinuous(last, point)')
    expect(updateTrace).toMatch(
      /traceSegmentIsDiscontinuous\(last, point\)[\s\S]*?this\.trace\.length = 0[\s\S]*?this\.trace\.push\(point\)[\s\S]*?return/,
    )
    expect(updateTrace.indexOf('traceSegmentIsDiscontinuous(last, point)'))
      .toBeLessThan(updateTrace.indexOf('distanceSquared(last, point)'))
  })

  it('applies a dedicated crimson hero flash to every accepted hit feedback event', () => {
    const damage = section(
      runtimeSource,
      '  private damagePlayer(',
      '  private finish(',
    )
    const drawing = section(
      runtimeSource,
      '  private drawPlayerCombatReadability(',
      '  private drawJoystick()',
    )
    expect(damage).toContain('this.playerHitFeedback = feedback')
    expect(drawing).toContain('heroDamageFlashTint(')
    expect(drawing).toContain('feedback.intensity')
    expect(drawing).toContain('this.settings.reducedFlash')
  })

  it('extends special anticipation by 0.20 seconds without changing geometry', () => {
    const circleQueue = section(
      runtimeSource,
      '  private queueCircleTelegraph(',
      '  private queueLineTelegraph(',
    )
    const lineQueue = section(
      runtimeSource,
      '  private queueLineTelegraph(',
      '  private findSafeSpawnPoint(',
    )
    const projectileQueue = section(
      runtimeSource,
      '  private launchHostileProjectile(',
      '  private updateHostileProjectiles(',
    )
    for (const queue of [circleQueue, lineQueue]) {
      expect(queue).toContain('hostileSpecialReactionWindow(life)')
      expect(queue).toContain('life: warningLife')
      expect(queue).toContain('total: warningLife')
    }
    expect(circleQueue).toContain('radius,')
    expect(lineQueue).toContain('length,')
    expect(lineQueue).toContain('width,')
    expect(projectileQueue).toContain(
      'windupSeconds: hostileSpecialReactionWindow(options.windup)',
    )
    expect(projectileQueue).toContain('impactRadius: options.radius')
  })

  it('applies the damaging reaction bonus once in each queue, not again at call sites', () => {
    const circleQueue = section(
      runtimeSource,
      '  private queueCircleTelegraph(',
      '  private queueLineTelegraph(',
    )
    const lineQueue = section(
      runtimeSource,
      '  private queueLineTelegraph(',
      '  private findSafeSpawnPoint(',
    )
    const projectileQueue = section(
      runtimeSource,
      '  private launchHostileProjectile(',
      '  private updateHostileProjectiles(',
    )
    const bossAttack = section(
      runtimeSource,
      '  private bossAttack(',
      '  private mirroredPlayerPoint(',
    )
    const eliteSpecials = section(
      runtimeSource,
      '  private performEnemySpecial(',
      '  private predictedPlayerPoint(',
    )

    expect(circleQueue.match(/hostileSpecialReactionWindow\(life\)/g))
      .toHaveLength(1)
    expect(lineQueue.match(/hostileSpecialReactionWindow\(life\)/g))
      .toHaveLength(1)
    expect(
      projectileQueue.match(
        /hostileSpecialReactionWindow\(options\.windup\)/g,
      ),
    ).toHaveLength(1)
    // These are matching animation holds only. Damage timing remains owned by
    // the three queues above and therefore cannot receive a second +0.20s.
    expect(bossAttack.match(/hostileSpecialReactionWindow\(/g)).toHaveLength(1)
    expect(eliteSpecials.match(/hostileSpecialReactionWindow\(/g))
      .toHaveLength(6)
    expect(bossAttack).not.toMatch(
      /(?:windup|warningTime):\s*hostileSpecialReactionWindow/,
    )
    expect(eliteSpecials).not.toMatch(
      /windup:\s*hostileSpecialReactionWindow/,
    )
  })

  it('electrifies only flagged hostile specials below the bone-white boundary layer', () => {
    const setup = section(
      runtimeSource,
      '      this.enemyForegroundLayer.addChild(',
      '      this.effectLayer.addChild(',
    )
    const queue = section(
      runtimeSource,
      '  private queueCircleTelegraph(',
      '  private findSafeSpawnPoint(',
    )
    const warningDraw = section(
      runtimeSource,
      '    for (const telegraph of this.telegraphs)',
      '    for (const projectile of this.hostileProjectiles)',
    )
    expect(setup.indexOf('this.hostileSpecialEnergyGraphics'))
      .toBeLessThan(setup.indexOf('this.hostileBoundaryGlowGraphics'))
    expect(queue).toContain('specialAttack = bossAttack')
    expect(warningDraw).toContain('telegraph.specialAttack')
    expect(runtimeSource).toContain('sampleHostileSpecialEnergy({')
    expect(runtimeSource).not.toContain('drawHostileSpecialEnergyFilament(effect')
  })
})

describe('combat SFX runtime integration', () => {
  it('hooks every hero cast and the pulsing Aegis into authored profiles', () => {
    const cast = section(
      runtimeSource,
      '  private fireWeapon(',
      '  private currentHeroWeaponOrigin(',
    )
    const aegis = section(
      runtimeSource,
      '  private updateLightRing(',
      '  private updateWeapons(',
    )
    expect(cast).toContain('this.audio.playWeaponCue(owned.id)')
    expect(aegis).toContain('this.audio.playLightRingPulse(')
    expect(audioSource).toContain('combatSfxProfile(cueId)')
  })

  it('plays boss and elite cues at release, not at warning creation', () => {
    const telegraphs = section(
      runtimeSource,
      '  private updateTelegraphs(',
      '  private launchHostileProjectile(',
    )
    const projectiles = section(
      runtimeSource,
      '  private updateHostileProjectiles(',
      '  private drawHostileProjectiles(',
    )
    const bossAttack = section(
      runtimeSource,
      '  private bossAttack(',
      '  private mirroredPlayerPoint(',
    )
    expect(telegraphs).toContain('playHostileSpecialRelease(')
    expect(projectiles).toContain("if (event.type === 'release')")
    expect(projectiles).toContain('playHostileSpecialRelease(')
    expect(bossAttack).not.toContain('playBossAttack(')
  })

  it('routes every damaging elite special and every boss pattern through a release hook', () => {
    const eliteSpecials = section(
      runtimeSource,
      '  private performEnemySpecial(',
      '  private predictedPlayerPoint(',
    )
    const bossAttack = section(
      runtimeSource,
      '  private bossAttack(',
      '  private mirroredPlayerPoint(',
    )
    for (const enemyId of [
      "enemy.id === 'cantor'",
      "enemy.id === 'shardwing'",
      "enemy.id === 'railjaw'",
      "enemy.id === 'chronowisp'",
      "enemy.id === 'cinder-guard'",
    ]) {
      expect(eliteSpecials).toContain(enemyId)
    }
    expect(eliteSpecials.match(/this\.launchHostileProjectile\(/g))
      .toHaveLength(4)
    expect(eliteSpecials).toMatch(
      /this\.queueLineTelegraph\([\s\S]*?this\.actorAccentColor\(enemy\),[\s\S]*?true,/,
    )
    expect(eliteSpecials).toMatch(
      /this\.queueCircleTelegraph\([\s\S]*?this\.actorAccentColor\(enemy\),[\s\S]*?true,/,
    )
    expect(bossAttack.match(/this\.queue(?:Line|Circle)Telegraph\(/g)?.length)
      .toBeGreaterThanOrEqual(12)
    expect(bossAttack.match(/this\.launchHostileProjectile\(/g)?.length)
      .toBeGreaterThanOrEqual(5)
    expect(bossAttack).not.toContain('this.damagePlayer(')
  })

  it('sounds boss melee and elite blink on their actual release frames', () => {
    const enemyUpdates = section(
      runtimeSource,
      '  private updateEnemies(',
      '  private performEnemySpecial(',
    )
    expect(enemyUpdates).toMatch(
      /motionProgress\(enemy\.attackMotionRemaining,[\s\S]*?playHostileSpecialRelease\('elite', 'blink'\)[\s\S]*?enemy\.x = enemy\.blinkTargetX/,
    )
    expect(enemyUpdates).toMatch(
      /contactAttackProgress >= 0\.42[\s\S]*?if \(enemy\.isBoss\)[\s\S]*?playHostileSpecialRelease\('boss', 'melee'\)[\s\S]*?circleTouchesHeroBody/,
    )
  })

  it('uses cooldowns and prioritized hard voice admission to avoid pile-up', () => {
    expect(audioSource).toContain('profile.cooldownSeconds')
    expect(audioSource).toContain('canAdmitCombatTone(priorities, priority)')
    expect(audioSource).toContain('this.releaseToneVoice(victim, true)')
    expect(audioSource).toContain('COMBAT_SFX_MAX_TONE_VOICES')
  })
})
