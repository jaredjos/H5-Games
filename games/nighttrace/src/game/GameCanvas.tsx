import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from 'react'
import {
  Application,
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type Ticker,
} from 'pixi.js'
import { appAssetUrl } from '../assetUrl'
import type {
  BossId,
  GameSettings,
  GameSnapshot,
  EnemyId,
  LevelDefinition,
  OwnedModule,
  OwnedWeapon,
  RunConfig,
  RunResult,
  TraceModId,
  UpgradeOption,
  WeaponId,
  Vec2,
} from '../shared/types'
import {
  ALL_WEAPON_IDS,
  BASE_FREE_REFRESHES_PER_RUN,
  BRIGHT_DRAFT_BONUS_REFRESHES,
  GLOBAL_DIFFICULTY_MULTIPLIER,
  WEAPONS,
  createUpgradeDraft,
  getLevel,
  type UpgradeDraftContext,
} from './content'
import { NighttraceAudio } from './audio'
import {
  HERO_FIRE_DURATION,
  HERO_FIRE_RELEASE_TIME,
  heroChargeFrameAt,
  heroFireFrameAt,
  heroPulseRecoveryFrameAt,
  heroWalkFrameAt,
  motionProgress,
  sampleBossMotion,
  sampleEnemyMotion,
  sampleHeroMotion,
  type AttackMotionStyle,
  type MotionPose,
} from './animation'
import { GameInput } from './input'
import {
  bossAttackRecoverySeconds,
  bossHealthForBuild,
  canSpawnPlannedDawnheart,
  chooseSupportPickup,
  eligibleEnemyPool,
  estimateBossDps,
  experienceToNextLevel,
  hordeActiveCap,
  hordePressureAt,
  PLANNED_DAWNHEART_HEAL_FRACTION,
  PLANNED_DAWNHEART_LIFETIME_SECONDS,
  plannedDawnheartWindows,
  sectorBaselineAt,
  supportPickupFirstDropSeconds,
  supportPickupIntervalSeconds,
  type PlannedDawnheartWindow,
  type SupportPickupKind,
} from './balance'
import {
  REVIVE_INVULNERABILITY_SECONDS,
  REVIVE_SANCTUARY_RADIUS,
  initialFreeRevives,
  revivedHealth,
} from './revivePolicy'
import {
  createBossPatternDirectorState,
  directBossPattern,
  type BossPatternDirectorState,
} from './bossPatternDirector'
import {
  DeterministicRandom,
  clamp,
  distanceSquared,
  lerp,
  pointInPolygon,
  polygonArea,
  segmentIntersection,
} from './math'
import {
  currentLocalWeaponShowcase,
  showcaseCaptureSeconds,
  showcaseLabel,
  showcaseLoadout,
} from './showcase'
import {
  HOSTILE_IMPACT_COLOR,
  HOSTILE_SHADOW_COLOR,
  bossImpactProgress,
  bossMaterialTreatment,
  bossPresentation,
  enemyPresentation,
  sampleHostileEnvelope,
} from './enemyPresentation'
import {
  resolveHostileTelegraphPalette,
  type HostileTelegraphMaterialPalette,
} from './hostileTelegraphPalette'
import {
  advanceHostileProjectile,
  hostileProjectilePoseAt,
  queueHostileProjectile,
  type HostileProjectileState,
} from './hostileProjectiles'
import {
  resolveWeaponVfxState,
  weaponVfxMotifProfile,
  weaponVfxProfile,
  type WeaponVfxStage,
  type WeaponVfxState,
} from './weaponVfx'
import {
  buildReplacementWeaponPattern,
  resolvePatternHits,
  type CapsulePatternStrike,
  type CirclePatternStrike,
  type ReplacementWeaponPattern,
} from './weaponPatterns'
import {
  replacementCosmeticUnit,
} from './replacementWeaponPresentation'
import {
  AUTHORED_SPELL_ASSET_DATA,
  AUTHORED_SPELL_ASSET_REVISION,
} from './authoredSpellAssetData'
import {
  authoredSpellAssetDataKey,
  authoredSpellStageMaterialProfile,
  resolveAuthoredSpellAssetLod,
  sampleAuthoredSpellMaterialPose,
} from './authoredSpellPresentation'
import {
  weaponCastDamageBudget,
  weaponCooldownSeconds,
  weightedFalloffTotal,
} from './weaponBalance'
import {
  groundedVfxCosmeticUnit,
  groundedVfxMaterialProfile,
  sampleGroundedVfxPose,
  type GroundedVfxKind,
  type GroundedVfxStage,
} from './groundedVfxPresentation'
import {
  sampleBossTelegraphParticles,
  type BossTelegraphParticle,
} from './bossTelegraphParticles'
import {
  SUPPORT_PICKUP_LIFETIME_SECONDS,
  supportPickupPresentation,
} from './pickupPresentation'
import {
  CHARACTER_VISUAL_PROFILES,
  browserVisualCapabilitySnapshot,
  resolveCharacterVisualLod,
  type CharacterVisualLod,
  type CharacterVisualProfile,
} from './visualQuality'
import {
  attenuateOverdrawAlpha,
  capDecorativeDensity,
  sceneVfxEnergyScale,
  type OverdrawKind,
} from './actorReadability'
import {
  BOSS_MOTION_ATLASES,
  resolveBossClipFrame,
  type ResolvedBossClipFrame,
} from './bossAnimationClips'
import {
  ENEMY_MOTION_ATLASES,
  resolveEnemyClipFrame,
  type ResolvedEnemyClipFrame,
} from './enemyAnimationClips'
import {
  TRACE_MINIMUM_AREA,
  TRACE_MINIMUM_POINTS,
  TRACE_SAMPLE_DISTANCE,
  pulseChargeFromExperience,
  pulseChargeFromNormalKill,
  tracePointAllowance,
  tracePulseReward,
} from './tracePulse'

const WORLD_WIDTH = 1672
const WORLD_HEIGHT = 941
const FIXED_STEP = 1 / 60
const MAX_STEPS_PER_FRAME = 14
const DAWNCASTER_WEAPON_IDS = new Set<WeaponId>([
  'helio-lance',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
  'mirror-bow',
])
const GRID_SIZE = 112
const HERO_RUNTIME_FRAME_SIZE = 512
const HERO_RUNTIME_SCALE = HERO_RUNTIME_FRAME_SIZE / 768
const HERO_ART_ROOT_X = (300 * HERO_RUNTIME_SCALE) / HERO_RUNTIME_FRAME_SIZE
const HERO_ART_ROOT_Y = (690 * HERO_RUNTIME_SCALE) / HERO_RUNTIME_FRAME_SIZE
// Keep the authored hero inside the normal-horde silhouette range.
// Sovereign bosses retain their separate 210x245+ presentation scale.
const HERO_ART_SCALE = 66 / (550 * HERO_RUNTIME_SCALE)
const HERO_MATERIAL_FRAME = Object.freeze({
  gather: 0,
  driftA: 4,
  driftB: 6,
  impact: 8,
  lance: 10,
  fragments: 11,
  fracture: 13,
  dust: 15,
} as const)

