import { describe, expect, it } from 'vitest'
import type { EnemyId } from '../shared/types'
import {
  ENEMY_CLIP_PROFILES,
  ENEMY_MOTION_ATLASES,
  ENEMY_MOVE_POSE_THRESHOLD,
  ENEMY_POSE_COLUMNS,
  QUADRUPED_ENEMY_IDS,
  enemyAttackReleaseProgress,
  enemyClipProfile,
  resolveEnemyClipFrame,
  type EnemyAttackMotionStyle,
  type EnemyClipResolverInput,
} from './enemyAnimationClips'

const ENEMY_IDS = [
  'maskling',
  'shardwing',
  'cantor',
  'railjaw',
  'chronowisp',
  'cinder-guard',
] as const satisfies readonly EnemyId[]

const input = (
  overrides: Partial<EnemyClipResolverInput> = {},
): EnemyClipResolverInput => ({
  enemyId: 'maskling',
  uid: 0,
  time: 0,
  moving: 0,
  attackMotionStyle: 'none',
  attackMotionRemaining: 0,
  attackMotionDuration: 0,
  hitMotionRemaining: 0,
  hitMotionDuration: 0,
  deathMotionRemaining: 0,
  deathMotionDuration: 0,
  ...overrides,
})

describe('horde authored motion atlas metadata', () => {
  it('maps the six species onto the declared 5x3 sheets in authored row order', () => {
    expect(ENEMY_MOTION_ATLASES).toEqual([
      {
        index: 0,
        path: 'assets/enemy-animations/enemy-motion-atlas-a.webp',
        columns: 5,
        rows: 3,
        lod: 'shared',
      },
      {
        index: 1,
        path: 'assets/enemy-animations/enemy-motion-atlas-b.webp',
        columns: 5,
        rows: 3,
        lod: 'shared',
      },
    ])
    expect(
      ENEMY_IDS.map((enemyId) => {
        const profile = enemyClipProfile(enemyId)
        return [profile.atlasIndex, profile.atlasRow]
      }),
    ).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ])
    expect(Object.keys(ENEMY_CLIP_PROFILES)).toEqual(ENEMY_IDS)
  })

  it('marks Railjaw as the true quadruped and preserves species locomotion families', () => {
    expect(QUADRUPED_ENEMY_IDS).toEqual(['railjaw'])
    expect(
      ENEMY_IDS.filter((enemyId) => enemyClipProfile(enemyId).quadruped),
    ).toEqual(QUADRUPED_ENEMY_IDS)
    expect(enemyClipProfile('maskling').locomotion).toBe('knuckle-run')
    expect(enemyClipProfile('shardwing').locomotion).toBe('flight')
    expect(enemyClipProfile('cantor').locomotion).toBe('float')
    expect(enemyClipProfile('railjaw').locomotion).toBe('quadruped')
    expect(enemyClipProfile('chronowisp').locomotion).toBe('float')
    expect(enemyClipProfile('cinder-guard').locomotion).toBe('biped')
  })
})

