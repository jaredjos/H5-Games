import { describe, expect, it } from 'vitest'
import {
  HOSTILE_SPECIAL_REACTION_BONUS_SECONDS,
  HOSTILE_SPECIAL_REACTION_LEVEL_ONE_SECONDS,
  HOSTILE_SPECIAL_REACTION_LEVEL_TEN_SECONDS,
  hostileSpecialReactionBonusSeconds,
  hostileSpecialReactionWindow,
} from './hostileReactionWindow'

describe('hostile special reaction windows', () => {
  it('tapers Campaign and Boss Trial anticipation from level one to ten', () => {
    expect(HOSTILE_SPECIAL_REACTION_LEVEL_ONE_SECONDS).toBe(0.15)
    expect(HOSTILE_SPECIAL_REACTION_LEVEL_TEN_SECONDS).toBe(0.1)
    expect(hostileSpecialReactionBonusSeconds('campaign', 1)).toBeCloseTo(0.15)
    expect(hostileSpecialReactionBonusSeconds('campaign', 10)).toBeCloseTo(0.1)
    expect(hostileSpecialReactionBonusSeconds('boss-trial', 5)).toBeCloseTo(
      0.1277777778,
    )
  })

  it('clamps out-of-range sectors while Combat Lab keeps its inspection window', () => {
    expect(HOSTILE_SPECIAL_REACTION_BONUS_SECONDS).toBe(0.2)
    expect(hostileSpecialReactionBonusSeconds('campaign', -5)).toBeCloseTo(0.15)
    expect(hostileSpecialReactionBonusSeconds('campaign', 99)).toBeCloseTo(0.1)
    expect(hostileSpecialReactionBonusSeconds('campaign', Number.NaN)).toBeCloseTo(0.15)
    expect(hostileSpecialReactionBonusSeconds('combat-lab', 10)).toBeCloseTo(0.2)
  })

  it('normalizes malformed timings before adding the resolved bonus', () => {
    expect(hostileSpecialReactionWindow(0.52, 0.15)).toBeCloseTo(0.67)
    expect(hostileSpecialReactionWindow(-4, 0.1)).toBeCloseTo(0.1)
    expect(hostileSpecialReactionWindow(Number.NaN, 0.15)).toBeCloseTo(0.15)
  })
})
