import type {
  LevelDefinition,
  ModuleDefinition,
  ModuleId,
  OwnedModule,
  OwnedWeapon,
  TraceModDefinition,
  TraceModId,
  UpgradeOption,
  WeaponDefinition,
  WeaponId,
} from '../shared/types'

export const WEAPON_RANK_CAP = 5
export const MODULE_RANK_CAP = 3
export const WEAPON_SLOT_CAP = 4
export const MODULE_SLOT_CAP = 4
export const TRACE_MOD_SLOT_CAP = 3

export const WEAPONS = {
  'helio-lance': {
    id: 'helio-lance',
    name: 'Helio Lance',
    shortName: 'Lance',
    description: 'A solar needle that spears the nearest marked target.',
    moduleId: 'prism-lens',
    awakening: 'Crowned Spear',
    color: 0xffcf63,
    cooldown: 0.58,
    damage: 28,
  },
  'crescent-array': {
    id: 'crescent-array',
    name: 'Crescent Array',
    shortName: 'Crescents',
    description: 'A radial fan of moonblades carves space around the bearer.',
    moduleId: 'gyro-crown',
    awakening: 'Eclipse Wheel',
    color: 0x8cecff,
    cooldown: 1.05,
    damage: 18,
  },
  'arc-choir': {
    id: 'arc-choir',
    name: 'Arc Choir',
    shortName: 'Choir',
    description: 'Resonant lightning jumps between enemies in a rising chord.',
    moduleId: 'resonance-coil',
    awakening: 'Cathedral Storm',
    color: 0xb18cff,
    cooldown: 1.28,
    damage: 24,
  },
  'rift-seeds': {
    id: 'rift-seeds',
    name: 'Rift Seeds',
    shortName: 'Seeds',
    description: 'Plants unstable wells that bloom into short-lived singularities.',
    moduleId: 'grav-anchor',
    awakening: 'Eventide Garden',
    color: 0x70f0b5,
    cooldown: 1.72,
    damage: 38,
  },
  'comet-swarm': {
    id: 'comet-swarm',
    name: 'Comet Swarm',
    shortName: 'Comets',
    description: 'A hunting flight of micro-comets pursues priority targets.',
    moduleId: 'guidance-filament',
    awakening: 'Perihelion Hunt',
    color: 0xff8f70,
    cooldown: 0.92,
    damage: 21,
  },
  'ash-halo': {
    id: 'ash-halo',
    name: 'Ash Halo',
    shortName: 'Halo',
    description: 'Rapid cinder pulses scorch every creature close to the bearer.',
    moduleId: 'thermal-mantle',
    awakening: 'Cinder Seraph',
    color: 0xff6b42,
    cooldown: 0.36,
    damage: 11,
  },
  'mirror-bow': {
    id: 'mirror-bow',
    name: 'Mirror Bow',
    shortName: 'Mirror',
    description: 'Paired hard-light bolts pierce forward and along the mirrored heading.',
    moduleId: 'flux-mirror',
    awakening: 'Infinite Refrain',
    color: 0xe6f3ff,
    cooldown: 0.74,
    damage: 34,
  },
  'null-bell': {
    id: 'null-bell',
    name: 'Null Bell',
    shortName: 'Bell',
    description: 'A midnight toll expands outward and damages a vast surrounding radius.',
    moduleId: 'deep-capacitor',
    awakening: 'Midnight Absolute',
    color: 0x5f6dff,
    cooldown: 2.2,
    damage: 62,
  },
} satisfies Record<WeaponId, WeaponDefinition>

export const MODULES = {
  'prism-lens': {
    id: 'prism-lens',
    name: 'Prism Lens',
    description: 'Extends projectile reach and concentrates damage on marked targets.',
  },
  'gyro-crown': {
    id: 'gyro-crown',
    name: 'Gyro Crown',
    description: 'Adds orbital stability, rotation speed, and an extra interception arc.',
  },
  'resonance-coil': {
    id: 'resonance-coil',
    name: 'Resonance Coil',
    description: 'Improves chain reach and amplifies every consecutive jump.',
  },
  'grav-anchor': {
    id: 'grav-anchor',
    name: 'Grav Anchor',
    description: 'Widens field effects and holds light enemies near their center.',
  },
  'guidance-filament': {
    id: 'guidance-filament',
    name: 'Guidance Filament',
    description: 'Sharpens homing, flight speed, and priority-target acquisition.',
  },
  'thermal-mantle': {
    id: 'thermal-mantle',
    name: 'Thermal Mantle',
    description: 'Increases burn duration and turns close pressure into stored heat.',
  },
  'flux-mirror': {
    id: 'flux-mirror',
    name: 'Flux Mirror',
    description: 'Creates returning echoes and strengthens damage after a reflection.',
  },
  'deep-capacitor': {
    id: 'deep-capacitor',
    name: 'Deep Capacitor',
    description: 'Stores excess charge, reducing long cooldowns after heavy hits.',
  },
} satisfies Record<ModuleId, ModuleDefinition>

