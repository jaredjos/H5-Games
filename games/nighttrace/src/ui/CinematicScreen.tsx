import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Captions,
  CaptionsOff,
  CirclePause,
  CirclePlay,
  LogOut,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { appAssetUrl } from '../assetUrl'
import type { GameSettings } from '../shared/types'
import {
  cinematicClipPosition,
  pauseInactiveCinematicAudio,
  seekCinematicAudio,
} from '../story/cinematicAudio'
import type {
  CampaignCinematic,
  CinematicLine,
  CinematicSpeaker,
} from '../story/cinematics'
import { getCinematicPortrait } from '../story/cinematicPortraits'
import './CinematicScreen.css'

type PlaybackState = 'probing' | 'awaiting-gesture' | 'playing' | 'paused' | 'finished'
type FinishReason = 'natural' | 'skip' | 'replay-exit'

type CinematicPresentation = CampaignCinematic & {
  kicker?: string
  summary?: string
  progressLabels?: string[]
  heroKeyframeAsset?: string
}

type CinematicSettings = GameSettings & {
  subtitles?: boolean
  voiceVolume?: number
}

interface AudioEntry {
  audio: HTMLAudioElement
  line: CinematicLine
}

interface ParticleStyle extends CSSProperties {
  '--particle-x': string
  '--particle-y': string
  '--particle-size': string
  '--particle-delay': string
  '--particle-duration': string
  '--particle-drift-x': string
  '--particle-drift-y': string
  '--particle-opacity': string
}

