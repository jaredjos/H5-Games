import type { EnemyId } from '../shared/types'
import type { AttackMotionStyle } from './animation'

/**
 * Each horde sheet is a pose atlas, not a simulation timeline. Gameplay owns
 * movement, attack timing, collision, damage, hit reactions, and death timing.
 */
export const ENEMY_POSE_COLUMNS = Object.freeze({
  idle: 0,
  'move-contact-a': 1,
  'move-contact-b': 2,
  'attack-windup': 3,
  'special-release': 4,
} as const)

export type EnemyAuthoredPose = keyof typeof ENEMY_POSE_COLUMNS
export type EnemyMotionAtlasIndex = 0 | 1
export type EnemyMotionAtlasRow = 0 | 1 | 2
export type EnemyLocomotionFamily =
  | 'knuckle-run'
  | 'flight'
  | 'float'
  | 'quadruped'
  | 'biped'

export interface EnemyMotionAtlasMetadata {
  readonly index: EnemyMotionAtlasIndex
  readonly path: string
  readonly columns: 5
  readonly rows: 3
  readonly lod: 'shared'
}

export const ENEMY_MOTION_ATLASES = Object.freeze([
  Object.freeze({
    index: 0,
    path: 'assets/enemy-animations/enemy-motion-atlas-a.webp',
    columns: 5,
    rows: 3,
    lod: 'shared',
  }),
  Object.freeze({
    index: 1,
    path: 'assets/enemy-animations/enemy-motion-atlas-b.webp',
    columns: 5,
    rows: 3,
    lod: 'shared',
  }),
] as const satisfies readonly EnemyMotionAtlasMetadata[])

export interface EnemyClipProfile {
  readonly enemyId: EnemyId
  readonly atlasIndex: EnemyMotionAtlasIndex
  readonly atlasRow: EnemyMotionAtlasRow
  readonly locomotion: EnemyLocomotionFamily
  readonly quadruped: boolean
  /**
   * Authored A/B contact changes per second. Two changes form one complete
   * locomotion cycle.
   */
  readonly contactRateHz: number
}

const profile = (
  enemyId: EnemyId,
  atlasIndex: EnemyMotionAtlasIndex,
  atlasRow: EnemyMotionAtlasRow,
  locomotion: EnemyLocomotionFamily,
  contactRateHz: number,
): Readonly<EnemyClipProfile> =>
  Object.freeze({
    enemyId,
    atlasIndex,
    atlasRow,
    locomotion,
    quadruped: locomotion === 'quadruped',
    contactRateHz,
  })

/**
 * Sheet A: Maskling, Shardwing, Cantor.
 * Sheet B: Railjaw, Chronowisp, Cinder Guard.
 */
export const ENEMY_CLIP_PROFILES = Object.freeze({
  maskling: profile('maskling', 0, 0, 'knuckle-run', 3.1),
  shardwing: profile('shardwing', 0, 1, 'flight', 5.5),
  cantor: profile('cantor', 0, 2, 'float', 1),
  railjaw: profile('railjaw', 1, 0, 'quadruped', 2.2),
  chronowisp: profile('chronowisp', 1, 1, 'float', 1.5),
  'cinder-guard': profile('cinder-guard', 1, 2, 'biped', 1.85),
} as const satisfies Readonly<Record<EnemyId, Readonly<EnemyClipProfile>>>)

export const QUADRUPED_ENEMY_IDS = Object.freeze([
  'railjaw',
] as const satisfies readonly EnemyId[])

/**
 * `ranged` is accepted ahead of the runtime style addition so the pure atlas
 * contract can be integrated without another resolver change.
 */
export type EnemyAttackMotionStyle = AttackMotionStyle | 'ranged'

const ENEMY_ATTACK_STYLES = new Set<EnemyAttackMotionStyle>([
  'melee',
  'cast',
  'charge',
  'blink',
  'slam',
  'ranged',
])

export const ENEMY_MOVE_POSE_THRESHOLD = 0.14
export const ENEMY_SPECIAL_RELEASE_TAIL_SECONDS = 0.18

export type EnemyResolvedClipState =
  | 'idle'
  | 'move'
  | 'attack-windup'
  | 'special-release'
  | 'hit-fallback'
  | 'death-fallback'

export interface EnemyClipResolverInput {
  readonly enemyId: EnemyId
  readonly uid: number
  readonly time: number
  readonly moving: number
  readonly attackMotionStyle: EnemyAttackMotionStyle
  readonly attackMotionRemaining: number
  readonly attackMotionDuration: number
  readonly hitMotionRemaining?: number
  readonly hitMotionDuration?: number
  readonly deathMotionRemaining?: number
  readonly deathMotionDuration?: number
}

export interface ResolvedEnemyClipFrame {
  readonly enemyId: EnemyId
  readonly state: EnemyResolvedClipState
  readonly pose: EnemyAuthoredPose
  readonly progress: number
  readonly locomotion: EnemyLocomotionFamily
  readonly quadruped: boolean
  readonly atlasIndex: EnemyMotionAtlasIndex
  readonly atlasRow: EnemyMotionAtlasRow
  readonly column: 0 | 1 | 2 | 3 | 4
  readonly frameIndex: number
  readonly assetPath: string
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const finiteNonNegative = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, value as number) : 0

