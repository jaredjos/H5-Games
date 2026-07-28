import { describe, expect, it } from 'vitest'
import { bossPatternForLevel } from './balance'
import {
  BOSS_PATTERN_REPERTOIRE_COUNTS,
  BOSS_PATTERN_REPERTOIRES,
  bossPatternPoolForLevel,
  createBossPatternDirectorState,
  directBossPattern,
  type BossPatternId,
} from './bossPatternDirector'

const EXPECTED_COUNTS = [
  [1, 1, 1],
  [2, 2, 2],
  [2, 2, 2],
  [2, 3, 3],
  [2, 3, 3],
  [3, 3, 4],
  [3, 4, 4],
  [3, 4, 5],
  [4, 5, 5],
  [4, 5, 6],
] as const

describe('phase-aware boss pattern pools', () => {
  it('matches the authored repertoire count curve exactly', () => {
    expect(BOSS_PATTERN_REPERTOIRE_COUNTS).toEqual(EXPECTED_COUNTS)

    for (let levelId = 1; levelId <= 10; levelId += 1) {
      for (let phase = 1; phase <= 3; phase += 1) {
        expect(bossPatternPoolForLevel(levelId, phase)).toHaveLength(
          EXPECTED_COUNTS[levelId - 1][phase - 1],
        )
      }
    }
  })

  it('always leads with the sector signature and keeps every pool unique', () => {
    for (let levelId = 1; levelId <= 10; levelId += 1) {
      const signature = bossPatternForLevel(levelId)
      const repertoire = BOSS_PATTERN_REPERTOIRES[levelId - 1]
      expect(repertoire[0]).toBe(signature)
      expect(new Set(repertoire).size).toBe(repertoire.length)
      expect(Object.isFrozen(repertoire)).toBe(true)

      for (let phase = 1; phase <= 3; phase += 1) {
        const pool = bossPatternPoolForLevel(levelId, phase)
        expect(pool[0]).toBe(signature)
        expect(pool).toContain(signature)
        expect(new Set(pool).size).toBe(pool.length)
        expect(Object.isFrozen(pool)).toBe(true)
      }
    }
  })

  it('clamps malformed level and phase inputs to safe authored pools', () => {
    expect(bossPatternPoolForLevel(Number.NaN, Number.NaN)).toEqual([0])
    expect(bossPatternPoolForLevel(-99, -8)).toEqual([0])
    expect(bossPatternPoolForLevel(999, 999)).toEqual([9, 0, 2, 4, 6, 8])
  })
})

describe('deterministic boss pattern direction', () => {
  it('uses the deterministic unit roll to select from eligible candidates', () => {
    const state = createBossPatternDirectorState([9, 0], 12)
    const low = directBossPattern({
      levelId: 10,
      phase: 3,
      roll: 0,
      state,
    })
    const high = directBossPattern({
      levelId: 10,
      phase: 3,
      roll: 0.999999,
      state,
    })

    expect(low.candidates).toEqual([2, 4, 6, 8])
    expect(low.patternId).toBe(2)
    expect(high.patternId).toBe(8)
    expect(low.signaturePatternId).toBe(9)
    expect(low.state.castCount).toBe(13)
    expect(low.state.recentPatternIds).toEqual([0, 2])
  })

  it('does not repeat either recent pattern when a third choice exists', () => {
    let state = createBossPatternDirectorState()
    const history: BossPatternId[] = []

    for (let cast = 0; cast < 24; cast += 1) {
      const decision = directBossPattern({
        levelId: 10,
        phase: 3,
        roll: ((cast * 37) % 101) / 101,
        state,
      })
      expect(decision.patternId).not.toBe(history.at(-1))
      expect(decision.patternId).not.toBe(history.at(-2))
      history.push(decision.patternId)
      state = decision.state
    }
  })

  it('alternates a two-pattern pool and only repeats a one-pattern pool by necessity', () => {
    const twoPatternState = createBossPatternDirectorState([1, 0], 2)
    const alternate = directBossPattern({
      levelId: 2,
      phase: 1,
      roll: 0.7,
      state: twoPatternState,
    })
    expect(alternate.pool).toEqual([1, 0])
    expect(alternate.candidates).toEqual([1])
    expect(alternate.patternId).toBe(1)

    const onePattern = directBossPattern({
      levelId: 1,
      phase: 3,
      roll: 0.7,
      state: createBossPatternDirectorState([0], 1),
    })
    expect(onePattern.pool).toEqual([0])
    expect(onePattern.patternId).toBe(0)
  })

  it('is immutable, deterministic, and sanitizes state and rolls', () => {
    const state = createBossPatternDirectorState(
      [-1, 8, 99, 3, 5],
      Number.POSITIVE_INFINITY,
    )
    expect(state.recentPatternIds).toEqual([3, 5])
    expect(state.castCount).toBe(0)
    expect(Object.isFrozen(state)).toBe(true)
    expect(Object.isFrozen(state.recentPatternIds)).toBe(true)

    const input = {
      levelId: 9,
      phase: 3,
      roll: Number.NaN,
      state,
    } as const
    const first = directBossPattern(input)
    const second = directBossPattern(input)
    expect(second).toEqual(first)
    expect(first.patternId).toBe(first.candidates[0])
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.candidates)).toBe(true)
    expect(Object.isFrozen(first.state)).toBe(true)
  })
})
