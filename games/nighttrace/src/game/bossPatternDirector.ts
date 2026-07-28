import {
  BOSS_PATTERN_COUNT,
  bossPatternForLevel,
} from './balance'

export type BossPhase = 1 | 2 | 3
export type BossPatternId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

const freezePatternIds = (patternIds: readonly BossPatternId[]) =>
  Object.freeze([...patternIds])

/**
 * Full authored repertoires are ordered with the sector's signature first,
 * followed by complementary attacks that preserve that sovereign's identity.
 */
export const BOSS_PATTERN_REPERTOIRES = Object.freeze([
  freezePatternIds([0]),
  freezePatternIds([1, 0]),
  freezePatternIds([2, 0]),
  freezePatternIds([3, 1, 2]),
  freezePatternIds([4, 1, 3]),
  freezePatternIds([5, 0, 2, 4]),
  freezePatternIds([6, 1, 3, 5]),
  freezePatternIds([7, 2, 4, 6, 0]),
  freezePatternIds([8, 3, 5, 6, 2]),
  freezePatternIds([9, 0, 2, 4, 6, 8]),
] as const)

export const BOSS_PATTERN_REPERTOIRE_COUNTS = Object.freeze([
  Object.freeze([1, 1, 1]),
  Object.freeze([2, 2, 2]),
  Object.freeze([2, 2, 2]),
  Object.freeze([2, 3, 3]),
  Object.freeze([2, 3, 3]),
  Object.freeze([3, 3, 4]),
  Object.freeze([3, 4, 4]),
  Object.freeze([3, 4, 5]),
  Object.freeze([4, 5, 5]),
  Object.freeze([4, 5, 6]),
] as const)

export interface BossPatternDirectorState {
  /** Oldest to newest, bounded to the last two valid patterns. */
  readonly recentPatternIds: readonly BossPatternId[]
  readonly castCount: number
}

export interface BossPatternDirectorInput {
  readonly levelId: number
  readonly phase: number
  /** Deterministic unit roll. Values outside [0, 1) are safely clamped. */
  readonly roll: number
  readonly state?: BossPatternDirectorState
}

export interface BossPatternDecision {
  readonly patternId: BossPatternId
  readonly signaturePatternId: BossPatternId
  readonly pool: readonly BossPatternId[]
  readonly candidates: readonly BossPatternId[]
  readonly state: BossPatternDirectorState
}

const normalizeLevel = (levelId: number) =>
  Math.max(
    1,
    Math.min(
      BOSS_PATTERN_COUNT,
      Math.floor(Number.isFinite(levelId) ? levelId : 1),
    ),
  )

const normalizePhase = (phase: number): BossPhase =>
  Math.max(
    1,
    Math.min(3, Math.floor(Number.isFinite(phase) ? phase : 1)),
  ) as BossPhase

const isPatternId = (value: number): value is BossPatternId =>
  Number.isInteger(value) && value >= 0 && value < BOSS_PATTERN_COUNT

const normalizeRoll = (roll: number) =>
  Math.max(
    0,
    Math.min(
      1 - Number.EPSILON,
      Number.isFinite(roll) ? roll : 0,
    ),
  )

export function createBossPatternDirectorState(
  recentPatternIds: readonly number[] = [],
  castCount = 0,
): BossPatternDirectorState {
  const recent = recentPatternIds
    .filter(isPatternId)
    .slice(-2)
  return Object.freeze({
    recentPatternIds: freezePatternIds(recent),
    castCount: Math.max(
      0,
      Math.floor(Number.isFinite(castCount) ? castCount : 0),
    ),
  })
}

export function bossPatternPoolForLevel(
  levelId: number,
  phase: number,
): readonly BossPatternId[] {
  const level = normalizeLevel(levelId)
  const normalizedPhase = normalizePhase(phase)
  const repertoire = BOSS_PATTERN_REPERTOIRES[level - 1]
  const count = BOSS_PATTERN_REPERTOIRE_COUNTS[level - 1][normalizedPhase - 1]
  return freezePatternIds(repertoire.slice(0, count))
}

/**
 * Chooses one readable cast at a time. The last two patterns are excluded when
 * the current pool has another valid option. A two-pattern pool alternates
 * instead of stalling, and a one-pattern opening boss may repeat by necessity.
 */
export function directBossPattern(
  input: BossPatternDirectorInput,
): BossPatternDecision {
  const level = normalizeLevel(input.levelId)
  const pool = bossPatternPoolForLevel(level, input.phase)
  const state = createBossPatternDirectorState(
    input.state?.recentPatternIds,
    input.state?.castCount,
  )
  const recentSet = new Set(state.recentPatternIds)
  let candidates = pool.filter((patternId) => !recentSet.has(patternId))

  if (candidates.length === 0 && pool.length > 1) {
    const immediate = state.recentPatternIds.at(-1)
    candidates = pool.filter((patternId) => patternId !== immediate)
  }
  if (candidates.length === 0) candidates = [...pool]

  const frozenCandidates = freezePatternIds(candidates)
  const candidateIndex = Math.min(
    frozenCandidates.length - 1,
    Math.floor(normalizeRoll(input.roll) * frozenCandidates.length),
  )
  const patternId = frozenCandidates[Math.max(0, candidateIndex)]
  const nextState = createBossPatternDirectorState(
    [...state.recentPatternIds, patternId],
    state.castCount + 1,
  )

  return Object.freeze({
    patternId,
    signaturePatternId: bossPatternForLevel(level) as BossPatternId,
    pool,
    candidates: frozenCandidates,
    state: nextState,
  })
}
