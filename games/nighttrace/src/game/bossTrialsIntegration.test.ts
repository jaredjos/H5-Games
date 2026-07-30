import { describe, expect, it } from 'vitest'
import appSourceRaw from '../App.tsx?raw'
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

describe('Boss Trials runtime integration', () => {
  it('cannot carry a manual pause through the encounter gate', () => {
    const togglePause = section(
      '  togglePause() {',
      '  setOrientationPaused(paused: boolean)',
    )

    expect(togglePause).toContain('this.awaitingStart')
    expect(appSource).toContain('!snapshot?.awaitingStart')
  })

  it('starts the selected encounter without waiting for music playback', () => {
    const beginEncounter = section(
      '  beginEncounter() {',
      '  revive() {',
    )

    expect(beginEncounter).toContain('void this.audio.unlock()')
    expect(beginEncounter).toContain('this.awaitingStart = false')
    expect(beginEncounter).toContain('this.spawnBoss()')
    expect(beginEncounter).not.toContain('await this.audio.unlock()')
  })

  it('routes a first clear through the post-run trial selection policy', () => {
    expect(appSource).toContain('bossTrialSelectionAfterRun(')
    expect(appSource).toContain('progressedSave.bossTrialClears')
    expect(appSource).toContain('runResult.victory')
  })
})
