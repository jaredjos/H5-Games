import type { BossId } from '../shared/types'
import type { AttackMotionStyle } from './animation'

/**
 * Authored columns are deliberately poses rather than gameplay states. The
 * existing simulation remains the source of truth for movement, collision,
 * attack timing, hit reactions, and death timing.
 */
export const BOSS_POSE_COLUMNS = Object.freeze({
  idle: 0,
  'move-contact-a': 1,
  'move-contact-b': 2,
  'attack-windup': 3,
  'special-release': 4,
} as const)

export type BossAuthoredPose = keyof typeof BOSS_POSE_COLUMNS
export type BossMotionAtlasIndex = 0 | 1
export type BossMotionAtlasRow = 0 | 1 | 2
export type BossArtRow = 0 | 1 | 2 | 3 | 4 | 5

export interface BossMotionAtlasMetadata {
  readonly index: BossMotionAtlasIndex
  readonly path: string
  readonly columns: 5
  readonly rows: 3
  readonly lod: 'desktop'
}

export const BOSS_MOTION_ATLASES = Object.freeze([
  Object.freeze({
    index: 0,
    path: 'assets/boss-animations/boss-motion-atlas-a.webp',
    columns: 5,
    rows: 3,
    lod: 'desktop',
  }),
  Object.freeze({
    index: 1,
    path: 'assets/boss-animations/boss-motion-atlas-b.webp',
    columns: 5,
    rows: 3,
    lod: 'desktop',
  }),
] as const satisfies readonly BossMotionAtlasMetadata[])

export interface BossClipProfile {
  readonly bossId: BossId
  /**
   * Stable visual-art row across both atlas sheets. Reused silhouettes share
   * this number until they receive unique authored art.
   */
  readonly artRow: BossArtRow
  readonly atlasIndex: BossMotionAtlasIndex
  readonly atlasRow: BossMotionAtlasRow
  readonly quadruped: boolean
  /**
   * Horizontal direction the authored side-facing cells point before runtime
   * mirroring. Most rows point right or are frontal; the Railjaw art row was
   * authored facing left.
   */
  readonly authoredFacing: -1 | 1
  /**
   * Number of authored A/B contact changes per second. Two changes form one
   * complete locomotion cycle.
   */
  readonly contactRateHz: number
}

const profile = (
  bossId: BossId,
  artRow: BossArtRow,
  quadruped: boolean,
  contactRateHz: number,
): Readonly<BossClipProfile> => {
  const atlasIndex = Math.floor(artRow / 3) as BossMotionAtlasIndex
  const atlasRow = (artRow % 3) as BossMotionAtlasRow
  return Object.freeze({
    bossId,
    artRow,
    atlasIndex,
    atlasRow,
    quadruped,
    authoredFacing: artRow === 2 ? -1 : 1,
    contactRateHz,
  })
}

/**
 * Ten encounter identities currently map to six authored silhouettes. The
 * duplicate rows are intentional and match the campaign's existing boss art.
 */
export const BOSS_CLIP_PROFILES = Object.freeze({
  'gloam-stag': profile('gloam-stag', 0, true, 5.2),
  'mire-cantor': profile('mire-cantor', 1, false, 4.1),
  'railjaw-prime': profile('railjaw-prime', 2, true, 4.65),
  'mirror-matron': profile('mirror-matron', 3, false, 3.55),
  'tide-apostle': profile('tide-apostle', 1, false, 3.25),
  'storm-engine': profile('storm-engine', 4, false, 3.9),
  chronophage: profile('chronophage', 4, false, 3.85),
  'furnace-titan': profile('furnace-titan', 2, true, 4.35),
  cartographer: profile('cartographer', 3, false, 3.18),
  'sun-eater': profile('sun-eater', 5, false, 2.72),
} as const satisfies Readonly<Record<BossId, Readonly<BossClipProfile>>>)

export const QUADRUPED_BOSS_IDS = Object.freeze([
  'gloam-stag',
  'railjaw-prime',
  'furnace-titan',
] as const satisfies readonly BossId[])

const BOSS_SPECIAL_STYLES = new Set<AttackMotionStyle>([
  'boss-line',
  'boss-orbit',
  'boss-cross',
  'boss-mirror',
  'boss-cluster',
  'boss-phase',
  'boss-intro',
])

export const BOSS_SPECIAL_RELEASE_TAIL_SECONDS = 0.24
export const BOSS_MOVE_POSE_THRESHOLD = 0.18

export type BossResolvedClipState =
  | 'idle'
  | 'move'
  | 'attack-windup'
  | 'special-release'
  | 'hit-fallback'
  | 'death-fallback'

