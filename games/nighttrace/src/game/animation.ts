import type { EnemyId } from '../shared/types'

export type AttackMotionStyle =
  | 'none'
  | 'hero-shot'
  | 'hero-cast'
  | 'hero-pulse'
  | 'melee'
  | 'cast'
  | 'charge'
  | 'blink'
  | 'slam'
  | 'boss-line'
  | 'boss-orbit'
  | 'boss-cross'
  | 'boss-mirror'
  | 'boss-cluster'
  | 'boss-phase'
  | 'boss-intro'

export interface MotionPose {
  offsetX: number
  offsetY: number
  rotation: number
  scaleX: number
  scaleY: number
  pivotX: number
  pivotY: number
  alpha: number
  glow: number
}

interface MotionInput {
  time: number
  moving: number
  attackProgress: number
  attackAngle: number
  attackStyle: AttackMotionStyle
  reducedMotion: boolean
}

export interface HeroMotionInput extends MotionInput {
  hurtProgress: number
}

export interface EnemyMotionInput extends MotionInput {
  id: EnemyId
  uid: number
}

export interface BossMotionInput extends MotionInput {
  bossFrame: number
  levelId: number
  phase: number
}

export type BossAnimationSignature =
  | 'antler-prowl'
  | 'choir-float'
  | 'rail-rush'
  | 'mirror-drift'
  | 'undertow-glide'
  | 'storm-engine'
  | 'clock-stutter'
  | 'furnace-stomp'
  | 'void-cartography'
  | 'eclipse-majesty'

export interface BossAnimationProfile {
  readonly levelId: number
  readonly signature: BossAnimationSignature
  readonly phaseOffset: number
  readonly meleeReach: number
  readonly meleeSide: number
  readonly meleeLift: number
  readonly meleeTwist: number
}

export const BOSS_ANIMATION_PROFILES = Object.freeze([
  Object.freeze({
    levelId: 1,
    signature: 'antler-prowl',
    phaseOffset: 0.19,
    meleeReach: 40,
    meleeSide: 5,
    meleeLift: -2,
    meleeTwist: 0.12,
  }),
  Object.freeze({
    levelId: 2,
    signature: 'choir-float',
    phaseOffset: 0.67,
    meleeReach: 28,
    meleeSide: -10,
    meleeLift: -8,
    meleeTwist: -0.14,
  }),
  Object.freeze({
    levelId: 3,
    signature: 'rail-rush',
    phaseOffset: 1.13,
    meleeReach: 42,
    meleeSide: 2,
    meleeLift: 0,
    meleeTwist: 0.07,
  }),
  Object.freeze({
    levelId: 4,
    signature: 'mirror-drift',
    phaseOffset: 1.59,
    meleeReach: 30,
    meleeSide: 14,
    meleeLift: -3,
    meleeTwist: -0.16,
  }),
  Object.freeze({
    levelId: 5,
    signature: 'undertow-glide',
    phaseOffset: 2.03,
    meleeReach: 32,
    meleeSide: -8,
    meleeLift: 6,
    meleeTwist: 0.11,
  }),
  Object.freeze({
    levelId: 6,
    signature: 'storm-engine',
    phaseOffset: 2.47,
    meleeReach: 36,
    meleeSide: 6,
    meleeLift: -5,
    meleeTwist: -0.18,
  }),
  Object.freeze({
    levelId: 7,
    signature: 'clock-stutter',
    phaseOffset: 2.89,
    meleeReach: 34,
    meleeSide: -12,
    meleeLift: -4,
    meleeTwist: 0.2,
  }),
  Object.freeze({
    levelId: 8,
    signature: 'furnace-stomp',
    phaseOffset: 3.31,
    meleeReach: 39,
    meleeSide: 3,
    meleeLift: 7,
    meleeTwist: 0.08,
  }),
  Object.freeze({
    levelId: 9,
    signature: 'void-cartography',
    phaseOffset: 3.77,
    meleeReach: 31,
    meleeSide: 10,
    meleeLift: -2,
    meleeTwist: -0.1,
  }),
  Object.freeze({
    levelId: 10,
    signature: 'eclipse-majesty',
    phaseOffset: 4.21,
    meleeReach: 38,
    meleeSide: -4,
    meleeLift: -6,
    meleeTwist: 0.15,
  }),
] as const satisfies readonly BossAnimationProfile[])

export function bossAnimationProfile(levelId: number): BossAnimationProfile {
  const normalizedLevel = Math.max(
    1,
    Math.min(10, Math.floor(Number.isFinite(levelId) ? levelId : 1)),
  )
  return BOSS_ANIMATION_PROFILES[normalizedLevel - 1]
}

