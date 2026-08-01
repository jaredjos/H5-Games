import { appAssetUrl } from '../assetUrl'
import type { GameSettings, WeaponId } from '../shared/types'
import {
  chooseMusicVariant,
  musicAssetsToPrime,
  musicAssetName,
  musicCrossfadeSeconds,
  musicRouteForLevel,
  resolveMusicLevels,
  type MusicDeviceHints,
  type MusicScene,
  type MusicTrackId,
  type MusicVariant,
} from './audioMix'
import {
  COMBAT_SFX_MAX_TONE_VOICES,
  canAdmitCombatTone,
  combatSfxProfile,
  hostileSpecialSfxCue,
  type CombatSfxCueId,
  type HostileSpecialFootprint,
  type HostileSpecialSource,
} from './combatSfx'

type SoundName =
  | 'shot'
  | 'impact'
  | 'pickup'
  | 'hurt'
  | 'loop'
  | 'pulse'
  | 'boss'
  | 'upgrade'
  | 'victory'
  | 'defeat'

interface SoundShape {
  frequency: number
  endFrequency: number
  duration: number
  volume: number
  type: OscillatorType
}

interface MusicTrack {
  id: MusicTrackId
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
  available: boolean
  pendingPlay?: Promise<void>
  onError: () => void
}

interface ScheduledToneVoice {
  readonly oscillator: OscillatorNode
  readonly filter: BiquadFilterNode
  readonly gain: GainNode
  readonly priority: number
  readonly endsAt: number
}

interface NavigatorWithAudioHints extends Navigator {
  connection?: {
    saveData?: boolean
  }
  deviceMemory?: number
}

const SOUNDS: Record<SoundName, SoundShape> = {
  shot: { frequency: 690, endFrequency: 330, duration: 0.075, volume: 0.045, type: 'triangle' },
  impact: { frequency: 155, endFrequency: 72, duration: 0.09, volume: 0.04, type: 'square' },
  pickup: { frequency: 780, endFrequency: 1180, duration: 0.12, volume: 0.06, type: 'sine' },
  hurt: { frequency: 125, endFrequency: 48, duration: 0.24, volume: 0.11, type: 'sawtooth' },
  loop: { frequency: 260, endFrequency: 820, duration: 0.42, volume: 0.13, type: 'triangle' },
  pulse: { frequency: 82, endFrequency: 440, duration: 0.65, volume: 0.18, type: 'sine' },
  boss: { frequency: 64, endFrequency: 38, duration: 1.1, volume: 0.2, type: 'sawtooth' },
  upgrade: { frequency: 440, endFrequency: 990, duration: 0.36, volume: 0.1, type: 'sine' },
  victory: { frequency: 392, endFrequency: 784, duration: 0.9, volume: 0.14, type: 'triangle' },
  defeat: { frequency: 180, endFrequency: 45, duration: 0.9, volume: 0.15, type: 'sine' },
}

const primedMusic = new Map<string, HTMLAudioElement>()
const authorizedMusicSources = new Set<string>()
let authorizedAudioContext: AudioContext | undefined

function musicDeviceHints(): MusicDeviceHints {
  if (typeof navigator === 'undefined') return {}
  const hints = navigator as NavigatorWithAudioHints
  return {
    saveData: hints.connection?.saveData,
    deviceMemory: hints.deviceMemory,
  }
}

function musicSourcesForLevel(levelId: number) {
  const hints = musicDeviceHints()
  const route = musicRouteForLevel(levelId)
  const variant = chooseMusicVariant(hints)
  return [
    appAssetUrl(`assets/audio/${musicAssetName(route.ambient, variant)}`),
    appAssetUrl(`assets/audio/${musicAssetName(route.boss, variant)}`),
  ]
}

/**
 * Begin downloading the likely encounter and cinematic scores while the
 * player is still choosing a level. Playback remains gesture-gated.
 */
export function primeNighttraceMusic(levelId: number) {
  if (typeof Audio === 'undefined' || typeof navigator === 'undefined') return
  for (const assetName of musicAssetsToPrime(levelId, musicDeviceHints())) {
    const source = appAssetUrl(`assets/audio/${assetName}`)
    if (primedMusic.has(source)) continue
    const audio = new Audio(source)
    audio.preload = 'auto'
    audio.load()
    primedMusic.set(source, audio)
  }
}

