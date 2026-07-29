export type MusicScene = 'ambient' | 'boss' | 'ended'
export type MusicVariant = 'full' | 'compact'
export type MusicTrackId = 'haunted' | 'retro' | 'boss'
export type WeaponAudioCue = 'standard' | 'graveglass' | 'harrow'

export interface MusicAvailability {
  ambient: boolean
  boss: boolean
}

export interface MusicLevels {
  ambient: number
  boss: number
  drone: number
}

export interface MusicDeviceHints {
  saveData?: boolean
  deviceMemory?: number
}

export interface MusicRoute {
  ambient: Exclude<MusicTrackId, 'boss'>
  boss: Extract<MusicTrackId, 'boss'>
}

const AMBIENT_TRACK_LEVEL = 0.82
const BOSS_TRACK_LEVEL = 0.96
const TRACKED_DRONE_LEVEL = 0.055
const FALLBACK_DRONE_LEVEL = 0.35
const RETRO_LEVELS = new Set([3, 6, 8])

export function resolveMusicLevels(
  scene: MusicScene,
  availability: MusicAvailability,
  bossPhase = 1,
): MusicLevels {
  if (scene === 'ended') return { ambient: 0, boss: 0, drone: 0 }

  if (scene === 'boss') {
    const safePhase = Math.max(1, Math.min(3, Math.floor(bossPhase)))
    if (availability.boss) {
      return {
        ambient: 0,
        boss: Math.min(BOSS_TRACK_LEVEL, 0.9 + safePhase * 0.02),
        drone: TRACKED_DRONE_LEVEL * 0.72,
      }
    }
    return {
      ambient: availability.ambient ? 0.42 : 0,
      boss: 0,
      drone: availability.ambient ? 0.2 : FALLBACK_DRONE_LEVEL,
    }
  }

  return {
    ambient: availability.ambient ? AMBIENT_TRACK_LEVEL : 0,
    boss: 0,
    drone: availability.ambient ? TRACKED_DRONE_LEVEL : FALLBACK_DRONE_LEVEL,
  }
}

export function musicCrossfadeSeconds(from: MusicScene, to: MusicScene) {
  if (to === 'ended') return 0.48
  if (from === to) return 0.18
  return to === 'boss' ? 1.45 : 1.1
}

export function chooseMusicVariant({
  saveData = false,
  deviceMemory,
}: MusicDeviceHints): MusicVariant {
  return saveData || (deviceMemory !== undefined && deviceMemory <= 2) ? 'compact' : 'full'
}

export function musicRouteForLevel(levelId: number): MusicRoute {
  const safeLevel = Number.isFinite(levelId)
    ? Math.max(1, Math.min(10, Math.floor(levelId)))
    : 1
  return {
    ambient: RETRO_LEVELS.has(safeLevel) ? 'retro' : 'haunted',
    boss: 'boss',
  }
}

export function musicAssetName(
  trackId: MusicTrackId,
  variant: MusicVariant,
) {
  const compactSuffix = variant === 'compact' ? '-compact' : ''
  return `nighttrace-${trackId}-loop${compactSuffix}.mp3`
}

export function weaponAudioCue(weaponId: string): WeaponAudioCue {
  if (weaponId === 'ash-halo') return 'graveglass'
  if (weaponId === 'null-bell') return 'harrow'
  return 'standard'
}
