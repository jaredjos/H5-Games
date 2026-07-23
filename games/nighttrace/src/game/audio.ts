import type { GameSettings } from '../shared/types'

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

export class NighttraceAudio {
  private context?: AudioContext
  private master?: GainNode
  private music?: GainNode
  private sfx?: GainNode
  private musicFilter?: BiquadFilterNode
  private droneOscillators: OscillatorNode[] = []
  private settings: GameSettings
  private destroyed = false
  private bossMode = false
  private lastBossAttackAt = -10

  constructor(settings: GameSettings) {
    this.settings = settings
  }

  updateSettings(settings: GameSettings) {
    this.settings = settings
    if (!this.context || !this.master || !this.music || !this.sfx) return

    const now = this.context.currentTime
    this.master.gain.setTargetAtTime(settings.masterVolume, now, 0.025)
    this.music.gain.setTargetAtTime(
      settings.musicVolume * (this.bossMode ? 0.22 : 0.16),
      now,
      0.025,
    )
    this.sfx.gain.setTargetAtTime(settings.sfxVolume, now, 0.025)
  }

  async unlock() {
    if (this.destroyed) return

    if (!this.context) {
      const AudioContextConstructor = window.AudioContext
      if (!AudioContextConstructor) return

      const context = new AudioContextConstructor()
      const master = context.createGain()
      const music = context.createGain()
      const sfx = context.createGain()
      const compressor = context.createDynamicsCompressor()

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
      this.updateSettings(this.settings)
    }

    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
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

  playBossIntro() {
    const context = this.context
    if (!context || context.state !== 'running' || this.destroyed) return
    this.bossMode = true
    const now = context.currentTime
    this.musicFilter?.frequency.cancelScheduledValues(now)
    this.musicFilter?.frequency.setValueAtTime(
      Math.max(180, this.musicFilter.frequency.value),
      now,
    )
    this.musicFilter?.frequency.exponentialRampToValueAtTime(920, now + 1.25)
    this.updateSettings(this.settings)
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
    const now = context.currentTime
    this.musicFilter?.frequency.setTargetAtTime(880 + phase * 180, now, 0.18)
    this.play('boss', 0.72 + phase * 0.08)
    this.scheduleTone({
      delay: 0.13,
      frequency: 92.5 + phase * 8,
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

  playBossAttack(phase: number, pattern: number) {
    const context = this.context
    if (!context || context.state !== 'running' || this.destroyed) return
    if (context.currentTime - this.lastBossAttackAt < 0.16) return
    this.lastBossAttackAt = context.currentTime
    const patternOffset = [0, 7, -5, 12, -9][pattern] ?? 0
    this.scheduleTone({
      frequency: 78 + phase * 5 + patternOffset,
      endFrequency: 42 + patternOffset * 0.2,
      duration: 0.3 + phase * 0.035,
      volume: 0.045 + phase * 0.008,
      type: pattern === 3 ? 'triangle' : 'sawtooth',
      filterFrequency: 1380,
    })
  }

  playGameEnd(victory: boolean) {
    const context = this.context
    if (!context || context.state !== 'running' || this.destroyed) return
    this.bossMode = false
    const now = context.currentTime
    this.music?.gain.cancelScheduledValues(now)
    this.music?.gain.setValueAtTime(this.music.gain.value, now)
    this.music?.gain.linearRampToValueAtTime(0, now + 0.42)
    this.musicFilter?.frequency.setTargetAtTime(victory ? 1250 : 240, now, 0.2)
    this.play(victory ? 'victory' : 'defeat', 1.1)

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

  private scheduleTone({
    delay = 0,
    frequency,
    endFrequency,
    duration,
    volume,
    type,
    filterFrequency,
  }: {
    delay?: number
    frequency: number
    endFrequency: number
    duration: number
    volume: number
    type: OscillatorType
    filterFrequency: number
  }) {
    const context = this.context
    const output = this.sfx
    if (!context || !output || context.state !== 'running' || this.destroyed) return
    const now = context.currentTime + Math.max(0, delay)
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
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect()
      filter.disconnect()
      gain.disconnect()
    })
  }

  private startDrone() {
    const context = this.context
    const output = this.music
    if (!context || !output) return

    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 460
    filter.Q.value = 0.8
    filter.connect(output)
    this.musicFilter = filter

    for (const [frequency, detune] of [
      [55, -4],
      [82.41, 3],
      [110, 1],
    ] as const) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      oscillator.detune.value = detune
      gain.gain.value = frequency === 55 ? 0.52 : 0.19
      oscillator.connect(gain)
      gain.connect(filter)
      oscillator.start()
      this.droneOscillators.push(oscillator)
    }
  }

  destroy() {
    this.destroyed = true
    for (const oscillator of this.droneOscillators) {
      try {
        oscillator.stop()
      } catch {
        // It may already have stopped during browser teardown.
      }
    }
    this.droneOscillators = []
    void this.context?.close()
    this.context = undefined
    this.master = undefined
    this.music = undefined
    this.sfx = undefined
    this.musicFilter = undefined
  }
}
