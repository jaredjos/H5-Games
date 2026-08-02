export const BOSS_DEATH_MOTION_SECONDS = 1.65
export const BOSS_DEFEATED_TITLE_SECONDS = 2.8
export const VICTORY_END_SEQUENCE_SECONDS = 4.6
export const DEFEAT_END_SEQUENCE_SECONDS = 2.2

// Keep the completion card off the arena until the authored sovereign collapse
// has fully resolved. The sovereign-defeated title now holds one full second
// longer, while the original 1.8-second level-complete beat remains intact.
export const LEVEL_COMPLETE_REVEAL_PROGRESS =
  BOSS_DEFEATED_TITLE_SECONDS / VICTORY_END_SEQUENCE_SECONDS

export function runEndingDuration(victory: boolean) {
  return victory ? VICTORY_END_SEQUENCE_SECONDS : DEFEAT_END_SEQUENCE_SECONDS
}

export function runEndingTitle(victory: boolean, progress: number) {
  if (!victory) return 'TRACE SEVERED'
  return progress >= LEVEL_COMPLETE_REVEAL_PROGRESS
    ? 'LEVEL COMPLETE'
    : 'SOVEREIGN DEFEATED'
}

export function runEndingCompletionVisible(
  victory: boolean,
  progress: number,
) {
  return !victory || progress >= LEVEL_COMPLETE_REVEAL_PROGRESS
}