export interface CinematicScreenProps {
  cinematic: CampaignCinematic
  settings: GameSettings
  onComplete: () => void
  onSkip: () => void
  onReplayExit?: () => void
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const SPEAKER_THEME: Readonly<Record<CinematicSpeaker, string>> = {
  Bearer: 'bearer',
  'Last Star': 'last-star',
  'Sun-Eater': 'sun-eater',
  'Cartographer echo': 'cartographer',
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededUnit(seed: number) {
  let value = seed + 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

function makeParticles(id: string, count = 28) {
  const base = hashString(id)
  return Array.from({ length: count }, (_, index) => {
    const sample = (offset: number) => seededUnit(base + index * 37 + offset * 997)
    const style: ParticleStyle = {
      '--particle-x': `${4 + sample(1) * 92}%`,
      '--particle-y': `${8 + sample(2) * 84}%`,
      '--particle-size': `${1 + sample(3) * 2.4}px`,
      '--particle-delay': `${-sample(4) * 11}s`,
      '--particle-duration': `${7 + sample(5) * 10}s`,
      '--particle-drift-x': `${-22 + sample(6) * 44}px`,
      '--particle-drift-y': `${-30 - sample(7) * 54}px`,
      '--particle-opacity': `${0.18 + sample(8) * 0.5}`,
    }
    return { id: `${id}-mote-${index}`, style }
  })
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  return reduced
}

function isAutoplayBlock(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError'
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function CinematicSession({
  cinematic,
  settings,
  onComplete,
  onSkip,
  onReplayExit,
}: CinematicScreenProps) {
  const scene = cinematic as CinematicPresentation
  const cinematicSettings = settings as CinematicSettings
  const prefersReducedMotion = usePrefersReducedMotion()
  const reducedMotion = settings.reducedShake || prefersReducedMotion
  const reducedFlash = settings.reducedFlash || prefersReducedMotion
  const narrationGain = clamp(
    settings.masterVolume * (cinematicSettings.voiceVolume ?? 1),
    0,
    1,
  )
  const scoreGain = clamp(
    settings.masterVolume * settings.musicVolume * 0.28,
    0,
    0.34,
  )
  const rootRef = useRef<HTMLElement>(null)
  const scoreRef = useRef<HTMLAudioElement | null>(null)
  const audioEntriesRef = useRef<Map<string, AudioEntry>>(new Map())
  const activeAudioIdRef = useRef<string | null>(null)
  const failedAudioIdsRef = useRef<Set<string>>(new Set())
  const endedAudioIdsRef = useRef<Set<string>>(new Set())
  const pendingAudioIdsRef = useRef<Set<string>>(new Set())
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const offsetRef = useRef(0)
  const elapsedRef = useRef(0)
  const finishedRef = useRef(false)
  const lifecycleRef = useRef(0)
  const callbacksRef = useRef({ onComplete, onSkip, onReplayExit })
  const mutedRef = useRef(false)
  const volumeRef = useRef(narrationGain)

  const [playback, setPlayback] = useState<PlaybackState>('probing')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [captionsVisible, setCaptionsVisible] = useState(
    cinematicSettings.subtitles ?? true,
  )
  const [muted, setMuted] = useState(false)
  const [narrationUnavailable, setNarrationUnavailable] = useState(false)

  const particles = useMemo(() => makeParticles(cinematic.id), [cinematic.id])
  const durationMs = Math.max(1, cinematic.durationMs)
  const progress = clamp(elapsedMs / durationMs, 0, 1)
  const activeLine =
    cinematic.lines.find(
      (line) => elapsedMs >= line.startMs && elapsedMs < line.endMs,
    ) ?? null
  const activePortrait = activeLine
    ? getCinematicPortrait(activeLine)
    : null
  const hasNarration = cinematic.lines.some((line) => Boolean(line.audioSrc))
  const activeBeat =
    cinematic.beats?.find(
      (beat) => elapsedMs >= beat.startMs && elapsedMs < beat.endMs,
    ) ?? null
  const heroAsset = cinematic.kind === 'interlude'
    ? undefined
    : scene.heroKeyframeAsset ?? cinematic.heroAsset
  const progressLabels =
    scene.progressLabels?.slice(0, 3) ??
    [
      cinematic.kind === 'intro' ? 'Prelude' : cinematic.chapterLabel,
      cinematic.title,
      cinematic.kind === 'finale' ? 'Dawn' : 'The Wake',
    ]

  const pauseAllAudio = useCallback(() => {
    pauseInactiveCinematicAudio(audioEntriesRef.current.values())
    scoreRef.current?.pause()
    activeAudioIdRef.current = null
  }, [])

  const finishOnce = useCallback(
    (reason: FinishReason) => {
      if (finishedRef.current) return
      finishedRef.current = true
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      pauseAllAudio()
      setPlayback('finished')

      if (reason === 'natural') callbacksRef.current.onComplete()
      else if (reason === 'skip') callbacksRef.current.onSkip()
      else callbacksRef.current.onReplayExit?.()
    },
    [pauseAllAudio],
  )

  const syncAudioToTimeline = useCallback(
    (timeMs: number) => {
      const line =
        cinematic.lines.find(
          (candidate) => timeMs >= candidate.startMs && timeMs < candidate.endMs,
        ) ?? null
      const entry = line ? audioEntriesRef.current.get(line.id) : undefined

      pauseInactiveCinematicAudio(
        audioEntriesRef.current.values(),
        entry?.audio,
      )

      if (
        !line ||
        !entry ||
        failedAudioIdsRef.current.has(line.id) ||
        endedAudioIdsRef.current.has(line.id) ||
        playback === 'paused'
      ) {
        activeAudioIdRef.current = null
        return
      }

      const clipPosition = cinematicClipPosition(
        timeMs,
        line.startMs,
        line.audioStartMs,
        line.audioEndMs,
      )
      if (clipPosition.reachedEnd) {
        entry.audio.pause()
        endedAudioIdsRef.current.add(line.id)
        pendingAudioIdsRef.current.delete(line.id)
        activeAudioIdRef.current = null
        return
      }

      entry.audio.volume = mutedRef.current ? 0 : volumeRef.current
      if (activeAudioIdRef.current === line.id && !entry.audio.paused) return
      if (pendingAudioIdsRef.current.has(line.id)) return

      if (!seekCinematicAudio(entry.audio, clipPosition.sourceTime)) {
        activeAudioIdRef.current = null
        return
      }

      const lifecycle = lifecycleRef.current
      const markPlayFailed = () => {
        if (lifecycleRef.current !== lifecycle) return
        pendingAudioIdsRef.current.delete(line.id)
        failedAudioIdsRef.current.add(line.id)
        entry.audio.pause()
        setNarrationUnavailable(true)
        if (activeAudioIdRef.current === line.id) {
          activeAudioIdRef.current = null
        }
      }

      pendingAudioIdsRef.current.add(line.id)
      activeAudioIdRef.current = line.id
      try {
        void entry.audio
          .play()
          .then(() => {
            if (lifecycleRef.current === lifecycle) {
              pendingAudioIdsRef.current.delete(line.id)
            }
          })
          .catch(markPlayFailed)
      } catch {
        markPlayFailed()
      }
    },
    [cinematic.lines, playback],
  )

  const beginClock = useCallback((fromMs = 0) => {
    const safeTime = clamp(fromMs, 0, durationMs)
    offsetRef.current = safeTime
    elapsedRef.current = safeTime
    setElapsedMs(safeTime)
    startedAtRef.current = performance.now()
    void scoreRef.current?.play().catch(() => {
      // Narration and captions still carry the scene when music is blocked.
    })
    setPlayback('playing')
  }, [durationMs])

  const continueFromGesture = useCallback(() => {
    if (playback !== 'awaiting-gesture') return
    const uniqueAudio = [
      ...new Set(
        [...audioEntriesRef.current.values()].map((entry) => entry.audio),
      ),
    ]
    for (const audio of uniqueAudio) {
      audio.volume = 0
      seekCinematicAudio(audio, 0)
      try {
        const attempt = audio.play()
        audio.pause()
        void attempt.catch(() => undefined).finally(() => {
          audio.volume = mutedRef.current ? 0 : volumeRef.current
        })
      } catch {
        audio.pause()
        audio.volume = mutedRef.current ? 0 : volumeRef.current
      }
    }

    // Keep this synchronous with the trusted click. Waiting for all three
    // actor reels to buffer delayed both the score and the scene by seconds.
    beginClock(0)
  }, [beginClock, playback])

  const togglePlayback = useCallback(() => {
    if (playback === 'awaiting-gesture') {
      continueFromGesture()
      return
    }
    if (playback === 'playing') {
      const now = performance.now()
      const current = clamp(
        offsetRef.current + now - startedAtRef.current,
        0,
        durationMs,
      )
      offsetRef.current = current
      elapsedRef.current = current
      setElapsedMs(current)
      pauseAllAudio()
      setPlayback('paused')
      return
    }
    if (playback === 'paused') {
      startedAtRef.current = performance.now()
      void scoreRef.current?.play().catch(() => {
        // Captions remain available when media playback is denied.
      })
      setPlayback('playing')
    }
  }, [
    continueFromGesture,
    durationMs,
    pauseAllAudio,
    playback,
  ])

  useEffect(() => {
    callbacksRef.current = { onComplete, onSkip, onReplayExit }
  }, [onComplete, onReplayExit, onSkip])

  useEffect(() => {
    mutedRef.current = muted
    volumeRef.current = narrationGain
    for (const { audio } of audioEntriesRef.current.values()) {
      audio.volume = muted ? 0 : narrationGain
    }
    if (scoreRef.current) scoreRef.current.volume = muted ? 0 : scoreGain
  }, [muted, narrationGain, scoreGain])

  useEffect(() => {
    const score = new Audio(
      appAssetUrl(
        cinematic.kind === 'finale'
          ? 'assets/audio/nighttrace-boss-loop-compact.mp3'
          : 'assets/audio/nighttrace-haunted-loop-compact.mp3',
      ),
    )
    score.loop = true
    score.preload = 'auto'
    score.volume = mutedRef.current ? 0 : scoreGain
    scoreRef.current = score
    score.load()

    return () => {
      score.pause()
      score.removeAttribute('src')
      score.load()
      if (scoreRef.current === score) scoreRef.current = null
    }
  }, [cinematic.id, cinematic.kind, scoreGain])

  useEffect(() => {
    const generation = lifecycleRef.current + 1
    const pendingAudioIds = pendingAudioIdsRef.current
    lifecycleRef.current = generation
    failedAudioIdsRef.current.clear()
    endedAudioIdsRef.current.clear()
    pendingAudioIds.clear()
    activeAudioIdRef.current = null

    const entries = new Map<string, AudioEntry>()
    const linesBySource = new Map<string, CinematicLine[]>()
    for (const line of cinematic.lines) {
      if (!line.audioSrc) continue
      const source = appAssetUrl(line.audioSrc)
      const group = linesBySource.get(source) ?? []
      group.push(line)
      linesBySource.set(source, group)
    }

    for (const [source, sourceLines] of linesBySource) {
      const audio = new Audio(source)
      const fallbackSource = sourceLines
        .map((line) => line.audioFallbackSrc)
        .find((value): value is string => Boolean(value))
      const fallbackUrl = fallbackSource ? appAssetUrl(fallbackSource) : undefined
      audio.preload = 'auto'
      audio.volume = volumeRef.current
      audio.load()
      audio.addEventListener('ended', () => {
        if (lifecycleRef.current !== generation) return
        const activeId = activeAudioIdRef.current
        if (activeId && sourceLines.some((line) => line.id === activeId)) {
          endedAudioIdsRef.current.add(activeId)
          activeAudioIdRef.current = null
        }
      })
      audio.addEventListener('error', () => {
        if (lifecycleRef.current !== generation) return
        if (fallbackUrl && audio.src !== fallbackUrl) {
          audio.src = fallbackUrl
          audio.load()
          return
        }
        for (const line of sourceLines) failedAudioIdsRef.current.add(line.id)
        setNarrationUnavailable(true)
      })
      for (const line of sourceLines) {
        entries.set(line.id, { audio, line })
      }
    }
    audioEntriesRef.current = entries

    // The score begins at frame zero, so it is the correct autoplay probe.
    // Probing the first actor reel previously held the entire timeline until
    // that much larger file had buffered.
    const probe = scoreRef.current

    let autoplayAttempt: Promise<void> | undefined
    try {
      autoplayAttempt = probe?.play()
    } catch {
      // A media implementation without Promise playback still gets captions.
    }
    queueMicrotask(() => {
      if (lifecycleRef.current === generation) beginClock(0)
    })
    void autoplayAttempt
      ?.catch((error: unknown) => {
        if (
          lifecycleRef.current !== generation ||
          !isAutoplayBlock(error)
        ) {
          return
        }
        pauseAllAudio()
        offsetRef.current = 0
        elapsedRef.current = 0
        setElapsedMs(0)
        setPlayback('awaiting-gesture')
      })

    return () => {
      lifecycleRef.current += 1
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      for (const audio of new Set([...entries.values()].map((entry) => entry.audio))) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      entries.clear()
      pendingAudioIds.clear()
      if (audioEntriesRef.current === entries) {
        audioEntriesRef.current = new Map()
      }
    }
  }, [
    beginClock,
    cinematic.id,
    cinematic.lines,
    pauseAllAudio,
  ])

  useEffect(() => {
    if (playback !== 'playing') return

    const tick = (time: number) => {
      if (finishedRef.current) return
      const current = clamp(
        offsetRef.current + time - startedAtRef.current,
        0,
        durationMs,
      )
      elapsedRef.current = current
      setElapsedMs(current)
      syncAudioToTimeline(current)

      if (current >= durationMs) {
        finishOnce('natural')
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [durationMs, finishOnce, playback, syncAudioToTimeline])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || finishedRef.current) return
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlayback()
      } else if (event.code === 'Escape') {
        event.preventDefault()
        finishOnce('skip')
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        setCaptionsVisible((visible) => !visible)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finishOnce, togglePlayback])

  const updateParallax = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion || !rootRef.current) return
    const bounds = rootRef.current.getBoundingClientRect()
    const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1)
    const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
    rootRef.current.style.setProperty('--pointer-x', `${(x - 0.5) * 2}`)
    rootRef.current.style.setProperty('--pointer-y', `${(y - 0.5) * 2}`)
  }

  const resetParallax = () => {
    rootRef.current?.style.setProperty('--pointer-x', '0')
    rootRef.current?.style.setProperty('--pointer-y', '0')
  }

  const bossFrameStyle = cinematic.bossFrame
    ? ({
        backgroundImage: `url("${appAssetUrl(cinematic.bossAsset ?? '')}")`,
        backgroundSize: `${cinematic.bossFrame.columns * 100}% ${cinematic.bossFrame.rows * 100}%`,
        backgroundPosition: `${
          cinematic.bossFrame.columns === 1
            ? 0
            : (cinematic.bossFrame.column / (cinematic.bossFrame.columns - 1)) * 100
        }% ${
          cinematic.bossFrame.rows === 1
            ? 0
            : (cinematic.bossFrame.row / (cinematic.bossFrame.rows - 1)) * 100
        }%`,
      } satisfies CSSProperties)
    : undefined
  const heroIsRuntimeAtlas = Boolean(
    heroAsset && /assets\/hero-animations\/hero-(walk|fire|charge)-runtime\.webp$/i.test(heroAsset),
  )

  return (
    <main
      ref={rootRef}
      className={[
        'nt-cinematic',
        `nt-cinematic--${cinematic.kind}`,
        activeBeat?.focus ? `nt-cinematic--focus-${activeBeat.focus}` : '',
        activeBeat?.heroAction
          ? `nt-cinematic--hero-${activeBeat.heroAction}`
          : 'nt-cinematic--hero-idle',
        reducedMotion ? 'nt-cinematic--reduced-motion' : '',
        reducedFlash ? 'nt-cinematic--reduced-flash' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--pointer-x': '0',
          '--pointer-y': '0',
        } as CSSProperties
      }
      onPointerMove={updateParallax}
      onPointerLeave={resetParallax}
      aria-label={`${cinematic.chapterLabel}: ${cinematic.title}`}
    >
      <section className="nt-cinematic__viewport" aria-live="off">
        <div
          className="nt-cinematic__arena"
          style={{
            backgroundImage: `url("${appAssetUrl(cinematic.arenaAsset)}")`,
          }}
          aria-hidden="true"
        />
        <div className="nt-cinematic__depth-shadow" aria-hidden="true" />
        <div className="nt-cinematic__atmosphere" aria-hidden="true" />

        {cinematic.bossAsset ? (
          cinematic.bossFrame ? (
            <div
              className="nt-cinematic__boss nt-cinematic__boss--atlas"
              style={bossFrameStyle}
              aria-hidden="true"
            />
          ) : (
            <img
              className="nt-cinematic__boss"
              src={appAssetUrl(cinematic.bossAsset)}
              alt=""
              draggable={false}
            />
          )
        ) : null}

        {heroAsset ? (
          heroIsRuntimeAtlas ? (
            <div
              className="nt-cinematic__hero nt-cinematic__hero--atlas"
              style={{ backgroundImage: `url("${appAssetUrl(heroAsset)}")` }}
              aria-hidden="true"
            />
          ) : (
            <img
              className="nt-cinematic__hero"
              src={appAssetUrl(heroAsset)}
              alt=""
              draggable={false}
            />
          )
        ) : null}

        <div className="nt-cinematic__motes" aria-hidden="true">
          {particles.map((particle) => (
            <i key={particle.id} style={particle.style} />
          ))}
        </div>
        <div className="nt-cinematic__grade" aria-hidden="true" />

        <header className="nt-cinematic__chapter">
          <p>{scene.kicker ?? cinematic.chapterLabel}</p>
          <h1>{cinematic.title}</h1>
          {scene.summary ? <span>{scene.summary}</span> : null}
        </header>

        <div
          className="nt-cinematic__progress"
          role="progressbar"
          aria-label="Cinematic progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="nt-cinematic__progress-labels" aria-hidden="true">
            {progressLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className={
                  progress >= index / Math.max(1, progressLabels.length - 1)
                    ? 'is-reached'
                    : ''
                }
              >
                {label}
              </span>
            ))}
          </div>
          <div className="nt-cinematic__progress-track">
            <i style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>

