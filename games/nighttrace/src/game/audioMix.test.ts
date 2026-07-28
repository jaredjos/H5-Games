import { describe, expect, it } from 'vitest'
import {
  chooseMusicVariant,
  musicAssetName,
  musicCrossfadeSeconds,
  musicRouteForLevel,
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
  it('routes haunted sectors, mechanical sectors, and every boss deterministically', () => {
    const routes = Array.from({ length: 10 }, (_, index) =>
      musicRouteForLevel(index + 1),
    )

    expect(
      routes
        .map((route, index) => ({ level: index + 1, ambient: route.ambient }))
        .filter(({ ambient }) => ambient === 'retro')
        .map(({ level }) => level),
    ).toEqual([3, 6, 8])
    expect(
      routes
        .map((route, index) => ({ level: index + 1, ambient: route.ambient }))
        .filter(({ ambient }) => ambient === 'haunted')
        .map(({ level }) => level),
    ).toEqual([1, 2, 4, 5, 7, 9, 10])
    expect(routes.every(({ boss }) => boss === 'phonk')).toBe(true)
    expect(musicRouteForLevel(Number.NaN)).toEqual({
      ambient: 'haunted',
      boss: 'phonk',
    })
    expect(musicRouteForLevel(99)).toEqual({
      ambient: 'haunted',
      boss: 'phonk',
    })
  })

  it('uses on-demand MP3 loops and compact variants only for constrained devices', () => {
    expect(chooseMusicVariant({})).toBe('full')
    expect(chooseMusicVariant({ deviceMemory: 4 })).toBe('full')
    expect(chooseMusicVariant({ saveData: true })).toBe('compact')
    expect(chooseMusicVariant({ deviceMemory: 2 })).toBe('compact')
    expect(musicAssetName('haunted', 'full')).toBe('nighttrace-haunted-loop.mp3')
    expect(musicAssetName('retro', 'compact')).toBe(
      'nighttrace-retro-loop-compact.mp3',
    )
    expect(musicAssetName('phonk', 'compact')).toBe(
      'nighttrace-phonk-loop-compact.mp3',
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
