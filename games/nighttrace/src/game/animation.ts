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
      const stride = Math.sin(input.time * 8.4 + phaseOffset)
      pose.offsetY -= Math.abs(stride) * 2.7 * moving * amplitude
      pose.rotation += stride * 0.034 * moving * amplitude
      pose.scaleX += Math.abs(stride) * 0.035 * moving * amplitude
      pose.scaleY -= Math.abs(stride) * 0.026 * moving * amplitude
      break
    }
    case 'shardwing': {
      const flutter = Math.sin(input.time * 15.8 + phaseOffset)
      const sweep = Math.sin(input.time * 5.1 + phaseOffset * 0.7)
      pose.offsetY += (-3.5 + flutter * 3.8) * amplitude
      pose.rotation += sweep * 0.105 * amplitude
      pose.scaleX += Math.abs(flutter) * 0.05 * amplitude
      pose.scaleY -= Math.abs(flutter) * 0.025 * amplitude
      break
    }
    case 'cantor': {
      const drift = Math.sin(input.time * 2.9 + phaseOffset)
      pose.offsetY += drift * 4.1 * amplitude
      pose.rotation += Math.sin(input.time * 1.8 + phaseOffset) * 0.025 * amplitude
      pose.scaleX += drift * 0.012 * amplitude
      pose.scaleY -= drift * 0.008 * amplitude
      break
    }
    case 'railjaw': {
      const tread = Math.sin(input.time * 6.2 + phaseOffset)
      pose.offsetY -= Math.abs(tread) * 2.1 * moving * amplitude
      pose.rotation += tread * 0.014 * moving * amplitude
      pose.scaleX += Math.abs(tread) * 0.018 * moving * amplitude
      pose.scaleY -= Math.abs(tread) * 0.012 * moving * amplitude
      break
    }
    case 'chronowisp': {
      const drift = Math.sin(input.time * 4.1 + phaseOffset)
      pose.offsetY += drift * 5 * amplitude
      pose.offsetX += Math.cos(input.time * 3.3 + phaseOffset) * 1.6 * amplitude
      pose.rotation += drift * 0.03 * amplitude
      pose.scaleX += drift * 0.018 * amplitude
      pose.scaleY -= drift * 0.012 * amplitude
      pose.alpha = 0.94 + (0.5 + drift * 0.5) * 0.06
      break
    }
    case 'cinder-guard': {
      const stomp = Math.sin(input.time * 5.2 + phaseOffset)
      pose.offsetY -= Math.abs(stomp) * 1.8 * moving * amplitude
      pose.rotation += stomp * 0.012 * moving * amplitude
      pose.scaleX += Math.abs(stomp) * 0.02 * moving * amplitude
      pose.scaleY -= Math.abs(stomp) * 0.015 * moving * amplitude
      break
    }
  }

  const attack = input.attackProgress
  if (attack < 0) return pose
  const hit = peak(attack)

  switch (input.attackStyle) {
    case 'melee':
      addForwardOffset(pose, hit * 19 * amplitude, Math.sin(attack * TAU) * 2 * amplitude, input.attackAngle)
      pose.rotation += (Math.cos(input.attackAngle) >= 0 ? -1 : 1) * hit * 0.055 * amplitude
      pose.scaleX += hit * 0.08 * amplitude
      pose.scaleY -= hit * 0.055 * amplitude
      pose.glow = hit * 0.42
      break
    case 'cast':
      pose.offsetY -= hit * 10 * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.075 * amplitude
      pose.scaleX += hit * 0.1 * amplitude
      pose.scaleY += hit * 0.07 * amplitude
      pose.glow = hit
      break
    case 'charge': {
      const recoil = attack < 0.34 ? -10 * easeOutCubic(attack / 0.34) : 0
      const release = attack >= 0.3 ? peak((attack - 0.3) / 0.7) * 27 : 0
      addForwardOffset(pose, (recoil + release) * amplitude, 0, input.attackAngle)
      pose.scaleX += hit * 0.13 * amplitude
      pose.scaleY -= hit * 0.08 * amplitude
      pose.rotation += (Math.cos(input.attackAngle) >= 0 ? -1 : 1) * hit * 0.045 * amplitude
      pose.glow = hit * 0.85
      break
    }
    case 'blink': {
      const vanish = attack < 0.42 ? smoothStep(attack / 0.42) : 1 - smoothStep((attack - 0.42) / 0.58)
      pose.alpha *= 1 - vanish * 0.72
      pose.scaleX *= 1 - vanish * 0.36
      pose.scaleY *= 1 + vanish * 0.18
      pose.rotation += Math.sin(attack * Math.PI) * 0.12 * amplitude
      pose.glow = hit
      break
    }
    case 'slam': {
      const rise = attack < 0.48 ? smoothStep(attack / 0.48) : 1 - smoothStep((attack - 0.48) / 0.52)
      const impact = attack >= 0.48 ? peak((attack - 0.48) / 0.52) : 0
      pose.offsetY += (-rise * 13 + impact * 12) * amplitude
      pose.scaleX += impact * 0.12 * amplitude
      pose.scaleY -= impact * 0.1 * amplitude
      pose.glow = Math.max(rise * 0.55, impact)
      break
    }
    default:
      break
  }

  return pose
}