        {captionsVisible && activeLine ? (
          <section
            key={activeLine.id}
            className={[
              'nt-cinematic__captions',
              `nt-cinematic__captions--${SPEAKER_THEME[activeLine.speaker]}`,
            ].join(' ')}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {activePortrait ? (
              <div className="nt-cinematic__portrait" aria-hidden="true">
                <div className="nt-cinematic__portrait-aura" />
                <div className="nt-cinematic__portrait-window">
                  <img
                    className="nt-cinematic__portrait-sheet"
                    src={appAssetUrl(activePortrait.asset)}
                    alt=""
                    draggable={false}
                    style={{
                      transform: `translate3d(-${activePortrait.frame * 25}%, 0, 0)`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            <div className="nt-cinematic__dialogue-copy">
              <strong className="nt-cinematic__speaker">
                {activeLine.speaker}
              </strong>
              <p>{activeLine.text}</p>
            </div>
          </section>
        ) : null}

        {hasNarration && narrationUnavailable ? (
          <div className="nt-cinematic__audio-notice" role="status">
            Narration unavailable · captions continue
          </div>
        ) : null}

        <nav className="nt-cinematic__controls" aria-label="Cinematic controls">
          {hasNarration ? (
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? 'Unmute narration' : 'Mute narration'}
              aria-pressed={muted}
              title={muted ? 'Unmute narration' : 'Mute narration'}
            >
              {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCaptionsVisible((visible) => !visible)}
            aria-label={captionsVisible ? 'Hide captions' : 'Show captions'}
            aria-pressed={captionsVisible}
            title="Captions (C)"
          >
            {captionsVisible ? (
              <Captions aria-hidden="true" />
            ) : (
              <CaptionsOff aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={playback === 'playing' ? 'Pause cinematic' : 'Play cinematic'}
            title={playback === 'playing' ? 'Pause (Space)' : 'Play (Space)'}
            disabled={playback === 'probing'}
          >
            {playback === 'playing' ? (
              <CirclePause aria-hidden="true" />
            ) : (
              <CirclePlay aria-hidden="true" />
            )}
          </button>
          <span className="nt-cinematic__time" aria-hidden="true">
            {formatTime(durationMs - elapsedMs)}
          </span>
          {onReplayExit ? (
            <button
              type="button"
              onClick={() => finishOnce('replay-exit')}
              aria-label="Exit cinematic replay"
              title="Exit replay"
            >
              <LogOut aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="nt-cinematic__skip"
            onClick={() => finishOnce('skip')}
            aria-label="Skip cinematic"
            title="Skip (Escape)"
          >
            <span>Skip</span>
            <SkipForward aria-hidden="true" />
          </button>
        </nav>

        {playback === 'awaiting-gesture' ? (
          <div className="nt-cinematic__entry">
            <div className="nt-cinematic__entry-glow" aria-hidden="true" />
            <p>{cinematic.chapterLabel}</p>
            <h2>{cinematic.title}</h2>
            <button type="button" onClick={continueFromGesture} autoFocus>
              Continue the story
            </button>
            <span>
              Your browser paused {hasNarration ? 'narration' : 'cinematic audio'} until you
              continue.
            </span>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export function CinematicScreen(props: CinematicScreenProps) {
  return <CinematicSession key={props.cinematic.id} {...props} />
}

export default CinematicScreen