export const TRACE_MODS = {
  'closed-circuit': {
    id: 'closed-circuit',
    name: 'Closed Circuit',
    description: 'Closed Trace loops deal 35% more damage to everything caught inside.',
  },
  afterimage: {
    id: 'afterimage',
    name: 'Afterimage',
    description: 'Your luminous Trace remembers a much longer path before it fades.',
  },
  crossfire: {
    id: 'crossfire',
    name: 'Crossfire',
    description: 'Every fourth volley repeats in the opposite direction.',
  },
  nightglass: {
    id: 'nightglass',
    name: 'Nightglass',
    description: 'All attacks gain 6% critical chance; critical hits deal 75% more damage.',
  },
  faultline: {
    id: 'faultline',
    name: 'Faultline',
    description: 'Hits of 45 damage or more fracture for 18% damage to nearby enemies.',
  },
  sunblood: {
    id: 'sunblood',
    name: 'Sunblood',
    description: 'Every twentieth defeat restores 3.5% of maximum vitality.',
  },
  'quiet-step': {
    id: 'quiet-step',
    name: 'Quiet Step',
    description: 'Move 18% faster after four seconds without taking damage.',
  },
  'red-shift': {
    id: 'red-shift',
    name: 'Red Shift',
    description: 'Attack cadence rises with threat density near the player.',
  },
} satisfies Record<TraceModId, TraceModDefinition>

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    name: 'First Beacon',
    description: 'Ignite the sleeping heart of the causeway.',
    duration: 240,
    difficulty: 1,
    enemyHealth: 0.9,
    spawnRate: 0.82,
    enemyPool: ['maskling', 'shardwing'],
    bossId: 'gloam-stag',
    bossName: 'Gloam Stag',
    bossFrame: 0,
    accent: '#7cf7d4',
    hazards: ['Star-lines sweep full horizontal or vertical lanes.', 'Gloam Stag fans aimed strike lanes as each phase deepens.'],
    reward: 'Crescent Array pattern and 45 Dawn Shards',
    unlockWeapon: 'crescent-array',
  },
  {
    id: 2,
    name: 'Glassreed Mire',
    description: 'The flooded reeds sing with borrowed voices.',
    duration: 270,
    difficulty: 1.25,
    enemyHealth: 1,
    spawnRate: 0.9,
    enemyPool: ['maskling', 'shardwing', 'cantor'],
    bossId: 'mire-cantor',
    bossName: 'Mire Cantor',
    bossFrame: 1,
    accent: '#65d9b0',
    hazards: ['Twin mire sigils bloom near the bearer.', 'Mire Cantor surrounds the bearer with orbiting sound rings.'],
    reward: 'Arc Choir pattern and 60 Dawn Shards',
    unlockWeapon: 'arc-choir',
  },
  {
    id: 3,
    name: 'Shattered Arcade',
    description: 'The old pleasure district still remembers the sun.',
    duration: 300,
    difficulty: 1.55,
    enemyHealth: 1.12,
    spawnRate: 1,
    enemyPool: ['maskling', 'cantor', 'railjaw'],
    bossId: 'railjaw-prime',
    bossName: 'Railjaw Prime',
    bossFrame: 2,
    accent: '#ffcf63',
    hazards: ['Angled rail lanes cut in from either edge.', 'Railjaw Prime escalates into crossing strike lanes.'],
    reward: 'Rift Seeds pattern and 78 Dawn Shards',
    unlockWeapon: 'rift-seeds',
  },
  {
    id: 4,
    name: 'Prism Garden',
    description: 'Every bloom splits the light—and what hunts it.',
    duration: 300,
    difficulty: 1.9,
    enemyHealth: 1.26,
    spawnRate: 1.1,
    enemyPool: ['shardwing', 'cantor', 'chronowisp'],
    bossId: 'mirror-matron',
    bossName: 'Mirror Matron',
    bossFrame: 3,
    accent: '#d4a5ff',
    hazards: ['Three prism seals orbit the bearer before detonation.', 'Mirror Matron marks both the bearer and their mirrored position.'],
    reward: 'Comet Swarm pattern and 96 Dawn Shards',
    unlockWeapon: 'comet-swarm',
  },
  {
    id: 5,
    name: 'Drowned Docks',
    description: 'Black tides close every easy road.',
    duration: 330,
    difficulty: 2.25,
    enemyHealth: 1.42,
    spawnRate: 1.22,
    enemyPool: ['maskling', 'cantor', 'cinder-guard', 'chronowisp'],
    bossId: 'tide-apostle',
    bossName: 'Tide Apostle',
    bossFrame: 1,
    accent: '#57b7ff',
    hazards: ['Tidal walls sweep full horizontal or vertical lanes.', 'Tide Apostle scatters staggered flood marks around the bearer.'],
    reward: 'Ash Halo pattern and 118 Dawn Shards',
    unlockWeapon: 'ash-halo',
  },
  {
    id: 6,
    name: 'Stormrail',
    description: 'Ride the last current through a broken sky.',
    duration: 360,
    difficulty: 2.65,
    enemyHealth: 1.6,
    spawnRate: 1.34,
    enemyPool: ['railjaw', 'shardwing', 'cinder-guard', 'maskling'],
    bossId: 'storm-engine',
    bossName: 'Storm Engine',
    bossFrame: 4,
    accent: '#9ca7ff',
    hazards: ['Twin charged sigils erupt near the bearer.', 'Storm Engine fans increasingly dense target lanes.'],
    reward: 'Mirror Bow pattern and 142 Dawn Shards',
    unlockWeapon: 'mirror-bow',
  },
  {
    id: 7,
    name: 'Hourglass Vault',
    description: 'Time fractures around the sealed archive.',
    duration: 360,
    difficulty: 3.1,
    enemyHealth: 1.82,
    spawnRate: 1.46,
    enemyPool: ['chronowisp', 'railjaw', 'cantor', 'shardwing'],
    bossId: 'chronophage',
    bossName: 'Chronophage',
    bossFrame: 4,
    accent: '#8de9ff',
    hazards: ['Angled time-shear lanes enter from either edge.', 'Chronophage surrounds the bearer with rotating clock sigils.'],
    reward: 'Null Bell pattern and 168 Dawn Shards',
    unlockWeapon: 'null-bell',
  },
  {
    id: 8,
    name: 'Cinder Foundry',
    description: 'The engines beneath the world are waking.',
    duration: 390,
    difficulty: 3.6,
    enemyHealth: 2.05,
    spawnRate: 1.6,
    enemyPool: ['cinder-guard', 'railjaw', 'maskling', 'chronowisp'],
    bossId: 'furnace-titan',
    bossName: 'Furnace Titan',
    bossFrame: 2,
    accent: '#ff784f',
    hazards: ['Four furnace seals orbit the bearer before erupting.', 'Furnace Titan carves widening cross-lanes through the arena.'],
    reward: 'Masterwork module cache and 205 Dawn Shards',
  },
  {
    id: 9,
    name: 'Void Observatory',
    description: 'Beyond the lens, the night looks back.',
    duration: 420,
    difficulty: 4.15,
    enemyHealth: 2.3,
    spawnRate: 1.75,
    enemyPool: ['chronowisp', 'shardwing', 'cantor', 'railjaw', 'cinder-guard'],
    bossId: 'cartographer',
    bossName: 'The Cartographer',
    bossFrame: 3,
    accent: '#6d74ff',
    hazards: ['Constellation walls sweep full arena lanes.', 'The Cartographer strikes current and mirrored positions together.'],
    reward: 'Astrarium sigil and 255 Dawn Shards',
  },
  {
    id: 10,
    name: 'Crown of Dawn',
    description: 'Carry the final light into the eclipse.',
    duration: 450,
    difficulty: 4.8,
    enemyHealth: 2.6,
    spawnRate: 1.9,
    enemyPool: ['maskling', 'shardwing', 'cantor', 'railjaw', 'chronowisp', 'cinder-guard'],
    bossId: 'sun-eater',
    bossName: 'The Sun-Eater',
    bossFrame: 5,
    accent: '#ffd979',
    hazards: ['Twin eclipse seals erupt near the bearer.', 'The Sun-Eater scatters a tightening cluster of shadow marks.'],
    reward: 'Crown of Dawn relic and 360 Dawn Shards',
  },
]

