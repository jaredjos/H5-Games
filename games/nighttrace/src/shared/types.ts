export type ScreenId =
  | 'title'
  | 'campaign'
  | 'boss-trials'
  | 'combat-lab'
  | 'astrarium'
  | 'codex'
  | 'settings'
  | 'game'
  | 'results'

export type RunMode = 'campaign' | 'boss-trial' | 'combat-lab'

export type WeaponId =
  | 'helio-lance'
  | 'crescent-array'
  | 'arc-choir'
  | 'rift-seeds'
  | 'comet-swarm'
  | 'ash-halo'
  | 'mirror-bow'
  | 'null-bell'

export type ModuleId =
  | 'prism-lens'
  | 'gyro-crown'
  | 'resonance-coil'
  | 'grav-anchor'
  | 'guidance-filament'
  | 'thermal-mantle'
  | 'flux-mirror'
  | 'deep-capacitor'

export type TraceModId =
  | 'closed-circuit'
  | 'afterimage'
  | 'crossfire'
  | 'nightglass'
  | 'faultline'
  | 'sunblood'
  | 'quiet-step'
  | 'red-shift'

export type EnemyId = 'maskling' | 'shardwing' | 'cantor' | 'railjaw' | 'chronowisp' | 'cinder-guard'

export type BossId =
  | 'gloam-stag'
  | 'mire-cantor'
  | 'railjaw-prime'
  | 'mirror-matron'
  | 'tide-apostle'
  | 'storm-engine'
  | 'chronophage'
  | 'furnace-titan'
  | 'cartographer'
  | 'sun-eater'

export interface Vec2 {
  x: number
  y: number
}

export interface WeaponDefinition {
  id: WeaponId
  name: string
  shortName: string
  description: string
  moduleId: ModuleId
  awakening: string
  color: number
  cooldown: number
  damage: number
}

export interface ModuleDefinition {
  id: ModuleId
  name: string
  description: string
}

export interface TraceModDefinition {
  id: TraceModId
  name: string
  description: string
}

export interface LevelDefinition {
  id: number
  name: string
  description: string
  duration: number
  difficulty: number
  enemyHealth: number
  spawnRate: number
  enemyPool: EnemyId[]
  bossId: BossId
  bossName: string
  bossFrame: number
  accent: string
  hazards: string[]
  reward: string
  unlockWeapon?: WeaponId
}

export interface OwnedWeapon {
  id: WeaponId
  rank: number
  branch?: 'swarm' | 'hunter'
  awakened?: boolean
}

export interface OwnedModule {
  id: ModuleId
  rank: number
}

export interface StartingLoadout {
  weapons: OwnedWeapon[]
  modules: OwnedModule[]
  traceMods: TraceModId[]
}

export interface CombatLabConfig {
  arenaLevelId: number
  bossLevelId: number
  encounter: 'boss' | 'sector'
  playerLevel: number
  bossHealthMultiplier: number
  loadout: StartingLoadout
}

export interface RunConfig {
  mode: RunMode
  arenaLevelId: number
  bossLevelId: number
  bossOnly: boolean
  invincible: boolean
  fixedLoadout: boolean
  playerLevel: number
  bossHealthMultiplier: number
  startingLoadout?: StartingLoadout
}

export interface UpgradeOption {
  id: string
  type: 'weapon' | 'module' | 'trace' | 'heal'
  title: string
  category: string
  description: string
  rank?: number
  icon: string
  weaponId?: WeaponId
  moduleId?: ModuleId
  traceModId?: TraceModId
  rarity?: 'standard' | 'elite' | 'awakening'
}

export interface BossSnapshot {
  name: string
  hp: number
  maxHp: number
  phase: number
}

export interface GameSnapshot {
  runMode: RunMode
  invincible: boolean
  awaitingStart: boolean
  hp: number
  maxHp: number
  shield: number
  maxShield: number
  xp: number
  xpToNext: number
  level: number
  elapsed: number
  duration: number
  kills: number
  pulseCharge: number
  pulseReady: boolean
  closedLoops: number
  largestChain: number
  boss?: BossSnapshot
  nextEvent: string
  weapons: OwnedWeapon[]
  modules: OwnedModule[]
  traceMods: TraceModId[]
  upgradeOptions?: UpgradeOption[]
  tutorial?: string
  paused: boolean
}

export interface RunResult {
  runMode: RunMode
  victory: boolean
  levelId: number
  survivalTime: number
  kills: number
  closedLoops: number
  largestChain: number
  dawnShards: number
  weaponDamage: Array<{ id: WeaponId; damage: number }>
}

export interface SaveData {
  version: 3
  unlockedLevel: number
  bossTrialClears: number
  completedLevels: number[]
  mastery: Record<number, Array<'clear' | 'trace' | 'aegis'>>
  dawnShards: number
  upgrades: Record<string, number>
  unlockedWeapons: WeaponId[]
  settings: GameSettings
}

export interface GameSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  reducedFlash: boolean
  reducedShake: boolean
  highContrastPickups: boolean
  showDamageNumbers: boolean
  autoPulse: boolean
}
