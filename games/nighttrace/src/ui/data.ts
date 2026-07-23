import type { BossId, EnemyId, WeaponId } from '../shared/types'

export interface CampaignNodeLayout {
  id: number
  x: number
  y: number
}

export const CAMPAIGN_NODE_LAYOUT: CampaignNodeLayout[] = [
  { id: 1, x: 15, y: 25 },
  { id: 2, x: 9, y: 47 },
  { id: 3, x: 31, y: 48 },
  { id: 4, x: 44, y: 25 },
  { id: 5, x: 61, y: 27 },
  { id: 6, x: 76, y: 43 },
  { id: 7, x: 79, y: 62 },
  { id: 8, x: 67, y: 77 },
  { id: 9, x: 52, y: 88 },
  { id: 10, x: 34, y: 91 },
]

export interface AstrariumNodeDefinition {
  id: string
  name: string
  description: string
  stat: string
  baseCost: number
  maxRank: number
  x: number
  y: number
  requires?: string
  icon: 'vitality' | 'aegis' | 'lance' | 'trace' | 'magnet' | 'reroll' | 'speed' | 'crit' | 'echo' | 'dawn'
}

export const ASTRARIUM_NODES: AstrariumNodeDefinition[] = [
  {
    id: 'vitality',
    name: 'Vital Spark',
    description: 'Strengthen the vessel that carries the last light.',
    stat: '+4 maximum health per rank',
    baseCost: 18,
    maxRank: 5,
    x: 50,
    y: 82,
    icon: 'vitality',
  },
  {
    id: 'aegis',
    name: 'Aegis Thread',
    description: 'A woven filament catches the first edge of the night.',
    stat: '+3 starting shield per rank',
    baseCost: 22,
    maxRank: 5,
    x: 36,
    y: 68,
    requires: 'vitality',
    icon: 'aegis',
  },
  {
    id: 'force',
    name: 'Helio Focus',
    description: 'Temper every ray through a more exacting lens.',
    stat: '+2% weapon damage per rank',
    baseCost: 26,
    maxRank: 5,
    x: 64,
    y: 68,
    requires: 'vitality',
    icon: 'lance',
  },
  {
    id: 'pulse',
    name: 'Long Memory',
    description: 'The star remembers more of every path you draw.',
    stat: '+0.12s Trace length per rank',
    baseCost: 30,
    maxRank: 4,
    x: 24,
    y: 51,
    requires: 'aegis',
    icon: 'trace',
  },
  {
    id: 'magnetism',
    name: 'Mote Song',
    description: 'Lost light answers your passing call.',
    stat: '+7% pickup radius per rank',
    baseCost: 24,
    maxRank: 4,
    x: 43,
    y: 49,
    requires: 'aegis',
    icon: 'magnet',
  },
  {
    id: 'bright-draft',
    name: 'Bright Draft',
    description: 'Once per descent, reject the path fate offers.',
    stat: 'Unlocks one upgrade reroll per run',
    baseCost: 70,
    maxRank: 1,
    x: 57,
    y: 49,
    requires: 'force',
    icon: 'reroll',
  },
  {
    id: 'red-shift',
    name: 'Red Shift',
    description: 'Motion sharpens the edge of every surviving spark.',
    stat: '+1.5% movement speed per rank',
    baseCost: 32,
    maxRank: 4,
    x: 76,
    y: 51,
    requires: 'force',
    icon: 'speed',
  },
  {
    id: 'parallax-eye',
    name: 'Parallax Eye',
    description: 'Read the instant when shadow and starlight align.',
    stat: '+1.5% critical chance per rank',
    baseCost: 42,
    maxRank: 3,
    x: 34,
    y: 31,
    requires: 'magnetism',
    icon: 'crit',
  },
  {
    id: 'echo-chamber',
    name: 'Echo Chamber',
    description: 'A perfect circuit leaves a second, quieter wound.',
    stat: '+5% closed-loop damage per rank',
    baseCost: 46,
    maxRank: 3,
    x: 66,
    y: 31,
    requires: 'bright-draft',
    icon: 'echo',
  },
  {
    id: 'dawn-within',
    name: 'Dawn Within',
    description: 'The Astrarium recognizes a keeper ready for the Crown.',
    stat: '+8% boss damage · final constellation',
    baseCost: 120,
    maxRank: 1,
    x: 50,
    y: 13,
    requires: 'parallax-eye',
    icon: 'dawn',
  },
]

export const ENEMY_CODEX: Array<{
  id: EnemyId
  name: string
  epithet: string
  behavior: string
  frame: number
}> = [
  { id: 'maskling', name: 'Maskling', epithet: 'Hunger given a face', behavior: 'Closes in directly and gathers into crushing knots.', frame: 0 },
  { id: 'shardwing', name: 'Shardwing', epithet: 'A knife carried by smoke', behavior: 'Cuts across the arena in quick diagonal passes.', frame: 1 },
  { id: 'cantor', name: 'Cantor', epithet: 'The choir beneath the water', behavior: 'Projects slow, readable waves from behind the horde.', frame: 2 },
  { id: 'railjaw', name: 'Railjaw', epithet: 'Momentum without mercy', behavior: 'Telegraphs a crushing rail lane before resuming the hunt.', frame: 3 },
  { id: 'chronowisp', name: 'Chronowisp', epithet: 'An hour that refused to die', behavior: 'Weaves unpredictably, then blinks to a new angle around the bearer.', frame: 4 },
  { id: 'cinder-guard', name: 'Cinder Guard', epithet: 'Armor around an empty oath', behavior: 'Absorbs part of every hit and warns before a close-range furnace slam.', frame: 5 },
]

export const BOSS_CODEX: Array<{ id: BossId; name: string; epithet: string; frame: number }> = [
  { id: 'gloam-stag', name: 'Gloam Stag', epithet: 'First antler of the endless night', frame: 0 },
  { id: 'mire-cantor', name: 'Mire Cantor', epithet: 'Six voices, one drowned prayer', frame: 1 },
  { id: 'railjaw-prime', name: 'Railjaw Prime', epithet: 'The old district remembers its teeth', frame: 2 },
  { id: 'mirror-matron', name: 'Mirror Matron', epithet: 'Every reflection wants a body', frame: 3 },
  { id: 'tide-apostle', name: 'Tide Apostle', epithet: 'The black sea made sovereign', frame: 1 },
  { id: 'storm-engine', name: 'Storm Engine', epithet: 'A machine still obeying thunder', frame: 4 },
  { id: 'chronophage', name: 'Chronophage', epithet: 'It feeds where moments overlap', frame: 4 },
  { id: 'furnace-titan', name: 'Furnace Titan', epithet: 'The buried fire learns to walk', frame: 2 },
  { id: 'cartographer', name: 'The Cartographer', epithet: 'It maps the shape of your fear', frame: 3 },
  { id: 'sun-eater', name: 'The Sun-Eater', epithet: 'Last regent of the eclipse', frame: 5 },
]

export const WEAPON_UNLOCK_LEVEL: Partial<Record<WeaponId, number>> = {
  'helio-lance': 1,
  'crescent-array': 1,
  'arc-choir': 2,
  'rift-seeds': 3,
  'comet-swarm': 4,
  'ash-halo': 5,
  'mirror-bow': 6,
  'null-bell': 7,
}
