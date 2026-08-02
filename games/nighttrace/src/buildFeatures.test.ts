import { describe, expect, it } from 'vitest'
import {
  internalModesEnabledForMode,
  isRunModeAvailable,
  isScreenAvailable,
  releaseSafeScreen,
} from './buildFeatures'

describe('Nighttrace public and internal build features', () => {
  it('fails closed for ordinary production builds', () => {
    expect(internalModesEnabledForMode('production')).toBe(false)
    expect(internalModesEnabledForMode('development')).toBe(true)
    expect(internalModesEnabledForMode('test')).toBe(true)
    expect(internalModesEnabledForMode('internal')).toBe(true)
  })

  it('hides both internal screens from the public channel', () => {
    expect(isScreenAvailable('boss-trials', false)).toBe(false)
    expect(isScreenAvailable('combat-lab', false)).toBe(false)
    expect(isScreenAvailable('campaign', false)).toBe(true)
    expect(isScreenAvailable('codex', false)).toBe(true)
  })

  it('blocks non-campaign run configurations in the public channel', () => {
    expect(isRunModeAvailable('campaign', false)).toBe(true)
    expect(isRunModeAvailable('boss-trial', false)).toBe(false)
    expect(isRunModeAvailable('combat-lab', false)).toBe(false)
  })

  it('keeps both tools intact in the internal channel', () => {
    expect(isScreenAvailable('boss-trials', true)).toBe(true)
    expect(isScreenAvailable('combat-lab', true)).toBe(true)
    expect(isRunModeAvailable('boss-trial', true)).toBe(true)
    expect(isRunModeAvailable('combat-lab', true)).toBe(true)
  })

  it('redirects unavailable screens to Campaign', () => {
    expect(releaseSafeScreen('boss-trials', false)).toBe('campaign')
    expect(releaseSafeScreen('combat-lab', false)).toBe('campaign')
    expect(releaseSafeScreen('settings', false)).toBe('settings')
  })
})