export interface GameCanvasHandle {
  beginEncounter(): void
  revive(): void
  declineRevive(): void
  selectUpgrade(optionId: string): void
  rerollUpgrade(): void
  togglePause(): void
  activatePulse(): void
  setOrientationPaused(paused: boolean): void
}

export interface GameCanvasProps {
  level: LevelDefinition
  runConfig: RunConfig
  settings: GameSettings
  unlockedWeapons: WeaponId[]
  persistentUpgrades: Record<string, number>
  orientationPaused: boolean
  onSnapshot(snapshot: GameSnapshot): void
  onComplete(result: RunResult): void
  onExit(): void
}

interface RuntimeCallbacks {
  onSnapshot(snapshot: GameSnapshot): void
  onComplete(result: RunResult): void
  onExit(): void
}

interface PlayerState {
  x: number
  y: number
  previousX: number
  previousY: number
  hp: number
  maxHp: number
  shield: number
  maxShield: number
  speed: number
  xp: number
  xpToNext: number
  level: number
  pulseCharge: number
}

interface EnemyEntity {
  active: boolean
  uid: number
  id: EnemyId
  x: number
  y: number
  previousX: number
  previousY: number
  vx: number
  vy: number
  radius: number
  speed: number
  hp: number
  maxHp: number
  damage: number
  xp: number
  contactCooldown: number
  hitFlash: number
  hitMotionRemaining: number
  hitMotionDuration: number
  deathMotionRemaining: number
  deathMotionDuration: number
  reactionAngle: number
  pendingContactDamage: number
  blinkTargetX: number | null
  blinkTargetY: number | null
  isBoss: boolean
  phase: number
  attackTimer: number
  facing: -1 | 1
  baseScaleX: number
  baseScaleY: number
  attackMotionStyle: AttackMotionStyle
  attackMotionRemaining: number
  attackMotionDuration: number
  attackMotionAngle: number
  sprite: Sprite
}

interface ProjectileEntity {
  active: boolean
  x: number
  y: number
  previousX: number
  previousY: number
  vx: number
  vy: number
  radius: number
  damage: number
  bossDamage: number
  life: number
  pierce: number
  homing: number
  weaponId: WeaponId
  color: number
  totalLife: number
  visualState: WeaponVfxState
  visualSeed: number
  hitIds: number[]
  sprite: Sprite
}

interface PickupEntity {
  active: boolean
  kind: 'xp' | SupportPickupKind
  x: number
  y: number
  previousX: number
  previousY: number
  value: number
  age: number
  lifetime: number
  visualSeed: number
  sprite: Sprite
}

interface ParticleEntity {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  total: number
  spin: number
  sprite: Sprite
}

interface TelegraphEntity {
  active: boolean
  kind: 'circle' | 'line'
  x: number
  y: number
  radius: number
  angle: number
  length: number
  width: number
  life: number
  total: number
  damage: number
  bossAttack: boolean
  color?: number
}

interface RuntimeHostileProjectile {
  state: HostileProjectileState
  palette: HostileTelegraphMaterialPalette
}

interface RingEffect {
  x: number
  y: number
  radius: number
  maxRadius: number
  life: number
  total: number
  color: number
  width: number
}

interface LoopEffect {
  points: Vec2[]
  life: number
  total: number
  color: number
  closed?: boolean
  width?: number
}

interface MotionEchoEntity {
  active: boolean
  x: number
  y: number
  driftX: number
  driftY: number
  life: number
  total: number
  baseAlpha: number
  baseScaleX: number
  baseScaleY: number
  rotation: number
  sprite: Sprite
}

type WeaponEffectKind =
  | 'helio-gate'
  | 'helio-impact'
  | 'crescent-orbit'
  | 'crescent-impact'
  | 'arc-chain'
  | 'rift-cast'
  | 'rift-impact'
  | 'comet-launch'
  | 'comet-impact'
  | 'graveglass-eruption'
  | 'mirror-gate'
  | 'mirror-impact'
  | 'eclipse-harrow'

interface WeaponEffectEntity {
  kind: WeaponEffectKind
  weaponId: WeaponId
  visualState: WeaponVfxState
  x: number
  y: number
  angle: number
  radius: number
  maxRadius: number
  life: number
  total: number
  seed: number
  points?: Vec2[]
  pattern?: ReplacementWeaponPattern<number>
  hitPulseLife?: number
  hitPulseTotal?: number
}

const canvasHostStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  touchAction: 'none',
  background: '#03070c',
}

const backgroundForLevel = (levelId: number) => {
  if ([2, 5, 7].includes(levelId)) return appAssetUrl('assets/glassreed-mire-arena.webp')
  if ([6, 8, 10].includes(levelId)) return appAssetUrl('assets/cinder-foundry-arena.webp')
  return appAssetUrl('assets/first-beacon-arena.webp')
}

