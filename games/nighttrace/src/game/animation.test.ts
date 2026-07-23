import { describe, expect, it } from 'vitest'
import {
  HERO_FIRE_DURATION,
  HERO_FIRE_RELEASE_TIME,
  heroChargeFrameAt,
  heroFireFrameAt,
  heroPulseRecoveryFrameAt,
  heroWalkFrameAt,
  motionProgress,
  sampleBossMotion,
  sampleEnemyMotion,
  sampleHeroMotion,
  type AttackMotionStyle,
  type MotionPose,
} from './animation'
import type { EnemyId } from '../shared/types'

const ENEMY_IDS: EnemyId[] = [
  'maskling',
  'shardwing',
  'cantor',
  'railjaw',
  'chronowisp',
  'cinder-guard',
]

const ENEMY_ATTACK_CASES: Array<{
  id: EnemyId
  style: AttackMotionStyle
  progress: number
}> = [
  { id: 'maskling', style: 'melee', progress: 0.5 },
  { id: 'shardwing', style: 'melee', progress: 0.5 },
  { id: 'cantor', style: 'cast', progress: 0.56 },
  { id: 'railjaw', style: 'charge', progress: 0.62 },
  { id: 'chronowisp', style: 'blink', progress: 0.45 },
  { id: 'cinder-guard', style: 'slam', progress: 0.72 },
]

const BOSS_ATTACK_CASES: Array<{
  style: AttackMotionStyle
  progress: number
}> = [
  { style: 'boss-line', progress: 0.62 },
  { style: 'boss-orbit', progress: 0.5 },
  { style: 'boss-cross', progress: 0.5 },
  { style: 'boss-mirror', progress: 0.5 },
  { style: 'boss-cluster', progress: 0.72 },
  { style: 'boss-phase', progress: 0.5 },
  { style: 'boss-intro', progress: 0.18 },
]

const BOSS_FRAMES_BY_LEVEL = [0, 1, 2, 3, 1, 4, 4, 2, 3, 5] as const

const visualPoseDistance = (left: MotionPose, right: MotionPose) =>
  Math.hypot(left.offsetX - right.offsetX, left.offsetY - right.offsetY) +
  Math.abs(left.rotation - right.rotation) * 40 +
  Math.abs(left.scaleX - right.scaleX) * 32 +
  Math.abs(left.scaleY - right.scaleY) * 32 +
  Math.abs(left.alpha - right.alpha) * 28 +
  Math.abs(left.glow - right.glow) * 14

const expectFinitePose = (pose: MotionPose) => {
  for (const value of Object.values(pose)) expect(Number.isFinite(value)).toBe(true)
}

const expectHordePoseBounds = (pose: MotionPose) => {
  expectFinitePose(pose)
  expect(Math.abs(pose.offsetX)).toBeLessThanOrEqual(46)
  expect(Math.abs(pose.offsetY)).toBeLessThanOrEqual(46)
  expect(Math.abs(pose.rotation)).toBeLessThanOrEqual(0.36)
  expect(pose.scaleX).toBeGreaterThanOrEqual(0.45)
  expect(pose.scaleX).toBeLessThanOrEqual(1.35)
  expect(pose.scaleY).toBeGreaterThanOrEqual(0.72)
  expect(pose.scaleY).toBeLessThanOrEqual(1.35)
  expect(pose.alpha).toBeGreaterThanOrEqual(0.15)
  expect(pose.alpha).toBeLessThanOrEqual(1)
  expect(pose.glow).toBeGreaterThanOrEqual(0)
  expect(pose.glow).toBeLessThanOrEqual(1)
}