const TAU = Math.PI * 2
export const HERO_WALK_FRAME_COUNT = 8
export const HERO_WALK_FPS = 12.5
export const HERO_FIRE_FRAME_DURATIONS = [0.07, 0.05, 0.05, 0.03, 0.07, 0.13] as const
export const HERO_FIRE_RELEASE_TIME = 0.17
export const HERO_FIRE_DURATION = 0.4
const HERO_CHARGE_FRAME_ORDER = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1] as const
const HERO_CHARGE_FRAME_DURATIONS = [0.13, 0.12, 0.13, 0.12, 0.13, 0.12, 0.13, 0.12, 0.13, 0.12] as const
const HERO_CHARGE_DURATION = 1.25

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const easeOutCubic = (value: number) => 1 - (1 - clamp01(value)) ** 3
const smoothStep = (value: number) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}
const peak = (progress: number) => Math.sin(clamp01(progress) * Math.PI)

export function heroWalkFrameAt(time: number) {
  const safeTime = Math.max(0, time)
  return Math.floor(safeTime * HERO_WALK_FPS) % HERO_WALK_FRAME_COUNT
}

export function heroFireFrameAt(elapsed: number) {
  let cursor = Math.max(0, elapsed)
  for (let index = 0; index < HERO_FIRE_FRAME_DURATIONS.length; index += 1) {
    const duration = HERO_FIRE_FRAME_DURATIONS[index]
    if (cursor < duration - 1e-9) return index
    cursor -= duration
  }
  return HERO_FIRE_FRAME_DURATIONS.length - 1
}

export function heroChargeFrameAt(time: number) {
  let cursor = ((time % HERO_CHARGE_DURATION) + HERO_CHARGE_DURATION) % HERO_CHARGE_DURATION
  for (let index = 0; index < HERO_CHARGE_FRAME_DURATIONS.length; index += 1) {
    const duration = HERO_CHARGE_FRAME_DURATIONS[index]
    if (cursor < duration - 1e-9) return HERO_CHARGE_FRAME_ORDER[index]
    cursor -= duration
  }
  return HERO_CHARGE_FRAME_ORDER[0]
}

export function heroPulseRecoveryFrameAt(progress: number) {
  return Math.min(5, Math.floor((1 - clamp01(progress)) * 6))
}

const restPose = (): MotionPose => ({
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  pivotX: 0,
  pivotY: 0,
  alpha: 1,
  glow: 0,
})

const addForwardOffset = (
  pose: MotionPose,
  forward: number,
  side: number,
  angle: number,
) => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  pose.offsetX += cos * forward - sin * side
  pose.offsetY += sin * forward + cos * side
}

export function motionProgress(remaining: number, duration: number) {
  if (remaining <= 0 || duration <= 0) return -1
  return clamp01(1 - remaining / duration)
}

export function sampleHeroMotion(input: HeroMotionInput): MotionPose {
  const pose = restPose()
  const amplitude = input.reducedMotion ? 0.34 : 1
  const moving = clamp01(input.moving)
  const stride = Math.sin(input.time * 9.2)
  const idle = Math.sin(input.time * 2.15)

  pose.offsetY += (moving > 0.02 ? -Math.abs(stride) * 2.5 : idle * 0.75) * amplitude
  pose.rotation += stride * 0.018 * moving * amplitude
  pose.scaleX += Math.abs(stride) * 0.022 * moving * amplitude
  pose.scaleY -= Math.abs(stride) * 0.018 * moving * amplitude

  const attack = input.attackProgress
  if (attack >= 0) {
    const hit = peak(attack)
    if (input.attackStyle === 'hero-pulse') {
      pose.offsetY -= hit * 7 * amplitude
      pose.scaleX += hit * 0.09 * amplitude
      pose.scaleY += hit * 0.09 * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.025 * amplitude
      pose.glow = hit
    } else {
      const recoil = attack < 0.24 ? -5 * easeOutCubic(attack / 0.24) : 0
      const release = attack >= 0.2 ? peak((attack - 0.2) / 0.8) * 10 : 0
      addForwardOffset(pose, (recoil + release) * amplitude, 0, input.attackAngle)
      pose.rotation +=
        (Math.cos(input.attackAngle) >= 0 ? -1 : 1) * hit * 0.035 * amplitude
      pose.scaleX += hit * 0.05 * amplitude
      pose.scaleY -= hit * 0.038 * amplitude
      pose.glow = hit * 0.72
    }
  }

  if (input.hurtProgress >= 0) {
    const hurt = peak(input.hurtProgress)
    pose.rotation += Math.sin(input.hurtProgress * Math.PI * 3) * (1 - input.hurtProgress) * 0.055 * amplitude
    pose.scaleX += hurt * 0.035 * amplitude
    pose.scaleY -= hurt * 0.045 * amplitude
    pose.alpha *= 1 - hurt * 0.12
  }

  return pose
}

