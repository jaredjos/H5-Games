import type {
  CombatLabConfig,
  LevelDefinition,
  ModuleId,
  OwnedModule,
  OwnedWeapon,
  RunConfig,
  StartingLoadout,
  TraceModId,
  WeaponId,
} from '../shared/types'
import { LEVELS, MODULES, TRACE_MODS, WEAPONS } from './content'

export type CombatLabPresetId = 'solo' | 'combined' | 'mastered' | 'final'

export interface CombatLabPresetDefinition {
  id: CombatLabPresetId
  label: string
  description: string
  weaponRank: number
  moduleRank: number
  awakened: boolean
}

export interface CombatLabArenaOption {
  levelId: number
  name: string
  accent: string
}

export interface CombatLabBossOption {
  levelId: number
  bossId: LevelDefinition['bossId']
  bossName: string
  bossFrame: number
  accent: string
}

export const COMBAT_LAB_PLAYER_LEVEL_MIN = 1
export const COMBAT_LAB_PLAYER_LEVEL_MAX = 50
export const COMBAT_LAB_BOSS_HEALTH_MIN = 0.25
export const COMBAT_LAB_BOSS_HEALTH_MAX = 4

const WEAPON_IDS = new Set(Object.keys(WEAPONS) as WeaponId[])
const MODULE_IDS = new Set(Object.keys(MODULES) as ModuleId[])
const TRACE_MOD_IDS = new Set(Object.keys(TRACE_MODS) as TraceModId[])
const COMBAT_LAB_PRESET_IDS = new Set<CombatLabPresetId>([
  'solo',
  'combined',
  'mastered',
  'final',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return clamp(Math.trunc(finiteNumber(value, fallback)), minimum, maximum)
}

function normalizeLevelId(value: unknown, fallback = 1) {
  return clampInteger(value, fallback, 1, LEVELS.length)
}

function normalizeWeaponId(value: unknown, fallback: WeaponId = 'helio-lance'): WeaponId {
  return typeof value === 'string' && WEAPON_IDS.has(value as WeaponId)
    ? value as WeaponId
    : fallback
}

function normalizePresetId(value: unknown): CombatLabPresetId {
  return typeof value === 'string' && COMBAT_LAB_PRESET_IDS.has(value as CombatLabPresetId)
    ? value as CombatLabPresetId
    : 'solo'
}

function normalizeModules(value: unknown): OwnedModule[] {
  if (!Array.isArray(value)) return []

  const modules = new Map<ModuleId, OwnedModule>()
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string') continue
    if (!MODULE_IDS.has(candidate.id as ModuleId)) continue
    const id = candidate.id as ModuleId
    const rank = clampInteger(candidate.rank, 1, 1, 3)
    const existing = modules.get(id)
    if (existing) existing.rank = Math.max(existing.rank, rank)
    else modules.set(id, { id, rank })
  }
  return [...modules.values()]
}

function normalizeWeapons(value: unknown, modules: readonly OwnedModule[]): OwnedWeapon[] {
  if (!Array.isArray(value)) return []

  const weapons = new Map<
    WeaponId,
    OwnedWeapon & { requestedAwakening: boolean }
  >()
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string') continue
    if (!WEAPON_IDS.has(candidate.id as WeaponId)) continue
    const id = candidate.id as WeaponId
    const rank = clampInteger(candidate.rank, 1, 1, 5)
    const branch =
      candidate.branch === 'swarm' || candidate.branch === 'hunter'
        ? candidate.branch
        : undefined
    const existing = weapons.get(id)
    if (existing) {
      existing.rank = Math.max(existing.rank, rank)
      existing.requestedAwakening ||= candidate.awakened === true
      existing.branch ??= branch
    } else {
      weapons.set(id, {
        id,
        rank,
        branch,
        requestedAwakening: candidate.awakened === true,
      })
    }
  }

  const ownedModules = new Set(modules.map((module) => module.id))
  return [...weapons.values()].map((weapon) => {
    const awakened =
      weapon.requestedAwakening &&
      weapon.rank === 5 &&
      ownedModules.has(WEAPONS[weapon.id].moduleId)
    return {
      id: weapon.id,
      rank: weapon.rank,
      ...(weapon.branch ? { branch: weapon.branch } : {}),
      ...(awakened ? { awakened: true } : {}),
    }
  })
}

