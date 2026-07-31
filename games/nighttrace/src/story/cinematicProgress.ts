export type CinematicProgressReturnScreen =
  | 'campaign'
  | 'results'
  | 'codex'
  | 'combat-lab'

/**
 * Only story playback reached through campaign progression may consume a
 * first-view cinematic. Codex and Combat Lab are consequence-free replays.
 */
export function shouldRecordCinematicSeen(
  returnScreen: CinematicProgressReturnScreen,
) {
  return returnScreen === 'campaign' || returnScreen === 'results'
}
