import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeAudio {
  static instances: FakeAudio[] = []

  src: string
  preload = ''
  loop = false
  volume = 1
  currentTime = 0
  paused = true
  readonly load = vi.fn()
  readonly pause = vi.fn(() => {
    this.paused = true
  })
  readonly play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })

  constructor(source = '') {
    this.src = source
    FakeAudio.instances.push(this)
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  state: AudioContextState = 'suspended'
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })

  constructor() {
    FakeAudioContext.instances.push(this)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  FakeAudio.instances = []
  FakeAudioContext.instances = []
})

describe('authorized music handoff', () => {
  it('starts the selected stage tracks silently and resumes one reusable context', async () => {
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('navigator', { connection: {}, deviceMemory: 8 })
    vi.stubGlobal('window', { AudioContext: FakeAudioContext })

    const {
      authorizeNighttraceMusicHandoff,
      hasAuthorizedNighttraceMusicHandoff,
    } = await import('./audio')

    authorizeNighttraceMusicHandoff(1)
    await Promise.resolve()

    const playing = FakeAudio.instances.filter((audio) => !audio.paused)
    expect(playing).toHaveLength(2)
    expect(playing.every((audio) => audio.volume === 0)).toBe(true)
    expect(playing.some((audio) => audio.src.endsWith('nighttrace-haunted-loop.mp3')))
      .toBe(true)
    expect(playing.some((audio) => audio.src.endsWith('nighttrace-boss-loop.mp3')))
      .toBe(true)
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(FakeAudioContext.instances[0]?.resume).toHaveBeenCalledOnce()
    expect(hasAuthorizedNighttraceMusicHandoff(1)).toBe(true)
  })

  it('re-arms the same context and retires a stale ambient route', async () => {
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('navigator', { connection: {}, deviceMemory: 8 })
    vi.stubGlobal('window', { AudioContext: FakeAudioContext })

    const { authorizeNighttraceMusicHandoff } = await import('./audio')
    authorizeNighttraceMusicHandoff(1)
    await Promise.resolve()
    const haunted = FakeAudio.instances.find((audio) =>
      audio.src.endsWith('nighttrace-haunted-loop.mp3'))

    authorizeNighttraceMusicHandoff(3)
    await Promise.resolve()

    expect(haunted?.pause).toHaveBeenCalledOnce()
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(
      FakeAudio.instances.find((audio) =>
        audio.src.endsWith('nighttrace-retro-loop.mp3'))?.play,
    ).toHaveBeenCalledOnce()
  })
})
