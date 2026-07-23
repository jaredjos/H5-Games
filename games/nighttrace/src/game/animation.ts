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

export function sampleBossMotion(input: BossMotionInput): MotionPose {
  const pose = restPose()
  const amplitude = input.reducedMotion ? 0.34 : 1
  const frame = ((input.bossFrame % 6) + 6) % 6
  const levelPhase = input.levelId * 0.73
  const moving = clamp01(input.moving)

  if (frame === 0 || frame === 2) {
    const stride = Math.sin(input.time * (frame === 0 ? 5.2 : 4.55) + levelPhase)
    const contact = Math.abs(stride)
    pose.offsetX += stride * 1.1 * moving * amplitude
    pose.offsetY -= contact * (frame === 0 ? 4.8 : 4.1) * moving * amplitude
    pose.rotation += stride * (frame === 0 ? 0.032 : 0.024) * moving * amplitude
    pose.scaleX += contact * 0.032 * moving * amplitude
    pose.scaleY -= contact * 0.024 * moving * amplitude
  } else if (frame === 4) {
    const engine = Math.sin(input.time * 3.9 + levelPhase)
    pose.offsetX += Math.cos(input.time * 2.6 + levelPhase) * 1.5 * moving * amplitude
    pose.offsetY += engine * 3.8 * amplitude
    pose.rotation += engine * 0.052 * amplitude
    pose.scaleX += engine * 0.02 * amplitude
    pose.scaleY += engine * 0.02 * amplitude
  } else {
    const hover = Math.sin(input.time * (frame === 5 ? 2.65 : 3.15) + levelPhase)
    const hoverWeight = 0.64 + moving * 0.36
    pose.offsetX +=
      Math.cos(input.time * 2.1 + levelPhase * 0.8) * 1.8 * moving * amplitude
    pose.offsetY += hover * (frame === 5 ? 4.4 : 5.6) * hoverWeight * amplitude
    pose.rotation += Math.sin(input.time * 1.85 + levelPhase) * 0.032 * amplitude
    pose.scaleX += hover * 0.018 * amplitude
    pose.scaleY -= hover * 0.013 * amplitude
  }

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

  switch (input.attackStyle) {
    case 'boss-line': {
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

  pose.scaleX *= phaseWeight
  pose.scaleY *= phaseWeight
  return pose
}
