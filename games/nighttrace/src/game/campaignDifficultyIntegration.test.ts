import { describe, expect, it } from 'vitest'
import runtimeSourceRaw from './GameCanvas.tsx?raw'

const runtimeSource = runtimeSourceRaw.replace(/\r\n/g, '\n')

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

describe('Zone 1 campaign difficulty integration', () => {
  it('resolves the campaign-only multiplier away from QA and showcase surfaces', () => {
    const constructor = section('  constructor(', '  async init()')
    expect(constructor).toContain('this.campaignDifficultyMultiplier = campaignDifficultyMultiplier(')
    expect(constructor).toContain('this.qaMode || Boolean(this.showcase)')
  })

  it('scales spawn pressure, horde health, final boss health, and incoming damage', () => {
    const spawning = section('  private updateSpawning(delta: number)', '  private spawnEnemy()')
    const enemy = section('  private spawnEnemy()', '  private spawnBoss()')
    const boss = section('  private spawnBoss()', '  private updateEnemies(delta: number)')
    const playerDamage = section(
      '  private damagePlayer(amount: number, context: PlayerDamageContext)',
      '  private finish(victory: boolean)',
    )

    expect(spawning).toContain('this.campaignDifficultyMultiplier')
    expect(enemy).toContain('this.campaignDifficultyMultiplier')
    expect(boss).toMatch(
      /bossHealthForBuild\([\s\S]*?\)\s*\* this\.campaignDifficultyMultiplier/,
    )
    expect(playerDamage).toContain('this.campaignDifficultyMultiplier')
  })
})
