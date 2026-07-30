import type { OwnedModule, OwnedWeapon, WeaponId } from '../shared/types'
import { WEAPONS } from './content'

export type WeaponShowcaseState =
  | 'solo'
  | 'combined'
  | 'mastered'
  | 'final'
  | 'rank-i'
  | 'rank-ii'
  | 'rank-iii'
  | 'rank-iv'
  | 'rank-v'
  | 'awakened'

export interface WeaponShowcaseConfig {
  weaponId: WeaponId
  state: WeaponShowcaseState
}

const LOCAL_SHOWCASE_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const SHOWCASE_STATES = new Set<WeaponShowcaseState>([
  'solo',
  'combined',
  'mastered',
  'final',
  'rank-i',
  'rank-ii',
  'rank-iii',
  'rank-iv',
  'rank-v',
  'awakened',
])

const RANK_SHOWCASE_STATES = Object.freeze({
  'rank-i': 1,
  'rank-ii': 2,
  'rank-iii': 3,
  'rank-iv': 4,
  'rank-v': 5,
} as const satisfies Readonly<
  Record<
    Extract<WeaponShowcaseState, `rank-${string}`>,
    1 | 2 | 3 | 4 | 5
  >
>)

const SHOWCASE_CAPTURE_SECONDS: Readonly<Record<WeaponId, number>> = Object.freeze({
  'helio-lance': 0.96,
  'crescent-array': 1.02,
  'arc-choir': 0.96,
  'rift-seeds': 1.04,
  'comet-swarm': 0.94,
  'ash-halo': 1.06,
  'mirror-bow': 0.99,
  'null-bell': 1.05,
})

export function showcaseCaptureSeconds(weaponId: WeaponId) {
  return SHOWCASE_CAPTURE_SECONDS[weaponId]
}

export function parseLocalWeaponShowcase(
  hostname: string,
  search: string,
): WeaponShowcaseConfig | undefined {
  if (!LOCAL_SHOWCASE_HOSTS.has(hostname)) return undefined

  const params = new URLSearchParams(search)
  if (params.get('showcase') !== 'weapon') return undefined

  const weaponId = params.get('weapon')
  const state = params.get('state')
  if (!weaponId || !(weaponId in WEAPONS) || !state || !SHOWCASE_STATES.has(state as WeaponShowcaseState)) {
    return undefined
  }

  return {
    weaponId: weaponId as WeaponId,
    state: state as WeaponShowcaseState,
  }
}

export function currentLocalWeaponShowcase() {
  if (typeof window === 'undefined') return undefined
  return parseLocalWeaponShowcase(window.location.hostname, window.location.search)
}

export function showcaseLoadout(config: WeaponShowcaseConfig): {
  weapons: OwnedWeapon[]
  modules: OwnedModule[]
} {
  if (config.state in RANK_SHOWCASE_STATES) {
    const rank =
      RANK_SHOWCASE_STATES[
        config.state as keyof typeof RANK_SHOWCASE_STATES
      ]
    return {
      weapons: [{ id: config.weaponId, rank }],
      modules: [],
    }
  }
  if (config.state === 'awakened') {
    return {
      weapons: [{
        id: config.weaponId,
        rank: 5,
        awakened: true,
      }],
      modules: [{
        id: WEAPONS[config.weaponId].moduleId,
        rank: 1,
      }],
    }
  }
  const hasModule = config.state === 'combined' || config.state === 'final'
  const mastered = config.state === 'mastered' || config.state === 'final'
  return {
    weapons: [{
      id: config.weaponId,
      rank: mastered ? 5 : 1,
      awakened: config.state === 'final' || undefined,
    }],
    modules: hasModule
      ? [{
          id: WEAPONS[config.weaponId].moduleId,
          rank: config.state === 'final' ? 3 : 1,
        }]
      : [],
  }
}

export function showcaseLabel(config: WeaponShowcaseConfig) {
  const definition = WEAPONS[config.weaponId]
  if (config.state in RANK_SHOWCASE_STATES) {
    const rank =
      RANK_SHOWCASE_STATES[
        config.state as keyof typeof RANK_SHOWCASE_STATES
      ]
    return `${definition.name} · SPELL RANK ${['I', 'II', 'III', 'IV', 'V'][rank - 1]}`
  }
  if (config.state === 'awakened') {
    return `${definition.awakening.toUpperCase()} · AWAKENED SPELL RANK V`
  }
  if (config.state === 'solo') return `${definition.name} · SOLO · SPELL RANK I`
  if (config.state === 'combined') {
    return `${definition.name} + ${definition.moduleId.replaceAll('-', ' ').toUpperCase()} · COMBINED SPELL RANK I`
  }
  if (config.state === 'mastered') return `${definition.name} · MASTERED · SPELL RANK V`
  return `${definition.awakening.toUpperCase()} · FINAL AWAKENED SPELL RANK V / MODULE RANK III`
}