const WEAPON_ICONS: Record<WeaponId, string> = {
  'helio-lance': '✦',
  'crescent-array': '☾',
  'arc-choir': 'ϟ',
  'rift-seeds': '◉',
  'comet-swarm': '☄',
  'ash-halo': '⊙',
  'mirror-bow': '◇',
  'null-bell': '◌',
}

const MODULE_ICONS: Record<ModuleId, string> = {
  'prism-lens': '△',
  'gyro-crown': '⌾',
  'resonance-coil': '≋',
  'grav-anchor': '⌖',
  'guidance-filament': '⌁',
  'thermal-mantle': '♨',
  'flux-mirror': '◈',
  'deep-capacitor': '▣',
}

const TRACE_ICONS: Record<TraceModId, string> = {
  'closed-circuit': '∞',
  afterimage: '〽',
  crossfire: '✣',
  nightglass: '◆',
  faultline: '⌇',
  sunblood: '☀',
  'quiet-step': '⌁',
  'red-shift': '»',
}

export type SeedValue = number | string

function hashStringSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function normalizeSeed(seed: SeedValue): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.trunc(seed) >>> 0
  }
  return hashStringSeed(String(seed))
}

export class SeededRng {
  private state: number

  constructor(seed: SeedValue) {
    this.state = normalizeSeed(seed)
  }