export function sampleEnemyMotion(input: EnemyMotionInput): MotionPose {
  const pose = restPose()
  const amplitude = input.reducedMotion ? 0.34 : 1
  const moving = clamp01(input.moving)
  const phaseOffset = input.uid * 1.61803398875

  switch (input.id) {
    case 'maskling': {
      const stride = Math.sin(input.time * 9.6 + phaseOffset)
      const contact = Math.abs(stride)
      pose.offsetX += stride * 1.25 * moving * amplitude
      pose.offsetY -= contact * 4.2 * moving * amplitude
      pose.rotation += stride * 0.055 * moving * amplitude
      pose.scaleX += contact * 0.05 * moving * amplitude
      pose.scaleY -= contact * 0.04 * moving * amplitude
      break
    }
    case 'shardwing': {
      const flutter = Math.sin(input.time * 17.2 + phaseOffset)
      const sweep = Math.sin(input.time * 5.4 + phaseOffset * 0.7)
      const flightWeight = 0.58 + moving * 0.42
      pose.offsetX += sweep * 1.8 * moving * amplitude
      pose.offsetY += (-4.5 + flutter * 4.8) * flightWeight * amplitude
      pose.rotation += sweep * 0.14 * flightWeight * amplitude
      pose.scaleX += Math.abs(flutter) * 0.075 * amplitude
      pose.scaleY -= Math.abs(flutter) * 0.035 * amplitude
      break
    }
    case 'cantor': {
      const drift = Math.sin(input.time * 3.1 + phaseOffset)
      const sway = Math.sin(input.time * 2.05 + phaseOffset * 0.8)
      const driftWeight = 0.72 + moving * 0.28
      pose.offsetX += sway * 1.5 * moving * amplitude
      pose.offsetY += drift * 5.5 * driftWeight * amplitude
      pose.rotation += sway * 0.04 * amplitude
      pose.scaleX += drift * 0.022 * amplitude
      pose.scaleY -= drift * 0.016 * amplitude
      break
    }
    case 'railjaw': {
      const tread = Math.sin(input.time * 6.8 + phaseOffset)
      const contact = Math.abs(tread)
      pose.offsetX += tread * 0.65 * moving * amplitude
      pose.offsetY -= contact * 3.3 * moving * amplitude
      pose.rotation += tread * 0.023 * moving * amplitude
      pose.scaleX += contact * 0.035 * moving * amplitude
      pose.scaleY -= contact * 0.025 * moving * amplitude
      break
    }
    case 'chronowisp': {
      const drift = Math.sin(input.time * 4.6 + phaseOffset)
      const orbit = Math.cos(input.time * 3.7 + phaseOffset * 0.9)
      const driftWeight = 0.7 + moving * 0.3
      pose.offsetY += drift * 6 * driftWeight * amplitude
      pose.offsetX += orbit * 2.6 * driftWeight * amplitude
      pose.rotation += drift * 0.055 * amplitude
      pose.scaleX += drift * 0.026 * amplitude
      pose.scaleY -= drift * 0.019 * amplitude
      pose.alpha = 0.9 + (0.5 + drift * 0.5) * 0.1
      break
    }
    case 'cinder-guard': {
      const stomp = Math.sin(input.time * 5.8 + phaseOffset)
      const contact = Math.abs(stomp)
      pose.offsetX += stomp * 0.5 * moving * amplitude
      pose.offsetY -= contact * 2.8 * moving * amplitude
      pose.rotation += stomp * 0.022 * moving * amplitude
      pose.scaleX += contact * 0.035 * moving * amplitude
      pose.scaleY -= contact * 0.027 * moving * amplitude
      break
    }
  }

  const attack = input.attackProgress
  if (attack < 0) return pose
  const hit = peak(attack)
  // Keep the species cadence underneath the action, but quiet it around the
  // key pose so anticipation and release read cleanly in a crowded horde.
  pose.offsetX *= 1 - hit * 0.35
  pose.offsetY *= 1 - hit * 0.25
  pose.rotation *= 1 - hit * 0.3

  switch (input.attackStyle) {
    case 'melee': {
      const windup =
        attack < 0.26
          ? smoothStep(attack / 0.26)
          : 1 - smoothStep((attack - 0.26) / 0.18)
      const strike = attack >= 0.22 ? peak((attack - 0.22) / 0.78) : 0
      addForwardOffset(
        pose,
        (-windup * 8 + strike * 25) * amplitude,
        Math.sin(attack * Math.PI) * 3 * amplitude,
        input.attackAngle,
      )
      pose.rotation +=
        (Math.cos(input.attackAngle) >= 0 ? -1 : 1) *
        (-windup * 0.035 + strike * 0.095) *
        amplitude
      pose.scaleX += (-windup * 0.05 + strike * 0.13) * amplitude
      pose.scaleY += (windup * 0.06 - strike * 0.085) * amplitude
      pose.glow = Math.max(windup * 0.18, strike * 0.62)
      break
    }
    case 'cast': {
      const gather =
        attack < 0.42
          ? smoothStep(attack / 0.42)
          : 1 - smoothStep((attack - 0.42) / 0.58)
      const release = attack >= 0.34 ? peak((attack - 0.34) / 0.66) : 0
      pose.offsetY += (gather * 4 - release * 20) * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.12 * amplitude
      pose.scaleX += (-gather * 0.04 + release * 0.16) * amplitude
      pose.scaleY += (-gather * 0.08 + release * 0.18) * amplitude
      pose.glow = Math.min(1, Math.max(gather * 0.72, release * 1.35))
      break
    }
    case 'charge': {
      const windup =
        attack < 0.38
          ? smoothStep(attack / 0.38)
          : 1 - smoothStep((attack - 0.38) / 0.16)
      const release = attack >= 0.32 ? peak((attack - 0.32) / 0.68) : 0
      addForwardOffset(
        pose,
        (-windup * 14 + release * 34) * amplitude,
        0,
        input.attackAngle,
      )
      pose.scaleX += (-windup * 0.08 + release * 0.18) * amplitude
      pose.scaleY += (windup * 0.1 - release * 0.11) * amplitude
      pose.rotation +=
        (Math.cos(input.attackAngle) >= 0 ? -1 : 1) *
        (-windup * 0.03 + release * 0.07) *
        amplitude
      pose.glow = Math.max(windup * 0.45, release)
      break
    }
    case 'blink': {
      const vanish =
        attack < 0.46
          ? smoothStep(attack / 0.46)
          : 1 - smoothStep((attack - 0.46) / 0.54)
      addForwardOffset(
        pose,
        0,
        Math.sin(attack * TAU) * 5 * amplitude,
        input.attackAngle,
      )
      pose.alpha *= 1 - vanish * 0.82
      pose.scaleX *= 1 - vanish * 0.48
      pose.scaleY *= 1 + vanish * 0.26
      pose.rotation += Math.sin(attack * Math.PI) * 0.18 * amplitude
      pose.glow = hit
      break
    }
    case 'slam': {
      const rise =
        attack < 0.52
          ? smoothStep(attack / 0.52)
          : 1 - smoothStep((attack - 0.52) / 0.48)
      const impact = attack >= 0.5 ? peak((attack - 0.5) / 0.5) : 0
      pose.offsetY += (-rise * 17 + impact * 16) * amplitude
      pose.scaleX += (-rise * 0.04 + impact * 0.18) * amplitude
      pose.scaleY += (rise * 0.08 - impact * 0.14) * amplitude
      pose.rotation += Math.sin(attack * Math.PI) * 0.035 * amplitude
      pose.glow = Math.max(rise * 0.62, impact)
      break
    }
    default:
      break
  }

  return pose
}