/**
 * Capture the trusted UI gesture before React mounts the Pixi runtime. The
 * selected encounter tracks begin silently on their final media elements and
 * a running AudioContext is retained for the runtime to consume. This avoids
 * waiting for a second battlefield tap after a campaign cinematic.
 */
export function authorizeNighttraceMusicHandoff(levelId: number) {
  if (
    typeof Audio === 'undefined' ||
    typeof window === 'undefined' ||
    typeof navigator === 'undefined'
  ) {
    return
  }

  primeNighttraceMusic(levelId)
  const selectedSources = new Set(musicSourcesForLevel(levelId))

  for (const source of authorizedMusicSources) {
    if (selectedSources.has(source)) continue
    const stale = primedMusic.get(source)
    stale?.pause()
    if (stale) {
      try {
        stale.currentTime = 0
      } catch {
        // A not-yet-loaded element is already paused and safe to retain.
      }
    }
    authorizedMusicSources.delete(source)
  }

  if (!authorizedAudioContext || authorizedAudioContext.state === 'closed') {
    try {
      authorizedAudioContext = new window.AudioContext()
    } catch {
      authorizedAudioContext = undefined
    }
  }
  if (authorizedAudioContext?.state === 'suspended') {
    void authorizedAudioContext.resume().catch(() => undefined)
  }

  for (const source of selectedSources) {
    const audio = primedMusic.get(source)
    if (!audio) continue
    audio.loop = true
    audio.volume = 0
    try {
      audio.currentTime = 0
    } catch {
      // Metadata can still be arriving; playback will begin at its default 0.
    }
    authorizedMusicSources.add(source)
    try {
      void audio.play().catch(() => {
        authorizedMusicSources.delete(source)
      })
    } catch {
      authorizedMusicSources.delete(source)
    }
  }
}

export function hasAuthorizedNighttraceMusicHandoff(levelId: number) {
  if (authorizedAudioContext && authorizedAudioContext.state !== 'closed') {
    return true
  }
  return musicSourcesForLevel(levelId).some((source) =>
    authorizedMusicSources.has(source))
}

function takeAuthorizedAudioContext() {
  const context = authorizedAudioContext
  authorizedAudioContext = undefined
  return context
}

function takeAuthorizedMusicElement(source: string) {
  if (!authorizedMusicSources.delete(source)) return undefined
  const element = primedMusic.get(source)
  if (element) primedMusic.delete(source)
  return element
}

export class NighttraceAudio {
  private context?: AudioContext
  private master?: GainNode
  private music?: GainNode
  private sfx?: GainNode
  private musicFilter?: BiquadFilterNode
  private droneGain?: GainNode
  private ambientTrack?: MusicTrack
  private bossTrack?: MusicTrack
  private droneOscillators: OscillatorNode[] = []
  private settings: GameSettings
  private destroyed = false
  private musicScene: MusicScene = 'ambient'
  private bossPhase = 1
  private readonly activeToneVoices: ScheduledToneVoice[] = []
  private readonly lastCombatCueAt = new Map<CombatSfxCueId, number>()
  private resumeAfterLifecyclePause = false
  private resumeTracksAfterLifecyclePause = false
  private lifecycleSuspend?: Promise<void>
  private musicStopTimer?: number
  private musicVariant: MusicVariant = 'full'
  private readonly levelId: number

  constructor(settings: GameSettings, levelId = 1) {
    this.settings = settings
    this.levelId = levelId
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('pagehide', this.suspendForLifecycle)
    window.addEventListener('pageshow', this.resumeFromLifecycle)
  }

  updateSettings(settings: GameSettings) {
    this.settings = settings
    if (!this.context || !this.master || !this.music || !this.sfx) return

    const now = this.context.currentTime
    this.master.gain.setTargetAtTime(settings.masterVolume, now, 0.025)
    this.music.gain.setTargetAtTime(settings.musicVolume, now, 0.025)
    this.sfx.gain.setTargetAtTime(settings.sfxVolume, now, 0.025)
  }

  async unlock() {
    if (this.destroyed) return

    if (!this.context) this.initializeGraph()
    const context = this.context
    if (!context) return

    const playback = this.musicScene === 'ended'
      ? Promise.resolve()
      : this.startMusicPlayback()
    if (context.state === 'suspended') {
      await context.resume().catch(() => {
        // iOS can require another explicit gesture after restoring an installed app.
      })
    }
    await playback
    this.applyMusicScene(0.24)
  }