describe('horde authored pose resolution', () => {
  it('resolves all five authored cells for every species', () => {
    const physicalCells = new Set<string>()

    for (const enemyId of ENEMY_IDS) {
      const profile = enemyClipProfile(enemyId)
      const frames = [
        resolveEnemyClipFrame(input({ enemyId })),
        resolveEnemyClipFrame(input({ enemyId, moving: 1, time: 0, uid: 0 })),
        resolveEnemyClipFrame(
          input({
            enemyId,
            moving: 1,
            time: 1 / profile.contactRateHz + 0.0001,
            uid: 0,
          }),
        ),
        resolveEnemyClipFrame(
          input({
            enemyId,
            attackMotionStyle: 'ranged',
            attackMotionRemaining: 0.9,
            attackMotionDuration: 1,
          }),
        ),
        resolveEnemyClipFrame(
          input({
            enemyId,
            attackMotionStyle: 'ranged',
            attackMotionRemaining: 0.08,
            attackMotionDuration: 1,
          }),
        ),
      ]

      expect(
        frames.map(({ state, pose, column }) => ({ state, pose, column })),
      ).toEqual([
        { state: 'idle', pose: 'idle', column: 0 },
        { state: 'move', pose: 'move-contact-a', column: 1 },
        { state: 'move', pose: 'move-contact-b', column: 2 },
        {
          state: 'attack-windup',
          pose: 'attack-windup',
          column: 3,
        },
        {
          state: 'special-release',
          pose: 'special-release',
          column: 4,
        },
      ])

      for (const frame of frames) {
        const atlas = ENEMY_MOTION_ATLASES[frame.atlasIndex]
        expect(frame.frameIndex).toBe(frame.atlasRow * atlas.columns + frame.column)
        expect(frame.assetPath).toBe(atlas.path)
        physicalCells.add(
          `${frame.atlasIndex}:${frame.atlasRow}:${frame.column}`,
        )
      }
    }

    expect(physicalCells.size).toBe(6 * 5)
  })

  it('alternates contact poses deterministically and desynchronises neighboring UIDs', () => {
    for (const enemyId of ENEMY_IDS) {
      const rate = enemyClipProfile(enemyId).contactRateHz
      const first = resolveEnemyClipFrame(
        input({ enemyId, uid: 1, moving: 1, time: 0 }),
      )
      const neighbor = resolveEnemyClipFrame(
        input({ enemyId, uid: 2, moving: 1, time: 0 }),
      )
      const repeated = resolveEnemyClipFrame(
        input({ enemyId, uid: 1, moving: 1, time: 0 }),
      )
      const nextContact = resolveEnemyClipFrame(
        input({ enemyId, uid: 1, moving: 1, time: 1 / rate + 0.0001 }),
      )

      expect(repeated).toEqual(first)
      expect(neighbor.pose).not.toBe(first.pose)
      expect(nextContact.pose).not.toBe(first.pose)
      expect([first.pose, nextContact.pose]).toEqual(
        expect.arrayContaining(['move-contact-a', 'move-contact-b']),
      )
    }
  })

  it('uses the quadruped Railjaw A/B cells as distinct diagonal contacts', () => {
    const rate = enemyClipProfile('railjaw').contactRateHz
    const contactA = resolveEnemyClipFrame(
      input({ enemyId: 'railjaw', moving: 1, time: 0, uid: 0 }),
    )
    const contactB = resolveEnemyClipFrame(
      input({
        enemyId: 'railjaw',
        moving: 1,
        time: 1 / rate + 0.0001,
        uid: 0,
      }),
    )

    expect(contactA.quadruped).toBe(true)
    expect(contactB.quadruped).toBe(true)
    expect(contactA.column).toBe(ENEMY_POSE_COLUMNS['move-contact-a'])
    expect(contactB.column).toBe(ENEMY_POSE_COLUMNS['move-contact-b'])
    expect(contactA.frameIndex).not.toBe(contactB.frameIndex)
  })

  it('supports every current enemy attack plus the ranged extension', () => {
    const styles = [
      'melee',
      'cast',
      'charge',
      'blink',
      'slam',
      'ranged',
    ] as const satisfies readonly EnemyAttackMotionStyle[]

    for (const enemyId of ENEMY_IDS) {
      for (const attackMotionStyle of styles) {
        const releaseAt = enemyAttackReleaseProgress(attackMotionStyle, 1)
        const windup = resolveEnemyClipFrame(
          input({
            enemyId,
            moving: 1,
            attackMotionStyle,
            attackMotionRemaining: 1 - Math.max(0, releaseAt - 0.05),
            attackMotionDuration: 1,
          }),
        )
        const release = resolveEnemyClipFrame(
          input({
            enemyId,
            moving: 1,
            attackMotionStyle,
            attackMotionRemaining: 1 - Math.min(0.99, releaseAt + 0.05),
            attackMotionDuration: 1,
          }),
        )

        expect(windup.state).toBe('attack-windup')
        expect(windup.pose).toBe('attack-windup')
        expect(release.state).toBe('special-release')
        expect(release.pose).toBe('special-release')
      }
    }
  })

  it('gives death, hit, and attacks strict precedence over locomotion', () => {
    const base = {
      moving: 1,
      attackMotionStyle: 'ranged' as const,
      attackMotionRemaining: 0.05,
      attackMotionDuration: 1,
    }
    const attack = resolveEnemyClipFrame(input(base))
    const hit = resolveEnemyClipFrame(
      input({
        ...base,
        hitMotionRemaining: 0.1,
        hitMotionDuration: 0.2,
      }),
    )
    const death = resolveEnemyClipFrame(
      input({
        ...base,
        hitMotionRemaining: 0.1,
        hitMotionDuration: 0.2,
        deathMotionRemaining: 0.5,
        deathMotionDuration: 0.8,
      }),
    )

    expect(attack.state).toBe('special-release')
    expect(hit.state).toBe('hit-fallback')
    expect(hit.pose).toBe('attack-windup')
    expect(death.state).toBe('death-fallback')
    expect(death.pose).toBe('idle')
  })

  it('keeps idle and locomotion distinct across the move threshold', () => {
    for (const enemyId of ENEMY_IDS) {
      const idle = resolveEnemyClipFrame(
        input({ enemyId, moving: ENEMY_MOVE_POSE_THRESHOLD - 0.0001 }),
      )
      const move = resolveEnemyClipFrame(
        input({ enemyId, moving: ENEMY_MOVE_POSE_THRESHOLD }),
      )
      expect(idle.state).toBe('idle')
      expect(move.state).toBe('move')
      expect(idle.frameIndex).not.toBe(move.frameIndex)
    }
  })

  it('keeps malformed inputs deterministic, bounded, and simulation-free', () => {
    const styles = [
      'none',
      'melee',
      'cast',
      'charge',
      'blink',
      'slam',
      'ranged',
    ] as const satisfies readonly EnemyAttackMotionStyle[]

    for (const enemyId of ENEMY_IDS) {
      for (const attackMotionStyle of styles) {
        const frame = resolveEnemyClipFrame(
          input({
            enemyId,
            uid: Number.NaN,
            time: Number.POSITIVE_INFINITY,
            moving: Number.NaN,
            attackMotionStyle,
            attackMotionRemaining: attackMotionStyle === 'none' ? 0 : 0.05,
            attackMotionDuration: attackMotionStyle === 'none' ? 0 : 1,
          }),
        )
        const atlas = ENEMY_MOTION_ATLASES[frame.atlasIndex]
        expect(Number.isFinite(frame.progress)).toBe(true)
        expect(frame.progress).toBeGreaterThanOrEqual(0)
        expect(frame.progress).toBeLessThanOrEqual(1)
        expect(frame.atlasRow).toBeGreaterThanOrEqual(0)
        expect(frame.atlasRow).toBeLessThan(atlas.rows)
        expect(frame.column).toBeGreaterThanOrEqual(0)
        expect(frame.column).toBeLessThan(atlas.columns)
        expect(frame.frameIndex).toBeGreaterThanOrEqual(0)
        expect(frame.frameIndex).toBeLessThan(atlas.columns * atlas.rows)
        expect(frame).not.toHaveProperty('x')
        expect(frame).not.toHaveProperty('y')
        expect(frame).not.toHaveProperty('speed')
        expect(frame).not.toHaveProperty('damage')
      }
    }
  })
})