const applyBossIdleAndLocomotion = (
  pose: MotionPose,
  input: BossMotionInput,
  profile: BossAnimationProfile,
  amplitude: number,
) => {
  const moving = clamp01(input.moving)
  const time = input.time + profile.phaseOffset

  switch (profile.signature) {
    case 'antler-prowl': {
      const breath = Math.sin(time * 2.1)
      const stride = Math.sin(time * 5.2)
      const contact = Math.abs(stride)
      pose.offsetX += (Math.sin(time * 1.25) * 0.65 + stride * 1.1 * moving) * amplitude
      pose.offsetY += (breath * 1.35 - contact * 4.8 * moving) * amplitude
      pose.rotation += (breath * 0.012 + stride * 0.032 * moving) * amplitude
      pose.scaleX += (breath * 0.012 + contact * 0.032 * moving) * amplitude
      pose.scaleY += (-breath * 0.009 - contact * 0.024 * moving) * amplitude
      pose.pivotY += (-breath * 0.003 + contact * 0.006 * moving) * amplitude
      break
    }
    case 'choir-float': {
      const hover = Math.sin(time * 2.35)
      const sweep = Math.cos(time * 1.3)
      const travel = Math.sin(time * 4.1)
      pose.offsetX += (sweep * 1.25 + travel * 2.2 * moving) * amplitude
      pose.offsetY += (hover * 4.8 - Math.abs(travel) * 1.6 * moving) * amplitude
      pose.rotation += (sweep * 0.026 + travel * 0.04 * moving) * amplitude
      pose.scaleX += (hover * 0.018 + Math.abs(travel) * 0.022 * moving) * amplitude
      pose.scaleY -= (hover * 0.014 + Math.abs(travel) * 0.015 * moving) * amplitude
      pose.pivotX += sweep * 0.004 * amplitude
      pose.pivotY += hover * 0.006 * amplitude
      break
    }
    case 'rail-rush': {
      const engine = Math.sin(time * 2.75)
      const tread = Math.sin(time * 4.65)
      const contact = Math.abs(tread)
      pose.offsetX += (Math.cos(time * 1.55) * 0.48 + tread * 0.78 * moving) * amplitude
      pose.offsetY += (engine * 1.15 - contact * 4.25 * moving) * amplitude
      pose.rotation += (engine * 0.01 + tread * 0.023 * moving) * amplitude
      pose.scaleX += (engine * 0.014 + contact * 0.038 * moving) * amplitude
      pose.scaleY -= (engine * 0.01 + contact * 0.027 * moving) * amplitude
      pose.pivotY += (-engine * 0.003 + contact * 0.008 * moving) * amplitude
      break
    }
    case 'mirror-drift': {
      const drift = Math.sin(time * 1.8)
      const shimmer = Math.cos(time * 2.45)
      const travel = Math.sin(time * 3.55)
      pose.offsetX += (drift * 2.1 + travel * 2.4 * moving) * amplitude
      pose.offsetY += (shimmer * 3.75 - Math.abs(travel) * 1.4 * moving) * amplitude
      pose.rotation += (drift * 0.033 - travel * 0.055 * moving) * amplitude
      pose.scaleX += (shimmer * 0.021 + Math.abs(travel) * 0.03 * moving) * amplitude
      pose.scaleY -= (shimmer * 0.016 + Math.abs(travel) * 0.018 * moving) * amplitude
      pose.pivotX += drift * 0.006 * amplitude
      pose.pivotY += shimmer * 0.004 * amplitude
      pose.alpha *= 0.95 + (0.5 + shimmer * 0.5) * 0.05
      break
    }
    case 'undertow-glide': {
      const tide = Math.sin(time * 1.7)
      const eddy = Math.cos(time * 1.08)
      const surge = Math.sin(time * 3.25)
      pose.offsetX += (eddy * 1.45 + surge * 2.65 * moving) * amplitude
      pose.offsetY += (tide * 5.15 + surge * 1.25 * moving) * amplitude
      pose.rotation += (tide * 0.026 + surge * 0.048 * moving) * amplitude
      pose.scaleX += (tide * 0.016 + Math.abs(surge) * 0.025 * moving) * amplitude
      pose.scaleY -= (tide * 0.012 + Math.abs(surge) * 0.017 * moving) * amplitude
      pose.pivotX += eddy * 0.004 * amplitude
      pose.pivotY += tide * 0.007 * amplitude
      break
    }
    case 'storm-engine': {
      const engine = Math.sin(time * 3.9)
      const spark = Math.sin(time * 10.8) * 0.28
      const thrust = Math.cos(time * 2.62)
      pose.offsetX += (engine * 0.72 + spark * 0.7 + thrust * 1.55 * moving) * amplitude
      pose.offsetY += (engine * 3.6 + spark * 1.2 - Math.abs(thrust) * 1.1 * moving) * amplitude
      pose.rotation += (engine * 0.048 + spark * 0.04 + thrust * 0.035 * moving) * amplitude
      pose.scaleX += (engine * 0.019 + spark * 0.012 + Math.abs(thrust) * 0.022 * moving) * amplitude
      pose.scaleY += (engine * 0.019 - spark * 0.008 - Math.abs(thrust) * 0.015 * moving) * amplitude
      pose.pivotX += spark * 0.006 * amplitude
      pose.pivotY += engine * 0.005 * amplitude
      break
    }
    case 'clock-stutter': {
      const tickBase = Math.sin(time * 5.7)
      const tick = tickBase * Math.abs(tickBase)
      const orbit = Math.cos(time * 1.92)
      const travel = Math.sin(time * 3.85)
      pose.offsetX += (orbit * 1.3 + travel * 1.9 * moving) * amplitude
      pose.offsetY += (tick * 3.45 - Math.abs(travel) * 1.6 * moving) * amplitude
      pose.rotation += (tick * 0.052 + travel * 0.045 * moving) * amplitude
      pose.scaleX += (tick * 0.018 + Math.abs(travel) * 0.024 * moving) * amplitude
      pose.scaleY -= (tick * 0.014 + Math.abs(travel) * 0.016 * moving) * amplitude
      pose.pivotX += tick * 0.005 * amplitude
      pose.pivotY -= tick * 0.006 * amplitude
      break
    }
    case 'furnace-stomp': {
      const breath = Math.sin(time * 2.02)
      const stomp = Math.sin(time * 4.35)
      const contact = Math.abs(stomp)
      pose.offsetX += (Math.cos(time * 1.18) * 0.55 + stomp * 0.62 * moving) * amplitude
      pose.offsetY += (breath * 1.55 - contact * 4.4 * moving) * amplitude
      pose.rotation += (breath * 0.012 + stomp * 0.021 * moving) * amplitude
      pose.scaleX += (breath * 0.023 + contact * 0.041 * moving) * amplitude
      pose.scaleY -= (breath * 0.016 + contact * 0.029 * moving) * amplitude
      pose.pivotY += (-breath * 0.004 + contact * 0.009 * moving) * amplitude
      break
    }
    case 'void-cartography': {
      const longitude = Math.cos(time * 1.35)
      const latitude = Math.sin(time * 1.82)
      const travel = Math.sin(time * 3.18)
      pose.offsetX += (longitude * 2.25 + travel * 2.15 * moving) * amplitude
      pose.offsetY += (latitude * 3.2 - Math.abs(travel) * 1.25 * moving) * amplitude
      pose.rotation += (Math.sin(time * 0.92) * 0.023 + travel * 0.038 * moving) * amplitude
      pose.scaleX += (longitude * 0.017 + Math.abs(travel) * 0.024 * moving) * amplitude
      pose.scaleY += (latitude * 0.013 - Math.abs(travel) * 0.016 * moving) * amplitude
      pose.pivotX += longitude * 0.006 * amplitude
      pose.pivotY += latitude * 0.004 * amplitude
      break
    }
    case 'eclipse-majesty': {
      const corona = Math.sin(time * 1.42)
      const orbit = Math.cos(time * 1.02)
      const glide = Math.sin(time * 2.72)
      pose.offsetX += (orbit * 1.25 + glide * 2.3 * moving) * amplitude
      pose.offsetY += (corona * 4.45 - Math.abs(glide) * 1.3 * moving) * amplitude
      pose.rotation += (corona * 0.019 + glide * 0.031 * moving) * amplitude
      pose.scaleX += (corona * 0.028 + Math.abs(glide) * 0.022 * moving) * amplitude
      pose.scaleY += (corona * 0.028 - Math.abs(glide) * 0.014 * moving) * amplitude
      pose.pivotX += orbit * 0.003 * amplitude
      pose.pivotY += corona * 0.006 * amplitude
      pose.alpha *= 0.965 + (0.5 + corona * 0.5) * 0.035
      break
    }
  }
}

