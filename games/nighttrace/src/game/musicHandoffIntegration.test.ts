import { describe, expect, it } from 'vitest'
import appSourceRaw from '../App.tsx?raw'
import audioSourceRaw from './audio.ts?raw'
import runtimeSourceRaw from './GameCanvas.tsx?raw'

const appSource = appSourceRaw.replace(/\r\n/g, '\n')
const audioSource = audioSourceRaw.replace(/\r\n/g, '\n')
const runtimeSource = runtimeSourceRaw.replace(/\r\n/g, '\n')

function section(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('cinematic-to-game music handoff', () => {
  it('captures both the campaign entry gesture and the exact run-launch gesture', () => {
    const beginCampaign = section(
      appSource,
      '  const beginCampaign = useCallback(',
      '  const launchRun = useCallback(',
    )
    const launchRun = section(
      appSource,
      '  const launchRun = useCallback(',
      '  const startLevel = useCallback(',
    )

    expect(beginCampaign).toContain(
      'authorizeNighttraceMusicHandoff(selectedLevelId)',
    )
    expect(launchRun).toContain(
      'authorizeNighttraceMusicHandoff(runConfig.arenaLevelId)',
    )
    expect(launchRun.indexOf('authorizeNighttraceMusicHandoff')).toBeLessThan(
      launchRun.indexOf('setScreen(\'game\')'),
    )
  })

  it('starts the selected final media elements silently inside the trusted gesture', () => {
    const authorize = section(
      audioSource,
      'export function authorizeNighttraceMusicHandoff(',
      'export function hasAuthorizedNighttraceMusicHandoff(',
    )

    expect(authorize).toContain('primeNighttraceMusic(levelId)')
    expect(authorize).toContain('audio.volume = 0')
    expect(authorize).toContain('void audio.play()')
    expect(authorize).toContain('authorizedAudioContext.resume()')
  })

  it('reuses the authorized context and playing elements when Pixi is ready', () => {
    expect(audioSource).toContain(
      'takeAuthorizedAudioContext() ?? new AudioContextConstructor()',
    )
    expect(audioSource).toContain(
      'takeAuthorizedMusicElement(sourceUrl) ?? new Audio()',
    )

    const initializedRuntime = section(
      runtimeSource,
      '      this.initialized = true',
      '      this.emitSnapshot(true)',
    )
    expect(initializedRuntime).toContain(
      'hasAuthorizedNighttraceMusicHandoff(this.level.id)',
    )
    expect(initializedRuntime).toContain('void this.audio.unlock()')
  })
})
