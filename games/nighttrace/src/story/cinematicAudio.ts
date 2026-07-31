export interface CinematicAudioLike {
  pause(): void
  currentTime: number
  duration: number
}

export interface CinematicAudioEntryLike<TAudio extends CinematicAudioLike> {
  audio: TAudio
}

export interface CinematicClipPosition {
  readonly sourceTime: number
  readonly reachedEnd: boolean
}

/**
 * Actor reels are shared by several dialogue lines. Pause each physical media
 * element once and never pause the reel that owns the active line.
 */
export function pauseInactiveCinematicAudio<TAudio extends CinematicAudioLike>(
  entries: Iterable<CinematicAudioEntryLike<TAudio>>,
  activeAudio?: TAudio,
) {
  const handled = new Set<TAudio>()
  for (const entry of entries) {
    if (handled.has(entry.audio)) continue
    handled.add(entry.audio)
    if (entry.audio !== activeAudio) entry.audio.pause()
  }
}

/**
 * Streaming media can reject a seek until its metadata/seekable range exists.
 * A failed seek is transient; the cinematic clock should keep running and try
 * again on the next animation frame.
 */
export function seekCinematicAudio(
  audio: CinematicAudioLike,
  requestedSeconds: number,
) {
  const safeRequested = Math.max(0, requestedSeconds)
  const target = Number.isFinite(audio.duration)
    ? Math.min(safeRequested, Math.max(0, audio.duration - 0.03))
    : safeRequested

  try {
    audio.currentTime = target
    return true
  } catch {
    return false
  }
}

/**
 * Resolve a scene-clock position into an authored reel position. Consumers
 * must check `reachedEnd` before returning early for an already-playing reel;
 * otherwise the shared reel can run directly into the next actor line.
 */
export function cinematicClipPosition(
  sceneTimeMs: number,
  lineStartMs: number,
  audioStartMs = 0,
  audioEndMs?: number,
): CinematicClipPosition {
  const elapsedSeconds = Math.max(0, sceneTimeMs - lineStartMs) / 1000
  const sourceTime = Math.max(0, audioStartMs) / 1000 + elapsedSeconds
  const sourceEnd = audioEndMs === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, audioEndMs) / 1000

  return {
    sourceTime,
    reachedEnd: sourceTime >= sourceEnd,
  }
}