const applyBossSpecialChoreography = (
  pose: MotionPose,
  profile: BossAnimationProfile,
  attack: number,
  angle: number,
  amplitude: number,
) => {
  const gather = smoothStep(Math.min(1, attack / 0.44))
  const release = attack >= 0.3 ? peak((attack - 0.3) / 0.7) : 0
  const energy = peak(attack)

  switch (profile.signature) {
    case 'antler-prowl':
      addForwardOffset(pose, (-gather * 3 + release * 9) * amplitude, Math.sin(attack * Math.PI) * 2 * amplitude, angle)
      pose.rotation += Math.sin(attack * Math.PI) * 0.035 * amplitude
      pose.scaleY -= release * 0.025 * amplitude
      pose.pivotY += (gather * 0.012 - release * 0.016) * amplitude
      break
    case 'choir-float':
      pose.offsetY -= energy * 7 * amplitude
      addForwardOffset(pose, 0, Math.sin(attack * TAU) * 6 * amplitude, angle)
      pose.rotation += Math.sin(attack * TAU) * 0.07 * amplitude
      pose.scaleY += energy * 0.035 * amplitude
      pose.pivotX += Math.sin(attack * TAU) * 0.012 * amplitude
      break
    case 'rail-rush':
      addForwardOffset(pose, (-gather * 5 + release * 9) * amplitude, 0, angle)
      pose.scaleX += release * 0.055 * amplitude
      pose.scaleY -= release * 0.035 * amplitude
      pose.pivotY += (gather * 0.016 - release * 0.012) * amplitude
      break
    case 'mirror-drift':
      addForwardOffset(pose, 0, Math.sin(attack * Math.PI) * 11 * amplitude, angle)
      pose.rotation -= Math.sin(attack * TAU) * 0.065 * amplitude
      pose.pivotX += Math.sin(attack * Math.PI) * 0.018 * amplitude
      pose.alpha *= 0.88 + Math.abs(Math.sin(attack * Math.PI * 4)) * 0.12
      break
    case 'undertow-glide':
      pose.offsetY += (gather * 4 - release * 8) * amplitude
      addForwardOffset(pose, 0, Math.sin(attack * TAU) * 4 * amplitude, angle)
      pose.scaleX += energy * 0.035 * amplitude
      pose.scaleY -= energy * 0.025 * amplitude
      pose.pivotY += (gather * 0.014 - release * 0.012) * amplitude
      break
    case 'storm-engine': {
      const surge = Math.sin(attack * Math.PI * 8) * energy
      addForwardOffset(pose, release * 4 * amplitude, surge * 3 * amplitude, angle)
      pose.rotation += surge * 0.075 * amplitude
      pose.scaleX += Math.abs(surge) * 0.025 * amplitude
      pose.pivotX += surge * 0.014 * amplitude
      break
    }
    case 'clock-stutter': {
      const tick = Math.sin(attack * Math.PI * 10)
      const stutter = tick * Math.abs(tick) * energy
      addForwardOffset(pose, stutter * 4 * amplitude, -stutter * 5 * amplitude, angle)
      pose.rotation += stutter * 0.09 * amplitude
      pose.pivotX -= stutter * 0.016 * amplitude
      pose.alpha *= 0.9 + Math.abs(tick) * 0.1
      break
    }
    case 'furnace-stomp':
      pose.offsetY += (-gather * 6 + release * 9) * amplitude
      pose.scaleX += release * 0.055 * amplitude
      pose.scaleY -= release * 0.045 * amplitude
      pose.pivotY += (gather * 0.018 - release * 0.02) * amplitude
      break
    case 'void-cartography':
      addForwardOffset(pose, 0, Math.sin(attack * Math.PI) * 8 * amplitude, angle)
      pose.rotation -= Math.sin(attack * TAU) * 0.05 * amplitude
      pose.scaleX += energy * 0.045 * amplitude
      pose.scaleY += gather * 0.028 * amplitude
      pose.pivotX += Math.sin(attack * Math.PI) * 0.014 * amplitude
      break
    case 'eclipse-majesty':
      pose.offsetY -= energy * 8 * amplitude
      pose.scaleX += energy * 0.055 * amplitude
      pose.scaleY += energy * 0.055 * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.03 * amplitude
      pose.pivotY -= energy * 0.018 * amplitude
      pose.alpha *= 0.94 + energy * 0.06
      break
  }
}

