import type { OwnedModule, OwnedWeapon, WeaponId } from '../shared/types'
import { WEAPONS } from './content'

export type WeaponShowcaseState = 'solo' | 'combined' | 'mastered' | 'final'

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
])

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
  if (config.state === 'solo') return `${definition.name} · SOLO · RANK I`
  if (config.state === 'combined') {
    return `${definition.name} + ${definition.moduleId.replaceAll('-', ' ').toUpperCase()} · COMBINED RANK I`
  }
  if (config.state === 'mastered') return `${definition.name} · MASTERED · RANK V`
  return `${definition.awakening.toUpperCase()} · FINAL AWAKENED V / MODULE III`
}