  play(name: SoundName, intensity = 1) {
    const shape = SOUNDS[name]
    this.scheduleTone({
      frequency: shape.frequency,
      endFrequency: shape.endFrequency,
      duration: shape.duration,
      volume: shape.volume * Math.max(0, Math.min(1.5, intensity)),
      type: shape.type,
      filterFrequency: name === 'pulse' || name === 'boss' ? 1800 : 4300,
    })
  }

  playWeaponCue(weaponId: WeaponId) {
    this.playCombatCue(weaponId)
  }

  playLightRingPulse(rank: number, madeContact: boolean) {
    const safeRank = Math.max(1, Math.min(6, Math.floor(rank)))
    this.playCombatCue(
      'dawnward-aegis',
      1 + (safeRank - 1) * 0.018,
      madeContact ? 1.12 : 0.78,
    )
  }

  playHostileSpecialRelease(
    source: HostileSpecialSource,
    footprint: HostileSpecialFootprint,
  ) {
    this.playCombatCue(hostileSpecialSfxCue(source, footprint))
  }

  playBossIntro() {
    const context = this.context
    if (!context || context.state !== 'running' || this.destroyed) return
    const previousScene = this.musicScene
    this.musicScene = 'boss'
    this.bossPhase = 1
    if (this.musicStopTimer !== undefined) {
      window.clearTimeout(this.musicStopTimer)
      this.musicStopTimer = undefined
    }
    if (this.bossTrack?.available) {
      try {
        this.bossTrack.element.currentTime = 0
      } catch {
        // A streamed track can briefly reject seeks while metadata is settling.
      }
    }
    void this.startMusicPlayback()
    const now = context.currentTime
    this.musicFilter?.frequency.cancelScheduledValues(now)
    this.musicFilter?.frequency.setValueAtTime(
      Math.max(180, this.musicFilter.frequency.value),
      now,
    )
    this.musicFilter?.frequency.exponentialRampToValueAtTime(920, now + 1.25)
    this.applyMusicScene(musicCrossfadeSeconds(previousScene, 'boss'))
    this.play('boss', 1.05)

    const impacts = [
      [0, 55, 39, 0.72, 0.105],
      [0.34, 82.41, 52, 0.46, 0.072],
      [0.68, 73.42, 46, 0.54, 0.078],
      [1.04, 65.41, 36, 0.92, 0.085],
    ] as const
    for (const [delay, frequency, endFrequency, duration, volume] of impacts) {
      this.scheduleTone({
        delay,
        frequency,
        endFrequency,
        duration,
        volume,
        type: 'sawtooth',
        filterFrequency: 1200,
      })
    }
    for (const frequency of [220, 233.08]) {
      this.scheduleTone({
        delay: 0.12,
        frequency,
        endFrequency: frequency * 0.76,
        duration: 1.45,
        volume: 0.023,
        type: 'triangle',
        filterFrequency: 2100,
      })
    }
  }

  playBossPhase(phase: number) {
    const context = this.context
    if (!context || context.state !== 'running' || this.destroyed) return
    this.bossPhase = Math.max(1, Math.min(3, Math.floor(phase)))
    const now = context.currentTime
    this.musicFilter?.frequency.setTargetAtTime(880 + this.bossPhase * 180, now, 0.18)
    this.applyMusicScene(0.32)
    this.play('boss', 0.72 + this.bossPhase * 0.08)
    this.scheduleTone({
      delay: 0.13,
      frequency: 92.5 + this.bossPhase * 8,
      endFrequency: 46,
      duration: 0.68,
      volume: 0.07,
      type: 'square',
      filterFrequency: 920,
    })
    this.scheduleTone({
      delay: 0.24,
      frequency: 277.18,
      endFrequency: 155.56,
      duration: 0.76,
      volume: 0.032,
      type: 'triangle',
      filterFrequency: 2400,
    })
  }