class NighttraceRuntime {
  private readonly host: HTMLDivElement
  private readonly level: LevelDefinition
  private readonly bossLevel: LevelDefinition
  private readonly runConfig: RunConfig
  private readonly unlockedWeapons: WeaponId[]
  private readonly persistentUpgrades: Record<string, number>
  private readonly callbacks: RuntimeCallbacks
  private readonly app = new Application()
  private readonly world = new Container()
  private readonly trailLayer = new Container()
  private readonly threatGroundLayer = new Container()
  private readonly groundedVfxMaterialLayer = new Container()
  private readonly weaponMaterialLayer = new Container()
  private readonly pickupLayer = new Container()
  private readonly enemyMaterialLayer = new Container()
  private readonly enemyLayer = new Container()
  private readonly enemyForegroundLayer = new Container()
  private readonly projectileLayer = new Container()
  private readonly actorLayer = new Container()
  private readonly effectLayer = new Container()
  private readonly motionEchoLayer = new Container()
  private readonly trailGlow = new Graphics()
  private readonly trailCore = new Graphics()
  private readonly pickupAuraGraphics = new Graphics()
  private readonly loopGraphics = new Graphics()
  private readonly groundedVfxSmokeGraphics = new Graphics()
  private readonly groundedVfxDustGraphics = new Graphics()
  private readonly groundedVfxCinderGraphics = new Graphics()
  private readonly motionGraphics = new Graphics()
  private readonly projectileTrailGraphics = new Graphics()
  private readonly hostileProjectileGraphics = new Graphics()
  private readonly weaponVfxAdditiveGraphics = new Graphics()
  private readonly weaponVfxGraphics = new Graphics()
  private readonly screenEffects = new Container()
  private readonly screenFlash = new Graphics()
  private readonly cinematicGraphics = new Graphics()
  private readonly cinematicTitle = new Text({
    text: '',
    style: {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: 30,
      fontWeight: '600',
      letterSpacing: 8,
      fill: 0xffd978,
      align: 'center',
      dropShadow: { color: 0x000000, alpha: 0.9, blur: 8, distance: 2 },
    },
  })
  private readonly joystickGraphics = new Graphics()
  private readonly audio: NighttraceAudio
  private input?: GameInput
  private resizeObserver?: ResizeObserver
  private hero?: Sprite
  private heroWalkFrames: Texture[] = []
  private heroFireFrames: Texture[] = []
  private heroChargeFrames: Texture[] = []
  private enemyMotionFrames: [Texture[], Texture[]] = [[], []]
  private bossFrames: Texture[] = []
  private bossMotionFrames: [Texture[], Texture[]] = [[], []]
  private pickupFrames: Texture[] = []
  private readonly projectileTextures = new Map<WeaponId, Texture>()
  private graveglassSpireTexture?: Texture
  private eclipseGateTexture?: Texture
  private eclipseCathedralTexture?: Texture
  private hostileGroundFieldTexture?: Texture
  private hostileGroundLaneTexture?: Texture
  private heroPowerMaterialFrames: Texture[] = []
  private readonly authoredSpellMaterialSprites: Sprite[] = []
  private authoredSpellMaterialCursor = 0
  private readonly groundedVfxMaterialSprites: Sprite[] = []
  private groundedVfxMaterialCursor = 0
  private groundedVfxParticleBudget = 0
  private sparkTexture = Texture.WHITE
  private background?: Sprite
  private settings: GameSettings
  private readonly visualLod: CharacterVisualLod
  private readonly visualProfile: CharacterVisualProfile
  private destroyed = false
  private applicationReady = false
  private initialized = false
  private accumulator = 0
  private interpolation = 0
  private elapsed = 0
  private snapshotClock = 0
  private manualPaused = false
  private visibilityPaused = false
  private orientationPaused = false
  private upgradeOptions?: UpgradeOption[]
  private upgradeSeed: number
  private rerollsUsed = 0
  private readonly rerollLimit: number
  private readonly rerollExclusions = new Set<string>()
  private completed = false
  private completionSent = false
  private kills = 0
  private closedLoops = 0
  private largestChain = 0
  private primedTracePulseBonus = 0
  private readonly showcase = currentLocalWeaponShowcase()
  private showcaseFrozen = false
  private weapons: OwnedWeapon[] = []
  private modules: OwnedModule[] = []
  private traceMods: TraceModId[] = []
  private readonly weaponDamage = new Map<WeaponId, number>()
  private readonly random: DeterministicRandom
  private readonly enemies: EnemyEntity[] = []
  private readonly projectiles: ProjectileEntity[] = []
  private readonly pickups: PickupEntity[] = []
  private readonly particles: ParticleEntity[] = []
  private readonly motionEchoes: MotionEchoEntity[] = []
  private readonly telegraphs: TelegraphEntity[] = []
  private readonly hostileProjectiles: RuntimeHostileProjectile[] = []
  private activeTelegraphCount = 0
  private readonly enemyGrid = new Map<number, EnemyEntity[]>()
  private readonly gridBuckets: EnemyEntity[][] = []
  private readonly rings: RingEffect[] = []
  private readonly loopEffects: LoopEffect[] = []
  private readëÎ|êÚ$z{-®éÜj×vçVÆÂÖ&VÆÂs¢³#ÂUÒÀ¢Õ·&ö¦V7F–ÆRçvVöä–EĞ¢6öç7B&öf–ÆRÒvVöåfg…&öf–ÆR‡&ö¦V7F–ÆRçvVöä–BÂ&ö¦V7F–ÆRçf—7VÅ7FFR¢6öç7B7FvRÒF†—2çfg…7FvT–æFW‚‡&ö¦V7F–ÆRçf—7VÅ7FFRç7FvR¢6öç7BÆVæwF‚Ò&6UG&–Å³Ò¢&öf–ÆRçG&–ÄÆVæwF…66ÆP¢6öç7Bv–GF‚Ò&6UG&–Å³Ò¢&öf–ÆRçG&–Åv–GF…66ÆP¢6öç7B7F'E‚Ò‚ÒG‚¢ÆVæwF€¢6öç7B7F'E’Ò’ÒG’¢ÆVæwF€¢6öç7Bw&†–72ÒF†—2ç&ö¦V7F–ÆUG&–Äw&†–70 ¢–b‡&ö¦V7F–ÆRçvVöä–BÓÓÒw&–gB×6VVG2r’°¢6öç7BVÇ6RÒ²ÖF‚ç6–â‡F†—2æÖ÷F–öä6Æö6²¢‚²&ö¦V7F–ÆRçf—7VÅ6VVB’¢ã€¢6öç7B6÷&U&F—W2Òƒ’²7FvR¢ã‚’¢VÇ6P¢w&†–70¢æ6—&6ÆR‡‚Â’Â6÷&U&F—W2¢æf–ÆÂ‡²6öÆ÷#¢ƒc’ÂÇ†¢ã“BÒ¢6öç7BFV'&—46÷VçBÒ"²7FvP¢f÷"†ÆWBFV'&—2Ò²FV'&—2ÂFV'&—46÷VçC²FV'&—2³Ò’°¢6öç7BævÆRĞ¢F†—2æÖ÷F–öä6Æö6²¢ƒãr²FV'&—2¢ã’’°¢&ö¦V7F–ÆRçf—7VÅ6VVB¢ãr°¢&WÆ6VÖVçD6÷6ÖWF–5Væ—B‡&ö¦V7F–ÆRçf—7VÅ6VVBÂFV'&—2Â“r’¢ÖF‚å’¢ ¢6öç7BF—7Fæ6RĞ¢6÷&U&F—W2 ¢ƒã²&WÆ6VÖVçD6÷6ÖWF–5Væ—B‡&ö¦V7F–ÆRçf—7VÅ6VVBÂFV'&—2Â’¢ã"¢w&†–70¢æVÆÆ—6R€¢‚²ÖF‚æ6÷2†ævÆR’¢F—7Fæ6RÀ¢’²ÖF‚ç6–â†ævÆR’¢F—7Fæ6R¢ãcBÀ¢ãB²7FvR¢ã3BÀ¢ã‚²7FvR¢ãbÀ¢¢æf–ÆÂ‡°¢6öÆ÷#¢FV'&—2R"ò&öf–ÆRç6V6öæF'”6öÆ÷"¢&öf–ÆRæ66VçD6öÆ÷"À¢Ç†¢ã3BÀ¢Ò¢Ğ¢&WGW&à¢Ğ ¢6öç7BG&–Åö–çG3¢fV3%µÒÒµĞ¢6öç7Bö–çD6÷VçBĞ¢&ö¦V7F–ÆRçvVöä–BÓÓÒv6öÖWB×7v&ÒrÇÂ&ö¦V7F–ÆRçvVöä–BÓÓÒv7&W66VçBÖ'&’p¢òp¢¢ ¢f÷"†ÆWB–æFW‚Ò²–æFW‚Âö–çD6÷VçC²–æFW‚³Ò’°¢6öç7BBÒ–æFW‚òÖF‚æÖ‚ƒÂö–çD6÷VçBÒ¢6öç7B7W'fRĞ¢ö–çD6÷VçBâ ¢òÖF‚ç6–â‡B¢ÖF‚å’’ ¢‡&ö¦V7F–ÆRçvVöä–BÓÓÒv6öÖWB×7v&ÒròR²7FvR¢ã‚¢2²7FvR¢¢ ¢6öç7BF—&V7F–öâÒ&ö¦V7F–ÆRçf—7VÅ6VVBR"ò¢Ó¢G&–Åö–çG2çW6‚‡°¢ƒ¢ÆW'‡7F'E‚Â‚ÂB’²æ÷&ÖÅ‚¢7W'fR¢F—&V7F–öâÀ¢“¢ÆW'‡7F'E’Â’ÂB’²æ÷&ÖÅ’¢7W'fR¢F—&V7F–öâÀ¢Ò¢Ğ¢F†—2æG&uöÇ–Æ–æR†w&†–72ÂG&–Åö–çG2Â&öf–ÆRævÆ÷t6öÆ÷"Âv–GF‚¢BãBÂã“R¢F†—2æG&uöÇ–Æ–æR†w&†–72ÂG&–Åö–çG2Â&öf–ÆRæ66VçD6öÆ÷"Âv–GF‚¢"ãÂã3B¢F†—2æG&uöÇ–Æ–æR†w&†–72ÂG&–Åö–çG2Â&öf–ÆRæ6÷&T6öÆ÷"Âv–GF‚Âãƒ‚ ¢–b‡&ö¦V7F–ÆRçvVöä–BÓÓÒv†VÆ–òÖÆæ6Rr’°¢&WGW&à¢Ğ ¢–b‡&ö¦V7F–ÆRçvVöä–BÓÓÒv7&W66VçBÖ'&’r’°¢&WGW&à¢Ğ ¢–b‡&ö¦V7F–ÆRçvVöä–BÓÓÒv&2Ö6†ö—"r’°¢6öç7BÆ–v‡Fæ–ærÒF†—2æ'V–ÆDÆ–v‡Fæ–æuö–çG2€¢°¢²ƒ¢7F'E‚Â“¢7F'E’ÒÀ¢²‚Â’ÒÀ¢ÒÀ¢&ö¦V7F–ÆRçf—7VÅ6VVBÀ¢6Æ×ƒÒ&ö¦V7F–ÆRæÆ–fRò&ö¦V7F–ÆRçF÷FÄÆ–fRÂÂ’À¢¢F†—2æG&uöÇ–Æ–æR†w&†–72ÂÆ–v‡Fæ–ærÂ&öf–ÆRæ6÷&T6öÆ÷"ÂãR²7FvR¢ã"Âã’¢&WGW&à¢Ğ ¢–b‡&ö¦V7F–ÆRçvVöä–BÓÓÒv6öÖWB×7v&Òr’°¢6öç7BVÖ&W'2Ò"²7FvP¢f÷"†ÆWB–æFW‚Ò²–æFW‚ÃÒVÖ&W'3²–æFW‚³Ò’°¢6öç7BBÒ–æFW‚ò†VÖ&W'2²¢6öç7BVÖ&W%‚ÒÆW'‡‚Â7F'E‚ÂB¢6öç7BVÖ&W%’ÒÆW'‡’Â7F'E’ÂB¢F†—2ç&ö¦V7F–ÆUG&–Äw&†–70¢æ6—&6ÆR†VÖ&W%‚ÂVÖ&W%’Â2ãÒB¢ãb²7FvR¢ã#"¢æf–ÆÂ‡°¢6öÆ÷#¢–æFW‚R"ò&öf–ÆRç6V6öæF'”6öÆ÷"¢&öf–ÆRæ66VçD6öÆ÷"À¢Ç†¢ãS"ÒB¢ã#"À¢Ò¢Ğ¢&WGW&à¢Ğ ¢–b‡&ö¦V7F–ÆRçvVöä–BÓÓÒvÖ—'&÷"Ö&÷rr’°¢&WGW&à¢Ğ ¢–b‡&ö¦V7F–ÆRçvVöä–BÓÓÒv6‚Ö†Æòr’°¢&WGW&à¢Ğ ¢–b‡&ö¦V7F–ÆRçvVöä–BÓÓÒvçVÆÂÖ&VÆÂr’°¢&WGW&à¢Ğ¢Ğ ¢&—fFR7&VFUfg…FW‡GW&W2‚’°¢6öç7B7&VFRÒ‡vVöä–C¢vVöä–BÂG&s¢†w&†–73¢w&†–72Â6öÆ÷#¢çVÖ&W"’Óâfö–B’Óâ°¢6öç7Bw&†–72ÒæWrw&†–72‚¢G&r†w&†–72ÂtTôå5·vVöä–EÒæ6öÆ÷"¢6öç7BFW‡GW&RÒF†—2æç&VæFW&W"ævVæW&FUFW‡GW&R‡°¢F&vWC¢w&†–72À¢&W6öÇWF–öã¢F†—2çf—7VÅ&öf–ÆRævVæW&FVEFW‡GW&U&W6öÇWF–öâÀ¢çF–Æ–3¢F†—2çf—7VÅ&öf–ÆRç&VæFW&W$çF–Æ–2À¢Ò¢F†—2ç&ö¦V7F–ÆUFW‡GW&W2ç6WB‡vVöä–BÂFW‡GW&R¢w&†–72æFW7G&÷’‚¢Ğ ¢7&VFR‚v†VÆ–òÖÆæ6RrÂ†w&†–72Â6öÆ÷"’Óâ°¢w&†–72çöÇ’…³ÂBÂCbÂÂs‚ÂBÂCbÂ#uÒÂG'VR’æf–ÆÂ‡²6öÆ÷"ÂÇ†¢ã#"Ò¢w&†–72çöÇ’…³’ÂBÂC’ÂrÂs‚ÂBÂC’Â#ÒÂG'VR’æf–ÆÂ‡²6öÆ÷#¢†ffCVbÂÇ†¢ãrÒ¢w&†–72çöÇ’…³bÂBÂSRÂÂs‚ÂBÂSRÂ…ÒÂG'VR’æf–ÆÂ‡²6öÆ÷#¢†ffc–F2ÂÇ†¢ã“‚Ò¢w&†–72çöÇ’…³#‚ÂRÂC2Â’Â3bÂBÂC2Â’Â#‚Â#2Â3BÂEÒÂG'VR’æf–ÆÂ‡²6öÆ÷#¢ƒsfcVFbÂÇ†¢ãc‚Ò¢Ò¢7&VFR‚v7&W66VçBÖ'&’rÂ†w&†–72Â6öÆ÷"’Óâ°¢w&†–70¢æÖ÷fUFòƒRÂ#"¢çVG&F–47W'fUFòƒ3ÂÓrÂSRÂ#"¢ç7G&ö¶R‡²6öÆ÷"Âv–GFƒ¢2ÂÇ†¢ãbÂ6¢w&÷VæBrÒ¢w&†–70¢æÖ÷fUFòƒRÂ#"¢çVG&F–47W'fUFòƒ3ÂÓrÂSRÂ#"¢ç7G&ö¶R‡²6öÆ÷"Âv–GFƒ¢bãRÂÇ†¢ãs‚Â6¢w&÷VæBrÒ¢w&†–70¢æÖ÷fUFòƒRÂ#"¢çVG&F–47W'fUFòƒ3ÂÓrÂSRÂ#"¢ç7G&ö¶R‡²6öÆ÷#¢†c&fffbÂv–GFƒ¢"ÂÇ†¢ã“bÂ6¢w&÷VæBrÒ¢w&†–72æ6—&6ÆRƒ3ÂRÂ"ãB’æf–ÆÂ‡²6öÆ÷#¢†#†6fbÂÇ†¢ãs"Ò¢Ò¢7&VFR‚v&2Ö6†ö—"rÂ†w&†–72Â6öÆ÷"’Óâ°¢w&†–70¢çöÇ’…³ÂBÂRÂRÂ#RÂÂ3’Â"Â3BÂ2ÂS‚Â‚Â3‚Â#"Â#BÂeÒÂG'VR¢æf–ÆÂ‡²6öÆ÷"ÂÇ†¢ãCbÒ¢w&†–70¢çöÇ’…³BÂBÂ‚Â’Â#RÂ2Â3‚ÂrÂ3BÂRÂS"ÂrÂ3rÂ’Â#BÂUÒÂG'VR¢æf–ÆÂ‡²6öÆ÷#¢†fcFfbÂÇ†¢ã’Ò¢Ò¢7&VFR‚w&–gB×6VVG2rÂ†w&†–72Â6öÆ÷"’Óâ°¢w&†–72æ6—&6ÆRƒ’Â’ÂR’æf–ÆÂ‡²6öÆ÷#¢ƒs‚ÂÇ†¢ã“‚Ò¢w&†–72æVÆÆ—6RƒRÂ"ÂRÂ2’æf–ÆÂ‡²6öÆ÷"ÂÇ†¢ãsBÒ¢w&†–72æVÆÆ—6Rƒ#RÂ#RÂ2ãRÂ"’æf–ÆÂ‡²6öÆ÷#¢ƒ“#sffbÂÇ†¢ãSbÒ¢Ò¢7&VFR‚v6öÖWB×7v&ÒrÂ†w&†–72Â6öÆ÷"’Óâ°¢w&†–72çöÇ’…³ÂbÂ3Â2ÂS"ÂbÂ3Â#•ÒÂG'VR’æf–ÆÂ‡²6öÆ÷"ÂÇ†¢ã#‚Ò¢w&†–72çöÇ’…³bÂbÂ3BÂ‚ÂSÂbÂ3BÂ#EÒÂG'VR’æf–ÆÂ‡²6öÆ÷#¢†ffC#VBÂÇ†¢ãc"Ò¢w&†–72æVÆÆ—6RƒC2ÂbÂ"Â’æf–ÆÂ‡²6öÆ÷"ÂÇ†¢ã’Ò¢w&†–72æVÆÆ—6RƒCbÂ2ÂbÂR’æf–ÆÂ‡²6öÆ÷#¢†ffcFFRÂÇ†¢ã“‚Ò¢Ò¢7&VFR‚v6‚Ö†ÆòrÂ†w&†–72Â6öÆ÷"’Óâ°¢w&†–70¢çöÇ’…³ÂBÂBÂ2Â3BÂrÂC‚ÂBÂ3BÂ#ÂBÂ#UÒÂG'VR¢æf–ÆÂ‡²6öÆ÷"ÂÇ†¢ã#‚Ò¢w&†–70¢çöÇ’…³bÂBÂ#ÂrÂCRÂBÂ#Â#ÒÂG'VR¢æf–ÆÂ‡²6öÆ÷#¢†ffCfÂÇ†¢ã‚Ò¢w&†–70¢çöÇ’…³BÂBÂ#bÂÂCbÂBÂ#bÂuÒÂG'VR¢æf–ÆÂ‡²6öÆ÷#¢†ffc&3’ÂÇ†¢ã“‚Ò¢Ò¢7&VFR‚vÖ—'&÷"Ö&÷rrÂ†w&†–72Â6öÆ÷"’Óâ°¢w&†–72çöÇ’…³ÂbÂ#ÂÂcRÂ‚Âƒ"ÂbÂcRÂ#BÂ#Â3ÒÂG'VR’æf–ÆÂ‡²6öÆ÷"ÂÇ†¢ã#BÒ¢w&†–72çöÇ’…³’ÂbÂ3ÂrÂsÂ2Âs’ÂbÂsÂ’Â3Â#UÒÂG'VR’æf–ÆÂ‡²6öÆ÷#¢†fffffbÂÇ†¢ã“"Ò¢w&†–72çöÇ’…³3BÂRÂC"ÂbÂ3BÂ#rÂ#‚ÂeÒÂG'VR’æf–ÆÂ‡²6öÆ÷#¢†3“ffbÂÇ†¢ãc"Ò¢Ò¢7&VFR‚vçVÆÂÖ&VÆÂrÂ†w&†–72Â6öÆ÷"’Óâ°¢w&†–70¢çöÇ’…³BÂ#RÂ’ÂÂRÂBÂ#rÂBÂ32ÂÂ3‚Â#RÂ3Â3ÂÂ3ÒÂG'VR¢æf–ÆÂ‡²6öÆ÷#¢ƒ#C#ÂÇ†¢ã“BÒ¢w&†–70¢çöÇ’…³‚Â#BÂ2ÂÂ‚ÂrÂ#RÂrÂ3Â"Â3BÂ#BÂ#’Â#rÂ2Â#uÒÂG'VR¢æf–ÆÂ‡²6öÆ÷"ÂÇ†¢ãs"Ò¢w&†–70¢çöÇ’…³#Â#RÂ#rÂ3BÂ#ÂCÂRÂ3EÒÂG'VR¢æf–ÆÂ‡²6öÆ÷#¢†ccfbÂÇ†¢ã“bÒ¢w&†–70¢çöÇ’…³Â‚Â#ÂÂ3Â‚Â#Â#5ÒÂG'VR¢æf–ÆÂ‡²6öÆ÷#¢†#ffbÂÇ†¢ãCbÒ¢Ò ¢6öç7B7&²ÒæWrw&†–72‚¢7&°¢çöÇ’…³"Â‚Â‚Â"ÂrÂRÂ#Â"Â2Â’ÂRÂeÒÂG'VR¢æf–ÆÂ‡²6öÆ÷#¢†fffffbÂÇ†¢ãƒ"Ò¢F†—2ç7&µFW‡GW&RÒF†—2æç&VæFW&W"ævVæW&FUFW‡GW&R‡°¢F&vWC¢7&²À¢&W6öÇWF–öã¢F†—2çf—7VÅ&öf–ÆRævVæW&FVEFW‡GW&U&W6öÇWF–öâÀ¢çF–Æ–3¢F†—2çf—7VÅ&öf–ÆRç&VæFW&W$çF–Æ–2À¢Ò¢7&²æFW7G&÷’‚¢Ğ ¢&—fFR&÷75F–çB‚’°¢&WGW&â†fffff`¢Ğ ¢&—fFRÆWfVÅW‚’°¢F†—2çÆ–W"ç‡ÓÒF†—2çÆ–W"ç‡FôæW‡@¢F†—2çÆ–W"æÆWfVÂ³Ò¢F†—2çÆ–W"ç‡FôæW‡BÒW‡W&–Væ6UFôæW‡DÆWfVÂ‡F†—2çÆ–W"æÆWfVÂ¢F†—2ç&W&öÆÄW†6ÇW6–öç2æ6ÆV"‚¢6öç7BG&gBÒ7&VFUWw&FTG&gB‡F†—2ævWEWw&FT6öçFW‡B‚’ÂF†—2çWw&FU6VVB¢F†—2çWw&FT÷F–öç2ÒG&gBæ÷F–öç0¢F†—2çWw&FU6VVBÒG&gBç6VV@¢F†—2ç&W&öÆÇ5W6VBÒG&gBç&W&öÆÇ5W6V@¢F†—2æVF–òçÆ’‚wWw&FRr¢F†—2æVÖ—E6æ6†÷B‡G'VR¢Ğ ¢&—fFRvWEWw&FT6öçFW‡B‚“¢Ww&FTG&gD6öçFW‡B°¢&WGW&â°¢vVöç3¢F†—2çvVöç2æÖ‚‡vVöâ’Óâ‡²ââçvVöâÒ’’À¢ÖöGVÆW3¢F†—2æÖöGVÆW2æÖ‚†ÖöGVÆR’Óâ‡²ââæÖöGVÆRÒ’’À¢G&6TÖöG3¢²ââçF†—2çG&6TÖöG5ÒÀ¢VæÆö6¶VEvVöç3¢F†—2çVæÆö6¶VEvVöç2À¢‡¢F†—2çÆ–W"æ‡À¢Ö„‡¢F†—2çÆ–W"æÖ„‡À¢6†–VÆC¢F†—2çÆ–W"ç6†–VÆBÀ¢Ö…6†–VÆC¢F†—2çÆ–W"æÖ…6†–VÆBÀ¢&W&öÆÇ5W6VC¢F†—2ç&W&öÆÇ5W6VBÀ¢&W&öÆÄÆ–Ö—C¢F†—2ç&W&öÆÄÆ–Ö—BÀ¢Ğ¢Ğ ¢&—fFR7&VFU6æ6†÷B‚“¢vÖU6æ6†÷B°¢6öç7B&VÖ–æ–ærÒÖF‚æÖ‚ƒÂF†—2æÆWfVÂæGW&F–öâÒF†—2æVÆ6VB¢6öç7B&÷72ÒF†—2æ&÷73òæ7F—fP¢ò°¢æÖS¢F†—2æ&÷74ÆWfVÂæ&÷74æÖRÀ¢‡¢ÖF‚æÖ‚ƒÂF†—2æ&÷72æ‡’À¢Ö„‡¢F†—2æ&÷72æÖ„‡À¢†6S¢F†—2æ&÷72ç†6RÀ¢Ğ¢¢VæFVf–æV@¢&WGW&â°¢'VäÖöFS¢F†—2ç'Vä6öæf–ræÖöFRÀ¢–çf–æ6–&ÆS¢F†—2ç'Vä6öæf–ræ–çf–æ6–&ÆRÀ¢v—F–æu7F'C¢F†—2æv—F–æu7F'BÀ¢‡¢F†—2çÆ–W"æ‡À¢Ö„‡¢F†—2çÆ–W"æÖ„‡À¢6†–VÆC¢F†—2çÆ–W"ç6†–VÆBÀ¢Ö…6†–VÆC¢F†—2çÆ–W"æÖ…6†–VÆBÀ¢‡¢F†—2çÆ–W"ç‡À¢‡FôæW‡C¢F†—2çÆ–W"ç‡FôæW‡BÀ¢ÆWfVÃ¢F†—2çÆ–W"æÆWfVÂÀ¢VÆ6VC¢F†—2æVÆ6VBÀ¢GW&F–öã¢F†—2æÆWfVÂæGW&F–öâÀ¢¶–ÆÇ3¢F†—2æ¶–ÆÇ2À¢VÇ6T6†&vS¢F†—2çÆ–W"çVÇ6T6†&vRÀ¢VÇ6U&VG“¢F†—2çÆ–W"çVÇ6T6†&vRãÒÀ¢6Æ÷6VDÆö÷3¢F†—2æ6Æ÷6VDÆö÷2À¢Æ&vW7D6†–ã¢F†—2æÆ&vW7D6†–âÀ¢&÷72À¢æW‡DWfVçC¢&÷70¢ò„4RG¶&÷72ç†6WÒ+r%$T²D„R4õdU$T”tæ ¢¢F†—2æ&÷757væVBbb&VÖ–æ–ærâc ¢òuD„R„õ$DRDTUTå2p¢¢t$õ524”täEU$R$ô4„”ärrÀ¢vVöç3¢F†—2çvVöç2æÖ‚‡vVöâ’Óâ‡²ââçvVöâÒ’’À¢ÖöGVÆW3¢F†—2æÖöGVÆW2æÖ‚†ÖöGVÆR’Óâ‡²ââæÖöGVÆRÒ’’À¢G&6TÖöG3¢²ââçF†—2çG&6TÖöG5ÒÀ¢Ww&FT÷F–öç3¢F†—2çWw&FT÷F–öç3òæÖ‚†÷F–öâ’Óâ‡²ââæ÷F–öâÒ’’À¢&W&öÆÇ5&VÖ–æ–æs¢ÖF‚æÖ‚ƒÂF†—2ç&W&öÆÄÆ–Ö—BÒF†—2ç&W&öÆÇ5W6VB’À¢&Wf—fUVæF–æs¢F†—2ç&Wf—fUVæF–ærÀ¢&Wf—fW5&VÖ–æ–æs¢F†—2ç&Wf—fW5&VÖ–æ–ærÀ¢GWF÷&–Ã ¢F†—2ç6†÷v66P¢ò6†÷v66TÆ&VÂ‡F†—2ç6†÷v66R¢¢F†—2æVÆ6VBÂ ¢òtÔõdRDòE$rE$4R+r4Äõ4RD„RÄ”äRDòDUDôäDR+r54Rd•$U2D„RDtâTÅ4Rp¢¢VæFVf–æVBÀ¢W6VC¢F†—2æ—5W6VB‚’À¢Ğ¢Ğ ¢&—fFRVÖ—E6æ6†÷B†f÷&6RÒfÇ6R’°¢–b‚F†—2æ–æ—F–Æ—¦VBÇÂF†—2æFW7G&÷–VB’&WGW&à¢–b†f÷&6R’F†—2ç6æ6†÷D6Æö6²Ò ¢F†—2æ6ÆÆ&6·2æöå6æ6†÷B‡F†—2æ7&VFU6æ6†÷B‚’¢Ğ ¢&—fFR—5W6VB‚’°¢&WGW&â€¢F†—2æÖçVÅW6VBÇÀ¢F†—2çf—6–&–Æ—G•W6VBÇÀ¢F†—2æ÷&–VçFF–öåW6VBÇÀ¢F†—2ç&Wf—fUVæF–ærÇÀ¢&ööÆVâ‡F†—2çWw&FT÷F–öç3òæÆVæwF‚¢¢Ğ ¢&—fFR6Æ–6UFW‡GW&R‡FW‡GW&S¢FW‡GW&RÂ6öÇVÖç3¢çVÖ&W"Â&÷w3¢çVÖ&W"’°¢6öç7Bg&ÖW3¢FW‡GW&UµÒÒµĞ¢f÷"†ÆWB&÷rÒ²&÷rÂ&÷w3²&÷r³Ò’°¢f÷"†ÆWB6öÇVÖâÒ²6öÇVÖâÂ6öÇVÖç3²6öÇVÖâ³Ò’°¢òòWF†÷&–ærFööÇ26âVÖ—BFÆ6W2v†÷6R÷fW&ÆÂF–ÖVç6–öç2&Ræ÷@¢òòW&fV7FÇ’F—f—6–&ÆR'’F†Rw&–Bâ6æWfW'’&÷VæF'’–æFWVæFVçFÇ¢òò6ò—†’æWfW"6×ÆW2g&7F–öæÂFW†VÂg&öÒF†RæV–v†&÷&–ær÷6Rà¢6öç7BÆVgBÒÖF‚ç&÷VæB‚†6öÇVÖâ¢FW‡GW&Rçv–GF‚’ò6öÇVÖç2¢6öç7B&–v‡BÒÖF‚ç&÷VæB‚‚†6öÇVÖâ²’¢FW‡GW&Rçv–GF‚’ò6öÇVÖç2¢6öç7BF÷ÒÖF‚ç&÷VæB‚‡&÷r¢FW‡GW&Ræ†V–v‡B’ò&÷w2¢6öç7B&÷GFöÒÒÖF‚ç&÷VæB‚‚‡&÷r²’¢FW‡GW&Ræ†V–v‡B’ò&÷w2¢g&ÖW2çW6‚€¢æWrFW‡GW&R‡°¢6÷W&6S¢FW‡GW&Rç6÷W&6RÀ¢g&ÖS¢æWr&V7FævÆR†ÆVgBÂF÷Â&–v‡BÒÆVgBÂ&÷GFöÒÒF÷’À¢Ò’À¢¢Ğ¢Ğ¢&WGW&âg&ÖW0¢Ğ ¢&—fFR&÷74Ö÷F–öåFW‡GW&R†g&ÖS¢&W6öÇfVD&÷746Æ—g&ÖR’°¢&WGW&âF†—2æ&÷74Ö÷F–öäg&ÖW5¶g&ÖRæFÆ4–æFW…Óòå¶g&ÖRæg&ÖT–æFW…Ğ¢Ğ ¢&—fFRVæV×”Ö÷F–öåFW‡GW&R†g&ÖS¢&W6öÇfVDVæV×”6Æ—g&ÖR’°¢&WGW&âF†—2æVæV×”Ö÷F–öäg&ÖW5¶g&ÖRæFÆ4–æFW…Óòå¶g&ÖRæg&ÖT–æFW…Ğ¢Ğ ¢&—fFR†æFÆUf—6–&–Æ—G’Ò‚’Óâ°¢F†—2çf—6–&–Æ—G•W6VBÒFö7VÖVçBæ†–FFVà¢F†—2æVÖ—E6æ6†÷B‡G'VR¢Ğ§Ğ ¦6öç7BvÖT6çf2Òf÷'v&E&VcÄvÖT6çf4†æFÆRÂvÖT6çf5&÷3â†gVæ7F–öâvÖT6çf2€¢°¢ÆWfVÂÀ¢'Vä6öæf–rÀ¢6WGF–æw2À¢VæÆö6¶VEvVöç2À¢W'6—7FVçEWw&FW2À¢÷&–VçFF–öåW6VBÀ¢öå6æ6†÷BÀ¢öä6ö×ÆWFRÀ¢öäW†—BÀ¢ÒÀ¢&VbÀ¢’°¢6öç7B†÷7E&VbÒW6U&VcÄ…DÔÄF—dVÆVÖVçCâ†çVÆÂ¢6öç7B'VçF–ÖU&VbÒW6U&VcÄæ–v‡GG&6U'VçF–ÖRÂVæFVf–æVCâ‡VæFVf–æVB¢6öç7B6ÆÆ&6·5&VbÒW6U&Vb‡²öå6æ6†÷BÂöä6ö×ÆWFRÂöäW†—BÒ¢6öç7B–æ—F–Ä6öæf–u&VbÒW6U&Vb‡°¢ÆWfVÂÀ¢'Vä6öæf–rÀ¢6WGF–æw2À¢VæÆö6¶VEvVöç2À¢W'6—7FVçEWw&FW2À¢Ò¢6ÆÆ&6·5&Vbæ7W'&VçBÒ²öå6æ6†÷BÂöä6ö×ÆWFRÂöäW†—BĞ ¢W6T–×W&F—fT†æFÆR€¢&VbÀ¢‚’Óâ‡°¢&Vv–äVæ6÷VçFW#¢‚’Óâfö–B'VçF–ÖU&Vbæ7W'&VçCòæ&Vv–äVæ6÷VçFW"‚’À¢&Wf—fS¢‚’Óâ'VçF–ÖU&Vbæ7W'&VçCòç&Wf—fR‚’À¢FV6Æ–æU&Wf—fS¢‚’Óâ'VçF–ÖU&Vbæ7W'&VçCòæFV6Æ–æU&Wf—fR‚’À¢6VÆV7EWw&FS¢†÷F–öä–B’Óâ'VçF–ÖU&Vbæ7W'&VçCòç6VÆV7EWw&FR†÷F–öä–B’À¢&W&öÆÅWw&FS¢‚’Óâ'VçF–ÖU&Vbæ7W'&VçCòç&W&öÆÅWw&FR‚’À¢FövvÆUW6S¢‚’Óâ'VçF–ÖU&Vbæ7W'&VçCòçFövvÆUW6R‚’À¢7F—fFUVÇ6S¢‚’Óâ'VçF–ÖU&Vbæ7W'&VçCòæ7F—fFUVÇ6R‚’À¢6WD÷&–VçFF–öåW6VC¢‡W6VB’Óâ'VçF–ÖU&Vbæ7W'&VçCòç6WD÷&–VçFF–öåW6VB‡W6VB’À¢Ò’À¢µÒÀ¢ ¢W6TVffV7B‚‚’Óâ°¢6öç7B†÷7BÒ†÷7E&Vbæ7W'&Vç@¢–b‚†÷7B’&WGW&à¢6öç7B–æ—F–ÂÒ–æ—F–Ä6öæf–u&Vbæ7W'&Vç@ ¢6öç7B'VçF–ÖRÒæWræ–v‡GG&6U'VçF–ÖR€¢†÷7BÀ¢–æ—F–ÂæÆWfVÂÀ¢–æ—F–Âç'Vä6öæf–rÀ¢–æ—F–Âç6WGF–æw2À¢–æ—F–ÂçVæÆö6¶VEvVöç2À¢–æ—F–ÂçW'6—7FVçEWw&FW2À¢°¢öå6æ6†÷C¢‡6æ6†÷B’Óâ6ÆÆ&6·5&Vbæ7W'&VçBæöå6æ6†÷B‡6æ6†÷B’À¢öä6ö×ÆWFS¢‡&W7VÇB’Óâ6ÆÆ&6·5&Vbæ7W'&VçBæöä6ö×ÆWFR‡&W7VÇB’À¢öäW†—C¢‚’Óâ6ÆÆ&6·5&Vbæ7W'&VçBæöäW†—B‚’À¢ÒÀ¢¢'VçF–ÖU&Vbæ7W'&VçBÒ'VçF–ÖP¢fö–B'VçF–ÖRæ–æ—B‚’æ6F6‚‚†W'&÷"’Óâ°¢6öç6öÆRæW'&÷"‚tä”t…EE$4R&VæFW&W"f–ÆVBFò–æ—F–Æ—¦RârÂW'&÷"¢Ò ¢&WGW&â‚’Óâ°¢'VçF–ÖRæFW7G&÷’‚¢–b‡'VçF–ÖU&Vbæ7W'&VçBÓÓÒ'VçF–ÖR’'VçF–ÖU&Vbæ7W'&VçBÒVæFVf–æV@¢Ğ¢ÒÂµÒ ¢W6TVffV7B‚‚’Óâ°¢'VçF–ÖU&Vbæ7W'&VçCòçWFFU6WGF–æw2‡6WGF–æw2¢ÒÂ·6WGF–æw5Ò ¢W6TVffV7B‚‚’Óâ°¢'VçF–ÖU&Vbæ7W'&VçCòç6WD÷&–VçFF–öåW6VB†÷&–VçFF–öåW6VB¢ÒÂ¶÷&–VçFF–öåW6VEÒ ¢&WGW&â€¢ÆF—`¢&Vc×¶†÷7E&VgĞ¢6Æ74æÖSÒ&vÖRÖ6çf2 ¢7G–ÆS×¶6çf4†÷7E7G–ÆWĞ¢&öÆSÒ&Æ–6F–öâ ¢&–ÖÆ&VÃ×¶G¶ÆWfVÂææÖWÒ6öÖ&B&VæĞ¢óà¢§Ò ¦W‡÷'BFVfVÇBvÖT6çf0