function normalizeTraceMods(value: unknown): TraceModId[] {
  if (!Array.isArray(value)) return []

  const traceMods = new Set<TraceModId>()
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !TRACE_MOD_IDS.has(candidate as TraceModId)) continue
    traceMods.add(candidate as TraceModId)
  }
  return [...traceMods]
}

/**
 * Repairs a loadout into a deterministic, playable form. Duplicate weapons and
 * modules retain their highest supplied rank while preserving first-seen order.
 */
export function normalizeStartingLoadout(value: unknown): StartingLoadout {
  const source = isRecord(value) ? value : {}
  const modules = normalizeModules(source.modules)
  const weapons = normalizeWeapons(source.weapons, modules)
  return {
    weapons: weapons.length > 0 ? weapons : [{ id: 'helio-lance', rank: 1 }],
    modules,
    traceMods: normalizeTraceMods(source.traceMods),
  }
}

export const COMBAT_LAB_PRESETS: readonly CombatLabPresetDefinition[] = [
  {
    id: 'solo',
    label: 'Solo',
    description: 'Rank I weapon without its paired module.',
    weaponRank: 1,
    moduleRank: 0,
    awakened: false,
  },
  {
    id: 'combined',
    label: 'Combined',
    description: 'Rank I weapon combined with its paired module.',
    weaponRank: 1,
    moduleRank: 1,
    awakened: false,
  },
  {
    id: 'mastered',
    label: 'Mastered',
    description: 'Rank V weapon before its final awakening.',
    weaponRank: 5,
    moduleRank: 0,
    awakened: false,
  },
  {
    id: 'final',
    label: 'Final',
    description: 'Awakened Rank V weapon with a Rank III paired module.',
    weaponRank: 5,
    moduleRank: 3,
    awakened: true,
  },
]

export function getCombatLabPresetLoadout(
  presetId: CombatLabPresetId | string,
  weaponId: WeaponId | string = 'helio-lance',
): StartingLoadout {
  const preset = COMBAT_LAB_PRESETS.find(
    (candidate) => candidate.id === normalizePresetId(presetId),
  ) ?? COMBAT_LAB_PRESETS[0]
  const id = normalizeWeaponId(weaponId)
  const moduleId = WEAPONS[id].moduleId
  return normalizeStartingLoadout({
    weapons: [{
      id,
      rank: preset.weaponRank,
      awakened: preset.awakened || undefined,
    }],
    modules: preset.moduleRank > 0
      ? [{ id: moduleId, rank: preset.moduleRank }]
      : [],
    traceMods: [],
  })
}

export const DEFAULT_COMBAT_LAB_CONFIG: CombatLabConfig = {
  arenaLevelId: 1,
  bossLevelId: 1,
  encounter: 'boss',
  playerLevel: 1,
  bossHealthMultiplier: 1,
  loadout: getCombatLabPresetLoadout('solo'),
}

export function normalizeCombatLabConfig(value: unknown): CombatLabConfig {
  const source = isRecord(value) ? value : {}
  return {
    arenaLevelId: normalizeLevelId(
      source.arenaLevelId,
      DEFAULT_COMBAT_LAB_CONFIG.arenaLevelId,
    ),
    bossLevelId: normalizeLevelId(
      source.bossLevelId,
      DEFAULT_COMBAT_LAB_CONFIG.bossLevelId,
    ),
    encounter: source.encounter === 'sector' || source.encounter === 'boss'
      ? source.encounter
      : DEFAULT_COMBAT_LAB_CONFIG.encounter,
    playerLevel: clampInteger(
      source.playerLevel,
      DEFAULT_COMBAT_LAB_CONFIG.playerLevel,
      COMBAT_LAB_PLAYER_LEVEL_MIN,
      COMBAT_LAB_PLAYER_LEVEL_MAX,
    ),
    bossHealthMultiplier: clamp(
      finiteNumber(
        source.bossHealthMultiplier,
        DEFAULT_COMBAT_LAB_CONFIG.bossHealthMultiplier,
      ),
      COMBAT_LAB_BOSS_HEALTH_MIN,
      COMBAT_LAB_BOSS_HEALTH_MAX,
    ),
    loadout: normalizeStartingLoadout(
      source.loadout ?? DEFAULT_COMBAT_LAB_CONFIG.loadout,
    ),
  }
}