export interface BossClipResolverInput {
  readonly bossId: BossId
  readonly time: number
  readonly moving: number
  readonly attackMotionStyle: AttackMotionStyle
  readonly attackMotionRemaining: number
  readonly attackMotionDuration: number
  readonly hitMotionRemaining?: number
  readonly hitMotionDuration?: number
  readonly deathMotionRemaining?: number
  readonly deathMotionDuration?: number
}

export interface ResolvedBossClipFrame {
  readonly bossId: BossId
  readonly state: BossResolvedClipState
  readonly pose: BossAuthoredPose
  readonly progress: number
  readonly quadruped: boolean
  readonly atlasIndex: BossMotionAtlasIndex
  readonly atlasRow: BossMotionAtlasRow
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

export function bossClipProfile(bossId: BossId): Readonly<BossClipProfile> {
  return BOSS_CLIP_PROFILES[bossId]
}

/**
 * Converts a desired world-facing direction into the sprite scale sign for
 * the boss's authored atlas row. This keeps player tracking independent from
 * whether that row was painted facing left, right, or frontally.
 */
export function bossSpriteFacingScale(
  bossId: BossId,
  desiredFacing: -1 | 1,
): -1 | 1 {
  return (desiredFacing * bossClipProfile(bossId).authoredFacing) as -1 | 1
}

export function isBossSpecialMotionStyle(style: AttackMotionStyle) {
  return BOSS_SPECIAL_STYLES.has(style)
}

/**
 * Mirrors the existing boss telegraph timing: the last 0.24 seconds are the
 * authored release tail. The clamp keeps malformed or unusually short timers
 * readable without moving any gameplay event.
 */
export function bossSpecialReleaseProgress(duration: number) {
  const safeDuration = finiteNonNegative(duration)
  if (safeDuration <= 0) return 1
  return clamp01(
    Math.max(
      0.52,
      Math.min(
        0.88,
        (safeDuration - BOSS_SPECIAL_RELEASE_TAIL_SECONDS) / safeDuration,
      ),
    ),
  )
}

const resolveContactPose = (
  time: number,
  contactRateHz: number,
): 'move-contact-a' | 'move-contact-b' => {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0
  const contactIndex = Math.floor(safeTime * contactRateHz)
  return contactIndex % 2 === 0 ? 'move-contact-a' : 'move-contact-b'
}

const resolvedFrame = (
  profileData: Readonly<BossClipProfile>,
  state: BossResolvedClipState,
  pose: BossAuthoredPose,
  progress: number,
): ResolvedBossClipFrame => {
  const atlas = BOSS_MOTION_ATLASES[profileData.atlasIndex]
  const column = BOSS_POSE_COLUMNS[pose]
  return {
    bossId: profileData.bossId,
    state,
    pose,
    progress: clamp01(progress),
    quadruped: profileData.quadruped,
    atlasIndex: profileData.atlasIndex,
    atlasRow: profileData.atlasRow,
    column,
    frameIndex: profileData.atlasRow * atlas.columns + column,
    assetPath: atlas.path,
  }
}

/**
 * Resolves only which authored texture cell should be displayed. It purposely
 * returns no position, velocity, radius, damage, or timing mutation, keeping
 * rendering independent from gameplay and collision.
 *
 * Precedence: death fallback > hit fallback > special/attack > move > idle.
 * The existing affine hit/death sampler can continue to supply recoil, fall,
 * and fade while these five-pose atlases provide the detailed silhouette.
 */
export function resolveBossClipFrame(
  input: BossClipResolverInput,
): ResolvedBossClipFrame {
  const profileData = bossClipProfile(input.bossId)
  const deathProgress = activeTimerProgress(
    input.deathMotionRemaining,
    input.deathMotionDuration,
  )
  if (deathProgress !== undefined) {
    return resolvedFrame(
      profileData,
      'death-fallback',
      'idle',
      deathProgress,
    )
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
  const attackActive =
    attackProgress !== undefined &&
    (input.attackMotionStyle === 'melee' ||
      isBossSpecialMotionStyle(input.attackMotionStyle))
  if (attackActive) {
    const releaseProgress = bossSpecialReleaseProgress(
      input.attackMotionDuration,
    )
    if (
      attackProgress >=
      (isBossSpecialMotionStyle(input.attackMotionStyle)
        ? releaseProgress
        : 0.52)
    ) {
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
  if (moving >= BOSS_MOVE_POSE_THRESHOLD) {
    return resolvedFrame(
      profileData,
      'move',
      resolveContactPose(input.time, profileData.contactRateHz),
      moving,
    )
  }

  return resolvedFrame(profileData, 'idle', 'idle', 0)
}
