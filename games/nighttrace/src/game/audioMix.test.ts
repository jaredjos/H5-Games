import { describe, expect, it } from 'vitest'
import {
  chooseMusicVariant,
  musicAssetName,
  musicCrossfadeSeconds,
  preferredMusicExtension,
  resolveMusicLevels,
  weaponAudioCue,
} from './audioMix'

describe('music mix', () => {
  it('crossfades to a louder boss score while keeping the fallback drone subordinate', () => {
    const ambient = resolveMusicLevels('ambient', { ambient: true, boss: true })
    const boss = resolveMusicLevels('boss', { ambient: true, boss: true }, 3)

    expect(ambient).toEqual({ ambient: 0.82, boss: 0, drone: 0.055 })
    expect(boss.boss).toBe(0.96)
    expect(boss.ambient).toBe(0)
    expect(boss.drone).toBeLessThan(0.05)
    expect(musicCrossfadeSeconds('ambient', 'boss')).toBeGreaterThan(1)
  })

  it('retains procedural music when a streamed track cannot play', () => {
    expect(resolveMusicLevels('ambient', { ambient: false, boss: false })).toEqual({
      ambient: 0,
      boss: 0,
      drone: 0.35,
    })
    expect(resolveMusicLevels('boss', { ambient: false, boss: false }, 2)).toEqual({
      ambient: 0,
      boss: 0,
      drone: 0.35,
    })
    expect(resolveMusicLevels('ended', { ambient: true, boss: true })).toEqual({
      ambient: 0,
      boss: 0,
      drone: 0,
    })
  })
})

describe('music asset selection', () => {
  it('prefers OGG where supported and keeps an M4A fallback', () => {
    expect(preferredMusicExtension('probably')).toBe('ogg')
    expect(preferredMusicExtension('maybe')).toBe('ogg')
    expect(preferredMusicExtension('')).toBe('m4a')
  })

  it('uses compact loops only for explicit data or very-low-memory hints', () => {
    expect(chooseMusicVariant({})).toBe('full')
    expect(chooseMusicVariant({ deviceMemory: 4 })).toBe('full')
    expect(chooseMusicVariant({ saveData: true })).toBe('compact')
    expect(chooseMusicVariant({ deviceMemory: 2 })).toBe('compact')
    expect(musicAssetName('dungeon', 'ogg', 'full')).toBe('nighttrace-dungeon-loop.ogg')
    expect(musicAssetName('sovereign', 'm4a', 'compact')).toBe(
      'nighttrace-sovereign-loop-compact.m4a',
    )
  })
})

describe('weapon audio identity', () => {
  it('maps the legacy ids to their reworked hostile spell identities', () => {
    expect(weaponAudioCue('ash-halo')).toBe('graveglass')
    expect(weaponAudioCue('null-bell')).toBe('harrow')
    expect(weaponAudioCue('helio-lance')).toBe('standard')
  })
})