export const COMBAT_LAB_ARENAS: readonly CombatLabArenaOption[] = LEVELS.map(
  (level) => ({
    levelId: level.id,
    name: level.name,
    accent: level.accent,
  }),
)

export const COMBAT_LAB_BOSSES: readonly CombatLabBossOption[] = LEVELS.map(
  (level) => ({
    levelId: level.id,
    bossId: level.bossId,
    bossName: level.bossName,
    bossFrame: level.bossFrame,
    accent: level.accent,
  }),
)

export function resolveArenaLevel(levelId: unknown): LevelDefinition {
  return LEVELS[normalizeLevelId(levelId) - 1]
}

export function resolveBossLevel(levelId: unknown): LevelDefinition {
  return LEVELS[normalizeLevelId(levelId) - 1]
}

const BOSS_TRIAL_LOADOUT_SOURCE: readonly StartingLoadout[] = [
  {
    weapons: [{ id: 'helio-lance', rank: 2 }],
    modules: [],
    traceMods: [],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 2 },
      { id: 'crescent-array', rank: 1 },
    ],
    modules: [{ id: 'prism-lens', rank: 1 }],
    traceMods: [],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 3 },
      { id: 'crescent-array', rank: 2 },
    ],
    modules: [
      { id: 'prism-lens', rank: 1 },
      { id: 'gyro-crown', rank: 1 },
    ],
    traceMods: [],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 3 },
      { id: 'crescent-array', rank: 3 },
      { id: 'arc-choir', rank: 2 },
    ],
    modules: [
      { id: 'prism-lens', rank: 2 },
      { id: 'gyro-crown', rank: 1 },
      { id: 'resonance-coil', rank: 1 },
    ],
    traceMods: [],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 4 },
      { id: 'crescent-array', rank: 3 },
      { id: 'arc-choir', rank: 3 },
      { id: 'rift-seeds', rank: 2 },
    ],
    modules: [
      { id: 'prism-lens', rank: 2 },
      { id: 'gyro-crown', rank: 2 },
      { id: 'resonance-coil', rank: 1 },
      { id: 'grav-anchor', rank: 1 },
    ],
    traceMods: ['closed-circuit'],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 4 },
      { id: 'crescent-array', rank: 4 },
      { id: 'rift-seeds', rank: 3 },
      { id: 'comet-swarm', rank: 2 },
    ],
    modules: [
      { id: 'prism-lens', rank: 2 },
      { id: 'gyro-crown', rank: 2 },
      { id: 'grav-anchor', rank: 2 },
      { id: 'guidance-filament', rank: 1 },
    ],
    traceMods: ['closed-circuit'],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 5 },
      { id: 'arc-choir', rank: 4 },
      { id: 'comet-swarm', rank: 3 },
      { id: 'ash-halo', rank: 3 },
    ],
    modules: [
      { id: 'prism-lens', rank: 3 },
      { id: 'resonance-coil', rank: 2 },
      { id: 'guidance-filament', rank: 2 },
      { id: 'thermal-mantle', rank: 2 },
    ],
    traceMods: ['closed-circuit', 'nightglass'],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 5 },
      { id: 'rift-seeds', rank: 4 },
      { id: 'comet-swarm', rank: 4 },
      { id: 'ash-halo', rank: 4 },
    ],
    modules: [
      { id: 'prism-lens', rank: 3 },
      { id: 'grav-anchor', rank: 3 },
      { id: 'guidance-filament', rank: 2 },
      { id: 'thermal-mantle', rank: 2 },
    ],
    traceMods: ['closed-circuit', 'nightglass'],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 5 },
      { id: 'comet-swarm', rank: 5 },
      { id: 'mirror-bow', rank: 4 },
      { id: 'null-bell', rank: 3 },
    ],
    modules: [
      { id: 'prism-lens', rank: 3 },
      { id: 'guidance-filament', rank: 3 },
      { id: 'flux-mirror', rank: 2 },
      { id: 'deep-capacitor', rank: 2 },
    ],
    traceMods: ['closed-circuit', 'nightglass', 'red-shift'],
  },
  {
    weapons: [
      { id: 'helio-lance', rank: 5, awakened: true },
      { id: 'comet-swarm', rank: 5 },
      { id: 'mirror-bow', rank: 5, awakened: true },
      { id: 'null-bell', rank: 5 },
    ],
    modules: [
      { id: 'prism-lens', rank: 3 },
      { id: 'guidance-filament', rank: 3 },
      { id: 'flux-mirror', rank: 3 },
      { id: 'deep-capacitor', rank: 3 },
    ],
    traceMods: ['closed-circuit', 'nightglass', 'red-shift'],
  },
]

