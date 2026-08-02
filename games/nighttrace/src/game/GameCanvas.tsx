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
  ColorMatrixFilter,
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
import {
  hasAuthorizedNighttraceMusicHandoff,
  NighttraceAudio,
} from './audio'
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
import { distributeRemoteCastDamage } from './remoteSpellDamage'
import {
  bossArrivalSeconds,
  openingHordeSize,
} from './combatLabProtocol'
import {
  BOSS_DEATH_MOTION_SECONDS,
  runEndingCompletionVisible,
  runEndingDuration,
  runEndingTitle,
} from './runEndingPresentation'
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
  angleFromOriginToTarget,
  heroWeaponOrigin,
} from './heroAttackOrigin'
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
  hostileSpecialReactionBonusSeconds,
  hostileSpecialReactionWindow,
} from './hostileReactionWindow'
import {
  sampleHostileSpecialEnergy,
  type HostileSpecialEnergyMark,
} from './hostileSpecialEnergy'
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
  type WeaponVfxProfile,
  type WeaponVfxStage,
  type WeaponVfxState,
} from './weaponVfx'
import {
  resolveCombatLabRuntimeVfx,
  type CombatLabRuntimeVfxPresentation,
} from './combatLabRuntimeVfx'
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
} from './weaponBalance'
import {
  cinderwakeReaverPresentationProfile,
  cinderwakeReaverProfile,
  orbitingCometProfile,
  persistentWindowDamage,
} from './persistentSpellChoreography'
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
  allocateHostileBoundaryPriorityPools,
  HOSTILE_BOUNDARY_BRIGHTNESS_GAIN,
  HOSTILE_BOUNDARY_FRAME_BUDGET,
  reserveHostileBoundaryParticleQuota,
  sampleHostileBoundaryParticles,
  type HostileBoundaryParticle,
} from './hostileBoundaryParticles'
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
  bossSpriteFacingScale,
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
  traceSegmentIsDiscontinuous,
} from './tracePulse'
import {
  pruneExpiredTracePoints,
  traceSegmentAlpha,
  type TimestampedTracePoint,
} from './traceLifetime'
import {
  LIGHT_RING_AWAKENING_NAME,
  LIGHT_RING_SKILL_NAME,
  lightRingProfile,
  lightRingRankForRun,
  lightRingTickDamage,
  lightRingTouchesTarget,
  type LightRingRank,
} from './lightRingSkill'
import { lightRingRenderPlan } from './lightRingPresentation'
import {
  COMBAT_TEXT_CAP_DESKTOP,
  COMBAT_TEXT_CAP_MOBILE,
  COMBAT_TEXT_COLORS,
  CombatTextQueue,
  HERO_BODY_CENTER_OFFSET_Y,
  HERO_BODY_HALF_HEIGHT,
  HERO_BODY_HALF_WIDTH,
  HERO_CONTACT_TRIGGER_PADDING,
  HERO_MELEE_RELEASE_PADDING,
  circleTouchesHeroBody,
  combatTextFontSize,
  combatTextPose,
  createPlayerHitFeedback,
  formatCombatDamage,
  heroDamageFlashTint,
  laneTouchesHeroBody,
  type CombatTextTarget,
  type PlayerDamageContext,
  type PlayerHitFeedback,
} from './combatReadability'

const WORLD_WIDTH = 1672
const WORLD_HEIGHT = 941
const FIXED_STEP = 1 / 60
const MAX_STEPS_PER_FRAME = 14
const DAWNCASTER_WEAPON_IDS = new Set<WeaponId>([
  'helio-lance',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
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
  halo: 12,
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
  toggleHitboxOverlay(): void
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

interface OrbitingCometEntity {
  active: boolean
  slot: number
  x: number
  y: number
  previousX: number
  previousY: number
  angle: number
  orbitRadius: number
  angularSpeed: number
  direction: -1 | 1
  footprint: number
  visualState: WeaponVfxState
  frameOffset: number
  sprite: Sprite
}

interface CinderwakeReaverEntity {
  active: boolean
  slot: number
  x: number
  y: number
  previousX: number
  previousY: number
  vx: number
  vy: number
  speed: number
  turnRate: number
  spin: number
  spinRate: number
  flightMode: 'seeking' | 'receding'
  flightTimer: number
  bounceLock: number
  curveSign: -1 | 1
  outboundX: number
  outboundY: number
  footprint: number
  scale: number
  visualState: WeaponVfxState
  frameOffset: number
  wakeGlow: Graphics
  impactGlow: Graphics
  auraSprite: Sprite
  edgeSprite: Sprite
  materialFilter: ColorMatrixFilter
  sprite: Sprite
}

interface PersistentSpellDamageWindow {
  remaining: number
  expiresAt: number
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
  specialAttack: boolean
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
  | 'astral-verdict'
  | 'comet-launch'
  | 'comet-impact'
  | 'graveglass-eruption'
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
  pointScales?: number[]
  pattern?: ReplacementWeaponPattern<number>
  hitPulseLife?: number
  hitPulseTotal?: number
  strikeHits?: Array<{
    targetUid: number
    strikeIndex: number
    damage: number
  }>
  triggeredStrikeCount?: number
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
  private readonly hostileSpecialEnergyGraphics = new Graphics()
  private readonly hostileBoundaryGlowGraphics = new Graphics()
  private readonly hostileBoundaryCoreGraphics = new Graphics()
  private readonly motionGraphics = new Graphics()
  private readonly cinderwakeFleetGlow = new Graphics()
  private readonly projectileTrailGraphics = new Graphics()
  private readonly hostileProjectileGraphics = new Graphics()
  private readonly lightRingAdditiveGraphics = new Graphics()
  private readonly lightRingGraphics = new Graphics()
  private readonly lightRingOverlayAdditiveGraphics = new Graphics()
  private readonly lightRingOverlayGraphics = new Graphics()
  private readonly weaponVfxAdditiveGraphics = new Graphics()
  private readonly weaponVfxGraphics = new Graphics()
  private readonly screenEffects = new Container()
  private readonly screenFlash = new Graphics()
  private readonly playerDamageVignette = new Graphics()
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
  private readonly hitboxGraphics = new Graphics()
  private readonly playerHitGraphics = new Graphics()
  private readonly combatTextLayer = new Container()
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
  private astralVerdictFrames: Texture[] = []
  private cometOrbitFrames: Texture[] = []
  private cinderwakeReaverFrames: Texture[] = []
  private crescentMoonbladeFrames: Texture[] = []
  private arcChoirImpactFrames: Texture[] = []
  private readonly authoredSpellMaterialSprites: Sprite[] = []
  private authoredSpellMaterialCursor = 0
  private readonly groundedVfxMaterialSprites: Sprite[] = []
  private groundedVfxMaterialCursor = 0
  private groundedVfxParticleBudget = 0
  private hostileBoundaryPriorityBudget = 0
  private hostileBoundaryPriorityFootprintsRemaining = 0
  private hostileBoundaryHordeBudget = 0
  private hostileBoundaryHordeFootprintsRemaining = 0
  private sparkTexture = Texture.WHITE
  private background?: Sprite
  private settings: GameSettings
  private readonly visualLod: CharacterVisualLod
  private readonly visualProfile: CharacterVisualProfile
  private readonly combatTextQueue: CombatTextQueue
  private readonly combatTextSprites = new Map<number, Text>()
  private readonly combatTextPool: Text[] = []
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
  private readonly lightRingRank: LightRingRank
  private lightRingTickRemaining = 0
  private lightRingPulse = 0
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
  private readonly weaponEffects: WeaponEffectEntity[] = []
  private readonly orbitingComets: OrbitingCometEntity[] = []
  private readonly cinderwakeReavers: CinderwakeReaverEntity[] = []
  private cometDamageWindow?: PersistentSpellDamageWindow
  private reaverDamageWindow?: PersistentSpellDamageWindow
  private readonly trace: TimestampedTracePoint[] = []
  private readonly weaponCooldowns = new Map<WeaponId, number>()
  private enemyUid = 0
  private spawnBudget = 0
  private hazardTimer = 22
  private nextSupportPickupAt = 60
  private supportPickupDrops = 0
  private readonly plannedDawnheartWindows: PlannedDawnheartWindow[]
  private plannedDawnheartIndex = 0
  private lastReviveAt = Number.NEGATIVE_INFINITY
  private revivesRemaining = 0
  private revivePending = false
  private reviveInvulnerability = 0
  private bossSpawned = false
  private boss?: EnemyEntity
  private bossIntroTimer = 0
  private awaitingStart = false
  private motionClock = 0
  private heroFacing: Vec2 = { x: 0, y: 1 }
  private heroVisualFacing: -1 | 1 = 1
  private heroFireElapsed = HERO_FIRE_DURATION
  private heroAttackStyle: AttackMotionStyle = 'none'
  private heroAttackRemaining = 0
  private heroAttackDuration = 0
  private heroAttackAngle = 0
  private heroHurtRemaining = 0
  private heroHurtDuration = 0
  private playerHitFeedback?: PlayerHitFeedback
  private playerHitFeedbackRemaining = 0
  private showHitboxOverlay = false
  private lastHeroEchoAt = -10
  private endSequenceTimer = 0
  private endSequenceDuration = 0
  private endSequenceVictory?: boolean
  private pendingResult?: RunResult
  private hitStop = 0
  private hurtCooldown = 0
  private shieldDelay = 0
  private screenFlashAlpha = 0
  private shake = 0
  private cameraX = WORLD_WIDTH * 0.5
  private cameraY = WORLD_HEIGHT * 0.54
  private attackVolley = 0
  private pickupVisualSeed = 0
  private hostileProjectileUid = 0
  private bossPatternDirectorState: BossPatternDirectorState =
    createBossPatternDirectorState()
  private qaUpgradeGranted = false
  private readonly qaMode =
    typeof location !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(location.hostname) &&
    new URLSearchParams(location.search).has('qa')
  private readonly player: PlayerState
  private lastWidth = 0
  private lastHeight = 0

  constructor(
    host: HTMLDivElement,
    level: LevelDefinition,
    runConfig: RunConfig,
    settings: GameSettings,
    unlockedWeapons: WeaponId[],
    persistentUpgrades: Record<string, number>,
    callbacks: RuntimeCallbacks,
  ) {
    this.host = host
    this.level = level
    this.runConfig = runConfig
    this.lightRingRank = lightRingRankForRun(
      runConfig.mode,
      runConfig.lightRingRank,
    )
    this.bossLevel = getLevel(runConfig.bossLevelId)
    this.settings = settings
    this.unlockedWeapons = [...new Set([...ALL_WEAPON_IDS, ...unlockedWeapons])]
    this.persistentUpgrades = persistentUpgrades
    this.callbacks = callbacks
    this.audio = new NighttraceAudio(settings, level.id)
    this.revivesRemaining = initialFreeRevives(runConfig.mode, runConfig.invincible)
    this.plannedDawnheartWindows =
      runConfig.mode === 'campaign' && !runConfig.bossOnly
        ? plannedDawnheartWindows(level.duration)
        : []
    const requestedLod =
      typeof location === 'undefined'
        ? undefined
        : new URLSearchParams(location.search).get('lod')
    const detectedLod = resolveCharacterVisualLod(browserVisualCapabilitySnapshot())
    this.visualLod =
      requestedLod === 'cinematic' ||
      requestedLod === 'balanced' ||
      requestedLod === 'mobile'
        ? requestedLod
        : detectedLod
    this.visualProfile = CHARACTER_VISUAL_PROFILES[this.visualLod]
    this.combatTextQueue = new CombatTextQueue(
      this.visualLod === 'mobile'
        ? COMBAT_TEXT_CAP_MOBILE
        : COMBAT_TEXT_CAP_DESKTOP,
    )
    this.showHitboxOverlay =
      runConfig.mode === 'combat-lab' &&
      typeof location !== 'undefined' &&
      new URLSearchParams(location.search).has('hitbox')
    this.groundedVfxSmokeGraphics.filters = [
      new BlurFilter({
        strength: this.visualLod === 'mobile' ? 3 : 4,
        quality: this.visualLod === 'cinematic' ? 2 : 1,
        kernelSize: 5,
      }),
    ]
    this.cinderwakeFleetGlow.blendMode = 'add'
    this.cinderwakeFleetGlow.filters = [
      new BlurFilter({
        strength: this.visualLod === 'mobile' ? 6 : 9,
        quality: this.visualLod === 'cinematic' ? 2 : 1,
        kernelSize: 5,
      }),
    ]
    this.rerollLimit =
      runConfig.mode === 'campaign'
        ? BASE_FREE_REFRESHES_PER_RUN +
          Math.min(1, Math.max(0, persistentUpgrades['bright-draft'] ?? 0)) *
            BRIGHT_DRAFT_BONUS_REFRESHES
        : 0
    this.upgradeSeed = (level.id * 0x9e3779b1) >>> 0
    this.random = new DeterministicRandom((level.id * 0x85ebca6b + 0x27d4eb2d) >>> 0)
    this.awaitingStart = runConfig.bossOnly
    if (this.showcase) {
      const showcaseBuild = showcaseLoadout(this.showcase)
      this.weapons = showcaseBuild.weapons.map((weapon) => ({ ...weapon }))
      this.modules = showcaseBuild.modules.map((module) => ({ ...module }))
    } else if (runConfig.startingLoadout) {
      this.weapons = runConfig.startingLoadout.weapons.map((weapon) => ({ ...weapon }))
      this.modules = runConfig.startingLoadout.modules.map((module) => ({ ...module }))
      this.traceMods = [...runConfig.startingLoadout.traceMods]
    } else {
      this.weapons = [{ id: 'helio-lance', rank: 1 }]
    }
    this.nextSupportPickupAt = runConfig.bossOnly
      ? Number.POSITIVE_INFINITY
      : this.qaMode
        ? 18
        : this.showcase
          ? Number.POSITIVE_INFINITY
          : supportPickupFirstDropSeconds(level.difficulty)

    const vitality = persistentUpgrades.vitality ?? 0
    const aegis = persistentUpgrades.aegis ?? 0
    const redShift = persistentUpgrades['red-shift'] ?? 0
    const maxHp = 100 + vitality * 4
    const maxShield = 28 + aegis * 3

    this.player = {
      x: WORLD_WIDTH * 0.5,
      y: WORLD_HEIGHT * 0.54,
      previousX: WORLD_WIDTH * 0.5,
      previousY: WORLD_HEIGHT * 0.54,
      hp: maxHp,
      maxHp,
      shield: maxShield,
      maxShield,
      speed: 235 * (1 + redShift * 0.015),
      xp: 0,
      xpToNext: experienceToNextLevel(
        Math.max(1, Math.min(99, Math.floor(runConfig.playerLevel))),
      ),
      level: Math.max(1, Math.min(99, Math.floor(runConfig.playerLevel))),
      pulseCharge: 0,
    }

    for (const id of ALL_WEAPON_IDS) this.weaponDamage.set(id, 0)
    for (const id of ALL_WEAPON_IDS) {
      this.weaponCooldowns.set(id, this.showcase ? 0.75 : this.random.range(0.08, 0.32))
    }
    this.trace.push({ x: this.player.x, y: this.player.y, bornAt: this.elapsed })
  }

  async init() {
    const resolution = Math.min(
      window.devicePixelRatio || 1,
      this.visualProfile.rendererResolutionCap,
    )
    const applicationInit = this.app
      .init({
        resizeTo: this.host,
        autoDensity: true,
        antialias: this.visualProfile.rendererAntialias,
        useBackBuffer: this.visualProfile.refraction,
        resolution,
        background: '#03070c',
        preference: 'webgl',
        powerPreference: 'high-performance',
      })
      .then(() => {
        this.applicationReady = true
      })
    const groundedVfxAssetBundle = await import('./groundedVfxAssetData')
    const authoredSpellLod = resolveAuthoredSpellAssetLod(this.visualLod)
    const groundedVfxAssetLod = this.visualLod === 'mobile' ? 'Mobile' : 'Desktop'
    const heroPowerMaterialAtlas = appAssetUrl(
      this.visualLod === 'mobile'
        ? 'assets/character-vfx/hero-material-vfx-atlas-v1-mobile.webp'
        : 'assets/character-vfx/hero-material-vfx-atlas-v1-desktop.webp',
    )
    const astralVerdictAtlas = appAssetUrl(
      this.visualLod === 'mobile'
        ? 'assets/spell-vfx/astral-verdict-v1-mobile.webp'
        : 'assets/spell-vfx/astral-verdict-v1.webp',
    )
    const cometOrbitAtlas = appAssetUrl(
      this.visualLod === 'mobile'
        ? 'assets/spell-vfx/comet-orbit-v1-mobile.webp'
        : 'assets/spell-vfx/comet-orbit-v1.webp',
    )
    const cinderwakeReaverAtlas = appAssetUrl(
      this.visualLod === 'mobile'
        ? 'assets/spell-vfx/cinderwake-reaver-v1-mobile.webp'
        : 'assets/spell-vfx/cinderwake-reaver-v1.webp',
    )
    const crescentMoonbladeAtlas = appAssetUrl(
      this.visualLod === 'mobile'
        ? 'assets/spell-vfx/crescent-moonblade-v1-mobile.webp'
        : 'assets/spell-vfx/crescent-moonblade-v1.webp',
    )
    const arcChoirImpactAtlas = appAssetUrl(
      this.visualLod === 'mobile'
        ? 'assets/spell-vfx/arc-choir-impact-v1-mobile.webp'
        : 'assets/spell-vfx/arc-choir-impact-v1.webp',
    )
    const assetLoad = Promise.all([
      Assets.load<Texture>(backgroundForLevel(this.level.id)),
      Assets.load<Texture>(appAssetUrl('assets/hero-animations/hero-walk-runtime.webp')),
      Assets.load<Texture>(appAssetUrl('assets/hero-animations/hero-fire-runtime.webp')),
      Assets.load<Texture>(appAssetUrl('assets/hero-animations/hero-charge-runtime.webp')),
      Assets.load<Texture>(appAssetUrl(ENEMY_MOTION_ATLASES[0].path)),
      Assets.load<Texture>(appAssetUrl(ENEMY_MOTION_ATLASES[1].path)),
      Assets.load<Texture>(appAssetUrl('assets/nighttrace-boss-atlas.webp')),
      Assets.load<Texture>(appAssetUrl(BOSS_MOTION_ATLASES[0].path)),
      Assets.load<Texture>(appAssetUrl(BOSS_MOTION_ATLASES[1].path)),
      Assets.load<Texture>(appAssetUrl('assets/nighttrace-pickup-atlas.webp')),
      Assets.load<Texture>(
        AUTHORED_SPELL_ASSET_DATA[
          authoredSpellAssetDataKey('graveglass-spire', authoredSpellLod)
        ],
      ),
      Assets.load<Texture>(
        AUTHORED_SPELL_ASSET_DATA[
          authoredSpellAssetDataKey('eclipse-gate', authoredSpellLod)
        ],
      ),
      Assets.load<Texture>(
        AUTHORED_SPELL_ASSET_DATA[
          authoredSpellAssetDataKey('eclipse-cathedral', authoredSpellLod)
        ],
      ),
      Assets.load<Texture>(
        groundedVfxAssetBundle.GROUNDED_VFX_ASSET_DATA[
          `hostileGroundField${groundedVfxAssetLod}`
        ],
      ),
      Assets.load<Texture>(
        groundedVfxAssetBundle.GROUNDED_VFX_ASSET_DATA[
          `hostileGroundLane${groundedVfxAssetLod}`
        ],
      ),
      Assets.load<Texture>(heroPowerMaterialAtlas),
      Assets.load<Texture>(astralVerdictAtlas),
      Assets.load<Texture>(cometOrbitAtlas),
      Assets.load<Texture>(cinderwakeReaverAtlas),
      Assets.load<Texture>(crescentMoonbladeAtlas),
      Assets.load<Texture>(arcChoirImpactAtlas),
    ])
    try {
      const [
        ,
        [
          backgroundTexture,
          heroWalkSheet,
          heroFireSheet,
          heroChargeSheet,
          enemyMotionSheetA,
          enemyMotionSheetB,
          bossSheet,
          bossMotionSheetA,
          bossMotionSheetB,
          pickupSheet,
          graveglassSpireTexture,
          eclipseGateTexture,
          eclipseCathedralTexture,
          hostileGroundFieldTexture,
          hostileGroundLaneTexture,
          heroPowerMaterialSheet,
          astralVerdictSheet,
          cometOrbitSheet,
          cinderwakeReaverSheet,
          crescentMoonbladeSheet,
          arcChoirImpactSheet,
        ],
      ] = await Promise.all([applicationInit, assetLoad])

      if (this.destroyed) {
        this.destroyApplication()
        return
      }

      this.app.canvas.setAttribute('aria-hidden', 'true')
      this.app.canvas.style.display = 'block'
      this.app.canvas.style.width = '100%'
      this.app.canvas.style.height = '100%'
      this.host.appendChild(this.app.canvas)

      this.background = new Sprite(backgroundTexture)
      this.background.width = WORLD_WIDTH
      this.background.height = WORLD_HEIGHT
      this.world.addChild(this.background)
      this.world.addChild(
        this.trailLayer,
        this.threatGroundLayer,
        this.weaponMaterialLayer,
        this.pickupLayer,
        this.enemyMaterialLayer,
        this.enemyLayer,
        this.projectileLayer,
        this.effectLayer,
        this.enemyForegroundLayer,
        this.actorLayer,
        this.combatTextLayer,
      )
      this.trailLayer.addChild(this.loopGraphics, this.trailGlow, this.trailCore)
      this.threatGroundLayer.addChild(
        this.groundedVfxMaterialLayer,
        this.groundedVfxSmokeGraphics,
        this.groundedVfxDustGraphics,
      )
      this.groundedVfxMaterialLayer.sortableChildren = true
      this.groundedVfxCinderGraphics.blendMode = 'add'
      this.hostileSpecialEnergyGraphics.blendMode = 'add'
      this.hostileBoundaryGlowGraphics.blendMode = 'add'
      this.weaponMaterialLayer.sortableChildren = true
      this.pickupLayer.addChild(this.pickupAuraGraphics)
      this.enemyLayer.addChild(this.motionGraphics)
      this.projectileLayer.addChild(
        this.cinderwakeFleetGlow,
        this.projectileTrailGraphics,
        this.hostileProjectileGraphics,
      )
      this.weaponVfxAdditiveGraphics.blendMode = 'add'
      this.lightRingAdditiveGraphics.blendMode = 'add'
      this.lightRingOverlayAdditiveGraphics.blendMode = 'add'
      this.enemyForegroundLayer.addChild(
        this.groundedVfxCinderGraphics,
        this.hostileSpecialEnergyGraphics,
        this.hostileBoundaryGlowGraphics,
        this.hostileBoundaryCoreGraphics,
      )
      this.effectLayer.addChild(
        this.motionEchoLayer,
        this.lightRingAdditiveGraphics,
        this.lightRingGraphics,
        this.weaponVfxAdditiveGraphics,
        this.weaponVfxGraphics,
        this.lightRingOverlayAdditiveGraphics,
        this.lightRingOverlayGraphics,
      )
      this.app.stage.addChild(this.world, this.screenEffects)
      this.screenEffects.addChild(
        this.screenFlash,
        this.playerDamageVignette,
        this.cinematicGraphics,
        this.cinematicTitle,
        this.joystickGraphics,
      )

      this.heroWalkFrames = this.sliceTexture(heroWalkSheet, 4, 2)
      this.heroFireFrames = this.sliceTexture(heroFireSheet, 3, 2)
      this.heroChargeFrames = this.sliceTexture(heroChargeSheet, 3, 2)
      this.enemyMotionFrames = [
        this.sliceTexture(
          enemyMotionSheetA,
          ENEMY_MOTION_ATLASES[0].columns,
          ENEMY_MOTION_ATLASES[0].rows,
        ),
        this.sliceTexture(
          enemyMotionSheetB,
          ENEMY_MOTION_ATLASES[1].columns,
          ENEMY_MOTION_ATLASES[1].rows,
        ),
      ]
      this.bossFrames = this.sliceTexture(bossSheet, 3, 2)
      this.bossMotionFrames = [
        this.sliceTexture(
          bossMotionSheetA,
          BOSS_MOTION_ATLASES[0].columns,
          BOSS_MOTION_ATLASES[0].rows,
        ),
        this.sliceTexture(
          bossMotionSheetB,
          BOSS_MOTION_ATLASES[1].columns,
          BOSS_MOTION_ATLASES[1].rows,
        ),
      ]
      this.pickupFrames = this.sliceTexture(pickupSheet, 3, 2)
      this.graveglassSpireTexture = graveglassSpireTexture
      this.eclipseGateTexture = eclipseGateTexture
      this.eclipseCathedralTexture = eclipseCathedralTexture
      this.hostileGroundFieldTexture = hostileGroundFieldTexture
      this.hostileGroundLaneTexture = hostileGroundLaneTexture
      this.heroPowerMaterialFrames = this.sliceTexture(
        heroPowerMaterialSheet,
        4,
        4,
      )
      this.astralVerdictFrames = this.sliceTexture(astralVerdictSheet, 4, 4)
      this.cometOrbitFrames = this.sliceTexture(cometOrbitSheet, 4, 4)
      this.cinderwakeReaverFrames = this.sliceTexture(cinderwakeReaverSheet, 4, 4)
      this.crescentMoonbladeFrames = this.sliceTexture(crescentMoonbladeSheet, 4, 4)
      this.arcChoirImpactFrames = this.sliceTexture(arcChoirImpactSheet, 4, 4)
      this.createVfxTextures()
      const initialHeroTexture =
        this.heroChargeFrames[0] ?? this.heroWalkFrames[0] ?? Texture.WHITE
      this.hero = new Sprite(initialHeroTexture)
      this.hero.anchor.set(HERO_ART_ROOT_X, HERO_ART_ROOT_Y)
      this.hero.scale.set(HERO_ART_SCALE)
      this.hero.position.set(this.player.x, this.player.y)
      this.hero.filters = null
      this.actorLayer.addChild(
        this.hitboxGraphics,
        this.hero,
        this.playerHitGraphics,
      )
      this.host.dataset.hitboxOverlay = String(this.showHitboxOverlay)
      this.host.dataset.heroHitbox = 'model-ellipse'
      this.host.dataset.heroHitHalfWidth = String(HERO_BODY_HALF_WIDTH)
      this.host.dataset.heroHitHalfHeight = String(HERO_BODY_HALF_HEIGHT)
      this.host.dataset.heroHitCenterOffsetY = String(
        HERO_BODY_CENTER_OFFSET_Y,
      )

      this.cinematicTitle.anchor.set(0.5)
      this.cinematicTitle.alpha = 0
      this.host.dataset.visualLod = this.visualLod
      this.host.dataset.materialVfxReady = 'retired'
      this.host.dataset.actorReadability = 'protected'
      this.host.dataset.authoredSpellMaterials = AUTHORED_SPELL_ASSET_REVISION
      const lightRing = lightRingProfile(this.lightRingRank)
      this.host.dataset.lightRingRank = String(this.lightRingRank)
      this.host.dataset.lightRingDiameter = String(lightRing?.diameter ?? 0)
      this.host.dataset.lightRingCenterOffsetY = String(
        HERO_BODY_CENTER_OFFSET_Y,
      )
      this.host.dataset.lightRingState = lightRing?.awakened
        ? LIGHT_RING_AWAKENING_NAME
        : lightRing
          ? LIGHT_RING_SKILL_NAME
          : 'disabled'

      this.input = new GameInput(this.host, {
        onInteract: () => void this.audio.unlock(),
      })
      this.resizeObserver = new ResizeObserver(() => this.layout())
      this.resizeObserver.observe(this.host)
      document.addEventListener('visibilitychange', this.handleVisibility)
      this.app.ticker.add(this.tick)
      this.layout()
      this.initialized = true
      if (hasAuthorizedNighttraceMusicHandoff(this.level.id)) {
        void this.audio.unlock().catch(() => {
          // A normal battlefield interaction can retry on hardened browsers.
        })
      }
      if (this.showcase) this.spawnShowcaseTargets()
      else if (!this.runConfig.bossOnly) {
        const openingEnemies = openingHordeSize(this.runConfig)
        for (let index = 0; index < openingEnemies; index += 1) {
          this.spawnEnemy()
        }
      }
      this.emitSnapshot(true)
    } catch (error) {
      try {
        await applicationInit
      } catch {
        // There is no renderer to release when Pixi initialization itself fails.
      }
      if (this.destroyed) this.destroyApplication()
      else this.destroy()
      throw error
    }
  }

  updateSettings(settings: GameSettings) {
    this.settings = settings
    this.audio.updateSettings(settings)
    if (!settings.showDamageNumbers) this.combatTextQueue.clear()
  }

  beginEncounter() {
    if (!this.initialized || this.completed) return
    if (!this.awaitingStart) return
    // Start the audio handshake inside the gesture, but never make encounter
    // state depend on media playback resolving on a particular browser.
    void this.audio.unlock().catch(() => {
      // Combat remains playable when a browser declines or lacks audio output.
    })
    this.awaitingStart = false
    this.spawnBoss()
    this.emitSnapshot(true)
  }

  revive() {
    if (
      !this.initialized ||
      this.completed ||
      !this.revivePending ||
      this.revivesRemaining <= 0
    ) {
      return
    }

    this.revivesRemaining -= 1
    this.revivePending = false
    this.lastReviveAt = this.elapsed
    this.player.hp = revivedHealth(this.player.maxHp)
    this.player.shield = 0
    this.reviveInvulnerability = REVIVE_INVULNERABILITY_SECONDS
    this.hurtCooldown = REVIVE_INVULNERABILITY_SECONDS
    this.shieldDelay = Math.max(this.shieldDelay, REVIVE_INVULNERABILITY_SECONDS + 1.8)
    this.heroHurtRemaining = 0
    this.heroHurtDuration = 0
    this.playerHitFeedback = undefined
    this.playerHitFeedbackRemaining = 0
    this.combatTextQueue.clear()
    this.trace.length = 0
    this.trace.push({ x: this.player.x, y: this.player.y, bornAt: this.elapsed })
    this.clearReviveSanctuary()
    this.spawnBurst(this.player.x, this.player.y, 0xffe5a3, 38, 330)
    this.screenFlashAlpha = this.settings.reducedFlash ? 0.04 : 0.18
    this.shake = Math.max(this.shake, 10)
    this.audio.play('pulse', 0.82)
    this.host.dataset.revivesUsed = '1'
    this.emitSnapshot(true)
  }

  declineRevive() {
    if (!this.revivePending || this.completed) return
    this.revivePending = false
    this.finish(false)
  }

  private clearReviveSanctuary() {
    const sanctuaryRadius = REVIVE_SANCTUARY_RADIUS

    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      const actorSanctuaryRadius =
        sanctuaryRadius + (enemy.isBoss ? enemy.radius : 0)
      const dx = enemy.x - this.player.x
      const dy = enemy.y - this.player.y
      const distanceSquaredFromPlayer = dx * dx + dy * dy
      if (distanceSquaredFromPlayer > actorSanctuaryRadius ** 2) continue
      const distance = Math.sqrt(distanceSquaredFromPlayer)
      const preferredAngle =
        distance > 0.01
          ? Math.atan2(dy, dx)
          : this.random.range(0, Math.PI * 2)

      // A simple clamp can leave an actor inside the sanctuary when the hero
      // revives near a wall. Evaluate the preferred direction plus an inward
      // fan and keep the candidate with the greatest real separation.
      const candidateAngles = [
        preferredAngle,
        preferredAngle + Math.PI,
        0,
        Math.PI * 0.5,
        Math.PI,
        -Math.PI * 0.5,
        Math.PI * 0.25,
        Math.PI * 0.75,
        Math.PI * 1.25,
        Math.PI * 1.75,
      ]
      let safeX = enemy.x
      let safeY = enemy.y
      let safeDistanceSquared = -1
      for (const angle of candidateAngles) {
        const candidateX = clamp(
          this.player.x + Math.cos(angle) * actorSanctuaryRadius,
          38,
          WORLD_WIDTH - 38,
        )
        const candidateY = clamp(
          this.player.y + Math.sin(angle) * actorSanctuaryRadius,
          34,
          WORLD_HEIGHT - 34,
        )
        const candidateDistanceSquared =
          (candidateX - this.player.x) ** 2 +
          (candidateY - this.player.y) ** 2
        if (candidateDistanceSquared <= safeDistanceSquared) continue
        safeX = candidateX
        safeY = candidateY
        safeDistanceSquared = candidateDistanceSquared
      }

      enemy.x = safeX
      enemy.y = safeY
      enemy.previousX = enemy.x
      enemy.previousY = enemy.y
      enemy.pendingContactDamage = 0
      enemy.blinkTargetX = null
      enemy.blinkTargetY = null
      enemy.contactCooldown = Math.max(enemy.contactCooldown, enemy.isBoss ? 1.6 : 1.1)
      if (enemy.isBoss) {
        enemy.attackTimer = Math.max(enemy.attackTimer, 1.4)
        enemy.attackMotionRemaining = 0
        enemy.attackMotionDuration = 0
        enemy.attackMotionStyle = 'none'
      }
    }

    for (const telegraph of this.telegraphs) {
      if (!telegraph.active) continue
      const dx = this.player.x - telegraph.x
      const dy = this.player.y - telegraph.y
      const localX = Math.cos(telegraph.angle) * dx + Math.sin(telegraph.angle) * dy
      const localY = -Math.sin(telegraph.angle) * dx + Math.cos(telegraph.angle) * dy
      const overlapsSanctuary =
        telegraph.kind === 'circle'
          ? dx * dx + dy * dy <= (telegraph.radius + sanctuaryRadius) ** 2
          : localX >= -sanctuaryRadius &&
            localX <= telegraph.length + sanctuaryRadius &&
            Math.abs(localY) <= telegraph.width * 0.5 + sanctuaryRadius
      if (!overlapsSanctuary) continue
      telegraph.active = false
      this.activeTelegraphCount = Math.max(0, this.activeTelegraphCount - 1)
    }

    for (let index = this.hostileProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.hostileProjectiles[index]
      const destination = projectile.state.config.destination
      const safeRadius = sanctuaryRadius + projectile.state.config.impactRadius
      if (distanceSquared(destination, this.player) <= safeRadius ** 2) {
        this.hostileProjectiles.splice(index, 1)
      }
    }

    for (const pickup of this.pickups) {
      if (!pickup.active || pickup.kind !== 'dawnheart') continue
      pickup.active = false
      pickup.sprite.visible = false
    }
  }

  selectUpgrade(optionId: string) {
    if (!this.upgradeOptions?.length || this.completed) return
    const option = this.upgradeOptions.find((candidate) => candidate.id === optionId)
    if (!option) return

    if (option.type === 'weapon' && option.weaponId) {
      const owned = this.weapons.find((weapon) => weapon.id === option.weaponId)
      if (owned) {
        owned.rank = Math.max(owned.rank, option.rank ?? owned.rank + 1)
        if (option.rarity === 'awakening') owned.awakened = true
      } else {
        this.weapons.push({ id: option.weaponId, rank: option.rank ?? 1 })
      }
    } else if (option.type === 'module' && option.moduleId) {
      const owned = this.modules.find((module) => module.id === option.moduleId)
      if (owned) owned.rank = Math.max(owned.rank, option.rank ?? owned.rank + 1)
      else this.modules.push({ id: option.moduleId, rank: option.rank ?? 1 })
    } else if (option.type === 'trace' && option.traceModId) {
      if (!this.traceMods.includes(option.traceModId)) this.traceMods.push(option.traceModId)
    } else if (option.type === 'heal') {
      if (option.id.includes('aegis')) {
        this.player.maxShield += 6
        this.player.shield = this.player.maxShield
      } else if (option.id.includes('pulse')) {
        this.primedTracePulseBonus = Math.max(this.primedTracePulseBonus, 100)
      } else {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.3)
      }
    }

    this.upgradeOptions = undefined
    this.rerollExclusions.clear()
    if (option.rarity === 'awakening') {
      this.rings.push({
        x: this.player.x,
        y: this.player.y,
        radius: 12,
        maxRadius: 360,
        life: 0.9,
        total: 0.9,
        color: option.weaponId ? WEAPONS[option.weaponId].color : 0xffda78,
        width: 12,
      })
      this.spawnBurst(
        this.player.x,
        this.player.y,
        option.weaponId ? WEAPONS[option.weaponId].color : 0xffda78,
        58,
        420,
      )
      this.hitStop = this.settings.reducedFlash ? 0.02 : 0.065
      this.screenFlashAlpha = this.settings.reducedFlash ? 0.04 : 0.22
      this.shake = 16
      this.audio.play('pulse')
    } else {
      this.audio.play('upgrade')
    }
    this.emitSnapshot(true)
  }

  rerollUpgrade() {
    if (
      !this.upgradeOptions?.length ||
      this.rerollsUsed >= this.rerollLimit ||
      this.completed
    ) return
    for (const option of this.upgradeOptions) {
      this.rerollExclusions.add(option.id)
    }
    const draft = createUpgradeDraft(
      {
        ...this.getUpgradeContext(),
        rerollsUsed: this.rerollsUsed,
        excludeOptionIds: [...this.rerollExclusions],
      },
      this.upgradeSeed,
      true,
    )
    this.upgradeOptions = draft.options
    this.upgradeSeed = draft.seed
    this.rerollsUsed = draft.rerollsUsed
    this.audio.play('upgrade', 0.7)
    this.emitSnapshot(true)
  }

  togglePause() {
    if (
      !this.initialized ||
      this.completed ||
      this.awaitingStart ||
      this.revivePending ||
      this.upgradeOptions?.length
    ) return
    this.manualPaused = !this.manualPaused
    this.emitSnapshot(true)
  }

  toggleHitboxOverlay() {
    if (this.runConfig.mode !== 'combat-lab') return
    this.showHitboxOverlay = !this.showHitboxOverlay
    this.host.dataset.hitboxOverlay = String(this.showHitboxOverlay)
    this.emitSnapshot(true)
  }

  setOrientationPaused(paused: boolean) {
    if (this.orientationPaused === paused) return
    this.orientationPaused = paused
    this.accumulator = 0
    this.emitSnapshot(true)
  }

  activatePulse() {
    if (this.completed || this.isPaused() || this.player.pulseCharge < 100) return
    this.player.pulseCharge = 0
    this.triggerHeroAttack('hero-pulse', 0.7, this.heroAttackAngle)
    const damage = 120 + this.player.level * 11
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      const distance = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y)
      if (distance > 610) continue
      const falloff = 1 - distance / 900
      this.damageEnemy(enemy, damage * Math.max(0.42, falloff), 'helio-lance', false)
      const push = Math.max(0, 1 - distance / 610) * 180
      if (!enemy.isBoss && distance > 0.01) {
        enemy.x += ((enemy.x - this.player.x) / distance) * push
        enemy.y += ((enemy.y - this.player.y) / distance) * push
      }
    }
    this.rings.push({
      x: this.player.x,
      y: this.player.y,
      radius: 18,
      maxRadius: 640,
      life: 0.66,
      total: 0.66,
      color: 0xffdc79,
      width: 12,
    })
    this.hitStop = this.settings.reducedFlash ? 0.02 : 0.075
    this.shake = Math.max(this.shake, 18)
    this.screenFlashAlpha = this.settings.reducedFlash ? 0.055 : 0.28
    this.audio.play('pulse')
    this.spawnBurst(this.player.x, this.player.y, 0xffd878, 38, 340)
    this.emitSnapshot(true)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.resizeObserver?.disconnect()
    this.input?.destroy()
    this.audio.destroy()
    this.destroyApplication()
  }

  private destroyApplication() {
    if (!this.applicationReady) return
    this.app.ticker.remove(this.tick)
    this.app.destroy(true, { children: true })
    this.applicationReady = false
    this.initialized = false
    for (const texture of [
      ...this.heroWalkFrames,
      ...this.heroFireFrames,
      ...this.heroChargeFrames,
      ...this.enemyMotionFrames[0],
      ...this.enemyMotionFrames[1],
      ...this.bossFrames,
      ...this.bossMotionFrames[0],
      ...this.bossMotionFrames[1],
      ...this.pickupFrames,
    ]) {
      texture.destroy(false)
    }
    this.heroWalkFrames.length = 0
    this.heroFireFrames.length = 0
    this.heroChargeFrames.length = 0
    this.enemyMotionFrames[0].length = 0
    this.enemyMotionFrames[1].length = 0
    this.bossFrames.length = 0
    this.bossMotionFrames[0].length = 0
    this.bossMotionFrames[1].length = 0
    this.pickupFrames.length = 0
    for (const texture of this.projectileTextures.values()) texture.destroy(true)
    this.projectileTextures.clear()
    if (this.sparkTexture !== Texture.WHITE) {
      this.sparkTexture.destroy(true)
      this.sparkTexture = Texture.WHITE
    }
  }

  private tick = (ticker: Ticker) => {
    if (this.destroyed || !this.initialized) return
    const realDelta = Math.min(this.qaMode ? 0.25 : 0.05, ticker.deltaMS / 1000)
    const maxSteps = this.qaMode ? 160 : MAX_STEPS_PER_FRAME
    if (this.completed && this.endSequenceTimer > 0) {
      this.endSequenceTimer = Math.max(
        0,
        this.endSequenceTimer - realDelta,
      )
    }
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - realDelta)
      this.render()
      return
    }
    if (!this.isPaused()) {
      this.accumulator += realDelta * (this.qaMode ? 10 : 1)
      let steps = 0
      while (this.accumulator >= FIXED_STEP && steps < maxSteps) {
        this.step(FIXED_STEP)
        this.accumulator -= FIXED_STEP
        steps += 1
      }
      if (steps === maxSteps) this.accumulator = 0
    }
    this.interpolation = clamp(this.accumulator / FIXED_STEP, 0, 1)
    this.render()
  }

  private step(delta: number) {
    if (this.showcaseFrozen) return
    this.advanceMotion(delta)
    if (this.completed) {
      this.updateVisualEffects(delta)
      this.snapshotClock += delta
      if (this.snapshotClock >= 0.1) {
        this.snapshotClock = 0
        this.emitSnapshot()
      }
      if (this.endSequenceTimer <= 0 && !this.completionSent && this.pendingResult) {
        this.completionSent = true
        this.callbacks.onComplete(this.pendingResult)
      }
      return
    }
    if (this.revivePending) return
    if (this.awaitingStart) {
      this.updateVisualEffects(delta)
      this.snapshotClock += delta
      if (this.snapshotClock >= 0.1) {
        this.snapshotClock = 0
        this.emitSnapshot()
      }
      return
    }
    if (this.bossIntroTimer > 0) {
      this.bossIntroTimer = Math.max(0, this.bossIntroTimer - delta)
      this.updateVisualEffects(delta)
      this.snapshotClock += delta
      if (this.snapshotClock >= 0.1) this.emitSnapshot()
      return
    }

    const direction = this.input?.getDirection() ?? { x: 0, y: 0 }
    this.player.previousX = this.player.x
    this.player.previousY = this.player.y
    const quietStep =
      this.traceMods.includes('quiet-step') && this.shieldDelay <= 0 ? 1.18 : 1
    this.player.x = clamp(
      this.player.x + direction.x * this.player.speed * quietStep * delta,
      86,
      WORLD_WIDTH - 86,
    )
    this.player.y = clamp(
      this.player.y + direction.y * this.player.speed * quietStep * delta,
      78,
      WORLD_HEIGHT - 72,
    )
    if (Math.hypot(direction.x, direction.y) > 0.08) {
      this.heroFacing = { x: direction.x, y: direction.y }
    }
    this.elapsed += delta
    this.snapshotClock += delta
    this.hurtCooldown = Math.max(0, this.hurtCooldown - delta)
    this.reviveInvulnerability = Math.max(0, this.reviveInvulnerability - delta)
    this.shieldDelay = Math.max(0, this.shieldDelay - delta)
    if (this.shieldDelay <= 0 && this.player.shield < this.player.maxShield) {
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + delta * 2.6)
    }

    if (this.showcase) {
      this.updateEnemies(delta)
      this.rebuildEnemyGrid()
      this.updatePersistentSpells(delta)
      this.updateWeapons(delta)
      this.updateProjectiles(delta)
      this.updateTelegraphs(delta)
      this.updateVisualEffects(delta)
      const activeProjectiles = this.projectiles.filter((projectile) => projectile.active)
      this.host.dataset.showcaseProjectiles = String(activeProjectiles.length)
      this.host.dataset.showcaseProjectileSpread = String(
        Math.round(
          activeProjectiles.reduce(
            (farthest, projectile) =>
              Math.max(
                farthest,
                Math.hypot(projectile.x - this.player.x, projectile.y - this.player.y),
              ),
            0,
          ),
        ),
      )
      this.host.dataset.showcaseEffects = String(this.weaponEffects.length)
      const showcaseWeapon = this.weapons[0]
      const showcaseState = showcaseWeapon
        ? resolveWeaponVfxState(
            showcaseWeapon.rank,
            this.modules.find(
              (module) => module.id === WEAPONS[showcaseWeapon.id].moduleId,
            )?.rank ?? 0,
            Boolean(showcaseWeapon.awakened),
          )
        : undefined
      this.host.dataset.showcaseStage = showcaseState?.stage ?? ''
      this.host.dataset.showcaseVisibleEffects = String(
        showcaseWeapon
          ? this.weaponEffects.filter((effect) => effect.weaponId === showcaseWeapon.id).length
          : 0,
      )
      const showcaseMotif =
        showcaseWeapon &&
        showcaseState &&
        (showcaseWeapon.id === 'ash-halo' || showcaseWeapon.id === 'null-bell')
          ? weaponVfxMotifProfile(showcaseWeapon.id, showcaseState)
          : undefined
      this.host.dataset.showcaseMotif = showcaseMotif?.motif ?? ''
      this.host.dataset.showcaseConcentricBands = String(
        showcaseMotif?.concentricBandCount ?? 0,
      )
      if (this.elapsed >= showcaseCaptureSeconds(this.showcase.weaponId)) {
        this.showcaseFrozen = true
        this.host.dataset.showcaseReady = 'true'
      }
      if (this.snapshotClock >= 0.1) {
        this.snapshotClock = 0
        this.emitSnapshot()
      }
      return
    }

    if (this.qaMode && !this.qaUpgradeGranted && this.elapsed >= 8) {
      this.qaUpgradeGranted = true
      this.player.xp = this.player.xpToNext
      this.levelUp()
      return
    }

    this.updateTrace()
    if (!this.runConfig.bossOnly) this.updateSpawning(delta)
    this.updateEnemies(delta)
    if (this.revivePending) {
      this.emitSnapshot(true)
      return
    }
    this.rebuildEnemyGrid()
    this.updateLightRing(delta)
    this.updatePersistentSpells(delta)
    this.updateWeapons(delta)
    this.updateProjectiles(delta)
    if (!this.runConfig.bossOnly) {
      this.updatePlannedDawnheartDrops()
      this.updateSupportPickups()
    }
    this.updatePickups(delta)
    this.updateHostileProjectiles(delta)
    this.updateTelegraphs(delta)
    this.updateVisualEffects(delta)

    const bossAt = bossArrivalSeconds(
      this.runConfig,
      this.level.duration,
      this.qaMode,
    )
    if (!this.runConfig.bossOnly && !this.bossSpawned && this.elapsed >= bossAt) this.spawnBoss()

    if (!this.runConfig.bossOnly) {
      this.hazardTimer -= delta
      if (this.hazardTimer <= 0 && !this.bossIntroTimer) {
        this.spawnHazard()
        this.hazardTimer = Math.max(5.2, 14 - this.level.difficulty * 1.15)
      }
    }

    if (this.settings.autoPulse && this.player.pulseCharge >= 100) this.activatePulse()

    if (this.snapshotClock >= 0.1) {
      this.snapshotClock = 0
      this.emitSnapshot()
    }
  }

  private render() {
    if (!this.hero) return
    const playerRenderX = lerp(this.player.previousX, this.player.x, this.interpolation)
    const playerRenderY = lerp(this.player.previousY, this.player.y, this.interpolation)
    const playerMoveSpeed =
      Math.hypot(this.player.x - this.player.previousX, this.player.y - this.player.previousY) /
      FIXED_STEP
    const moving = clamp(playerMoveSpeed / Math.max(1, this.player.speed), 0, 1)
    const attackProgress = motionProgress(this.heroAttackRemaining, this.heroAttackDuration)
    const pulseActive = this.heroAttackStyle === 'hero-pulse' && attackProgress >= 0
    const castActive = this.heroAttackStyle === 'hero-cast' && attackProgress >= 0
    const heroHurtProgress = motionProgress(
      this.heroHurtRemaining,
      this.heroHurtDuration,
    )
    const heroPose = sampleHeroMotion({
      time: this.motionClock,
      moving,
      attackProgress,
      attackAngle: this.heroAttackAngle,
      attackStyle: this.heroAttackStyle,
      hurtProgress: heroHurtProgress,
      reducedMotion: this.settings.reducedShake,
    })
    if (Math.abs(this.heroFacing.x) > 0.08) {
      this.heroVisualFacing = this.heroFacing.x < 0 ? -1 : 1
    }

    let heroTexture = this.heroChargeFrames[0] ?? this.heroWalkFrames[0] ?? Texture.WHITE
    let authoredGlow = 0
    if (pulseActive || castActive) {
      const chargeFrame = heroPulseRecoveryFrameAt(attackProgress)
      heroTexture = this.heroChargeFrames[chargeFrame] ?? heroTexture
      authoredGlow = 0.22 + (chargeFrame / 5) * (pulseActive ? 0.78 : 0.6)
    } else if (this.heroFireElapsed < HERO_FIRE_DURATION) {
      const fireFrame = heroFireFrameAt(this.heroFireElapsed)
      heroTexture = this.heroFireFrames[fireFrame] ?? heroTexture
      authoredGlow =
        fireFrame === 3 ? 1 : fireFrame === 4 ? 0.58 : fireFrame === 2 ? 0.3 : 0.1
    } else if (moving > 0.08) {
      heroTexture = this.heroWalkFrames[heroWalkFrameAt(this.motionClock)] ?? heroTexture
    } else if (this.player.pulseCharge >= 100) {
      const chargeFrame = heroChargeFrameAt(this.motionClock)
      heroTexture = this.heroChargeFrames[chargeFrame] ?? heroTexture
      authoredGlow = 0.14 + (chargeFrame / 5) * 0.56
    }

    if (this.hero.texture !== heroTexture) this.hero.texture = heroTexture
    this.hero.scale.set(
      HERO_ART_SCALE * this.heroVisualFacing * heroPose.scaleX,
      HERO_ART_SCALE * heroPose.scaleY,
    )
    this.hero.position.set(
      playerRenderX + heroPose.offsetX,
      playerRenderY + heroPose.offsetY,
    )
    this.hero.rotation = heroPose.rotation
    // The authored hero sheet is the visual source of truth. Hurt/attack motion
    // may pulse posture and light, but never fades the silhouette out beneath
    // upgrade overdraw.
    this.hero.alpha = Math.max(0.96, heroPose.alpha)
    this.drawPlayerCombatReadability(
      playerRenderX,
      playerRenderY,
      playerRenderX + heroPose.offsetX,
      playerRenderY + heroPose.offsetY,
    )
    const heroGlow = Math.max(heroPose.glow, authoredGlow)
    this.motionGraphics.clear()
    // Use direct ellipse geometry for actor grounding. Filtered white sprites
    // become rectangular render textures on some WebGL/mobile paths, exposing
    // the dark slabs that previously appeared beneath the hero and bosses.
    this.motionGraphics
      .ellipse(
        playerRenderX + heroPose.offsetX * 0.18,
        playerRenderY + 16 + heroPose.offsetY * 0.12,
        33 + moving * 4 + heroGlow * 3,
        9 + heroGlow * 1.2,
      )
      .fill({ color: 0x010307, alpha: 0.24 })
    const activeHordeCount = this.enemies.reduce(
      (count, enemy) => count + (enemy.active && !enemy.isBoss ? 1 : 0),
      0,
    )
    for (const enemy of this.enemies) {
      if (!enemy.active && enemy.deathMotionRemaining <= 0) continue
      const renderX = lerp(enemy.previousX, enemy.x, this.interpolation)
      const renderY = lerp(enemy.previousY, enemy.y, this.interpolation)
      const moveRatio = enemy.active
        ? clamp(Math.hypot(enemy.vx, enemy.vy) / Math.max(1, enemy.speed), 0, 1.6)
        : 0
      const hitProgress = motionProgress(
        enemy.hitMotionRemaining,
        enemy.hitMotionDuration,
      )
      const deathProgress = motionProgress(
        enemy.deathMotionRemaining,
        enemy.deathMotionDuration,
      )
      const attackProgress = deathProgress >= 0
        ? -1
        : motionProgress(
            enemy.attackMotionRemaining,
            enemy.attackMotionDuration,
          )
      if (enemy.isBoss) {
        const clipFrame = resolveBossClipFrame({
          bossId: this.bossLevel.bossId,
          time: this.motionClock,
          moving: moveRatio,
          attackMotionStyle: enemy.attackMotionStyle,
          attackMotionRemaining: enemy.attackMotionRemaining,
          attackMotionDuration: enemy.attackMotionDuration,
          hitMotionRemaining: enemy.hitMotionRemaining,
          hitMotionDuration: enemy.hitMotionDuration,
          deathMotionRemaining: enemy.deathMotionRemaining,
          deathMotionDuration: enemy.deathMotionDuration,
        })
        const authoredTexture = this.bossMotionTexture(clipFrame)
        if (authoredTexture) enemy.sprite.texture = authoredTexture
        this.host.dataset.bossAnimationState = clipFrame.state
        this.host.dataset.bossAnimationPose = clipFrame.pose
        this.host.dataset.bossQuadruped = String(clipFrame.quadruped)
      } else {
        const clipFrame = resolveEnemyClipFrame({
          enemyId: enemy.id,
          uid: enemy.uid,
          time: this.motionClock,
          moving: moveRatio,
          attackMotionStyle: enemy.attackMotionStyle,
          attackMotionRemaining: enemy.attackMotionRemaining,
          attackMotionDuration: enemy.attackMotionDuration,
          hitMotionRemaining: enemy.hitMotionRemaining,
          hitMotionDuration: enemy.hitMotionDuration,
          deathMotionRemaining: enemy.deathMotionRemaining,
          deathMotionDuration: enemy.deathMotionDuration,
        })
        const authoredTexture = this.enemyMotionTexture(clipFrame)
        if (authoredTexture && enemy.sprite.texture !== authoredTexture) {
          enemy.sprite.texture = authoredTexture
        }
      }
      const pose = enemy.isBoss
        ? sampleBossMotion({
            time: this.motionClock,
            moving: moveRatio,
            attackProgress,
            attackAngle: enemy.attackMotionAngle,
            attackStyle: enemy.attackMotionStyle,
            reducedMotion: this.settings.reducedShake,
            bossFrame: this.bossLevel.bossFrame,
            levelId: this.bossLevel.id,
            phase: enemy.phase,
            hitProgress,
            deathProgress,
            reactionAngle: enemy.reactionAngle,
          })
        : sampleEnemyMotion({
            time: this.motionClock,
            moving: moveRatio,
            attackProgress,
            attackAngle: enemy.attackMotionAngle,
            attackStyle: enemy.attackMotionStyle,
            reducedMotion: this.settings.reducedShake,
            id: enemy.id,
            uid: enemy.uid,
            hitProgress,
            deathProgress,
            reactionAngle: enemy.reactionAngle,
          })
      enemy.sprite.anchor.set(
        0.5 + pose.pivotX,
        (enemy.isBoss ? 0.62 : 0.6) + pose.pivotY,
      )
      if (enemy.active) {
        this.drawEnemyMotionAccent(
          enemy,
          renderX,
          renderY,
          pose,
          moveRatio,
          attackProgress,
          activeHordeCount,
        )
      }
      enemy.sprite.position.set(renderX + pose.offsetX, renderY + pose.offsetY)
      enemy.sprite.rotation = pose.rotation
      const facingScale = enemy.isBoss
        ? bossSpriteFacingScale(this.bossLevel.bossId, enemy.facing)
        : enemy.facing
      enemy.sprite.scale.set(
        enemy.baseScaleX * facingScale * pose.scaleX,
        enemy.baseScaleY * pose.scaleY,
      )
      enemy.sprite.tint = enemy.hitFlash > 0 ? 0xffffff : enemy.isBoss ? this.bossTint() : 0xffffff
      enemy.sprite.alpha = pose.alpha
    }

    this.projectileTrailGraphics.clear()
    const sceneVfxScale = this.currentSceneVfxEnergyScale()
    this.projectileTrailGraphics.alpha = Math.max(0.48, sceneVfxScale)
    this.motionEchoLayer.alpha = Math.max(0.52, sceneVfxScale)
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue
      const renderX = lerp(projectile.previousX, projectile.x, this.interpolation)
      const renderY = lerp(projectile.previousY, projectile.y, this.interpolation)
      projectile.sprite.position.set(renderX, renderY)
      if (
        projectile.weaponId === 'crescent-array' &&
        this.crescentMoonbladeFrames.length > 0
      ) {
        const frameIndex =
          Math.floor(
            this.motionClock * 18 + projectile.visualSeed * 1.73,
          ) % this.crescentMoonbladeFrames.length
        projectile.sprite.texture = this.crescentMoonbladeFrames[frameIndex]
      }
      projectile.sprite.rotation = Math.atan2(projectile.vy, projectile.vx)
      const projectileAlpha =
        projectile.weaponId === 'rift-seeds'
          ? 0.82 + Math.sin(this.motionClock * 9 + projectile.x * 0.01) * 0.12
          : 0.98
      projectile.sprite.alpha =
        projectileAlpha * Math.max(0.58, sceneVfxScale + 0.08)
      this.drawProjectileTrail(projectile, renderX, renderY)
    }
    this.drawPersistentSpellActors(sceneVfxScale)
    this.drawHostileProjectiles()

    this.pickupAuraGraphics.clear()
    for (const pickup of this.pickups) {
      if (!pickup.active) continue
      const supportPickup = pickup.kind !== 'xp'
      const renderX = lerp(pickup.previousX, pickup.x, this.interpolation)
      const renderY =
        lerp(pickup.previousY, pickup.y, this.interpolation) +
        Math.sin(pickup.age * (supportPickup ? 3.6 : 5)) * (supportPickup ? 6 : 3)
      pickup.sprite.position.set(renderX, renderY)
      pickup.sprite.rotation = pickup.age * (supportPickup ? 0.34 : 0.7)
      pickup.sprite.alpha = supportPickup
        ? 0.9 + Math.sin(pickup.age * 4.4) * 0.1
        : 0.96
      if (supportPickup) {
        this.drawSupportPickupBeacon(
          this.pickupAuraGraphics,
          pickup,
          renderX,
          renderY,
        )
      }
    }

    this.drawTrace()
    this.drawEffects()
    this.drawJoystick()
    this.updateCamera()
    this.syncCombatTextSprites()
  }

  private layout() {
    if (!this.initialized) return
    const width = this.app.screen.width
    const height = this.app.screen.height
    if (width <= 0 || height <= 0) return

    this.screenFlash.clear().rect(0, 0, width, height).fill({ color: 0xfff1b0, alpha: 1 })
    this.cinematicTitle.position.set(width * 0.5, height * 0.5)
    this.lastWidth = width
    this.lastHeight = height
    this.updateCamera(true)
  }

  private updateCamera(force = false) {
    if (!this.initialized) return
    const width = this.app.screen.width
    const height = this.app.screen.height
    if (!force && (width !== this.lastWidth || height !== this.lastHeight)) {
      this.layout()
      return
    }
    if (width <= 0 || height <= 0) return

    const scale = Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT)
    const viewWidth = width / scale
    const viewHeight = height / scale
    const targetX = clamp(this.player.x, viewWidth * 0.5, WORLD_WIDTH - viewWidth * 0.5)
    const targetY = clamp(this.player.y, viewHeight * 0.5, WORLD_HEIGHT - viewHeight * 0.5)
    this.cameraX = force ? targetX : lerp(this.cameraX, targetX, 0.12)
    this.cameraY = force ? targetY : lerp(this.cameraY, targetY, 0.12)
    const shakeAmount = this.settings.reducedShake ? 0 : this.shake
    const shakeX = Math.sin(this.elapsed * 91.7) * shakeAmount
    const shakeY = Math.cos(this.elapsed * 76.3) * shakeAmount * 0.65
    this.world.scale.set(scale)
    this.world.position.set(
      width * 0.5 - this.cameraX * scale + shakeX,
      height * 0.5 - this.cameraY * scale + shakeY,
    )
  }

  private updateSpawning(delta: number) {
    if (this.bossSpawned && this.elapsed > this.level.duration) return
    const pressure = hordePressureAt(this.elapsed, this.level.duration)
    const baseline = sectorBaselineAt(
      this.level.spawnRate,
      this.level.enemyHealth,
      this.elapsed,
    )
    let activeCount = this.enemies.reduce(
      (total, enemy) => total + (enemy.active && !enemy.isBoss ? 1 : 0),
      0,
    )
    const cap = hordeActiveCap(this.level.id, pressure.progress)
    const intensity =
      baseline.spawnRate *
      pressure.spawnIntensityFactor *
      GLOBAL_DIFFICULTY_MULTIPLIER
    this.spawnBudget = Math.min(
      3.5,
      this.spawnBudget + delta * intensity * (this.boss ? 0.45 : 1),
    )

    let spawnedThisStep = 0
    while (
      this.spawnBudget >= 1 &&
      activeCount + 1 < cap &&
      spawnedThisStep < 4
    ) {
      this.spawnEnemy()
      activeCount += 1
      spawnedThisStep += 1
      this.spawnBudget -= 1
    }
  }

  private spawnEnemy() {
    if (!this.enemyMotionFrames.some((frames) => frames.length > 0)) return
    let enemy = this.enemies.find(
      (candidate) => !candidate.active && candidate.deathMotionRemaining <= 0,
    )
    if (!enemy) {
      const initialFrame = resolveEnemyClipFrame({
        enemyId: 'maskling',
        uid: 0,
        time: 0,
        moving: 0,
        attackMotionStyle: 'none',
        attackMotionRemaining: 0,
        attackMotionDuration: 0,
      })
      const sprite = new Sprite(
        this.enemyMotionTexture(initialFrame) ?? Texture.WHITE,
      )
      sprite.anchor.set(0.5, 0.6)
      sprite.visible = false
      this.enemyLayer.addChild(sprite)
      enemy = {
        active: false,
        uid: 0,
        id: 'maskling',
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        vx: 0,
        vy: 0,
        radius: 24,
        speed: 80,
        hp: 10,
        maxHp: 10,
        damage: 7,
        xp: 3,
        contactCooldown: 0,
        hitFlash: 0,
        hitMotionRemaining: 0,
        hitMotionDuration: 0,
        deathMotionRemaining: 0,
        deathMotionDuration: 0,
        reactionAngle: 0,
        pendingContactDamage: 0,
        blinkTargetX: null,
        blinkTargetY: null,
        isBoss: false,
        phase: 1,
        attackTimer: 0,
        facing: 1,
        baseScaleX: 1,
        baseScaleY: 1,
        attackMotionStyle: 'none',
        attackMotionRemaining: 0,
        attackMotionDuration: 0,
        attackMotionAngle: 0,
        sprite,
      }
      this.enemies.push(enemy)
    }

    const pressure = hordePressureAt(this.elapsed, this.level.duration)
    const baseline = sectorBaselineAt(
      this.level.spawnRate,
      this.level.enemyHealth,
      this.elapsed,
    )
    const id = this.random.pick(eligibleEnemyPool(this.level.enemyPool, pressure.progress))
    const spawn = this.findSafeSpawnPoint(480, 680, 60, 54)
    const { x, y } = spawn
    const typeScale = {
      maskling: 1,
      shardwing: 0.72,
      cantor: 1.18,
      railjaw: 1.42,
      chronowisp: 0.9,
      'cinder-guard': 1.68,
    }[id]
    const health =
      34 *
      baseline.enemyHealth *
      typeScale *
      pressure.enemyHealthMultiplier *
      GLOBAL_DIFFICULTY_MULTIPLIER
    const size = 66 * Math.sqrt(typeScale)

    enemy.active = true
    enemy.uid = ++this.enemyUid
    enemy.id = id
    enemy.x = x
    enemy.y = y
    enemy.previousX = x
    enemy.previousY = y
    enemy.vx = 0
    enemy.vy = 0
    enemy.radius = 19 + size * 0.13
    enemy.speed =
      (id === 'shardwing' ? 142 : id === 'chronowisp' ? 118 : id === 'cinder-guard' ? 61 : 86) *
      (1 + this.level.difficulty * 0.035) *
      pressure.enemySpeedMultiplier
    enemy.hp = health
    enemy.maxHp = health
    enemy.damage =
      (7 + this.level.difficulty * 2.1 + typeScale * 1.7) *
      pressure.enemyDamageMultiplier
    enemy.xp = Math.max(2, Math.round(2.5 * typeScale))
    enemy.contactCooldown = 0
    enemy.hitFlash = 0
    enemy.hitMotionRemaining = 0
    enemy.hitMotionDuration = 0
    enemy.deathMotionRemaining = 0
    enemy.deathMotionDuration = 0
    enemy.reactionAngle = 0
    enemy.pendingContactDamage = 0
    enemy.blinkTargetX = null
    enemy.blinkTargetY = null
    enemy.isBoss = false
    enemy.phase = 1
    enemy.facing = this.random.next() > 0.5 ? 1 : -1
    enemy.attackMotionStyle = 'none'
    enemy.attackMotionRemaining = 0
    enemy.attackMotionDuration = 0
    enemy.attackMotionAngle = 0
    enemy.attackTimer =
      id === 'cantor'
        ? this.random.range(3.8, 5.6)
        : id === 'shardwing' && this.level.id >= 7
          ? this.random.range(5.4, 7.2)
        : id === 'railjaw'
          ? this.random.range(4.2, 6.2)
          : id === 'chronowisp'
            ? this.random.range(4.8, 7)
            : id === 'cinder-guard'
              ? this.random.range(5.2, 7.8)
              : 99
    const initialFrame = resolveEnemyClipFrame({
      enemyId: id,
      uid: enemy.uid,
      time: this.motionClock,
      moving: 0,
      attackMotionStyle: 'none',
      attackMotionRemaining: 0,
      attackMotionDuration: 0,
    })
    enemy.sprite.texture =
      this.enemyMotionTexture(initialFrame) ?? enemy.sprite.texture
    enemy.sprite.anchor.set(0.5, 0.6)
    enemy.sprite.width = size
    enemy.sprite.height = size * 1.2
    enemy.baseScaleX = Math.abs(enemy.sprite.scale.x)
    enemy.baseScaleY = Math.abs(enemy.sprite.scale.y)
    enemy.sprite.scale.set(enemy.baseScaleX * enemy.facing, enemy.baseScaleY)
    enemy.sprite.rotation = 0
    enemy.sprite.tint = 0xffffff
    enemy.sprite.filters = null
    if (enemy.sprite.parent !== this.enemyLayer) {
      this.enemyLayer.addChild(enemy.sprite)
    }
    enemy.sprite.visible = true
    enemy.sprite.position.set(x, y)
  }

  private spawnShowcaseTargets() {
    const weaponId = this.showcase?.weaponId
    const offsets: ReadonlyArray<readonly [number, number]> =
      weaponId === 'arc-choir'
        ? [
            [170, 0],
            [220, 80],
            [160, 150],
            [70, 180],
            [-20, 130],
            [-70, 40],
            [-30, -70],
            [60, -140],
            [160, -160],
            [250, -90],
          ]
        : weaponId === 'rift-seeds'
          ? [
              [150, 0],
              [205, 96],
              [96, 172],
              [-75, 166],
              [-188, 52],
              [-164, -104],
              [-34, -186],
              [132, -154],
            ]
          : weaponId === 'ash-halo'
            ? [
                [154, -122],
                [202, -102],
                [254, -74],
                [176, -42],
                [226, -18],
                [282, -44],
                [194, 24],
                [268, 38],
              ]
            : weaponId === 'comet-swarm'
              ? [
                  [0, -330],
                  [118, -326],
                  [-118, -326],
                  [226, -256],
                  [-226, -256],
                  [302, -170],
                  [-302, -170],
                  [0, -404],
                ]
            : weaponId === 'null-bell'
              ? [
                  [142, -132],
                  [182, -94],
                  [224, -58],
                  [266, -20],
                  [174, 14],
                  [216, 48],
                  [260, 82],
                  [304, 112],
                ]
              : weaponId === 'crescent-array'
                ? [
                    [148, 0],
                    [106, 106],
                    [0, 150],
                    [-106, 106],
                    [-150, 0],
                    [-106, -106],
                    [0, -150],
                    [106, -106],
                  ]
                : [
                    [220, 0],
                    [176, 126],
                    [52, 206],
                    [-124, 184],
                    [-218, 48],
                    [-190, -126],
                    [-38, -208],
                    [158, -150],
                  ]

    for (const [offsetX, offsetY] of offsets) {
      this.spawnEnemy()
      const enemy = [...this.enemies].reverse().find((candidate) => candidate.active)
      if (!enemy) continue
      enemy.x = this.player.x + offsetX
      enemy.y = this.player.y + offsetY
      enemy.previousX = enemy.x
      enemy.previousY = enemy.y
      enemy.speed = 0
      enemy.damage = 0
      enemy.hp = 1_000_000
      enemy.maxHp = 1_000_000
      enemy.xp = 0
      enemy.attackTimer = Number.POSITIVE_INFINITY
      enemy.contactCooldown = Number.POSITIVE_INFINITY
    }

    this.host.dataset.showcaseReady = 'false'
    this.host.dataset.showcaseWeapon = this.showcase?.weaponId ?? ''
    this.host.dataset.showcaseState = this.showcase?.state ?? ''
  }

  private spawnBoss() {
    if (
      this.bossSpawned ||
      (!this.bossFrames.length &&
        !this.bossMotionFrames.some((frames) => frames.length > 0))
    ) return
    this.bossSpawned = true
    let enemy = this.enemies.find(
      (candidate) => !candidate.active && candidate.deathMotionRemaining <= 0,
    )
    if (!enemy) {
      const sprite = new Sprite(
        this.bossMotionFrames[0][0] ?? this.bossFrames[0] ?? Texture.WHITE,
      )
      sprite.anchor.set(0.5, 0.62)
      sprite.visible = false
      this.enemyLayer.addChild(sprite)
      enemy = {
        active: false,
        uid: 0,
        id: 'cinder-guard',
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        vx: 0,
        vy: 0,
        radius: 62,
        speed: 55,
        hp: 1,
        maxHp: 1,
        damage: 18,
        xp: 0,
        contactCooldown: 0,
        hitFlash: 0,
        hitMotionRemaining: 0,
        hitMotionDuration: 0,
        deathMotionRemaining: 0,
        deathMotionDuration: 0,
        reactionAngle: 0,
        pendingContactDamage: 0,
        blinkTargetX: null,
        blinkTargetY: null,
        isBoss: true,
        phase: 1,
        attackTimer: 1.8,
        facing: 1,
        baseScaleX: 1,
        baseScaleY: 1,
        attackMotionStyle: 'none',
        attackMotionRemaining: 0,
        attackMotionDuration: 0,
        attackMotionAngle: 0,
        sprite,
      }
      this.enemies.push(enemy)
    }

    const spawn = this.findSafeSpawnPoint(390, 440, 150, 130, -Math.PI * 0.5, 0.35)
    const { x, y } = spawn
    const baseHealth =
      (this.qaMode ? 850 : 1120) *
      this.bossLevel.enemyHealth *
      (1 + this.bossLevel.id * 0.12) *
      GLOBAL_DIFFICULTY_MULTIPLIER *
      this.runConfig.bossHealthMultiplier
    const estimatedDps = estimateBossDps({
      playerLevel: this.player.level,
      weapons: this.weapons,
      modules: this.modules,
      traceMods: this.traceMods,
      forceRank: this.persistentUpgrades.force ?? 0,
      bossDamageRank: this.persistentUpgrades['dawn-within'] ?? 0,
      critRank: this.persistentUpgrades['parallax-eye'] ?? 0,
    })
    const health = this.qaMode
      ? baseHealth
      : bossHealthForBuild(baseHealth, estimatedDps, this.bossLevel.id)

    enemy.active = true
    enemy.uid = ++this.enemyUid
    enemy.id = 'cinder-guard'
    enemy.x = x
    enemy.y = y
    enemy.previousX = x
    enemy.previousY = y
    enemy.vx = 0
    enemy.vy = 0
    enemy.radius = 58
    enemy.speed = 48 + this.bossLevel.difficulty * 4
    enemy.hp = health
    enemy.maxHp = health
    enemy.damage = 18 + this.bossLevel.difficulty * 3.1
    enemy.xp = 0
    enemy.contactCooldown = 0
    enemy.hitFlash = 0
    enemy.hitMotionRemaining = 0
    enemy.hitMotionDuration = 0
    enemy.deathMotionRemaining = 0
    enemy.deathMotionDuration = 0
    enemy.reactionAngle = 0
    enemy.pendingContactDamage = 0
    enemy.blinkTargetX = null
    enemy.blinkTargetY = null
    enemy.isBoss = true
    enemy.phase = 1
    enemy.facing = this.player.x >= x ? 1 : -1
    const introDuration = this.qaMode ? 1.05 : 1.65
    enemy.attackMotionStyle = 'boss-intro'
    enemy.attackMotionRemaining = introDuration
    enemy.attackMotionDuration = enemy.attackMotionRemaining
    enemy.attackMotionAngle = Math.atan2(this.player.y - y, this.player.x - x)
    enemy.attackTimer = 1.75
    const initialClipFrame = resolveBossClipFrame({
      bossId: this.bossLevel.bossId,
      time: this.motionClock,
      moving: 0,
      attackMotionStyle: enemy.attackMotionStyle,
      attackMotionRemaining: enemy.attackMotionRemaining,
      attackMotionDuration: enemy.attackMotionDuration,
    })
    enemy.sprite.texture =
      this.bossMotionTexture(initialClipFrame) ??
      this.bossFrames[this.bossLevel.bossFrame % 6]
    enemy.sprite.anchor.set(0.5, 0.62)
    const authoredBossSize = 225 + this.bossLevel.id * 3
    enemy.sprite.width = authoredBossSize
    enemy.sprite.height = authoredBossSize
    enemy.baseScaleX = Math.abs(enemy.sprite.scale.x)
    enemy.baseScaleY = Math.abs(enemy.sprite.scale.y)
    enemy.sprite.scale.set(
      enemy.baseScaleX *
        bossSpriteFacingScale(this.bossLevel.bossId, enemy.facing),
      enemy.baseScaleY,
    )
    enemy.sprite.rotation = 0
    enemy.sprite.tint = this.bossTint()
    enemy.sprite.filters = null
    // Boss silhouettes remain above ground spells and telegraphs. This preserves
    // the authored texture at full opacity while still allowing attack VFX to
    // bloom around, rather than through, the character.
    this.enemyForegroundLayer.addChild(enemy.sprite)
    enemy.sprite.visible = true
    enemy.sprite.position.set(x, y)
    this.boss = enemy
    this.bossPatternDirectorState = createBossPatternDirectorState()
    this.bossIntroTimer = introDuration
    // The React HUD owns the sovereign name reveal. Keep the canvas layer focused
    // on the letterbox, shake, and particle entrance so the title is announced once.
    this.cinematicTitle.text = ''
    this.audio.playBossIntro()
    this.shake = 14
    this.screenFlashAlpha = this.settings.reducedFlash ? 0.03 : 0.16
    this.emitSnapshot(true)
  }

  private updateEnemies(delta: number) {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      enemy.previousX = enemy.x
      enemy.previousY = enemy.y
      enemy.contactCooldown = Math.max(0, enemy.contactCooldown - delta)
      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta)

      if (
        enemy.blinkTargetX !== null &&
        enemy.blinkTargetY !== null &&
        enemy.attackMotionStyle === 'blink' &&
        motionProgress(enemy.attackMotionRemaining, enemy.attackMotionDuration) >= 0.46
      ) {
        this.audio.playHostileSpecialRelease('elite', 'blink')
        enemy.x = enemy.blinkTargetX
        enemy.y = enemy.blinkTargetY
        enemy.previousX = enemy.x
        enemy.previousY = enemy.y
        enemy.blinkTargetX = null
        enemy.blinkTargetY = null
        const blinkColor = this.actorAccentColor(enemy)
        this.spawnBurst(enemy.x, enemy.y, blinkColor, 10, 150)
      }

      const contactAttackProgress = motionProgress(
        enemy.attackMotionRemaining,
        enemy.attackMotionDuration,
      )
      if (
        enemy.pendingContactDamage > 0 &&
        enemy.attackMotionStyle === 'melee' &&
        contactAttackProgress >= 0.42
      ) {
        if (enemy.isBoss) {
          this.audio.playHostileSpecialRelease('boss', 'melee')
        }
        if (
          circleTouchesHeroBody(
            this.player.x,
            this.player.y,
            enemy.x,
            enemy.y,
            enemy.radius + HERO_MELEE_RELEASE_PADDING,
          )
        ) {
          this.damagePlayer(enemy.pendingContactDamage, {
            kind: 'contact',
            boss: enemy.isBoss,
            originX: enemy.x,
            originY: enemy.y,
            color: this.actorAccentColor(enemy),
          })
        }
        enemy.pendingContactDamage = 0
      } else if (enemy.pendingContactDamage > 0 && contactAttackProgress < 0) {
        enemy.pendingContactDamage = 0
      }

      if (enemy.isBoss) {
        const healthRatio = enemy.hp / enemy.maxHp
        const nextPhase = healthRatio <= 0.34 ? 3 : healthRatio <= 0.67 ? 2 : 1
        if (nextPhase !== enemy.phase) {
          enemy.phase = nextPhase
          this.triggerEnemyAttack(
            enemy,
            'boss-phase',
            0.78,
            Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x),
            true,
          )
          this.shake = 15
          this.screenFlashAlpha = this.settings.reducedFlash ? 0.04 : 0.19
          this.spawnBurst(
            enemy.x,
            enemy.y + enemy.radius * 0.36,
            bossPresentation(this.bossLevel.bossId).secondaryColor,
            this.visualLod === 'mobile' ? 18 : 30,
            240,
          )
          this.audio.playBossPhase(nextPhase)
        }
        enemy.attackTimer -= delta
        if (enemy.attackTimer <= 0) {
          this.bossAttack(enemy)
          enemy.attackTimer = bossAttackRecoverySeconds(this.bossLevel.id, enemy.phase)
        }
      }

      const dx = this.player.x - enemy.x
      const dy = this.player.y - enemy.y
      const distance = Math.max(0.001, Math.hypot(dx, dy))
      if (!enemy.isBoss && enemy.attackTimer < 90) {
        enemy.attackTimer -= delta
        if (enemy.attackTimer <= 0 && this.activeTelegraphCount < 22) {
          this.performEnemySpecial(enemy, Math.atan2(dy, dx), distance)
        }
      }
      const wobble =
        enemy.id === 'chronowisp'
          ? Math.sin(this.elapsed * 5.2 + enemy.uid * 0.31) * 0.55
          : enemy.id === 'shardwing'
            ? Math.sin(this.elapsed * 3.6 + enemy.uid) * 0.28
            : 0
      const speed = enemy.speed * (enemy.isBoss ? 0.75 + enemy.phase * 0.12 : 1)
      enemy.vx = ((dx / distance) * Math.cos(wobble) - (dy / distance) * Math.sin(wobble)) * speed
      enemy.vy = ((dx / distance) * Math.sin(wobble) + (dy / distance) * Math.cos(wobble)) * speed
      if (enemy.isBoss) {
        if (Math.abs(dx) > 1) enemy.facing = dx >= 0 ? 1 : -1
      } else if (Math.abs(enemy.vx) > 2) {
        enemy.facing = enemy.vx >= 0 ? 1 : -1
      }
      enemy.x = clamp(enemy.x + enemy.vx * delta, 38, WORLD_WIDTH - 38)
      enemy.y = clamp(enemy.y + enemy.vy * delta, 34, WORLD_HEIGHT - 34)

      if (
        circleTouchesHeroBody(
          this.player.x,
          this.player.y,
          enemy.x,
          enemy.y,
          enemy.radius + HERO_CONTACT_TRIGGER_PADDING,
        ) &&
        enemy.contactCooldown <= 0
      ) {
        this.triggerEnemyAttack(
          enemy,
          'melee',
          enemy.isBoss ? 0.42 : 0.34,
          Math.atan2(dy, dx),
          enemy.isBoss,
        )
        if (enemy.attackMotionStyle === 'melee') {
          enemy.pendingContactDamage = enemy.damage
        }
        enemy.contactCooldown = enemy.isBoss ? 0.72 : 0.92
        if (!enemy.isBoss) {
          enemy.x -= (dx / distance) * 32
          enemy.y -= (dy / distance) * 32
        }
      }
    }
  }

  private performEnemySpecial(enemy: EnemyEntity, angle: number, distance: number) {
    if (enemy.id === 'cantor') {
      const destination = this.predictedPlayerPoint(0.34)
      this.triggerEnemyAttack(
        enemy,
        'cast',
        this.hostileWarningWindow(1.16),
        angle,
        true,
      )
      this.launchHostileProjectile(enemy, destination, {
        windup: 0.98,
        flight: 0.38,
        arcHeight: 118,
        radius: 58,
        damage: enemy.damage * 0.8,
        color: this.actorAccentColor(enemy),
      })
      enemy.attackTimer = this.random.range(4.8, 6.8)
      return
    }

    if (enemy.id === 'shardwing' && this.level.id >= 7) {
      const destination = this.predictedPlayerPoint(0.42)
      const normalX = -Math.sin(angle)
      const normalY = Math.cos(angle)
      this.triggerEnemyAttack(
        enemy,
        'cast',
        this.hostileWarningWindow(1.02),
        angle,
        true,
      )
      for (const side of [-1, 1]) {
        this.launchHostileProjectile(
          enemy,
          {
            x: destination.x + normalX * side * 42,
            y: destination.y + normalY * side * 42,
          },
          {
            windup: 0.82 + (side > 0 ? 0.08 : 0),
            flight: 0.34,
            arcHeight: 86,
            radius: 42,
            damage: enemy.damage * 0.58,
            color: this.actorAccentColor(enemy),
          },
        )
      }
      enemy.attackTimer = this.random.range(6.1, 8)
      return
    }

    if (enemy.id === 'railjaw') {
      this.triggerEnemyAttack(
        enemy,
        'charge',
        this.hostileWarningWindow(0.76),
        angle,
        true,
      )
      this.queueLineTelegraph(
        enemy.x,
        enemy.y,
        angle,
        Math.min(680, distance + 140),
        34,
        0.76,
        enemy.damage * 1.15,
        false,
        this.actorAccentColor(enemy),
        true,
      )
      enemy.attackTimer = this.random.range(5.4, 7.4)
      return
    }

    if (enemy.id === 'chronowisp') {
      if (
        this.level.id >= 4 &&
        this.random.next() < Math.min(0.8, 0.36 + this.level.id * 0.045)
      ) {
        const destination = this.predictedPlayerPoint(0.48)
        this.triggerEnemyAttack(
          enemy,
          'cast',
          this.hostileWarningWindow(1.08),
          angle,
          true,
        )
        this.launchHostileProjectile(enemy, destination, {
          windup: 0.9,
          flight: 0.38,
          arcHeight: 94,
          radius: 55,
          damage: enemy.damage * 0.88,
          color: this.actorAccentColor(enemy),
        })
        enemy.attackTimer = this.random.range(5.6, 7.6)
        return
      }
      this.triggerEnemyAttack(enemy, 'blink', 0.52, angle, true)
      const blinkAngle = this.random.range(0, Math.PI * 2)
      const blinkDistance = this.random.range(190, 300)
      enemy.blinkTargetX = clamp(
        this.player.x + Math.cos(blinkAngle) * blinkDistance,
        52,
        WORLD_WIDTH - 52,
      )
      enemy.blinkTargetY = clamp(
        this.player.y + Math.sin(blinkAngle) * blinkDistance,
        48,
        WORLD_HEIGHT - 48,
      )
      enemy.contactCooldown = 0.9
      const blinkColor = this.actorAccentColor(enemy)
      this.spawnBurst(enemy.x, enemy.y, blinkColor, 10, 130)
      enemy.attackTimer = this.random.range(5.8, 8)
      return
    }

    if (enemy.id === 'cinder-guard') {
      if (this.level.id >= 5 && this.random.next() < 0.62) {
        const destination = this.predictedPlayerPoint(0.5)
        this.triggerEnemyAttack(
          enemy,
          'cast',
          this.hostileWarningWindow(1.22),
          angle,
          true,
        )
        this.launchHostileProjectile(enemy, destination, {
          windup: 1.04,
          flight: 0.46,
          arcHeight: 172,
          radius: 82,
          damage: enemy.damage * 1.05,
          color: this.actorAccentColor(enemy),
        })
        enemy.attackTimer = this.random.range(6.2, 8.2)
        return
      }
      this.triggerEnemyAttack(
        enemy,
        'slam',
        this.hostileWarningWindow(0.92),
        angle,
        true,
      )
      this.queueCircleTelegraph(
        enemy.x,
        enemy.y,
        92,
        0.92,
        enemy.damage,
        false,
        this.actorAccentColor(enemy),
        true,
      )
      enemy.attackTimer = this.random.range(6.2, 8.4)
    }
  }

  private predictedPlayerPoint(leadSeconds: number): Vec2 {
    const velocityX = (this.player.x - this.player.previousX) / FIXED_STEP
    const velocityY = (this.player.y - this.player.previousY) / FIXED_STEP
    const velocity = Math.hypot(velocityX, velocityY)
    const predictionScale =
      velocity > 0.01
        ? Math.min(1, 150 / Math.max(1, velocity * leadSeconds))
        : 0
    return {
      x: clamp(
        this.player.x + velocityX * leadSeconds * predictionScale,
        64,
        WORLD_WIDTH - 64,
      ),
      y: clamp(
        this.player.y + velocityY * leadSeconds * predictionScale,
        64,
        WORLD_HEIGHT - 64,
      ),
    }
  }

  private updateLightRing(delta: number) {
    const profile = lightRingProfile(this.lightRingRank)
    if (!profile) return

    this.lightRingTickRemaining -= delta
    if (this.lightRingTickRemaining > 0) return
    this.lightRingTickRemaining = profile.tickSeconds

    // The authored hero root is planted at the boots. Center the skill on the
    // visible body/hitbox instead of that ground-contact root so its damage
    // footprint and its rendered corona remain concentric with the Bearer.
    const ringCenterX = this.player.x
    const ringCenterY = this.player.y + HERO_BODY_CENTER_OFFSET_Y
    const candidates = this.queryEnemyGrid(
      ringCenterX,
      ringCenterY,
      profile.radius + 150,
    )
    let hitCount = 0
    for (const enemy of candidates) {
      if (
        !enemy.active ||
        !lightRingTouchesTarget(
          this.lightRingRank,
          ringCenterX,
          ringCenterY,
          enemy.x,
          enemy.y,
          enemy.radius,
        )
      ) {
        continue
      }

      this.damageEnemy(
        enemy,
        lightRingTickDamage(this.lightRingRank, enemy.isBoss),
        'helio-lance',
        false,
        false,
        profile.awakened ? 0xfff4ca : 0xe9dfbd,
      )
      hitCount += 1
    }

    this.audio.playLightRingPulse(this.lightRingRank, hitCount > 0)

    if (hitCount > 0) {
      this.lightRingPulse = Math.max(
        this.lightRingPulse,
        this.settings.reducedFlash ? 0.1 : 0.18,
      )
      this.host.dataset.lightRingLastHits = String(hitCount)
    }
  }

  private updateWeapons(delta: number) {
    if (!this.enemies.some((enemy) => enemy.active)) return
    const nextDawncasterCooldown = this.weapons.reduce((next, owned) => {
      if (!DAWNCASTER_WEAPON_IDS.has(owned.id)) return next
      return Math.min(next, this.weaponCooldowns.get(owned.id) ?? Number.POSITIVE_INFINITY)
    }, Number.POSITIVE_INFINITY)
    if (
      nextDawncasterCooldown > 0 &&
      nextDawncasterCooldown <= HERO_FIRE_RELEASE_TIME
    ) {
      this.prepareHeroShot(nextDawncasterCooldown)
    }

    for (const owned of this.weapons) {
      const definition = WEAPONS[owned.id]
      let cooldown = (this.weaponCooldowns.get(owned.id) ?? 0) - delta
      if (cooldown <= 0) {
        this.fireWeapon(owned)
        const moduleRank = this.modules.find((module) => module.id === definition.moduleId)?.rank ?? 0
        const density = this.nearbyEnemyCount(this.player.x, this.player.y, 250)
        const redShiftCadence = this.traceMods.includes('red-shift') ? Math.max(0.72, 1 - density * 0.012) : 1
        cooldown = weaponCooldownSeconds(
          owned.id,
          owned.rank,
          moduleRank,
          Boolean(owned.awakened),
          redShiftCadence,
        )
      }
      this.weaponCooldowns.set(owned.id, cooldown)
    }
  }

  private castReplacementWeapon(
    weaponId: 'ash-halo' | 'null-bell',
    visualState: WeaponVfxState,
    castDamageBudget: number,
    moduleRank: number,
    seed: number,
  ) {
    const targets = this.enemies
      .filter((enemy) => enemy.active)
      .map((enemy) => ({
        id: enemy.uid,
        x: enemy.x,
        y: enemy.y,
        vx: enemy.vx,
        vy: enemy.vy,
        active: enemy.active,
      }))
    const buildInput = {
      origin: { x: this.player.x, y: this.player.y },
      targets,
      stage: visualState.stage,
      seed,
      minimumRange: 72,
      clusterRadius:
        weaponId === 'ash-halo'
          ? 160 + moduleRank * 14
          : 192 + moduleRank * 18,
      predictionSeconds:
        weaponId === 'null-bell' ? 0.3 + moduleRank * 0.035 : 0,
    } as const
    const pattern =
      buildReplacementWeaponPattern(weaponId, buildInput) ??
      buildReplacementWeaponPattern(weaponId, {
        ...buildInput,
        minimumRange: 0,
      })
    if (!pattern) return undefined

    const collisionTargets =
      pattern.kind === 'eclipse-harrow'
        ? targets.map((target) => ({
            ...target,
            x: target.x + target.vx * pattern.cluster.predictionSeconds,
            y: target.y + target.vy * pattern.cluster.predictionSeconds,
          }))
        : targets
    const hits = resolvePatternHits(collisionTargets, pattern.strikes)
    const enemiesById = new Map(
      this.enemies
        .filter((enemy) => enemy.active)
        .map((enemy) => [enemy.uid, enemy] as const),
    )
    const impacts: Vec2[] = []
    const connectedEnemies = hits
      .map((hit) => enemiesById.get(hit.targetId))
      .filter((enemy): enemy is EnemyEntity => Boolean(enemy?.active))
    const damageShares = distributeRemoteCastDamage(
      castDamageBudget,
      connectedEnemies,
    )
    for (let index = 0; index < connectedEnemies.length; index += 1) {
      const enemy = connectedEnemies[index]
      this.damageEnemy(enemy, damageShares[index] ?? 0, weaponId)
      if (impacts.length < 12) impacts.push({ x: enemy.x, y: enemy.y })
    }

    return { pattern, impacts }
  }

  private fireWeapon(owned: OwnedWeapon) {
    const definition = WEAPONS[owned.id]
    const target = this.nearestEnemy(this.player.x, this.player.y)
    if (!target) return
    const rank = Math.max(1, owned.rank)
    const moduleRank = this.modules.find((module) => module.id === definition.moduleId)?.rank ?? 0
    const visualState = resolveWeaponVfxState(rank, moduleRank, Boolean(owned.awakened))
    const visualSeed = this.attackVolley * 97 + rank * 13 + moduleRank * 29 + (owned.awakened ? 53 : 0)
    const damage = weaponCastDamageBudget(owned, moduleRank)
    const facingAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x)
    this.heroFacing = { x: Math.cos(facingAngle), y: Math.sin(facingAngle) }
    const weaponOrigin = this.currentHeroWeaponOrigin()
    const angle = angleFromOriginToTarget(weaponOrigin, target)
    const usesDawncaster = DAWNCASTER_WEAPON_IDS.has(owned.id)
    this.triggerHeroAttack(
      usesDawncaster ? 'hero-shot' : 'hero-cast',
      owned.id === 'null-bell' ? 0.48 : usesDawncaster ? 0.3 : 0.4,
      facingAngle,
    )
    this.attackVolley += 1

    switch (owned.id) {
      case 'helio-lance': {
        this.emitWeaponCastVfx(owned.id, visualState, angle, 0, visualSeed)
        const mainPierce = 1 + Math.floor(rank / 3)
        const totalWeight = owned.awakened ? 2.44 : 1
        const mainWeight = 1 / totalWeight
        this.spawnProjectile(
          owned.id,
          angle,
          720 + moduleRank * 55,
          (damage * mainWeight) / (mainPierce + 1),
          mainPierce,
          0,
          definition.color,
          1.45 + moduleRank * 0.14,
          visualState,
          visualSeed,
          damage * mainWeight,
        )
        if (owned.awakened) {
          const sideWeight = 0.72 / totalWeight
          this.spawnProjectile(
            owned.id,
            angle + 0.08,
            760,
            (damage * sideWeight) / 3,
            2,
            0,
            0xffffff,
            1.45,
            visualState,
            visualSeed + 1,
            damage * sideWeight,
          )
          this.spawnProjectile(
            owned.id,
            angle - 0.08,
            760,
            (damage * sideWeight) / 3,
            2,
            0,
            0xffffff,
            1.45,
            visualState,
            visualSeed + 2,
            damage * sideWeight,
          )
        }
        break
      }
      case 'crescent-array': {
        const blades = Math.min(10, 2 + rank + moduleRank + (owned.awakened ? 2 : 0))
        this.emitWeaponCastVfx(owned.id, visualState, angle, 116 + blades * 4, visualSeed)
        for (let index = 0; index < blades; index += 1) {
          const bladeAngle = (Math.PI * 2 * index) / blades + this.elapsed * 1.4
          this.spawnProjectile(
            owned.id,
            bladeAngle,
            310,
            damage / (blades * 3),
            2,
            0,
            definition.color,
            1.45,
            visualState,
            visualSeed + index,
            damage / blades,
          )
        }
        break
      }
      case 'arc-choir':
        this.chainLightning(
          target,
          damage,
          Math.min(6, 2 + rank + moduleRank + (owned.awakened ? 1 : 0)),
          owned.id,
          visualState,
          visualSeed,
        )
        break
      case 'rift-seeds':
        this.castAstralVerdict(
          target,
          damage,
          rank,
          moduleRank,
          Boolean(owned.awakened),
          visualState,
          visualSeed,
        )
        break
      case 'comet-swarm': {
        const profile = orbitingCometProfile(rank, Boolean(owned.awakened))
        this.emitWeaponCastVfx(
          owned.id,
          visualState,
          angle,
          profile.outerRadius,
          visualSeed,
        )
        this.armOrbitingComets(owned, visualState, damage, visualSeed)
        break
      }
      case 'ash-halo': {
        const cast = this.castReplacementWeapon(
          owned.id,
          visualState,
          damage,
          moduleRank,
          visualSeed,
        )
        if (cast) {
          this.emitWeaponCastVfx(
            owned.id,
            visualState,
            cast.pattern.aimAngle,
            190 + rank * 18 + moduleRank * 16,
            visualSeed,
            cast.impacts,
            cast.pattern,
          )
        }
        break
      }
      case 'mirror-bow': {
        this.armCinderwakeReavers(owned, visualState, damage, visualSeed, target)
        break
      }
      case 'null-bell': {
        const cast = this.castReplacementWeapon(
          owned.id,
          visualState,
          damage,
          moduleRank,
          visualSeed,
        )
        if (cast) {
          this.emitWeaponCastVfx(
            owned.id,
            visualState,
            cast.pattern.aimAngle,
            280 + rank * 24 + moduleRank * 18,
            visualSeed,
            cast.impacts,
            cast.pattern,
          )
        }
        break
      }
    }

    if (this.traceMods.includes('crossfire') && this.attackVolley % 4 === 0) {
      if (owned.id === 'rift-seeds') {
        this.castAstralVerdict(
          target,
          damage * 0.72,
          rank,
          moduleRank,
          Boolean(owned.awakened),
          visualState,
          visualSeed + 41,
        )
      } else if (owned.id === 'mirror-bow') {
        this.armCinderwakeReavers(
          owned,
          visualState,
          damage * 0.72,
          visualSeed + 41,
          target,
        )
      } else if (owned.id === 'comet-swarm') {
        this.armOrbitingComets(
          owned,
          visualState,
          damage * 0.72,
          visualSeed + 41,
        )
      } else if (owned.id === 'ash-halo' || owned.id === 'null-bell') {
        const echo = this.castReplacementWeapon(
          owned.id,
          visualState,
          damage * 0.72,
          moduleRank,
          visualSeed + 41,
        )
        if (echo) {
          this.emitWeaponCastVfx(
            owned.id,
            visualState,
            echo.pattern.aimAngle,
            owned.id === 'ash-halo' ? 210 : 340,
            visualSeed + 41,
            echo.impacts,
            echo.pattern,
          )
        }
      } else {
        this.spawnProjectile(
          owned.id,
          angle + Math.PI,
          520,
          (damage * 0.72) / 2,
          1,
          0,
          definition.color,
          1.45,
          visualState,
          visualSeed + 41,
          damage * 0.72,
        )
      }
    }
    this.audio.playWeaponCue(owned.id)
  }

  private currentHeroWeaponOrigin() {
    const facingX =
      Math.abs(this.heroFacing.x) > 0.01
        ? this.heroFacing.x
        : this.heroVisualFacing
    return heroWeaponOrigin(this.player, facingX)
  }

  private hostileWarningWindow(baseSeconds: number) {
    return hostileSpecialReactionWindow(
      baseSeconds,
      hostileSpecialReactionBonusSeconds(this.runConfig.mode, this.level.id),
    )
  }

  private usesCombatLabVfxPresentation() {
    return this.runConfig.mode === 'combat-lab' || Boolean(this.showcase)
  }

  private combatLabRuntimeVfx(
    weaponId: WeaponId,
    state: WeaponVfxState,
  ): CombatLabRuntimeVfxPresentation {
    return resolveCombatLabRuntimeVfx(
      this.usesCombatLabVfxPresentation() ? 'combat-lab' : this.runConfig.mode,
      weaponId,
      state,
      weaponVfxProfile(weaponId, state),
    )
  }

  private weaponPresentationProfile(
    weaponId: WeaponId,
    state: WeaponVfxState,
  ): WeaponVfxProfile {
    return this.combatLabRuntimeVfx(weaponId, state).profile
  }

  private pushWeaponEffect(effect: WeaponEffectEntity) {
    if (this.weaponEffects.length >= 72) {
      let shortestIndex = -1
      for (let index = 0; index < this.weaponEffects.length; index += 1) {
        const candidate = this.weaponEffects[index]
        const pendingRemoteStrikes =
          candidate.kind === 'astral-verdict' &&
          (candidate.triggeredStrikeCount ?? 0) < (candidate.points?.length ?? 0)
        if (pendingRemoteStrikes) continue
        if (
          shortestIndex < 0 ||
          candidate.life < this.weaponEffects[shortestIndex].life
        ) {
          shortestIndex = index
        }
      }
      if (shortestIndex >= 0) {
        this.weaponEffects.splice(shortestIndex, 1)
        } else if (effect.kind !== 'astral-verdict') {
          return
        }
    }
    this.weaponEffects.push(effect)
  }

  private emitWeaponCastVfx(
    weaponId: WeaponId,
    visualState: WeaponVfxState,
    angle: number,
    radius: number,
    seed: number,
    points: Vec2[] = [],
    pattern?: ReplacementWeaponPattern<number>,
  ) {
    const kind: Record<WeaponId, WeaponEffectKind | undefined> = {
      'helio-lance': 'helio-gate',
      'crescent-array': 'crescent-orbit',
      'arc-choir': undefined,
      'rift-seeds': undefined,
      'comet-swarm': 'comet-launch',
      'ash-halo': 'graveglass-eruption',
      'mirror-bow': undefined,
      'null-bell': 'eclipse-harrow',
    }
    const effectKind = kind[weaponId]
    if (!effectKind) return
    const duration = {
      'helio-lance': 0.46,
      'crescent-array': 0.62,
      'arc-choir': 0.5,
      'rift-seeds': 0.76,
      'comet-swarm': 0.42,
      'ash-halo': visualState.stage === 'final' ? 1.04 : 0.86,
      'mirror-bow': 0.5,
      'null-bell': visualState.stage === 'final' ? 1.24 : 1.02,
    }[weaponId] ?? 0.5
    const hitPulseTotal =
      weaponId === 'ash-halo' ? 0.38 : weaponId === 'null-bell' ? 0.46 : undefined
    const castOrigin = this.currentHeroWeaponOrigin()
    this.pushWeaponEffect({
      kind: effectKind,
      weaponId,
      visualState,
      x: pattern?.aimPoint.x ?? castOrigin.x,
      y: pattern?.aimPoint.y ?? castOrigin.y,
      angle: pattern?.aimAngle ?? angle,
      radius: Math.max(24, radius * 0.22),
      maxRadius: Math.max(54, radius),
      life: duration,
      total: duration,
      seed,
      points: points.slice(0, 12),
      pattern,
      hitPulseLife: hitPulseTotal,
      hitPulseTotal,
    })

    const profile = this.weaponPresentationProfile(weaponId, visualState)
    const burstCount = Math.min(14, Math.max(4, Math.ceil(profile.particleCount * 0.45)))
    if (weaponId !== 'ash-halo' && weaponId !== 'null-bell') {
      this.spawnBurst(
        castOrigin.x,
        castOrigin.y,
        profile.accentColor,
        burstCount,
        72 + visualState.detail * 18,
      )
    }
  }

  private emitProjectileImpactVfx(
    projectile: ProjectileEntity,
    x: number,
    y: number,
  ) {
    if (projectile.hitIds.length > 2 && projectile.visualState.stage !== 'final') return
    const kind: Partial<Record<WeaponId, WeaponEffectKind>> = {
      'helio-lance': 'helio-impact',
      'crescent-array': 'crescent-impact',
      'comet-swarm': 'comet-impact',
    }
    const effectKind = kind[projectile.weaponId]
    if (!effectKind) return
    const profile = this.weaponPresentationProfile(
      projectile.weaponId,
      projectile.visualState,
    )
    const radius =
      projectile.weaponId === 'helio-lance' ? 56 : 48
    const duration =
      projectile.visualState.stage === 'final'
          ? 0.46
          : 0.34
    this.pushWeaponEffect({
      kind: effectKind,
      weaponId: projectile.weaponId,
      visualState: projectile.visualState,
      x,
      y,
      angle: Math.atan2(projectile.vy, projectile.vx),
      radius: 6,
      maxRadius: radius,
      life: duration,
      total: duration,
      seed: projectile.visualSeed + projectile.hitIds.length * 17,
    })
    const impactParticles = Math.min(
      projectile.weaponId === 'rift-seeds' ? 16 : 10,
      Math.max(4, Math.ceil(profile.particleCount * 0.5)),
    )
    this.spawnBurst(
      x,
      y,
      profile.accentColor,
      impactParticles,
      105 + projectile.visualState.detail * 22,
    )
  }

  private spawnProjectile(
    weaponId: WeaponId,
    angle: number,
    speed: number,
    damage: number,
    pierce: number,
    homing: number,
    color: number,
    life = 1.45,
    visualState = resolveWeaponVfxState(1, 0, false),
    visualSeed = this.attackVolley,
    bossDamage = damage,
  ) {
    let projectile = this.projectiles.find((candidate) => !candidate.active)
    if (!projectile) {
      const sprite = new Sprite(Texture.WHITE)
      sprite.anchor.set(0.5)
      sprite.visible = false
      this.projectileLayer.addChild(sprite)
      projectile = {
        active: false,
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        vx: 0,
        vy: 0,
        radius: 6,
        damage: 1,
        bossDamage: 1,
        life: 1,
        pierce: 0,
        homing: 0,
        weaponId,
        color,
        totalLife: life,
        visualState,
        visualSeed,
        hitIds: [],
        sprite,
      }
      this.projectiles.push(projectile)
    }

    const origin = this.currentHeroWeaponOrigin()
    const { x, y } = origin
    projectile.active = true
    projectile.x = x
    projectile.y = y
    projectile.previousX = x
    projectile.previousY = y
    projectile.vx = Math.cos(angle) * speed
    projectile.vy = Math.sin(angle) * speed
    projectile.radius = weaponId === 'rift-seeds' ? 12 : weaponId === 'crescent-array' ? 10 : 6
    projectile.damage = damage
    projectile.bossDamage = bossDamage
    projectile.life = life
    projectile.pierce = pierce
    projectile.homing = homing
    projectile.weaponId = weaponId
    projectile.color = color
    projectile.totalLife = life
    projectile.visualState = visualState
    projectile.visualSeed = visualSeed
    projectile.hitIds.length = 0
    const usesAuthoredCrescentMaterial =
      weaponId === 'crescent-array' && this.crescentMoonbladeFrames.length > 0
    projectile.sprite.texture = usesAuthoredCrescentMaterial
      ? this.crescentMoonbladeFrames[visualSeed % this.crescentMoonbladeFrames.length]
      : this.projectileTextures.get(weaponId) ?? Texture.WHITE
    projectile.sprite.tint = 0xffffff
    const [projectileWidth, projectileHeight] = usesAuthoredCrescentMaterial
      ? [36, 36]
      : this.projectileDimensions(weaponId)
    const visualProfile = this.weaponPresentationProfile(weaponId, visualState)
    projectile.sprite.width = projectileWidth * visualProfile.projectileScale
    projectile.sprite.height = projectileHeight * visualProfile.projectileScale
    projectile.sprite.alpha = 0.95
    projectile.sprite.blendMode = usesAuthoredCrescentMaterial ? 'normal' : 'add'
    projectile.sprite.visible = true
    projectile.sprite.position.set(x, y)
  }

  private updateProjectiles(delta: number) {
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue
      projectile.previousX = projectile.x
      projectile.previousY = projectile.y
      projectile.life -= delta

      if (projectile.homing > 0) {
        const target = this.nearestEnemy(projectile.x, projectile.y, projectile.hitIds)
        if (target) {
          const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x)
          const current = Math.atan2(projectile.vy, projectile.vx)
          let difference = desired - current
          while (difference > Math.PI) difference -= Math.PI * 2
          while (difference < -Math.PI) difference += Math.PI * 2
          const next = current + clamp(difference, -projectile.homing * delta, projectile.homing * delta)
          const speed = Math.hypot(projectile.vx, projectile.vy)
          projectile.vx = Math.cos(next) * speed
          projectile.vy = Math.sin(next) * speed
        }
      }

      projectile.x += projectile.vx * delta
      projectile.y += projectile.vy * delta

      if (
        projectile.life <= 0 ||
        projectile.x < -80 ||
        projectile.y < -80 ||
        projectile.x > WORLD_WIDTH + 80 ||
        projectile.y > WORLD_HEIGHT + 80
      ) {
        this.deactivateProjectile(projectile)
        continue
      }

      const candidates = this.queryEnemyGrid(projectile.x, projectile.y, projectile.radius + 55)
      for (const enemy of candidates) {
        if (!enemy.active || projectile.hitIds.includes(enemy.uid)) continue
        const combined = projectile.radius + enemy.radius
        if ((projectile.x - enemy.x) ** 2 + (projectile.y - enemy.y) ** 2 > combined ** 2) continue
        projectile.hitIds.push(enemy.uid)
        this.damageEnemy(
          enemy,
          enemy.isBoss ? projectile.bossDamage : projectile.damage,
          projectile.weaponId,
        )
        this.emitProjectileImpactVfx(projectile, enemy.x, enemy.y)
        projectile.pierce -= 1
        if (projectile.pierce < 0) {
          this.deactivateProjectile(projectile)
          break
        }
      }
    }
  }

  private armOrbitingComets(
    owned: OwnedWeapon,
    visualState: WeaponVfxState,
    castDamageBudget: number,
    visualSeed: number,
  ) {
    const profile = orbitingCometProfile(owned.rank, Boolean(owned.awakened))
    this.syncOrbitingComets(profile.count, owned, visualState, visualSeed)
    const moduleRank =
      this.modules.find((module) => module.id === WEAPONS[owned.id].moduleId)
        ?.rank ?? 0
    const baseCastDamageBudget = weaponCastDamageBudget(owned, moduleRank)
    const windowDuration = Math.max(
      0.72,
      weaponCooldownSeconds(
        owned.id,
        owned.rank,
        moduleRank,
        Boolean(owned.awakened),
      ) * 1.3,
    )
    const previous =
      this.cometDamageWindow && this.cometDamageWindow.expiresAt > this.elapsed
        ? this.cometDamageWindow.remaining
        : 0
    this.cometDamageWindow = {
      // Crossfire can add 72% in the same volley. Capping at 1.72 casts avoids
      // banking a large burst when no enemy is close enough to be touched.
      remaining: Math.min(
        baseCastDamageBudget * 1.72,
        previous + castDamageBudget,
      ),
      expiresAt: this.elapsed + windowDuration,
    }
  }

  private syncOrbitingComets(
    count: number,
    owned: OwnedWeapon,
    visualState: WeaponVfxState,
    visualSeed: number,
  ) {
    const profile = orbitingCometProfile(owned.rank, Boolean(owned.awakened))
    const centerY = this.player.y + HERO_BODY_CENTER_OFFSET_Y
    while (this.orbitingComets.length < count) {
      const sprite = new Sprite(this.cometOrbitFrames[0] ?? Texture.WHITE)
      sprite.anchor.set(0.5)
      sprite.visible = false
      sprite.blendMode = 'add'
      this.projectileLayer.addChild(sprite)
      this.orbitingComets.push({
        active: false,
        slot: this.orbitingComets.length,
        x: this.player.x,
        y: centerY,
        previousX: this.player.x,
        previousY: centerY,
        angle: 0,
        orbitRadius: profile.innerRadius,
        angularSpeed: profile.angularSpeed,
        direction: 1,
        footprint: profile.footprint,
        visualState,
        frameOffset: 0,
        sprite,
      })
    }

    for (let index = 0; index < this.orbitingComets.length; index += 1) {
      const comet = this.orbitingComets[index]
      if (index >= count) {
        comet.active = false
        comet.sprite.visible = false
        continue
      }
      const laneT = count <= 1 ? 0 : index / (count - 1)
      const radius = lerp(profile.innerRadius, profile.outerRadius, laneT)
      if (!comet.active) {
        comet.angle =
          (Math.PI * 2 * index) / Math.max(1, count) +
          replacementCosmeticUnit(visualSeed, index, 811) * 0.32
        comet.x = this.player.x + Math.cos(comet.angle) * radius
        comet.y = centerY + Math.sin(comet.angle) * radius * 0.56
        comet.previousX = comet.x
        comet.previousY = comet.y
      }
      comet.active = true
      comet.slot = index
      comet.orbitRadius = radius
      comet.angularSpeed = profile.angularSpeed * (1 + laneT * 0.08)
      comet.direction =
        profile.counterRotating && index % 2 === 1 ? -1 : 1
      comet.footprint = profile.footprint
      comet.visualState = visualState
      comet.frameOffset = (visualSeed + index * 5) % 16
      comet.sprite.visible = true
    }
  }

  private armCinderwakeReavers(
    owned: OwnedWeapon,
    visualState: WeaponVfxState,
    castDamageBudget: number,
    visualSeed: number,
    target: EnemyEntity,
  ) {
    const profile = cinderwakeReaverProfile(owned.rank, Boolean(owned.awakened))
    this.syncCinderwakeReavers(
      profile.count,
      owned,
      visualState,
      visualSeed,
      target,
    )
    const moduleRank =
      this.modules.find((module) => module.id === WEAPONS[owned.id].moduleId)
        ?.rank ?? 0
    const baseCastDamageBudget = weaponCastDamageBudget(owned, moduleRank)
    const windowDuration = Math.max(
      0.9,
      weaponCooldownSeconds(
        owned.id,
        owned.rank,
        moduleRank,
        Boolean(owned.awakened),
      ) * 1.45,
    )
    const previous =
      this.reaverDamageWindow && this.reaverDamageWindow.expiresAt > this.elapsed
        ? this.reaverDamageWindow.remaining
        : 0
    this.reaverDamageWindow = {
      remaining: Math.min(
        baseCastDamageBudget * 1.72,
        previous + castDamageBudget,
      ),
      expiresAt: this.elapsed + windowDuration,
    }
  }

  private syncCinderwakeReavers(
    count: number,
    owned: OwnedWeapon,
    visualState: WeaponVfxState,
    visualSeed: number,
    target: EnemyEntity,
  ) {
    const profile = cinderwakeReaverProfile(owned.rank, Boolean(owned.awakened))
    const origin = this.currentHeroWeaponOrigin()
    while (this.cinderwakeReavers.length < count) {
      const wakeGlow = new Graphics()
      wakeGlow
        .ellipse(-16, 0, 36, 8)
        .fill({ color: 0x432258, alpha: 0.46 })
        .ellipse(-8, 0, 29, 5.8)
        .fill({ color: 0x811d2b, alpha: 0.76 })
        .ellipse(7, 0, 10, 2.8)
        .fill({ color: 0xea7467, alpha: 0.62 })
      wakeGlow.visible = false
      wakeGlow.blendMode = 'add'
      wakeGlow.filters = [
        new BlurFilter({
          strength: this.visualLod === 'mobile' ? 5 : 7,
          quality: 1,
          kernelSize: 5,
        }),
      ]
      this.projectileLayer.addChild(wakeGlow)
      const impactGlow = new Graphics()
      impactGlow
        .ellipse(0, 0, 29, 21)
        .fill({ color: 0x481e55, alpha: 0.5 })
        .ellipse(5, 2, 17, 11)
        .fill({ color: 0x852939, alpha: 0.72 })
        .ellipse(-9, -3, 7, 5)
        .fill({ color: 0xea7467, alpha: 0.9 })
      impactGlow.visible = false
      impactGlow.blendMode = 'add'
      impactGlow.filters = [
        new BlurFilter({
          strength: this.visualLod === 'mobile' ? 2.4 : 3,
          quality: 1,
          kernelSize: 5,
        }),
      ]
      this.projectileLayer.addChild(impactGlow)
      const auraSprite = new Sprite(this.cinderwakeReaverFrames[0] ?? Texture.WHITE)
      auraSprite.anchor.set(0.5)
      auraSprite.visible = false
      auraSprite.blendMode = 'add'
      auraSprite.filters = [
        new BlurFilter({
          strength: this.visualLod === 'mobile' ? 3 : 4.8,
          quality: 1,
          kernelSize: 5,
        }),
      ]
      this.projectileLayer.addChild(auraSprite)
      const edgeSprite = new Sprite(this.cinderwakeReaverFrames[0] ?? Texture.WHITE)
      edgeSprite.anchor.set(0.5)
      edgeSprite.visible = false
      edgeSprite.blendMode = 'add'
      edgeSprite.filters = [
        new BlurFilter({
          strength: this.visualLod === 'mobile' ? 1.2 : 1.8,
          quality: 1,
          kernelSize: 5,
        }),
      ]
      this.projectileLayer.addChild(edgeSprite)
      const sprite = new Sprite(this.cinderwakeReaverFrames[0] ?? Texture.WHITE)
      sprite.anchor.set(0.5)
      sprite.visible = false
      sprite.blendMode = 'normal'
      const materialFilter = new ColorMatrixFilter()
      materialFilter.saturate(0.08, false)
      materialFilter.contrast(0.13, true)
      sprite.filters = [materialFilter]
      this.projectileLayer.addChild(sprite)
      this.cinderwakeReavers.push({
        active: false,
        slot: this.cinderwakeReavers.length,
        x: origin.x,
        y: origin.y,
        previousX: origin.x,
        previousY: origin.y,
        vx: profile.speed,
        vy: 0,
        speed: profile.speed,
        turnRate: profile.turnRate,
        spin: 0,
        spinRate: profile.spinRate,
        flightMode: 'seeking',
        flightTimer: 0,
        bounceLock: 0,
        curveSign: 1,
        outboundX: origin.x,
        outboundY: origin.y,
        footprint: profile.footprint,
        scale: profile.scale,
        visualState,
        frameOffset: 0,
        wakeGlow,
        impactGlow,
        auraSprite,
        edgeSprite,
        materialFilter,
        sprite,
      })
    }

    for (let index = 0; index < this.cinderwakeReavers.length; index += 1) {
      const reaver = this.cinderwakeReavers[index]
      if (index >= count) {
        reaver.active = false
        reaver.wakeGlow.visible = false
        reaver.impactGlow.visible = false
        reaver.auraSprite.visible = false
        reaver.edgeSprite.visible = false
        reaver.sprite.visible = false
        continue
      }
      if (!reaver.active) {
        const aim = Math.atan2(target.y - origin.y, target.x - origin.x)
        const spread =
          (index - (count - 1) * 0.5) * 0.3 +
          (replacementCosmeticUnit(visualSeed, index, 821) - 0.5) * 0.12
        reaver.x = origin.x
        reaver.y = origin.y
        reaver.previousX = origin.x
        reaver.previousY = origin.y
        reaver.vx = Math.cos(aim + spread) * profile.speed
        reaver.vy = Math.sin(aim + spread) * profile.speed
        reaver.spin = replacementCosmeticUnit(visualSeed, index, 823) * Math.PI * 2
        reaver.flightMode = 'seeking'
        reaver.flightTimer = -index * 0.16
        reaver.bounceLock = 0
        reaver.curveSign = index % 2 === 0 ? 1 : -1
        reaver.outboundX = origin.x
        reaver.outboundY = origin.y
      }
      reaver.active = true
      reaver.slot = index
      reaver.speed = profile.speed
      reaver.turnRate = profile.turnRate
      reaver.spinRate = profile.spinRate * (index % 2 === 0 ? 1 : -1)
      reaver.footprint = profile.footprint
      reaver.scale = profile.scale
      reaver.visualState = visualState
      reaver.frameOffset = (visualSeed + index * 7) % 16
      reaver.wakeGlow.visible = true
      reaver.impactGlow.visible = true
      reaver.auraSprite.visible = true
      reaver.edgeSprite.visible = true
      reaver.sprite.visible = true
    }
  }

  private updatePersistentSpells(delta: number) {
    const cometWeapon = this.weapons.find(
      (weapon) => weapon.id === 'comet-swarm' && weapon.rank > 0,
    )
    if (cometWeapon) {
      const moduleRank =
        this.modules.find(
          (module) => module.id === WEAPONS[cometWeapon.id].moduleId,
        )?.rank ?? 0
      const visualState = resolveWeaponVfxState(
        cometWeapon.rank,
        moduleRank,
        Boolean(cometWeapon.awakened),
      )
      const profile = orbitingCometProfile(
        cometWeapon.rank,
        Boolean(cometWeapon.awakened),
      )
      this.syncOrbitingComets(
        profile.count,
        cometWeapon,
        visualState,
        this.attackVolley,
      )
      const centerX = this.player.x
      const centerY = this.player.y + HERO_BODY_CENTER_OFFSET_Y
      for (const comet of this.orbitingComets) {
        if (!comet.active) continue
        comet.previousX = comet.x
        comet.previousY = comet.y
        comet.angle += comet.angularSpeed * comet.direction * delta
        comet.x = centerX + Math.cos(comet.angle) * comet.orbitRadius
        comet.y = centerY + Math.sin(comet.angle) * comet.orbitRadius * 0.56
      }
      this.consumePersistentSpellWindow(
        this.cometDamageWindow,
        this.persistentContacts(this.orbitingComets),
        'comet-swarm',
      )
      if (
        this.cometDamageWindow &&
        (this.cometDamageWindow.remaining <= 0 ||
          this.cometDamageWindow.expiresAt <= this.elapsed)
      ) {
        this.cometDamageWindow = undefined
      }
    } else {
      this.cometDamageWindow = undefined
      for (const comet of this.orbitingComets) {
        comet.active = false
        comet.sprite.visible = false
      }
    }

    const reaverWeapon = this.weapons.find(
      (weapon) => weapon.id === 'mirror-bow' && weapon.rank > 0,
    )
    if (reaverWeapon) {
      const target = this.nearestEnemy(this.player.x, this.player.y)
      // A Reaver is a cast projectile: it must visibly leave the weapon before
      // becoming a persistent hunter. Only maintain an already-launched fleet
      // here; `armCinderwakeReavers` performs the initial spawn on the cast.
      if (target && this.cinderwakeReavers.some((reaver) => reaver.active)) {
        const moduleRank =
          this.modules.find(
            (module) => module.id === WEAPONS[reaverWeapon.id].moduleId,
          )?.rank ?? 0
        const visualState = resolveWeaponVfxState(
          reaverWeapon.rank,
          moduleRank,
          Boolean(reaverWeapon.awakened),
        )
        const profile = cinderwakeReaverProfile(
          reaverWeapon.rank,
          Boolean(reaverWeapon.awakened),
        )
        this.syncCinderwakeReavers(
          profile.count,
          reaverWeapon,
          visualState,
          this.attackVolley,
          target,
        )
      }
      const margin = 34
      const claimedTargets: number[] = []
      const activeReavers = this.cinderwakeReavers.filter(
        (reaver) => reaver.active,
      )
      for (const reaver of this.cinderwakeReavers) {
        if (!reaver.active) continue
        reaver.previousX = reaver.x
        reaver.previousY = reaver.y
        reaver.flightTimer += delta
        reaver.bounceLock = Math.max(0, reaver.bounceLock - delta)
        const target =
          this.nearestEnemy(reaver.x, reaver.y, claimedTargets) ??
          this.nearestEnemy(reaver.x, reaver.y)
        if (target && reaver.bounceLock <= 0) {
          claimedTargets.push(target.uid)
          const targetDx = target.x - reaver.x
          const targetDy = target.y - reaver.y
          const targetDistance = Math.hypot(targetDx, targetDy)
          const contactDistance = target.radius + reaver.footprint * 0.72

          if (
            reaver.flightMode === 'seeking' &&
            (targetDistance <= contactDistance + 18 ||
              reaver.flightTimer >= 1.14 + reaver.slot * 0.08)
          ) {
            reaver.flightMode = 'receding'
            reaver.flightTimer = 0
            const directAway =
              targetDistance > 0.001
                ? Math.atan2(reaver.y - target.y, reaver.x - target.x)
                : Math.atan2(-reaver.vy, -reaver.vx)
            const outboundAngle =
              directAway +
              reaver.curveSign * (0.24 + reaver.slot * 0.045)
            const outboundReach = Math.hypot(WORLD_WIDTH, WORLD_HEIGHT) * 1.2
            reaver.outboundX = reaver.x + Math.cos(outboundAngle) * outboundReach
            reaver.outboundY = reaver.y + Math.sin(outboundAngle) * outboundReach
          }

          const laneAngle =
            (Math.PI * 2 * reaver.slot) / Math.max(1, activeReavers.length) +
            this.motionClock * 0.22 * reaver.curveSign
          const approachRadius = target.isBoss
            ? target.radius * 0.62 + 18 + reaver.slot * 7
            : 8 + reaver.slot * 5
          let aimX = target.x + Math.cos(laneAngle) * approachRadius
          let aimY = target.y + Math.sin(laneAngle) * approachRadius * 0.72

          if (reaver.flightMode === 'receding') {
            // Hold a fixed destination beyond the arena so each blade commits
            // to an unmistakable outbound leg and can visibly ricochet from a
            // wall before its homing turn resumes.
            aimX = reaver.outboundX
            aimY = reaver.outboundY
          }

          const desired = Math.atan2(aimY - reaver.y, aimX - reaver.x)
          const current = Math.atan2(reaver.vy, reaver.vx)
          let difference = desired - current
          while (difference > Math.PI) difference -= Math.PI * 2
          while (difference < -Math.PI) difference += Math.PI * 2
          const phaseTurnScale = reaver.flightMode === 'receding' ? 0.72 : 1
          const next =
            current +
            clamp(
              difference,
              -reaver.turnRate * phaseTurnScale * delta,
              reaver.turnRate * phaseTurnScale * delta,
            )
          reaver.vx = Math.cos(next) * reaver.speed
          reaver.vy = Math.sin(next) * reaver.speed
        }

        // Maintain independent flight lanes even when a lone boss is the only
        // target. This soft repulsion is positional choreography, not damage.
        for (const other of activeReavers) {
          if (other === reaver) continue
          const separationX = reaver.x - other.x
          const separationY = reaver.y - other.y
          const separationDistance = Math.hypot(separationX, separationY)
          const reaverSize =
            (88 + this.vfxStageIndex(reaver.visualState.stage) * 4) *
            reaver.scale
          const otherSize =
            (88 + this.vfxStageIndex(other.visualState.stage) * 4) *
            other.scale
          const separationRadius = Math.max(
            108,
            (reaverSize + otherSize) * 0.55,
          )
          if (separationDistance >= separationRadius) continue
          let normalX: number
          let normalY: number
          if (separationDistance <= 0.001) {
            const pairAngle = (Math.min(reaver.slot, other.slot) + 1) * 2.39996
            const direction = reaver.slot < other.slot ? 1 : -1
            normalX = Math.cos(pairAngle) * direction
            normalY = Math.sin(pairAngle) * direction
          } else {
            normalX = separationX / separationDistance
            normalY = separationY / separationDistance
          }
          const separationForce =
            (separationRadius - separationDistance) * 2.35
          reaver.vx += normalX * separationForce
          reaver.vy += normalY * separationForce
        }
        const separatedSpeed = Math.max(0.001, Math.hypot(reaver.vx, reaver.vy))
        reaver.vx = (reaver.vx / separatedSpeed) * reaver.speed
        reaver.vy = (reaver.vy / separatedSpeed) * reaver.speed

        reaver.x += reaver.vx * delta
        reaver.y += reaver.vy * delta
        let bounced = false
        if (reaver.x <= margin || reaver.x >= WORLD_WIDTH - margin) {
          reaver.x = clamp(reaver.x, margin, WORLD_WIDTH - margin)
          reaver.vx *= -1
          bounced = true
        }
        if (reaver.y <= margin || reaver.y >= WORLD_HEIGHT - margin) {
          reaver.y = clamp(reaver.y, margin, WORLD_HEIGHT - margin)
          reaver.vy *= -1
          bounced = true
        }
        if (bounced) {
          // Briefly suspend homing so the reflected travel is clearly visible
          // instead of being cancelled by steering on the next frame.
          reaver.bounceLock = 0.34
          reaver.flightMode = 'seeking'
          reaver.flightTimer = 0
          reaver.curveSign = reaver.curveSign === 1 ? -1 : 1
        }
        reaver.spin += reaver.spinRate * delta
      }
      this.consumePersistentSpellWindow(
        this.reaverDamageWindow,
        this.persistentContacts(this.cinderwakeReavers),
        'mirror-bow',
      )
      if (
        this.reaverDamageWindow &&
        (this.reaverDamageWindow.remaining <= 0 ||
          this.reaverDamageWindow.expiresAt <= this.elapsed)
      ) {
        this.reaverDamageWindow = undefined
      }
    } else {
      this.reaverDamageWindow = undefined
      for (const reaver of this.cinderwakeReavers) {
        reaver.active = false
        reaver.wakeGlow.visible = false
        reaver.impactGlow.visible = false
        reaver.auraSprite.visible = false
        reaver.edgeSprite.visible = false
        reaver.sprite.visible = false
      }
    }

    this.host.dataset.activeOrbitingComets = String(
      this.orbitingComets.filter((comet) => comet.active).length,
    )
    this.host.dataset.activeCinderwakeReavers = String(
      this.cinderwakeReavers.filter((reaver) => reaver.active).length,
    )
  }

  private persistentContacts(
    actors: ReadonlyArray<OrbitingCometEntity | CinderwakeReaverEntity>,
  ) {
    const contacts = new Map<number, EnemyEntity>()
    for (const actor of actors) {
      if (!actor.active) continue
      const candidates = this.queryEnemyGrid(
        actor.x,
        actor.y,
        actor.footprint + 72,
      )
      for (const enemy of candidates) {
        if (!enemy.active) continue
        const combined = actor.footprint + enemy.radius
        if (distanceSquared(actor, enemy) > combined ** 2) continue
        contacts.set(enemy.uid, enemy)
      }
    }
    return [...contacts.values()]
  }

  private consumePersistentSpellWindow(
    window: PersistentSpellDamageWindow | undefined,
    contacts: EnemyEntity[],
    weaponId: 'comet-swarm' | 'mirror-bow',
  ) {
    if (
      !window ||
      window.remaining <= 0 ||
      window.expiresAt <= this.elapsed ||
      contacts.length === 0
    ) {
      return
    }
    const shares = contacts.some((enemy) => enemy.isBoss)
      ? distributeRemoteCastDamage(window.remaining, contacts)
      : persistentWindowDamage(window.remaining, contacts.length)
    for (let index = 0; index < contacts.length; index += 1) {
      this.damageEnemy(contacts[index], shares[index] ?? 0, weaponId)
    }
    window.remaining = 0
  }

  private drawPersistentSpellActors(sceneVfxScale: number) {
    for (const comet of this.orbitingComets) {
      if (!comet.active) continue
      const frame = this.cometOrbitFrames[
        (Math.floor(this.motionClock * 14) + comet.frameOffset) %
          Math.max(1, this.cometOrbitFrames.length)
      ]
      if (frame) comet.sprite.texture = frame
      const renderX = lerp(comet.previousX, comet.x, this.interpolation)
      const renderY = lerp(comet.previousY, comet.y, this.interpolation)
      comet.sprite.position.set(renderX, renderY)
      comet.sprite.rotation = -comet.angle * 0.32
      const stage = this.vfxStageIndex(comet.visualState.stage)
      const size = (62 + stage * 4) * (comet.visualState.awakened ? 1.06 : 1)
      const motionX = comet.x - comet.previousX
      const motionY = comet.y - comet.previousY
      const motionLength = Math.max(0.001, Math.hypot(motionX, motionY))
      const trailX = -motionX / motionLength
      const trailY = -motionY / motionLength
      const trailNormalX = -trailY
      const trailNormalY = trailX
      const trailEnergy = Math.max(0.58, sceneVfxScale)
      const coronaPulse =
        0.86 +
        Math.sin(this.motionClock * 7.2 + comet.frameOffset * 0.43) * 0.14
      const coronaPointCount =
        (this.visualLod === 'mobile' ? 5 : 7) + Math.min(2, stage)

      // The basalt body is intentionally dark, so a compact broken corona
      // carries its silhouette against the arena. Filled flame tongues and
      // molten motes avoid a clean vector ring while preserving the authored
      // stone at its established gameplay scale.
      this.projectileTrailGraphics
        .ellipse(renderX, renderY, size * 0.31, size * 0.245)
        .fill({ color: 0xff4a0a, alpha: 0.16 * trailEnergy * coronaPulse })
      this.projectileTrailGraphics
        .ellipse(renderX, renderY, size * 0.265, size * 0.205)
        .fill({ color: 0xff8a1c, alpha: 0.2 * trailEnergy * coronaPulse })
      for (let coronaPoint = 0; coronaPoint < coronaPointCount; coronaPoint += 1) {
        const coronaAngle =
          (Math.PI * 2 * coronaPoint) / coronaPointCount -
          comet.angle * 0.24 +
          Math.sin(
            this.motionClock * 3.8 +
              comet.frameOffset * 0.17 +
              coronaPoint * 1.91,
          ) *
            0.12
        const radialX = Math.cos(coronaAngle)
        const radialY = Math.sin(coronaAngle)
        const tangentX = -radialY
        const tangentY = radialX
        const baseRadius = size * (0.405 + (coronaPoint % 3) * 0.012)
        const baseX = renderX + radialX * baseRadius
        const baseY = renderY + radialY * baseRadius * 0.82
        const tongueLength =
          (3.2 + stage * 0.42 + (coronaPoint % 2) * 1.15) * coronaPulse
        const tongueWidth = 1.15 + stage * 0.11

        this.projectileTrailGraphics
          .poly(
            [
              baseX - tangentX * tongueWidth,
              baseY - tangentY * tongueWidth,
              baseX + radialX * tongueLength,
              baseY + radialY * tongueLength,
              baseX + tangentX * tongueWidth,
              baseY + tangentY * tongueWidth,
            ],
            true,
          )
          .fill({
            color: coronaPoint % 3 === 0 ? 0xffb32e : 0xff6a10,
            alpha: (0.48 + (coronaPoint % 2) * 0.09) * trailEnergy,
          })
        if (coronaPoint % 2 === 0) {
          this.projectileTrailGraphics
            .circle(
              baseX + radialX * tongueLength * 0.48,
              baseY + radialY * tongueLength * 0.48,
              0.8 + stage * 0.08,
            )
            .fill({ color: 0xffd05a, alpha: 0.54 * trailEnergy })
        }
      }

      // A compact, tapered ember wake makes the orbit readable without
      // turning each basalt stone into a large projectile or a neon ring.
      for (let wake = 1; wake <= 3; wake += 1) {
        const distance = 3 + wake * (3.4 + stage * 0.28)
        const drift = Math.sin(
          this.motionClock * 8 + comet.frameOffset * 0.31 + wake * 1.9,
        ) * (0.7 + wake * 0.22)
        const wakeX = renderX + trailX * distance + trailNormalX * drift
        const wakeY = renderY + trailY * distance + trailNormalY * drift
        const wakeScale = 1 - wake * 0.19
        this.projectileTrailGraphics
           .circle(wakeX, wakeY, Math.max(1.2, size * 0.075 * wakeScale))
           .fill({
            color: wake === 1 ? 0xffd05a : wake === 2 ? 0xff7a18 : 0xbd3a0c,
            alpha: (0.34 - wake * 0.055) * trailEnergy,
           })
      }
      this.projectileTrailGraphics
        .ellipse(renderX, renderY, size * 0.23, size * 0.18)
        .fill({ color: 0xff5a10, alpha: 0.18 * trailEnergy })
      this.projectileTrailGraphics
        .ellipse(renderX, renderY, size * 0.1, size * 0.08)
        .fill({ color: 0xffb32e, alpha: 0.28 * trailEnergy })
      comet.sprite.width = size
      comet.sprite.height = size
      comet.sprite.alpha = Math.max(0.58, sceneVfxScale) * 0.94
      comet.sprite.visible = true
    }
    this.cinderwakeFleetGlow.clear()
    const activeReavers = this.cinderwakeReavers.filter((reaver) => reaver.active)
    const fleetEnergy = Math.max(0.62, sceneVfxScale)
    if (activeReavers.length > 0) {
      const fleetState = activeReavers[0].visualState
      const fleetProfile = cinderwakeReaverPresentationProfile(
        fleetState.rank,
        fleetState.awakened,
      )
      const renderedReavers = activeReavers.map((reaver) => ({
        reaver,
        x: lerp(reaver.previousX, reaver.x, this.interpolation),
        y: lerp(reaver.previousY, reaver.y, this.interpolation),
      }))
      const fleetCenter = renderedReavers.reduce(
        (center, actor) => ({
          x: center.x + actor.x / renderedReavers.length,
          y: center.y + actor.y / renderedReavers.length,
        }),
        { x: 0, y: 0 },
      )
      const pressurePhase =
        0.5 + Math.sin((this.motionClock / 3.7) * Math.PI * 2) * 0.5
      const pressureScale = lerp(0.96, 1.06, pressurePhase)
      const pressureAlpha = lerp(0.19, 0.42, pressurePhase) * fleetEnergy

      // Theater parity: three broad crimson/violet pressure pools breathe
      // behind the whole fleet. They are deliberately soft fields, not rings.
      this.cinderwakeFleetGlow
        .ellipse(
          lerp(this.player.x, fleetCenter.x, 0.38) - 72,
          lerp(this.player.y, fleetCenter.y, 0.38) - 28,
          118 * pressureScale,
          58 * pressureScale,
        )
        .fill({ color: 0x691928, alpha: pressureAlpha * 0.28 })
        .ellipse(
          lerp(this.player.x, fleetCenter.x, 0.7) + 78,
          lerp(this.player.y, fleetCenter.y, 0.7) - 18,
          132 * pressureScale,
          66 * pressureScale,
        )
        .fill({ color: 0x341948, alpha: pressureAlpha * 0.3 })
        .ellipse(
          fleetCenter.x + 18,
          fleetCenter.y + 78,
          142 * pressureScale,
          72 * pressureScale,
        )
        .fill({ color: 0x53101d, alpha: pressureAlpha * 0.24 })

      if (fleetState.awakened) {
        const vortexPhase =
          0.5 + Math.sin((this.motionClock / 2.4) * Math.PI * 2) * 0.5
        const vortexScale = lerp(0.9, 1.08, vortexPhase)
        this.cinderwakeFleetGlow
          .ellipse(
            this.player.x - 9,
            this.player.y + 3,
            95 * vortexScale,
            64 * vortexScale,
          )
          .fill({ color: 0x441f58, alpha: lerp(0.055, 0.13, vortexPhase) })
          .ellipse(
            this.player.x + 16,
            this.player.y - 7,
            66 * vortexScale,
            41 * vortexScale,
          )
          .fill({ color: 0x79182a, alpha: lerp(0.045, 0.11, vortexPhase) })
      }
      this.cinderwakeFleetGlow.alpha = fleetEnergy

      // Theater cinders are a small, fleet-wide budget. They drift irregularly
      // around the blades instead of forming a dotted orbit on every actor.
      for (let cinder = 0; cinder < fleetProfile.cinders; cinder += 1) {
        const actor = renderedReavers[cinder % renderedReavers.length]
        const cycle =
          (((this.motionClock - cinder * 0.31) % 2.2) + 2.2) % 2.2 / 2.2
        let driftX: number
        let driftY: number
        let cinderAlpha: number
        let cinderScale: number
        if (cycle < 0.38) {
          const progress = cycle / 0.38
          driftX = lerp(-7, 5, progress)
          driftY = lerp(12, -8, progress)
          cinderAlpha = lerp(0.06, 0.84, progress)
          cinderScale = lerp(0.55, 1, progress)
        } else if (cycle < 0.72) {
          const progress = (cycle - 0.38) / 0.34
          driftX = lerp(5, 13, progress)
          driftY = lerp(-8, -21, progress)
          cinderAlpha = lerp(0.84, 0.23, progress)
          cinderScale = lerp(1, 0.7, progress)
        } else {
          const progress = (cycle - 0.72) / 0.28
          driftX = lerp(13, -7, progress)
          driftY = lerp(-21, 12, progress)
          cinderAlpha = lerp(0.23, 0.06, progress)
          cinderScale = lerp(0.7, 0.55, progress)
        }
        const offsetAngle = cinder * 2.399963 + actor.reaver.slot * 0.67
        const offsetRadius =
          fleetProfile.visualDiameter * (0.24 + (cinder % 3) * 0.08)
        const x = actor.x + Math.cos(offsetAngle) * offsetRadius + driftX
        const y = actor.y + Math.sin(offsetAngle) * offsetRadius * 0.62 + driftY
        const radius = Math.max(1.15, 1.45 * cinderScale)
        this.projectileTrailGraphics
          .circle(x, y, radius * 5.2)
          .fill({ color: 0x57296b, alpha: cinderAlpha * 0.12 * fleetEnergy })
          .circle(x, y, radius * 2.8)
          .fill({ color: 0xbb2a39, alpha: cinderAlpha * 0.24 * fleetEnergy })
          .circle(x, y, radius)
          .fill({ color: 0xd96361, alpha: cinderAlpha * fleetEnergy })
      }

      // Sparse arena particles make fast paths readable without outlining
      // them. Their positions trail velocity and never resolve into a circle.
      for (
        let particle = 0;
        particle < fleetProfile.ambientParticleBudget;
        particle += 1
      ) {
        const actor = renderedReavers[particle % renderedReavers.length]
        const velocity = Math.max(
          1,
          Math.hypot(actor.reaver.vx, actor.reaver.vy),
        )
        const trailX = -actor.reaver.vx / velocity
        const trailY = -actor.reaver.vy / velocity
        const normalX = -trailY
        const normalY = trailX
        const phase =
          ((this.motionClock * 0.54 + particle * 0.137) % 1 + 1) % 1
        const distance = 8 + phase * (32 + (particle % 4) * 7)
        const side = ((particle * 29) % 11 - 5) * 1.8
        const shimmer = Math.sin(Math.PI * phase) ** 2
        const x = actor.x + trailX * distance + normalX * side
        const y = actor.y + trailY * distance + normalY * side
        this.projectileTrailGraphics
          .circle(x, y, 3.4 + (particle % 2) * 0.8)
          .fill({ color: 0x57296b, alpha: shimmer * 0.09 * fleetEnergy })
          .circle(x, y, 1.55)
          .fill({ color: 0xbb2a39, alpha: shimmer * 0.24 * fleetEnergy })
          .circle(x, y, 0.72)
          .fill({ color: 0xea7467, alpha: shimmer * 0.7 * fleetEnergy })
      }
    }

    for (const reaver of activeReavers) {
      const presentation = cinderwakeReaverPresentationProfile(
        reaver.visualState.rank,
        reaver.visualState.awakened,
      )
      const frame = this.cinderwakeReaverFrames[
        (Math.floor(this.motionClock * (16 / 0.72)) + reaver.frameOffset) %
          Math.max(1, this.cinderwakeReaverFrames.length)
      ]
      if (frame) {
        reaver.auraSprite.texture = frame
        reaver.edgeSprite.texture = frame
        reaver.sprite.texture = frame
      }
      const renderX = lerp(reaver.previousX, reaver.x, this.interpolation)
      const renderY = lerp(reaver.previousY, reaver.y, this.interpolation)
      reaver.auraSprite.position.set(renderX, renderY)
      reaver.edgeSprite.position.set(renderX, renderY)
      reaver.sprite.position.set(renderX, renderY)
      reaver.auraSprite.rotation = reaver.spin
      reaver.edgeSprite.rotation = reaver.spin
      reaver.sprite.rotation = reaver.spin
      const tier = reaver.visualState.awakened
        ? 6
        : Math.max(1, Math.min(5, reaver.visualState.rank))
      const size = presentation.visualDiameter
      const travelAngle = Math.atan2(reaver.vy, reaver.vx)

      const wakeCycle =
        (((this.motionClock - reaver.slot * 0.17) % 1.1) + 1.1) % 1.1 / 1.1
      const wakeRise = wakeCycle <= 0.45
        ? wakeCycle / 0.45
        : 1 - (wakeCycle - 0.45) / 0.55
      const wakeLength = lerp(0.72, 1.12, wakeRise)
      reaver.wakeGlow.position.set(renderX, renderY)
      reaver.wakeGlow.rotation = travelAngle - Math.PI / 15
      reaver.wakeGlow.scale.set(
        presentation.scale * wakeLength,
        presentation.scale,
      )
      reaver.wakeGlow.alpha = lerp(0.08, 0.47, wakeRise) * fleetEnergy
      reaver.wakeGlow.blendMode = 'add'
      reaver.wakeGlow.visible = true

      const impactCycle =
        (((this.motionClock - reaver.slot * 0.19) % 1.16) + 1.16) % 1.16 /
        1.16
      let impactAlpha = 0.04
      let impactScale = 0.32
      let impactRotation = -Math.PI / 22.5
      if (impactCycle >= 0.62 && impactCycle < 0.74) {
        const progress = (impactCycle - 0.62) / 0.12
        impactAlpha = lerp(0.04, 0.65, progress)
        impactScale = lerp(0.32, 1.18, progress)
        impactRotation = lerp(-Math.PI / 22.5, Math.PI / 45, progress)
      } else if (impactCycle >= 0.74 && impactCycle < 0.88) {
        const progress = (impactCycle - 0.74) / 0.14
        impactAlpha = lerp(0.65, 0.13, progress)
        impactScale = lerp(1.18, 1.52, progress)
        impactRotation = lerp(Math.PI / 45, Math.PI / 20, progress)
      }
      reaver.impactGlow.position.set(renderX, renderY)
      reaver.impactGlow.rotation = impactRotation
      reaver.impactGlow.scale.set(impactScale * presentation.scale)
      reaver.impactGlow.alpha = impactAlpha * fleetEnergy
      reaver.impactGlow.blendMode = 'add'
      reaver.impactGlow.visible = true

      this.projectileTrailGraphics
        .ellipse(renderX, renderY, size * 0.19, size * 0.13)
        .fill({ color: 0x811d2b, alpha: 0.1 * fleetEnergy })

      // Apply the Theater's material progression directly from spell rank;
      // named VFX stages intentionally do not collapse Ranks I-IV here.
      reaver.materialFilter.reset()
      reaver.materialFilter.saturate(
        reaver.visualState.awakened ? 0.24 : tier >= 2 ? 0.14 : 0.08,
        false,
      )
      reaver.materialFilter.contrast(
        reaver.visualState.awakened ? 0.18 : tier >= 2 ? 0.16 : 0.13,
        true,
      )
      if (reaver.visualState.awakened) {
        reaver.materialFilter.brightness(1.08, true)
      }

      // Additive copies follow the authored blade alpha, yielding the same
      // crimson material edge and restrained awakened violet bloom as Theater.
      reaver.auraSprite.width = size * 1.23
      reaver.auraSprite.height = size * 1.23
      reaver.auraSprite.tint = reaver.visualState.awakened
        ? 0x4b2869
        : tier >= 4
          ? 0xa52632
          : 0x811d2b
      reaver.auraSprite.alpha =
        (0.14 + tier * 0.012 + (reaver.visualState.awakened ? 0.055 : 0)) *
        fleetEnergy
      reaver.auraSprite.blendMode = 'add'
      reaver.auraSprite.visible = true
      reaver.edgeSprite.width = size * 1.11
      reaver.edgeSprite.height = size * 1.11
      reaver.edgeSprite.tint = reaver.visualState.awakened
        ? 0xf07178
        : tier >= 4
          ? 0xe95a68
          : 0xd94655
      reaver.edgeSprite.alpha =
        (0.28 + tier * 0.018 + (reaver.visualState.awakened ? 0.05 : 0)) *
        fleetEnergy
      reaver.edgeSprite.blendMode = 'add'
      reaver.edgeSprite.visible = true
      reaver.sprite.width = size
      reaver.sprite.height = size
      reaver.sprite.alpha =
        Math.min(0.98, 0.76 + tier * 0.035) * fleetEnergy
      reaver.sprite.blendMode = 'normal'
      reaver.sprite.visible = true
    }
  }

  private updateSupportPickups() {
    const bossAt = this.qaMode
      ? Math.min(45, this.level.duration * 0.2)
      : Math.max(45, this.level.duration - 38)
    if (
      this.elapsed < this.nextSupportPickupAt ||
      this.elapsed >= bossAt ||
      this.bossSpawned ||
      this.completed
    ) {
      return
    }

    const kind = chooseSupportPickup({
      activeExperiencePickups: this.pickups.reduce(
        (count, pickup) => count + (pickup.active && pickup.kind === 'xp' ? 1 : 0),
        0,
      ),
      pulseCharge: this.player.pulseCharge,
      dropIndex: this.supportPickupDrops,
    })
    if (!kind) {
      this.nextSupportPickupAt = this.elapsed + 12
      return
    }
    const point = this.findSafeSpawnPoint(250, 360, 86, 78)
    this.spawnPickup(point.x, point.y, 0, kind)
    this.supportPickupDrops += 1
    this.nextSupportPickupAt =
      this.elapsed +
      supportPickupIntervalSeconds(
        this.level.difficulty,
        clamp(this.elapsed / this.level.duration, 0, 1),
      )
  }

  private updatePlannedDawnheartDrops() {
    if (this.bossSpawned || this.completed) return

    while (this.plannedDawnheartIndex < this.plannedDawnheartWindows.length) {
      const window = this.plannedDawnheartWindows[this.plannedDawnheartIndex]
      if (this.elapsed < window.opensAt) return
      if (this.elapsed > window.closesAt) {
        this.plannedDawnheartIndex += 1
        continue
      }

      const activeDawnheart = this.pickups.some(
        (pickup) => pickup.active && pickup.kind === 'dawnheart',
      )
      if (
        !canSpawnPlannedDawnheart({
          elapsed: this.elapsed,
          hpRatio: this.player.hp / this.player.maxHp,
          activeDawnheart,
          lastReviveAt: this.lastReviveAt,
          window,
        })
      ) {
        return
      }

      const point = this.findSafeSpawnPoint(300, 380, 86, 78)
      this.spawnPickup(
        point.x,
        point.y,
        PLANNED_DAWNHEART_HEAL_FRACTION,
        'dawnheart',
        PLANNED_DAWNHEART_LIFETIME_SECONDS,
      )
      this.plannedDawnheartIndex += 1
      this.host.dataset.plannedDawnheartDrops = String(this.plannedDawnheartIndex)
      return
    }
  }

  private updatePickups(delta: number) {
    const magnetRank = this.persistentUpgrades.magnetism ?? 0
    const gravRank = this.modules.find((module) => module.id === 'grav-anchor')?.rank ?? 0
    const magnetRadius = 132 * (1 + magnetRank * 0.07 + gravRank * 0.12)

    for (const pickup of this.pickups) {
      if (!pickup.active) continue
      pickup.previousX = pickup.x
      pickup.previousY = pickup.y
      pickup.age += delta
      if (pickup.age > pickup.lifetime) {
        pickup.active = false
        pickup.sprite.visible = false
        continue
      }
      const dx = this.player.x - pickup.x
      const dy = this.player.y - pickup.y
      const distance = Math.max(0.001, Math.hypot(dx, dy))
      const attractionRadius = pickup.kind === 'xp'
        ? magnetRadius
        : 178 + magnetRank * 6 + gravRank * 7
      if (distance < attractionRadius) {
        const speed = 120 + (1 - distance / attractionRadius) * (pickup.kind === 'xp' ? 540 : 690)
        pickup.x += (dx / distance) * speed * delta
        pickup.y += (dy / distance) * speed * delta
      }
      if (distance < (pickup.kind === 'xp' ? 33 : 42)) {
        pickup.active = false
        pickup.sprite.visible = false
        if (pickup.kind === 'xp') {
          this.collectExperience(pickup.value)
          this.audio.play('pickup', 0.36)
        } else {
          this.collectSupportPickup(pickup.kind, pickup.value)
        }
      }
    }
  }

  private collectExperience(value: number) {
    this.player.pulseCharge = clamp(
      this.player.pulseCharge + pulseChargeFromExperience(value),
      0,
      100,
    )
    if (this.runConfig.fixedLoadout) return
    this.player.xp += value
    while (this.player.xp >= this.player.xpToNext && !this.upgradeOptions?.length) {
      this.levelUp()
    }
  }

  private collectSupportPickup(kind: SupportPickupKind, value: number) {
    let color = 0x70ecff
    if (kind === 'dawnheart') {
      color = 0xff6f86
      const healFraction = clamp(
        value || PLANNED_DAWNHEART_HEAL_FRACTION,
        0,
        PLANNED_DAWNHEART_HEAL_FRACTION,
      )
      this.player.hp = Math.min(
        this.player.maxHp,
        this.player.hp + this.player.maxHp * healFraction,
      )
    } else if (kind === 'gravestar') {
      color = 0xffd978
      let gatheredExperience = 0
      for (const pickup of this.pickups) {
        if (!pickup.active || pickup.kind !== 'xp') continue
        gatheredExperience += pickup.value
        pickup.active = false
        pickup.sprite.visible = false
      }
      if (gatheredExperience > 0) this.collectExperience(gatheredExperience)
    } else {
      this.primedTracePulseBonus = Math.max(this.primedTracePulseBonus, 35)
    }

    this.audio.play('pickup', 1.05)
    this.rings.push({
      x: this.player.x,
      y: this.player.y,
      radius: 12,
      maxRadius: 155,
      life: 0.52,
      total: 0.52,
      color,
      width: 7,
    })
    this.spawnBurst(this.player.x, this.player.y, color, 24, 250)
    this.screenFlashAlpha = this.settings.reducedFlash ? 0.025 : 0.085
    this.emitSnapshot(true)
  }

  private updateTelegraphs(delta: number) {
    for (const telegraph of this.telegraphs) {
      if (!telegraph.active) continue
      telegraph.life -= delta
      if (telegraph.life > 0) continue
      telegraph.active = false
      this.activeTelegraphCount = Math.max(0, this.activeTelegraphCount - 1)
      if (telegraph.specialAttack) {
        this.audio.playHostileSpecialRelease(
          telegraph.bossAttack ? 'boss' : 'elite',
          telegraph.kind === 'circle' ? 'field' : 'lane',
        )
      }

      const hit =
        telegraph.kind === 'circle'
          ? circleTouchesHeroBody(
              this.player.x,
              this.player.y,
              telegraph.x,
              telegraph.y,
              telegraph.radius,
            )
          : laneTouchesHeroBody(
              this.player.x,
              this.player.y,
              telegraph.x,
              telegraph.y,
              telegraph.angle,
              telegraph.length,
              telegraph.width,
            )

      if (hit) {
        this.damagePlayer(telegraph.damage, {
          kind: 'telegraph',
          boss: telegraph.bossAttack,
          originX: telegraph.x,
          originY: telegraph.y,
          color:
            telegraph.color ??
            (telegraph.bossAttack
              ? bossPresentation(this.bossLevel.bossId).primaryColor
              : 0x8f3348),
        })
      }
      const ashColor = telegraph.bossAttack ? 0x766963 : 0x5c5552
      if (telegraph.kind === 'line') {
        const endX = telegraph.x + Math.cos(telegraph.angle) * telegraph.length
        const endY = telegraph.y + Math.sin(telegraph.angle) * telegraph.length
        this.spawnBurst(
          lerp(telegraph.x, endX, 0.72),
          lerp(telegraph.y, endY, 0.72),
          ashColor,
          telegraph.bossAttack ? 6 : 3,
          telegraph.bossAttack ? 125 : 90,
        )
      } else {
        this.spawnBurst(
          telegraph.x,
          telegraph.y,
          ashColor,
          telegraph.bossAttack ? 7 : 4,
          telegraph.bossAttack ? 135 : 95,
        )
      }
    }
  }

  private launchHostileProjectile(
    enemy: EnemyEntity,
    destination: Vec2,
    options: {
      windup: number
      flight: number
      arcHeight: number
      radius: number
      damage: number
      color?: number
    },
  ) {
    const presentation = enemy.isBoss
      ? bossPresentation(this.bossLevel.bossId)
      : enemyPresentation(enemy.id)
    const color = options.color ?? presentation.primaryColor
    const state = queueHostileProjectile(
      {
        id: ++this.hostileProjectileUid,
        sourceUid: enemy.uid,
        origin: {
          x: enemy.x,
          y: enemy.y - enemy.radius * (enemy.isBoss ? 0.42 : 0.3),
        },
        destination: {
          x: clamp(destination.x, options.radius + 24, WORLD_WIDTH - options.radius - 24),
          y: clamp(destination.y, options.radius + 24, WORLD_HEIGHT - options.radius - 24),
        },
        windupSeconds: this.hostileWarningWindow(options.windup),
        flightSeconds: options.flight,
        impactHoldSeconds: 0.22,
        arcHeight: options.arcHeight,
        impactRadius: options.radius,
        damage: options.damage,
        color,
        boss: enemy.isBoss,
      },
      {
        lod: this.visualLod === 'mobile' ? 'mobile' : 'desktop',
        activeCount: this.hostileProjectiles.length,
      },
    )
    if (!state) return false
    this.hostileProjectiles.push({
      state,
      palette: resolveHostileTelegraphPalette({
        family: presentation.colorFamily,
        actorColor: color,
        emphasis: enemy.isBoss ? 1 : 0.18,
      }),
    })
    return true
  }

  private updateHostileProjectiles(delta: number) {
    for (let index = this.hostileProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.hostileProjectiles[index]
      const step = advanceHostileProjectile(projectile.state, delta)
      projectile.state = step.state
      for (const event of step.events) {
        if (event.type === 'release') {
          this.audio.playHostileSpecialRelease(
            projectile.state.config.boss ? 'boss' : 'elite',
            'projectile',
          )
          this.spawnBurst(
            event.origin.x,
            event.origin.y,
            projectile.palette.seepTint,
            projectile.state.config.boss ? 9 : 5,
            projectile.state.config.boss ? 165 : 110,
          )
          continue
        }
        if (circleTouchesHeroBody(
          this.player.x,
          this.player.y,
          event.destination.x,
          event.destination.y,
          event.radius,
        )) {
          this.damagePlayer(event.damage, {
            kind: 'projectile',
            boss: event.boss,
            originX: projectile.state.config.origin.x,
            originY: projectile.state.config.origin.y,
            color: projectile.state.config.color,
          })
        }
        this.spawnBurst(
          event.destination.x,
          event.destination.y,
          projectile.palette.impactTint,
          event.boss ? 13 : 7,
          event.boss ? 210 : 145,
        )
        if (event.boss) {
          this.shake = Math.max(this.shake, 8)
          this.screenFlashAlpha = Math.max(
            this.screenFlashAlpha,
            this.settings.reducedFlash ? 0.025 : 0.075,
          )
        }
      }
      if (step.pose.phase === 'expired') {
        this.hostileProjectiles.splice(index, 1)
      }
    }
    this.host.dataset.hostileProjectiles = String(this.hostileProjectiles.length)
  }

  private drawHostileProjectiles() {
    this.hostileProjectileGraphics.clear()
    for (const projectile of this.hostileProjectiles) {
      const pose = hostileProjectilePoseAt(projectile.state)
      if (!pose.projectileVisible) continue
      const { config } = projectile.state
      const radius = config.boss ? 12 : 8
      const shadowAlpha = 0.2 + pose.flightProgress * 0.16
      this.hostileProjectileGraphics
        .ellipse(
          pose.shadowPosition.x,
          pose.shadowPosition.y + 4,
          radius * pose.shadowScale * 1.55,
          radius * pose.shadowScale * 0.58,
        )
        .fill({ color: HOSTILE_SHADOW_COLOR, alpha: shadowAlpha })

      const trailSteps = this.visualLod === 'mobile' ? 2 : 4
      for (let trail = trailSteps; trail >= 1; trail -= 1) {
        const t = Math.max(0, pose.flightProgress - trail * 0.035)
        const trailX = lerp(config.origin.x, config.destination.x, t)
        const trailY =
          lerp(config.origin.y, config.destination.y, t) -
          4 * config.arcHeight * t * (1 - t)
        this.hostileProjectileGraphics
          .ellipse(
            trailX,
            trailY,
            radius * (0.74 - trail * 0.07),
            radius * (0.48 - trail * 0.035),
          )
          .fill({
            color: projectile.palette.smokeTint,
            alpha: Math.max(0.035, 0.16 - trail * 0.026),
          })
      }

      const flutter = Math.sin(this.motionClock * 14 + config.sourceUid) * 0.18
      this.hostileProjectileGraphics
        .poly(
          [
            pose.position.x,
            pose.position.y - radius * 1.45,
            pose.position.x + radius * (0.72 + flutter),
            pose.position.y,
            pose.position.x,
            pose.position.y + radius * 1.1,
            pose.position.x - radius * (0.72 - flutter),
            pose.position.y,
          ],
          true,
        )
        .fill({
          color: projectile.palette.seepTint,
          alpha: config.boss ? 0.96 : 0.88,
        })
      this.hostileProjectileGraphics
        .ellipse(
          pose.position.x,
          pose.position.y,
          radius * 0.34,
          radius * 0.54,
        )
        .fill({
          color: projectile.palette.impactTint,
          alpha: this.settings.reducedFlash ? 0.58 : 0.82,
        })
    }
  }

  private updateVisualEffects(delta: number) {
    for (const echo of this.motionEchoes) {
      if (!echo.active) continue
      echo.life -= delta
      if (echo.life <= 0) {
        echo.active = false
        echo.sprite.visible = false
        continue
      }
      const progress = 1 - echo.life / echo.total
      echo.x += echo.driftX * delta
      echo.y += echo.driftY * delta
      echo.sprite.position.set(echo.x, echo.y)
      echo.sprite.rotation = echo.rotation + progress * 0.035
      echo.sprite.scale.set(
        echo.baseScaleX * (1 + progress * 0.08),
        echo.baseScaleY * (1 + progress * 0.08),
      )
      const fade = progress * progress * (3 - 2 * progress)
      echo.sprite.alpha = echo.baseAlpha * (1 - fade)
    }
    for (const particle of this.particles) {
      if (!particle.active) continue
      particle.life -= delta
      if (particle.life <= 0) {
        particle.active = false
        particle.sprite.visible = false
        continue
      }
      particle.x += particle.vx * delta
      particle.y += particle.vy * delta
      particle.vx *= Math.pow(0.06, delta)
      particle.vy *= Math.pow(0.06, delta)
      particle.sprite.position.set(particle.x, particle.y)
      particle.sprite.rotation += particle.spin * delta
      particle.sprite.alpha = clamp(particle.life / particle.total, 0, 1)
    }
    for (const ring of this.rings) ring.life -= delta
    for (const effect of this.loopEffects) effect.life -= delta
    for (const effect of this.weaponEffects) {
      effect.life -= delta
      if (effect.kind === 'astral-verdict') {
        const elapsed = effect.total - Math.max(0, effect.life)
        const strikeTotal = effect.points?.length ?? 0
        let triggered = effect.triggeredStrikeCount ?? 0
        while (triggered < strikeTotal) {
          const releaseAt = 0.07 + Math.min(0.28, triggered * 0.045)
          if (elapsed < releaseAt) break
          for (const hit of effect.strikeHits ?? []) {
            if (hit.strikeIndex !== triggered) continue
            const enemy = this.enemies.find(
              (candidate) => candidate.active && candidate.uid === hit.targetUid,
            )
            if (enemy) this.damageEnemy(enemy, hit.damage, 'rift-seeds')
          }
          triggered += 1
        }
        effect.triggeredStrikeCount = triggered
      }
      if (effect.hitPulseLife !== undefined) {
        effect.hitPulseLife = Math.max(0, effect.hitPulseLife - delta)
      }
    }
    this.lightRingPulse = Math.max(0, this.lightRingPulse - delta)
    this.combatTextQueue.advance(delta)
    this.playerHitFeedbackRemaining = Math.max(
      0,
      this.playerHitFeedbackRemaining - delta,
    )
    if (this.playerHitFeedbackRemaining <= 0) {
      this.playerHitFeedback = undefined
    }
    this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - delta * 1.5)
    this.shake = Math.max(0, this.shake - delta * 26)
  }

  private updateTrace() {
    const liveTrace = pruneExpiredTracePoints(this.trace, this.elapsed)
    if (liveTrace.length !== this.trace.length) {
      this.trace.splice(0, this.trace.length, ...liveTrace)
    }

    const last = this.trace[this.trace.length - 1]
    const point: TimestampedTracePoint = {
      x: this.player.x,
      y: this.player.y,
      bornAt: this.elapsed,
    }
    if (!last) {
      this.trace.push(point)
      return
    }
    if (traceSegmentIsDiscontinuous(last, point)) {
      this.trace.length = 0
      this.trace.push(point)
      return
    }
    if (distanceSquared(last, point) < TRACE_SAMPLE_DISTANCE ** 2) return
    this.trace.push(point)
    const memoryRank = this.persistentUpgrades.pulse ?? 0
    const maxPoints = tracePointAllowance(
      memoryRank,
      this.traceMods.includes('afterimage'),
    )
    if (this.trace.length > maxPoints) this.trace.splice(0, this.trace.length - maxPoints)
    if (this.trace.length < TRACE_MINIMUM_POINTS) return

    // Let a near-return close the circuit as well as an exact segment crossing.
    // Keyboard and touch movement rarely land on the identical sub-pixel, so this
    // small magnetic latch makes intentionally drawn loops feel dependable.
    for (let index = 0; index < this.trace.length - 8; index += 1) {
      if (distanceSquared(point, this.trace[index]) > 30 ** 2) continue
      const polygon = [this.trace[index], ...this.trace.slice(index + 1)]
      const area = polygonArea(polygon)
      if (area < TRACE_MINIMUM_AREA) continue
      this.closeLoop(polygon, area)
      this.trace.length = 0
      this.trace.push(point)
      return
    }

    const lastStart = this.trace[this.trace.length - 2]
    const lastEnd = this.trace[this.trace.length - 1]
    for (let index = 0; index < this.trace.length - 7; index += 1) {
      const intersection = segmentIntersection(
        lastStart,
        lastEnd,
        this.trace[index],
        this.trace[index + 1],
      )
      if (!intersection) continue
      const polygon = [intersection, ...this.trace.slice(index + 1)]
      const area = polygonArea(polygon)
      if (area < TRACE_MINIMUM_AREA) continue
      this.closeLoop(polygon, area)
      this.trace.length = 0
      this.trace.push(point)
      break
    }
  }

  private closeLoop(polygon: Vec2[], area: number) {
    let chain = 0
    const echoRank = this.persistentUpgrades['echo-chamber'] ?? 0
    const multiplier =
      (1 + echoRank * 0.05) * (this.traceMods.includes('closed-circuit') ? 1.35 : 1)
    const damage = (34 + this.player.level * 5.5 + Math.min(90, area * 0.0017)) * multiplier
    for (const enemy of this.enemies) {
      if (!enemy.active || !pointInPolygon({ x: enemy.x, y: enemy.y }, polygon)) continue
      chain += 1
      this.damageEnemy(enemy, damage * (enemy.isBoss ? 0.65 : 1), 'helio-lance', false)
    }
    this.closedLoops += 1
    this.largestChain = Math.max(this.largestChain, chain)
    const pulseReward = tracePulseReward({
      pointCount: polygon.length,
      area,
      enemiesTrapped: chain,
      primedBonus: this.primedTracePulseBonus,
    })
    if (pulseReward > 0) {
      this.player.pulseCharge = clamp(this.player.pulseCharge + pulseReward, 0, 100)
      this.primedTracePulseBonus = 0
    }
    this.loopEffects.push({
      points: polygon.map((point) => ({ ...point })),
      life: 0.58,
      total: 0.58,
      color: 0x73f7df,
    })
    this.rings.push({
      x: this.player.x,
      y: this.player.y,
      radius: 18,
      maxRadius: 120 + Math.sqrt(area) * 0.35,
      life: 0.54,
      total: 0.54,
      color: 0xffda72,
      width: 7,
    })
    this.spawnBurst(this.player.x, this.player.y, 0x72f7df, 22 + Math.min(20, chain), 260)
    this.audio.play('loop')
    this.shake = Math.max(this.shake, 8 + Math.min(chain, 10))
    this.screenFlashAlpha = this.settings.reducedFlash ? 0.025 : 0.12
  }

  private damageEnemy(
    enemy: EnemyEntity,
    rawDamage: number,
    weaponId: WeaponId,
    trackWeaponDamage = true,
    allowFaultline = true,
    impactColor?: number,
  ) {
    if (this.revivePending || !enemy.active || rawDamage <= 0) return
    const forceRank = this.persistentUpgrades.force ?? 0
    const critRank = this.persistentUpgrades['parallax-eye'] ?? 0
    const bossRank = this.persistentUpgrades['dawn-within'] ?? 0
    const critChance = critRank * 0.015 + (this.traceMods.includes('nightglass') ? 0.06 : 0)
    const critical = this.random.next() < critChance
    let damage = rawDamage * (1 + forceRank * 0.02)
    if (enemy.isBoss) damage *= 1 + bossRank * 0.08
    if (enemy.id === 'cinder-guard' && !enemy.isBoss) damage *= 0.72
    if (critical) damage *= 1.75
    enemy.hp -= damage
    enemy.hitFlash = 0.055
    enemy.hitMotionDuration = enemy.isBoss ? 0.22 : 0.16
    enemy.hitMotionRemaining = enemy.hitMotionDuration
    enemy.reactionAngle = Math.atan2(
      this.player.y - enemy.y,
      this.player.x - enemy.x,
    )
    if (trackWeaponDamage) {
      this.weaponDamage.set(weaponId, (this.weaponDamage.get(weaponId) ?? 0) + damage)
    }
    if (this.settings.showDamageNumbers) {
      const damageColor = critical
        ? COMBAT_TEXT_COLORS.critical
        : impactColor ?? WEAPONS[weaponId].color
      this.queueCombatText(
        `enemy:${enemy.uid}:${weaponId}`,
        enemy.isBoss ? 'boss' : 'horde',
        enemy.x,
        enemy.y - enemy.radius * (enemy.isBoss ? 0.98 : 0.78),
        damage,
        damageColor,
        critical,
      )
    }
    this.spawnBurst(
      enemy.x,
      enemy.y,
      critical ? 0xfff2b0 : impactColor ?? WEAPONS[weaponId].color,
      critical ? 7 : 3,
      95,
    )
    const lethal = enemy.hp <= 0
    const wasBoss = enemy.isBoss
    if (lethal) {
      if (wasBoss) {
        this.spawnMotionEcho(
          enemy.sprite,
          enemy.x,
          enemy.y,
          this.actorAccentColor(enemy),
          0.7,
          0,
          -18,
          0.34,
        )
        this.spawnBurst(enemy.x, enemy.y, 0xffd87a, 52, 390)
      }
      // Remove lethal targets before any chained proc so a neighboring fracture
      // cannot recurse into the same death and award it twice.
      enemy.active = false
      enemy.vx = 0
      enemy.vy = 0
      enemy.pendingContactDamage = 0
      enemy.blinkTargetX = null
      enemy.blinkTargetY = null
      enemy.attackMotionRemaining = 0
      enemy.attackMotionDuration = 0
      enemy.attackMotionStyle = 'none'
      enemy.deathMotionDuration = wasBoss ? BOSS_DEATH_MOTION_SECONDS : 0.42
      enemy.deathMotionRemaining = enemy.deathMotionDuration
      enemy.sprite.visible = true
      if (wasBoss) {
        this.rings.push(
          {
            x: enemy.x,
            y: enemy.y,
            radius: Math.max(22, enemy.radius * 0.34),
            maxRadius: Math.max(210, enemy.radius * 2.4),
            life: 1.1,
            total: 1.1,
            color: 0x8b1839,
            width: 11,
          },
          {
            x: enemy.x,
            y: enemy.y,
            radius: Math.max(15, enemy.radius * 0.22),
            maxRadius: Math.max(300, enemy.radius * 3.15),
            life: BOSS_DEATH_MOTION_SECONDS,
            total: BOSS_DEATH_MOTION_SECONDS,
            color: 0x9b57c7,
            width: 6,
          },
        )
        this.spawnBurst(enemy.x, enemy.y, 0x8d1b45, 38, 270)
        this.spawnBurst(enemy.x, enemy.y, 0xd8c8de, 24, 210)
      }
    }
    if (lethal && !wasBoss) {
      // Settle the primary defeat before chained fractures. If a fracture also
      // defeats the sovereign, the emitted results already include this kill.
      this.kills += 1
      this.player.pulseCharge = clamp(
        this.player.pulseCharge + pulseChargeFromNormalKill(),
        0,
        100,
      )
      this.spawnPickup(enemy.x, enemy.y, enemy.xp)
      if (this.traceMods.includes('sunblood') && this.kills % 20 === 0) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.035)
      }
    }
    if (allowFaultline && rawDamage >= 45 && this.traceMods.includes('faultline')) {
      for (const nearby of this.enemies) {
        if (
          !nearby.active ||
          nearby.uid === enemy.uid ||
          (nearby.x - enemy.x) ** 2 + (nearby.y - enemy.y) ** 2 > 86 ** 2
        ) {
          continue
        }
        this.damageEnemy(nearby, rawDamage * 0.18, weaponId, trackWeaponDamage, false)
      }
      this.rings.push({
        x: enemy.x,
        y: enemy.y,
        radius: 5,
        maxRadius: 88,
        life: 0.22,
        total: 0.22,
        color: 0xffb45f,
        width: 3,
      })
    }

    if (!lethal) return
    if (wasBoss) {
      this.boss = undefined
      this.finish(true)
    }
  }

  private damagePlayer(amount: number, context: PlayerDamageContext) {
    if (
      this.hurtCooldown > 0 ||
      this.reviveInvulnerability > 0 ||
      this.revivePending ||
      this.completed
    ) return
    const incomingDamage =
      amount *
      GLOBAL_DIFFICULTY_MULTIPLIER *
      (this.qaMode ? 0.1 : 0.72)
    let remaining = incomingDamage
    const shieldBefore = this.player.shield
    const hpBefore = this.player.hp
    if (!this.runConfig.invincible && this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, remaining)
      this.player.shield -= absorbed
      remaining -= absorbed
    }
    if (!this.runConfig.invincible && remaining > 0) {
      this.player.hp = Math.max(0, this.player.hp - remaining)
    } else if (this.runConfig.invincible) {
      this.player.hp = this.player.maxHp
      this.player.shield = this.player.maxShield
    }
    const shieldDamage = this.runConfig.invincible
      ? 0
      : Math.max(0, shieldBefore - this.player.shield)
    const healthDamage = this.runConfig.invincible
      ? 0
      : Math.max(0, hpBefore - this.player.hp)
    const guardedDamage = this.runConfig.invincible
      ? Math.max(0, incomingDamage)
      : 0
    const feedback = createPlayerHitFeedback({
      playerX: this.player.x,
      playerY: this.player.y,
      maxHp: this.player.maxHp,
      healthDamage: healthDamage + guardedDamage,
      shieldDamage,
      context,
    })
    if (feedback) {
      this.playerHitFeedback = feedback
      this.playerHitFeedbackRemaining = feedback.duration
    }
    if (this.settings.showDamageNumbers) {
      if (shieldDamage > 0 || guardedDamage > 0) {
        this.queueCombatText(
          guardedDamage > 0 ? 'hero:guard' : 'hero:shield',
          'hero-shield',
          this.player.x + 9,
          this.player.y - 38,
          shieldDamage + guardedDamage,
          COMBAT_TEXT_COLORS.heroShield,
        )
      }
      if (healthDamage > 0) {
        this.queueCombatText(
          'hero:health',
          'hero-health',
          this.player.x - 9,
          this.player.y - 52,
          healthDamage,
          COMBAT_TEXT_COLORS.heroHealth,
        )
      }
    }
    this.hurtCooldown = this.qaMode ? 0.75 : 0.42
    this.shieldDelay = 4
    this.shake = Math.max(this.shake, 9)
    this.screenFlashAlpha = this.settings.reducedFlash ? 0.012 : 0.045
    this.heroHurtDuration = 0.32
    this.heroHurtRemaining = this.heroHurtDuration
    this.audio.play('hurt')
    if (this.player.hp <= 0) {
      if (this.revivesRemaining > 0) {
        this.player.shield = 0
        this.revivePending = true
        this.accumulator = 0
        this.emitSnapshot(true)
      } else {
        this.finish(false)
      }
      return
    }
    this.emitSnapshot(true)
  }

  private finish(victory: boolean) {
    if (this.completed) return
    this.revivePending = false
    this.completed = true
    this.manualPaused = false
    this.upgradeOptions = undefined
    this.audio.playGameEnd(victory)
    this.screenFlashAlpha = this.settings.reducedFlash ? 0.05 : 0.25
    const result: RunResult = {
      runMode: this.runConfig.mode,
      victory,
      levelId: this.bossLevel.id,
      survivalTime: this.runConfig.bossOnly
        ? this.elapsed
        : Math.min(this.elapsed, this.level.duration),
      kills: this.kills,
      closedLoops: this.closedLoops,
      largestChain: this.largestChain,
      dawnShards: victory
        ? 28 + this.bossLevel.id * 16 + Math.floor(this.kills * 0.08) + this.closedLoops * 2
        : Math.floor(this.kills * 0.035 + this.closedLoops),
      weaponDamage: this.weapons.map((weapon) => ({
        id: weapon.id,
        damage: Math.round(this.weaponDamage.get(weapon.id) ?? 0),
      })),
    }
    this.pendingResult = result
    this.endSequenceVictory = victory
    this.endSequenceDuration = runEndingDuration(victory)
    this.endSequenceTimer = this.endSequenceDuration
    this.cinematicTitle.text = runEndingTitle(victory, 0)
    this.cinematicTitle.tint = victory ? 0xffd978 : 0xff657c
    this.emitSnapshot(true)
    this.rings.push({
      x: this.player.x,
      y: this.player.y,
      radius: victory ? 22 : 14,
      maxRadius: victory ? 520 : 260,
      life: victory ? 1.5 : 1.1,
      total: victory ? 1.5 : 1.1,
      color: victory ? 0xffdc79 : 0xff536e,
      width: victory ? 12 : 9,
    })
    this.spawnBurst(
      this.player.x,
      this.player.y,
      victory ? 0xffdc79 : 0xff536e,
      victory ? 46 : 28,
      victory ? 340 : 230,
    )
  }

  private spawnPickup(
    x: number,
    y: number,
    value: number,
    kind: 'xp' | SupportPickupKind = 'xp',
    lifetime = kind === 'xp' ? 32 : SUPPORT_PICKUP_LIFETIME_SECONDS,
  ) {
    let pickup = this.pickups.find((candidate) => !candidate.active)
    if (!pickup && this.pickups.length >= 320) {
      const experiencePickups = this.pickups.filter((candidate) => candidate.kind === 'xp')
      pickup = experiencePickups.length > 0
        ? experiencePickups.reduce((oldest, candidate) =>
          candidate.age > oldest.age ? candidate : oldest)
        : kind === 'xp'
          ? undefined
          : this.pickups.reduce((oldest, candidate) =>
            candidate.age > oldest.age ? candidate : oldest)
      if (!pickup) return
      pickup.active = false
      pickup.sprite.visible = false
    }
    if (!pickup) {
      const sprite = new Sprite(this.pickupFrames[0] ?? Texture.WHITE)
      sprite.anchor.set(0.5)
      sprite.visible = false
      this.pickupLayer.addChild(sprite)
      pickup = {
        active: false,
        kind: 'xp',
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        value: 1,
        age: 0,
        lifetime: 32,
        visualSeed: 0,
        sprite,
      }
      this.pickups.push(pickup)
    }
    pickup.active = true
    pickup.kind = kind
    pickup.x = x
    pickup.y = y
    pickup.previousX = x
    pickup.previousY = y
    pickup.value = value
    pickup.age = 0
    pickup.lifetime = lifetime
    pickup.visualSeed = this.pickupVisualSeed
    this.pickupVisualSeed += 1
    const supportPickup = kind !== 'xp'
    const frameIndex = kind === 'dawnheart'
      ? 2
      : kind === 'gravestar'
        ? 3
        : kind === 'pulse-core'
          ? 4
          : value >= 4
            ? 1
            : 0
    pickup.sprite.texture = this.pickupFrames[frameIndex] ?? Texture.WHITE
    const size = supportPickup ? 62 : value >= 4 ? 34 : 24
    pickup.sprite.width = size
    pickup.sprite.height = size
    const pickupTint = kind === 'dawnheart'
      ? 0xff7891
      : kind === 'gravestar'
        ? 0xffd978
        : kind === 'pulse-core'
          ? 0x73edff
          : 0xbafcff
    pickup.sprite.tint = this.settings.highContrastPickups && kind === 'xp'
      ? 0xffffff
      : pickupTint
    pickup.sprite.visible = true
    pickup.sprite.position.set(x, y)
    if (supportPickup) {
      const color = kind === 'dawnheart' ? 0xff6f86 : kind === 'gravestar' ? 0xffd978 : 0x70ecff
      this.spawnBurst(x, y, color, 12, 150)
    }
  }

  private spawnBurst(x: number, y: number, color: number, requestedCount: number, speed: number) {
    const count = this.settings.reducedFlash ? Math.ceil(requestedCount * 0.42) : requestedCount
    for (let index = 0; index < count; index += 1) {
      let particle = this.particles.find((candidate) => !candidate.active)
      if (!particle) {
        if (this.particles.length >= 260) return
        const sprite = new Sprite(this.sparkTexture)
        sprite.anchor.set(0.5)
        sprite.blendMode = 'add'
        sprite.visible = false
        this.effectLayer.addChild(sprite)
        particle = {
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          life: 0,
          total: 0,
          spin: 0,
          sprite,
        }
        this.particles.push(particle)
      }
      const angle = this.random.range(0, Math.PI * 2)
      const velocity = this.random.range(speed * 0.25, speed)
      const life = this.random.range(0.18, 0.52)
      particle.active = true
      particle.x = x
      particle.y = y
      particle.vx = Math.cos(angle) * velocity
      particle.vy = Math.sin(angle) * velocity
      particle.life = life
      particle.total = life
      particle.spin = this.random.range(-8, 8)
      particle.sprite.position.set(x, y)
      particle.sprite.width = this.random.range(2, 7)
      particle.sprite.height = this.random.range(2, 9)
      particle.sprite.tint = color
      particle.sprite.alpha = 1
      particle.sprite.visible = true
    }
  }

  private queueCombatText(
    targetKey: string,
    target: CombatTextTarget,
    x: number,
    y: number,
    amount: number,
    color: number,
    critical = false,
  ) {
    this.combatTextQueue.request({
      targetKey,
      target,
      x,
      y,
      amount,
      color,
      critical,
    })
  }

  private syncCombatTextSprites() {
    const entries = this.settings.showDamageNumbers
      ? this.combatTextQueue.active()
      : []
    const activeIds = new Set(entries.map(({ id }) => id))

    for (const [id, text] of this.combatTextSprites) {
      if (activeIds.has(id)) continue
      text.visible = false
      this.combatTextSprites.delete(id)
      this.combatTextPool.push(text)
    }

    const inverseWorldScale = 1 / Math.max(0.001, this.world.scale.x)
    for (const entry of entries) {
      let text = this.combatTextSprites.get(entry.id)
      if (!text) {
        text = this.combatTextPool.pop()
        if (!text) {
          text = new Text({
            text: '',
            style: {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: 12,
              fontWeight: '800',
              fill: 0xffffff,
              stroke: { color: 0x03070c, width: 2 },
              dropShadow: {
                color: 0x000000,
                alpha: 0.82,
                blur: 2,
                distance: 1,
              },
            },
          })
          text.anchor.set(0.5)
          text.eventMode = 'none'
          this.combatTextLayer.addChild(text)
        }
        this.combatTextSprites.set(entry.id, text)
      }

      const pose = combatTextPose(entry)
      text.text = `${formatCombatDamage(entry.amount)}${entry.critical ? '!' : ''}`
      text.style.fontSize = combatTextFontSize(entry)
      text.style.fill = entry.color
      text.style.stroke = {
        color: 0x03070c,
        width: entry.critical ? 3 : 2,
      }
      text.position.set(pose.x, pose.y)
      text.scale.set(pose.scale * inverseWorldScale)
      text.alpha = pose.alpha
      text.visible = true
    }
  }

  private deactivateProjectile(projectile: ProjectileEntity) {
    projectile.active = false
    projectile.sprite.visible = false
    projectile.hitIds.length = 0
  }

  private rebuildEnemyGrid() {
    for (const bucket of this.enemyGrid.values()) {
      bucket.length = 0
      this.gridBuckets.push(bucket)
    }
    this.enemyGrid.clear()
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      const cellX = Math.floor(enemy.x / GRID_SIZE)
      const cellY = Math.floor(enemy.y / GRID_SIZE)
      const key = cellX + cellY * 100
      let bucket = this.enemyGrid.get(key)
      if (!bucket) {
        bucket = this.gridBuckets.pop() ?? []
        this.enemyGrid.set(key, bucket)
      }
      bucket.push(enemy)
    }
  }

  private queryEnemyGrid(x: number, y: number, radius: number) {
    const output: EnemyEntity[] = []
    const minX = Math.floor((x - radius) / GRID_SIZE)
    const maxX = Math.floor((x + radius) / GRID_SIZE)
    const minY = Math.floor((y - radius) / GRID_SIZE)
    const maxY = Math.floor((y + radius) / GRID_SIZE)
    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const bucket = this.enemyGrid.get(cellX + cellY * 100)
        if (bucket) output.push(...bucket)
      }
    }
    return output
  }

  private nearestEnemy(x: number, y: number, ignoredIds: number[] = []) {
    let nearest: EnemyEntity | undefined
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const enemy of this.enemies) {
      if (!enemy.active || ignoredIds.includes(enemy.uid)) continue
      const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2
      if (distance >= nearestDistance) continue
      nearestDistance = distance
      nearest = enemy
    }
    return nearest
  }

  private nearbyEnemyCount(x: number, y: number, radius: number) {
    const radiusSquared = radius * radius
    let count = 0
    for (const enemy of this.enemies) {
      if (enemy.active && (enemy.x - x) ** 2 + (enemy.y - y) ** 2 <= radiusSquared) count += 1
    }
    return count
  }

  private areaDamage(
    x: number,
    y: number,
    radius: number,
    damage: number,
    weaponId: WeaponId,
    bossDamage = damage,
  ) {
    const radiusSquared = radius * radius
    const impacts: Vec2[] = []
    for (const enemy of this.enemies) {
      if (!enemy.active || (enemy.x - x) ** 2 + (enemy.y - y) ** 2 > radiusSquared) continue
      this.damageEnemy(enemy, enemy.isBoss ? bossDamage : damage, weaponId)
      if (impacts.length < 12) impacts.push({ x: enemy.x, y: enemy.y })
    }
    return impacts
  }

  private astralVerdictTargets(
    primary: EnemyEntity,
    count: number,
    seed: number,
  ): Vec2[] {
    const candidates = this.enemies
      .filter((enemy) => enemy.active)
      .map((enemy) => ({
        enemy,
        score:
          this.nearbyEnemyCount(enemy.x, enemy.y, 116) * 120 -
          Math.sqrt(distanceSquared(enemy, this.player)) * 0.16 +
          (enemy.isBoss ? 1_000 : 0),
      }))
      .sort((left, right) => right.score - left.score)

    const points: Vec2[] = []
    for (const { enemy } of candidates) {
      if (points.length >= count) break
      if (
        points.some(
          (point) => distanceSquared(point, enemy) < 72 ** 2,
        )
      ) {
        continue
      }
      points.push({ x: enemy.x, y: enemy.y })
    }

    if (points.length === 0) points.push({ x: primary.x, y: primary.y })
    while (points.length < count) {
      const index = points.length
      const angle =
        replacementCosmeticUnit(seed, index, 347) * Math.PI * 2
      const distance = 7 + (index % 3) * 5
      points.push({
        x: clamp(primary.x + Math.cos(angle) * distance, 42, WORLD_WIDTH - 42),
        y: clamp(primary.y + Math.sin(angle) * distance, 42, WORLD_HEIGHT - 42),
      })
    }
    return points.slice(0, count)
  }

  private castAstralVerdict(
    target: EnemyEntity,
    castDamageBudget: number,
    rank: number,
    moduleRank: number,
    awakened: boolean,
    visualState: WeaponVfxState,
    visualSeed: number,
  ) {
    const strikeCount = Math.min(
      8,
      rank + moduleRank + (awakened ? 2 : 0),
    )
    const strikeRadius =
      72 + rank * 7 + moduleRank * 7 + (awakened ? 12 : 0)
    const points = this.astralVerdictTargets(target, strikeCount, visualSeed)
    const strikeRadiusSquared = strikeRadius ** 2
    const covered = this.enemies
      .filter((enemy) => enemy.active)
      .map((enemy) => {
        let strikeIndex = -1
        let nearest = Number.POSITIVE_INFINITY
        for (let index = 0; index < points.length; index += 1) {
          const distance = distanceSquared(enemy, points[index])
          if (distance > strikeRadiusSquared || distance >= nearest) continue
          nearest = distance
          strikeIndex = index
        }
        return { enemy, strikeIndex }
      })
      .filter(({ strikeIndex }) => strikeIndex >= 0)
    const distributedDamage = distributeRemoteCastDamage(
      castDamageBudget,
      covered.map(({ enemy }) => enemy),
    )
    const strikeHits = covered.map(({ enemy, strikeIndex }, index) => ({
      targetUid: enemy.uid,
      strikeIndex,
      damage: distributedDamage[index] ?? 0,
    }))

    const duration = 0.72 + Math.min(0.24, points.length * 0.035)
    this.pushWeaponEffect({
      kind: 'astral-verdict',
      weaponId: 'rift-seeds',
      visualState,
      x: points[0].x,
      y: points[0].y,
      angle: -Math.PI * 0.5,
      radius: strikeRadius * 0.28,
      maxRadius: strikeRadius,
      life: duration,
      total: duration,
      seed: visualSeed,
      points,
      strikeHits,
      triggeredStrikeCount: 0,
    })
  }

  private chainLightning(
    first: EnemyEntity,
    damage: number,
    jumps: number,
    weaponId: WeaponId,
    visualState: WeaponVfxState,
    visualSeed: number,
  ) {
    const hit: number[] = []
    const origin = this.currentHeroWeaponOrigin()
    const points: Vec2[] = [{ ...origin }]
    const chain: EnemyEntity[] = []
    let current: EnemyEntity | undefined = first
    for (let jump = 0; jump < jumps && current; jump += 1) {
      hit.push(current.uid)
      chain.push(current)
      points.push({ x: current.x, y: current.y })
      current = this.nearestEnemy(current.x, current.y, hit)
      if (current && distanceSquared(current, { x: first.x, y: first.y }) > 320 ** 2) break
    }
    const weights = chain.map(
      (enemy, index) =>
        Math.max(0.48, 1 - index * 0.09) * (enemy.isBoss ? 3 : 1),
    )
    const totalWeight = weights.reduce((total, weight) => total + weight, 0)
    for (let index = 0; index < chain.length; index += 1) {
      this.damageEnemy(
        chain[index],
        totalWeight > 0 ? (damage * weights[index]) / totalWeight : 0,
        weaponId,
      )
    }
    if (points.length > 1) {
      this.pushWeaponEffect({
        kind: 'arc-chain',
        weaponId,
        visualState,
        x: origin.x,
        y: origin.y,
        angle: 0,
        radius: 34,
        maxRadius: 84 + visualState.detail * 8,
        life: visualState.stage === 'final' ? 0.58 : 0.44,
        total: visualState.stage === 'final' ? 0.58 : 0.44,
        seed: visualSeed,
        points,
        pointScales: [1, ...chain.map((enemy) => (enemy.isBoss ? 1.25 : 1))],
      })
    }
  }

  private bossAttack(enemy: EnemyEntity) {
    // Reserve enough headroom for one complete signature while preventing
    // late-phase casts, hazards, and ordinary specials from flooding the arena.
    if (this.activeTelegraphCount > 24) return
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x)
    const patternDecision = directBossPattern({
      levelId: this.bossLevel.id,
      phase: enemy.phase,
      roll: this.random.next(),
      state: this.bossPatternDirectorState,
    })
    this.bossPatternDirectorState = patternDecision.state
    const pattern = patternDecision.patternId
    this.host.dataset.bossPattern = String(pattern)
    this.host.dataset.bossPatternPool = patternDecision.pool.join(',')
    const warningTime = Math.max(0.52, 0.9 - enemy.phase * 0.08)
    const attackStyle: AttackMotionStyle = [
      'boss-line',
      'boss-orbit',
      'boss-cross',
      'boss-mirror',
      'boss-cluster',
      'boss-line',
      'boss-orbit',
      'boss-cluster',
      'boss-cross',
      'boss-mirror',
    ][pattern] as AttackMotionStyle
    this.triggerEnemyAttack(
      enemy,
      attackStyle,
      this.hostileWarningWindow(warningTime) + 0.24,
      angle,
      true,
    )

    if (pattern === 0) {
      const lines = 1 + enemy.phase
      for (let index = 0; index < lines; index += 1) {
        const offset = (index - (lines - 1) / 2) * 0.24
        this.queueLineTelegraph(
          enemy.x,
          enemy.y,
          angle + offset,
          780,
          40 + enemy.phase * 5,
          warningTime,
          enemy.damage * 1.15,
          true,
        )
      }
      return
    }

    if (pattern === 1) {
      const circles = 3 + enemy.phase
      for (let index = 0; index < circles; index += 1) {
        const orbit = (Math.PI * 2 * index) / circles + this.elapsed * 0.35
        const radius = 92 + enemy.phase * 18
        this.launchHostileProjectile(
          enemy,
          {
            x: clamp(this.player.x + Math.cos(orbit) * radius, 64, WORLD_WIDTH - 64),
            y: clamp(this.player.y + Math.sin(orbit) * radius, 64, WORLD_HEIGHT - 64),
          },
          {
            windup: warningTime,
            flight: 0.42,
            arcHeight: 126 + index * 9,
            radius: 58 + enemy.phase * 4,
            damage: enemy.damage,
          },
        )
      }
      return
    }

    if (pattern === 2) {
      const crossCount = enemy.phase >= 3 ? 4 : 2
      for (let index = 0; index < crossCount; index += 1) {
        this.queueLineTelegraph(
          enemy.x,
          enemy.y,
          angle + (Math.PI * index) / 2,
          820,
          36 + enemy.phase * 5,
          warningTime,
          enemy.damage * 1.12,
          true,
        )
      }
      return
    }

    if (pattern === 3) {
      const mirrored = this.mirroredPlayerPoint()
      this.queueCircleTelegraph(this.player.x, this.player.y, 72 + enemy.phase * 7, warningTime, enemy.damage, true)
      this.queueCircleTelegraph(mirrored.x, mirrored.y, 72 + enemy.phase * 7, warningTime, enemy.damage, true)
      if (enemy.phase >= 2) {
        this.queueLineTelegraph(enemy.x, enemy.y, angle, 820, 44, warningTime, enemy.damage * 1.12, true)
      }
      return
    }

    if (pattern === 4) {
      const clusterCount = 2 + enemy.phase
      for (let index = 0; index < clusterCount; index += 1) {
        const spread = 58 + index * 28
        const clusterAngle = angle + index * 2.4
        this.launchHostileProjectile(
          enemy,
          {
            x: clamp(
              this.player.x + Math.cos(clusterAngle) * spread,
              64,
              WORLD_WIDTH - 64,
            ),
            y: clamp(
              this.player.y + Math.sin(clusterAngle) * spread,
              64,
              WORLD_HEIGHT - 64,
            ),
          },
          {
            windup: warningTime + index * 0.06,
            flight: 0.4,
            arcHeight: 154 + index * 13,
            radius: 66 + enemy.phase * 5,
            damage: enemy.damage * 1.08,
          },
        )
      }
      return
    }

    if (pattern === 5) {
      const laneCount = 2 + enemy.phase
      const sweepDown = Math.sin(this.elapsed * 0.8) >= 0
      for (let index = 0; index < laneCount; index += 1) {
        const laneY = ((index + 0.7) / laneCount) * WORLD_HEIGHT
        this.queueLineTelegraph(
          sweepDown ? 0 : WORLD_WIDTH,
          clamp(laneY, 74, WORLD_HEIGHT - 74),
          (sweepDown ? 0 : Math.PI) + (index - (laneCount - 1) / 2) * 0.045,
          WORLD_WIDTH * 1.08,
          30 + enemy.phase * 4,
          warningTime + index * 0.055,
          enemy.damage,
          true,
        )
      }
      this.queueLineTelegraph(
        enemy.x,
        enemy.y,
        angle,
        820,
        34 + enemy.phase * 3,
        warningTime + 0.14,
        enemy.damage * 1.08,
        true,
      )
      return
    }

    if (pattern === 6) {
      const spiralCount = 4 + enemy.phase
      const orbitRadius = 108 + enemy.phase * 17
      const rotation = this.elapsed * 0.7 + enemy.phase * 0.35
      for (let index = 0; index < spiralCount; index += 1) {
        const orbit = rotation + (Math.PI * 2 * index) / spiralCount
        this.launchHostileProjectile(
          enemy,
          {
            x: clamp(
              this.player.x + Math.cos(orbit) * orbitRadius,
              62,
              WORLD_WIDTH - 62,
            ),
            y: clamp(
              this.player.y + Math.sin(orbit) * orbitRadius,
              62,
              WORLD_HEIGHT - 62,
            ),
          },
          {
            windup: warningTime + index * 0.045,
            flight: 0.38,
            arcHeight: 116 + (index % 3) * 18,
            radius: 48 + enemy.phase * 3,
            damage: enemy.damage,
          },
        )
      }
      if (enemy.phase >= 3) {
        this.launchHostileProjectile(
          enemy,
          { x: this.player.x, y: this.player.y },
          {
            windup: warningTime + 0.18,
            flight: 0.4,
            arcHeight: 188,
            radius: 58,
            damage: enemy.damage * 1.08,
          },
        )
      }
      return
    }

    if (pattern === 7) {
      const forward = this.heroFacing
      const side = { x: -forward.y, y: forward.x }
      const impactDistance = 68 + enemy.phase * 12
      const centers = [
        {
          x: this.player.x + forward.x * impactDistance,
          y: this.player.y + forward.y * impactDistance,
        },
        {
          x: this.player.x + side.x * (112 + enemy.phase * 9),
          y: this.player.y + side.y * (112 + enemy.phase * 9),
        },
        {
          x: this.player.x - side.x * (112 + enemy.phase * 9),
          y: this.player.y - side.y * (112 + enemy.phase * 9),
        },
      ]
      for (let index = 0; index < Math.min(centers.length, 1 + enemy.phase); index += 1) {
        const center = centers[index]
        this.launchHostileProjectile(
          enemy,
          {
            x: clamp(center.x, 68, WORLD_WIDTH - 68),
            y: clamp(center.y, 68, WORLD_HEIGHT - 68),
          },
          {
            windup: warningTime + index * 0.1,
            flight: 0.38,
            arcHeight: 172 + index * 22,
            radius: 70 + enemy.phase * 5,
            damage: enemy.damage * 1.06,
          },
        )
      }
      if (enemy.phase >= 2) {
        this.queueLineTelegraph(
          enemy.x,
          enemy.y,
          angle + Math.PI * 0.5,
          760,
          36 + enemy.phase * 4,
          warningTime + 0.08,
          enemy.damage,
          true,
        )
      }
      return
    }

    if (pattern === 8) {
      const verticalCount = 3 + Math.min(2, enemy.phase)
      const horizontalCount = 3 + Math.min(1, enemy.phase)
      const verticalLanes = Array.from(
        { length: verticalCount },
        (_, index) => ((index + 1) * WORLD_WIDTH) / (verticalCount + 1),
      )
      const horizontalLanes = Array.from(
        { length: horizontalCount },
        (_, index) => ((index + 1) * WORLD_HEIGHT) / (horizontalCount + 1),
      )
      const safeVertical = verticalLanes.reduce((best, lane, index) =>
        Math.abs(lane - this.player.x) < Math.abs(verticalLanes[best] - this.player.x)
          ? index
          : best, 0)
      const safeHorizontal = horizontalLanes.reduce((best, lane, index) =>
        Math.abs(lane - this.player.y) < Math.abs(horizontalLanes[best] - this.player.y)
          ? index
          : best, 0)
      verticalLanes.forEach((lane, index) => {
        if (index === safeVertical) return
        this.queueLineTelegraph(
          lane,
          0,
          Math.PI * 0.5,
          WORLD_HEIGHT,
          28 + enemy.phase * 3,
          warningTime + (index % 2) * 0.06,
          enemy.damage,
          true,
        )
      })
      horizontalLanes.forEach((lane, index) => {
        if (index === safeHorizontal) return
        this.queueLineTelegraph(
          0,
          lane,
          0,
          WORLD_WIDTH,
          28 + enemy.phase * 3,
          warningTime + ((index + 1) % 2) * 0.06,
          enemy.damage,
          true,
        )
      })
      return
    }

    const fanLines = 2 + enemy.phase
    for (let index = 0; index < fanLines; index += 1) {
      const offset = (index - (fanLines - 1) / 2) * 0.2
      this.queueLineTelegraph(
        enemy.x,
        enemy.y,
        angle + offset,
        860,
        32 + enemy.phase * 3,
        warningTime,
        enemy.damage * 1.06,
        true,
      )
    }
    const mirrored = this.mirroredPlayerPoint()
    this.queueCircleTelegraph(
      this.player.x,
      this.player.y,
      58 + enemy.phase * 4,
      warningTime + 0.1,
      enemy.damage,
      true,
    )
    this.queueCircleTelegraph(
      mirrored.x,
      mirrored.y,
      58 + enemy.phase * 4,
      warningTime + 0.12,
      enemy.damage,
      true,
    )
    if (enemy.phase >= 2) {
      const rotation = this.elapsed * 0.42
      for (let index = 0; index < 1; index += 1) {
        this.queueLineTelegraph(
          enemy.x,
          enemy.y,
          rotation + index * Math.PI * 0.5,
          820,
          30 + enemy.phase * 3,
          warningTime + 0.1,
          enemy.damage,
          true,
        )
      }
    }
  }

  private mirroredPlayerPoint(minimumSeparation = 150): Vec2 {
    const x = clamp(WORLD_WIDTH - this.player.x, 70, WORLD_WIDTH - 70)
    const y = clamp(WORLD_HEIGHT - this.player.y, 70, WORLD_HEIGHT - 70)
    if (Math.hypot(x - this.player.x, y - this.player.y) >= minimumSeparation) {
      return { x, y }
    }

    const fallbackCandidates = [
      { x: clamp(this.player.x + minimumSeparation, 70, WORLD_WIDTH - 70), y: this.player.y },
      { x: clamp(this.player.x - minimumSeparation, 70, WORLD_WIDTH - 70), y: this.player.y },
      { x: this.player.x, y: clamp(this.player.y + minimumSeparation, 70, WORLD_HEIGHT - 70) },
      { x: this.player.x, y: clamp(this.player.y - minimumSeparation, 70, WORLD_HEIGHT - 70) },
    ]
    return fallbackCandidates.reduce((farthest, candidate) =>
      distanceSquared(candidate, this.player) > distanceSquared(farthest, this.player)
        ? candidate
        : farthest)
  }

  private spawnHazard() {
    const damage = 10 + this.level.difficulty * 3
    const pattern = (this.level.id - 1) % 4
    if (pattern === 0) {
      const horizontal = this.random.next() < 0.5
      this.queueLineTelegraph(
        horizontal ? 0 : this.random.range(100, WORLD_WIDTH - 100),
        horizontal ? this.random.range(90, WORLD_HEIGHT - 90) : 0,
        horizontal ? 0 : Math.PI * 0.5,
        horizontal ? WORLD_WIDTH : WORLD_HEIGHT,
        34 + this.level.id,
        1.05,
        damage,
      )
      return
    }

    if (pattern === 1) {
      for (let index = 0; index < 2; index += 1) {
        this.queueCircleTelegraph(
          clamp(this.player.x + this.random.range(-150, 150), 80, WORLD_WIDTH - 80),
          clamp(this.player.y + this.random.range(-130, 130), 80, WORLD_HEIGHT - 80),
          82 + this.level.id * 2,
          1.15 + index * 0.08,
          damage,
        )
      }
      return
    }

    if (pattern === 2) {
      const fromLeft = this.random.next() < 0.5
      this.queueLineTelegraph(
        fromLeft ? 0 : WORLD_WIDTH,
        this.random.range(100, WORLD_HEIGHT - 100),
        fromLeft ? this.random.range(-0.22, 0.22) : Math.PI + this.random.range(-0.22, 0.22),
        WORLD_WIDTH * 1.15,
        40,
        0.92,
        damage * 1.08,
      )
      return
    }

    const points = this.level.id >= 8 ? 4 : 3
    for (let index = 0; index < points; index += 1) {
      const orbit = (Math.PI * 2 * index) / points + this.elapsed * 0.2
      this.queueCircleTelegraph(
        clamp(this.player.x + Math.cos(orbit) * 145, 78, WORLD_WIDTH - 78),
        clamp(this.player.y + Math.sin(orbit) * 110, 78, WORLD_HEIGHT - 78),
        64,
        1.05 + index * 0.05,
        damage,
      )
    }
  }

  private queueCircleTelegraph(
    x: number,
    y: number,
    radius: number,
    life: number,
    damage: number,
    bossAttack = false,
    color?: number,
    specialAttack = bossAttack,
  ) {
    if (this.activeTelegraphCount >= 32) return
    const telegraph = this.telegraphs.find((candidate) => !candidate.active)
    const warningLife = specialAttack
      ? this.hostileWarningWindow(life)
      : life
    const next: TelegraphEntity = {
      active: true,
      kind: 'circle',
      x,
      y,
      radius,
      angle: 0,
      length: 0,
      width: 0,
      life: warningLife,
      total: warningLife,
      damage,
      bossAttack,
      specialAttack,
      color,
    }
    if (telegraph) Object.assign(telegraph, next)
    else this.telegraphs.push(next)
    this.activeTelegraphCount += 1
  }

  private queueLineTelegraph(
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    life: number,
    damage: number,
    bossAttack = false,
    color?: number,
    specialAttack = bossAttack,
  ) {
    if (this.activeTelegraphCount >= 32) return
    const telegraph = this.telegraphs.find((candidate) => !candidate.active)
    const warningLife = specialAttack
      ? this.hostileWarningWindow(life)
      : life
    const next: TelegraphEntity = {
      active: true,
      kind: 'line',
      x,
      y,
      radius: 0,
      angle,
      length,
      width,
      life: warningLife,
      total: warningLife,
      damage,
      bossAttack,
      specialAttack,
      color,
    }
    if (telegraph) Object.assign(telegraph, next)
    else this.telegraphs.push(next)
    this.activeTelegraphCount += 1
  }

  private findSafeSpawnPoint(
    minDistance: number,
    maxDistance: number,
    paddingX: number,
    paddingY: number,
    preferredAngle?: number,
    angleSpread = Math.PI,
  ): Vec2 {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const angle =
        preferredAngle === undefined
          ? this.random.range(0, Math.PI * 2)
          : preferredAngle + this.random.range(-angleSpread, angleSpread)
      const distance = this.random.range(minDistance, maxDistance)
      const candidate = {
        x: this.player.x + Math.cos(angle) * distance,
        y: this.player.y + Math.sin(angle) * distance,
      }
      if (
        candidate.x >= paddingX &&
        candidate.x <= WORLD_WIDTH - paddingX &&
        candidate.y >= paddingY &&
        candidate.y <= WORLD_HEIGHT - paddingY
      ) {
        return candidate
      }
    }

    const candidates: Vec2[] = [
      { x: paddingX, y: clamp(this.player.y, paddingY, WORLD_HEIGHT - paddingY) },
      { x: WORLD_WIDTH - paddingX, y: clamp(this.player.y, paddingY, WORLD_HEIGHT - paddingY) },
      { x: clamp(this.player.x, paddingX, WORLD_WIDTH - paddingX), y: paddingY },
      { x: clamp(this.player.x, paddingX, WORLD_WIDTH - paddingX), y: WORLD_HEIGHT - paddingY },
    ]
    return candidates.reduce((farthest, candidate) =>
      distanceSquared(candidate, this.player) > distanceSquared(farthest, this.player)
        ? candidate
        : farthest,
    )
  }

  private drawTrace() {
    this.trailGlow.clear()
    this.trailCore.clear()
    if (this.trace.length < 2) return

    // The Trace keeps the readable continuity of the original wake, but its
    // layered cyan bloom, blue energy body, white-hot core and drifting motes
    // give it physical depth. Each segment still expires independently.
    for (let index = 1; index < this.trace.length; index += 1) {
      const start = this.trace[index - 1]
      const end = this.trace[index]
      const segmentAlpha = traceSegmentAlpha(start, end, this.elapsed)
      if (segmentAlpha <= 0.01) continue
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy)
      if (length <= 0.001) continue
      const normalX = -dy / length
      const normalY = dx / length
      const flow =
        (replacementCosmeticUnit(Math.floor(start.bornAt * 1000), index, 991) -
          0.5) *
        3.2
      const controlX = (start.x + end.x) * 0.5 + normalX * flow
      const controlY = (start.y + end.y) * 0.5 + normalY * flow
      const pulse =
        0.88 +
        Math.sin(this.motionClock * 4.2 - index * 0.58 + end.bornAt * 1.7) * 0.12

      this.trailGlow
        .moveTo(start.x, start.y)
        .quadraticCurveTo(controlX, controlY, end.x, end.y)
        .stroke({
          color: 0x173c8d,
          width: 15,
          alpha: 0.095 * segmentAlpha * pulse,
          cap: 'round',
        })
      this.trailGlow
        .moveTo(start.x, start.y)
        .quadraticCurveTo(controlX, controlY, end.x, end.y)
        .stroke({
          color: 0x1f9ec7,
          width: 7.5,
          alpha: 0.18 * segmentAlpha * pulse,
          cap: 'round',
        })
      this.trailCore
        .moveTo(start.x, start.y)
        .quadraticCurveTo(controlX, controlY, end.x, end.y)
        .stroke({
          color: 0x55d9ef,
          width: 3.1,
          alpha: 0.5 * segmentAlpha * pulse,
          cap: 'round',
        })
      this.trailCore
        .moveTo(start.x, start.y)
        .quadraticCurveTo(controlX, controlY, end.x, end.y)
        .stroke({
          color: 0xe5fbff,
          width: 0.9,
          alpha: 0.82 * segmentAlpha,
          cap: 'round',
        })

      if (index % 3 === 0) {
        const moteT =
          0.26 +
          replacementCosmeticUnit(Math.floor(end.bornAt * 1000), index, 997) *
            0.48
        const moteDrift =
          Math.sin(this.motionClock * 3.8 + index * 1.7) * (2.5 + (index % 2))
        const moteX = lerp(start.x, end.x, moteT) + normalX * moteDrift
        const moteY = lerp(start.y, end.y, moteT) + normalY * moteDrift
        this.trailGlow
          .circle(moteX, moteY, 3.6)
          .fill({ color: 0x3dbbdc, alpha: 0.12 * segmentAlpha })
        this.trailCore
          .ellipse(moteX, moteY, 1.45, 0.72)
          .fill({ color: 0xe7fcff, alpha: 0.58 * segmentAlpha })
      }
    }

    const newest = this.trace[this.trace.length - 1]
    const newestAlpha = traceSegmentAlpha(
      this.trace[this.trace.length - 2],
      newest,
      this.elapsed,
    )
    if (newestAlpha > 0.01) {
      const headPulse = 0.88 + Math.sin(this.motionClock * 5.2) * 0.12
      this.trailGlow
        .circle(newest.x, newest.y, 10 * headPulse)
        .fill({ color: 0x178bc4, alpha: 0.1 * newestAlpha })
        .circle(newest.x, newest.y, 5.2 * headPulse)
        .fill({ color: 0x50dff1, alpha: 0.19 * newestAlpha })
      this.trailCore
        .circle(newest.x, newest.y, 1.8 * headPulse)
        .fill({ color: 0xedfeff, alpha: 0.9 * newestAlpha })
    }
  }

  private vfxStageIndex(stage: WeaponVfxStage) {
    return ({ solo: 0, combined: 1, mastered: 2, final: 3 } as const)[stage]
  }

  private drawDiamondGlyph(
    graphics: Graphics,
    x: number,
    y: number,
    radius: number,
    rotation: number,
    color: number,
    alpha: number,
    filled = false,
  ) {
    const points: number[] = []
    for (let index = 0; index < 4; index += 1) {
      const angle = rotation + Math.PI * 0.25 + index * Math.PI * 0.5
      points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
    }
    const path = graphics.poly(points, true)
    if (filled) path.fill({ color, alpha })
    else path.stroke({ color, width: Math.max(1.2, radius * 0.16), alpha })
  }

  private drawCrescentGlyph(
    graphics: Graphics,
    x: number,
    y: number,
    angle: number,
    size: number,
    color: number,
    alpha: number,
  ) {
    const tangentX = -Math.sin(angle)
    const tangentY = Math.cos(angle)
    const radialX = Math.cos(angle)
    const radialY = Math.sin(angle)
    const startX = x + tangentX * size
    const startY = y + tangentY * size
    const endX = x - tangentX * size
    const endY = y - tangentY * size
    const controlX = x + radialX * size * 1.34
    const controlY = y + radialY * size * 1.34
    graphics
      .moveTo(startX, startY)
      .quadraticCurveTo(controlX, controlY, endX, endY)
      .stroke({
        color,
        width: Math.max(3, size * 0.56),
        alpha: alpha * 0.12,
        cap: 'round',
      })
    graphics
      .moveTo(startX, startY)
      .quadraticCurveTo(controlX, controlY, endX, endY)
      .stroke({
        color,
        width: Math.max(1.8, size * 0.24),
        alpha: alpha * 0.62,
        cap: 'round',
      })
    graphics
      .moveTo(startX, startY)
      .quadraticCurveTo(controlX, controlY, endX, endY)
      .stroke({
        color: 0xe9ffff,
        width: Math.max(1, size * 0.075),
        alpha: alpha * 0.86,
        cap: 'round',
      })
  }

  private buildLightningPoints(points: Vec2[], seed: number, progress: number) {
    const output: Vec2[] = []
    for (let segment = 0; segment < points.length - 1; segment += 1) {
      const start = points[segment]
      const end = points[segment + 1]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.max(1, Math.hypot(dx, dy))
      const normalX = -dy / length
      const normalY = dx / length
      const subdivisions = 5
      if (segment === 0) output.push({ ...start })
      for (let step = 1; step <= subdivisions; step += 1) {
        const t = step / subdivisions
        const hash = Math.sin((seed + segment * 37 + step * 17) * 12.9898 + progress * 19)
        const offset = step === subdivisions ? 0 : hash * Math.min(18, length * 0.075) * Math.sin(t * Math.PI)
        output.push({
          x: lerp(start.x, end.x, t) + normalX * offset,
          y: lerp(start.y, end.y, t) + normalY * offset,
        })
      }
    }
    return output
  }

  private drawPolyline(
    graphics: Graphics,
    points: Vec2[],
    color: number,
    width: number,
    alpha: number,
  ) {
    if (points.length < 2) return
    graphics.moveTo(points[0].x, points[0].y)
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y)
    }
    graphics.stroke({ color, width, alpha })
  }

  private beginAuthoredSpellMaterialFrame() {
    this.authoredSpellMaterialCursor = 0
  }

  private finishAuthoredSpellMaterialFrame() {
    for (
      let index = this.authoredSpellMaterialCursor;
      index < this.authoredSpellMaterialSprites.length;
      index += 1
    ) {
      this.authoredSpellMaterialSprites[index].visible = false
    }
  }

  private acquireAuthoredSpellMaterialSprite(texture: Texture) {
    let sprite =
      this.authoredSpellMaterialSprites[this.authoredSpellMaterialCursor]
    if (!sprite) {
      sprite = new Sprite(texture)
      sprite.eventMode = 'none'
      sprite.visible = false
      this.authoredSpellMaterialSprites.push(sprite)
      this.weaponMaterialLayer.addChild(sprite)
    }
    this.authoredSpellMaterialCursor += 1
    sprite.texture = texture
    sprite.visible = true
    sprite.alpha = 1
    sprite.tint = 0xffffff
    sprite.rotation = 0
    sprite.blendMode = 'normal'
    sprite.anchor.set(0.5, 0.96)
    return sprite
  }

  private drawAuthoredCrescentMaterial(options: {
    x: number
    y: number
    angle: number
    size: number
    progress: number
    seed: number
    alpha: number
  }) {
    if (this.crescentMoonbladeFrames.length === 0) {
      return false
    }

    const frameIndex =
      (Math.floor(clamp(options.progress, 0, 0.999) * this.crescentMoonbladeFrames.length) +
        Math.abs(options.seed)) %
      this.crescentMoonbladeFrames.length
    const blade = this.acquireAuthoredSpellMaterialSprite(
      this.crescentMoonbladeFrames[frameIndex],
    )
    blade.anchor.set(0.5)
    blade.position.set(options.x, options.y)
    blade.width = options.size * 2.65
    blade.height = options.size * 2.65
    blade.rotation = options.angle
    blade.alpha = options.alpha * (this.settings.reducedFlash ? 0.78 : 1)
    blade.blendMode = 'normal'
    blade.zIndex = Math.round(options.y * 10) - 1
    return true
  }

  private drawAuthoredArcImpact(options: {
    x: number
    y: number
    progress: number
    size: number
    seed: number
    alpha: number
  }) {
    if (this.arcChoirImpactFrames.length === 0) {
      return false
    }
    if (options.progress < 0 || options.progress >= 1) return true

    const frameIndex = Math.min(
      this.arcChoirImpactFrames.length - 1,
      Math.floor(options.progress * this.arcChoirImpactFrames.length),
    )
    const impact = this.acquireAuthoredSpellMaterialSprite(
      this.arcChoirImpactFrames[frameIndex],
    )
    impact.anchor.set(0.5)
    impact.position.set(options.x, options.y)
    impact.width = options.size
    impact.height = options.size
    impact.rotation =
      (replacementCosmeticUnit(options.seed, frameIndex, 421) - 0.5) * 0.18
    impact.alpha = options.alpha * (this.settings.reducedFlash ? 0.72 : 1)
    impact.blendMode = 'normal'
    impact.zIndex = Math.round(options.y * 10) + 1
    return true
  }

  private drawHeroPowerMaterialEvent(options: {
    x: number
    y: number
    radius: number
    progress: number
    stage: WeaponVfxStage
    seed: number
    tint: number
    frame: number
    angle?: number
    materialOpacity?: number
    stretchX?: number
    stretchY?: number
  }) {
    const progress = clamp(options.progress, 0, 1)
    const rise = clamp(progress / 0.18, 0, 1)
    const decay = 1 - clamp((progress - 0.6) / 0.4, 0, 1)
    const envelope = rise * decay
    if (envelope <= 0.001) return

    const stage = this.vfxStageIndex(options.stage)
    const stageScale = [0.82, 0.92, 1.02, 1.14][stage]
    const rotation =
      (options.angle ?? 0) +
      (replacementCosmeticUnit(options.seed, 1, 67) - 0.5) * 0.34
    const reducedFlashScale = this.settings.reducedFlash ? 0.62 : 1

    const frame = this.heroPowerMaterialFrames[options.frame]
    if (frame) {
      const material = this.acquireAuthoredSpellMaterialSprite(frame)
      material.anchor.set(0.5)
      material.position.set(
        options.x + Math.cos(rotation) * options.radius * 0.04,
        options.y + Math.sin(rotation) * options.radius * 0.04,
      )
      material.width =
        options.radius *
        2.24 *
        stageScale *
        (options.stretchX ?? 1)
      material.height =
        options.radius *
        2.24 *
        stageScale *
        (options.stretchY ?? 1)
      material.rotation = rotation
      material.tint = options.tint
      material.alpha =
        (options.materialOpacity ?? 0.24) *
        envelope *
        reducedFlashScale
      material.blendMode = 'add'
      material.zIndex = Math.round(options.y * 10) - 2
    }

    const gritCount = Math.min(
      this.visualLod === 'mobile' ? 3 + stage : 5 + stage * 2,
      10,
    )
    for (let grit = 0; grit < gritCount; grit += 1) {
      const gritAngle =
        rotation +
        (replacementCosmeticUnit(options.seed, grit, 71) - 0.5) * 2.2
      const distance =
        options.radius *
        (0.18 + replacementCosmeticUnit(options.seed, grit, 73) * 0.74) *
        rise
      const size =
        options.radius *
        (0.012 + replacementCosmeticUnit(options.seed, grit, 79) * 0.025)
      this.weaponVfxGraphics
        .ellipse(
          options.x + Math.cos(gritAngle) * distance,
          options.y + Math.sin(gritAngle) * distance * 0.62,
          size * 1.7,
          size * 0.68,
        )
        .fill({
          color: grit % 3 === 0 ? options.tint : 0x687176,
          alpha: envelope * (grit % 3 === 0 ? 0.12 : 0.16),
        })
    }
  }

  private beginGroundedVfxFrame() {
    this.groundedVfxMaterialCursor = 0
    this.groundedVfxParticleBudget =
      this.visualLod === 'mobile'
        ? 72
        : this.settings.reducedFlash
          ? 112
          : 152
    this.groundedVfxDustGraphics.clear()
    this.groundedVfxSmokeGraphics.clear()
    this.groundedVfxCinderGraphics.clear()
    this.hostileSpecialEnergyGraphics.clear()
    this.hostileBoundaryGlowGraphics.clear()
    this.hostileBoundaryCoreGraphics.clear()
  }

  private finishGroundedVfxFrame() {
    for (
      let index = this.groundedVfxMaterialCursor;
      index < this.groundedVfxMaterialSprites.length;
      index += 1
    ) {
      this.groundedVfxMaterialSprites[index].visible = false
    }
  }

  private acquireGroundedVfxMaterialSprite(texture: Texture) {
    let sprite =
      this.groundedVfxMaterialSprites[this.groundedVfxMaterialCursor]
    if (!sprite) {
      sprite = new Sprite(texture)
      sprite.eventMode = 'none'
      sprite.visible = false
      this.groundedVfxMaterialSprites.push(sprite)
      this.groundedVfxMaterialLayer.addChild(sprite)
    }
    this.groundedVfxMaterialCursor += 1
    sprite.texture = texture
    sprite.visible = true
    sprite.alpha = 1
    sprite.tint = 0xffffff
    sprite.rotation = 0
    sprite.blendMode = 'normal'
    sprite.anchor.set(0.5)
    return sprite
  }

  private groundedVfxLod() {
    return this.visualLod === 'mobile' ? 'mobile' : 'desktop'
  }

  private allocateHostileBoundaryParticleQuotas() {
    const lod = this.visualLod === 'mobile' ? 'mobile' : 'desktop'
    const bossTelegraphCount = this.telegraphs.reduce(
      (count, telegraph) =>
        count + Number(telegraph.active && telegraph.bossAttack),
      0,
    )
    const hordeTelegraphCount = this.telegraphs.reduce(
      (count, telegraph) =>
        count + Number(telegraph.active && !telegraph.bossAttack),
      0,
    )
    const projectileDestinationCount = this.hostileProjectiles.reduce(
      (count, projectile) =>
        count +
        Number(hostileProjectilePoseAt(projectile.state).destinationVisible),
      0,
    )
    const priorityFootprints =
      bossTelegraphCount + projectileDestinationCount
    const pools = allocateHostileBoundaryPriorityPools({
      frameBudget: HOSTILE_BOUNDARY_FRAME_BUDGET[lod],
      priorityFootprints,
      hordeFootprints: hordeTelegraphCount,
      lod,
    })

    this.hostileBoundaryPriorityBudget = pools.priorityBudget
    this.hostileBoundaryPriorityFootprintsRemaining = priorityFootprints
    this.hostileBoundaryHordeBudget = pools.hordeBudget
    this.hostileBoundaryHordeFootprintsRemaining = hordeTelegraphCount
  }

  private reserveHostileBoundaryQuota(priority: boolean) {
    const reservation = reserveHostileBoundaryParticleQuota({
      remainingBudget: priority
        ? this.hostileBoundaryPriorityBudget
        : this.hostileBoundaryHordeBudget,
      remainingFootprints: priority
        ? this.hostileBoundaryPriorityFootprintsRemaining
        : this.hostileBoundaryHordeFootprintsRemaining,
    })
    if (priority) {
      this.hostileBoundaryPriorityBudget = reservation.remainingBudget
      this.hostileBoundaryPriorityFootprintsRemaining =
        reservation.remainingFootprints
    } else {
      this.hostileBoundaryHordeBudget = reservation.remainingBudget
      this.hostileBoundaryHordeFootprintsRemaining =
        reservation.remainingFootprints
    }
    return reservation.quota
  }

  private drawBossTelegraphParticle(
    particle: BossTelegraphParticle,
    x: number,
    y: number,
    scale: number,
    rotationOffset = 0,
  ) {
    if (particle.alpha <= 0.003) return
    const size = Math.max(1.1, scale * particle.size)
    const rotation = rotationOffset + particle.rotation

    if (particle.kind === 'smoke') {
      this.groundedVfxSmokeGraphics
        .ellipse(
          x,
          y,
          size * particle.stretch * 1.16,
          size * (0.62 + particle.lift * 0.72),
        )
        .fill({
          color: particle.tint,
          alpha: particle.alpha * 0.72,
        })
      this.groundedVfxSmokeGraphics
        .ellipse(
          x - size * 0.18,
          y - size * 0.14,
          size * particle.stretch * 0.62,
          size * (0.36 + particle.lift * 0.48),
        )
        .fill({
          color: particle.tint,
          alpha: particle.alpha * 0.56,
        })
      // A restrained unblurred soot core keeps the warning legible against
      // dark arenas without turning the smoke into a luminous outline.
      this.groundedVfxDustGraphics
        .ellipse(
          x,
          y + size * 0.12,
          size * particle.stretch * 0.72,
          size * 0.34,
        )
        .fill({
          color: particle.tint,
          alpha: particle.alpha * 0.32,
        })
      return
    }

    const alongX = Math.cos(rotation) * size * particle.stretch
    const alongY = Math.sin(rotation) * size * particle.stretch
    const acrossX = -Math.sin(rotation) * size * 0.58
    const acrossY = Math.cos(rotation) * size * 0.58

    if (particle.kind === 'grit') {
      this.groundedVfxDustGraphics
        .poly(
          [
            x + alongX,
            y + alongY,
            x + acrossX,
            y + acrossY,
            x - alongX * 0.82,
            y - alongY * 0.82,
            x - acrossX,
            y - acrossY,
          ],
          true,
        )
        .fill({
          color: particle.tint,
          alpha: particle.alpha,
        })
      return
    }

    this.groundedVfxCinderGraphics
      .ellipse(
        x,
        y,
        size * (2.6 + particle.glowAlpha),
        size * (1.05 + particle.glowAlpha * 0.42),
      )
      .fill({
        color: particle.tint,
        alpha: particle.alpha * particle.glowAlpha * 0.24,
      })
    this.groundedVfxCinderGraphics
      .poly(
        [
          x + alongX,
          y + alongY,
          x + acrossX * 0.48,
          y + acrossY * 0.48,
          x - alongX,
          y - alongY,
          x - acrossX * 0.48,
          y - acrossY * 0.48,
        ],
        true,
      )
      .fill({
        color: particle.tint,
        alpha: particle.alpha,
      })
  }

  private drawHostileBoundaryParticle(
    particle: HostileBoundaryParticle,
    x: number,
    y: number,
    scale: number,
    rotationOffset = 0,
  ) {
    if (particle.alpha <= 0.003) return
    const boundaryAlpha = clamp(
      particle.alpha * HOSTILE_BOUNDARY_BRIGHTNESS_GAIN,
      0,
      1,
    )
    const bone = 0xf4f0e6
    const silver = 0xd3dcdb
    const color =
      Math.abs(particle.baseU * 17 + particle.baseV * 29) % 1 > 0.38
        ? bone
        : silver
    const minimumSize = this.visualLod === 'mobile' ? 1.2 : 0.92
    const size = Math.max(minimumSize, scale * particle.size)
    const rotation = rotationOffset + particle.rotation

    if (particle.kind === 'mote') {
      this.hostileBoundaryGlowGraphics
        .ellipse(
          x,
          y,
          size * (3.2 + particle.glowAlpha * 1.4),
          size * (2.5 + particle.glowAlpha * 0.72),
        )
        .fill({
          color: silver,
          alpha: boundaryAlpha * particle.glowAlpha * 0.46,
        })
      this.hostileBoundaryCoreGraphics
        .ellipse(x, y, size * 1.08, size * 0.86)
        .fill({
          color,
          alpha: clamp(boundaryAlpha * 1.04, 0, 1),
        })
      return
    }

    const halfLength = Math.max(3.2, size * particle.stretch)
    const coreWidth = Math.max(
      this.visualLod === 'mobile' ? 1.3 : 0.9,
      size * 0.62,
    )
    const glowWidth = coreWidth * (3.2 + particle.glowAlpha * 0.8)
    const tangentX = Math.cos(rotation)
    const tangentY = Math.sin(rotation)
    const normalX = -tangentY
    const normalY = tangentX
    const bend =
      Math.sin(particle.baseU * 19 + particle.baseV * 23) *
      halfLength *
      0.12
    const tipAX = x - tangentX * halfLength
    const tipAY = y - tangentY * halfLength
    const tipBX = x + tangentX * halfLength
    const tipBY = y + tangentY * halfLength
    const controlX = x + normalX * bend
    const controlY = y + normalY * bend

    // Two-pass isolated curves reproduce a physical spray of illuminated dust:
    // a broad, dim silver bloom under a fine bone-white core. No segments are
    // joined, so these can never resolve into a HUD-like continuous outline.
    this.hostileBoundaryGlowGraphics
      .moveTo(tipAX, tipAY)
      .quadraticCurveTo(controlX, controlY, tipBX, tipBY)
      .stroke({
        color: silver,
        width: glowWidth,
        alpha: boundaryAlpha * particle.glowAlpha * 0.42,
        cap: 'round',
      })
    this.hostileBoundaryCoreGraphics
      .moveTo(tipAX, tipAY)
      .quadraticCurveTo(controlX, controlY, tipBX, tipBY)
      .stroke({
        color,
        width: coreWidth,
        alpha: clamp(
          boundaryAlpha * (0.84 + particle.glowAlpha * 0.2),
          0,
          1,
        ),
        cap: 'round',
      })
  }

  private hostileBoundaryStage(stage: GroundedVfxStage): 0 | 1 | 2 | 3 {
    if (stage === 'combined') return 1
    if (stage === 'mastered') return 2
    if (stage === 'final') return 3
    return 0
  }

  private drawHostileSpecialFieldEnergy(
    x: number,
    y: number,
    radius: number,
    progress: number,
    seed: number,
    active: boolean,
  ) {
    const marks = sampleHostileSpecialEnergy({
      footprint: 'field',
      progress,
      motionTime: this.motionClock,
      seed,
      lod: this.groundedVfxLod(),
      reducedFlash: this.settings.reducedFlash,
      active,
    })
    for (const mark of marks) {
      const angle = mark.anchor * Math.PI * 2
      const angularSpan = mark.span * Math.PI * 2
      const edgeRadius = radius * mark.edge
      const startAngle = angle - angularSpan * 0.5
      const endAngle = angle + angularSpan * 0.5
      const startX = x + Math.cos(startAngle) * edgeRadius
      const startY = y + Math.sin(startAngle) * edgeRadius * 0.9
      const endX = x + Math.cos(endAngle) * edgeRadius
      const endY = y + Math.sin(endAngle) * edgeRadius * 0.9
      const bendRadius = edgeRadius * (1 + mark.bend * 0.075)
      const controlX = x + Math.cos(angle) * bendRadius
      const controlY = y + Math.sin(angle) * bendRadius * 0.9
      this.drawHostileSpecialEnergyFilament(
        mark,
        startX,
        startY,
        controlX,
        controlY,
        endX,
        endY,
        Math.max(1, radius * 0.018),
      )
    }
  }

  private drawHostileSpecialLaneEnergy(
    start: Vec2,
    end: Vec2,
    width: number,
    progress: number,
    seed: number,
    active: boolean,
  ) {
    const marks = sampleHostileSpecialEnergy({
      footprint: 'lane',
      progress,
      motionTime: this.motionClock,
      seed,
      lod: this.groundedVfxLod(),
      reducedFlash: this.settings.reducedFlash,
      active,
    })
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const tangentX = dx / length
    const tangentY = dy / length
    const normalX = -tangentY
    const normalY = tangentX
    for (const mark of marks) {
      const centerDistance = mark.anchor * length
      const halfSpan = mark.span * length * 0.5
      const side = mark.edge * width
      const centerX = start.x + tangentX * centerDistance + normalX * side
      const centerY = start.y + tangentY * centerDistance + normalY * side
      const startX = centerX - tangentX * halfSpan
      const startY = centerY - tangentY * halfSpan
      const endX = centerX + tangentX * halfSpan
      const endY = centerY + tangentY * halfSpan
      const bend = mark.bend * width * 0.12
      this.drawHostileSpecialEnergyFilament(
        mark,
        startX,
        startY,
        centerX + normalX * bend,
        centerY + normalY * bend,
        endX,
        endY,
        Math.max(0.9, width * 0.034),
      )
    }
  }

  private drawHostileSpecialEnergyFilament(
    mark: HostileSpecialEnergyMark,
    startX: number,
    startY: number,
    controlX: number,
    controlY: number,
    endX: number,
    endY: number,
    scale: number,
  ) {
    const coreWidth = scale * mark.width
    this.hostileSpecialEnergyGraphics
      .moveTo(startX, startY)
      .quadraticCurveTo(controlX, controlY, endX, endY)
      .stroke({
        color: mark.color,
        width: coreWidth * 4.4,
        alpha: mark.alpha * 0.28,
        cap: 'round',
      })
    this.hostileSpecialEnergyGraphics
      .moveTo(startX, startY)
      .quadraticCurveTo(controlX, controlY, endX, endY)
      .stroke({
        color: mark.color,
        width: coreWidth,
        alpha: mark.alpha,
        cap: 'round',
      })
    if (mark.mote) {
      this.hostileSpecialEnergyGraphics
        .ellipse(endX, endY, coreWidth * 1.35, coreWidth * 0.72)
        .fill({ color: mark.color, alpha: mark.alpha * 0.82 })
    }
  }

  private drawHostileFieldParticles(
    x: number,
    y: number,
    radius: number,
    progress: number,
    stage: GroundedVfxStage,
    seed: number,
    bossId: BossId | undefined,
    palette: HostileTelegraphMaterialPalette,
    boss: boolean,
    boundaryPriority: boolean,
    specialAttack: boolean,
  ) {
    this.drawHostileSpecialFieldEnergy(
      x,
      y,
      radius,
      progress,
      seed,
      specialAttack,
    )
    const boundaryQuota = this.reserveHostileBoundaryQuota(boundaryPriority)
    const boundaryParticles = sampleHostileBoundaryParticles({
      prominence: boss ? 'boss' : 'horde',
      footprint: 'field',
      stage: this.hostileBoundaryStage(stage),
      lod: this.groundedVfxLod(),
      progress,
      motionTime: this.motionClock,
      seed,
      reducedFlash: this.settings.reducedFlash,
      maxParticles: boundaryQuota,
    })

    if (this.groundedVfxParticleBudget > 0) {
      const particles = sampleBossTelegraphParticles({
        bossId,
        palette,
        prominence: boss ? 'boss' : 'horde',
        footprint: 'field',
        stage,
        lod: this.groundedVfxLod(),
        progress,
        motionTime: this.motionClock,
        seed,
        reducedFlash: this.settings.reducedFlash,
        maxParticles: this.groundedVfxParticleBudget,
      })
      this.groundedVfxParticleBudget -= particles.length
      for (const particle of particles) {
        this.drawBossTelegraphParticle(
          particle,
          x + particle.u * radius * 0.92,
          y + particle.v * radius * 0.7 - particle.lift * radius * 0.34,
          radius,
        )
      }
    }

    for (const particle of boundaryParticles) {
      this.drawHostileBoundaryParticle(
        particle,
        x + particle.u * radius,
        y + particle.v * radius * 0.9,
        radius,
      )
    }
  }

  private drawHostileLaneParticles(
    start: Vec2,
    end: Vec2,
    width: number,
    progress: number,
    stage: GroundedVfxStage,
    seed: number,
    bossId: BossId | undefined,
    palette: HostileTelegraphMaterialPalette,
    boss: boolean,
    boundaryPriority: boolean,
    specialAttack: boolean,
  ) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const tangentX = dx / length
    const tangentY = dy / length
    const normalX = -tangentY
    const normalY = tangentX
    const angle = Math.atan2(dy, dx)

    this.drawHostileSpecialLaneEnergy(
      start,
      end,
      width,
      progress,
      seed,
      specialAttack,
    )

    const boundaryQuota = this.reserveHostileBoundaryQuota(boundaryPriority)
    const boundaryParticles = sampleHostileBoundaryParticles({
      prominence: boss ? 'boss' : 'horde',
      footprint: 'lane',
      stage: this.hostileBoundaryStage(stage),
      lod: this.groundedVfxLod(),
      progress,
      motionTime: this.motionClock,
      seed,
      reducedFlash: this.settings.reducedFlash,
      maxParticles: boundaryQuota,
    })

    if (this.groundedVfxParticleBudget > 0) {
      const particles = sampleBossTelegraphParticles({
        bossId,
        palette,
        prominence: boss ? 'boss' : 'horde',
        footprint: 'lane',
        stage,
        lod: this.groundedVfxLod(),
        progress,
        motionTime: this.motionClock,
        seed,
        reducedFlash: this.settings.reducedFlash,
        maxParticles: this.groundedVfxParticleBudget,
      })
      this.groundedVfxParticleBudget -= particles.length
      for (const particle of particles) {
        const along = particle.u * length
        const across = particle.v * width
        this.drawBossTelegraphParticle(
          particle,
          start.x + tangentX * along + normalX * across,
          start.y +
            tangentY * along +
            normalY * across -
            particle.lift * width * 0.58,
          width * 1.38,
          angle,
        )
      }
    }

    for (const particle of boundaryParticles) {
      const along = particle.u * length
      const across = particle.v * width
      this.drawHostileBoundaryParticle(
        particle,
        start.x + tangentX * along + normalX * across,
        start.y + tangentY * along + normalY * across,
        width * 1.55,
        angle,
      )
    }
  }

  private drawGroundedFieldMaterial(
    kind: Extract<GroundedVfxKind, 'hostile-field' | 'graveglass-field'>,
    x: number,
    y: number,
    radius: number,
    progress: number,
    stage: GroundedVfxStage,
    seed: number,
    boss = false,
    opacityScale = 1,
    bossId?: BossId,
    hostilePalette?: HostileTelegraphMaterialPalette,
    hostileBoundaryPriority = boss,
    specialAttack = false,
  ) {
    const pose = sampleGroundedVfxPose(kind, { progress })
    const texture = this.hostileGroundFieldTexture
    if (!pose.visible || !texture) {
      if (hostilePalette) {
        this.drawHostileFieldParticles(
          x,
          y,
          radius,
          progress,
          stage,
          seed,
          bossId,
          hostilePalette,
          boss,
          hostileBoundaryPriority,
          specialAttack,
        )
      }
      return
    }
    const profile = groundedVfxMaterialProfile({
      kind,
      lod: this.groundedVfxLod(),
      stage,
      boss,
      bossId,
      reducedFlash: this.settings.reducedFlash,
    })
    const variant = groundedVfxCosmeticUnit(seed, 0, 17)
    const pulse =
      1 +
      Math.sin(this.motionClock * 1.8 + variant * Math.PI * 2) *
        (boss ? 0.014 : 0.008)
    const diameter =
      Math.max(28, radius * 2.1) *
      profile.material.scale *
      pose.scale *
      pulse
    const sprite = this.acquireGroundedVfxMaterialSprite(texture)
    sprite.position.set(x, y + radius * 0.06)
    sprite.width = diameter * (0.98 + variant * 0.08)
    sprite.height = diameter * (0.9 + variant * 0.07)
    sprite.rotation =
      groundedVfxCosmeticUnit(seed, 1, 19) * Math.PI * 2
    const treatment = bossId
      ? bossMaterialTreatment(bossId)
      : profile.bossTreatment
    sprite.tint =
      treatment?.fieldTint ?? hostilePalette?.groundTint ?? 0xffffff
    sprite.alpha = clamp(
      profile.material.opacity *
        pose.alpha *
        opacityScale *
        (treatment?.fieldOpacityScale ?? 1) *
        (0.9 + pose.impact * 0.1),
      0,
      0.82,
    )
    sprite.zIndex = Math.round(y * 10)

    if (hostilePalette) {
      const seep = this.acquireGroundedVfxMaterialSprite(texture)
      seep.position.set(
        x + (variant - 0.5) * radius * 0.06,
        y + radius * (0.04 + variant * 0.025),
      )
      seep.width = diameter * (0.88 + variant * 0.05)
      seep.height = diameter * (0.78 + variant * 0.06)
      seep.rotation =
        sprite.rotation + (groundedVfxCosmeticUnit(seed, 2, 71) - 0.5) * 0.18
      seep.tint = hostilePalette.seepTint
      seep.alpha = clamp(
        hostilePalette.seepOpacity *
          pose.alpha *
          opacityScale *
          (0.72 + pose.impact * 0.5),
        0,
        0.28,
      )
      seep.zIndex = sprite.zIndex + 1
    }

    const dustCount = Math.min(
      profile.dust.count,
      this.visualLod === 'mobile' ? 4 : 8,
    )
    for (let dust = 0; dust < dustCount; dust += 1) {
      const angle =
        groundedVfxCosmeticUnit(seed, dust, 23) * Math.PI * 2
      const distance =
        radius *
        profile.dust.spread *
        (0.2 + groundedVfxCosmeticUnit(seed, dust, 29) * 0.78)
      const drift =
        (1 - pose.rise) * radius * profile.dust.drift * 0.18
      const size =
        radius *
        (0.025 + groundedVfxCosmeticUnit(seed, dust, 31) * 0.055) *
        profile.dust.scale *
        (0.72 + pose.impact * 0.28)
      this.groundedVfxDustGraphics
        .ellipse(
          x + Math.cos(angle) * (distance + drift),
          y + Math.sin(angle) * (distance + drift) * 0.58,
          size * 1.5,
          size * 0.62,
        )
        .fill({
          color:
            dust % 3 === 0
              ? hostilePalette?.smokeTint ?? treatment?.smokeTint ?? 0x645751
              : 0x312c2d,
          alpha:
            profile.dust.opacity *
            pose.alpha *
            opacityScale *
            (0.055 + pose.impact * 0.055),
        })
    }

    const debrisCount = Math.min(
      profile.debris.count,
      this.visualLod === 'mobile' ? (boss ? 4 : 2) : boss ? 10 : 4,
    )
    for (let debris = 0; debris < debrisCount; debris += 1) {
      const angle =
        groundedVfxCosmeticUnit(seed, debris, 53) * Math.PI * 2
      const distance =
        radius *
        profile.debris.spread *
        (0.18 + groundedVfxCosmeticUnit(seed, debris, 59) * 0.72)
      const size =
        radius *
        (0.025 + groundedVfxCosmeticUnit(seed, debris, 61) * 0.05) *
        profile.debris.scale
      const lift =
        radius *
        profile.debris.lift *
        (pose.rise * 0.16 + pose.impact * 0.22)
      const centerX = x + Math.cos(angle) * distance
      const centerY =
        y + Math.sin(angle) * distance * 0.54 - lift
      this.groundedVfxDustGraphics
        .poly(
          [
            centerX,
            centerY - size,
            centerX + size * 0.82,
            centerY + size * 0.42,
            centerX - size * 0.68,
            centerY + size * 0.58,
          ],
          true,
        )
        .fill({
          color:
            treatment?.debrisTint ??
            (debris % 3 === 0 ? 0x675d58 : 0x3b3838),
          alpha:
            profile.debris.opacity *
            pose.alpha *
            opacityScale *
            (0.08 + pose.impact * 0.16),
        })
    }
    if (hostilePalette) {
      this.drawHostileFieldParticles(
        x,
        y,
        radius,
        progress,
        stage,
        seed,
        bossId,
        hostilePalette,
        boss,
        hostileBoundaryPriority,
        specialAttack,
      )
    }
  }

  private drawGroundedLaneMaterial(
    kind: Extract<GroundedVfxKind, 'hostile-lane' | 'eclipse-lane'>,
    start: Vec2,
    end: Vec2,
    width: number,
    progress: number,
    stage: GroundedVfxStage,
    seed: number,
    boss = false,
    opacityScale = 1,
    bossId?: BossId,
    hostilePalette?: HostileTelegraphMaterialPalette,
    hostileBoundaryPriority = boss,
    specialAttack = false,
  ) {
    const pose = sampleGroundedVfxPose(kind, { progress })
    const texture = this.hostileGroundLaneTexture
    if (!pose.visible || !texture) {
      if (hostilePalette) {
        this.drawHostileLaneParticles(
          start,
          end,
          width,
          progress,
          stage,
          seed,
          bossId,
          hostilePalette,
          boss,
          hostileBoundaryPriority,
          specialAttack,
        )
      }
      return
    }
    const profile = groundedVfxMaterialProfile({
      kind,
      lod: this.groundedVfxLod(),
      stage,
      boss,
      bossId,
      reducedFlash: this.settings.reducedFlash,
    })
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const angle = Math.atan2(dy, dx)
    const normalX = -dy / length
    const normalY = dx / length
    const variant = groundedVfxCosmeticUnit(seed, 0, 37)
    const segmentTarget = this.visualLod === 'mobile' ? 720 : 610
    const segmentCount =
      kind === 'hostile-lane'
        ? Math.max(1, Math.min(3, Math.ceil(length / segmentTarget)))
        : 1
    const treatment = bossId
      ? bossMaterialTreatment(bossId)
      : profile.bossTreatment
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const centerT = (segment + 0.5) / segmentCount
      const sprite = this.acquireGroundedVfxMaterialSprite(texture)
      sprite.position.set(
        lerp(start.x, end.x, centerT),
        lerp(start.y, end.y, centerT),
      )
      sprite.width =
        (length / segmentCount + width * 0.72) *
        profile.material.scale *
        pose.scale
      sprite.height =
        Math.max(24, width * (1.45 + variant * 0.24)) *
        profile.material.scale *
        pose.scale
      sprite.rotation = angle
      sprite.tint =
        treatment?.laneTint ?? hostilePalette?.groundTint ?? 0xffffff
      sprite.alpha = clamp(
        profile.material.opacity *
          pose.alpha *
          opacityScale *
          (treatment?.laneOpacityScale ?? 1) *
          (0.9 + pose.impact * 0.1),
        0,
        0.78,
      )
      sprite.zIndex = Math.round(sprite.y * 10)

      if (hostilePalette) {
        const seep = this.acquireGroundedVfxMaterialSprite(texture)
        const lateral =
          (groundedVfxCosmeticUnit(seed, segment, 101) - 0.5) * width * 0.16
        seep.position.set(
          sprite.x + normalX * lateral,
          sprite.y + normalY * lateral,
        )
        seep.width = sprite.width * (0.94 + variant * 0.04)
        seep.height = sprite.height * (0.62 + variant * 0.08)
        seep.rotation = angle
        seep.tint = hostilePalette.seepTint
        seep.alpha = clamp(
          hostilePalette.seepOpacity *
            pose.alpha *
            opacityScale *
            (0.76 + pose.impact * 0.48),
          0,
          0.27,
        )
        seep.zIndex = sprite.zIndex + 1
      }
    }

    const dustCount = Math.min(
      profile.dust.count,
      this.visualLod === 'mobile' ? 4 : 7,
    )
    for (let dust = 0; dust < dustCount; dust += 1) {
      const t = 0.08 + groundedVfxCosmeticUnit(seed, dust, 41) * 0.84
      const side =
        (groundedVfxCosmeticUnit(seed, dust, 43) - 0.5) *
        width *
        profile.dust.spread
      const size =
        width *
        (0.028 + groundedVfxCosmeticUnit(seed, dust, 47) * 0.048) *
        profile.dust.scale
      this.groundedVfxDustGraphics
        .ellipse(
          lerp(start.x, end.x, t) + normalX * side,
          lerp(start.y, end.y, t) + normalY * side,
          size * 1.75,
          size * 0.58,
        )
        .fill({
          color:
            dust % 3 === 0
              ? hostilePalette?.smokeTint ?? treatment?.smokeTint ?? 0x695a53
              : 0x302b2c,
          alpha:
            profile.dust.opacity *
            pose.alpha *
            opacityScale *
            (0.05 + pose.impact * 0.06),
        })
    }

    const debrisCount = Math.min(
      profile.debris.count,
      this.visualLod === 'mobile' ? (boss ? 4 : 2) : boss ? 9 : 4,
    )
    for (let debris = 0; debris < debrisCount; debris += 1) {
      const t = 0.06 + groundedVfxCosmeticUnit(seed, debris, 73) * 0.88
      const side =
        (groundedVfxCosmeticUnit(seed, debris, 79) - 0.5) *
        width *
        profile.debris.spread
      const size =
        width *
        (0.04 + groundedVfxCosmeticUnit(seed, debris, 83) * 0.07) *
        profile.debris.scale
      const lift =
        width *
        profile.debris.lift *
        (pose.rise * 0.2 + pose.impact * 0.26)
      const centerX = lerp(start.x, end.x, t) + normalX * side
      const centerY = lerp(start.y, end.y, t) + normalY * side - lift
      this.groundedVfxDustGraphics
        .poly(
          [
            centerX,
            centerY - size,
            centerX + size * 0.9,
            centerY + size * 0.34,
            centerX - size * 0.62,
            centerY + size * 0.52,
          ],
          true,
        )
        .fill({
          color:
            treatment?.debrisTint ??
            (debris % 3 === 0 ? 0x675d58 : 0x3b3838),
          alpha:
            profile.debris.opacity *
            pose.alpha *
            opacityScale *
            (0.07 + pose.impact * 0.15),
        })
    }
    if (hostilePalette) {
      this.drawHostileLaneParticles(
        start,
        end,
        width,
        progress,
        stage,
        seed,
        bossId,
        hostilePalette,
        boss,
        hostileBoundaryPriority,
        specialAttack,
      )
    }
  }

  private drawGraveglassMaterialSprite(
    effect: WeaponEffectEntity,
    strike: CirclePatternStrike,
    localTime: number,
  ) {
    const texture = this.graveglassSpireTexture
    if (!texture) return
    const pose = sampleAuthoredSpellMaterialPose(
      'graveglass-spire',
      localTime,
    )
    if (!pose.visible) return

    const stageProfile = authoredSpellStageMaterialProfile(
      effect.visualState.stage,
    )
    const variation =
      replacementCosmeticUnit(effect.seed + strike.index * 131, 0, 31) - 0.5
    const targetHeight =
      Math.max(86, strike.radius * 2.42) *
      stageProfile.materialScale *
      (1 + variation * 0.1)
    const sprite = this.acquireAuthoredSpellMaterialSprite(texture)
    const textureAspect = texture.width / Math.max(1, texture.height)
    sprite.width = targetHeight * textureAspect * pose.scaleX
    sprite.height = targetHeight * pose.scaleY
    sprite.position.set(
      strike.center.x,
      strike.center.y + strike.radius * 0.24 + pose.lift,
    )
    sprite.rotation = variation * 0.035
    sprite.alpha = Math.min(
      1,
      pose.alpha *
        stageProfile.opacity *
        (0.94 + pose.impact * 0.08),
    )
    sprite.zIndex = Math.round(sprite.y * 10)
  }

  private drawEclipseGateMaterialSprites(
    effect: WeaponEffectEntity,
    strike: CapsulePatternStrike,
    localTime: number,
  ) {
    const texture = this.eclipseGateTexture
    if (!texture) return
    const stageProfile = authoredSpellStageMaterialProfile(
      effect.visualState.stage,
    )
    const gateCount = stageProfile.gateCountPerStrike

    for (let gate = 0; gate < gateCount; gate += 1) {
      const staggeredTime = localTime - gate * 0.035
      const pose = sampleAuthoredSpellMaterialPose(
        'eclipse-gate',
        staggeredTime,
      )
      if (!pose.visible) continue
      const t =
        gateCount === 1
          ? 0.5
          : lerp(0.3, 0.7, gate / Math.max(1, gateCount - 1))
      const variation =
        replacementCosmeticUnit(
          effect.seed + strike.index * 137,
          gate,
          37,
        ) - 0.5
      const targetHeight =
        Math.max(76, strike.radius * 2.72) *
        stageProfile.materialScale *
        (1 + variation * 0.07)
      const sprite = this.acquireAuthoredSpellMaterialSprite(texture)
      const textureAspect = texture.width / Math.max(1, texture.height)
      sprite.width = targetHeight * textureAspect * pose.scaleX
      sprite.height = targetHeight * pose.scaleY
      sprite.position.set(
        lerp(strike.start.x, strike.end.x, t),
        lerp(strike.start.y, strike.end.y, t) +
          strike.radius * 0.2 +
          pose.lift,
      )
      sprite.alpha = Math.min(
        1,
        pose.alpha *
          stageProfile.opacity *
          (0.93 + pose.impact * 0.1),
      )
      sprite.zIndex = Math.round(sprite.y * 10)
    }
  }

  private drawEclipseCathedralMaterialSprite(
    effect: WeaponEffectEntity,
    center: Vec2,
    localTime: number,
  ) {
    const texture = this.eclipseCathedralTexture
    if (!texture) return
    const stageProfile = authoredSpellStageMaterialProfile(
      effect.visualState.stage,
    )
    if (!stageProfile.cathedral) return
    const pose = sampleAuthoredSpellMaterialPose(
      'eclipse-cathedral',
      localTime,
    )
    if (!pose.visible) return

    const targetHeight = 166 * stageProfile.materialScale
    const sprite = this.acquireAuthoredSpellMaterialSprite(texture)
    const textureAspect = texture.width / Math.max(1, texture.height)
    sprite.width = targetHeight * textureAspect * pose.scaleX
    sprite.height = targetHeight * pose.scaleY
    sprite.position.set(center.x, center.y + 18 + pose.lift)
    sprite.alpha = Math.min(
      1,
      pose.alpha *
        stageProfile.opacity *
        (0.94 + pose.impact * 0.08),
    )
    sprite.zIndex = Math.round(sprite.y * 10) - 1
  }

  private drawGraveglassPresentation(
    effect: WeaponEffectEntity,
    strike: CirclePatternStrike,
    localTime: number,
  ) {
    const duration = 0.92
    const progress = clamp(localTime / duration, 0, 1)
    this.drawGroundedFieldMaterial(
      'graveglass-field',
      strike.center.x,
      strike.center.y + strike.radius * 0.06,
      strike.radius * 1.06,
      progress,
      effect.visualState.stage,
      effect.seed + strike.index * 131,
      false,
      0.92,
    )
    this.drawGraveglassMaterialSprite(effect, strike, localTime)
  }

  private drawEclipsePresentation(
    effect: WeaponEffectEntity,
    strike: CapsulePatternStrike,
    localTime: number,
  ) {
    const duration = 0.92
    const progress = clamp(localTime / duration, 0, 1)
    this.drawGroundedLaneMaterial(
      'eclipse-lane',
      strike.start,
      strike.end,
      strike.radius * 2,
      progress,
      effect.visualState.stage,
      effect.seed + strike.index * 137,
      false,
      0.88,
    )
    this.drawEclipseGateMaterialSprites(effect, strike, localTime)
  }

  private drawSupportPickupBeacon(
    graphics: Graphics,
    pickup: PickupEntity,
    x: number,
    y: number,
  ) {
    if (pickup.kind === 'xp') return
    const presentation = supportPickupPresentation(
      pickup.kind,
      pickup.age,
      pickup.visualSeed,
      {
        reducedFlash: this.settings.reducedFlash,
        highContrast: this.settings.highContrastPickups,
        lifetimeSeconds: pickup.lifetime,
      },
    )
    const beamTop = y - presentation.beamHeight
    const halfBody = presentation.beamBodyWidth * 0.5
    const halfCore = presentation.beamCoreWidth * 0.5

    graphics
      .poly(
        [
          x - halfBody,
          y + 10,
          x - halfBody * 0.18,
          beamTop,
          x + halfBody * 0.18,
          beamTop,
          x + halfBody,
          y + 10,
        ],
        true,
      )
      .fill({
        color: presentation.primaryColor,
        alpha: presentation.beamBodyAlpha * 0.34,
      })
    graphics
      .poly(
        [
          x - halfCore,
          y + 8,
          x - halfCore * 0.28,
          beamTop - 12,
          x + halfCore * 0.28,
          beamTop - 12,
          x + halfCore,
          y + 8,
        ],
        true,
      )
      .fill({
        color: presentation.coreColor,
        alpha: presentation.beamCoreAlpha,
      })

    const flare = 8 + presentation.arrival * 8 + presentation.warning * 5
    graphics
      .poly(
        [
          x,
          beamTop - flare * 1.45,
          x + flare * 0.42,
          beamTop,
          x,
          beamTop + flare * 1.45,
          x - flare * 0.42,
          beamTop,
        ],
        true,
      )
      .fill({
        color: presentation.coreColor,
        alpha: presentation.beamCoreAlpha * 0.82,
      })

    const runeRadius = 30 * presentation.runeScale
    const runePoints: Vec2[] = []
    for (let corner = 0; corner < 4; corner += 1) {
      const angle =
        presentation.runeRotation + Math.PI * 0.25 + corner * Math.PI * 0.5
      runePoints.push({
        x: x + Math.cos(angle) * runeRadius,
        y: y + Math.sin(angle) * runeRadius * 0.58,
      })
    }
    for (let side = 0; side < runePoints.length; side += 1) {
      const start = runePoints[side]
      const end = runePoints[(side + 1) % runePoints.length]
      this.drawPolyline(
        graphics,
        [
          { x: lerp(start.x, end.x, 0.08), y: lerp(start.y, end.y, 0.08) },
          { x: lerp(start.x, end.x, 0.38), y: lerp(start.y, end.y, 0.38) },
        ],
        presentation.primaryColor,
        2.2,
        presentation.groundGlowAlpha,
      )
      this.drawPolyline(
        graphics,
        [
          { x: lerp(start.x, end.x, 0.62), y: lerp(start.y, end.y, 0.62) },
          { x: lerp(start.x, end.x, 0.92), y: lerp(start.y, end.y, 0.92) },
        ],
        presentation.coreColor,
        1.4,
        presentation.groundGlowAlpha * 0.86,
      )
    }

    if (pickup.kind === 'dawnheart') {
      for (const side of [-1, 1]) {
        graphics
          .moveTo(x, y + 8)
          .lineTo(x + side * 11, y - 4)
          .lineTo(x + side * 21, y + 1)
          .stroke({
            color: side > 0 ? presentation.coreColor : presentation.primaryColor,
            width: 2.2,
            alpha: presentation.groundGlowAlpha * 0.92,
          })
      }
    } else if (pickup.kind === 'gravestar') {
      const star: number[] = []
      for (let point = 0; point < 8; point += 1) {
        const angle = presentation.runeRotation * 0.4 + point * Math.PI * 0.25
        const radius = point % 2 === 0 ? 14 : 4.5
        star.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
      }
      graphics
        .poly(star, true)
        .fill({
          color: presentation.shadowColor,
          alpha: presentation.groundGlowAlpha * 0.52,
        })
        .stroke({
          color: presentation.coreColor,
          width: 1.6,
          alpha: presentation.groundGlowAlpha,
        })
    } else {
      graphics
        .poly(
          [
            x - 4,
            y - 16,
            x + 7,
            y - 3,
            x + 1,
            y - 3,
            x + 5,
            y + 15,
            x - 8,
            y + 1,
            x - 1,
            y + 1,
          ],
          true,
        )
        .fill({
          color: presentation.coreColor,
          alpha: presentation.groundGlowAlpha,
        })
    }

    for (const fragment of presentation.fragments) {
      const orbit =
        fragment.distance +
        Math.sin(pickup.age * 1.9 + fragment.phase) * 4
      const fragmentX =
        x + Math.cos(fragment.angle + pickup.age * 0.16) * orbit
      const fragmentY =
        y -
        8 +
        Math.sin(fragment.angle + pickup.age * 0.16) * orbit * 0.46 -
        Math.sin(pickup.age * 2.7 + fragment.phase) * 5
      this.drawDiamondGlyph(
        graphics,
        fragmentX,
        fragmentY,
        fragment.size,
        fragment.angle + pickup.age * 0.3,
        presentation.coreColor,
        presentation.fragmentAlpha,
        true,
      )
    }
  }

  private protectedEffectAlphaAt(
    x: number,
    y: number,
    sourceAlpha: number,
    kind: OverdrawKind,
  ) {
    return attenuateOverdrawAlpha(
      sourceAlpha,
      Math.hypot(x - this.player.x, y - this.player.y),
      kind,
    )
  }

  private currentSceneVfxEnergyScale() {
    const activeWeaponCount = this.weapons.reduce(
      (count, weapon) => count + (weapon.rank > 0 ? 1 : 0),
      0,
    )
    const activeProjectileCount = this.projectiles.reduce(
      (count, projectile) => count + (projectile.active ? 1 : 0),
      0,
    )
    const activeEchoCount = this.motionEchoes.reduce(
      (count, echo) => count + (echo.active ? 1 : 0),
      0,
    )
    const persistentActorCount =
      this.orbitingComets.reduce(
        (count, comet) => count + (comet.active ? 1 : 0),
        0,
      ) +
      this.cinderwakeReavers.reduce(
        (count, reaver) => count + (reaver.active ? 1 : 0),
        0,
      )
    return sceneVfxEnergyScale(
      activeWeaponCount,
      this.weaponEffects.length +
        activeProjectileCount +
        activeEchoCount +
        persistentActorCount,
    )
  }

  private protectedSegmentEffectAlpha(
    start: Vec2,
    end: Vec2,
    sourceAlpha: number,
    kind: OverdrawKind,
  ) {
    const segmentX = end.x - start.x
    const segmentY = end.y - start.y
    const lengthSquared = segmentX * segmentX + segmentY * segmentY
    const projection =
      lengthSquared <= 0.0001
        ? 0
        : clamp(
            ((this.player.x - start.x) * segmentX +
              (this.player.y - start.y) * segmentY) /
              lengthSquared,
            0,
            1,
          )
    const nearestX = start.x + segmentX * projection
    const nearestY = start.y + segmentY * projection
    return this.protectedEffectAlphaAt(
      nearestX,
      nearestY,
      sourceAlpha,
      kind,
    )
  }

  private drawLightRingAura(
    graphics: Graphics,
    additiveGraphics: Graphics,
    overlayGraphics: Graphics,
    overlayAdditiveGraphics: Graphics,
  ) {
    const profile = lightRingProfile(this.lightRingRank)
    if (!profile) return

    const x = lerp(this.player.previousX, this.player.x, this.interpolation)
    const y =
      lerp(this.player.previousY, this.player.y, this.interpolation) +
      HERO_BODY_CENTER_OFFSET_Y
    const stage: WeaponVfxStage = profile.awakened
      ? 'final'
      : profile.rank >= 4
        ? 'mastered'
        : profile.rank >= 2
          ? 'combined'
          : 'solo'
    const reducedMotionScale = this.settings.reducedShake ? 0.28 : 1
    const motionTime = this.motionClock * reducedMotionScale
    const renderPlan = lightRingRenderPlan(
      profile,
      this.visualLod === 'mobile' ? 'mobile' : 'desktop',
    )
    const breath = Math.sin(
      motionTime * 1.72 + profile.rank * 0.47,
    )
    const pulse = clamp(
      this.lightRingPulse / (this.settings.reducedFlash ? 0.1 : 0.18),
      0,
      1,
    )
    const radius =
      profile.radius *
      (1 + breath * (this.settings.reducedShake ? 0.013 : 0.028) + pulse * 0.035)
    const ivory = profile.awakened ? 0xfffff2 : 0xfff4d3
    const gold = profile.awakened ? 0xffdf86 : 0xf3b54d
    const amber = profile.awakened ? 0xffa43f : 0xe36d24
    const whiteHot = 0xffffff
    const reducedFlashScale = this.settings.reducedFlash ? 0.68 : 1

    // A subdued, textured pool grounds the barrier without adding another
    // outlined circle. The authored material atlas supplies smoke and light
    // breakup beneath the hand-drawn perimeter filaments.
    graphics
      .ellipse(x, y + radius * 0.025, radius * 0.93, radius * 0.67)
      .fill({
        color: 0x6b4b18,
        alpha:
          (0.014 + profile.rank * 0.002 + pulse * 0.016) *
          reducedFlashScale,
      })
    this.drawHeroPowerMaterialEvent({
      x,
      y,
      radius: radius * 0.87,
      progress: 0.34,
      stage,
      seed: 4_913 + profile.rank * 173,
      tint: gold,
      frame: HERO_MATERIAL_FRAME.halo,
      angle:
        motionTime *
        profile.rotationSpeed *
        (profile.awakened ? -0.9 : 0.72),
      materialOpacity:
        (profile.materialOpacity + pulse * 0.055) * reducedFlashScale,
      stretchX: 1.1,
      stretchY: 0.88,
    })

    // Each rank gains authored, counter-rotating bands. They are composed from
    // broken arcs with a broad ember corona and a fine white-hot core, avoiding
    // the flat closed-circle language of a HUD outline.
    const orbitBandCount = renderPlan.orbitBandCount
    for (let band = 0; band < orbitBandCount; band += 1) {
      const direction = band % 2 === 0 ? 1 : -1
      const bandRadius = radius * (0.84 + band * 0.052)
      const segmentCount = renderPlan.orbitSegmentCount
      const rotation =
        motionTime *
          profile.rotationSpeed *
          direction *
          (0.78 + band * 0.16) +
        band * 0.63

      for (let segment = 0; segment < segmentCount; segment += 1) {
        const noise = replacementCosmeticUnit(
          5_147 + profile.rank * 149 + band * 31,
          segment,
          193,
        )
        const center =
          rotation +
          (Math.PI * 2 * segment) / segmentCount +
          (noise - 0.5) * 0.17
        const span =
          (Math.PI * 2 / segmentCount) *
          (0.38 + noise * 0.28)
        const start = center - span * 0.5
        const end = center + span * 0.5
        const bandAlpha =
          (profile.coronaOpacity * (0.62 + band * 0.07) + pulse * 0.16) *
          reducedFlashScale

        additiveGraphics
          .arc(x, y, bandRadius, start, end)
          .stroke({
            color: band % 2 === 0 ? amber : gold,
            width: 12 + profile.rank * 0.8,
            alpha: bandAlpha * 0.12,
            cap: 'round',
          })
          .arc(x, y, bandRadius, start, end)
          .stroke({
            color: gold,
            width: 4.2 + profile.rank * 0.32,
            alpha: bandAlpha * 0.3,
            cap: 'round',
          })
        graphics
          .arc(x, y, bandRadius, start, end)
          .stroke({
            color: segment % 3 === 0 ? whiteHot : ivory,
            width: 0.95 + profile.rank * 0.1,
            alpha: Math.min(0.92, bandAlpha + 0.16),
            cap: 'round',
          })
      }
    }

    // Staggered, expanding wave fronts make the aura visibly radiate. Their
    // discontinuous spans preserve a physical corona instead of a diagram.
    const pulseWaveCount = this.settings.reducedShake
      ? 1
      : renderPlan.pulseWaveCount
    for (let wave = 0; wave < pulseWaveCount; wave += 1) {
      const waveProgress =
        (motionTime * (0.34 + profile.rank * 0.025) + wave / pulseWaveCount) %
        1
      const waveRadius = radius * (0.78 + waveProgress * 0.35)
      const waveFade = Math.sin(waveProgress * Math.PI)
      const waveSegments = renderPlan.waveSegmentCount
      for (let segment = 0; segment < waveSegments; segment += 1) {
        const start =
          (Math.PI * 2 * segment) / waveSegments +
          wave * 0.41 +
          motionTime * 0.03
        const span =
          (Math.PI * 2 / waveSegments) *
          (0.34 +
            replacementCosmeticUnit(profile.rank * 503 + wave, segment, 197) *
              0.2)
        additiveGraphics
          .arc(x, y, waveRadius, start, start + span)
          .stroke({
            color: amber,
            width: 10 + profile.rank * 0.65,
            alpha: waveFade * (0.07 + profile.rank * 0.008),
            cap: 'round',
          })
        graphics
          .arc(x, y, waveRadius, start, start + span)
          .stroke({
            color: gold,
            width: 0.75 + profile.rank * 0.08,
            alpha: waveFade * (0.2 + profile.rank * 0.025),
            cap: 'round',
          })
      }
    }

    // One irregular, broken perimeter replaces closed vector rings. Each arc
    // has its own radius and span, so the silhouette reads as fine light woven
    // through smoke rather than a HUD circle painted on the floor.
    const filamentCount = renderPlan.filamentCount
    for (let filament = 0; filament < filamentCount; filament += 1) {
      const unit = replacementCosmeticUnit(
        8_111 + profile.rank * 101,
        filament,
        211,
      )
      const radiusUnit = replacementCosmeticUnit(
        8_111 + profile.rank * 101,
        filament,
        223,
      )
      const spanUnit = replacementCosmeticUnit(
        8_111 + profile.rank * 101,
        filament,
        227,
      )
      const start =
        (Math.PI * 2 * filament) / filamentCount +
        motionTime *
          profile.rotationSpeed *
          (filament % 2 === 0 ? 1.12 : -0.86) +
        (unit - 0.5) * 0.18
      const span =
        (Math.PI * 2 / filamentCount) *
        (0.42 + spanUnit * 0.34)
      const strandRadius = radius * (0.965 + (radiusUnit - 0.5) * 0.045)
      const strandAlpha =
        (0.44 + profile.rank * 0.04 + pulse * 0.24) *
        reducedFlashScale

      additiveGraphics
        .arc(x, y, strandRadius, start, start + span)
        .stroke({
          color: gold,
          width: 8.5 + profile.rank * 0.55 + pulse * 2.8,
          alpha: strandAlpha * 0.18,
          cap: 'round',
        })
      graphics
        .arc(x, y, strandRadius, start, start + span)
        .stroke({
          color: filament % 3 === 0 ? gold : ivory,
          width: profile.awakened ? 1.85 : 1.25,
          alpha: Math.min(0.96, strandAlpha),
          cap: 'round',
        })
    }

    const moteCount = renderPlan.moteCount
    for (let mote = 0; mote < moteCount; mote += 1) {
      const orbit = replacementCosmeticUnit(
        9_701 + profile.rank * 137,
        mote,
        239,
      )
      const drift = replacementCosmeticUnit(
        9_701 + profile.rank * 137,
        mote,
        241,
      )
      const angle =
        orbit * Math.PI * 2 +
        motionTime *
          profile.rotationSpeed *
          (mote % 2 === 0 ? 0.85 : -0.62)
      const breathingOffset =
        Math.sin(motionTime * (1.2 + drift) + mote * 1.71) *
        (4 + profile.rank * 0.8)
      const moteRadius =
        radius * (0.88 + drift * 0.23) + breathingOffset
      const moteSize =
        0.75 +
        profile.rank * 0.08 +
        replacementCosmeticUnit(profile.rank * 331, mote, 251) * 1.35
      const moteAlpha =
        (0.32 + profile.rank * 0.032 + pulse * 0.2) *
        reducedFlashScale

      additiveGraphics
        .circle(
          x + Math.cos(angle) * moteRadius,
          y + Math.sin(angle) * moteRadius,
          moteSize * 3.6,
        )
        .fill({ color: gold, alpha: moteAlpha * 0.2 })
      graphics
        .circle(
          x + Math.cos(angle) * moteRadius,
          y + Math.sin(angle) * moteRadius,
          moteSize,
        )
        .fill({
          color: mote % 4 === 0 ? gold : ivory,
          alpha: moteAlpha,
        })
    }

    const energyKnotCount = renderPlan.energyKnotCount
    for (let knot = 0; knot < energyKnotCount; knot += 1) {
      const direction = knot % 2 === 0 ? 1 : -1
      const angle =
        (Math.PI * 2 * knot) / energyKnotCount +
        motionTime *
          profile.rotationSpeed *
          direction *
          (1.2 + (knot % 3) * 0.16)
      const knotRadius = radius * (0.89 + (knot % 3) * 0.04)
      const knotX = x + Math.cos(angle) * knotRadius
      const knotY = y + Math.sin(angle) * knotRadius
      const tangent = angle + direction * Math.PI * 0.5
      const tailLength = 5 + profile.rank * 1.45
      const knotAlpha =
        (0.48 + profile.rank * 0.045 + pulse * 0.2) * reducedFlashScale

      additiveGraphics
        .moveTo(
          knotX - Math.cos(tangent) * tailLength,
          knotY - Math.sin(tangent) * tailLength,
        )
        .lineTo(knotX, knotY)
        .stroke({
          color: amber,
          width: 7 + profile.rank * 0.55,
          alpha: knotAlpha * 0.16,
          cap: 'round',
        })
        .circle(knotX, knotY, 4.2 + profile.rank * 0.22)
        .fill({ color: gold, alpha: knotAlpha * 0.24 })
      graphics
        .moveTo(
          knotX - Math.cos(tangent) * tailLength,
          knotY - Math.sin(tangent) * tailLength,
        )
        .lineTo(knotX, knotY)
        .stroke({
          color: ivory,
          width: 0.85 + profile.rank * 0.08,
          alpha: knotAlpha,
          cap: 'round',
        })
        .circle(knotX, knotY, 1 + profile.rank * 0.08)
        .fill({ color: whiteHot, alpha: Math.min(1, knotAlpha + 0.18) })
    }

    // Upper ranks grow a few curved light-plumes from the perimeter. They are
    // deliberately sparse, asymmetrical and bezier-shaped—never radial ticks.
    const petalCount = renderPlan.petalCount
    for (let petal = 0; petal < petalCount; petal += 1) {
      const angle =
        (Math.PI * 2 * petal) / petalCount -
        motionTime *
          profile.rotationSpeed *
          0.72 +
        (replacementCosmeticUnit(profile.rank * 409, petal, 263) - 0.5) *
          0.24
      const direction = petal % 2 === 0 ? 1 : -1
      const startX = x + Math.cos(angle) * radius * 0.93
      const startY = y + Math.sin(angle) * radius * 0.93
      const controlAngle = angle + direction * (0.12 + profile.rank * 0.006)
      const controlX = x + Math.cos(controlAngle) * radius * 1.11
      const controlY = y + Math.sin(controlAngle) * radius * 1.11
      const endAngle = angle + direction * 0.21
      const endX = x + Math.cos(endAngle) * radius * 1.015
      const endY = y + Math.sin(endAngle) * radius * 1.015
      const plumeAlpha =
        (0.38 + profile.rank * 0.035 + pulse * 0.2) *
        reducedFlashScale

      additiveGraphics
        .moveTo(startX, startY)
        .quadraticCurveTo(controlX, controlY, endX, endY)
        .stroke({
          color: gold,
          width: 9 + profile.rank * 0.65,
          alpha: plumeAlpha * 0.15,
          cap: 'round',
        })
      graphics
        .moveTo(startX, startY)
        .quadraticCurveTo(controlX, controlY, endX, endY)
        .stroke({
          color: petal % 3 === 0 ? gold : ivory,
          width: profile.awakened ? 1.85 : 1.25,
          alpha: Math.min(0.94, plumeAlpha),
          cap: 'round',
        })
    }

    // A sparse perimeter-only pass renders above the rest of the spell arsenal.
    // It preserves the Aegis gameplay boundary without lifting the full aura
    // over other attacks or rebuilding a continuous HUD-like circle.
    for (
      let segment = 0;
      segment < renderPlan.overlaySegmentCount;
      segment += 1
    ) {
      const noise = replacementCosmeticUnit(
        12_811 + profile.rank * 181,
        segment,
        277,
      )
      const center =
        (Math.PI * 2 * segment) / renderPlan.overlaySegmentCount -
        motionTime * profile.rotationSpeed * 0.22 +
        (noise - 0.5) * 0.2
      const span =
        (Math.PI * 2 / renderPlan.overlaySegmentCount) *
        (0.12 + noise * 0.09)
      const start = center - span * 0.5
      const end = center + span * 0.5
      const overlayRadius = radius * (1.004 + (noise - 0.5) * 0.018)
      const overlayAlpha =
        (0.5 + profile.rank * 0.035 + pulse * 0.12) * reducedFlashScale

      overlayAdditiveGraphics
        .arc(x, y, overlayRadius, start, end)
        .stroke({
          color: gold,
          width: 4.4 + profile.rank * 0.28,
          alpha: overlayAlpha * 0.16,
          cap: 'round',
        })
      overlayGraphics
        .arc(x, y, overlayRadius, start, end)
        .stroke({
          color: segment % 3 === 0 ? whiteHot : ivory,
          width: 0.72 + profile.rank * 0.06,
          alpha: Math.min(0.88, overlayAlpha),
          cap: 'round',
        })
    }
  }

  private drawCombatLabWeaponEffectAccent(
    effect: WeaponEffectEntity,
    graphics: Graphics,
    additiveGraphics: Graphics,
    progress: number,
    motionAlpha: number,
    radius: number,
    rotation: number,
    profile: WeaponVfxProfile,
  ) {
    const presentation = this.combatLabRuntimeVfx(
      effect.weaponId,
      effect.visualState,
    )
    if (!presentation.enabled) return

    const energy = presentation.energyScale * motionAlpha
    const rank = presentation.rank
    const geometryScale = presentation.geometryScale
    const pulse = 0.82 + Math.sin(this.motionClock * 5.2 + effect.seed) * 0.18

    switch (presentation.motif) {
      case 'solar-filaments': {
        // Preserve the v1.16.3 Lance silhouette. The previous Lab overlay
        // added a fan of rays around the authored 54x18 projectile, making the
        // weapon appear several times larger than the hero.
        break
      }
      case 'lunar-petals': {
        // The authored moonblades carry the silhouette. Keep this accent
        // to sparse material motes so the old line-drawn crescents cannot
        // reappear around the cast or impact.
        const motes = Math.min(7, 2 + presentation.ornamentCount)
        for (let mote = 0; mote < motes; mote += 1) {
          const angle = rotation * 0.54 + (Math.PI * 2 * mote) / motes
          const distance = radius * (0.42 + (mote % 3) * 0.12)
          const moteRadius = (0.9 + (mote % 2) * 0.55 + rank * 0.08) * geometryScale
          additiveGraphics
            .circle(
              effect.x + Math.cos(angle) * distance,
              effect.y + Math.sin(angle) * distance,
              moteRadius * 2.4,
            )
            .fill({ color: profile.glowColor, alpha: energy * 0.08 })
          graphics
            .ellipse(
              effect.x + Math.cos(angle) * distance,
              effect.y + Math.sin(angle) * distance,
              moteRadius,
              moteRadius * 0.48,
            )
            .fill({
              color: mote % 2 ? profile.secondaryColor : profile.coreColor,
              alpha: energy * 0.48,
            })
        }
        break
      }
      case 'cathedral-branches': {
        // The authored impact atlas now carries Arc Choir's target detail in
        // every mode. Avoid reintroducing the rejected procedural line forks.
        break
      }
      case 'astral-verdict': {
        const points = effect.points ?? [{ x: effect.x, y: effect.y }]
        for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
          const point = points[pointIndex]
          const moteCount = Math.min(5, 2 + Math.ceil(rank / 2))
          for (let mote = 0; mote < moteCount; mote += 1) {
            const drift =
              this.motionClock * (12 + mote * 1.7) +
              replacementCosmeticUnit(effect.seed + pointIndex * 83, mote, 353) * 42
            const side =
              (replacementCosmeticUnit(effect.seed + pointIndex * 89, mote, 359) - 0.5) *
              (34 + rank * 5)
            const moteX = point.x + side + Math.sin(drift * 0.09) * 4
            const moteY = point.y - 10 - (drift % (52 + rank * 7))
            const size = 1.2 + rank * 0.16 + (mote % 2) * 0.5
            graphics
              .poly([
                moteX,
                moteY - size * 2.2,
                moteX + size,
                moteY,
                moteX,
                moteY + size * 2.2,
                moteX - size,
                moteY,
              ], true)
              .fill({
                color: mote % 2 ? profile.secondaryColor : profile.coreColor,
                alpha: energy * (0.34 + pulse * 0.16),
              })
          }
        }
        break
      }
      case 'plasma-embers': {
        const flareCount = Math.min(8, presentation.ornamentCount + 1)
        for (let flare = 0; flare < flareCount; flare += 1) {
          const spread = (flare - (flareCount - 1) * 0.5) * 0.17
          const angle = effect.angle + Math.PI + spread
          const length =
            (18 + rank * 5 + (flare % 2) * 8) * pulse * geometryScale
          additiveGraphics
            .moveTo(effect.x, effect.y)
            .quadraticCurveTo(
              effect.x + Math.cos(angle + spread * 0.5) * length * 0.54,
              effect.y + Math.sin(angle + spread * 0.5) * length * 0.54,
              effect.x + Math.cos(angle) * length,
              effect.y + Math.sin(angle) * length,
            )
            .stroke({
              color: flare % 2 ? profile.secondaryColor : profile.accentColor,
              width: (1.2 + rank * 0.32) * geometryScale,
              alpha: energy * 0.46,
              cap: 'round',
            })
        }
        break
      }
      default:
        break
    }
  }

  private drawWeaponEffects() {
    this.beginAuthoredSpellMaterialFrame()
    this.lightRingAdditiveGraphics.clear()
    this.lightRingGraphics.clear()
    this.lightRingOverlayAdditiveGraphics.clear()
    this.lightRingOverlayGraphics.clear()
    this.weaponVfxAdditiveGraphics.clear()
    this.weaponVfxGraphics.clear()
    const additiveGraphics = this.weaponVfxAdditiveGraphics
    const graphics = this.weaponVfxGraphics
    const energyScale = this.currentSceneVfxEnergyScale()
    const lightRingEnergyScale = Math.max(0.78, energyScale)
    this.lightRingAdditiveGraphics.alpha = lightRingEnergyScale
    this.lightRingGraphics.alpha = lightRingEnergyScale
    this.lightRingOverlayAdditiveGraphics.alpha = lightRingEnergyScale
    this.lightRingOverlayGraphics.alpha = lightRingEnergyScale
    additiveGraphics.alpha = energyScale
    graphics.alpha = energyScale
    this.drawLightRingAura(
      this.lightRingGraphics,
      this.lightRingAdditiveGraphics,
      this.lightRingOverlayGraphics,
      this.lightRingOverlayAdditiveGraphics,
    )
    for (let index = this.weaponEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.weaponEffects[index]
      if (effect.life <= 0) {
        this.weaponEffects.splice(index, 1)
        continue
      }
      const progress = clamp(1 - effect.life / effect.total, 0, 1)
      const attack = clamp(progress / 0.14, 0, 1)
      const decay = 1 - clamp((progress - 0.58) / 0.42, 0, 1)
      const motionAlpha = attack * decay * (this.settings.reducedFlash ? 0.68 : 1)
      const eased = 1 - (1 - progress) ** 3
      const radius = lerp(effect.radius, effect.maxRadius, eased)
      const state = effect.visualState
      const stage = this.vfxStageIndex(state.stage)
      const profile = this.weaponPresentationProfile(effect.weaponId, state)
      const rotation = effect.angle + progress * (0.8 + stage * 0.26) + effect.seed * 0.013

      switch (effect.kind) {
        case 'helio-gate': {
          this.drawHeroPowerMaterialEvent({
            x: effect.x,
            y: effect.y,
            radius: 30 + stage * 8 + attack * 5,
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.coreColor,
            frame: HERO_MATERIAL_FRAME.lance,
            angle: effect.angle + Math.PI * 0.23,
            materialOpacity: 0.34,
            stretchX: 1.28 + stage * 0.08,
            stretchY: 0.72,
          })
          break
        }
        case 'helio-impact': {
          this.drawHeroPowerMaterialEvent({
            x: effect.x,
            y: effect.y,
            radius,
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.accentColor,
            frame: HERO_MATERIAL_FRAME.impact,
            angle: rotation,
            materialOpacity: 0.3,
          })
          break
        }
        case 'crescent-orbit': {
          const orbitCount = capDecorativeDensity(
            3 + stage * 2 + (state.awakened ? 1 : 0),
            state.stage,
          )
          const orbitRadius = radius * (0.68 + attack * 0.32)
          this.drawHeroPowerMaterialEvent({
            x: effect.x,
            y: effect.y,
            radius: orbitRadius,
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.secondaryColor,
            frame: HERO_MATERIAL_FRAME.driftA,
            angle: rotation,
            materialOpacity: stage === 3 ? 0.2 : 0.12,
            stretchX: 1.16,
            stretchY: 0.84,
          })
          for (let blade = 0; blade < orbitCount; blade += 1) {
            const bladeAngle = rotation + (Math.PI * 2 * blade) / orbitCount
            const layerRadius = stage === 3 && blade % 2 ? orbitRadius * 0.62 : orbitRadius
            const bladeX = effect.x + Math.cos(bladeAngle) * layerRadius
            const bladeY = effect.y + Math.sin(bladeAngle) * layerRadius
            const drewAuthoredBlade = this.drawAuthoredCrescentMaterial({
              x: bladeX,
              y: bladeY,
              angle: bladeAngle + Math.PI * 0.5,
              size: 8.4 + stage * 1.5,
              progress,
              seed: effect.seed + blade * 17,
              alpha: motionAlpha * 0.94,
            })
            if (!drewAuthoredBlade) {
              this.drawCrescentGlyph(
                graphics,
                bladeX,
                bladeY,
                bladeAngle,
                8 + stage * 1.4,
                profile.accentColor,
                motionAlpha * 0.92,
              )
            }
          }
          break
        }
        case 'crescent-impact': {
          const shards = 4 + stage * 2
          this.drawHeroPowerMaterialEvent({
            x: effect.x,
            y: effect.y,
            radius,
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.coreColor,
            frame: HERO_MATERIAL_FRAME.fragments,
            angle: rotation,
            materialOpacity: 0.24,
          })
          for (let shard = 0; shard < shards; shard += 1) {
            const shardAngle = rotation + (Math.PI * 2 * shard) / shards
            const shardX = effect.x + Math.cos(shardAngle) * radius * 0.72
            const shardY = effect.y + Math.sin(shardAngle) * radius * 0.72
            const drewAuthoredShard = this.drawAuthoredCrescentMaterial({
              x: shardX,
              y: shardY,
              angle: shardAngle + Math.PI * 0.5,
              size: 4.8 + stage,
              progress,
              seed: effect.seed + shard * 23,
              alpha: motionAlpha * 0.74,
            })
            if (!drewAuthoredShard) {
              this.drawCrescentGlyph(
                graphics,
                shardX,
                shardY,
                shardAngle,
                4.5 + stage,
                profile.coreColor,
                motionAlpha * 0.7,
              )
            }
          }
          break
        }
        case 'arc-chain': {
          const lightning = this.buildLightningPoints(effect.points ?? [], effect.seed, progress)
          // A restrained deep-violet bloom and saturated lavender body carry
          // the spell identity. The narrow white core supplies voltage without
          // washing the chain into a pale or yellow-looking line at high ranks.
          this.drawPolyline(graphics, lightning, profile.glowColor, 20 + stage * 4, motionAlpha * 0.16)
          this.drawPolyline(graphics, lightning, profile.accentColor, 6.6 + stage * 0.9, motionAlpha * 0.76)
          this.drawPolyline(graphics, lightning, profile.coreColor, 1.15 + stage * 0.18, motionAlpha * 0.94)
          for (let nodeIndex = 1; nodeIndex < (effect.points?.length ?? 0); nodeIndex += 1) {
            const node = effect.points?.[nodeIndex]
            if (!node) continue
            const nodeRadius = 10 + stage * 2.7
            const impactTime = progress * effect.total - (nodeIndex - 1) * 0.03
            const impactProgress = impactTime / 0.28
            const impactScale = effect.pointScales?.[nodeIndex] ?? 1
            const drewAuthoredImpact = this.drawAuthoredArcImpact({
              x: node.x,
              y: node.y,
              progress: impactProgress,
              size: (32 + stage * 3.5) * impactScale,
              seed: effect.seed + nodeIndex * 97,
              alpha: motionAlpha * 0.96,
            })
            if (!drewAuthoredImpact) {
              this.drawHeroPowerMaterialEvent({
                x: node.x,
                y: node.y,
                radius: nodeRadius * 1.7,
                progress,
                stage: state.stage,
                seed: effect.seed + nodeIndex * 97,
                tint: profile.accentColor,
                frame: HERO_MATERIAL_FRAME.impact,
                angle: rotation + nodeIndex,
                materialOpacity: 0.2,
              })
            }
          }
          if (stage === 3) {
            this.drawHeroPowerMaterialEvent({
              x: effect.x,
              y: effect.y,
              radius: radius * 0.82,
              progress,
              stage: state.stage,
              seed: effect.seed + 401,
              tint: profile.secondaryColor,
              frame: HERO_MATERIAL_FRAME.gather,
              angle: effect.angle,
              materialOpacity: 0.18,
              stretchY: 1.18,
            })
          }
          break
        }
        case 'astral-verdict': {
          const strikePoints = effect.points ?? [{ x: effect.x, y: effect.y }]
          const sceneTime = progress * effect.total
          for (let strikeIndex = 0; strikeIndex < strikePoints.length; strikeIndex += 1) {
            const point = strikePoints[strikeIndex]
            const strikeDelay = Math.min(0.28, strikeIndex * 0.045)
            const localTime = sceneTime - strikeDelay
            if (localTime < 0) continue
            const gather = clamp(localTime / 0.11, 0, 1)
            const release = clamp((localTime - 0.07) / 0.08, 0, 1)
            const fade = 1 - clamp((localTime - 0.34) / 0.3, 0, 1)
            const strikeAlpha = gather * fade * (this.settings.reducedFlash ? 0.7 : 1)
            const cloudY = point.y - 224 - stage * 10
            const sourceX = point.x +
              (replacementCosmeticUnit(effect.seed, strikeIndex, 367) - 0.5) *
                (18 + stage * 4)

            this.drawHeroPowerMaterialEvent({
              x: sourceX,
              y: cloudY + 18,
              radius: 52 + stage * 13,
              progress: clamp(localTime / 0.56, 0, 1),
              stage: state.stage,
              seed: effect.seed + strikeIndex * 113,
              tint: profile.glowColor,
              frame: HERO_MATERIAL_FRAME.driftB,
              angle: -rotation * 0.16,
              materialOpacity: 0.16 + stage * 0.025,
              stretchX: 1.46,
              stretchY: 0.62,
            })
            this.drawHeroPowerMaterialEvent({
              x: point.x,
              y: point.y,
              radius: effect.maxRadius * (0.72 + release * 0.24),
              progress: clamp(localTime / 0.58, 0, 1),
              stage: state.stage,
              seed: effect.seed + strikeIndex * 127,
              tint: strikeIndex % 2 ? profile.secondaryColor : profile.accentColor,
              frame: HERO_MATERIAL_FRAME.fracture,
              angle: rotation + strikeIndex * 0.73,
              materialOpacity: 0.22 + stage * 0.025,
              stretchX: 1.16,
              stretchY: 0.78,
            })
            if (state.awakened) {
              this.drawHeroPowerMaterialEvent({
                x: point.x,
                y: point.y,
                radius: effect.maxRadius * (0.9 + release * 0.2),
                progress: clamp(localTime / 0.62, 0, 1),
                stage: state.stage,
                seed: effect.seed + strikeIndex * 131,
                tint: profile.glowColor,
                frame: HERO_MATERIAL_FRAME.impact,
                angle: -rotation + strikeIndex * 0.41,
                materialOpacity: 0.18,
                stretchX: 1.28,
                stretchY: 0.7,
              })
            }

            if (release > 0) {
              const frameIndex = Math.min(
                this.astralVerdictFrames.length - 1,
                Math.max(
                  0,
                  Math.floor(clamp(localTime / 0.5, 0, 0.999) * 16),
                ),
              )
              const frame = this.astralVerdictFrames[frameIndex]
              if (frame) {
                const boltHeight = 218 + stage * 14 + (state.awakened ? 20 : 0)
                const boltWidth = 82 + stage * 8 + (state.awakened ? 16 : 0)
                if (state.awakened) {
                  const stormBody = this.acquireAuthoredSpellMaterialSprite(frame)
                  stormBody.anchor.set(0.5, 0.86)
                  stormBody.position.set(point.x, point.y + 4)
                  stormBody.width = boltWidth * 1.14
                  stormBody.height = boltHeight * 1.05
                  stormBody.rotation =
                    (replacementCosmeticUnit(effect.seed, strikeIndex, 137) - 0.5) *
                    0.035
                  stormBody.tint = 0x7656b7
                  stormBody.alpha = strikeAlpha * 0.34
                  stormBody.blendMode = 'add'
                  stormBody.zIndex = Math.round(point.y * 10) - 3
                }
                const authoredBolt = this.acquireAuthoredSpellMaterialSprite(frame)
                authoredBolt.anchor.set(0.5, 0.86)
                authoredBolt.position.set(point.x, point.y + 4)
                authoredBolt.width = boltWidth
                authoredBolt.height = boltHeight
                authoredBolt.rotation =
                  (replacementCosmeticUnit(effect.seed, strikeIndex, 139) - 0.5) *
                  0.024
                authoredBolt.tint = 0xffffff
                authoredBolt.alpha = strikeAlpha * 0.96
                authoredBolt.blendMode = 'add'
                authoredBolt.zIndex = Math.round(point.y * 10) - 2
              }
            }
          }
          break
        }
        case 'comet-launch': {
          this.drawHeroPowerMaterialEvent({
            x: effect.x,
            y: effect.y,
            radius,
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.secondaryColor,
            frame: HERO_MATERIAL_FRAME.driftB,
            angle: effect.angle,
            materialOpacity: 0.22,
            stretchX: 1.24,
            stretchY: 0.78,
          })
          break
        }
        case 'comet-impact': {
          this.drawHeroPowerMaterialEvent({
            x: effect.x,
            y: effect.y,
            radius,
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.accentColor,
            frame: HERO_MATERIAL_FRAME.dust,
            angle: rotation,
            materialOpacity: 0.3,
          })
          break
        }
        case 'graveglass-eruption': {
          const pattern = effect.pattern
          if (pattern?.kind !== 'graveglass-spires') break
          const now = progress * effect.total
          for (const strike of pattern.strikes) {
            const localTime = now - strike.delay
            if (localTime < 0) continue
            this.drawGraveglassPresentation(effect, strike, localTime)
          }
          break
        }
        case 'eclipse-harrow': {
          const pattern = effect.pattern
          if (pattern?.kind !== 'eclipse-harrow') break
          const now = progress * effect.total
          for (const strike of pattern.strikes) {
            const localTime = now - strike.delay
            if (localTime < 0) continue
            this.drawEclipsePresentation(effect, strike, localTime)
          }
          if (stage === 3) {
            this.drawEclipseCathedralMaterialSprite(
              effect,
              pattern.aimPoint,
              now,
            )
          }
          break
        }
      }
      this.drawCombatLabWeaponEffectAccent(
        effect,
        graphics,
        additiveGraphics,
        progress,
        motionAlpha,
        radius,
        rotation,
        profile,
      )
    }
    this.finishAuthoredSpellMaterialFrame()
  }

  private telegraphMaterialPalette(
    color: number | undefined,
    bossAttack: boolean,
  ) {
    if (bossAttack) {
      const presentation = bossPresentation(this.bossLevel.bossId)
      return resolveHostileTelegraphPalette({
        family: presentation.colorFamily,
        actorColor: color ?? presentation.primaryColor,
        emphasis: 1,
      })
    }
    const actorColor = color ?? 0x8f3348
    const red = (actorColor >> 16) & 0xff
    const blue = actorColor & 0xff
    return resolveHostileTelegraphPalette({
      family: blue > red * 0.72 ? 'violet' : 'crimson',
      actorColor,
      emphasis: 0.18,
    })
  }

  private drawEffects() {
    this.beginGroundedVfxFrame()
    this.allocateHostileBoundaryParticleQuotas()
    this.drawWeaponEffects()
    this.loopGraphics.clear()
    for (let index = this.loopEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.loopEffects[index]
      if (effect.life <= 0) {
        this.loopEffects.splice(index, 1)
        continue
      }
      const alpha = clamp(effect.life / effect.total, 0, 1)
      if (effect.closed !== false) {
        const center = effect.points.reduce(
          (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
          { x: 0, y: 0 },
        )
        center.x /= Math.max(1, effect.points.length)
        center.y /= Math.max(1, effect.points.length)
        const extent = effect.points.reduce(
          (largest, point) =>
            Math.max(largest, Math.hypot(point.x - center.x, point.y - center.y)),
          24,
        )
        this.drawHeroPowerMaterialEvent({
          x: center.x,
          y: center.y,
          radius: extent,
          progress: 1 - alpha,
          stage: 'combined',
          seed: Math.round(center.x * 19 + center.y * 31),
          tint: effect.color,
          frame: HERO_MATERIAL_FRAME.dust,
          materialOpacity: 0.15,
        })
      } else if (effect.points.length > 1) {
        this.drawPolyline(
          this.loopGraphics,
          effect.points,
          effect.color,
          effect.width ?? 5,
          alpha * 0.9,
        )
      }
    }

    for (const telegraph of this.telegraphs) {
      if (!telegraph.active) continue
      const progress = clamp(1 - telegraph.life / telegraph.total, 0, 0.995)
      const stage: GroundedVfxStage = telegraph.bossAttack
        ? this.bossLevel.id >= 8
          ? 'final'
          : this.bossLevel.id >= 5
            ? 'mastered'
            : this.bossLevel.id >= 3
              ? 'combined'
              : 'solo'
        : 'solo'
      const seed =
        Math.round(telegraph.x * 17 + telegraph.y * 31) ^
        Math.round(telegraph.angle * 997) ^
        Math.round(telegraph.total * 10_007)
      const hostilePalette = this.telegraphMaterialPalette(
        telegraph.color,
        telegraph.bossAttack,
      )
      if (telegraph.kind === 'circle') {
        this.drawGroundedFieldMaterial(
          'hostile-field',
          telegraph.x,
          telegraph.y,
          telegraph.radius,
          progress,
          stage,
          seed,
          telegraph.bossAttack,
          telegraph.bossAttack ? 0.84 : 0.72,
          telegraph.bossAttack ? this.bossLevel.bossId : undefined,
          hostilePalette,
          telegraph.bossAttack,
          telegraph.specialAttack,
        )
      } else {
        const end = {
          x: telegraph.x + Math.cos(telegraph.angle) * telegraph.length,
          y: telegraph.y + Math.sin(telegraph.angle) * telegraph.length,
        }
        this.drawGroundedLaneMaterial(
          'hostile-lane',
          { x: telegraph.x, y: telegraph.y },
          end,
          telegraph.width,
          progress,
          stage,
          seed,
          telegraph.bossAttack,
          telegraph.bossAttack ? 0.86 : 0.74,
          telegraph.bossAttack ? this.bossLevel.bossId : undefined,
          hostilePalette,
          telegraph.bossAttack,
          telegraph.specialAttack,
        )
      }
    }
    for (const projectile of this.hostileProjectiles) {
      const pose = hostileProjectilePoseAt(projectile.state)
      if (!pose.destinationVisible) continue
      const { config } = projectile.state
      const impactAt = config.windupSeconds + config.flightSeconds
      const progress = clamp(
        projectile.state.elapsedSeconds / Math.max(0.01, impactAt),
        0,
        0.995,
      )
      const stage: GroundedVfxStage = config.boss
        ? this.bossLevel.id >= 8
          ? 'final'
          : this.bossLevel.id >= 5
            ? 'mastered'
            : this.bossLevel.id >= 3
              ? 'combined'
              : 'solo'
        : 'solo'
      this.drawGroundedFieldMaterial(
        'hostile-field',
        config.destination.x,
        config.destination.y,
        config.impactRadius,
        progress,
        stage,
        Number(config.id) * 7_919 + config.sourceUid * 131,
        config.boss,
        config.boss ? 0.92 : 0.78,
        config.boss ? this.bossLevel.bossId : undefined,
        projectile.palette,
        true,
        true,
      )
    }
    this.finishGroundedVfxFrame()

    for (let index = this.rings.length - 1; index >= 0; index -= 1) {
      const ring = this.rings[index]
      if (ring.life <= 0) {
        this.rings.splice(index, 1)
        continue
      }
      const progress = 1 - ring.life / ring.total
      const radius = lerp(ring.radius, ring.maxRadius, 1 - (1 - progress) ** 3)
      this.drawHeroPowerMaterialEvent({
        x: ring.x,
        y: ring.y,
        radius,
        progress,
        stage:
          ring.maxRadius >= 420
            ? 'final'
            : ring.maxRadius >= 150
              ? 'mastered'
              : 'solo',
        seed: Math.round(ring.x * 17 + ring.y * 29 + ring.maxRadius * 43),
        tint: ring.color,
        frame:
          ring.maxRadius >= 260
            ? HERO_MATERIAL_FRAME.gather
            : HERO_MATERIAL_FRAME.dust,
        materialOpacity: ring.maxRadius >= 260 ? 0.14 : 0.2,
      })
    }

    this.screenFlash.alpha = this.screenFlashAlpha
    const width = this.app.screen.width
    const height = this.app.screen.height
    const introAlpha = this.bossIntroTimer > 0 ? clamp(this.bossIntroTimer / 0.45, 0, 1) : 0
    const endProgress =
      this.endSequenceDuration > 0
        ? 1 - this.endSequenceTimer / this.endSequenceDuration
        : 0
    if (this.completed && this.endSequenceVictory !== undefined) {
      this.cinematicTitle.text = runEndingTitle(
        this.endSequenceVictory,
        endProgress,
      )
    }
    const endAlpha =
      this.completed && this.endSequenceTimer > 0
        ? Math.min(
            clamp(endProgress / 0.16, 0, 1),
            clamp(this.endSequenceTimer / 0.3, 0, 1),
          )
        : 0
    const cinematicAlpha = Math.max(introAlpha, endAlpha)
    this.cinematicGraphics.clear()
    if (cinematicAlpha > 0) {
      const barHeight = Math.min(endAlpha > 0 ? 126 : 92, height * (endAlpha > 0 ? 0.16 : 0.12))
      if (endAlpha > 0) {
        this.cinematicGraphics
          .rect(0, 0, width, height)
          .fill({ color: this.endSequenceVictory ? 0x07100f : 0x100308, alpha: endAlpha * 0.2 })
      }
      this.cinematicGraphics.rect(0, 0, width, barHeight).fill({ color: 0x010206, alpha: cinematicAlpha * 0.96 })
      this.cinematicGraphics
        .rect(0, height - barHeight, width, barHeight)
        .fill({ color: 0x010206, alpha: cinematicAlpha * 0.96 })
    }
    this.cinematicTitle.alpha = cinematicAlpha
  }

  private drawPlayerCombatReadability(
    collisionX: number,
    collisionY: number,
    heroX: number,
    heroY: number,
  ) {
    this.hitboxGraphics.clear()
    this.playerHitGraphics.clear()
    this.playerDamageVignette.clear()
    this.hero!.tint = 0xffffff

    if (this.showHitboxOverlay && this.runConfig.mode === 'combat-lab') {
      const bodyCenterY = collisionY + HERO_BODY_CENTER_OFFSET_Y
      this.hitboxGraphics
        .ellipse(
          collisionX,
          bodyCenterY,
          HERO_BODY_HALF_WIDTH,
          HERO_BODY_HALF_HEIGHT,
        )
        .fill({ color: 0x7fe9ff, alpha: 0.09 })
      for (let marker = 0; marker < 14; marker += 1) {
        const angle = (marker / 14) * Math.PI * 2
        this.hitboxGraphics
          .ellipse(
            collisionX + Math.cos(angle) * HERO_BODY_HALF_WIDTH,
            bodyCenterY + Math.sin(angle) * HERO_BODY_HALF_HEIGHT,
            1.45,
            0.9,
          )
          .fill({ color: 0xdffbff, alpha: 0.7 })
      }
    }

    const feedback = this.playerHitFeedback
    if (!feedback || this.playerHitFeedbackRemaining <= 0) return

    const progress = clamp(
      1 - this.playerHitFeedbackRemaining / feedback.duration,
      0,
      1,
    )
    const decay = (1 - progress) ** 1.65
    const reducedFlashScale = this.settings.reducedFlash ? 0.52 : 1
    const energy = feedback.intensity * decay * reducedFlashScale
    const sourceX = -feedback.directionX
    const sourceY = -feedback.directionY
    const impactX = heroX + sourceX * 17
    const impactY = heroY - 27 + sourceY * 10
    this.hero!.tint = heroDamageFlashTint(
      progress,
      feedback.intensity,
      this.settings.reducedFlash,
    )

    // A localized hostile seep and thrown cinders communicate the side and
    // character of the hit without drawing a ring, arrow, or solid outline.
    this.playerHitGraphics
      .ellipse(
        heroX + sourceX * 7,
        heroY - 19 + sourceY * 5,
        27 + feedback.intensity * 7,
        34 + feedback.intensity * 8,
      )
      .fill({
        color: feedback.color,
        alpha: energy * 0.055,
      })

    const cinderCount = this.visualLod === 'mobile'
      ? feedback.boss ? 6 : 4
      : feedback.boss ? 10 : 7
    const travelAngle = Math.atan2(feedback.directionY, feedback.directionX)
    for (let cinder = 0; cinder < cinderCount; cinder += 1) {
      const spread =
        (cinder - (cinderCount - 1) * 0.5) *
        (feedback.boss ? 0.13 : 0.17)
      const angle = travelAngle + spread
      const distance =
        4 +
        progress *
          (14 + cinder * (feedback.boss ? 2.6 : 2.1))
      const x = impactX + Math.cos(angle) * distance
      const y = impactY + Math.sin(angle) * distance
      const size = 1.15 + (cinder % 3) * 0.62 + feedback.intensity * 0.45
      const tangentX = Math.cos(angle) * size * 2.8
      const tangentY = Math.sin(angle) * size * 2.8
      const normalX = -Math.sin(angle) * size * 0.7
      const normalY = Math.cos(angle) * size * 0.7
      this.playerHitGraphics
        .poly(
          [
            x + tangentX,
            y + tangentY,
            x + normalX,
            y + normalY,
            x - tangentX * 0.72,
            y - tangentY * 0.72,
            x - normalX,
            y - normalY,
          ],
          true,
        )
        .fill({
          color: cinder % 3 === 0 ? 0xf3eee4 : feedback.color,
          alpha: energy * (0.3 + (cinder % 2) * 0.12),
        })
    }

    const sparkAngle = travelAngle + Math.PI * 0.5
    const sparkX = Math.cos(sparkAngle)
    const sparkY = Math.sin(sparkAngle)
    this.playerHitGraphics
      .poly(
        [
          impactX + sparkX * 7,
          impactY + sparkY * 7,
          impactX + feedback.directionX * 2,
          impactY + feedback.directionY * 2,
          impactX - sparkX * 7,
          impactY - sparkY * 7,
          impactX - feedback.directionX * 2,
          impactY - feedback.directionY * 2,
        ],
        true,
      )
      .fill({ color: 0xf8f4e9, alpha: energy * 0.72 })

    // The vignette is an off-screen organic bloom on the incoming side. It is
    // intentionally asymmetric and soft, so it reads as direction rather than
    // a UI arrow or geometric warning.
    const width = this.app.screen.width
    const height = this.app.screen.height
    if (Math.abs(sourceX) >= Math.abs(sourceY)) {
      const edgeX = sourceX < 0 ? -width * 0.08 : width * 1.08
      const centerY = height * (0.5 + sourceY * 0.18)
      this.playerDamageVignette
        .ellipse(edgeX, centerY, width * 0.25, height * 0.68)
        .fill({ color: feedback.color, alpha: energy * 0.065 })
      this.playerDamageVignette
        .ellipse(edgeX, centerY, width * 0.13, height * 0.48)
        .fill({ color: 0x18040c, alpha: energy * 0.1 })
    } else {
      const edgeY = sourceY < 0 ? -height * 0.1 : height * 1.1
      const centerX = width * (0.5 + sourceX * 0.2)
      this.playerDamageVignette
        .ellipse(centerX, edgeY, width * 0.7, height * 0.28)
        .fill({ color: feedback.color, alpha: energy * 0.06 })
      this.playerDamageVignette
        .ellipse(centerX, edgeY, width * 0.48, height * 0.14)
        .fill({ color: 0x18040c, alpha: energy * 0.1 })
    }
  }

  private drawJoystick() {
    this.joystickGraphics.clear()
    const stick = this.input?.getStickState()
    if (!stick?.active) return
    this.joystickGraphics
      .circle(stick.origin.x, stick.origin.y, stick.radius)
      .fill({ color: 0x07121c, alpha: 0.34 })
      .stroke({ color: 0x8ef8df, width: 2, alpha: 0.34 })
    this.joystickGraphics
      .circle(stick.current.x, stick.current.y, 25)
      .fill({ color: 0xcffff2, alpha: 0.3 })
      .stroke({ color: 0xffdf87, width: 2, alpha: 0.68 })
  }

  private advanceMotion(delta: number) {
    this.motionClock += delta
    this.heroFireElapsed = Math.min(HERO_FIRE_DURATION, this.heroFireElapsed + delta)
    this.heroAttackRemaining = Math.max(0, this.heroAttackRemaining - delta)
    this.heroHurtRemaining = Math.max(0, this.heroHurtRemaining - delta)
    for (const enemy of this.enemies) {
      enemy.hitMotionRemaining = Math.max(0, enemy.hitMotionRemaining - delta)
      if (enemy.deathMotionRemaining > 0) {
        enemy.deathMotionRemaining = Math.max(0, enemy.deathMotionRemaining - delta)
        if (enemy.deathMotionRemaining <= 0) {
          enemy.sprite.visible = false
          enemy.sprite.alpha = 1
        }
        continue
      }
      if (!enemy.active) continue
      enemy.attackMotionRemaining = Math.max(0, enemy.attackMotionRemaining - delta)
      if (enemy.attackMotionRemaining <= 0) enemy.attackMotionStyle = 'none'
    }
  }

  private prepareHeroShot(cooldown: number) {
    const actionOwnsPose =
      this.heroAttackRemaining > 0 &&
      (this.heroAttackStyle === 'hero-pulse' || this.heroAttackStyle === 'hero-cast')
    if (actionOwnsPose) return
    const target = this.nearestEnemy(this.player.x, this.player.y)
    if (!target) return

    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x)
    this.heroFacing = { x: Math.cos(angle), y: Math.sin(angle) }
    const preparedElapsed = clamp(
      HERO_FIRE_RELEASE_TIME - cooldown,
      0,
      HERO_FIRE_RELEASE_TIME,
    )
    if (this.heroFireElapsed >= HERO_FIRE_DURATION) {
      this.heroFireElapsed = preparedElapsed
    } else if (this.heroFireElapsed < HERO_FIRE_RELEASE_TIME) {
      this.heroFireElapsed = Math.max(this.heroFireElapsed, preparedElapsed)
    }
  }

  private triggerHeroAttack(style: AttackMotionStyle, duration: number, angle: number) {
    const currentIsPulse =
      this.heroAttackStyle === 'hero-pulse' && this.heroAttackRemaining > 0
    if (currentIsPulse && style !== 'hero-pulse') return
    const currentIsCast =
      this.heroAttackStyle === 'hero-cast' && this.heroAttackRemaining > 0
    if (currentIsCast && style === 'hero-shot') return
    this.heroAttackStyle = style
    this.heroAttackDuration = duration
    this.heroAttackRemaining = duration
    this.heroAttackAngle = angle
    if (style === 'hero-shot') {
      this.heroFacing = { x: Math.cos(angle), y: Math.sin(angle) }
      this.heroFireElapsed = HERO_FIRE_RELEASE_TIME
      const dischargeTexture = this.heroFireFrames[3]
      if (this.hero && dischargeTexture) this.hero.texture = dischargeTexture
    } else if (style === 'hero-pulse' || style === 'hero-cast') {
      this.heroFireElapsed = HERO_FIRE_DURATION
      const crestTexture = this.heroChargeFrames[5]
      if (this.hero && crestTexture) this.hero.texture = crestTexture
    }
    if (
      this.hero &&
      (style === 'hero-pulse' || this.motionClock - this.lastHeroEchoAt >= 0.12)
    ) {
      this.lastHeroEchoAt = this.motionClock
      const isEnergyAction = style === 'hero-pulse' || style === 'hero-cast'
      const drift = isEnergyAction ? 0 : 22
      this.spawnMotionEcho(
        this.hero,
        this.player.x,
        this.player.y,
        isEnergyAction ? 0xffdf83 : 0x9dfbf0,
        style === 'hero-pulse' ? 0.38 : isEnergyAction ? 0.3 : 0.22,
        -Math.cos(angle) * drift,
        -Math.sin(angle) * drift,
        style === 'hero-pulse' ? 0.28 : isEnergyAction ? 0.22 : 0.16,
      )
    }
  }

  private triggerEnemyAttack(
    enemy: EnemyEntity,
    style: AttackMotionStyle,
    duration: number,
    angle: number,
    emphasized = false,
  ) {
    const priority = (candidate: AttackMotionStyle) => {
      if (candidate === 'boss-phase') return 5
      if (candidate === 'boss-intro') return 4
      if (candidate.startsWith('boss-')) return 3
      if (candidate === 'cast' || candidate === 'charge' || candidate === 'blink' || candidate === 'slam') return 2
      if (candidate === 'melee') return 1
      return 0
    }
    if (
      enemy.attackMotionRemaining > 0 &&
      priority(enemy.attackMotionStyle) > priority(style)
    ) {
      return
    }
    enemy.attackMotionStyle = style
    enemy.attackMotionDuration = duration
    enemy.attackMotionRemaining = duration
    enemy.attackMotionAngle = angle
    if (Math.abs(Math.cos(angle)) > 0.1) enemy.facing = Math.cos(angle) >= 0 ? 1 : -1

    if (
      emphasized ||
      style === 'blink' ||
      style === 'charge' ||
      (style === 'melee' && enemy.id === 'shardwing')
    ) {
      const drift = style === 'charge' || style === 'melee' ? 34 : 10
      this.spawnMotionEcho(
        enemy.sprite,
        enemy.x,
        enemy.y,
        this.actorAccentColor(enemy),
        enemy.isBoss ? 0.42 : 0.25,
        -Math.cos(angle) * drift,
        -Math.sin(angle) * drift,
        enemy.isBoss ? 0.28 : 0.17,
      )
      if (enemy.isBoss && style.startsWith('boss-') && style !== 'boss-intro') {
        const normalX = -Math.sin(angle)
        const normalY = Math.cos(angle)
        for (const side of [-1, 1]) {
          this.spawnMotionEcho(
            enemy.sprite,
            enemy.x,
            enemy.y,
            bossPresentation(this.bossLevel.bossId).secondaryColor,
            0.34,
            -Math.cos(angle) * 24 + normalX * side * 18,
            -Math.sin(angle) * 24 + normalY * side * 18,
            0.14,
          )
        }
      }
    }
  }

  private spawnMotionEcho(
    source: Sprite,
    x: number,
    y: number,
    color: number,
    duration: number,
    driftX: number,
    driftY: number,
    alpha: number,
  ) {
    let echo = this.motionEchoes.find((candidate) => !candidate.active)
    if (!echo) {
      if (this.motionEchoes.length >= 96) {
        echo = this.motionEchoes.reduce((shortest, candidate) =>
          candidate.life < shortest.life ? candidate : shortest,
        )
      } else {
        const sprite = new Sprite(source.texture)
        sprite.visible = false
        sprite.blendMode = 'add'
        this.motionEchoLayer.addChild(sprite)
        echo = {
          active: false,
          x: 0,
          y: 0,
          driftX: 0,
          driftY: 0,
          life: 0,
          total: 0,
          baseAlpha: 0,
          baseScaleX: 1,
          baseScaleY: 1,
          rotation: 0,
          sprite,
        }
        this.motionEchoes.push(echo)
      }
    }

    echo.active = true
    echo.x = x
    echo.y = y
    echo.driftX = driftX
    echo.driftY = driftY
    echo.life = duration
    echo.total = duration
    echo.baseAlpha = this.settings.reducedFlash ? alpha * 0.42 : alpha
    echo.baseScaleX = source.scale.x
    echo.baseScaleY = source.scale.y
    echo.rotation = source.rotation
    echo.sprite.texture = source.texture
    echo.sprite.anchor.set(source.anchor.x, source.anchor.y)
    echo.sprite.position.set(x, y)
    echo.sprite.scale.set(echo.baseScaleX, echo.baseScaleY)
    echo.sprite.rotation = echo.rotation
    echo.sprite.tint = color
    echo.sprite.alpha = echo.baseAlpha
    echo.sprite.visible = true
  }

  private actorAccentColor(enemy: EnemyEntity) {
    if (enemy.isBoss) return bossPresentation(this.bossLevel.bossId).primaryColor
    return enemyPresentation(enemy.id).primaryColor
  }

  private drawEnemyMotionAccent(
    enemy: EnemyEntity,
    x: number,
    y: number,
    pose: MotionPose,
    moving: number,
    attackProgress: number,
    activeHordeCount: number,
  ) {
    const accent = this.actorAccentColor(enemy)
    const bossProfile = enemy.isBoss
      ? bossPresentation(this.bossLevel.bossId)
      : undefined
    const hordeProfile = enemy.isBoss ? undefined : enemyPresentation(enemy.id)
    const secondary = bossProfile?.secondaryColor ?? hordeProfile?.secondaryColor ?? accent
    const prominence = bossProfile?.bossProminence ?? hordeProfile?.hordeProminence ?? 0.5
    const aerial =
      enemy.id === 'shardwing' ||
      enemy.id === 'cantor' ||
      enemy.id === 'chronowisp'
    const lift = clamp(
      Math.max(0, -pose.offsetY) / (enemy.isBoss ? 54 : 24),
      0,
      0.58,
    )
    const shadowWidth =
      enemy.radius * (enemy.isBoss ? 1.18 : aerial ? 0.72 : 0.92) * (1 - lift * 0.34)
    const shadowHeight =
      enemy.radius * (enemy.isBoss ? 0.3 : aerial ? 0.17 : 0.23) * (1 - lift * 0.24)

    this.motionGraphics
      .ellipse(x, y + enemy.radius * (enemy.isBoss ? 0.58 : 0.52), shadowWidth, shadowHeight)
      .fill({
        color: bossProfile?.shadowColor ?? HOSTILE_SHADOW_COLOR,
        alpha: enemy.isBoss ? 0.32 : aerial ? 0.16 : 0.22,
      })

    if (
      !enemy.isBoss &&
      !this.settings.reducedShake &&
      attackProgress < 0 &&
      moving > 0.38 &&
      (
        enemy.isBoss ||
        activeHordeCount <= 120 ||
        enemy.uid % (activeHordeCount > 240 ? 3 : 2) === 0
      )
    ) {
      const gaitSpeed = aerial ? 11.6 : enemy.id === 'railjaw' ? 6.1 : 7.8
      const stride = Math.sin(this.motionClock * gaitSpeed + enemy.uid * 1.173)
      const footfall = clamp((Math.abs(stride) - 0.72) / 0.28, 0, 1)
      if (footfall > 0.02) {
        const travelAngle = Math.atan2(enemy.vy, enemy.vx)
        const backX = -Math.cos(travelAngle)
        const backY = -Math.sin(travelAngle)
        const sideX = -Math.sin(travelAngle)
        const sideY = Math.cos(travelAngle)
        const trailX = x + backX * enemy.radius * 0.58
        const trailY = y + backY * enemy.radius * 0.58 + enemy.radius * 0.36
        const side = (stride >= 0 ? 1 : -1) * enemy.radius * 0.24

        if (aerial) {
          this.motionGraphics
            .ellipse(
              trailX + backX * enemy.radius * 0.28 + sideX * side,
              trailY + backY * enemy.radius * 0.28 + sideY * side,
              enemy.radius * 0.34,
              enemy.radius * 0.07,
            )
            .fill({
              color: HOSTILE_SHADOW_COLOR,
              alpha: footfall * 0.12 * prominence,
            })
        } else {
          this.motionGraphics
            .ellipse(
              trailX + sideX * side,
              trailY + sideY * side,
              enemy.radius * 0.22,
              enemy.radius * 0.08,
            )
            .fill({
              color: secondary,
              alpha: footfall * 0.09 * prominence,
            })
        }
      }
    }

    if (attackProgress < 0) return

    const progress = clamp(attackProgress, 0, 1)
    const impactAt = enemy.isBoss
      ? bossImpactProgress(Math.max(0.05, enemy.attackMotionDuration - 0.24))
      : enemy.attackMotionStyle === 'cast'
        ? 0.58
        : enemy.attackMotionStyle === 'slam'
          ? 0.62
          : 0.5
    const envelope = sampleHostileEnvelope({
      progress,
      impactProgress: impactAt,
      reducedFlash: this.settings.reducedFlash,
      reducedFlashScale:
        bossProfile?.reducedFlashScale ?? hordeProfile?.reducedFlashScale ?? 0.44,
    })
    const pulse = Math.max(
      envelope.gather * 0.48,
      envelope.release,
      envelope.impact,
    )
    const angle = enemy.attackMotionAngle
    const forwardX = Math.cos(angle)
    const forwardY = Math.sin(angle)
    const sideX = -forwardY
    const sideY = forwardX
    const directional =
      enemy.attackMotionStyle === 'melee' ||
      enemy.attackMotionStyle === 'charge' ||
      enemy.attackMotionStyle === 'boss-line'

    if (bossProfile) {
      const groundY = y + enemy.radius * 0.48
      const pressure =
        enemy.radius *
        (0.92 + envelope.gather * 0.16 + envelope.impact * 0.28)
      this.motionGraphics
        .ellipse(x, groundY, pressure, pressure * 0.27)
        .fill({
          color: bossProfile.shadowColor,
          alpha: 0.18 + envelope.gather * 0.08 + envelope.impact * 0.1,
        })
      this.motionGraphics
        .ellipse(
          x + forwardX * enemy.radius * envelope.release * 0.22,
          groundY + forwardY * enemy.radius * envelope.release * 0.12,
          pressure * (0.58 + envelope.release * 0.16),
          pressure * (0.13 + envelope.impact * 0.05),
        )
        .fill({
          color: 0x584b49,
          alpha:
            (0.035 + envelope.release * 0.065 + envelope.impact * 0.075) *
            (this.settings.reducedFlash ? 0.62 : 1),
        })
      const moteCount = this.visualLod === 'mobile' ? 3 : 6
      for (let mote = 0; mote < moteCount; mote += 1) {
        const moteAngle =
          angle +
          groundedVfxCosmeticUnit(enemy.uid, mote, 61) * Math.PI * 2
        const moteDistance =
          pressure *
          (0.24 + groundedVfxCosmeticUnit(enemy.uid, mote, 67) * 0.72)
        const moteSize =
          enemy.radius *
          (0.026 + groundedVfxCosmeticUnit(enemy.uid, mote, 71) * 0.05)
        this.motionGraphics
          .ellipse(
            x + Math.cos(moteAngle) * moteDistance,
            groundY + Math.sin(moteAngle) * moteDistance * 0.32,
            moteSize * 1.5,
            moteSize * 0.58,
          )
          .fill({
            color: mote % 3 === 0 ? 0x78665f : 0x332d2e,
            alpha:
              (0.025 + pulse * 0.065) *
              (this.settings.reducedFlash ? 0.62 : 1),
          })
      }
      return
    }

    if (directional) {
      const reach = enemy.radius * (
        0.72 +
        envelope.release * 1.05 +
        envelope.impact * 0.34
      )
      const halfWidth = enemy.radius * (
        0.22 +
        envelope.gather * 0.18 +
        envelope.release * 0.2
      )
      const centerX = x + forwardX * reach
      const centerY = y + forwardY * reach
      const smearCount = this.visualLod === 'mobile' ? 2 : 3
      for (let smear = 0; smear < smearCount; smear += 1) {
        const t = (smear + 1) / (smearCount + 1)
        const jitter =
          (groundedVfxCosmeticUnit(enemy.uid, smear, 151) - 0.5) *
          halfWidth *
          0.72
        this.motionGraphics
          .ellipse(
            lerp(x, centerX, t) + sideX * jitter,
            lerp(y + enemy.radius * 0.24, centerY, t) + sideY * jitter,
            enemy.radius * (0.2 + t * 0.22),
            enemy.radius * (0.055 + envelope.impact * 0.035),
          )
          .fill({
            color: smear % 2 === 0 ? HOSTILE_SHADOW_COLOR : secondary,
            alpha:
              (0.03 + envelope.release * 0.09 + envelope.impact * 0.11) *
              prominence,
          })
      }
      if (envelope.impact > 0.1) {
        const impactSize =
          enemy.radius * (0.1 + envelope.impact * 0.18)
        this.motionGraphics
          .ellipse(
            centerX + forwardX * enemy.radius * 0.22,
            centerY + forwardY * enemy.radius * 0.12,
            impactSize * 1.5,
            impactSize * 0.5,
          )
          .fill({
            color: hordeProfile?.impactColor ?? HOSTILE_IMPACT_COLOR,
            alpha: envelope.flashScale * 0.14,
          })
      }
      return
    }

    const pressureRadius = enemy.radius * (
      1.34 -
      envelope.gather * 0.38 +
      envelope.release * 0.26 +
      envelope.impact * (enemy.isBoss ? 0.72 : 0.36)
    )
    this.motionGraphics
      .ellipse(
        x,
        y + enemy.radius * 0.24,
        pressureRadius,
        pressureRadius * (enemy.isBoss ? 0.34 : 0.28),
      )
      .fill({
        color: hordeProfile?.shadowColor ?? HOSTILE_SHADOW_COLOR,
        alpha: (0.04 + envelope.gather * 0.07 + envelope.impact * 0.12) *
          prominence,
      })
    const disturbedGrit = enemy.isBoss ? 7 : 3
    for (let grit = 0; grit < disturbedGrit; grit += 1) {
      const angle =
        enemy.attackMotionAngle +
        (replacementCosmeticUnit(enemy.uid, grit, 109) - 0.5) * 2.6
      const distance =
        pressureRadius *
        (0.22 + replacementCosmeticUnit(enemy.uid, grit, 113) * 0.72)
      const size =
        enemy.radius *
        (0.035 + replacementCosmeticUnit(enemy.uid, grit, 127) * 0.045)
      this.motionGraphics
        .ellipse(
          x + Math.cos(angle) * distance,
          y + enemy.radius * 0.18 + Math.sin(angle) * distance * 0.38,
          size * 1.8,
          size * 0.62,
        )
        .fill({
          color: grit % 3 === 0 ? secondary : HOSTILE_SHADOW_COLOR,
          alpha:
            (envelope.release * 0.1 + envelope.impact * 0.18) *
            prominence,
        })
    }
  }

  private projectileDimensions(weaponId: WeaponId): [number, number] {
    return {
      'helio-lance': [54, 18],
      'crescent-array': [38, 30],
      'arc-choir': [38, 20],
      'rift-seeds': [31, 31],
      'comet-swarm': [38, 22],
      'ash-halo': [34, 20],
      'mirror-bow': [42, 29],
      'null-bell': [30, 32],
    }[weaponId] as [number, number]
  }

  private drawCombatLabProjectileSignature(
    projectile: ProjectileEntity,
    x: number,
    y: number,
    dx: number,
    dy: number,
    normalX: number,
    normalY: number,
    length: number,
    width: number,
    profile: WeaponVfxProfile,
  ) {
    const presentation = this.combatLabRuntimeVfx(
      projectile.weaponId,
      projectile.visualState,
    )
    if (!presentation.enabled) return

    const graphics = this.projectileTrailGraphics
    const phase =
      this.motionClock * (2.2 + presentation.rank * 0.14) +
      projectile.visualSeed * 0.19
    const energy =
      presentation.energyScale * (this.settings.reducedFlash ? 0.72 : 1)
    const geometryScale = presentation.geometryScale
    const startX = x - dx * length
    const startY = y - dy * length

    switch (presentation.motif) {
      case 'solar-filaments': {
        // The normal projectile trail below already matches the v1.16.3
        // authored scale. Do not inflate it with rank-dependent lanes or a
        // large awakened crown.
        break
      }
      case 'lunar-petals': {
        // Authored moonblades shed a compact wake instead of a drawn trail:
        // cold lunar haze, a bone-white core and the occasional violet shard.
        // Keep the per-blade budget deliberately small because high ranks can
        // launch ten crescents at once (and overlapping casts can briefly
        // exceed that).
        const isMobile = this.visualLod === 'mobile'
        const rankedMoteBudget = isMobile
          ? presentation.rank >= 5 || presentation.awakened
            ? 3
            : 2
          : presentation.rank >= 5 || presentation.awakened
            ? 4
            : presentation.rank >= 3
              ? 3
              : 2
        const activeCrescentBlades = this.projectiles.reduce(
          (count, candidate) =>
            count + Number(candidate.active && candidate.weaponId === 'crescent-array'),
          0,
        )
        const crowdedMoteCap = activeCrescentBlades >= 12
          ? 2
          : activeCrescentBlades >= 8
            ? isMobile
              ? 2
              : 3
            : rankedMoteBudget
        const motes = Math.min(rankedMoteBudget, crowdedMoteCap)
        const maxReach = (isMobile ? 16 : 22) * geometryScale
        const maxLateralDrift = 2.5 * geometryScale

        for (let mote = 0; mote < motes; mote += 1) {
          const t = (mote + 1) / (motes + 0.4)
          const distance = maxReach * (0.22 + t * 0.72)
          const lateralDrift =
            Math.sin(phase * 1.14 + mote * 2.37) *
            maxLateralDrift *
            (0.72 + t * 0.28)
          const moteX = x - dx * distance + normalX * lateralDrift
          const moteY = y - dy * distance + normalY * lateralDrift
          const fade = 1 - t * 0.48
          const moteSize = (0.72 + (1 - t) * 0.52) * geometryScale
          const cyanHazeAlpha = Math.min(
            0.14,
            (0.085 + (mote % 2) * 0.018) * energy * fade,
          )
          const violetHazeAlpha = Math.min(
            0.12,
            (0.075 + ((mote + 1) % 2) * 0.016) * energy * fade,
          )
          const coreAlpha =
            Math.min(0.52, (0.38 + presentation.rank * 0.022) * energy) *
            (0.76 + fade * 0.24)

          graphics
            .ellipse(moteX, moteY, moteSize * 3.1, moteSize * 1.55)
            .fill({ color: profile.glowColor, alpha: cyanHazeAlpha })
          graphics
            .ellipse(
              moteX + normalX * moteSize * 0.42,
              moteY + normalY * moteSize * 0.42,
              moteSize * 2.15,
              moteSize,
            )
            .fill({ color: profile.secondaryColor, alpha: violetHazeAlpha })
          graphics
            .poly(
              [
                moteX + dx * moteSize * 1.9,
                moteY + dy * moteSize * 1.9,
                moteX + normalX * moteSize * 0.5,
                moteY + normalY * moteSize * 0.5,
                moteX - dx * moteSize * 1.35,
                moteY - dy * moteSize * 1.35,
                moteX - normalX * moteSize * 0.5,
                moteY - normalY * moteSize * 0.5,
              ],
              true,
            )
            .fill({ color: profile.coreColor, alpha: coreAlpha })

          if (
            (presentation.awakened || presentation.rank >= 3) &&
            mote === motes - 1
          ) {
            const shardX = moteX - dx * moteSize * 2.8 - normalX * lateralDrift * 0.35
            const shardY = moteY - dy * moteSize * 2.8 - normalY * lateralDrift * 0.35
            graphics
              .poly(
                [
                  shardX + dx * moteSize * 1.35,
                  shardY + dy * moteSize * 1.35,
                  shardX + normalX * moteSize * 0.42,
                  shardY + normalY * moteSize * 0.42,
                  shardX - dx * moteSize,
                  shardY - dy * moteSize,
                  shardX - normalX * moteSize * 0.42,
                  shardY - normalY * moteSize * 0.42,
                ],
                true,
              )
              .fill({
                color: profile.secondaryColor,
                alpha: Math.min(0.34, 0.2 * energy * fade),
              })
          }
        }

        const glintPulse = 0.72 + Math.sin(phase * 1.28) * 0.28
        const glintSize =
          (1.7 + Math.min(5, presentation.rank) * 0.12) * geometryScale
        graphics
          .ellipse(x, y, glintSize * 3.2, glintSize * 1.55)
          .fill({
            color: profile.glowColor,
            alpha: Math.min(0.14, 0.095 * energy * glintPulse),
          })
        graphics
          .poly(
            [
              x + dx * glintSize * 2.1,
              y + dy * glintSize * 2.1,
              x + normalX * glintSize * 0.62,
              y + normalY * glintSize * 0.62,
              x - dx * glintSize * 1.45,
              y - dy * glintSize * 1.45,
              x - normalX * glintSize * 0.62,
              y - normalY * glintSize * 0.62,
            ],
            true,
          )
          .fill({
            color: profile.coreColor,
            alpha: Math.min(0.56, 0.44 * energy * glintPulse),
          })
        break
      }
      case 'cathedral-branches': {
        for (let branch = 0; branch < presentation.laneCount; branch += 1) {
          const side = branch % 2 ? 1 : -1
          const t = 0.25 + branch * 0.12
          const branchX = lerp(startX, x, Math.min(0.82, t))
          const branchY = lerp(startY, y, Math.min(0.82, t))
          this.drawPolyline(
            graphics,
            [
              { x: branchX, y: branchY },
              {
                x: branchX - dx * (10 + presentation.rank * 2) * geometryScale + normalX * side * 9 * geometryScale,
                y: branchY - dy * (10 + presentation.rank * 2) * geometryScale + normalY * side * 9 * geometryScale,
              },
            ],
            branch % 2 ? profile.secondaryColor : profile.glowColor,
            (0.8 + presentation.rank * 0.16) * geometryScale,
            0.38 * energy,
          )
        }
        break
      }
      case 'astral-verdict': {
        // Astral Verdict is authored as a textured sky-strike sequence. It
        // never falls back to generated branch lines, which read as UI rather
        // than physical storm material.
        break
      }
      case 'plasma-embers': {
        const embers = Math.min(8, presentation.ornamentCount + 1)
        for (let ember = 0; ember < embers; ember += 1) {
          const t = (ember + 1) / (embers + 1)
          const turbulence =
            Math.sin(phase * 1.8 + ember * 2.37) *
            (4 + presentation.rank) *
            geometryScale
          graphics
            .ellipse(
              lerp(x, startX, t) + normalX * turbulence,
              lerp(y, startY, t) + normalY * turbulence,
              (1.2 + (1 - t) * 2.1 + presentation.rank * 0.16) * geometryScale,
              (0.7 + (1 - t) * 0.8) * geometryScale,
            )
            .fill({
              color: ember % 2 ? profile.secondaryColor : profile.accentColor,
              alpha: (0.22 + (1 - t) * 0.38) * energy,
            })
        }
        break
      }
      default:
        break
    }
  }

  private drawProjectileTrail(projectile: ProjectileEntity, x: number, y: number) {
    const speed = Math.hypot(projectile.vx, projectile.vy)
    if (speed < 1) return
    const dx = projectile.vx / speed
    const dy = projectile.vy / speed
    const normalX = -dy
    const normalY = dx
    const baseTrail = {
      'helio-lance': [64, 3.2],
      'crescent-array': [25, 4.2],
      'arc-choir': [36, 3.5],
      'rift-seeds': [13, 5.4],
      'comet-swarm': [48, 4],
      'ash-halo': [16, 4],
      'mirror-bow': [38, 5.4],
      'null-bell': [20, 5],
    }[projectile.weaponId]
    const profile = this.weaponPresentationProfile(
      projectile.weaponId,
      projectile.visualState,
    )
    const stage = this.vfxStageIndex(projectile.visualState.stage)
    const length = baseTrail[0] * profile.trailLengthScale
    const width = baseTrail[1] * profile.trailWidthScale
    const startX = x - dx * length
    const startY = y - dy * length
    const graphics = this.projectileTrailGraphics

    this.drawCombatLabProjectileSignature(
      projectile,
      x,
      y,
      dx,
      dy,
      normalX,
      normalY,
      length,
      width,
      profile,
    )

    if (
      projectile.weaponId === 'crescent-array' &&
      this.crescentMoonbladeFrames.length > 0
    ) {
      return
    }

    if (projectile.weaponId === 'rift-seeds') {
      const pulse = 1 + Math.sin(this.motionClock * 8 + projectile.visualSeed) * 0.08
      const coreRadius = (9 + stage * 1.8) * pulse
      graphics
        .circle(x, y, coreRadius)
        .fill({ color: 0x010609, alpha: 0.94 })
      const debrisCount = 2 + stage
      for (let debris = 0; debris < debrisCount; debris += 1) {
        const angle =
          this.motionClock * (0.7 + debris * 0.09) +
          projectile.visualSeed * 0.17 +
          replacementCosmeticUnit(projectile.visualSeed, debris, 97) * Math.PI * 2
        const distance =
          coreRadius *
          (1.1 + replacementCosmeticUnit(projectile.visualSeed, debris, 101) * 1.2)
        graphics
          .ellipse(
            x + Math.cos(angle) * distance,
            y + Math.sin(angle) * distance * 0.64,
            1.4 + stage * 0.34,
            0.8 + stage * 0.16,
          )
          .fill({
            color: debris % 2 ? profile.secondaryColor : profile.accentColor,
            alpha: 0.34,
          })
      }
      return
    }

    const trailPoints: Vec2[] = []
    const pointCount =
      projectile.weaponId === 'comet-swarm' || projectile.weaponId === 'crescent-array'
        ? 7
        : 2
    for (let index = 0; index < pointCount; index += 1) {
      const t = index / Math.max(1, pointCount - 1)
      const curve =
        pointCount > 2
          ? Math.sin(t * Math.PI) *
            (projectile.weaponId === 'comet-swarm' ? 5 + stage * 1.8 : 3 + stage)
          : 0
      const direction = projectile.visualSeed % 2 ? 1 : -1
      trailPoints.push({
        x: lerp(startX, x, t) + normalX * curve * direction,
        y: lerp(startY, y, t) + normalY * curve * direction,
      })
    }
    this.drawPolyline(graphics, trailPoints, profile.glowColor, width * 4.4, 0.095)
    this.drawPolyline(graphics, trailPoints, profile.accentColor, width * 2.1, 0.34)
    this.drawPolyline(graphics, trailPoints, profile.coreColor, width, 0.88)

    if (projectile.weaponId === 'helio-lance') {
      return
    }

    if (projectile.weaponId === 'crescent-array') {
      return
    }

    if (projectile.weaponId === 'arc-choir') {
      const lightning = this.buildLightningPoints(
        [
          { x: startX, y: startY },
          { x, y },
        ],
        projectile.visualSeed,
        clamp(1 - projectile.life / projectile.totalLife, 0, 1),
      )
      this.drawPolyline(graphics, lightning, profile.coreColor, 1.5 + stage * 0.2, 0.9)
      return
    }

    if (projectile.weaponId === 'comet-swarm') {
      const embers = 2 + stage
      for (let index = 1; index <= embers; index += 1) {
        const t = index / (embers + 1)
        const emberX = lerp(x, startX, t)
        const emberY = lerp(y, startY, t)
        this.projectileTrailGraphics
          .circle(emberX, emberY, 3.1 - t * 1.6 + stage * 0.22)
          .fill({
            color: index % 2 ? profile.secondaryColor : profile.accentColor,
            alpha: 0.52 - t * 0.22,
          })
      }
      return
    }

    if (projectile.weaponId === 'ash-halo') {
      return
    }

    if (projectile.weaponId === 'null-bell') {
      return
    }
  }

  private createVfxTextures() {
    const create = (weaponId: WeaponId, draw: (graphics: Graphics, color: number) => void) => {
      const graphics = new Graphics()
      draw(graphics, WEAPONS[weaponId].color)
      const texture = this.app.renderer.generateTexture({
        target: graphics,
        resolution: this.visualProfile.generatedTextureResolution,
        antialias: this.visualProfile.rendererAntialias,
      })
      this.projectileTextures.set(weaponId, texture)
      graphics.destroy()
    }

    create('helio-lance', (graphics, color) => {
      graphics.poly([0, 14, 46, 1, 78, 14, 46, 27], true).fill({ color, alpha: 0.22 })
      graphics.poly([9, 14, 49, 7, 78, 14, 49, 21], true).fill({ color: 0xffd15f, alpha: 0.7 })
      graphics.poly([16, 14, 55, 10, 78, 14, 55, 18], true).fill({ color: 0xfff9dc, alpha: 0.98 })
      graphics.poly([28, 5, 43, 9, 36, 14, 43, 19, 28, 23, 34, 14], true).fill({ color: 0x76f5df, alpha: 0.68 })
    })
    create('crescent-array', (graphics, color) => {
      graphics
        .moveTo(5, 22)
        .quadraticCurveTo(30, -7, 55, 22)
        .stroke({ color, width: 13, alpha: 0.16, cap: 'round' })
      graphics
        .moveTo(5, 22)
        .quadraticCurveTo(30, -7, 55, 22)
        .stroke({ color, width: 6.5, alpha: 0.78, cap: 'round' })
      graphics
        .moveTo(5, 22)
        .quadraticCurveTo(30, -7, 55, 22)
        .stroke({ color: 0xf2ffff, width: 2, alpha: 0.96, cap: 'round' })
      graphics.circle(30, 5, 2.4).fill({ color: 0xb18cff, alpha: 0.72 })
    })
    create('arc-choir', (graphics, color) => {
      graphics
        .poly([0, 14, 15, 5, 25, 11, 39, 2, 34, 13, 58, 18, 38, 22, 24, 16], true)
        .fill({ color, alpha: 0.46 })
      graphics
        .poly([4, 14, 18, 9, 25, 13, 38, 7, 34, 15, 52, 17, 37, 19, 24, 15], true)
        .fill({ color: 0xfaf4ff, alpha: 0.9 })
    })
    create('rift-seeds', (graphics, color) => {
      graphics.circle(19, 19, 15).fill({ color: 0x010708, alpha: 0.98 })
      graphics.ellipse(15, 12, 5, 3).fill({ color, alpha: 0.74 })
      graphics.ellipse(25, 25, 3.5, 2).fill({ color: 0x9276ff, alpha: 0.56 })
    })
    create('comet-swarm', (graphics, color) => {
      graphics.poly([0, 16, 31, 3, 52, 16, 31, 29], true).fill({ color, alpha: 0.28 })
      graphics.poly([6, 16, 34, 8, 50, 16, 34, 24], true).fill({ color: 0xf58a28, alpha: 0.72 })
      graphics.ellipse(43, 16, 12, 10).fill({ color, alpha: 0.9 })
      graphics.ellipse(46, 13, 6, 5).fill({ color: 0xffc166, alpha: 0.98 })
    })
    create('ash-halo', (graphics, color) => {
      graphics
        .poly([0, 14, 14, 3, 34, 7, 48, 14, 34, 21, 14, 25], true)
        .fill({ color, alpha: 0.28 })
      graphics
        .poly([6, 14, 20, 7, 45, 14, 20, 21], true)
        .fill({ color: 0xffd06a, alpha: 0.8 })
      graphics
        .poly([14, 14, 26, 11, 46, 14, 26, 17], true)
        .fill({ color: 0xfff2c9, alpha: 0.98 })
    })
    create('mirror-bow', (graphics, color) => {
      graphics
        .poly([18, 1, 30, 8, 32, 27, 18, 37, 4, 27, 6, 8], true)
        .fill({ color: 0x110e1d, alpha: 0.98 })
      graphics
        .poly([18, 4, 27, 10, 27, 24, 18, 32, 9, 24, 9, 10], true)
        .fill({ color, alpha: 0.48 })
      graphics
        .poly([18, 7, 24, 12, 22, 24, 18, 29, 14, 24, 12, 12], true)
        .fill({ color: 0xc9c3d3, alpha: 0.62 })
      graphics
        .poly([18, 11, 21, 15, 20, 22, 18, 25, 16, 22, 15, 15], true)
        .fill({ color: 0xe8e3ed, alpha: 0.9 })
      graphics
        .circle(18, 18, 3.2)
        .fill({ color: 0x8872ac, alpha: 0.78 })
    })
    create('null-bell', (graphics, color) => {
      graphics
        .poly([4, 25, 9, 10, 15, 4, 27, 4, 33, 10, 38, 25, 31, 30, 11, 30], true)
        .fill({ color: 0x0b0d21, alpha: 0.94 })
      graphics
        .poly([8, 24, 13, 11, 18, 7, 25, 7, 30, 12, 34, 24, 29, 27, 13, 27], true)
        .fill({ color, alpha: 0.72 })
      graphics
        .poly([21, 25, 27, 34, 21, 40, 15, 34], true)
        .fill({ color: 0xf0f1ff, alpha: 0.96 })
      graphics
        .poly([11, 18, 21, 11, 31, 18, 21, 23], true)
        .fill({ color: 0xb6a0ff, alpha: 0.46 })
    })

    const spark = new Graphics()
    spark
      .poly([2, 8, 8, 2, 17, 5, 20, 12, 13, 19, 5, 16], true)
      .fill({ color: 0xffffff, alpha: 0.82 })
    this.sparkTexture = this.app.renderer.generateTexture({
      target: spark,
      resolution: this.visualProfile.generatedTextureResolution,
      antialias: this.visualProfile.rendererAntialias,
    })
    spark.destroy()
  }

  private bossTint() {
    return 0xffffff
  }

  private levelUp() {
    this.player.xp -= this.player.xpToNext
    this.player.level += 1
    this.player.xpToNext = experienceToNextLevel(this.player.level)
    this.rerollExclusions.clear()
    const draft = createUpgradeDraft(this.getUpgradeContext(), this.upgradeSeed)
    this.upgradeOptions = draft.options
    this.upgradeSeed = draft.seed
    this.rerollsUsed = draft.rerollsUsed
    this.audio.play('upgrade')
    this.emitSnapshot(true)
  }

  private getUpgradeContext(): UpgradeDraftContext {
    return {
      weapons: this.weapons.map((weapon) => ({ ...weapon })),
      modules: this.modules.map((module) => ({ ...module })),
      traceMods: [...this.traceMods],
      unlockedWeapons: this.unlockedWeapons,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shield: this.player.shield,
      maxShield: this.player.maxShield,
      rerollsUsed: this.rerollsUsed,
      rerollLimit: this.rerollLimit,
    }
  }

  private createSnapshot(): GameSnapshot {
    const remaining = Math.max(0, this.level.duration - this.elapsed)
    const endingProgress =
      this.endSequenceDuration > 0
        ? clamp(1 - this.endSequenceTimer / this.endSequenceDuration, 0, 1)
        : 1
    const boss = this.boss?.active
      ? {
          name: this.bossLevel.bossName,
          hp: Math.max(0, this.boss.hp),
          maxHp: this.boss.maxHp,
          phase: this.boss.phase,
        }
      : undefined
    return {
      runMode: this.runConfig.mode,
      invincible: this.runConfig.invincible,
      awaitingStart: this.awaitingStart,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shield: this.player.shield,
      maxShield: this.player.maxShield,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      level: this.player.level,
      elapsed: this.elapsed,
      duration: this.level.duration,
      kills: this.kills,
      pulseCharge: this.player.pulseCharge,
      pulseReady: this.player.pulseCharge >= 100,
      closedLoops: this.closedLoops,
      largestChain: this.largestChain,
      boss,
      nextEvent: boss
        ? `PHASE ${boss.phase} · BREAK THE SOVEREIGN`
        : !this.bossSpawned && remaining > 60
          ? 'THE HORDE DEEPENS'
          : 'BOSS SIGNATURE APPROACHING',
      weapons: this.weapons.map((weapon) => ({ ...weapon })),
      modules: this.modules.map((module) => ({ ...module })),
      traceMods: [...this.traceMods],
      upgradeOptions: this.upgradeOptions?.map((option) => ({ ...option })),
      rerollsRemaining: Math.max(0, this.rerollLimit - this.rerollsUsed),
      revivePending: this.revivePending,
      revivesRemaining: this.revivesRemaining,
      tutorial:
        this.showcase
          ? showcaseLabel(this.showcase)
          : this.elapsed < 10
          ? 'MOVE TO DRAW A TRACE · CLOSE THE LINE TO DETONATE · SPACE FIRES THE DAWN PULSE'
          : undefined,
      paused: this.isPaused(),
      hitboxOverlay: this.showHitboxOverlay,
      ending: this.completed
        ? {
            victory: Boolean(this.endSequenceVictory),
            levelId: this.bossLevel.id,
            bossName: this.bossLevel.bossName,
            completionVisible: runEndingCompletionVisible(
              Boolean(this.endSequenceVictory),
              endingProgress,
            ),
          }
        : undefined,
    }
  }

  private emitSnapshot(force = false) {
    if (!this.initialized || this.destroyed) return
    if (force) this.snapshotClock = 0
    this.callbacks.onSnapshot(this.createSnapshot())
  }

  private isPaused() {
    return (
      this.manualPaused ||
      this.visibilityPaused ||
      this.orientationPaused ||
      this.revivePending ||
      Boolean(this.upgradeOptions?.length)
    )
  }

  private sliceTexture(texture: Texture, columns: number, rows: number) {
    const frames: Texture[] = []
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        // Authoring tools can emit atlases whose overall dimensions are not
        // perfectly divisible by the grid. Snap every boundary independently
        // so Pixi never samples a fractional texel from the neighboring pose.
        const left = Math.round((column * texture.width) / columns)
        const right = Math.round(((column + 1) * texture.width) / columns)
        const top = Math.round((row * texture.height) / rows)
        const bottom = Math.round(((row + 1) * texture.height) / rows)
        frames.push(
          new Texture({
            source: texture.source,
            frame: new Rectangle(left, top, right - left, bottom - top),
          }),
        )
      }
    }
    return frames
  }

  private bossMotionTexture(frame: ResolvedBossClipFrame) {
    return this.bossMotionFrames[frame.atlasIndex]?.[frame.frameIndex]
  }

  private enemyMotionTexture(frame: ResolvedEnemyClipFrame) {
    return this.enemyMotionFrames[frame.atlasIndex]?.[frame.frameIndex]
  }

  private handleVisibility = () => {
    this.visibilityPaused = document.hidden
    this.emitSnapshot(true)
  }
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  {
    level,
    runConfig,
    settings,
    unlockedWeapons,
    persistentUpgrades,
    orientationPaused,
    onSnapshot,
    onComplete,
    onExit,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<NighttraceRuntime | undefined>(undefined)
  const callbacksRef = useRef({ onSnapshot, onComplete, onExit })
  const initialConfigRef = useRef({
    level,
    runConfig,
    settings,
    unlockedWeapons,
    persistentUpgrades,
  })
  callbacksRef.current = { onSnapshot, onComplete, onExit }

  useImperativeHandle(
    ref,
    () => ({
      beginEncounter: () => void runtimeRef.current?.beginEncounter(),
      revive: () => runtimeRef.current?.revive(),
      declineRevive: () => runtimeRef.current?.declineRevive(),
      selectUpgrade: (optionId) => runtimeRef.current?.selectUpgrade(optionId),
      rerollUpgrade: () => runtimeRef.current?.rerollUpgrade(),
      togglePause: () => runtimeRef.current?.togglePause(),
      toggleHitboxOverlay: () => runtimeRef.current?.toggleHitboxOverlay(),
      activatePulse: () => runtimeRef.current?.activatePulse(),
      setOrientationPaused: (paused) => runtimeRef.current?.setOrientationPaused(paused),
    }),
    [],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const initial = initialConfigRef.current

    const runtime = new NighttraceRuntime(
      host,
      initial.level,
      initial.runConfig,
      initial.settings,
      initial.unlockedWeapons,
      initial.persistentUpgrades,
      {
        onSnapshot: (snapshot) => callbacksRef.current.onSnapshot(snapshot),
        onComplete: (result) => callbacksRef.current.onComplete(result),
        onExit: () => callbacksRef.current.onExit(),
      },
    )
    runtimeRef.current = runtime
    void runtime.init().catch((error) => {
      console.error('NIGHTTRACE renderer failed to initialize.', error)
    })

    return () => {
      runtime.destroy()
      if (runtimeRef.current === runtime) runtimeRef.current = undefined
    }
  }, [])

  useEffect(() => {
    runtimeRef.current?.updateSettings(settings)
  }, [settings])

  useEffect(() => {
    runtimeRef.current?.setOrientationPaused(orientationPaused)
  }, [orientationPaused])

  return (
    <div
      ref={hostRef}
      className="game-canvas"
      style={canvasHostStyle}
      role="application"
      aria-label={`${level.name} combat arena`}
    />
  )
})

export default GameCanvas