const expectBossPoseBounds = (pose: MotionPose) => {
  expectFinitePose(pose)
  expect(Math.abs(pose.offsetX)).toBeLessThanOrEqual(52)
  expect(Math.abs(pose.offsetY)).toBeLessThanOrEqual(52)
  expect(Math.abs(pose.rotation)).toBeLessThanOrEqual(0.36)
  expect(pose.scaleX).toBeGreaterThanOrEqual(0.6)
  expect(pose.scaleX).toBeLessThanOrEqual(1.62)
  expect(pose.scaleY).toBeGreaterThanOrEqual(0.6)
  expect(pose.scaleY).toBeLessThanOrEqual(1.62)
  expect(pose.alpha).toBeGreaterThanOrEqual(0.12)
  expect(pose.alpha).toBeLessThanOrEqual(1)
  expect(pose.glow).toBeGreaterThanOrEqual(0)
  expect(pose.glow).toBeLessThanOrEqual(1)
}

describe('motionProgress', () => {
  it('returns an inactive sentinel when no action is running', () => {
    expect(motionProgress(0, 0.4)).toBe(-1)
    expect(motionProgress(-0.1, 0.4)).toBe(-1)
  })

  it('maps a running action into a stable zero-to-one window', () => {
    expect(motionProgress(0.8, 0.8)).toBe(0)
    expect(motionProgress(0.4, 0.8)).toBeCloseTo(0.5)
    expect(motionProgress(0.01, 0.8)).toBeGreaterThan(0.98)
  })
})

describe('authored hero sprite timing', () => {
  it('plays all eight locomotion drawings at the approved 12.5 drawings per second', () => {
    expect(heroWalkFrameAt(0)).toBe(0)
    expect(heroWalkFrameAt(0.079)).toBe(0)
    expect(heroWalkFrameAt(0.08)).toBe(1)
    expect(heroWalkFrameAt(0.56)).toBe(7)
    expect(heroWalkFrameAt(0.64)).toBe(0)
  })

  it('aligns the discharge drawing with the existing instant projectile release', () => {
    expect(heroFireFrameAt(0)).toBe(0)
    expect(heroFireFrameAt(0.069)).toBe(0)
    expect(heroFireFrameAt(0.07)).toBe(1)
    expect(heroFireFrameAt(HERO_FIRE_RELEASE_TIME)).toBe(3)
    expect(heroFireFrameAt(HERO_FIRE_DURATION - 0.001)).toBe(5)
  })

  it('ping-pongs the solar-ready loop and recovers from its peak after a pulse', () => {
    const readyLoop = [0, 0.13, 0.25, 0.38, 0.5, 0.63, 0.75, 0.88, 1, 1.13].map(
      heroChargeFrameAt,
    )
    expect(readyLoop).toEqual([0, 1, 2, 3, 4, 5, 4, 3, 2, 1])
    expect(heroChargeFrameAt(1.25)).toBe(0)
    expect(heroPulseRecoveryFrameAt(0)).toBe(5)
    expect(heroPulseRecoveryFrameAt(1)).toBe(0)
  })
})

