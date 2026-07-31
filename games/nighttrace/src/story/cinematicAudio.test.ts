import { describe, expect, it, vi } from 'vitest'
import {
  pauseInactiveCinematicAudio,
  seekCinematicAudio,
  type CinematicAudioLike,
} from './cinematicAudio'

function audio(duration = 60) {
  return {
    currentTime: 0,
    duration,
    pause: vi.fn(),
  } satisfies CinematicAudioLike
}

describe('cinematic audio coordination', () => {
  it('does not pause a shared actor reel because another line uses it', () => {
    const starReel = audio()
    const bearerReel = audio()
    const entries = [
      { audio: starReel },
      { audio: starReel },
      { audio: starReel },
      { audio: bearerReel },
    ]

    pauseInactiveCinematicAudio(entries, starReel)

    expect(starReel.pause).not.toHaveBeenCalled()
    expect(bearerReel.pause).toHaveBeenCalledTimes(1)
  })

  it('pauses every physical reel once when there is no active dialogue', () => {
    const starReel = audio()
    const bearerReel = audio()

    pauseInactiveCinematicAudio([
      { audio: starReel },
      { audio: starReel },
      { audio: bearerReel },
      { audio: bearerReel },
    ])

    expect(starReel.pause).toHaveBeenCalledTimes(1)
    expect(bearerReel.pause).toHaveBeenCalledTimes(1)
  })

  it('clamps loaded media seeks and treats unavailable streaming seeks as transient', () => {
    const loaded = audio(10)
    expect(seekCinematicAudio(loaded, 12)).toBe(true)
    expect(loaded.currentTime).toBeCloseTo(9.97)

    const streaming = {
      pause: vi.fn(),
      duration: Number.NaN,
      get currentTime() {
        return 0
      },
      set currentTime(_value: number) {
        throw new DOMException('metadata not ready', 'InvalidStateError')
      },
    }
    expect(seekCinematicAudio(streaming, 4)).toBe(false)
  })
})
