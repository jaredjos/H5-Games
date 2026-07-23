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
} from './animation'

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
    expect(reduced.glow).toBeGreaterThan(0)
  })
})
