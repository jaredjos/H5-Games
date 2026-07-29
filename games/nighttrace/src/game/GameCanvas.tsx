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
  private readonly weaponEffects: WeaponEffectEntity[] = []
  private readonly trace: Vec2[] = []
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
    this.groundedVfxSmokeGraphics.filters = [
      new BlurFilter({
        strength: this.visualLod === 'mobile' ? 3 : 4,
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
    this.trace.push({ x: this.player.x, y: this.player.y })
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
      )
      this.trailLayer.addChild(this.loopGraphics, this.trailGlow, this.trailCore)
      this.threatGroundLayer.addChild(
        this.groundedVfxMaterialLayer,
        this.groundedVfxSmokeGraphics,
        this.groundedVfxDustGraphics,
      )
      this.groundedVfxMaterialLayer.sortableChildren = true
      this.groundedVfxCinderGraphics.blendMode = 'add'
      this.weaponMaterialLayer.sortableChildren = true
      this.pickupLayer.addChild(this.pickupAuraGraphics)
      this.enemyLayer.addChild(this.motionGraphics)
      this.projectileLayer.addChild(
        this.projectileTrailGraphics,
        this.hostileProjectileGraphics,
      )
      this.weaponVfxAdditiveGraphics.blendMode = 'add'
      this.enemyForegroundLayer.addChild(this.groundedVfxCinderGraphics)
      this.effectLayer.addChild(
        this.motionEchoLayer,
        this.weaponVfxAdditiveGraphics,
        this.weaponVfxGraphics,
      )
      this.app.stage.addChild(this.world, this.screenEffects)
      this.screenEffects.addChild(
        this.screenFlash,
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
      this.createVfxTextures()
      const initialHeroTexture =
        this.heroChargeFrames[0] ?? this.heroWalkFrames[0] ?? Texture.WHITE
      this.hero = new Sprite(initialHeroTexture)
      this.hero.anchor.set(HERO_ART_ROOT_X, HERO_ART_ROOT_Y)
      this.hero.scale.set(HERO_ART_SCALE)
      this.hero.position.set(this.player.x, this.player.y)
      this.hero.filters = null
      this.actorLayer.addChild(this.hero)

      this.cinematicTitle.anchor.set(0.5)
      this.cinematicTitle.alpha = 0
      this.host.dataset.visualLod = this.visualLod
      this.host.dataset.materialVfxReady = 'retired'
      this.host.dataset.actorReadability = 'protected'
      this.host.dataset.authoredSpellMaterials = AUTHORED_SPELL_ASSET_REVISION

      this.input = new GameInput(this.host, {
        onInteract: () => void this.audio.unlock(),
      })
      this.resizeObserver = new ResizeObserver(() => this.layout())
      this.resizeObserver.observe(this.host)
      document.addEventListener('visibilitychange', this.handleVisibility)
      this.app.ticker.add(this.tick)
      this.layout()
      this.initialized = true
      if (this.showcase) this.spawnShowcaseTargets()
      else if (!this.runConfig.bossOnly) {
        for (let index = 0; index < 4; index += 1) this.spawnEnemy()
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
  }

  async beginEncounter() {
    if (!this.initialized || this.completed) return
    await this.audio.unlock()
    if (!this.awaitingStart) return
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
    this.trace.length = 0
    this.trace.push({ x: this.player.x, y: this.player.y })
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
    const sanctuaryRadiusSquared = sanctuaryRadius ** 2

    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.isBoss) continue
      const dx = enemy.x - this.player.x
      const dy = enemy.y - this.player.y
      const distanceSquaredFromPlayer = dx * dx + dy * dy
      if (distanceSquaredFromPlayer > sanctuaryRadiusSquared) continue
      const distance = Math.sqrt(distanceSquaredFromPlayer)
      const angle =
        distance > 0.01
          ? Math.atan2(dy, dx)
          : this.random.range(0, Math.PI * 2)
      enemy.x = clamp(
        this.player.x + Math.cos(angle) * sanctuaryRadius,
        38,
        WORLD_WIDTH - 38,
      )
      enemy.y = clamp(
        this.player.y + Math.sin(angle) * sanctuaryRadius,
        34,
        WORLD_HEIGHT - 34,
      )
      enemy.previousX = enemy.x
      enemy.previousY = enemy.y
      enemy.pendingContactDamage = 0
      enemy.contactCooldown = Math.max(enemy.contactCooldown, 1.1)
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
      this.revivePending ||
      this.upgradeOptions?.length
    ) return
    this.manualPaused = !this.manualPaused
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
      this.endSequenceTimer = Math.max(0, this.endSequenceTimer - delta)
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

    const bossAt = this.qaMode
      ? Math.min(45, this.level.duration * 0.2)
      : Math.max(45, this.level.duration - 38)
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
      projectile.sprite.rotation = Math.atan2(projectile.vy, projectile.vx)
      const projectileAlpha =
        projectile.weaponId === 'rift-seeds'
          ? 0.82 + Math.sin(this.motionClock * 9 + projectile.x * 0.01) * 0.12
          : 0.98
      projectile.sprite.alpha =
        projectileAlpha * Math.max(0.58, sceneVfxScale + 0.08)
      this.drawProjectileTrail(projectile, renderX, renderY)
    }
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
        const releaseDx = this.player.x - enemy.x
        const releaseDy = this.player.y - enemy.y
        if (
          releaseDx * releaseDx + releaseDy * releaseDy <=
          (enemy.radius + 42) ** 2
        ) {
          this.damagePlayer(enemy.pendingContactDamage)
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

      if (distance <= enemy.radius + 25 && enemy.contactCooldown <= 0) {
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
      this.triggerEnemyAttack(enemy, 'cast', 1.16, angle, true)
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
      this.triggerEnemyAttack(enemy, 'cast', 1.02, angle, true)
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
      this.triggerEnemyAttack(enemy, 'charge', 0.76, angle, true)
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
        this.triggerEnemyAttack(enemy, 'cast', 1.08, angle, true)
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
        this.triggerEnemyAttack(enemy, 'cast', 1.22, angle, true)
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
      this.triggerEnemyAttack(enemy, 'slam', 0.92, angle, true)
      this.queueCircleTelegraph(
        enemy.x,
        enemy.y,
        92,
        0.92,
        enemy.damage,
        false,
        this.actorAccentColor(enemy),
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
    const ordinaryHits = hits.reduce((count, hit) => {
      const enemy = enemiesById.get(hit.targetId)
      return count + (enemy?.active && !enemy.isBoss ? 1 : 0)
    }, 0)
    for (const hit of hits) {
      const enemy = enemiesById.get(hit.targetId)
      if (!enemy?.active) continue
      this.damageEnemy(
        enemy,
        enemy.isBoss
          ? castDamageBudget
          : castDamageBudget / Math.max(1, ordinaryHits),
        weaponId,
      )
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
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x)
    this.heroFacing = { x: Math.cos(angle), y: Math.sin(angle) }
    const usesDawncaster = DAWNCASTER_WEAPON_IDS.has(owned.id)
    this.triggerHeroAttack(
      usesDawncaster ? 'hero-shot' : 'hero-cast',
      owned.id === 'null-bell' ? 0.48 : usesDawncaster ? 0.3 : 0.4,
      angle,
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
            damage,
          )
        }
        break
      }
      case 'arc-choir':
        this.chainLightning(
          target,
          damage,
          Math.min(10, 2 + rank + moduleRank + (owned.awakened ? 2 : 0)),
          owned.id,
          visualState,
          visualSeed,
        )
        break
      case 'rift-seeds':
        this.emitWeaponCastVfx(owned.id, visualState, angle, 74, visualSeed)
        this.spawnProjectile(
          owned.id,
          angle,
          235,
          damage,
          0,
          0.4,
          definition.color,
          1.25 + moduleRank * 0.12,
          visualState,
          visualSeed,
          damage,
        )
        break
      case 'comet-swarm': {
        const count = Math.min(7, 1 + Math.ceil(rank / 2) + (owned.awakened ? 2 : 0))
        this.emitWeaponCastVfx(owned.id, visualState, angle, 52 + count * 5, visualSeed)
        for (let index = 0; index < count; index += 1) {
          this.spawnProjectile(
            owned.id,
            angle + (index - (count - 1) / 2) * 0.19,
            385 + moduleRank * 35,
            damage / count,
            0,
            3.2 + moduleRank * 0.8,
            definition.color,
            1.45,
            visualState,
            visualSeed + index,
            damage / count,
          )
        }
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
        this.emitWeaponCastVfx(owned.id, visualState, angle, 128, visualSeed)
        const frontPierce = 3 + Math.floor(rank / 2) + moduleRank
        this.spawnProjectile(
          owned.id,
          angle,
          620,
          (damage * 0.65) / (frontPierce + 1),
          frontPierce,
          0,
          definition.color,
          1.45,
          visualState,
          visualSeed,
          damage,
        )
        this.spawnProjectile(
          owned.id,
          angle + Math.PI,
          620,
          (damage * 0.35) / 3,
          2,
          0,
          0xdaf6ff,
          1.45,
          visualState,
          visualSeed + 1,
          damage * 0.35,
        )
        if (owned.awakened) {
          this.spawnBurst(this.player.x, this.player.y, 0xe9f8ff, 10, 130)
        }
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
      if (owned.id === 'ash-halo' || owned.id === 'null-bell') {
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

  private pushWeaponEffect(effect: WeaponEffectEntity) {
    if (this.weaponEffects.length >= 72) {
      let shortestIndex = 0
      for (let index = 1; index < this.weaponEffects.length; index += 1) {
        if (this.weaponEffects[index].life < this.weaponEffects[shortestIndex].life) {
          shortestIndex = index
        }
      }
      this.weaponEffects.splice(shortestIndex, 1)
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
      'rift-seeds': 'rift-cast',
      'comet-swarm': 'comet-launch',
      'ash-halo': 'graveglass-eruption',
      'mirror-bow': 'mirror-gate',
      'null-bell': 'eclipse-harrow',
    }
    const effectKind = kind[weaponId]
    if (!effectKind) return
    const duration = {
      'helio-lance': 0.46,
      'crescent-array': 0.62,
      'arc-choir': 0.5,
      'rift-seeds': 0.58,
      'comet-swarm': 0.42,
      'ash-halo': visualState.stage === 'final' ? 1.04 : 0.86,
      'mirror-bow': 0.5,
      'null-bell': visualState.stage === 'final' ? 1.24 : 1.02,
    }[weaponId] ?? 0.5
    const hitPulseTotal =
      weaponId === 'ash-halo' ? 0.38 : weaponId === 'null-bell' ? 0.46 : undefined
    this.pushWeaponEffect({
      kind: effectKind,
      weaponId,
      visualState,
      x: pattern?.aimPoint.x ?? this.player.x,
      y: pattern?.aimPoint.y ?? this.player.y,
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

    const profile = weaponVfxProfile(weaponId, visualState)
    const burstCount = Math.min(14, Math.max(4, Math.ceil(profile.particleCount * 0.45)))
    if (weaponId !== 'ash-halo' && weaponId !== 'null-bell') {
      this.spawnBurst(
        this.player.x + Math.cos(angle) * 28,
        this.player.y + Math.sin(angle) * 28,
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
    expired = false,
  ) {
    if (projectile.hitIds.length > 2 && projectile.visualState.stage !== 'final') return
    const kind: Partial<Record<WeaponId, WeaponEffectKind>> = {
      'helio-lance': 'helio-impact',
      'crescent-array': 'crescent-impact',
      'rift-seeds': 'rift-impact',
      'comet-swarm': 'comet-impact',
      'mirror-bow': 'mirror-impact',
    }
    const effectKind = kind[projectile.weaponId]
    if (!effectKind) return
    const profile = weaponVfxProfile(projectile.weaponId, projectile.visualState)
    const radius =
      projectile.weaponId === 'rift-seeds'
        ? expired ? 118 : 88
        : projectile.weaponId === 'helio-lance'
          ? 56
          : projectile.weaponId === 'mirror-bow'
            ? 66
            : 48
    const duration =
      projectile.weaponId === 'rift-seeds'
        ? 0.66
        : projectile.visualState.stage === 'final'
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

    const x = this.player.x + Math.cos(angle) * 28
    const y = this.player.y + Math.sin(angle) * 28
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
    projectile.sprite.texture = this.projectileTextures.get(weaponId) ?? Texture.WHITE
    projectile.sprite.tint = 0xffffff
    const [projectileWidth, projectileHeight] = this.projectileDimensions(weaponId)
    const visualProfile = weaponVfxProfile(weaponId, visualState)
    projectile.sprite.width = projectileWidth * visualProfile.projectileScale
    projectile.sprite.height = projectileHeight * visualProfile.projectileScale
    projectile.sprite.alpha = 0.95
    projectile.sprite.blendMode = 'add'
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
        if (projectile.weaponId === 'rift-seeds' && projectile.life <= 0) {
          this.areaDamage(
            projectile.x,
            projectile.y,
            92,
            projectile.damage * 0.45,
            projectile.weaponId,
            projectile.bossDamage,
          )
          this.emitProjectileImpactVfx(projectile, projectile.x, projectile.y, true)
        }
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

      const playerDeltaX = this.player.x - telegraph.x
      const playerDeltaY = this.player.y - telegraph.y
      const localX =
        Math.cos(telegraph.angle) * playerDeltaX + Math.sin(telegraph.angle) * playerDeltaY
      const localY =
        -Math.sin(telegraph.angle) * playerDeltaX + Math.cos(telegraph.angle) * playerDeltaY
      const hit =
        telegraph.kind === 'circle'
          ? playerDeltaX ** 2 + playerDeltaY ** 2 <= (telegraph.radius + 18) ** 2
          : localX >= 0 &&
            localX <= telegraph.length &&
            Math.abs(localY) <= telegraph.width * 0.5 + 18

      if (hit) this.damagePlayer(telegraph.damage)
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
        windupSeconds: options.windup,
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
          this.spawnBurst(
            event.origin.x,
            event.origin.y,
            projectile.palette.seepTint,
            projectile.state.config.boss ? 9 : 5,
            projectile.state.config.boss ? 165 : 110,
          )
          continue
        }
        if (
          distanceSquared(event.destination, this.player) <=
          (event.radius + 18) ** 2
        ) {
          this.damagePlayer(event.damage)
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
      if (effect.hitPulseLife !== undefined) {
        effect.hitPulseLife = Math.max(0, effect.hitPulseLife - delta)
      }
    }
    this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - delta * 1.5)
    this.shake = Math.max(0, this.shake - delta * 26)
  }

  private updateTrace() {
    const last = this.trace[this.trace.length - 1]
    const point = { x: this.player.x, y: this.player.y }
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
    if (this.settings.showDamageNumbers && (critical || damage >= 45)) {
      this.spawnDamageNumber(enemy.x, enemy.y - enemy.radius, Math.round(damage), critical)
    }
    this.spawnBurst(enemy.x, enemy.y, critical ? 0xfff2b0 : WEAPONS[weaponId].color, critical ? 7 : 3, 95)
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
      enemy.deathMotionDuration = wasBoss ? 1 : 0.42
      enemy.deathMotionRemaining = enemy.deathMotionDuration
      enemy.sprite.visible = true
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

  private damagePlayer(amount: number) {
    if (
      this.hurtCooldown > 0 ||
      this.reviveInvulnerability > 0 ||
      this.revivePending ||
      this.completed
    ) return
    let remaining =
      amount *
      GLOBAL_DIFFICULTY_MULTIPLIER *
      (this.qaMode ? 0.1 : 0.72)
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
    this.hurtCooldown = this.qaMode ? 0.75 : 0.42
    this.shieldDelay = 4
    this.shake = Math.max(this.shake, 9)
    this.screenFlashAlpha = this.settings.reducedFlash ? 0.035 : 0.2
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
    this.endSequenceDuration = victory ? 1.9 : 1.72
    this.endSequenceTimer = this.endSequenceDuration
    this.cinematicTitle.text = victory ? 'DAWN RECLAIMED' : 'TRACE SEVERED'
    this.cinematicTitle.tint = victory ? 0xffd978 : 0xff657c
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

  private spawnDamageNumber(x: number, y: number, damage: number, critical: boolean) {
    const text = new Text({
      text: critical ? `${damage}!` : String(damage),
      style: {
        fontFamily: 'Inter, sans-serif',
        fontSize: critical ? 22 : 16,
        fontWeight: '700',
        fill: critical ? 0xffed8f : 0xf3fbff,
        stroke: { color: 0x081018, width: 4 },
      },
    })
    text.anchor.set(0.5)
    text.position.set(x, y)
    this.effectLayer.addChild(text)
    const started = performance.now()
    const animate = () => {
      if (this.destroyed || text.destroyed) return
      const progress = (performance.now() - started) / 620
      if (progress >= 1) {
        text.destroy()
        return
      }
      text.y = y - progress * 42
      text.alpha = 1 - progress
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
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

  private chainLightning(
    first: EnemyEntity,
    damage: number,
    jumps: number,
    weaponId: WeaponId,
    visualState: WeaponVfxState,
    visualSeed: number,
  ) {
    const hit: number[] = []
    const points: Vec2[] = [{ x: this.player.x, y: this.player.y }]
    const falloffTotal = weightedFalloffTotal(jumps)
    let current: EnemyEntity | undefined = first
    for (let jump = 0; jump < jumps && current; jump += 1) {
      hit.push(current.uid)
      points.push({ x: current.x, y: current.y })
      const falloff = Math.max(0.48, 1 - jump * 0.09)
      this.damageEnemy(
        current,
        current.isBoss && jump === 0
          ? damage
          : (damage * falloff) / falloffTotal,
        weaponId,
      )
      current = this.nearestEnemy(current.x, current.y, hit)
      if (current && distanceSquared(current, { x: first.x, y: first.y }) > 320 ** 2) break
    }
    if (points.length > 1) {
      this.pushWeaponEffect({
        kind: 'arc-chain',
        weaponId,
        visualState,
        x: this.player.x,
        y: this.player.y,
        angle: 0,
        radius: 34,
        maxRadius: 84 + visualState.detail * 8,
        life: visualState.stage === 'final' ? 0.58 : 0.44,
        total: visualState.stage === 'final' ? 0.58 : 0.44,
        seed: visualSeed,
        points,
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
    this.triggerEnemyAttack(enemy, attackStyle, warningTime + 0.24, angle, true)
    this.audio.playBossAttack(enemy.phase, pattern)

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
  ) {
    if (this.activeTelegraphCount >= 32) return
    const telegraph = this.telegraphs.find((candidate) => !candidate.active)
    const next: TelegraphEntity = {
      active: true,
      kind: 'circle',
      x,
      y,
      radius,
      angle: 0,
      length: 0,
      width: 0,
      life,
      total: life,
      damage,
      bossAttack,
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
  ) {
    if (this.activeTelegraphCount >= 32) return
    const telegraph = this.telegraphs.find((candidate) => !candidate.active)
    const next: TelegraphEntity = {
      active: true,
      kind: 'line',
      x,
      y,
      radius: 0,
      angle,
      length,
      width,
      life,
      total: life,
      damage,
      bossAttack,
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
    this.trailGlow.moveTo(this.trace[0].x, this.trace[0].y)
    this.trailCore.moveTo(this.trace[0].x, this.trace[0].y)
    for (let index = 1; index < this.trace.length; index += 1) {
      this.trailGlow.lineTo(this.trace[index].x, this.trace[index].y)
      this.trailCore.lineTo(this.trace[index].x, this.trace[index].y)
    }
    this.trailGlow.stroke({ color: 0x63f7df, width: 18, alpha: 0.08 })
    this.trailCore.stroke({ color: 0xb9fff3, width: 3, alpha: 0.72 })
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
  ) {
    if (this.groundedVfxParticleBudget <= 0) return
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
  ) {
    if (this.groundedVfxParticleBudget <= 0) return
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
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const tangentX = dx / length
    const tangentY = dy / length
    const normalX = -tangentY
    const normalY = tangentX
    const angle = Math.atan2(dy, dx)
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
  ) {
    const texture = this.hostileGroundFieldTexture
    if (!texture) return
    const pose = sampleGroundedVfxPose(kind, { progress })
    if (!pose.visible) return
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
  ) {
    const texture = this.hostileGroundLaneTexture
    if (!texture) return
    const pose = sampleGroundedVfxPose(kind, { progress })
    if (!pose.visible) return
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
    return sceneVfxEnergyScale(
      activeWeaponCount,
      this.weaponEffects.length + activeProjectileCount + activeEchoCount,
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

  private drawWeaponEffects() {
    this.beginAuthoredSpellMaterialFrame()
    this.weaponVfxAdditiveGraphics.clear()
    this.weaponVfxGraphics.clear()
    const additiveGraphics = this.weaponVfxAdditiveGraphics
    const graphics = this.weaponVfxGraphics
    const energyScale = this.currentSceneVfxEnergyScale()
    additiveGraphics.alpha = energyScale
    graphics.alpha = energyScale
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
      const profile = weaponVfxProfile(effect.weaponId, state)
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
            this.drawCrescentGlyph(
              graphics,
              effect.x + Math.cos(bladeAngle) * layerRadius,
              effect.y + Math.sin(bladeAngle) * layerRadius,
              bladeAngle,
              8 + stage * 1.4,
              profile.accentColor,
              motionAlpha * 0.92,
            )
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
            this.drawCrescentGlyph(
              graphics,
              effect.x + Math.cos(shardAngle) * radius * 0.72,
              effect.y + Math.sin(shardAngle) * radius * 0.72,
              shardAngle,
              4.5 + stage,
              profile.coreColor,
              motionAlpha * 0.7,
            )
          }
          break
        }
        case 'arc-chain': {
          const lightning = this.buildLightningPoints(effect.points ?? [], effect.seed, progress)
          this.drawPolyline(graphics, lightning, profile.glowColor, 17 + stage * 3, motionAlpha * 0.1)
          this.drawPolyline(graphics, lightning, profile.accentColor, 6 + stage * 0.8, motionAlpha * 0.64)
          this.drawPolyline(graphics, lightning, profile.coreColor, 1.7 + stage * 0.28, motionAlpha)
          for (let nodeIndex = 1; nodeIndex < (effect.points?.length ?? 0); nodeIndex += 1) {
            const node = effect.points?.[nodeIndex]
            if (!node) continue
            const nodeRadius = 10 + stage * 2.7
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
        case 'rift-cast':
        case 'rift-impact': {
          const impact = effect.kind === 'rift-impact'
          const centerX = impact ? effect.x : effect.x + Math.cos(effect.angle) * (34 + stage * 5)
          const centerY = impact ? effect.y : effect.y + Math.sin(effect.angle) * (34 + stage * 5)
          const coreRadius = impact ? radius * (0.19 + stage * 0.018) : 10 + stage * 2.5
          this.drawHeroPowerMaterialEvent({
            x: centerX,
            y: centerY,
            radius: coreRadius * (impact ? 4.2 : 3.3),
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.accentColor,
            frame: impact
              ? HERO_MATERIAL_FRAME.fracture
              : HERO_MATERIAL_FRAME.driftB,
            angle: -rotation * 0.4,
            materialOpacity: impact ? 0.27 : 0.18,
          })
          for (let seedIndex = 0; seedIndex < stage; seedIndex += 1) {
            const seedAngle =
              -rotation * 0.36 +
              replacementCosmeticUnit(effect.seed, seedIndex, 83) * Math.PI * 2
            const seedDistance =
              coreRadius *
              (1.9 + replacementCosmeticUnit(effect.seed, seedIndex, 89) * 1.8)
            this.drawHeroPowerMaterialEvent({
              x: centerX + Math.cos(seedAngle) * seedDistance,
              y: centerY + Math.sin(seedAngle) * seedDistance * 0.66,
              radius: coreRadius * (0.7 + stage * 0.08),
              progress,
              stage: state.stage,
              seed: effect.seed + seedIndex * 101,
              tint:
                seedIndex % 2 ? profile.secondaryColor : profile.coreColor,
              frame: HERO_MATERIAL_FRAME.fragments,
              angle: seedAngle,
              materialOpacity: 0.16,
            })
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
        case 'mirror-gate': {
          const gateRadius = 30 + stage * 10
          this.drawHeroPowerMaterialEvent({
            x: effect.x,
            y: effect.y,
            radius: gateRadius * 1.35,
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.accentColor,
            frame: HERO_MATERIAL_FRAME.fragments,
            angle: effect.angle,
            materialOpacity: 0.27,
            stretchX: 1.24 + stage * 0.08,
            stretchY: 0.78,
          })
          break
        }
        case 'mirror-impact': {
          this.drawHeroPowerMaterialEvent({
            x: effect.x,
            y: effect.y,
            radius,
            progress,
            stage: state.stage,
            seed: effect.seed,
            tint: profile.coreColor,
            frame: HERO_MATERIAL_FRAME.fracture,
            angle: rotation,
            materialOpacity: 0.25,
          })
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
      'mirror-bow': [54, 21],
      'null-bell': [30, 32],
    }[weaponId] as [number, number]
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
      'mirror-bow': [58, 3],
      'null-bell': [20, 5],
    }[projectile.weaponId]
    const profile = weaponVfxProfile(projectile.weaponId, projectile.visualState)
    const stage = this.vfxStageIndex(projectile.visualState.stage)
    const length = baseTrail[0] * profile.trailLengthScale
    const width = baseTrail[1] * profile.trailWidthScale
    const startX = x - dx * length
    const startY = y - dy * length
    const graphics = this.projectileTrailGraphics

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

    if (projectile.weaponId === 'mirror-bow') {
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
      graphics.poly([6, 16, 34, 8, 50, 16, 34, 24], true).fill({ color: 0xffd25d, alpha: 0.62 })
      graphics.ellipse(43, 16, 12, 10).fill({ color, alpha: 0.9 })
      graphics.ellipse(46, 13, 6, 5).fill({ color: 0xfff4de, alpha: 0.98 })
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
      graphics.poly([0, 16, 20, 1, 65, 8, 82, 16, 65, 24, 20, 31], true).fill({ color, alpha: 0.24 })
      graphics.poly([9, 16, 30, 7, 70, 13, 79, 16, 70, 19, 30, 25], true).fill({ color: 0xffffff, alpha: 0.92 })
      graphics.poly([34, 5, 42, 16, 34, 27, 28, 16], true).fill({ color: 0xc196ff, alpha: 0.62 })
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