  playGameEnd(victory: boolean) {
    const context = this.context
    if (!context || context.state !== 'running' || this.destroyed) return
    const previousScene = this.musicScene
    this.musicScene = 'ended'
    const now = context.currentTime
    this.applyMusicScene(musicCrossfadeSeconds(previousScene, 'ended'))
    this.musicFilter?.frequency.setTargetAtTime(victory ? 1250 : 240, now, 0.2)
    this.play(victory ? 'victory' : 'defeat', 1.1)
    this.musicStopTimer = window.setTimeout(() => {
      this.musicStopTimer = undefined
      this.pauseMusicTracks()
    }, 720)

    if (victory) {
      const chords = [
        { delay: 0.02, notes: [196, 246.94, 293.66], duration: 0.9, volume: 0.032 },
        { delay: 0.56, notes: [261.63, 329.63, 392], duration: 1.15, volume: 0.035 },
      ]
      for (const chord of chords) {
        for (const frequency of chord.notes) {
          this.scheduleTone({
            delay: chord.delay,
            frequency,
            endFrequency: frequency * 1.01,
            duration: chord.duration,
            volume: chord.volume,
            type: 'triangle',
            filterFrequency: 3600,
          })
        }
      }
      this.scheduleTone({
        frequency: 65.41,
        endFrequency: 32.7,
        duration: 0.72,
        volume: 0.09,
        type: 'sine',
        filterFrequency: 680,
      })
    } else {
      const descent = [
        [0.02, 130.81, 98, 0.62],
        [0.34, 116.54, 73.42, 0.72],
        [0.7, 98, 55, 0.94],
      ] as const
      for (const [delay, frequency, endFrequency, duration] of descent) {
        this.scheduleTone({
          delay,
          frequency,
          endFrequency,
          duration,
          volume: 0.052,
          type: 'sawtooth',
          filterFrequency: 980,
        })
      }
      this.scheduleTone({
        delay: 0.84,
        frequency: 65.41,
        endFrequency: 28,
        duration: 0.82,
        volume: 0.082,
        type: 'sine',
        filterFrequency: 620,
      })
    }
  }

  private initializeGraph() {
    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) return

    const context = takeAuthorizedAudioContext() ?? new AudioContextConstructor()
    const master = context.createGain()
    const music = context.createGain()
    const sfx = context.createGain()
    const compressor = context.createDynamicsCompressor()

    master.gain.value = this.settings.masterVolume
    music.gain.value = this.settings.musicVolume
    sfx.gain.value = this.settings.sfxVolume

    compressor.threshold.value = -18
    compressor.knee.value = 16
    compressor.ratio.value = 5
    compressor.attack.value = 0.005
    compressor.release.value = 0.18

    music.connect(master)
    sfx.connect(master)
    master.connect(compressor)
    compressor.connect(context.destination)

