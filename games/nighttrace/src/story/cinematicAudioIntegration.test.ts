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

  it('enforces each authored clip end before the already-playing fast path', () => {
    const sync = section(
      '  const syncAudioToTimeline = useCallback(',
      '  const beginClock = useCallback(',
    )
    const clipEnd = sync.indexOf('if (clipPosition.reachedEnd)')
    const alreadyPlaying = sync.indexOf(
      'if (activeAudioIdRef.current === line.id && !entry.audio.paused) return',
    )

    expect(clipEnd).toBeGreaterThanOrEqual(0)
    expect(alreadyPlaying).toBeGreaterThan(clipEnd)
  })

  it('marks a rejected line failed so it is not retried every animation frame', () => {
    const sync = section(
      '  const syncAudioToTimeline = useCallback(',
      '  const beginClock = useCallback(',
    )

    expect(sync).toContain('pendingAudioIdsRef.current.has(line.id)')
    expect(sync).toContain('failedAudioIdsRef.current.add(line.id)')
    expect(sync).toContain('.catch(markPlayFailed)')
  })

  it('starts the score and timeline directly from Continue without a buffer barrier', () => {
    const continueFromGesture = section(
      '  const continueFromGesture = useCallback(',
      '  const togglePlayback = useCallback(',
    )

    expect(continueFromGesture).toContain('beginClock(0)')
    expect(continueFromGesture).toContain('.then(() => {')
    expect(continueFromGesture.indexOf('.then(() => {'))
      .toBeLessThan(continueFromGesture.indexOf('audio.pause()'))
    expect(continueFromGesture).not.toContain('Promise.allSettled')
    expect(continueFromGesture).not.toContain('.then(() => beginClock')
  })

  it('preloads score and narration media before playback is requested', () => {
    expect(source).toContain('score.load()')
    expect(source).toContain('audio.load()')
    expect(source).toContain('const probe = scoreRef.current')
  })

  it('uses authored key art and dialogue portraits without a duplicate runtime hero layer', () => {
    expect(source).not.toContain('const heroAsset =')
    expect(source).not.toContain('nt-cinematic__hero')
    expect(source).not.toContain('heroKeyframeAsset')
    expect(source).toContain('{hasNarration && narrationUnavailable ? (')
    expect(source).toContain('{hasNarration ? (')
    expect(source).toContain('{captionsVisible && activeLine ? (')
    expect(source).toContain('getCinematicPortrait(activeLine)')
    expect(source).not.toContain(
      '{captionsVisible && activeLine && activePortrait ? (',
    )
  })
})
