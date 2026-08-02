import type { WeaponId } from '../shared/types'

export type HostileSpecialSource = 'boss' | 'elite'
export type HostileSpecialFootprint =
  | 'field'
  | 'lane'
  | 'projectile'
  | 'melee'
  | 'blink'
export type HostileCombatSfxCue =
  | 'boss-field'
  | 'boss-lane'
  | 'boss-projectile'
  | 'boss-melee'
  | 'elite-field'
  | 'elite-lane'
  | 'elite-projectile'
  | 'elite-blink'
export type CombatSfxCueId =
  | WeaponId
  | 'dawnward-aegis'
  | HostileCombatSfxCue

export interface CombatSfxTone {
  readonly delay?: number
  readonly frequency: number
  readonly endFrequency: number
  readonly duration: number
  readonly volume: number
  readonly type: OscillatorType
  readonly filterFrequency: number
}

export interface CombatSfxProfile {
  readonly priority: 1 | 2 | 3 | 4
  readonly cooldownSeconds: number
  readonly tones: readonly CombatSfxTone[]
}

export const COMBAT_SFX_MAX_TONE_VOICES = 18

export const COMBAT_SFX_PROFILES = Object.freeze({
  'helio-lance': {
    priority: 2,
    cooldownSeconds: 0.07,
    tones: [
      { frequency: 1480, endFrequency: 2260, duration: 0.085, volume: 0.027, type: 'triangle', filterFrequency: 6200 },
      { delay: 0.018, frequency: 420, endFrequency: 212, duration: 0.12, volume: 0.014, type: 'sine', filterFrequency: 2600 },
    ],
  },
  'crescent-array': {
    priority: 2,
    cooldownSeconds: 0.09,
    tones: [
      { frequency: 740, endFrequency: 1280, duration: 0.16, volume: 0.022, type: 'sine', filterFrequency: 4700 },
      { delay: 0.03, frequency: 1110, endFrequency: 560, duration: 0.14, volume: 0.014, type: 'triangle', filterFrequency: 5100 },
    ],
  },
  'arc-choir': {
    priority: 2,
    cooldownSeconds: 0.1,
    tones: [
      { frequency: 2320, endFrequency: 510, duration: 0.11, volume: 0.024, type: 'square', filterFrequency: 6900 },
      { delay: 0.036, frequency: 1760, endFrequency: 860, duration: 0.1, volume: 0.018, type: 'sawtooth', filterFrequency: 6100 },
    ],
  },
  'rift-seeds': {
    priority: 3,
    cooldownSeconds: 0.1,
    tones: [
      { frequency: 2680, endFrequency: 340, duration: 0.13, volume: 0.028, type: 'sawtooth', filterFrequency: 7200 },
      { delay: 0.018, frequency: 1640, endFrequency: 118, duration: 0.21, volume: 0.021, type: 'square', filterFrequency: 5200 },
      { delay: 0.062, frequency: 112, endFrequency: 46, duration: 0.3, volume: 0.026, type: 'sine', filterFrequency: 1400 },
    ],
  },
  'comet-swarm': {
    priority: 2,
    cooldownSeconds: 0.08,
    tones: [
      { frequency: 510, endFrequency: 1720, duration: 0.13, volume: 0.023, type: 'sawtooth', filterFrequency: 5400 },
      { delay: 0.055, frequency: 920, endFrequency: 2380, duration: 0.1, volume: 0.012, type: 'triangle', filterFrequency: 6600 },
    ],
  },
  'ash-halo': {
    priority: 2,
    cooldownSeconds: 0.1,
    tones: [
      { frequency: 188, endFrequency: 62, duration: 0.22, volume: 0.03, type: 'square', filterFrequency: 1250 },
      { delay: 0.025, frequency: 1760, endFrequency: 720, duration: 0.13, volume: 0.019, type: 'triangle', filterFrequency: 5200 },
      { delay: 0.068, frequency: 2280, endFrequency: 890, duration: 0.12, volume: 0.014, type: 'triangle', filterFrequency: 5600 },
    ],
  },
  'mirror-bow': {
    priority: 2,
    cooldownSeconds: 0.12,
    tones: [
      { frequency: 138, endFrequency: 46, duration: 0.24, volume: 0.032, type: 'sine', filterFrequency: 920 },
      { delay: 0.032, frequency: 980, endFrequency: 230, duration: 0.18, volume: 0.019, type: 'triangle', filterFrequency: 3100 },
      { delay: 0.09, frequency: 2740, endFrequency: 740, duration: 0.12, volume: 0.012, type: 'triangle', filterFrequency: 6200 },
    ],
  },
  'null-bell': {
    priority: 2,
    cooldownSeconds: 0.12,
    tones: [
      { frequency: 2640, endFrequency: 280, duration: 0.12, volume: 0.032, type: 'sawtooth', filterFrequency: 6400 },
      { delay: 0.024, frequency: 118, endFrequency: 52, duration: 0.17, volume: 0.024, type: 'square', filterFrequency: 1050 },
    ],
  },
  'dawnward-aegis': {
    priority: 2,
    cooldownSeconds: 0.26,
    tones: [
      { frequency: 196, endFrequency: 246.94, duration: 0.22, volume: 0.018, type: 'sine', filterFrequency: 2200 },
      { delay: 0.045, frequency: 392, endFrequency: 523.25, duration: 0.18, volume: 0.011, type: 'triangle', filterFrequency: 3900 },
    ],
  },
  'boss-field': {
    priority: 4,
    cooldownSeconds: 0.16,
    tones: [
      { frequency: 104, endFrequency: 34, duration: 0.4, volume: 0.058, type: 'sawtooth', filterFrequency: 1200 },
      { delay: 0.02, frequency: 620, endFrequency: 146, duration: 0.26, volume: 0.021, type: 'triangle', filterFrequency: 2800 },
    ],
  },
  'boss-lane': {
    priority: 4,
    cooldownSeconds: 0.16,
    tones: [
      { frequency: 1340, endFrequency: 82, duration: 0.24, volume: 0.046, type: 'sawtooth', filterFrequency: 4200 },
      { delay: 0.018, frequency: 86, endFrequency: 38, duration: 0.34, volume: 0.052, type: 'square', filterFrequency: 980 },
    ],
  },
  'boss-projectile': {
    priority: 4,
    cooldownSeconds: 0.16,
    tones: [
      { frequency: 176, endFrequency: 780, duration: 0.22, volume: 0.042, type: 'sawtooth', filterFrequency: 3600 },
      { delay: 0.035, frequency: 71, endFrequency: 36, duration: 0.31, volume: 0.047, type: 'sine', filterFrequency: 840 },
    ],
  },
  'boss-melee': {
    priority: 4,
    cooldownSeconds: 0.2,
    tones: [
      { frequency: 82, endFrequency: 34, duration: 0.26, volume: 0.056, type: 'square', filterFrequency: 920 },
      { delay: 0.016, frequency: 520, endFrequency: 118, duration: 0.18, volume: 0.024, type: 'sawtooth', filterFrequency: 2500 },
    ],
  },
  'elite-field': {
    priority: 3,
    cooldownSeconds: 0.14,
    tones: [
      { frequency: 168, endFrequency: 48, duration: 0.27, volume: 0.036, type: 'triangle', filterFrequency: 1500 },
      { delay: 0.026, frequency: 730, endFrequency: 182, duration: 0.18, volume: 0.014, type: 'sawtooth', filterFrequency: 3100 },
    ],
  },
  'elite-lane': {
    priority: 3,
    cooldownSeconds: 0.14,
    tones: [
      { frequency: 980, endFrequency: 116, duration: 0.18, volume: 0.033, type: 'sawtooth', filterFrequency: 3900 },
      { delay: 0.02, frequency: 112, endFrequency: 46, duration: 0.24, volume: 0.028, type: 'square', filterFrequency: 1100 },
    ],
  },
  'elite-projectile': {
    priority: 3,
    cooldownSeconds: 0.14,
    tones: [
      { frequency: 244, endFrequency: 960, duration: 0.16, volume: 0.03, type: 'triangle', filterFrequency: 3800 },
      { delay: 0.035, frequency: 92, endFrequency: 44, duration: 0.21, volume: 0.024, type: 'sine', filterFrequency: 920 },
    ],
  },
  'elite-blink': {
    priority: 3,
    cooldownSeconds: 0.18,
    tones: [
      { frequency: 1860, endFrequency: 238, duration: 0.16, volume: 0.029, type: 'triangle', filterFrequency: 5400 },
      { delay: 0.022, frequency: 118, endFrequency: 52, duration: 0.2, volume: 0.026, type: 'sine', filterFrequency: 1100 },
    ],
  },
} as const satisfies Readonly<Record<CombatSfxCueId, CombatSfxProfile>>)

export function combatSfxProfile(cueId: CombatSfxCueId): CombatSfxProfile {
  return COMBAT_SFX_PROFILES[cueId]
}

export function hostileSpecialSfxCue(
  source: HostileSpecialSource,
  footprint: HostileSpecialFootprint,
): CombatSfxCueId {
  return `${source}-${footprint}` as HostileCombatSfxCue
}

export function canAdmitCombatTone(
  activePriorities: readonly number[],
  incomingPriority: number,
  cap = COMBAT_SFX_MAX_TONE_VOICES,
) {
  const safeCap = Math.max(1, Math.floor(Number.isFinite(cap) ? cap : 1))
  if (activePriorities.length < safeCap) return true
  return incomingPriority > Math.min(...activePriorities)
}