const activeTimerProgress = (
  remaining: number | undefined,
  duration: number | undefined,
): number | undefined => {
  const safeRemaining = finiteNonNegative(remaining)
  const safeDuration = finiteNonNegative(duration)
  if (safeRemaining <= 0 || safeDuration <= 0) return undefined
  return clamp01(1 - safeRemaining / safeDuration)
}

export function enemyClipProfile(enemyId: EnemyId): Readonly<EnemyClipProfile> {
  return ENEMY_CLIP_PROFILES[enemyId]
}

export function isEnemyAttackMotionStyle(
  style: EnemyAttackMotionStyle,
): boolean {
  return ENEMY_ATTACK_STYLES.has(style)
}

/**
 * Contact melee and blink already have gameplay release points. Longer cast,
 * charge, slam, and projectile actions reserve a short authored release tail.
 */
export function enemyAttackReleaseProgress(
  style: EnemyAttackMotionStyle,
  duration: number,
) {
  if (style === 'melee') return 0.42
  if (style === 'blink') return 0.46

  const safeDuration = finiteNonNegative(duration)
  if (safeDuration <= 0) return 1
  return clamp01(
    Math.max(
      0.56,
      Math.min(
        0.84,
        (safeDuration - ENEMY_SPECIAL_RELEASE_TAIL_SECONDS) / safeDuration,
      ),
    ),
  )
}

const resolveContactPose = (
  time: number,
  uid: number,
  contactRateHz: number,
): 'move-contact-a' | 'move-contact-b' => {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0
  const safeUid = Number.isFinite(uid) ? Math.abs(Math.trunc(uid)) : 0
  // Golden-ratio phase offsets prevent a large horde from changing pose in
  // lockstep while remaining deterministic and seek-safe.
  const contactIndex = Math.floor(
    safeTime * contactRateHz + safeUid * 0.61803398875,
  )
  return contactIndex % 2 === 0 ? 'move-contact-a' : 'move-contact-b'
}

const resolvedFrame = (
  profileData: Readonly<EnemyClipProfile>,
  state: EnemyResolvedClipState,
  pose: EnemyAuthoredPose,
  progress: number,
): ResolvedEnemyClipFrame => {
  const atlas = ENEMY_MOTION_ATLASES[profileData.atlasIndex]
  const column = ENEMY_POSE_COLUMNS[pose]
  return {
    enemyId: profileData.enemyId,
    state,
    pose,
    progress: clamp01(progress),
    locomotion: profileData.locomotion,
    quadruped: profileData.quadruped,
    atlasIndex: profileData.atlasIndex,
    atlasRow: profileData.atlasRow,
    column,
    frameIndex: profileData.atlasRow * atlas.columns + column,
    assetPath: atlas.path,
  }
}

/**
 * Resolves an authored texture cell without mutating simulation state.
 *
 * Precedence: death fallback > hit fallback > attack > move > idle.
 */
export function resolveEnemyClipFrame(
  input: EnemyClipResolverInput,
): ResolvedEnemyClipFrame {
  const profileData = enemyClipProfile(input.enemyId)
  const deathProgress = activeTimerProgress(
    input.deathMotionRemaining,
    input.deathMotionDuration,
  )
  if (deathProgress !== undefined) {
    return resolvedFrame(profileData, 'death-fallback', 'idle', deathProgress)
  }

  const hitProgress = activeTimerProgress(
    input.hitMotionRemaining,
    input.hitMotionDuration,
  )
  if (hitProgress !== undefined) {
    return resolvedFrame(
      profileData,
      'hit-fallback',
      'attack-windup',
      hitProgress,
    )
  }

  const attackProgress = activeTimerProgress(
    input.attackMotionRemaining,
    input.attackMotionDuration,
  )
  if (
    attackProgress !== undefined &&
    isEnemyAttackMotionStyle(input.attackMotionStyle)
  ) {
    const releaseProgress = enemyAttackReleaseProgress(
      input.attackMotionStyle,
      input.attackMotionDuration,
    )
    if (attackProgress >= releaseProgress) {
      return resolvedFrame(
        profileData,
        'special-release',
        'special-release',
        attackProgress,
      )
    }
    return resolvedFrame(
      profileData,
      'attack-windup',
      'attack-windup',
      attackProgress,
    )
  }

  const moving = clamp01(Number.isFinite(input.moving) ? input.moving : 0)
  if (moving >= ENEMY_MOVE_POSE_THRESHOLD) {
    return resolvedFrame(
      profileData,
      'move',
      resolveContactPose(
        input.time,
        input.uid,
        profileData.contactRateHz,
      ),
      moving,
    )
  }

  return resolvedFrame(profileData, 'idle', 'idle', 0)
}