export function sampleBossMotion(input: BossMotionInput): MotionPose {
  const pose = restPose()
  const amplitude = input.reducedMotion ? 0.34 : 1
  const frame = ((input.bossFrame % 6) + 6) % 6
  const levelPhase = input.levelId * 0.73

  if (frame === 0 || frame === 2) {
    const stride = Math.sin(input.time * (frame === 0 ? 4.8 : 4.1) + levelPhase)
    pose.offsetY -= Math.abs(stride) * 3.2 * amplitude
    pose.rotation += stride * (frame === 0 ? 0.018 : 0.012) * amplitude
    pose.scaleX += Math.abs(stride) * 0.018 * amplitude
    pose.scaleY -= Math.abs(stride) * 0.012 * amplitude
  } else if (frame === 4) {
    const engine = Math.sin(input.time * 3.6 + levelPhase)
    pose.offsetY += engine * 2.2 * amplitude
    pose.rotation += engine * 0.035 * amplitude
    pose.scaleX += engine * 0.012 * amplitude
    pose.scaleY += engine * 0.012 * amplitude
  } else {
    const hover = Math.sin(input.time * (frame === 5 ? 2.4 : 2.9) + levelPhase)
    pose.offsetY += hover * (frame === 5 ? 3.2 : 4.4) * amplitude
    pose.rotation += Math.sin(input.time * 1.65 + levelPhase) * 0.018 * amplitude
    pose.scaleX += hover * 0.01 * amplitude
    pose.scaleY -= hover * 0.007 * amplitude
  }

  const attack = input.attackProgress
  const phaseWeight = 1 + (Math.max(1, input.phase) - 1) * 0.08
  if (attack < 0) {
    pose.scaleX *= phaseWeight
    pose.scaleY *= phaseWeight
    return pose
  }
  const hit = peak(attack)

  switch (input.attackStyle) {
    case 'boss-line': {
      const recoil = attack < 0.4 ? -14 * easeOutCubic(attack / 0.4) : 0
      const release = attack >= 0.36 ? peak((attack - 0.36) / 0.64) * 31 : 0
      addForwardOffset(pose, (recoil + release) * amplitude, 0, input.attackAngle)
      pose.scaleX += hit * 0.11 * amplitude
      pose.scaleY -= hit * 0.075 * amplitude
      pose.rotation += (Math.cos(input.attackAngle) >= 0 ? -1 : 1) * hit * 0.045 * amplitude
      pose.glow = hit
      break
    }
    case 'boss-orbit':
      pose.offsetY -= hit * 14 * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.12 * amplitude
      pose.scaleX += hit * 0.08 * amplitude
      pose.scaleY += hit * 0.08 * amplitude
      pose.glow = hit
      break
    case 'boss-cross':
      pose.scaleX += hit * 0.15 * amplitude
      pose.scaleY += hit * 0.15 * amplitude
      pose.rotation += Math.sin(attack * TAU) * 0.065 * amplitude
      pose.glow = hit
      break
    case 'boss-mirror':
      addForwardOffset(pose, 0, Math.sin(attack * Math.PI) * 11 * amplitude, input.attackAngle)
      pose.scaleX += hit * 0.14 * amplitude
      pose.scaleY -= hit * 0.04 * amplitude
      pose.alpha *= 0.88 + Math.abs(Math.sin(attack * Math.PI * 5)) * 0.12
      pose.glow = hit * 0.92
      break
    case 'boss-cluster': {
      const rise = attack < 0.56 ? smoothStep(attack / 0.56) : 1 - smoothStep((attack - 0.56) / 0.44)
      const impact = attack >= 0.52 ? peak((attack - 0.52) / 0.48) : 0
      pose.offsetY += (-rise * 21 + impact * 18) * amplitude
      pose.scaleX += impact * 0.16 * amplitude
      pose.scaleY -= impact * 0.11 * amplitude
      pose.glow = Math.max(rise * 0.55, impact)
      break
    }
    case 'boss-phase':
      pose.rotation += Math.sin(attack * TAU) * 0.09 * amplitude
      pose.scaleX += hit * 0.18 * amplitude
      pose.scaleY += hit * 0.18 * amplitude
      pose.alpha *= 0.9 + Math.abs(Math.sin(attack * Math.PI * 6)) * 0.1
      pose.glow = 0.55 + hit * 0.45
      break
    case 'boss-intro': {
      const settle = easeOutCubic(Math.min(1, attack / 0.72))
      pose.offsetY -= (1 - settle) * 36 * amplitude
      pose.scaleX *= 0.72 + settle * 0.28
      pose.scaleY *= 0.72 + settle * 0.28
      pose.alpha *= 0.2 + settle * 0.8
      pose.glow = Math.sin(Math.min(1, attack / 0.72) * Math.PI) * 0.85
      break
    }
    default:
      break
  }

  pose.scaleX *= phaseWeight
  pose.scaleY *= phaseWeight
  return pose
}