    this.context = context
    this.master = master
    this.music = music
    this.sfx = sfx
    this.startDrone()
    this.createMusicTracks()
    this.updateSettings(this.settings)
    this.applyMusicScene(0)
  }

  private createMusicTracks() {
    const context = this.context
    const output = this.music
    if (!context || !output || typeof Audio === 'undefined') return

    const navigatorHints = navigator as NavigatorWithAudioHints
    this.musicVariant = chooseMusicVariant({
      saveData: navigatorHints.connection?.saveData,
      deviceMemory: navigatorHints.deviceMemory,
    })
    const route = musicRouteForLevel(this.levelId)
    this.ambientTrack = this.createMusicTrack(route.ambient, 'ambient')
    this.bossTrack = this.createMusicTrack(route.boss, 'boss')
  }

  private createMusicTrack(
    id: MusicTrackId,
    role: 'ambient' | 'boss',
  ): MusicTrack | undefined {
    const context = this.context
    const output = this.music
    if (!context || !output) return undefined

    const sourceUrl = this.musicTrackUrl(id)
    const element = takeAuthorizedMusicElement(sourceUrl) ?? new Audio()
    try {
      element.loop = true
      element.preload = role === 'ambient' ? 'auto' : 'metadata'
      if (!element.src) element.src = sourceUrl
      const source = context.createMediaElementSource(element)
      const gain = context.createGain()
      gain.gain.value = 0
      source.connect(gain)
      gain.connect(output)
      // Authorized elements are already playing at zero volume. Restore their
      // level only after MediaElementSource owns the route and its gain is 0.
      element.volume = 1
      const track: MusicTrack = {
        id,
        element,
        source,
        gain,
        available: false,
        onError: () => undefined,
      }
      track.onError = () => this.handleTrackError(track)
      element.addEventListener('error', track.onError)
      return track
    } catch {
      // Local/file launchers and hardened browsers can reject media routing.
      // The procedural drone remains a complete, low-cost fallback.
      element.pause()
      return undefined
    }
  }

  private musicTrackUrl(id: MusicTrackId) {
    return appAssetUrl(
      `assets/audio/${musicAssetName(id, this.musicVariant)}`,
    )
  }

  private handleTrackError(track: MusicTrack) {
    if (this.destroyed) return
    track.available = false
    this.applyMusicScene(0.45)
  }

  private async startMusicPlayback() {
    const attempts = [this.ambientTrack, this.bossTrack]
      .filter((track): track is MusicTrack => Boolean(track))
      .map((track) => this.startTrack(track))
    await Promise.all(attempts)
  }

  private startTrack(track: MusicTrack) {
    if (this.destroyed || this.musicScene === 'ended') return Promise.resolve()
    if (!track.element.paused) {
      track.available = true
      return Promise.resolve()
    }
    if (track.pendingPlay) return track.pendingPlay
    const playPromise = track.element
      .play()
      .then(() => {
        if (this.destroyed) return
        track.available = true
        this.applyMusicScene(0.38)
      })
      .catch(() => {
        track.available = false
        this.applyMusicScene(0.38)
      })
      .finally(() => {
        track.pendingPlay = undefined
      })
    track.pendingPlay = playPromise
    return playPromise
  }

  private pauseMusicTracks() {
    let wasPlaying = false
    for (const track of [this.ambientTrack, this.bossTrack]) {
      if (!track) continue
      wasPlaying ||= !track.element.paused
      track.element.pause()
    }
    return wasPlaying
  }

  private applyMusicScene(duration: number) {
    const context = this.context
    const ambientGain = this.ambientTrack?.gain
    const bossGain = this.bossTrack?.gain
    const droneGain = this.droneGain
    if (!context || !droneGain) return

    const levels = resolveMusicLevels(
      this.musicScene,
      {
        ambient: this.ambientTrack?.available ?? false,
        boss: this.bossTrack?.available ?? false,
      },
      this.bossPhase,
    )
    const now = context.currentTime
    if (ambientGain) this.rampGain(ambientGain.gain, levels.ambient, now, duration)
    if (bossGain) this.rampGain(bossGain.gain, levels.boss, now, duration)
    this.rampGain(droneGain.gain, levels.drone, now, duration)
  }

  private rampGain(param: AudioParam, value: number, now: number, duration: number) {
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    if (duration <= 0) param.setValueAtTime(value, now)
    else param.linearRampToValueAtTime(value, now + duration)
  }

  private playCombatCue(
    cueId: CombatSfxCueId,
    pitchScale = 1,
    volumeScale = 1,
  ) {
    const context = this.context
    if (!context || context.state !== 'running' || this.destroyed) return
    const profile = combatSfxProfile(cueId)
    const lastPlayed = this.lastCombatCueAt.get(cueId) ?? Number.NEGATIVE_INFINITY
    if (context.currentTime - lastPlayed < profile.cooldownSeconds) return

    let scheduled = false
    for (const tone of profile.tones) {
      scheduled = this.scheduleTone({
        ...tone,
        frequency: tone.frequency * pitchScale,
        endFrequency: tone.endFrequency * pitchScale,
        volume: tone.volume * volumeScale,
        priority: profile.priority,
      }) || scheduled
    }
    if (scheduled) this.lastCombatCueAt.set(cueId, context.currentTime)
  }

  private releaseToneVoice(voice: ScheduledToneVoice, stop = false) {
    const index = this.activeToneVoices.indexOf(voice)
    if (index < 0) return
    this.activeToneVoices.splice(index, 1)
    if (stop) {
      try {
        voice.oscillator.stop()
      } catch {
        // The voice may already have ended between admission and eviction.
      }
    }
    try {
      voice.oscillator.disconnect()
      voice.filter.disconnect()
      voice.gain.disconnect()
    } catch {
      // Nodes can already be disconnected by browser audio teardown.
    }
  }

  private admitToneVoice(priority: number, now: number) {
    for (let index = this.activeToneVoices.length - 1; index >= 0; index -= 1) {
      const voice = this.activeToneVoices[index]
      if (voice.endsAt <= now) this.releaseToneVoice(voice)
    }
    const priorities = this.activeToneVoices.map((voice) => voice.priority)
    if (!canAdmitCombatTone(priorities, priority)) return false
    if (this.activeToneVoices.length < COMBAT_SFX_MAX_TONE_VOICES) return true

    let victim = this.activeToneVoices[0]
    for (const candidate of this.activeToneVoices) {
      if (
        candidate.priority < victim.priority ||
        (candidate.priority === victim.priority && candidate.endsAt < victim.endsAt)
      ) {
        victim = candidate
      }
    }
    this.releaseToneVoice(victim, true)
    return true
  }

  private scheduleTone({
    delay = 0,
    frequency,
    endFrequency,
    duration,
    volume,
    type,
    filterFrequency,
    priority = 1,
  }: {
    delay?: number
    frequency: number
    endFrequency: number
    duration: number
    volume: number
    type: OscillatorType
    filterFrequency: number
    priority?: number
  }) {
    const context = this.context
    const output = this.sfx
    if (!context || !output || context.state !== 'running' || this.destroyed) return false
    const now = context.currentTime + Math.max(0, delay)
    if (!this.admitToneVoice(priority, context.currentTime)) return false
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const filter = context.createBiquadFilter()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now)
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      now + duration,
    )
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(filterFrequency, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(output)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
    const voice: ScheduledToneVoice = {
      oscillator,
      filter,
      gain,
      priority,
      endsAt: now + duration + 0.02,
    }
    this.activeToneVoices.push(voice)
    oscillator.addEventListener('ended', () => {
      this.releaseToneVoice(voice)
    })
    return true
  }

  private startDrone() {
    const context = this.context
    const output = this.music
    if (!context || !output) return

    const gain = context.createGain()
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 460
    filter.Q.value = 0.8
    filter.connect(gain)
    gain.connect(output)
    this.musicFilter = filter
    this.droneGain = gain

    for (const [frequency, detune] of [
      [55, -4],
      [82.41, 3],
      [110, 1],
    ] as const) {
      const oscillator = context.createOscillator()
      const oscillatorGain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      oscillator.detune.value = detune
      oscillatorGain.gain.value = frequency === 55 ? 0.52 : 0.19
      oscillator.connect(oscillatorGain)
      oscillatorGain.connect(filter)
      oscillator.start()
      this.droneOscillators.push(oscillator)
    }
  }

  private suspendForLifecycle = () => {
    const context = this.context
    if (!context || context.state !== 'running' || this.destroyed) return
    this.resumeAfterLifecyclePause = true
    this.resumeTracksAfterLifecyclePause = this.pauseMusicTracks()
    this.lifecycleSuspend = context.suspend().catch(() => undefined)
  }

  private resumeFromLifecycle = () => {
    const context = this.context
    if (
      !context ||
      !this.resumeAfterLifecyclePause ||
      this.destroyed ||
      document.hidden
    ) {
      return
    }
    this.resumeAfterLifecyclePause = false
    const shouldResumeTracks = this.resumeTracksAfterLifecyclePause
    this.resumeTracksAfterLifecyclePause = false
    const pendingSuspend = this.lifecycleSuspend
    void (async () => {
      await pendingSuspend
      if (this.destroyed || this.context !== context || document.hidden) return
      if (context.state === 'suspended') {
        await context.resume().catch(() => {
          // Some mobile browsers require a fresh gesture after restoring a page.
        })
      }
      if (shouldResumeTracks && this.musicScene !== 'ended') {
        await this.startMusicPlayback()
      }
    })()
  }

  private handleVisibilityChange = () => {
    if (document.hidden) this.suspendForLifecycle()
    else this.resumeFromLifecycle()
  }

  destroy() {
    this.destroyed = true
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('pagehide', this.suspendForLifecycle)
    window.removeEventListener('pageshow', this.resumeFromLifecycle)
    if (this.musicStopTimer !== undefined) {
      window.clearTimeout(this.musicStopTimer)
      this.musicStopTimer = undefined
    }
    for (const track of [this.ambientTrack, this.bossTrack]) {
      if (!track) continue
      track.element.removeEventListener('error', track.onError)
      track.element.pause()
      track.element.removeAttribute('src')
      track.element.load()
      track.source.disconnect()
      track.gain.disconnect()
    }
    this.ambientTrack = undefined
    this.bossTrack = undefined
    for (const oscillator of this.droneOscillators) {
      try {
        oscillator.stop()
      } catch {
        // It may already have stopped during browser teardown.
      }
    }
    this.droneOscillators = []
    for (const voice of [...this.activeToneVoices]) {
      this.releaseToneVoice(voice, true)
    }
    this.lastCombatCueAt.clear()
    void this.context?.close()
    this.context = undefined
    this.master = undefined
    this.music = undefined
    this.sfx = undefined
    this.musicFilter = undefined
    this.droneGain = undefined
    this.resumeAfterLifecyclePause = false
    this.resumeTracksAfterLifecyclePause = false
    this.lifecycleSuspend = undefined
  }
}
