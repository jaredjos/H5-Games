import { describe, expect, it } from 'vitest'
import appSource from '../App.tsx?raw'
import gameUiSource from '../ui/GameUI.tsx?raw'
import runtimeSource from './GameCanvas.tsx?raw'

describe('durable run-ending transition', () => {
  it('publishes a semantic ending snapshot before handing off the result', () => {
    const finishStart = runtimeSource.indexOf(
      '  private finish(victory: boolean)',
    )
    const finishEnd = runtimeSource.indexOf(
      '  private spawnPickup(',
      finishStart,
    )
    const finish = runtimeSource.slice(finishStart, finishEnd)

    expect(finish).toContain('this.endSequenceDuration = runEndingDuration(victory)')
    expect(finish).toContain('runEndingTitle(victory, 0)')
    expect(finish).toContain('this.emitSnapshot(true)')
    expect(finish.indexOf('this.emitSnapshot(true)')).toBeLessThan(
      finish.indexOf('this.spawnBurst('),
    )
  })

  it('uses real elapsed time so QA acceleration cannot erase the message', () => {
    const tickStart = runtimeSource.indexOf('  private tick = (ticker: Ticker)')
    const stepStart = runtimeSource.indexOf('  private step(delta: number)', tickStart)
    const tick = runtimeSource.slice(tickStart, stepStart)
    const completedStep = runtimeSource.slice(
      stepStart,
      runtimeSource.indexOf('    if (this.revivePending)', stepStart),
    )

    expect(tick).toContain('this.endSequenceTimer - realDelta')
    expect(completedStep).not.toContain('this.endSequenceTimer - delta')
  })

  it('renders an explicit level-complete card with boss and sector context', () => {
    expect(appSource).toContain(
      '<RunEndingOverlay ending={snapshot.ending} />',
    )
    expect(appSource).toContain('snapshot.ending?.completionVisible')
    expect(gameUiSource).toContain("'Level Complete'")
    expect(gameUiSource).toContain(
      "`Sector ${String(ending.levelId).padStart(2, '0')} reclaimed · ${ending.bossName} defeated`",
    )
  })
})