describe('character motion samplers', () => {
  it('gives a moving hero a bounded gait and a stronger attack release', () => {
    const walking = sampleHeroMotion({
      time: 0.45,
      moving: 1,
      attackProgress: -1,
      attackAngle: 0,
      attackStyle: 'none',
      hurtProgress: -1,
      reducedMotion: false,
    })
    const attacking = sampleHeroMotion({
      time: 0.45,
      moving: 1,
      attackProgress: 0.5,
      attackAngle: 0,
      attackStyle: 'hero-shot',
      hurtProgress: -1,
      reducedMotion: false,
    })

    expect(Math.abs(walking.offsetY)).toBeLessThanOrEqual(2.6)
    expect(attacking.offsetX).toBeGreaterThan(walking.offsetX + 5)
    expect(attacking.glow).toBeGreaterThan(0.5)
  })

  it('keeps horde gaits desynchronised and gives every special a readable pose', () => {
    const first = sampleEnemyMotion({
      id: 'maskling',
      uid: 1,
      time: 1.1,
      moving: 1,
      attackProgress: -1,
      attackAngle: 0,
      attackStyle: 'none',
      reducedMotion: false,
    })
    const second = sampleEnemyMotion({
      id: 'maskling',
      uid: 2,
      time: 1.1,
      moving: 1,
      attackProgress: -1,
      attackAngle: 0,
      attackStyle: 'none',
      reducedMotion: false,
    })
    const caster = sampleEnemyMotion({
      id: 'cantor',
      uid: 3,
      time: 1.1,
      moving: 1,
      attackProgress: 0.5,
      attackAngle: Math.PI / 2,
      attackStyle: 'cast',
      reducedMotion: false,
    })

    expect(first.rotation).not.toBe(second.rotation)
    expect(caster.offsetY).toBeLessThan(-5)
    expect(caster.glow).toBeGreaterThan(0.9)
  })

  it('gives every horde species a visible, deterministic locomotion cycle', () => {
    for (const [index, id] of ENEMY_IDS.entries()) {
      const early = sampleEnemyMotion({
        id,
        uid: index + 11,
        time: 0.17,
        moving: 1,
        attackProgress: -1,
        attackAngle: 0,
        attackStyle: 'none',
        reducedMotion: false,
      })
      const late = sampleEnemyMotion({
        id,
        uid: index + 11,
        time: 0.61,
        moving: 1,
        attackProgress: -1,
        attackAngle: 0,
        attackStyle: 'none',
        reducedMotion: false,
      })

      expectHordePoseBounds(early)
      expectHordePoseBounds(late)
      expect(visualPoseDistance(early, late), `${id} locomotion`).toBeGreaterThan(1.5)
      expect(
        sampleEnemyMotion({
          id,
          uid: index + 11,
          time: 0.61,
          moving: 1,
          attackProgress: -1,
          attackAngle: 0,
          attackStyle: 'none',
          reducedMotion: false,
        }),
      ).toEqual(late)
    }
  })

  it('gives each horde combat role a distinct anticipation or release pose', () => {
    for (const [index, motion] of ENEMY_ATTACK_CASES.entries()) {
      const locomotion = sampleEnemyMotion({
        id: motion.id,
        uid: index + 21,
        time: 1.13,
        moving: 1,
        attackProgress: -1,
        attackAngle: Math.PI / 5,
        attackStyle: 'none',
        reducedMotion: false,
      })
      const attacking = sampleEnemyMotion({
        id: motion.id,
        uid: index + 21,
        time: 1.13,
        moving: 1,
        attackProgress: motion.progress,
        attackAngle: Math.PI / 5,
        attackStyle: motion.style,
        reducedMotion: false,
      })

      expectHordePoseBounds(attacking)
      expect(
        visualPoseDistance(locomotion, attacking),
        `${motion.id} ${motion.style}`,
      ).toBeGreaterThan(10)
      expect(attacking.glow).toBeGreaterThan(0.35)
    }
  })

  it('keeps every horde locomotion and attack sample finite and visually bounded', () => {
    const styles: AttackMotionStyle[] = ['none', 'melee', 'cast', 'charge', 'blink', 'slam']
    const progressSamples = [-1, 0, 0.18, 0.38, 0.55, 0.76, 1]
    const angleSamples = [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]

    for (const [index, id] of ENEMY_IDS.entries()) {
      for (const style of styles) {
        for (const progress of progressSamples) {
          for (const angle of angleSamples) {
            expectHordePoseBounds(
              sampleEnemyMotion({
                id,
                uid: index + 1,
                time: 2.37,
                moving: 1.6,
                attackProgress: style === 'none' ? -1 : progress,
                attackAngle: angle,
                attackStyle: style,
                reducedMotion: false,
              }),
            )
          }
        }
      }
    }
  })

  it('gives different boss patterns distinct silhouettes', () => {
    const line = sampleBossMotion({
      bossFrame: 0,
      levelId: 1,
      phase: 2,
      time: 1,
      moving: 1,
      attackProgress: 0.6,
      attackAngle: 0,
      attackStyle: 'boss-line',
      reducedMotion: false,
    })
    const orbit = sampleBossMotion({
      bossFrame: 1,
      levelId: 2,
      phase: 2,
      time: 1,
      moving: 1,
      attackProgress: 0.6,
      attackAngle: 0,
      attackStyle: 'boss-orbit',
      reducedMotion: false,
    })

    expect(line.offsetX).toBeGreaterThan(10)
    expect(orbit.offsetY).toBeLessThan(-5)
    expect(Math.abs(orbit.rotation - line.rotation)).toBeGreaterThan(0.01)
  })

  it('gives all ten bosses a visible locomotion profile', () => {
    for (const [index, bossFrame] of BOSS_FRAMES_BY_LEVEL.entries()) {
      const levelId = index + 1
      const samples = [0.17, 0.53, 0.89, 1.25].map((time) =>
        sampleBossMotion({
          bossFrame,
          levelId,
          phase: 2,
          time,
          moving: 1,
          attackProgress: -1,
          attackAngle: 0,
          attackStyle: 'none',
          reducedMotion: false,
        }),
      )

      for (const sample of samples) expectBossPoseBounds(sample)
      expect(
        Math.max(
          ...samples
            .slice(1)
            .map((sample) => visualPoseDistance(samples[0], sample)),
        ),
        `level ${levelId} boss locomotion`,
      ).toBeGreaterThan(1.5)
    }
  })

  it('keeps every boss signature, phase shift, and intro finite, bounded, and readable', () => {
    for (const [index, motion] of BOSS_ATTACK_CASES.entries()) {
      const baseInput = {
        bossFrame: index % 6,
        levelId: index + 1,
        phase: 3,
        time: 1.37,
        moving: 1,
        attackAngle: -Math.PI / 4,
        reducedMotion: false,
      }
      const locomotion = sampleBossMotion({
        ...baseInput,
        attackProgress: -1,
        attackStyle: 'none',
      })
      const attacking = sampleBossMotion({
        ...baseInput,
        attackProgress: motion.progress,
        attackStyle: motion.style,
      })

      expectBossPoseBounds(attacking)
      expect(
        visualPoseDistance(locomotion, attacking),
        motion.style,
      ).toBeGreaterThan(12)
      expect(attacking.glow).toBeGreaterThan(0.45)
    }
  })

  it('keeps boss poses bounded across all frames, phases, angles, and action windows', () => {
    const styles: AttackMotionStyle[] = [
      'boss-line',
      'boss-orbit',
      'boss-cross',
      'boss-mirror',
      'boss-cluster',
      'boss-phase',
      'boss-intro',
    ]
    const progressSamples = [0, 0.18, 0.4, 0.58, 0.78, 1]
    const angleSamples = [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]

    for (let bossFrame = 0; bossFrame < 6; bossFrame += 1) {
      for (let phase = 1; phase <= 4; phase += 1) {
        for (const style of styles) {
          for (const progress of progressSamples) {
            for (const angle of angleSamples) {
              expectBossPoseBounds(
                sampleBossMotion({
                  bossFrame,
                  levelId: bossFrame + 1,
                  phase,
                  time: 2.37,
                  moving: 1.6,
                  attackProgress: progress,
                  attackAngle: angle,
                  attackStyle: style,
                  reducedMotion: false,
                }),
              )
            }
          }
        }
      }
    }
  })

  it('honours reduced motion without removing the telegraph', () => {
    const full = sampleEnemyMotion({
      id: 'railjaw',
      uid: 5,
      time: 1,
      moving: 1,
      attackProgress: 0.5,
      attackAngle: 0,
      attackStyle: 'charge',
      reducedMotion: false,
    })
    const reduced = sampleEnemyMotion({
      id: 'railjaw',
      uid: 5,
      time: 1,
      moving: 1,
      attackProgress: 0.5,
      attackAngle: 0,
      attackStyle: 'charge',
      reducedMotion: true,
    })

    expect(Math.abs(reduced.offsetX)).toBeLessThan(Math.abs(full.offsetX))
    expect(reduced.glow).toBeCloseTo(full.glow)
  })
})