  get seed(): number {
    return this.state >>> 0
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  int(min: number, max: number): number {
    const lower = Math.ceil(Math.min(min, max))
    const upper = Math.floor(Math.max(min, max))
    return lower + Math.floor(this.next() * (upper - lower + 1))
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined
    return items[this.int(0, items.length - 1)]
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(0, index)
      ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
    }
    return copy
  }
}

export function createSeededRng(seed: SeedValue): SeededRng {
  return new SeededRng(seed)
}

export interface UpgradeDraftContext {
  weapons: OwnedWeapon[]
  modules: OwnedModule[]
  traceMods: TraceModId[]
  unlockedWeapons?: WeaponId[]
  hp?: number
  maxHp?: number
  shield?: number
  maxShield?: number
  rerollsUsed?: number
  excludeOptionIds?: string[]
}

export interface UpgradeDraftResult {
  options: UpgradeOption[]
  seed: number
  rerollAvailable: boolean
  rerollsUsed: number
}

type CandidateLane = 'awakening' | 'weapon' | 'synergy' | 'trace' | 'utility' | 'general'

interface UpgradeCandidate {
  option: UpgradeOption
  weight: number
  lane: CandidateLane
}

function romanRank(rank: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][Math.max(0, Math.min(4, rank - 1))] ?? String(rank)
}

function weightedPick(candidates: UpgradeCandidate[], rng: SeededRng): UpgradeCandidate | undefined {
  if (candidates.length === 0) return undefined
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  let cursor = rng.next() * total
  for (const candidate of candidates) {
    cursor -= candidate.weight
    if (cursor <= 0) return candidate
  }
  return candidates[candidates.length - 1]
}

function weaponRankOption(weapon: WeaponDefinition, nextRank: number): UpgradeOption {
  const reachesMastery = nextRank === WEAPON_RANK_CAP
  return {
    id: `weapon:${weapon.id}:${nextRank}`,
    type: 'weapon',
    title: `${weapon.name} ${romanRank(nextRank)}`,
    category: reachesMastery ? 'Master weapon' : 'Weapon calibration',
    description: reachesMastery
      ? `Master ${weapon.shortName}; pair it with ${MODULES[weapon.moduleId].name} to awaken ${weapon.awakening}.`
      : `Increase ${weapon.shortName} damage and improve its firing pattern.`,
    rank: nextRank,
    icon: WEAPON_ICONS[weapon.id],
    weaponId: weapon.id,
    rarity: reachesMastery ? 'elite' : 'standard',
  }
}

function awakeningOption(weapon: WeaponDefinition): UpgradeOption {
  return {
    id: `awaken:${weapon.id}`,
    type: 'weapon',
    title: weapon.awakening,
    category: 'Awakening',
    description: `${weapon.name} and ${MODULES[weapon.moduleId].name} collapse into their final form.`,
    rank: WEAPON_RANK_CAP,
    icon: '✹',
    weaponId: weapon.id,
    moduleId: weapon.moduleId,
    rarity: 'awakening',
  }
}

