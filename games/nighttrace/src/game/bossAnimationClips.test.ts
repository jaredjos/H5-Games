import { describe, expect, it } from 'vitest'
import type { BossId } from '../shared/types'
import {
  BOSS_CLIP_PROFILES,
  BOSS_MOTION_ATLASES,
  BOSS_POSE_COLUMNS,
  QUADRUPED_BOSS_IDS,
  bossClipProfile,
  bossSpecialReleaseProgress,
  resolveBossClipFrame,
  type BossClipResolverInput,
} from './bossAnimationClips'
import { LEVELS } from './content'

const BOSS_IDS: readonly BossId[] = [
  'gloam-stag',
  'mire-cantor',
  'railjaw-prime',
  'mirror-matron',
  'tide-apostle',
  'storm-engine',
  'chronophage',
  'furnace-titan',
  'cartographer',
  'sun-eater',
]

const input = (
  overrides: Partial<BossClipResolverInput> = {},
): BossClipResolverInput => ({
  bossId: 'gloam-stag',
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

describe('boss authored motion atlas metadata', () => {
  it('covers the complete ten-level campaign boss order', () => {
    expect(LEVELS.map(({ bossId }) => bossId)).toEqual(BOSS_IDS)
    expect(Object.keys(BOSS_CLIP_PROFILES)).toEqual(
      LEVELS.map(({ bossId }) => bossId),
    )
  })

  it('maps all ten bosses onto six art rows across two 5x3 desktop atlases', () => {
    expect(Object.keys(BOSS_CLIP_PROFILES)).toEqual(BOSS_IDS)
    expect(BOSS_MOTION_ATLASES).toHaveLength(2)
    expect(
      BOSS_MOTION_ATLASES.map(({ columns, rows, lod }) => ({
        columns,
        rows,
        lod,
      })),
    ).toEqual([
      { columns: 5, rows: 3, lod: 'desktop' },
      { columns: 5, rows: 3, lod: 'desktop' },
    ])
    expect(new Set(BOSS_IDS.map((bossId) => bossClipProfile(bossId).artRow))).toEqual(
      new Set([0, 1, 2, 3, 4, 5]),
    )

    for (const bossId of BOSS_IDS) {
      const profile = bossClipProfile(bossId)
      expect(profile.atlasIndex).toBe(Math.floor(profile.artRow / 3))
      expect(profile.atlasRow).toBe(profile.artRow % 3)
      expect(Object.isFrozen(profile)).toBe(true)
    }

    expect(bossClipProfile('tide-apostle').artRow).toBe(
      bossClipProfile('mire-cantor').artRow,
    )
    expect(bossClipProfile('chronophage').artRow).toBe(
      bossClipProfile('storm-engine').artRow,
    )
    expect(bossClipProfile('furnace-titan').artRow).toBe(
      bossClipProfile('railjaw-prime').artRow,
    )
    expect(bossClipProfile('cartographer').artRow).toBe(
      bossClipProfile('mirror-matron').artRow,
    )
  })

  it('explicitly marks the three quadruped encounter identities', () => {
    expect(QUADRUPED_BOSS_IDS).toEqual([
      'gloam-stag',
      'railjaw-prime',
      'furnace-titan',
    ])
    const marked = BOSS_IDS.filter(
      (bossId) => bossClipProfile(bossId).quadruped,
    )
    expect(marked).toEqual(QUADRUPED_BOSS_IDS)
  })
})

describe('boss authored pose resolution', () => {
  it('resolves all five authored poses for every one of the ten bosses', () => {
    const reachedCells = new Set<string>()

    for (const bossId of BOSS_IDS) {
      const profile = bossClipProfile(bossId)
      const contactBTime = 1 / profile.contactRateHz + 0.0001
      const frames = [
        resolveBossClipFrame(input({ bossId })),
        resolveBossClipFrame(input({ bossId, moving: 1, time: 0 })),
        resolveBossClipFrame(
          input({ bossId, moving: 1, time: contactBTime }),
        ),
        resolveBossClipFrame(
          input({
            bossId,
            moving: 1,
            attackMotionStyle: 'boss-line',
            attackMotionRemaining: 0.9,
            attackMotionDuration: 1,
          }),
        ),
        resolveBossClipFrame(
          input({
            bossId,
            moving: 1,
            attackMotionStyle: 'boss-line',
            attackMotionRemaining: 0.1,
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
        expect(frame.bossId).toBe(bossId)
        expect(frame.atlasIndex).toBe(profile.atlasIndex)
        expect(frame.atlasRow).toBe(profile.atlasRow)
        expect(frame.assetPath).toBe(
          BOSS_MOTION_ATLASES[profile.atlasIndex].path,
        )
        expect(frame.frameIndex).toBe(profile.atlasRow * 5 + frame.column)
        reachedCells.add(
          `${frame.atlasIndex}:${frame.atlasRow}:${frame.column}`,
        )
      }
    }

    // Ten encounter identities intentionally share six authored silhouettes.
    // This proves every one of the 30 physical atlas cells remains reachable.
    expect(reachedCells.size).toBe(6 * 5)
  })

  it('alternates both contact poses for every boss locomotion clip', () => {
    for (const bossId of BOSS_IDS) {
      const rate = bossClipProfile(bossId).contactRateHz
      const contactA = resolveBossClipFrame(
        input({ bossId, moving: 1, time: 0 }),
      )
      const contactB = resolveBossClipFrame(
        input({ bossId, moving: 1, time: 1 / rate + 0.0001 }),
      )

      expect(contactA.state).toBe('move')
      expect(contactB.state).toBe('move')
      expect(contactA.frameIndex).not.toBe(contactB.frameIndex)
      expect(contactA.pose).toBe('move-contact-a')
      expect(contactB.pose).toBe('move-contact-b')
    }
  })

  it('alternates quadruped contact A and B deterministically while moving', () => {
    for (const bossId of QUADRUPED_BOSS_IDS) {
      const rate = bossClipProfile(bossId).contactRateHz
      const contactA = resolveBossClipFrame(
        input({ bossId, moving: 1, time: 0 }),
      )
      const repeatedA = resolveBossClipFrame(
        input({ bossId, moving: 1, time: 0 }),
      )
      const contactB = resolveBossClipFrame(
        input({ bossId, moving: 1, time: 1 / rate + 0.0001 }),
      )
      const nextA = resolveBossClipFrame(
        input({ bossId, moving: 1, time: 2 / rate + 0.0001 }),
      )

      expect(contactA).toEqual(repeatedA)
      expect(contactA.pose).toBe('move-contact-a')
      expect(contactB.pose).toBe('move-contact-b')
      expect(nextA.pose).toBe('move-contact-a')
      expect(contactA.column).toBe(BOSS_POSE_COLUMNS['move-contact-a'])
      expect(contactB.column).toBe(BOSS_POSE_COLUMNS['move-contact-b'])
      expect(contactA.quadruped).toBe(true)
      expect(contactB.quadruped).toBe(true)
      expect(contactA.frameIndex).not.toBe(contactB.frameIndex)
    }
  })

  it('uses attack windup and timed special release ahead of locomotion', () => {
    const melee = resolveBossClipFrame(
      input({
        moving: 1,
        attackMotionStyle: 'melee',
        attackMotionRemaining: 0.4,
        attackMotionDuration: 0.8,
      }),
    )
    const specialWindup = resolveBossClipFrame(
      input({
        moving: 1,
        attackMotionStyle: 'boss-line',
        attackMotionRemaining: 0.6,
        attackMotionDuration: 1,
      }),
    )
    const specialRelease = resolveBossClipFrame(
      input({
        moving: 1,
        attackMotionStyle: 'boss-line',
        attackMotionRemaining: 0.1,
        attackMotionDuration: 1,
      }),
    )

    expect(bossSpecialReleaseProgress(1)).toBeCloseTo(0.76)
    expect(melee.state).toBe('attack-windup')
    expect(melee.pose).toBe('attack-windup')
    expect(specialWindup.state).toBe('attack-windup')
    expect(specialRelease.state).toBe('special-release')
    expect(specialRelease.pose).toBe('special-release')
  })

  it('gives every sovereign special style a distinct windup and release window', () => {
    const specialStyles = [
      'boss-line',
      'boss-orbit',
      'boss-cross',
      'boss-mirror',
      'boss-cluster',
      'boss-phase',
      'boss-intro',
    ] as const

    for (const bossId of BOSS_IDS) {
      for (const attackMotionStyle of specialStyles) {
        const windup = resolveBossClipFrame(
          input({
            bossId,
            moving: 1,
            attackMotionStyle,
            attackMotionRemaining: 0.9,
            attackMotionDuration: 1,
          }),
        )
        const release = resolveBossClipFrame(
          input({
            bossId,
            moving: 1,
            attackMotionStyle,
            attackMotionRemaining: 0.1,
            attackMotionDuration: 1,
          }),
        )

        expect(windup.state).toBe('attack-windup')
        expect(windup.pose).toBe('attack-windup')
        expect(windup.column).toBe(BOSS_POSE_COLUMNS['attack-windup'])
        expect(release.state).toBe('special-release')
        expect(release.pose).toBe('special-release')
        expect(release.column).toBe(BOSS_POSE_COLUMNS['special-release'])
        expect(windup.frameIndex).not.toBe(release.frameIndex)
      }
    }
  })

  it('keeps idle distinct from locomotion below and above its motion threshold', () => {
    for (const bossId of BOSS_IDS) {
      const still = resolveBossClipFrame(
        input({ bossId, moving: 0.179999, time: 4 }),
      )
      const moving = resolveBossClipFrame(
        input({ bossId, moving: 0.18, time: 4 }),
      )

      expect(still.state).toBe('idle')
      expect(still.pose).toBe('idle')
      expect(moving.state).toBe('move')
      expect(moving.pose).toMatch(/^move-contact-[ab]$/)
      expect(still.frameIndex).not.toBe(moving.frameIndex)
    }
  })

  it('gives death and hit fallbacks precedence over special attacks', () => {
    const hit = resolveBossClipFrame(
      input({
        moving: 1,
        attackMotionStyle: 'boss-orbit',
        attackMotionRemaining: 0.1,
        attackMotionDuration: 1,
        hitMotionRemaining: 0.1,
        hitMotionDuration: 0.2,
      }),
    )
    const death = resolveBossClipFrame(
      input({
        moving: 1,
        attackMotionStyle: 'boss-orbit',
        attackMotionRemaining: 0.1,
        attackMotionDuration: 1,
        hitMotionRemaining: 0.1,
        hitMotionDuration: 0.2,
        deathMotionRemaining: 0.7,
        deathMotionDuration: 1,
      }),
    )

    expect(hit.state).toBe('hit-fallback')
    expect(hit.pose).toBe('attack-windup')
    expect(death.state).toBe('death-fallback')
    expect(death.pose).toBe('idle')
  })

  it('keeps every resolved frame within atlas bounds and gameplay-independent', () => {
    const styles = [
      'none',
      'melee',
      'boss-line',
      'boss-orbit',
      'boss-cross',
      'boss-mirror',
      'boss-cluster',
      'boss-phase',
      'boss-intro',
    ] as const

    for (const bossId of BOSS_IDS) {
      for (const style of styles) {
        for (const time of [Number.NaN, -1, 0, 0.25, 13.7]) {
          const frame = resolveBossClipFrame(
            input({
              bossId,
              time,
              moving: style === 'none' ? 1 : Number.NaN,
              attackMotionStyle: style,
              attackMotionRemaining: style === 'none' ? 0 : 0.08,
              attackMotionDuration: style === 'none' ? 0 : 1,
            }),
          )
          const atlas = BOSS_MOTION_ATLASES[frame.atlasIndex]
          expect(frame.atlasIndex).toBeGreaterThanOrEqual(0)
          expect(frame.atlasIndex).toBeLessThan(atlas ? 2 : 0)
          expect(frame.atlasRow).toBeGreaterThanOrEqual(0)
          expect(frame.atlasRow).toBeLessThan(atlas.rows)
          expect(frame.column).toBeGreaterThanOrEqual(0)
          expect(frame.column).toBeLessThan(atlas.columns)
          expect(frame.frameIndex).toBe(
            frame.atlasRow * atlas.columns + frame.column,
          )
          expect(frame.frameIndex).toBeGreaterThanOrEqual(0)
          expect(frame.frameIndex).toBeLessThan(atlas.columns * atlas.rows)
          expect(frame.assetPath).toBe(atlas.path)
          expect(frame).not.toHaveProperty('x')
          expect(frame).not.toHaveProperty('y')
          expect(frame).not.toHaveProperty('radius')
          expect(frame).not.toHaveProperty('damage')
        }
      }
    }
  })
})
