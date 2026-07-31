export interface CinematicAudioLike {
  pause(): void
  currentTime: number
  duration: number
}

export interface CinematicAudioEntryLike<TAudio extends CinematicAudioLike> {
  audio: TAudio
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

