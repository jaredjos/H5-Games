import { describe, expect, it } from 'vitest'
import appSourceRaw from '../App.tsx?raw'
import gameUiSource from '../ui/GameUI.tsx?raw'
import runtimeSourceRaw from './GameCanvas.tsx?raw'

const appSource = appSourceRaw.replace(/\r\n/g, '\n')
const runtimeSource = runtimeSourceRaw.replace(/\r\n/g, '\n')

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

describe('free revive runtime integration', () => {
  it('intercepts only the first lethal hit before defeat completion', () => {
    const damagePlayer = section(
      '  private damagePlayer(amount: number, context: PlayerDamageContext)',
      '  private finish(victory: boolean)',
    )

    expect(damagePlayer).toContain('if (this.revivesRemaining > 0)')
    expect(damagePlayer).toContain('this.revivePending = true')
    expect(damagePlayer).toContain('this.finish(false)')
    expect(damagePlayer.indexOf('this.revivePending = true'))
      .toBeLessThan(damagePlayer.indexOf('this.finish(false)'))
  })

  it('restores a bounded fighting state without resetting encounter progress', () => {
    const revive = section(
      '\n  revive() {',
      '\n  declineRevive() {',
    )

    expect(revive).toContain('this.revivesRemaining -= 1')
    expect(revive).toContain('revivedHealth(this.player.maxHp)')
    expect(revive).toContain('this.player.shield = 0')
    expect(revive).toContain('REVIVE_INVULNERABILITY_SECONDS')
    expect(revive).toContain('this.clearReviveSanctuary()')
    expect(revive).not.toContain('this.elapsed =')
    expect(revive).not.toContain('this.boss.hp =')
    expect(revive).not.toContain('this.weapons =')
  })

  it('freezes combat, prevents same-step boss victory, and removes heal chaining', () => {
    const damageEnemy = section(
      '  private damageEnemy(',
      '  private damagePlayer(amount: number, context: PlayerDamageContext)',
    )
    const sanctuary = section(
      '  private clearReviveSanctuary()',
      '  selectUpgrade(optionId: string)',
    )
    const paused = section(
      '  private isPaused()',
      '  private sliceTexture(',
    )

    expect(damageEnemy).toContain('if (this.revivePending')
    expect(sanctuary).toContain("pickup.kind !== 'dawnheart'")
    expect(paused).toContain('this.revivePending')
  })

  it('moves an overlapping sovereign out of the revive sanctuary without resetting it', () => {
    const sanctuary = section(
      '  private clearReviveSanctuary()',
      '  selectUpgrade(optionId: string)',
    )

    expect(sanctuary).toContain('if (!enemy.active) continue')
    expect(sanctuary).not.toContain('!enemy.active || enemy.isBoss')
    expect(sanctuary).toContain('candidateDistanceSquared')
    expect(sanctuary).toContain('enemy.isBoss ? 1.6 : 1.1')
    expect(sanctuary).toContain('enemy.attackTimer = Math.max(enemy.attackTimer, 1.4)')
    expect(sanctuary).not.toContain('enemy.hp =')
    expect(sanctuary).not.toContain('enemy.phase =')
  })

  it('exposes a centered, explicit player choice above all other gameplay dialogs', () => {
    expect(appSource).toContain('<ReviveOverlay onRevive={revive} onDecline={declineRevive} />')
    expect(appSource).toContain('!snapshot.revivePending')
    expect(gameUiSource).toContain('className="pause-overlay revive-overlay"')
    expect(gameUiSource).toContain('className="pause-overlay__content"')
    expect(gameUiSource).toContain('Rise Again — Free')
    expect(gameUiSource).toContain('50% vitality')
    expect(gameUiSource).toContain('One sovereign. One free return.')
  })
})