export function sampleBossMotion(input: BossMotionInput): MotionPose {
  const pose = restPose()
  const amplitude = input.reducedMotion ? 0.34 : 1
  const profile = bossAnimationProfile(input.levelId)
  applyBossIdleAndLocomotion(pose, input, profile, amplitude)

  const attack = input.attackProgress
  const phaseWeight = 1 + (Math.max(1, input.phase) - 1) * 0.08
  if (attack < 0) {
    pose.scaleX *= phaseWeight
    pose.scaleY *= phaseWeight
    return pose
  }
  const hit = peak(attack)
  pose.offsetX *= 1 - hit * 0.28
  pose.offsetY *= 1 - hit * 0.24
  pose.rotation *= 1 - hit * 0.25

  let signatureSpecial = false
  switch (input.attackStyle) {
    case 'melee': {
      const windup =
        attack < 0.28
          ? smoothStep(attack / 0.28)
          : 1 - smoothStep((attack - 0.28) / 0.18)
      const release = attack >= 0.22 ? peak((attack - 0.22) / 0.78) : 0
      const impact = attack >= 0.52 ? 1 - smoothStep((attack - 0.52) / 0.48) : 0
      addForwardOffset(
        pose,
        (-windup * profile.meleeReach * 0.34 +
          release * profile.meleeReach +
          impact * profile.meleeReach * 0.16) *
          amplitude,
        profile.meleeSide * (windup * -0.32 + release) * amplitude,
        input.attackAngle,
      )
      pose.offsetY += profile.meleeLift * hit * amplitude
      pose.rotation +=
        profile.meleeTwist * (-windup * 0.48 + release + impact * 0.2) * amplitude
      pose.scaleX += (-windup * 0.065 + release * 0.17 + impact * 0.04) * amplitude
      pose.scaleY += (windup * 0.085 - release * 0.105 - impact * 0.03) * amplitude
      pose.pivotX +=
        Math.sign(profile.meleeSide || 1) * (-windup * 0.01 + release * 0.016) * amplitude
      pose.pivotY += (windup * 0.018 - release * 0.015 - impact * 0.006) * amplitude
      pose.glow = Math.max(windup * 0.36, release, impact * 0.72)
      break
    }
    case 'boss-line': {
      signatureSpecial = true
      const windup =
        attack < 0.4
          ? smoothStep(attack / 0.4)
          : 1 - smoothStep((attack - 0.4) / 0.16)
      const release = attack >= 0.34 ? peak((attack - 0.34) / 0.66) : 0
      addForwardOffset(
        pose,
        (-windup * 18 + release * 38) * amplitude,
        0,
        input.attackAngle,
      )
      pose.scaleX += (-windup * 0.07 + release * 0.16) * amplitude
      pose.scaleY += (windup * 0.1 - release * 0.11) * amplitude
      pose.rotation +=
        (Math.cos(input.attackAngle) >= 0 ? -1 : 1) *
        (-windup * 0.035 + release * 0.075) *
        amplitude
      pose.glow = Math.max(windup * 0.5, release)
      break
    }
    case 'boss-orbit': {
      signatureSpecial = true
      const gather = smoothStep(Math.min(1, attack / 0.46))
      pose.offsetY -= hit * 18 * amplitude
      addForwardOffset(
        pose,
        0,
        Math.sin(attack * TAU) * 5 * amplitude,
        input.attackAngle,
      )
      pose.rotation += Math.sin(attack * TAU) * 0.16 * amplitude
      pose.scaleX += hit * 0.11 * amplitude
      pose.scaleY += hit * 0.11 * amplitude
      pose.glow = Math.max(gather * 0.58, hit)
      break
    }
    case 'boss-cross': {
      signatureSpecial = true
      const brace =
        attack < 0.36
          ? smoothStep(attack / 0.36)
          : 1 - smoothStep((attack - 0.36) / 0.2)
      pose.offsetY += (brace * 6 - hit * 10) * amplitude
      pose.scaleX += (-brace * 0.08 + hit * 0.2) * amplitude
      pose.scaleY += (-brace * 0.06 + hit * 0.2) * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.085 * amplitude
      pose.glow = Math.max(brace * 0.48, hit)
      break
    }
    case 'boss-mirror': {
      signatureSpecial = true
      const split = Math.sin(attack * Math.PI)
      addForwardOffset(pose, 0, split * 16 * amplitude, input.attackAngle)
      pose.scaleX += hit * 0.19 * amplitude
      pose.scaleY -= hit * 0.07 * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.075 * amplitude
      pose.alpha *= 0.78 + Math.abs(Math.sin(attack * Math.PI * 5)) * 0.22
      pose.glow = Math.max(hit * 0.94, split * 0.52)
      break
    }
    case 'boss-cluster': {
      signatureSpecial = true
      const rise =
        attack < 0.58
          ? smoothStep(attack / 0.58)
          : 1 - smoothStep((attack - 0.58) / 0.42)
      const impact = attack >= 0.54 ? peak((attack - 0.54) / 0.46) : 0
      pose.offsetY += (-rise * 28 + impact * 23) * amplitude
      pose.scaleX += (-rise * 0.05 + impact * 0.22) * amplitude
      pose.scaleY += (rise * 0.09 - impact * 0.16) * amplitude
      pose.rotation += Math.sin(attack * Math.PI) * 0.04 * amplitude
      pose.glow = Math.max(rise * 0.62, impact)
      break
    }
    case 'boss-phase':
      pose.offsetY -= hit * 8 * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.12 * amplitude
      pose.scaleX += hit * 0.22 * amplitude
      pose.scaleY += hit * 0.22 * amplitude
      pose.alpha *= 0.86 + Math.abs(Math.sin(attack * Math.PI * 6)) * 0.14
      pose.glow = 0.58 + hit * 0.42
      break
    case 'boss-intro': {
      const settle = easeOutCubic(Math.min(1, attack / 0.72))
      pose.offsetY -= (1 - settle) * 42 * amplitude
      pose.scaleX *= 0.68 + settle * 0.32
      pose.scaleY *= 0.68 + settle * 0.32
      pose.alpha *= 0.14 + settle * 0.86
      pose.glow = Math.sin(Math.min(1, attack / 0.72) * Math.PI) * 0.92
      break
    }
    default:
      break
  }

  if (signatureSpecial) {
    applyBossSpecialChoreography(
      pose,
      profile,
      attack,
      input.attackAngle,
      amplitude,
    )
  }

  pose.scaleX *= phaseWeight
  pose.scaleY *= phaseWeight
  return pose
}