export const BOSS_TRIAL_PLAYER_LEVELS: readonly number[] = [
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  12,
]

export const BOSS_TRIAL_LOADOUTS: readonly StartingLoadout[] =
  BOSS_TRIAL_LOADOUT_SOURCE.map((loadout) => normalizeStartingLoadout(loadout))

export function getBossTrialLoadout(levelId: unknown): StartingLoadout {
  const level = resolveBossLevel(levelId)
  return normalizeStartingLoadout(BOSS_TRIAL_LOADOUTS[level.id - 1])
}

export function normalizeBossTrialClears(value: unknown) {
  return clampInteger(value, 0, 0, LEVELS.length)
}

export function getBossTrialUnlockedLevel(clears: unknown) {
  return Math.min(LEVELS.length, normalizeBossTrialClears(clears) + 1)
}

export function isBossTrialUnlocked(levelId: unknown, clears: unknown) {
  if (
    typeof levelId !== 'number' ||
    !Number.isInteger(levelId) ||
    levelId < 1 ||
    levelId > LEVELS.length
  ) {
    return false
  }
  return levelId <= getBossTrialUnlockedLevel(clears)
}

/**
 * Only the next unbeaten sovereign advances the ladder. Victories over an
 * already-cleared or out-of-order boss leave progress unchanged.
 */
export function advanceBossTrialProgress(
  clears: unknown,
  defeatedLevelId: unknown,
  victory = true,
) {
  const current = normalizeBossTrialClears(clears)
  if (!victory || current >= LEVELS.length) return current
  const expectedLevelId = current + 1
  return defeatedLevelId === expectedLevelId ? expectedLevelId : current
}

export function buildCombatLabRunConfig(value: unknown): RunConfig {
  const config = normalizeCombatLabConfig(value)
  return {
    mode: 'combat-lab',
    arenaLevelId: config.arenaLevelId,
    bossLevelId: config.bossLevelId,
    bossOnly: config.encounter === 'boss',
    invincible: true,
    fixedLoadout: true,
    playerLevel: config.playerLevel,
    bossHealthMultiplier: config.bossHealthMultiplier,
    startingLoadout: normalizeStartingLoadout(config.loadout),
  }
}

export function buildBossTrialRunConfig(levelId: unknown): RunConfig {
  const level = resolveBossLevel(levelId)
  return {
    mode: 'boss-trial',
    arenaLevelId: level.id,
    bossLevelId: level.id,
    bossOnly: true,
    invincible: false,
    fixedLoadout: true,
    playerLevel: BOSS_TRIAL_PLAYER_LEVELS[level.id - 1],
    bossHealthMultiplier: 1,
    startingLoadout: getBossTrialLoadout(level.id),
  }
}