function moduleRankOption(module: ModuleDefinition, nextRank: number, weapon?: WeaponDefinition): UpgradeOption {
  return {
    id: `module:${module.id}:${nextRank}`,
    type: 'module',
    title: `${module.name} ${romanRank(nextRank)}`,
    category: weapon ? `${weapon.shortName} synergy` : 'Field module',
    description: weapon
      ? `${module.description} Enables ${weapon.awakening} once ${weapon.name} is mastered.`
      : module.description,
    rank: nextRank,
    icon: MODULE_ICONS[module.id],
    moduleId: module.id,
    weaponId: weapon?.id,
    rarity: nextRank === MODULE_RANK_CAP ? 'elite' : 'standard',
  }
}

function traceOption(trace: TraceModDefinition): UpgradeOption {
  return {
    id: `trace:${trace.id}`,
    type: 'trace',
    title: trace.name,
    category: 'Trace mod',
    description: trace.description,
    icon: TRACE_ICONS[trace.id],
    traceModId: trace.id,
    rarity: 'elite',
  }
}

function utilityCandidates(context: UpgradeDraftContext): UpgradeCandidate[] {
  const hpRatio =
    context.hp === undefined || context.maxHp === undefined || context.maxHp <= 0
      ? 1
      : context.hp / context.maxHp
  const shieldRatio =
    context.shield === undefined || context.maxShield === undefined || context.maxShield <= 0
      ? 1
      : context.shield / context.maxShield

  return [
    {
      option: {
        id: 'heal:vital-repair',
        type: 'heal',
        title: 'Vital Repair',
        category: 'Recovery',
        description: 'Restore 30% maximum vitality.',
        icon: '✚',
        rarity: hpRatio < 0.4 ? 'elite' : 'standard',
      },
      weight: hpRatio < 0.4 ? 88 : hpRatio < 0.78 ? 34 : 5,
      lane: 'utility',
    },
    {
      option: {
        id: 'heal:aegis-overcharge',
        type: 'heal',
        title: 'Aegis Overcharge',
        category: 'Recovery',
        description: 'Restore the aegis and increase its capacity for this run.',
        icon: '⬡',
        rarity: shieldRatio < 0.35 ? 'elite' : 'standard',
      },
      weight: shieldRatio < 0.35 ? 62 : shieldRatio < 0.8 ? 22 : 4,
      lane: 'utility',
    },
    {
      option: {
        id: 'heal:pulse-prime',
        type: 'heal',
        title: 'Pulse Prime',
        category: 'Overdrive',
        description: 'Charge the Dawn Pulse and gain a brief invulnerable beat.',
        icon: '◉',
        rarity: 'standard',
      },
      weight: 9,
      lane: 'utility',
    },
  ]
}

/**
 * Produces a deterministic, three-card draft.
 *
 * Slot one favors an owned weapon or a ready awakening; slot two favors the
 * matching module; the final slot is weighted across trace mods, new weapons,
 * recovery, and remaining build progress. Pass `rerolled=true` with the prior
 * option ids in `excludeOptionIds` to consume the run's single reroll. When a
 * build is fully saturated, excluded recovery cards may return so the draft
 * always remains actionable.
 */
