import { describe, expect, it } from 'vitest'
import {
  HOSTILE_SPECIAL_REACTION_BONUS_SECONDS,
  hostileSpecialReactionWindow,
} from './hostileReactionWindow'

describe('hostile special reaction windows', () => {
  it('adds exactly two tenths of a second to a valid warning', () => {
    expect(HOSTILE_SPECIAL_REACTION_BONUS_SECONDS).toBe(0.2)
    expect(hostileSpecialReactionWindow(0.52)).toBeCloseTo(0.72)
    expect(hostileSpecialReactionWindow(1.04)).toBeCloseTo(1.24)
  })

  it('normalizes malformed timings before adding the reaction bonus', () => {
    expect(hostileSpecialReactionWindow(-4)).toBe(0.2)
    expect(hostileSpecialReactionWindow(Number.NaN)).toBe(0.2)
  })
})
