import type { RunMode, ScreenId } from './shared/types'

export type ReleaseChannel = 'public' | 'internal'

const INTERNAL_BUILD_MODES = new Set(['development', 'test', 'internal'])

export function internalModesEnabledForMode(mode: string) {
  return INTERNAL_BUILD_MODES.has(mode)
}

export const INTERNAL_MODES_ENABLED = internalModesEnabledForMode(import.meta.env.MODE)

export const RELEASE_CHANNEL: ReleaseChannel = INTERNAL_MODES_ENABLED
  ? 'internal'
  : 'public'

export function isScreenAvailable(
  screen: ScreenId,
  internalModes = INTERNAL_MODES_ENABLED,
) {
  return internalModes || (screen !== 'boss-trials' && screen !== 'combat-lab')
}

export function isRunModeAvailable(
  mode: RunMode,
  internalModes = INTERNAL_MODES_ENABLED,
) {
  return internalModes || mode === 'campaign'
}

export function releaseSafeScreen<T extends ScreenId>(
  screen: T,
  internalModes = INTERNAL_MODES_ENABLED,
): T | 'campaign' {
  return isScreenAvailable(screen, internalModes) ? screen : 'campaign'
}