export function createUpgradeDraft(
  context: UpgradeDraftContext,
  seed: SeedValue = 1,
  rerolled = false,
): UpgradeDraftResult {
  const priorRerolls = Math.max(0, context.rerollsUsed ?? 0)
  if (rerolled && priorRerolls >= 1) {
    throw new RangeError('NIGHTTRACE upgrade reroll has already been spent.')
  }

  const rng = createSeededRng(seed)
  const exclusions = new Set(context.excludeOptionIds ?? [])
  const rerollsUsed = Math.min(1, priorRerolls + (rerolled ? 1 : 0))
  const unlocked = new Set<WeaponId>(
    context.unlockedWeapons ?? ['helio-lance', ...context.weapons.map((weapon) => weapon.id)],
  )
  const ownedWeapons = new Map(context.weapons.map((weapon) => [weapon.id, weapon]))
  const ownedModules = new Map(context.modules.map((module) => [module.id, module]))
  const ownedTraces = new Set(context.traceMods)
  const candidateMap = new Map<string, UpgradeCandidate>()

  const addCandidate = (candidate: UpgradeCandidate) => {
    if (exclusions.has(candidate.option.id)) return
    const current = candidateMap.get(candidate.option.id)
    if (!current || current.weight < candidate.weight) candidateMap.set(candidate.option.id, candidate)
  }

  for (const owned of context.weapons) {
    const weapon = WEAPONS[owned.id]
    const module = ownedModules.get(weapon.moduleId)
    if (!owned.awakened && owned.rank >= WEAPON_RANK_CAP && module && module.rank >= 1) {
      addCandidate({ option: awakeningOption(weapon), weight: 180, lane: 'awakening' })
    } else if (!owned.awakened && owned.rank < WEAPON_RANK_CAP) {
      const nextRank = Math.max(1, owned.rank + 1)
      addCandidate({
        option: weaponRankOption(weapon, nextRank),
        weight: 92 + owned.rank * 8,
        lane: 'weapon',
      })
    }
  }

  if (ownedWeapons.size < WEAPON_SLOT_CAP) {
    for (const weaponId of unlocked) {
      if (ownedWeapons.has(weaponId)) continue
      const weapon = WEAPONS[weaponId]
      addCandidate({
        option: weaponRankOption(weapon, 1),
        weight: 42,
        lane: 'general',
      })
    }
  }

  for (const owned of context.modules) {
    if (owned.rank >= MODULE_RANK_CAP) continue
    const module = MODULES[owned.id]
    const pairedWeapon = context.weapons.find((weapon) => WEAPONS[weapon.id].moduleId === owned.id)
    addCandidate({
      option: moduleRankOption(module, Math.max(1, owned.rank + 1), pairedWeapon && WEAPONS[pairedWeapon.id]),
      weight: pairedWeapon ? 84 + pairedWeapon.rank * 7 : 28,
      lane: pairedWeapon ? 'synergy' : 'general',
    })
  }

  if (ownedModules.size < MODULE_SLOT_CAP) {
    for (const owned of context.weapons) {
      const weapon = WEAPONS[owned.id]
      if (ownedModules.has(weapon.moduleId)) continue
      addCandidate({
        option: moduleRankOption(MODULES[weapon.moduleId], 1, weapon),
        weight: 96 + owned.rank * 8,
        lane: 'synergy',
      })
    }
  }

  if (ownedTraces.size < TRACE_MOD_SLOT_CAP) {
    for (const traceId of Object.keys(TRACE_MODS) as TraceModId[]) {
      if (ownedTraces.has(traceId)) continue
      addCandidate({
        option: traceOption(TRACE_MODS[traceId]),
        weight: context.traceMods.length === 0 ? 52 : 34,
        lane: 'trace',
      })
    }
  }

  const utilities = utilityCandidates(context)
  for (const utility of utilities) addCandidate(utility)

  const selected: UpgradeCandidate[] = []
  const takeFrom = (lanes: CandidateLane[]) => {
    if (selected.length >= 3) return
    const selectedIds = new Set(selected.map((candidate) => candidate.option.id))
    const pool = [...candidateMap.values()].filter(
      (candidate) => lanes.includes(candidate.lane) && !selectedIds.has(candidate.option.id),
    )
    const choice = weightedPick(pool, rng)
    if (choice) selected.push(choice)
  }

  const hasAwakening = [...candidateMap.values()].some((candidate) => candidate.lane === 'awakening')
  takeFrom(hasAwakening ? ['awakening'] : ['weapon'])
  if (selected.length === 0) takeFrom(['general'])
  takeFrom(['synergy'])

  const tracePoolExists = [...candidateMap.values()].some((candidate) => candidate.lane === 'trace')
  if (selected.length < 3 && tracePoolExists && rng.next() < 0.42) takeFrom(['trace'])

  while (selected.length < 3) {
    const selectedIds = new Set(selected.map((candidate) => candidate.option.id))
    const pool = [...candidateMap.values()].filter((candidate) => !selectedIds.has(candidate.option.id))
    const choice = weightedPick(pool, rng)
    if (!choice) break
    selected.push(choice)
  }

  if (selected.length < 3) {
    const selectedIds = new Set(selected.map((candidate) => candidate.option.id))
    for (const utility of utilities) {
      if (selected.length >= 3) break
      if (selectedIds.has(utility.option.id)) continue
      selected.push(utility)
      selectedIds.add(utility.option.id)
    }
  }

  return {
    options: selected.slice(0, 3).map((candidate) => candidate.option),
    seed: rng.seed,
    rerollAvailable: rerollsUsed === 0,
    rerollsUsed,
  }
}

export function getLevel(id: number): LevelDefinition {
  const safeId = Number.isFinite(id) ? Math.trunc(id) : 1
  const clampedId = Math.min(LEVELS.length, Math.max(1, safeId))
  return LEVELS[clampedId - 1]
}

export function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}
