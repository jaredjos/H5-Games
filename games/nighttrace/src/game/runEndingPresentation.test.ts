import { describe, expect, it } from 'vitest'
import {
  BOSS_DEATH_MOTION_SECONDS,
  LEVEL_COMPLETE_REVEAL_PROGRESS,
  VICTORY_END_SEQUENCE_SECONDS,
  runEndingCompletionVisible,
  runEndingDuration,
  runEndingTitle,
} from './runEndingPresentation'

describe('run ending presentation', () => {
  it('holds victory long enough for the sovereign collapse and completion card', () => {
    expect(BOSS_DEATH_MOTION_SECONDS).toBeGreaterThan(1.5)
    expect(VICTORY_END_SEQUENCE_SECONDS).toBeGreaterThan(
      BOSS_DEATH_MOTION_SECONDS + 1.5,
    )
    expect(runEndingDuration(true)).toBe(VICTORY_END_SEQUENCE_SECONDS)
  })

  it('reveals LEVEL COMPLETE after the defeat beat and before handoff', () => {
    expect(runEndingTitle(true, LEVEL_COMPLETE_REVEAL_PROGRESS - 0.01)).toBe(
      'SOVEREIGN DEFEATED',
    )
    expect(runEndingTitle(true, LEVEL_COMPLETE_REVEAL_PROGRESS)).toBe(
      'LEVEL COMPLETE',
    )
    expect(runEndingTitle(false, 1)).toBe('TRACE SEVERED')
    expect(runEndingCompletionVisible(true, LEVEL_COMPLETE_REVEAL_PROGRESS - 0.01))
      .toBe(false)
    expect(runEndingCompletionVisible(true, LEVEL_COMPLETE_REVEAL_PROGRESS))
      .toBe(true)
    expect(runEndingCompletionVisible(false, 0)).toBe(true)
  })
})
