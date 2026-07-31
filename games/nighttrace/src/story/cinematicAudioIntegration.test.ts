import { describe, expect, it } from 'vitest'
import cinematicScreenSourceRaw from '../ui/CinematicScreen.tsx?raw'

const source = cinematicScreenSourceRaw.replace(/\r\n/g, '\n')

function section(startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('cinematic audio runtime integration', () => {
  it('does not let sibling dialogue entries pause a shared active actor reel', () => {
    const sync = section(
      '  const syncAudioToTimeline = useCallback(',
      '  const beginClock = useCallback(',
    )

    expect(sync).toContain('pauseInactiveCinematicAudio(')
    expect(sync).toContain('entry?.audio')
    expect(sync).not.toContain("id !== line?.id")
  })

  it('starts the score and timeline directly from Continue without a buffer barrier', () => {
    const continueFromGesture = section(
      '  const continueFromGesture = useCallback(',
      '  const togglePlayback = useCallback(',
    )

    expect(continueFromGesture).toContain('beginClock(0)')
    expect(continueFromGesture).not.toContain('Promise.allSettled')
    expect(continueFromGesture).not.toContain('.then(() => beginClock')
  })

  it('preloads score and narration media before playback is requested', () => {
    expect(source).toContain('score.load()')
    expect(source).toContain('audio.load()')
    expect(source).toContain('const probe = scoreRef.current')
  })
})
