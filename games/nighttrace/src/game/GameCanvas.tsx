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
  bossAnimationProfile,
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
  bossPatternForLevel,
  chooseSupportPickup,
  eligibleEnemyPool,
  estimateBossDps,
  experienceToNextLevel,
  hordeActiveCap,
  hordePressureAt,
  sectorBaselineAt,
  supportPickupFirstDropSeconds,
  supportPickupIntervalSeconds,
  type SupportPickupKind,
} from './balance'
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
  HOSTILE_WARNING_COLOR,
  bossImpactProgress,
  bossPresentation,
  enemyPresentation,
  sampleHostileEnvelope,
} from './enemyPresentation'
import {
  resolveWeaponVfxState,
  weaponVfxMotifProfile,
  weaponVfxProfile,
  type WeaponVfxStage,
  type WeaponVfxState,
} from './weaponVfx'

const WORLD_WIDTH = 1672
const WORLD_HEIGHT = 941
const FIXED_STEP = 1 / 60
const MAX_STEPS_PER_FRAME = 14
const ALL_WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[]
const DAWNCASTER_WEAPON_IDS = new Set<WeaponId>([
  'helio-lance',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
  'mirror-bow',
])
const ENEMY_IDS: EnemyId[] = [
  'maskling',
  'shardwing',
  'cantor',
  'railjaw',
  'chronowisp',
  'cinder-guard',
]
const GRID_SIZE = 112
const HERO_RUNTIME_FRAME_SIZE = 512
const HERO_RUNTIME_SCALE = HERO_RUNTIME_FRAME_SIZE / 768
const HERO_ART_ROOT_X = (300 * HERO_RUNTIME_SCALE) / HERO_RUNTIME_FRAME_SIZE
const HERO_ART_ROOT_Y = (690 * HERO_RUNTIME_SCALE) / HERO_RUNTIME_FRAME_SIZE
// Keep the authored hero inside the normal-horde silhouette range.
// Sovereign bosses retain their separate 210x245+ presentation scale.
const HERO_ART_SCALE = 66 / (550 * HERO_RUNTIME_SCALE)

export interface GameCanvasHandle {
  beginEncounter(): void
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
  | 'ash-corona'
  | 'mirror-gate'
  | 'mirror-impact'
  | 'null-toll'

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
  private readonly pickupLayer = new Container()
  private readonly enemyLayer = new Container()
  private readonly projectileLayer = new Container()
  private readonly actorLayer = new Container()
  private readonly effectLayer = new Container()
  private readonly motionEchoLayer = new Container()
  private readonly trailGlow = new Graphics()
  private readonly trailCore = new Graphics()
  private readonly pickupAuraGraphics = new Graphics()
  private readonly loopGraphics = new Graphics()
  private readonly telegraphGraphics = new Graphics()
  private readonly ringGraphics = new Graphics()
  private readonly motionGraphics = new Graphics()
  private readonly projectileTrailGraphics = new Graphics()
  private readonly weaponVfxGraphics = new Graphics()
  private readonly heroAura = new Graphics()
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
  private enemyFrames: Texture[] = []
  private bossFrames: Texture[] = []
  private pickupFrames: Texture[] = []
  private readonly projectileTextures = new Map<WeaponId, Texture>()
  private sparkTexture = Texture.WHITE
  private background?: Sprite
  private settings: GameSettings
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
  private completed = false
  private completionSent = false
  private kills = 0
  private closedLoops = 0
  private largestChain = 0
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
    this.unlockedWeapons = unlockedWeapons.length ? [...unlockedWeapons] : ['helio-lance']
    this.persistentUpgrades = persistentUpgrades
    this.callbacks = callbacks
    this.audio = new NighttraceAudio(settings)
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
    const resolution = Math.min(window.devicePixelRatio || 1, 2)
    const applicationInit = this.app
      .init({
        resizeTo: this.host,
        autoDensity: true,
        antialias: true,
        resolution,
        background: '#03070c',
        preference: 'webgl',
        powerPreference: 'high-performance',
      })
      .then(() => {
        this.applicationReady = true
      })
    const assetLoad = Promise.all([
      Assets.load<Texture>(backgroundForLevel(this.level.id)),
      Assets.load<Texture>(appAssetUrl('assets/hero-animations/hero-walk-runtime.webp')),
      Assets.load<Texture>(appAssetUrl('assets/hero-animations/hero-fire-runtime.webp')),
      Assets.load<Texture>(appAssetUrl('assets/hero-animations/hero-charge-runtime.webp')),
      Assets.load<Texture>(appAssetUrl('assets/nighttrace-enemy-atlas.webp')),
      Assets.load<Texture>(appAssetUrl('assets/nighttrace-boss-atlas.webp')),
      Assets.load<Texture>(appAssetUrl('assets/nighttrace-pickup-atlas.webp')),
    ])
    try {
      const [
        ,
        [
          backgroundTexture,
          heroWalkSheet,
          heroFireSheet,
          heroChargeSheet,
          enemySheet,
          bossSheet,
          pickupSheet,
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
        this.pickupLayer,
        this.enemyLayer,
        this.projectileLayer,
        this.actorLayer,
        this.effectLayer,
      )
      this.trailLayer.addChild(this.loopGraphics, this.trailGlow, this.trailCore)
      this.pickupLayer.addChild(this.pickupAuraGraphics)
      this.enemyLayer.addChild(this.motionGraphics)
      this.projectileLayer.addChild(this.projectileTrailGraphics)
      this.effectLayer.addChild(
        this.motionEchoLayer,
        this.weaponVfxGraphics,
        this.telegraphGraphics,
        this.ringGraphics,
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
      this.enemyFrames = this.sliceTexture(enemySheet, 3, 2)
      this.bossFrames = this.sliceTexture(bossSheet, 3, 2)
      this.pickupFrames = this.sliceTexture(pickupSheet, 3, 2)
      this.createVfxTextures()
      this.heroAura.ellipse(0, 9, 54, 18).fill({ color: 0x02060a, alpha: 0.34 })
      this.heroAura.ellipse(0, 8, 44, 14).stroke({ color: 0xffdf83, width: 2, alpha: 0.28 })
      this.heroAura
        .poly([-42, 8, -19, 3, 0, -5, 19, 3, 42, 8, 19, 13, 0, 21, -19, 13], true)
        .stroke({ color: 0x64f5e0, width: 1.5, alpha: 0.22 })
      this.heroAura.position.set(this.player.x, this.player.y)
      this.actorLayer.addChild(this.heroAura)
      this.hero = new Sprite(this.heroChargeFrames[0] ?? this.heroWalkFrames[0] ?? Texture.WHITE)
      this.hero.anchor.set(HERO_ART_ROOT_X, HERO_ART_ROOT_Y)
      this.hero.scale.set(HERO_ART_SCALE)
      this.hero.position.set(this.player.x, this.player.y)
      this.actorLayer.addChild(this.hero)
      this.cinematicTitle.anchor.set(0.5)
      this.cinematicTitle.alpha = 0

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
        this.player.pulseCharge = 100
      } else {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.3)
      }
    }

    this.upgradeOptions = undefined
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
    if (!this.upgradeOptions?.length || this.rerollsUsed >= 1 || this.completed) return
    const previousIds = this.upgradeOptions.map((option) => option.id)
    const draft = createUpgradeDraft(
      {
        ...this.getUpgradeContext(),
        rerollsUsed: this.rerollsUsed,
        excludeOptionIds: previousIds,
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
    if (!this.initialized || this.completed || this.upgradeOptions?.length) return
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
      ...this.enemyFrames,
      ...this.bossFrames,
      ...this.pickupFrames,
    ]) {
      texture.destroy(false)
    }
    this.heroWalkFrames.length = 0
    this.heroFireFrames.length = 0
    this.heroChargeFrames.length = 0
    this.enemyFrames.length = 0
    this.bossFrames.length = 0
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
    this.rebuildEnemyGrid()
    this.updateWeapons(delta)
    this.updateProjectiles(delta)
    if (!this.runConfig.bossOnly) this.updateSupportPickups()
    this.updatePickups(delta)
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
    const heroPose = sampleHeroMotion({
      time: this.motionClock,
      moving: 0,
      attackProgress: -1,
      attackAngle: this.heroAttackAngle,
      attackStyle: 'none',
      hurtProgress: motionProgress(this.heroHurtRemaining, this.heroHurtDuration),
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
    this.hero.alpha = heroPose.alpha
    const heroGlow = Math.max(heroPose.glow, authoredGlow)
    this.heroAura.position.set(playerRenderX, playerRenderY + 2)
    this.heroAura.rotation = this.motionClock * 0.14
    this.heroAura.scale.set(
      1 + Math.sin(this.motionClock * 2.2) * 0.018 + heroGlow * 0.18,
    )
    this.heroAura.alpha = 0.82 + heroGlow * 0.18

    this.motionGraphics.clear()
    this.motionGraphics
      .ellipse(playerRenderX, playerRenderY + 16, 33, 10)
      .fill({ color: 0x010307, alpha: 0.26 })
    if (heroGlow > 0.04) {
      this.motionGraphics
        .ellipse(playerRenderX, playerRenderY + 8, 46 + heroGlow * 18, 16 + heroGlow * 6)
        .stroke({ color: 0xffdf83, width: 2 + heroGlow * 3, alpha: heroGlow * 0.42 })
    }

    const activeHordeCount = this.enemies.reduce(
      (count, enemy) => count + (enemy.active && !enemy.isBoss ? 1 : 0),
      0,
    )
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      const renderX = lerp(enemy.previousX, enemy.x, this.interpolation)
      const renderY = lerp(enemy.previousY, enemy.y, this.interpolation)
      const moveRatio = clamp(Math.hypot(enemy.vx, enemy.vy) / Math.max(1, enemy.speed), 0, 1.6)
      const attackProgress = motionProgress(
        enemy.attackMotionRemaining,
        enemy.attackMotionDuration,
      )
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
          })
      enemy.sprite.anchor.set(
        0.5 + pose.pivotX,
        (enemy.isBoss ? 0.62 : 0.6) + pose.pivotY,
      )
      this.drawEnemyMotionAccent(
        enemy,
        renderX,
        renderY,
        pose,
        moveRatio,
        attackProgress,
        activeHordeCount,
      )
      enemy.sprite.position.set(renderX + pose.offsetX, renderY + pose.offsetY)
      enemy.sprite.rotation = pose.rotation
      enemy.sprite.scale.set(
        enemy.baseScaleX * enemy.facing * pose.scaleX,
        enemy.baseScaleY * pose.scaleY,
      )
      enemy.sprite.tint = enemy.hitFlash > 0 ? 0xffffff : enemy.isBoss ? this.bossTint() : 0xffffff
      enemy.sprite.alpha = (enemy.hitFlash > 0 ? 0.82 : 1) * pose.alpha
      if (pose.glow > 0.04) {
        const color = this.actorAccentColor(enemy)
        this.motionGraphics
          .ellipse(
            renderX,
            renderY + enemy.radius * 0.52,
            enemy.radius * (1.1 + pose.glow * 0.72),
            enemy.radius * (0.34 + pose.glow * 0.18),
          )
          .fill({ color, alpha: pose.glow * (enemy.isBoss ? 0.16 : 0.1) })
          .stroke({
            color,
            width: enemy.isBoss ? 4 : 2,
            alpha: pose.glow * (enemy.isBoss ? 0.58 : 0.42),
          })
      }
    }

    this.projectileTrailGraphics.clear()
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue
      const renderX = lerp(projectile.previousX, projectile.x, this.interpolation)
      const renderY = lerp(projectile.previousY, projectile.y, this.interpolation)
      projectile.sprite.position.set(renderX, renderY)
      projectile.sprite.rotation = Math.atan2(projectile.vy, projectile.vx)
      projectile.sprite.alpha =
        projectile.weaponId === 'rift-seeds'
          ? 0.82 + Math.sin(this.motionClock * 9 + projectile.x * 0.01) * 0.12
          : 0.98
      this.drawProjectileTrail(projectile, renderX, renderY)
    }

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
        const color = pickup.kind === 'dawnheart'
          ? 0xff6f86
          : pickup.kind === 'gravestar'
            ? 0xffd978
            : 0x70ecff
        const pulse = 34 + Math.sin(pickup.age * 3.8) * 4
        this.pickupAuraGraphics
          .circle(renderX, renderY, pulse)
          .fill({ color, alpha: 0.055 })
          .stroke({ color, width: 3, alpha: 0.52 })
        this.pickupAuraGraphics
          .circle(renderX, renderY, pulse + 10)
          .stroke({ color, width: 1, alpha: 0.2 })
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
    if (!this.enemyFrames.length) return
    let enemy = this.enemies.find((candidate) => !candidate.active)
    if (!enemy) {
      const sprite = new Sprite(this.enemyFrames[0])
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
    const frameIndex = Math.max(0, ENEMY_IDS.indexOf(id))
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
        : id === 'railjaw'
          ? this.random.range(4.2, 6.2)
          : id === 'chronowisp'
            ? this.random.range(4.8, 7)
            : id === 'cinder-guard'
              ? this.random.range(5.2, 7.8)
              : 99
    enemy.sprite.texture = this.enemyFrames[frameIndex]
    enemy.sprite.anchor.set(0.5, 0.6)
    enemy.sprite.width = size
    enemy.sprite.height = size * 1.2
    enemy.baseScaleX = Math.abs(enemy.sprite.scale.x)
    enemy.baseScaleY = Math.abs(enemy.sprite.scale.y)
    enemy.sprite.scale.set(enemy.baseScaleX * enemy.facing, enemy.baseScaleY)
    enemy.sprite.rotation = 0
    enemy.sprite.tint = 0xffffff
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
                [106, -18],
                [72, 88],
                [-14, 118],
                [-101, 72],
                [-124, -24],
                [-74, -97],
                [22, -118],
                [96, -71],
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
                  [168, -22],
                  [112, 142],
                  [-28, 176],
                  [-158, 112],
                  [-188, -34],
                  [-118, -154],
                  [24, -180],
                  [148, -104],
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
    if (this.bossSpawned || !this.bossFrames.length) return
    this.bossSpawned = true
    let enemy = this.enemies.find((candidate) => !candidate.active)
    if (!enemy) {
      const sprite = new Sprite(this.bossFrames[0])
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
    enemy.isBoss = true
    enemy.phase = 1
    enemy.facing = 1
    const introDuration = this.qaMode ? 1.05 : 1.65
    enemy.attackMotionStyle = 'boss-intro'
    enemy.attackMotionRemaining = introDuration
    enemy.attackMotionDuration = enemy.attackMotionRemaining
    enemy.attackMotionAngle = Math.atan2(this.player.y - y, this.player.x - x)
    enemy.attackTimer = 1.75
    enemy.sprite.texture = this.bossFrames[this.bossLevel.bossFrame % 6]
    enemy.sprite.anchor.set(0.5, 0.62)
    enemy.sprite.width = 210 + this.bossLevel.id * 3
    enemy.sprite.height = 245 + this.bossLevel.id * 4
    enemy.baseScaleX = Math.abs(enemy.sprite.scale.x)
    enemy.baseScaleY = Math.abs(enemy.sprite.scale.y)
    enemy.sprite.scale.set(enemy.baseScaleX, enemy.baseScaleY)
    enemy.sprite.rotation = 0
    enemy.sprite.tint = this.bossTint()
    enemy.sprite.visible = true
    enemy.sprite.position.set(x, y)
    this.boss = enemy
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
          this.rings.push({
            x: enemy.x,
            y: enemy.y,
            radius: 15,
            maxRadius: 260,
            life: 0.7,
            total: 0.7,
            color: bossPresentation(this.bossLevel.bossId).primaryColor,
            width: 8,
          })
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
      if (Math.abs(enemy.vx) > 2) enemy.facing = enemy.vx >= 0 ? 1 : -1
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
        this.damagePlayer(enemy.damage)
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
      this.triggerEnemyAttack(enemy, 'cast', 1.15, angle, true)
      this.queueCircleTelegraph(
        this.player.x,
        this.player.y,
        58,
        1.15,
        enemy.damage * 0.8,
        false,
        this.actorAccentColor(enemy),
      )
      enemy.attackTimer = this.random.range(4.8, 6.8)
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
      this.triggerEnemyAttack(enemy, 'blink', 0.52, angle, true)
      const oldX = enemy.x
      const oldY = enemy.y
      const blinkAngle = this.random.range(0, Math.PI * 2)
      const blinkDistance = this.random.range(190, 300)
      enemy.x = clamp(this.player.x + Math.cos(blinkAngle) * blinkDistance, 52, WORLD_WIDTH - 52)
      enemy.y = clamp(this.player.y + Math.sin(blinkAngle) * blinkDistance, 48, WORLD_HEIGHT - 48)
      enemy.previousX = enemy.x
      enemy.previousY = enemy.y
      enemy.contactCooldown = 0.9
      this.rings.push(
        { x: oldX, y: oldY, radius: 4, maxRadius: 58, life: 0.34, total: 0.34, color: 0x8de9ff, width: 4 },
        { x: enemy.x, y: enemy.y, radius: 4, maxRadius: 58, life: 0.34, total: 0.34, color: 0x8de9ff, width: 4 },
      )
      enemy.attackTimer = this.random.range(5.8, 8)
      return
    }

    if (enemy.id === 'cinder-guard') {
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
        cooldown =
          definition.cooldown *
          Math.max(0.45, 1 - (owned.rank - 1) * 0.055 - moduleRank * 0.035) *
          redShiftCadence *
          (owned.awakened ? 0.68 : 1)
      }
      this.weaponCooldowns.set(owned.id, cooldown)
    }
  }

  private fireWeapon(owned: OwnedWeapon) {
    const definition = WEAPONS[owned.id]
    const target = this.nearestEnemy(this.player.x, this.player.y)
    if (!target) return
    const rank = Math.max(1, owned.rank)
    const moduleRank = this.modules.find((module) => module.id === definition.moduleId)?.rank ?? 0
    const visualState = resolveWeaponVfxState(rank, moduleRank, Boolean(owned.awakened))
    const visualSeed = this.attackVolley * 97 + rank * 13 + moduleRank * 29 + (owned.awakened ? 53 : 0)
    const damage = definition.damage * (1 + (rank - 1) * 0.31) * (owned.awakened ? 1.5 : 1)
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
      case 'helio-lance':
        this.emitWeaponCastVfx(owned.id, visualState, angle, 0, visualSeed)
        this.spawnProjectile(
          owned.id,
          angle,
          720 + moduleRank * 55,
          damage * (1 + moduleRank * 0.08),
          1 + Math.floor(rank / 3),
          0,
          definition.color,
          1.45 + moduleRank * 0.14,
          visualState,
          visualSeed,
        )
        if (owned.awakened) {
          this.spawnProjectile(
            owned.id,
            angle + 0.08,
            760,
            damage * 0.72,
            2,
            0,
            0xffffff,
            1.45,
            visualState,
            visualSeed + 1,
          )
          this.spawnProjectile(
            owned.id,
            angle - 0.08,
            760,
            damage * 0.72,
            2,
            0,
            0xffffff,
            1.45,
            visualState,
            visualSeed + 2,
          )
        }
        break
      case 'crescent-array': {
        const blades = Math.min(10, 2 + rank + moduleRank + (owned.awakened ? 2 : 0))
        this.emitWeaponCastVfx(owned.id, visualState, angle, 116 + blades * 4, visualSeed)
        for (let index = 0; index < blades; index += 1) {
          const bladeAngle = (Math.PI * 2 * index) / blades + this.elapsed * 1.4
          this.spawnProjectile(
            owned.id,
            bladeAngle,
            310,
            damage,
            2,
            0,
            definition.color,
            1.45,
            visualState,
            visualSeed + index,
          )
        }
        break
      }
      case 'arc-choir':
        this.chainLightning(
          target,
          damage * (1 + moduleRank * 0.07),
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
          damage * (1 + moduleRank * 0.12),
          0,
          0.4,
          definition.color,
          1.25 + moduleRank * 0.12,
          visualState,
          visualSeed,
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
            damage * (1 + moduleRank * 0.06),
            0,
            3.2 + moduleRank * 0.8,
            definition.color,
            1.45,
            visualState,
            visualSeed + index,
          )
        }
        break
      }
      case 'ash-halo': {
        const radius = 126 + rank * 16 + moduleRank * 18
        const impacts = this.areaDamage(
          this.player.x,
          this.player.y,
          radius,
          damage * (1 + moduleRank * 0.1),
          owned.id,
        )
        this.emitWeaponCastVfx(
          owned.id,
          visualState,
          angle,
          radius,
          visualSeed,
          impacts,
        )
        break
      }
      case 'mirror-bow':
        this.emitWeaponCastVfx(owned.id, visualState, angle, 128, visualSeed)
        this.spawnProjectile(
          owned.id,
          angle,
          620,
          damage * (1 + moduleRank * 0.08),
          3 + Math.floor(rank / 2) + moduleRank,
          0,
          definition.color,
          1.45,
          visualState,
          visualSeed,
        )
        this.spawnProjectile(
          owned.id,
          angle + Math.PI,
          620,
          damage * 0.75,
          2,
          0,
          0xdaf6ff,
          1.45,
          visualState,
          visualSeed + 1,
        )
        if (owned.awakened) {
          this.spawnBurst(this.player.x, this.player.y, 0xe9f8ff, 10, 130)
        }
        break
      case 'null-bell': {
        const radius = 220 + rank * 22 + moduleRank * 14
        const impacts = this.areaDamage(
          this.player.x,
          this.player.y,
          radius,
          damage * (1 + moduleRank * 0.13),
          owned.id,
        )
        this.emitWeaponCastVfx(
          owned.id,
          visualState,
          angle,
          radius,
          visualSeed,
          impacts,
        )
        break
      }
    }

    if (this.traceMods.includes('crossfire') && this.attackVolley % 4 === 0) {
      this.spawnProjectile(
        owned.id,
        angle + Math.PI,
        520,
        damage * 0.72,
        1,
        0,
        definition.color,
        1.45,
        visualState,
        visualSeed + 41,
      )
    }
    this.audio.play('shot', owned.id === 'null-bell' ? 0.65 : 0.22)
  }

  private pushWeaponEffect(effect: WeaponEffectEntity) {
    if (effect.kind === 'ash-corona' || effect.kind === 'null-toll') {
      const existing = this.weaponEffects.find(
        (candidate) => candidate.kind === effect.kind,
      )
      if (existing) {
        existing.visualState = effect.visualState
        existing.radius = effect.radius
        existing.maxRadius = effect.maxRadius
        existing.points = effect.points
        existing.hitPulseLife = effect.hitPulseLife
        existing.hitPulseTotal = effect.hitPulseTotal

        if (effect.kind === 'ash-corona') {
          // Keep the field alive without rewinding its breathing phase on
          // every rapid cast. The short hit accent is refreshed separately.
          existing.life = effect.life
          existing.total = effect.total
        } else {
          const existingProgress = clamp(
            1 - existing.life / Math.max(existing.total, 0.001),
            0,
            1,
          )
          // Let an active pressure wave finish. A dense cooldown build may
          // retrigger only after the previous toll has entered its decay.
          if (existingProgress >= 0.72) {
            existing.x = effect.x
            existing.y = effect.y
            existing.angle = effect.angle
            existing.seed = effect.seed
            existing.life = effect.life
            existing.total = effect.total
          }
        }
        return
      }
    }
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
  ) {
    const kind: Record<WeaponId, WeaponEffectKind | undefined> = {
      'helio-lance': 'helio-gate',
      'crescent-array': 'crescent-orbit',
      'arc-choir': undefined,
      'rift-seeds': 'rift-cast',
      'comet-swarm': 'comet-launch',
      'ash-halo': 'ash-corona',
      'mirror-bow': 'mirror-gate',
      'null-bell': 'null-toll',
    }
    const effectKind = kind[weaponId]
    if (!effectKind) return
    const duration = {
      'helio-lance': 0.46,
      'crescent-array': 0.62,
      'arc-choir': 0.5,
      'rift-seeds': 0.58,
      'comet-swarm': 0.42,
      'ash-halo': visualState.stage === 'final' ? 0.74 : 0.56,
      'mirror-bow': 0.5,
      'null-bell': visualState.stage === 'final' ? 1.08 : 0.86,
    }[weaponId] ?? 0.5
    const hitPulseTotal =
      weaponId === 'ash-halo' ? 0.24 : weaponId === 'null-bell' ? 0.34 : undefined
    this.pushWeaponEffect({
      kind: effectKind,
      weaponId,
      visualState,
      x: this.player.x,
      y: this.player.y,
      angle,
      radius: Math.max(24, radius * 0.22),
      maxRadius: Math.max(54, radius),
      life: duration,
      total: duration,
      seed,
      points: points.slice(0, 12),
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
          this.areaDamage(projectile.x, projectile.y, 92, projectile.damage * 1.3, projectile.weaponId)
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
        this.damageEnemy(enemy, projectile.damage, projectile.weaponId)
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
      hpRatio: this.player.hp / this.player.maxHp,
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

  private updatePickups(delta: number) {
    const magnetRank = this.persistentUpgrades.magnetism ?? 0
    const gravRank = this.modules.find((module) => module.id === 'grav-anchor')?.rank ?? 0
    const magnetRadius = 132 * (1 + magnetRank * 0.07 + gravRank * 0.12)

    for (const pickup of this.pickups) {
      if (!pickup.active) continue
      pickup.previousX = pickup.x
      pickup.previousY = pickup.y
      pickup.age += delta
      if (pickup.age > (pickup.kind === 'xp' ? 32 : 42)) {
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
          this.collectSupportPickup(pickup.kind)
        }
      }
    }
  }

  private collectExperience(value: number) {
    this.player.pulseCharge = clamp(this.player.pulseCharge + value * 0.16, 0, 100)
    if (this.runConfig.fixedLoadout) return
    this.player.xp += value
    while (this.player.xp >= this.player.xpToNext && !this.upgradeOptions?.length) {
      this.levelUp()
    }
  }

  private collectSupportPickup(kind: SupportPickupKind) {
    let color = 0x70ecff
    if (kind === 'dawnheart') {
      color = 0xff6f86
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.14)
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
      this.player.pulseCharge = clamp(this.player.pulseCharge + 35, 0, 100)
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
      const impactColor = telegraph.color ?? (
        telegraph.bossAttack
          ? bossPresentation(this.bossLevel.bossId).primaryColor
          : HOSTILE_WARNING_COLOR
      )
      this.rings.push({
        x: telegraph.x,
        y: telegraph.y,
        radius: telegraph.kind === 'circle' ? 10 : Math.min(telegraph.length, 80),
        maxRadius: telegraph.kind === 'circle' ? telegraph.radius : Math.min(telegraph.length, 180),
        life: 0.26,
        total: 0.26,
        color: impactColor,
        width: 10,
      })
      if (telegraph.kind === 'line') {
        const endX = telegraph.x + Math.cos(telegraph.angle) * telegraph.length
        const endY = telegraph.y + Math.sin(telegraph.angle) * telegraph.length
        this.loopEffects.push({
          points: [
            { x: telegraph.x, y: telegraph.y },
            { x: endX, y: endY },
          ],
          life: telegraph.bossAttack ? 0.32 : 0.22,
          total: telegraph.bossAttack ? 0.32 : 0.22,
          color: impactColor,
          closed: false,
          width: Math.max(6, telegraph.width * (telegraph.bossAttack ? 0.32 : 0.2)),
        })
        this.spawnBurst(
          lerp(telegraph.x, endX, 0.72),
          lerp(telegraph.y, endY, 0.72),
          impactColor,
          telegraph.bossAttack ? 12 : 6,
          telegraph.bossAttack ? 220 : 130,
        )
      } else {
        this.spawnBurst(
          telegraph.x,
          telegraph.y,
          impactColor,
          telegraph.bossAttack ? 18 : 9,
          telegraph.bossAttack ? 220 : 150,
        )
      }
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
    if (distanceSquared(last, point) < 11 ** 2) return
    this.trace.push(point)
    const memoryRank = this.persistentUpgrades.pulse ?? 0
    const maxPoints = 72 + memoryRank * 3 + (this.traceMods.includes('afterimage') ? 22 : 0)
    if (this.trace.length > maxPoints) this.trace.splice(0, this.trace.length - maxPoints)
    if (this.trace.length < 10) return

    // Let a near-return close the circuit as well as an exact segment crossing.
    // Keyboard and touch movement rarely land on the identical sub-pixel, so this
    // small magnetic latch makes intentionally drawn loops feel dependable.
    for (let index = 0; index < this.trace.length - 8; index += 1) {
      if (distanceSquared(point, this.trace[index]) > 30 ** 2) continue
      const polygon = [this.trace[index], ...this.trace.slice(index + 1)]
      const area = polygonArea(polygon)
      if (area < 2100) continue
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
      if (area < 2100) continue
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
    this.player.pulseCharge = clamp(this.player.pulseCharge + 17 + Math.min(46, chain * 2.8), 0, 100)
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
    if (!enemy.active || rawDamage <= 0) return
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
        this.rings.push({
          x: enemy.x,
          y: enemy.y,
          radius: 24,
          maxRadius: 330,
          life: 1.1,
          total: 1.1,
          color: 0xffd87a,
          width: 12,
        })
      }
      // Remove lethal targets before any chained proc so a neighboring fracture
      // cannot recurse into the same death and award it twice.
      enemy.active = false
      enemy.sprite.visible = false
    }
    if (lethal && !wasBoss) {
      // Settle the primary defeat before chained fractures. If a fracture also
      // defeats the sovereign, the emitted results already include this kill.
      this.kills += 1
      this.player.pulseCharge = clamp(this.player.pulseCharge + 1.1, 0, 100)
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
    if (this.hurtCooldown > 0 || this.completed) return
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
    this.emitSnapshot(true)
    if (this.player.hp <= 0) this.finish(false)
  }

  private finish(victory: boolean) {
    if (this.completed) return
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
      this.rings.push({
        x,
        y,
        radius: 8,
        maxRadius: 92,
        life: 0.72,
        total: 0.72,
        color,
        width: 5,
      })
      this.spawnBurst(x, y, color, 16, 170)
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

  private areaDamage(x: number, y: number, radius: number, damage: number, weaponId: WeaponId) {
    const radiusSquared = radius * radius
    const impacts: Vec2[] = []
    for (const enemy of this.enemies) {
      if (!enemy.active || (enemy.x - x) ** 2 + (enemy.y - y) ** 2 > radiusSquared) continue
      this.damageEnemy(enemy, damage, weaponId)
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
    let current: EnemyEntity | undefined = first
    for (let jump = 0; jump < jumps && current; jump += 1) {
      hit.push(current.uid)
      points.push({ x: current.x, y: current.y })
      this.damageEnemy(current, damage * Math.max(0.48, 1 - jump * 0.09), weaponId)
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
    const pattern = bossPatternForLevel(this.bossLevel.id)
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
        this.queueCircleTelegraph(
          clamp(this.player.x + Math.cos(orbit) * radius, 64, WORLD_WIDTH - 64),
          clamp(this.player.y + Math.sin(orbit) * radius, 64, WORLD_HEIGHT - 64),
          58 + enemy.phase * 4,
          warningTime + 0.12,
          enemy.damage,
          true,
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
        this.queueCircleTelegraph(
          clamp(this.player.x + Math.cos(clusterAngle) * spread, 64, WORLD_WIDTH - 64),
          clamp(this.player.y + Math.sin(clusterAngle) * spread, 64, WORLD_HEIGHT - 64),
          66 + enemy.phase * 5,
          warningTime + index * 0.06,
          enemy.damage * 1.08,
          true,
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
        this.queueCircleTelegraph(
          clamp(this.player.x + Math.cos(orbit) * orbitRadius, 62, WORLD_WIDTH - 62),
          clamp(this.player.y + Math.sin(orbit) * orbitRadius, 62, WORLD_HEIGHT - 62),
          48 + enemy.phase * 3,
          warningTime + index * 0.045,
          enemy.damage,
          true,
        )
      }
      if (enemy.phase >= 3) {
        this.queueCircleTelegraph(
          this.player.x,
          this.player.y,
          58,
          warningTime + 0.18,
          enemy.damage * 1.08,
          true,
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
        this.queueCircleTelegraph(
          clamp(center.x, 68, WORLD_WIDTH - 68),
          clamp(center.y, 68, WORLD_HEIGHT - 68),
          70 + enemy.phase * 5,
          warningTime + index * 0.1,
          enemy.damage * 1.06,
          true,
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

  private drawSegmentedRing(
    graphics: Graphics,
    x: number,
    y: number,
    radius: number,
    segments: number,
    rotation: number,
    color: number,
    width: number,
    alpha: number,
    gapRatio = 0.28,
  ) {
    const safeSegments = Math.max(3, Math.floor(segments))
    const segmentAngle = (Math.PI * 2) / safeSegments
    const arcAngle = segmentAngle * (1 - gapRatio)
    const steps = 3
    for (let segment = 0; segment < safeSegments; segment += 1) {
      const start = rotation + segment * segmentAngle
      graphics.moveTo(x + Math.cos(start) * radius, y + Math.sin(start) * radius)
      for (let step = 1; step <= steps; step += 1) {
        const angle = start + arcAngle * (step / steps)
        graphics.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
      }
    }
    graphics.stroke({ color, width, alpha })
  }

  private drawJaggedRing(
    graphics: Graphics,
    x: number,
    y: number,
    radius: number,
    pointCount: number,
    rotation: number,
    seed: number,
    jitter: number,
    color: number,
    width: number,
    alpha: number,
  ) {
    const safeCount = Math.max(12, pointCount)
    for (let index = 0; index <= safeCount; index += 1) {
      const wrappedIndex = index % safeCount
      const angle = rotation + (Math.PI * 2 * wrappedIndex) / safeCount
      const noise =
        Math.sin((seed + wrappedIndex * 17) * 1.739) * 0.62 +
        Math.sin((seed + wrappedIndex * 7) * 0.811) * 0.38
      const pointRadius = radius + noise * jitter
      const pointX = x + Math.cos(angle) * pointRadius
      const pointY = y + Math.sin(angle) * pointRadius
      if (index === 0) graphics.moveTo(pointX, pointY)
      else graphics.lineTo(pointX, pointY)
    }
    graphics.stroke({ color, width, alpha })
  }

  private drawRadialTicks(
    graphics: Graphics,
    x: number,
    y: number,
    radius: number,
    count: number,
    length: number,
    rotation: number,
    color: number,
    width: number,
    alpha: number,
  ) {
    for (let index = 0; index < count; index += 1) {
      const angle = rotation + (Math.PI * 2 * index) / count
      graphics
        .moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
        .lineTo(
          x + Math.cos(angle) * (radius + length),
          y + Math.sin(angle) * (radius + length),
        )
    }
    graphics.stroke({ color, width, alpha })
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

  private drawStarburst(
    graphics: Graphics,
    x: number,
    y: number,
    rays: number,
    innerRadius: number,
    outerRadius: number,
    rotation: number,
    color: number,
    width: number,
    alpha: number,
  ) {
    for (let index = 0; index < rays; index += 1) {
      const angle = rotation + (Math.PI * 2 * index) / rays
      const length = outerRadius * (index % 2 === 0 ? 1 : 0.64)
      graphics
        .moveTo(
          x + Math.cos(angle) * innerRadius,
          y + Math.sin(angle) * innerRadius,
        )
        .lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    }
    graphics.stroke({ color, width, alpha })
  }

  private drawCinderFeather(
    graphics: Graphics,
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    glowColor: number,
    coreColor: number,
    alpha: number,
    bend: -1 | 1,
  ) {
    const forwardX = Math.cos(angle)
    const forwardY = Math.sin(angle)
    const normalX = -forwardY
    const normalY = forwardX
    const buildPoints = (widthScale: number, lengthScale: number) => {
      const halfWidth = width * widthScale
      const tailX = x - forwardX * length * 0.48 * lengthScale
      const tailY = y - forwardY * length * 0.48 * lengthScale
      const shoulderX =
        x +
        forwardX * length * 0.02 * lengthScale +
        normalX * bend * width * 0.22
      const shoulderY =
        y +
        forwardY * length * 0.02 * lengthScale +
        normalY * bend * width * 0.22
      const tipX =
        x +
        forwardX * length * 0.58 * lengthScale +
        normalX * bend * width * 0.48
      const tipY =
        y +
        forwardY * length * 0.58 * lengthScale +
        normalY * bend * width * 0.48
      return [
        tailX + normalX * halfWidth * 0.18,
        tailY + normalY * halfWidth * 0.18,
        shoulderX + normalX * halfWidth,
        shoulderY + normalY * halfWidth,
        tipX,
        tipY,
        shoulderX - normalX * halfWidth * 0.62,
        shoulderY - normalY * halfWidth * 0.62,
        tailX - normalX * halfWidth * 0.12,
        tailY - normalY * halfWidth * 0.12,
      ]
    }

    graphics
      .poly(buildPoints(1.28, 1.08), true)
      .fill({ color: glowColor, alpha: alpha * 0.15 })
    graphics
      .poly(buildPoints(0.72, 1), true)
      .fill({ color: glowColor, alpha: alpha * 0.62 })
    graphics
      .poly(buildPoints(0.28, 0.86), true)
      .fill({ color: coreColor, alpha: alpha * 0.92 })
  }

  private drawBellGlyph(
    graphics: Graphics,
    x: number,
    y: number,
    size: number,
    rotation: number,
    edgeColor: number,
    coreColor: number,
    alpha: number,
  ) {
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const transform = (localX: number, localY: number): [number, number] => [
      x + (localX * cos - localY * sin) * size,
      y + (localX * sin + localY * cos) * size,
    ]
    const canopy = [
      transform(-0.5, 0.24),
      transform(-0.34, -0.28),
      transform(-0.2, -0.48),
      transform(0.2, -0.48),
      transform(0.34, -0.28),
      transform(0.5, 0.24),
      transform(0.3, 0.34),
      transform(-0.3, 0.34),
    ].flat()
    const clapper = [
      transform(0, 0.22),
      transform(0.16, 0.5),
      transform(0, 0.66),
      transform(-0.16, 0.5),
    ].flat()

    graphics
      .poly(canopy, true)
      .fill({ color: 0x0b0d21, alpha: alpha * 0.74 })
      .stroke({ color: edgeColor, width: Math.max(1.5, size * 0.08), alpha })
    graphics
      .poly(clapper, true)
      .fill({ color: coreColor, alpha: alpha * 0.94 })
  }

  private drawPressureWedge(
    graphics: Graphics,
    x: number,
    y: number,
    angle: number,
    distance: number,
    length: number,
    width: number,
    edgeColor: number,
    fillColor: number,
    alpha: number,
  ) {
    const forwardX = Math.cos(angle)
    const forwardY = Math.sin(angle)
    const normalX = -forwardY
    const normalY = forwardX
    const backX = x + forwardX * (distance - length * 0.52)
    const backY = y + forwardY * (distance - length * 0.52)
    const shoulderX = x + forwardX * (distance + length * 0.16)
    const shoulderY = y + forwardY * (distance + length * 0.16)
    const tipX = x + forwardX * (distance + length * 0.64)
    const tipY = y + forwardY * (distance + length * 0.64)

    graphics
      .poly(
        [
          backX + normalX * width * 0.22,
          backY + normalY * width * 0.22,
          shoulderX + normalX * width * 0.5,
          shoulderY + normalY * width * 0.5,
          tipX,
          tipY,
          shoulderX - normalX * width * 0.5,
          shoulderY - normalY * width * 0.5,
          backX - normalX * width * 0.22,
          backY - normalY * width * 0.22,
          x + forwardX * (distance - length * 0.12),
          y + forwardY * (distance - length * 0.12),
        ],
        true,
      )
      .fill({ color: fillColor, alpha: alpha * 0.12 })
      .stroke({
        color: edgeColor,
        width: Math.max(1.4, width * 0.055),
        alpha: alpha * 0.88,
      })
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
    graphics
      .poly(
        [
          x + tangentX * size,
          y + tangentY * size,
          x + radialX * size * 0.64,
          y + radialY * size * 0.64,
          x - tangentX * size,
          y - tangentY * size,
          x - radialX * size * 0.12,
          y - radialY * size * 0.12,
        ],
        true,
      )
      .fill({ color, alpha: alpha * 0.3 })
      .stroke({ color: 0xf2feff, width: Math.max(1.4, size * 0.16), alpha })
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

  private drawWeaponEffects() {
    this.weaponVfxGraphics.clear()
    const graphics = this.weaponVfxGraphics
    for (let index = this.weaponEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.weaponEffects[index]
      if (effect.life <= 0) {
        this.weaponEffects.splice(index, 1)
        continue
      }
      if (effect.kind === 'ash-corona') {
        effect.x = this.player.x
        effect.y = this.player.y
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
          const gateRadius = 22 + stage * 9 + attack * 8
          graphics
            .circle(effect.x, effect.y, gateRadius * 1.24)
            .fill({ color: profile.glowColor, alpha: motionAlpha * 0.035 })
          this.drawSegmentedRing(
            graphics,
            effect.x,
            effect.y,
            gateRadius,
            8 + stage * 2,
            -rotation,
            profile.accentColor,
            2.2 + stage * 0.4,
            motionAlpha * 0.84,
          )
          if (stage >= 1) {
            this.drawSegmentedRing(
              graphics,
              effect.x,
              effect.y,
              gateRadius * 1.5,
              6 + stage * 3,
              rotation * 0.7,
              profile.secondaryColor,
              1.5 + stage * 0.24,
              motionAlpha * 0.56,
              0.44,
            )
          }
          this.drawRadialTicks(
            graphics,
            effect.x,
            effect.y,
            gateRadius * 1.03,
            8 + stage * 4,
            5 + stage * 2,
            rotation,
            profile.coreColor,
            1.4,
            motionAlpha * 0.72,
          )
          const normalX = -Math.sin(effect.angle)
          const normalY = Math.cos(effect.angle)
          const railLength = 76 + stage * 20
          for (const side of stage >= 1 ? [-1, 1] : [0]) {
            const offset = side * (7 + stage * 2)
            graphics
              .moveTo(effect.x + normalX * offset, effect.y + normalY * offset)
              .lineTo(
                effect.x + Math.cos(effect.angle) * railLength + normalX * offset,
                effect.y + Math.sin(effect.angle) * railLength + normalY * offset,
              )
              .stroke({
                color: side === 0 ? profile.coreColor : profile.secondaryColor,
                width: side === 0 ? 3.2 : 1.6,
                alpha: motionAlpha * (side === 0 ? 0.9 : 0.58),
              })
          }
          break
        }
        case 'helio-impact': {
          graphics
            .circle(effect.x, effect.y, radius * 0.34)
            .fill({ color: profile.glowColor, alpha: motionAlpha * 0.12 })
          this.drawStarburst(
            graphics,
            effect.x,
            effect.y,
            8 + stage * 2,
            4,
            radius,
            rotation,
            profile.coreColor,
            2.4 + stage * 0.35,
            motionAlpha * 0.9,
          )
          this.drawSegmentedRing(
            graphics,
            effect.x,
            effect.y,
            radius * 0.72,
            8 + stage * 2,
            -rotation,
            profile.accentColor,
            2,
            motionAlpha * 0.68,
          )
          break
        }
        case 'crescent-orbit': {
          const orbitCount = 3 + stage * 2 + (state.awakened ? 1 : 0)
          const orbitRadius = radius * (0.68 + attack * 0.32)
          if (stage === 3) {
            graphics
              .circle(effect.x, effect.y, orbitRadius * 0.38)
              .fill({ color: 0x01070c, alpha: motionAlpha * 0.46 })
              .stroke({ color: profile.secondaryColor, width: 2, alpha: motionAlpha * 0.62 })
          }
          this.drawSegmentedRing(
            graphics,
            effect.x,
            effect.y,
            orbitRadius,
            10 + stage * 4,
            rotation,
            profile.secondaryColor,
            1.5 + stage * 0.22,
            motionAlpha * 0.48,
            0.48,
          )
          if (stage >= 1) {
            this.drawSegmentedRing(
              graphics,
              effect.x,
              effect.y,
              orbitRadius * 0.56,
              8 + stage * 2,
              -rotation * 1.3,
              profile.accentColor,
              1.3,
              motionAlpha * 0.4,
              0.52,
            )
          }
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
          this.drawSegmentedRing(
            graphics,
            effect.x,
            effect.y,
            radius * 0.62,
            shards,
            rotation,
            profile.accentColor,
            2.1,
            motionAlpha * 0.72,
          )
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
            graphics
              .circle(node.x, node.y, nodeRadius * 1.5)
              .fill({ color: profile.glowColor, alpha: motionAlpha * 0.055 })
            this.drawSegmentedRing(
              graphics,
              node.x,
              node.y,
              nodeRadius,
              6 + stage * 2,
              rotation + nodeIndex,
              profile.accentColor,
              1.8,
              motionAlpha * 0.84,
              0.34,
            )
            this.drawDiamondGlyph(
              graphics,
              node.x,
              node.y,
              4 + stage,
              -rotation,
              profile.coreColor,
              motionAlpha,
              stage >= 2,
            )
          }
          if (stage === 3) {
            this.drawSegmentedRing(
              graphics,
              effect.x,
              effect.y,
              radius * 0.82,
              16,
              -rotation,
              profile.secondaryColor,
              2.4,
              motionAlpha * 0.58,
              0.52,
            )
            this.drawRadialTicks(
              graphics,
              effect.x,
              effect.y,
              radius * 0.82,
              12,
              10,
              rotation,
              profile.coreColor,
              1.6,
              motionAlpha * 0.62,
            )
          }
          break
        }
        case 'rift-cast':
        case 'rift-impact': {
          const impact = effect.kind === 'rift-impact'
          const centerX = impact ? effect.x : effect.x + Math.cos(effect.angle) * (34 + stage * 5)
          const centerY = impact ? effect.y : effect.y + Math.sin(effect.angle) * (34 + stage * 5)
          const coreRadius = impact ? radius * (0.19 + stage * 0.018) : 10 + stage * 2.5
          graphics
            .circle(centerX, centerY, coreRadius * 2.2)
            .fill({ color: profile.glowColor, alpha: motionAlpha * 0.11 })
          graphics
            .circle(centerX, centerY, coreRadius * 1.18)
            .stroke({
              color: profile.glowColor,
              width: 8 + stage * 1.2,
              alpha: motionAlpha * 0.12,
            })
          graphics
            .circle(centerX, centerY, coreRadius)
            .fill({ color: 0x010708, alpha: motionAlpha * 0.92 })
            .stroke({ color: profile.coreColor, width: 2.2 + stage * 0.35, alpha: motionAlpha })
          const orbitCount = 1 + stage + (impact ? 1 : 0)
          for (let orbit = 0; orbit < orbitCount; orbit += 1) {
            const orbitRadius = coreRadius * (1.8 + orbit * 0.78)
            this.drawSegmentedRing(
              graphics,
              centerX,
              centerY,
              orbitRadius,
              7 + stage * 2 + orbit,
              (orbit % 2 ? -1 : 1) * rotation * (1 + orbit * 0.2),
              profile.glowColor,
              6 + (orbit === 0 ? 2 : 0),
              motionAlpha * (0.08 - orbit * 0.008),
              0.46,
            )
            this.drawSegmentedRing(
              graphics,
              centerX,
              centerY,
              orbitRadius,
              7 + stage * 2 + orbit,
              (orbit % 2 ? -1 : 1) * rotation * (1 + orbit * 0.2),
              orbit % 2 ? profile.secondaryColor : profile.accentColor,
              1.5 + (orbit === 0 ? 0.8 : 0),
              motionAlpha * (0.72 - orbit * 0.1),
              0.46,
            )
          }
          for (let satellite = 0; satellite < stage; satellite += 1) {
            const satelliteAngle =
              -rotation * 0.9 + (Math.PI * 2 * satellite) / Math.max(1, stage)
            const satelliteOrbit = coreRadius * (3.25 + (satellite % 2) * 0.72)
            const satelliteRadius = coreRadius * (0.22 + stage * 0.025)
            const satelliteX = centerX + Math.cos(satelliteAngle) * satelliteOrbit
            const satelliteY = centerY + Math.sin(satelliteAngle) * satelliteOrbit
            graphics
              .circle(satelliteX, satelliteY, satelliteRadius * 1.8)
              .fill({ color: profile.glowColor, alpha: motionAlpha * 0.09 })
            graphics
              .circle(satelliteX, satelliteY, satelliteRadius)
              .fill({ color: 0x010708, alpha: motionAlpha * 0.94 })
              .stroke({
                color: satellite % 2 ? profile.secondaryColor : profile.coreColor,
                width: 1.8 + stage * 0.18,
                alpha: motionAlpha * 0.9,
              })
          }
          const shards = 3 + stage * 2 + (impact ? 2 : 0)
          for (let shard = 0; shard < shards; shard += 1) {
            const shardAngle = -rotation * 0.8 + (Math.PI * 2 * shard) / shards
            const shardRadius = coreRadius * (2.2 + (shard % 3) * 0.62)
            this.drawDiamondGlyph(
              graphics,
              centerX + Math.cos(shardAngle) * shardRadius,
              centerY + Math.sin(shardAngle) * shardRadius,
              3.4 + stage,
              shardAngle,
              shard % 2 ? profile.accentColor : profile.coreColor,
              motionAlpha * 0.72,
              stage === 3,
            )
          }
          break
        }
        case 'comet-launch': {
          const rays = 4 + stage * 2
          this.drawStarburst(
            graphics,
            effect.x,
            effect.y,
            rays,
            12,
            radius,
            effect.angle - Math.PI * 0.5,
            profile.accentColor,
            1.8 + stage * 0.3,
            motionAlpha * 0.64,
          )
          this.drawSegmentedRing(
            graphics,
            effect.x,
            effect.y,
            24 + stage * 6,
            6 + stage * 2,
            rotation,
            profile.secondaryColor,
            1.5,
            motionAlpha * 0.48,
            0.56,
          )
          break
        }
        case 'comet-impact': {
          graphics
            .circle(effect.x, effect.y, radius * 0.26)
            .fill({ color: profile.glowColor, alpha: motionAlpha * 0.18 })
          this.drawStarburst(
            graphics,
            effect.x,
            effect.y,
            8 + stage * 2,
            3,
            radius,
            rotation,
            profile.coreColor,
            2 + stage * 0.32,
            motionAlpha,
          )
          this.drawSegmentedRing(
            graphics,
            effect.x,
            effect.y,
            radius * 0.72,
            7 + stage * 2,
            -rotation,
            profile.accentColor,
            2,
            motionAlpha * 0.66,
          )
          break
        }
        case 'ash-corona': {
          const motif = weaponVfxMotifProfile('ash-halo', state)
          const crownCycle =
            ((this.motionClock * (0.38 + stage * 0.035) +
              effect.seed * 0.00071) %
              1 +
              1) %
            1
          const crownBreath = (Math.sin(crownCycle * Math.PI * 2) + 1) * 0.5
          const hitPulse = clamp(
            (effect.hitPulseLife ?? 0) /
              Math.max(effect.hitPulseTotal ?? 1, 0.001),
            0,
            1,
          )
          const holdFade = clamp(effect.life / 0.16, 0, 1)
          const crownAlpha =
            holdFade *
            (0.68 + crownBreath * 0.16 + hitPulse * 0.16) *
            (this.settings.reducedFlash ? 0.7 : 1)
          const crownRadius =
            effect.maxRadius * (0.72 + crownBreath * 0.08 + hitPulse * 0.05)
          const crownRotation =
            effect.angle +
            this.motionClock * (0.34 + stage * 0.055) +
            effect.seed * 0.013
          const membranePoints: number[] = []
          for (let point = 0; point < 12; point += 1) {
            const pointAngle =
              crownRotation * 0.32 + (Math.PI * 2 * point) / 12
            const noise =
              0.92 +
              Math.sin((effect.seed + point * 19) * 1.371) * 0.045 +
              Math.sin(crownCycle * Math.PI * 2 + point * 1.83) * 0.025
            membranePoints.push(
              effect.x + Math.cos(pointAngle) * crownRadius * noise,
              effect.y + Math.sin(pointAngle) * crownRadius * noise * 0.78,
            )
          }
          graphics
            .poly(membranePoints, true)
            .fill({
              color: 0x57252a,
              alpha: crownAlpha * (0.022 + stage * 0.004),
            })

          const featherPositions: Vec2[] = []
          const halfFinalCount = Math.ceil(motif.primaryCount / 2)
          for (let feather = 0; feather < motif.primaryCount; feather += 1) {
            const direction: -1 | 1 = feather % 2 === 0 ? 1 : -1
            let featherAngle: number
            if (stage === 3) {
              const wing = feather < halfFinalCount ? -1 : 1
              const slot = feather % halfFinalCount
              const fanOffset = (slot - (halfFinalCount - 1) * 0.5) * 0.24
              featherAngle =
                crownRotation * 0.48 +
                (wing < 0 ? Math.PI * 0.08 : Math.PI * 1.08) +
                wing * fanOffset
            } else {
              const jitter = Math.sin((effect.seed + feather * 23) * 1.19) * 0.1
              featherAngle =
                crownRotation * (direction > 0 ? 0.62 : -0.44) +
                (Math.PI * 2 * feather) / motif.primaryCount +
                jitter
            }
            const featherRadius =
              crownRadius *
              (0.68 + ((effect.seed + feather * 11) % 17) / 100)
            const featherX = effect.x + Math.cos(featherAngle) * featherRadius
            const featherY =
              effect.y + Math.sin(featherAngle) * featherRadius * 0.78
            featherPositions.push({ x: featherX, y: featherY })
            this.drawCinderFeather(
              graphics,
              featherX,
              featherY,
              featherAngle + direction * Math.PI * 0.48,
              25 + stage * 7 + hitPulse * 8,
              7 + stage * 1.7,
              profile.glowColor,
              feather % 3 === 0 ? profile.coreColor : profile.secondaryColor,
              crownAlpha * (0.72 + hitPulse * 0.18),
              direction,
            )
            this.drawDiamondGlyph(
              graphics,
              featherX,
              featherY,
              2.8 + stage * 0.6,
              featherAngle,
              feather % 2 ? profile.secondaryColor : profile.coreColor,
              crownAlpha * 0.82,
              true,
            )
          }

          const lashAlpha =
            hitPulse * holdFade * (this.settings.reducedFlash ? 0.7 : 1)
          for (let hit = 0; hit < Math.min(effect.points?.length ?? 0, 3 + stage); hit += 1) {
            const target = effect.points?.[hit]
            const source = featherPositions[hit % featherPositions.length]
            if (!target || !source) continue
            const dx = target.x - source.x
            const dy = target.y - source.y
            const length = Math.max(1, Math.hypot(dx, dy))
            const normalX = -dy / length
            const normalY = dx / length
            const bend = (hit % 2 ? -1 : 1) * Math.min(18, length * 0.18)
            const lash = [
              source,
              {
                x: lerp(source.x, target.x, 0.52) + normalX * bend,
                y: lerp(source.y, target.y, 0.52) + normalY * bend,
              },
              target,
            ]
            this.drawPolyline(
              graphics,
              lash,
              profile.glowColor,
              7 + stage,
              lashAlpha * 0.1,
            )
            this.drawPolyline(
              graphics,
              lash,
              profile.coreColor,
              1.5 + stage * 0.25,
              lashAlpha * 0.82,
            )
            this.drawDiamondGlyph(
              graphics,
              target.x,
              target.y,
              4 + stage,
              crownRotation + hit,
              profile.secondaryColor,
              lashAlpha * 0.9,
              true,
            )
          }

          for (let chip = 0; chip < motif.fragmentCount; chip += 1) {
            const chipAngle =
              -crownRotation * 0.38 +
              (Math.PI * 2 * chip) / motif.fragmentCount +
              Math.sin((effect.seed + chip * 31) * 0.77) * 0.16
            const chipRadius =
              crownRadius * (0.58 + ((effect.seed + chip * 7) % 38) / 100)
            const chipX = effect.x + Math.cos(chipAngle) * chipRadius
            const chipY = effect.y + Math.sin(chipAngle) * chipRadius * 0.78
            const chipLength = 4 + (chip % 3) * 2 + stage
            graphics
              .moveTo(
                chipX - Math.cos(chipAngle) * chipLength,
                chipY - Math.sin(chipAngle) * chipLength,
              )
              .lineTo(
                chipX + Math.cos(chipAngle) * chipLength,
                chipY + Math.sin(chipAngle) * chipLength,
              )
              .stroke({
                color: chip % 2 ? profile.secondaryColor : profile.accentColor,
                width: 1.2 + (chip % 2) * 0.5,
                alpha: crownAlpha * 0.54,
              })
          }
          break
        }
        case 'mirror-gate': {
          const normalX = -Math.sin(effect.angle)
          const normalY = Math.cos(effect.angle)
          const forwardX = Math.cos(effect.angle)
          const forwardY = Math.sin(effect.angle)
          const gateRadius = 30 + stage * 10
          this.drawDiamondGlyph(
            graphics,
            effect.x,
            effect.y,
            gateRadius,
            effect.angle,
            profile.accentColor,
            motionAlpha * 0.72,
          )
          if (stage >= 1) {
            this.drawDiamondGlyph(
              graphics,
              effect.x,
              effect.y,
              gateRadius * 0.62,
              -effect.angle + progress,
              profile.secondaryColor,
              motionAlpha * 0.56,
            )
          }
          const railLength = 92 + stage * 38
          for (const direction of [-1, 1]) {
            for (const side of [-1, 1]) {
              const offset = side * (6 + stage * 2)
              graphics
                .moveTo(effect.x + normalX * offset, effect.y + normalY * offset)
                .lineTo(
                  effect.x + forwardX * railLength * direction + normalX * offset,
                  effect.y + forwardY * railLength * direction + normalY * offset,
                )
            }
            graphics.stroke({
              color: direction > 0 ? profile.coreColor : profile.secondaryColor,
              width: 1.6 + stage * 0.34,
              alpha: motionAlpha * (direction > 0 ? 0.76 : 0.56),
            })
          }
          const shards = 4 + stage * 2
          for (let shard = 0; shard < shards; shard += 1) {
            const shardAngle = rotation + (Math.PI * 2 * shard) / shards
            this.drawDiamondGlyph(
              graphics,
              effect.x + Math.cos(shardAngle) * gateRadius * 1.25,
              effect.y + Math.sin(shardAngle) * gateRadius * 1.25,
              3 + stage,
              shardAngle,
              shard % 2 ? profile.accentColor : profile.secondaryColor,
              motionAlpha * 0.68,
              stage >= 2,
            )
          }
          break
        }
        case 'mirror-impact': {
          this.drawDiamondGlyph(
            graphics,
            effect.x,
            effect.y,
            radius * 0.72,
            rotation,
            profile.accentColor,
            motionAlpha * 0.8,
          )
          this.drawStarburst(
            graphics,
            effect.x,
            effect.y,
            6 + stage * 2,
            radius * 0.16,
            radius,
            -rotation,
            profile.coreColor,
            1.7 + stage * 0.3,
            motionAlpha * 0.82,
          )
          break
        }
        case 'null-toll': {
          const motif = weaponVfxMotifProfile('null-bell', state)
          const glyphAttack = clamp(progress / 0.1, 0, 1)
          const glyphDecay = 1 - clamp((progress - 0.34) / 0.32, 0, 1)
          const glyphAlpha =
            glyphAttack * glyphDecay * (this.settings.reducedFlash ? 0.7 : 1)
          const bellY =
            effect.y -
            28 -
            stage * 4 -
            (1 - glyphAttack) * 10
          this.drawBellGlyph(
            graphics,
            effect.x,
            bellY,
            30 + stage * 5,
            effect.angle * 0.08,
            profile.accentColor,
            profile.coreColor,
            glyphAlpha,
          )

          const strikeProgress = clamp(progress / 0.28, 0, 1)
          const strikeAlpha =
            Math.sin(strikeProgress * Math.PI) *
            (this.settings.reducedFlash ? 0.66 : 1)
          const strikeLength = effect.maxRadius * (0.32 + strikeProgress * 0.5)
          const strikeDirectionX = Math.cos(effect.angle)
          const strikeDirectionY = Math.sin(effect.angle)
          const strikeNormalX = -strikeDirectionY
          const strikeNormalY = strikeDirectionX
          const waveform: Vec2[] = []
          for (let point = 0; point < 9; point += 1) {
            const t = point / 8
            const along = (t * 2 - 1) * strikeLength
            const wave =
              Math.sin(t * Math.PI * 8) *
              (1 - Math.abs(t * 2 - 1)) *
              (9 + stage * 2)
            waveform.push({
              x:
                effect.x +
                strikeDirectionX * along +
                strikeNormalX * wave,
              y:
                effect.y +
                strikeDirectionY * along +
                strikeNormalY * wave,
            })
          }
          this.drawPolyline(
            graphics,
            waveform,
            profile.glowColor,
            11 + stage * 1.5,
            strikeAlpha * 0.08,
          )
          this.drawPolyline(
            graphics,
            waveform,
            profile.coreColor,
            2 + stage * 0.28,
            strikeAlpha * 0.78,
          )

          const releaseProgress = clamp((progress - 0.08) / 0.58, 0, 1)
          const releaseDecay = 1 - clamp((progress - 0.72) / 0.28, 0, 1)
          if (stage >= 2 && releaseProgress > 0) {
            const plateRadius =
              lerp(effect.maxRadius * 0.12, effect.maxRadius * 0.74, releaseProgress)
            const platePoints: number[] = []
            for (let corner = 0; corner < 4; corner += 1) {
              const cornerAngle =
                effect.angle * 0.12 +
                Math.PI * 0.25 +
                corner * Math.PI * 0.5
              platePoints.push(
                effect.x + Math.cos(cornerAngle) * plateRadius,
                effect.y + Math.sin(cornerAngle) * plateRadius,
              )
            }
            graphics
              .poly(platePoints, true)
              .fill({
                color: 0x0b0d21,
                alpha:
                  releaseDecay *
                  (this.settings.reducedFlash ? 0.014 : 0.026),
              })

            const fractureCount = 4 + stage
            for (let fracture = 0; fracture < fractureCount; fracture += 1) {
              const fractureAngle =
                effect.angle * 0.18 +
                (Math.PI * 2 * fracture) / fractureCount +
                Math.sin((effect.seed + fracture * 29) * 0.93) * 0.18
              const bend =
                (fracture % 2 ? -1 : 1) *
                plateRadius *
                (0.08 + (fracture % 3) * 0.018)
              const normalX = -Math.sin(fractureAngle)
              const normalY = Math.cos(fractureAngle)
              this.drawPolyline(
                graphics,
                [
                  {
                    x: effect.x + Math.cos(fractureAngle) * plateRadius * 0.12,
                    y: effect.y + Math.sin(fractureAngle) * plateRadius * 0.12,
                  },
                  {
                    x:
                      effect.x +
                      Math.cos(fractureAngle) * plateRadius * 0.46 +
                      normalX * bend,
                    y:
                      effect.y +
                      Math.sin(fractureAngle) * plateRadius * 0.46 +
                      normalY * bend,
                  },
                  {
                    x: effect.x + Math.cos(fractureAngle) * plateRadius * 0.9,
                    y: effect.y + Math.sin(fractureAngle) * plateRadius * 0.9,
                  },
                ],
                fracture % 2 ? profile.secondaryColor : profile.accentColor,
                1.2 + stage * 0.18,
                releaseDecay * motionAlpha * 0.56,
              )
            }
          }

          for (let wedge = 0; wedge < motif.primaryCount; wedge += 1) {
            const staggeredRelease = clamp(
              (releaseProgress - wedge * 0.018) / 0.86,
              0,
              1,
            )
            const wedgeAngle =
              effect.angle * 0.2 +
              (Math.PI * 2 * wedge) / motif.primaryCount +
              (wedge % 2 ? 0.055 : -0.025)
            const wedgeDistance = lerp(
              effect.maxRadius * 0.18,
              effect.maxRadius * 0.84,
              1 - (1 - staggeredRelease) ** 3,
            )
            const wedgeAlpha =
              Math.sin(staggeredRelease * Math.PI * 0.82) *
              releaseDecay *
              (this.settings.reducedFlash ? 0.7 : 1)
            this.drawPressureWedge(
              graphics,
              effect.x,
              effect.y,
              wedgeAngle,
              wedgeDistance,
              34 + stage * 8,
              38 + stage * 7,
              wedge % 3 === 0 ? profile.coreColor : profile.accentColor,
              0x0b0d21,
              wedgeAlpha,
            )
          }

          if (stage === 3) {
            const cutProgress = clamp((progress - 0.12) / 0.46, 0, 1)
            const cutAlpha =
              Math.sin(cutProgress * Math.PI) *
              releaseDecay *
              (this.settings.reducedFlash ? 0.58 : 0.86)
            const cutRadius = lerp(
              effect.maxRadius * 0.24,
              effect.maxRadius * 0.82,
              1 - (1 - cutProgress) ** 3,
            )
            const cutInner = effect.maxRadius * 0.12
            for (let axis = 0; axis < 2; axis += 1) {
              const cutAngle =
                effect.angle * 0.2 + Math.PI * 0.25 + axis * Math.PI * 0.5
              const directionX = Math.cos(cutAngle)
              const directionY = Math.sin(cutAngle)
              const cutColor =
                axis === 0 ? profile.coreColor : profile.secondaryColor
              for (const side of [-1, 1]) {
                const start = {
                  x: effect.x + directionX * cutInner * side,
                  y: effect.y + directionY * cutInner * side,
                }
                const end = {
                  x: effect.x + directionX * cutRadius * side,
                  y: effect.y + directionY * cutRadius * side,
                }
                this.drawPolyline(
                  graphics,
                  [start, end],
                  profile.glowColor,
                  8,
                  cutAlpha * 0.08,
                )
                this.drawPolyline(
                  graphics,
                  [start, end],
                  cutColor,
                  1.8,
                  cutAlpha,
                )
              }
            }
          }

          const hitPulse = clamp(
            (effect.hitPulseLife ?? 0) /
              Math.max(effect.hitPulseTotal ?? 1, 0.001),
            0,
            1,
          )
          const impactAlpha =
            hitPulse *
            (this.settings.reducedFlash ? 0.66 : 1)
          for (let hit = 0; hit < Math.min(effect.points?.length ?? 0, 4 + stage * 2); hit += 1) {
            const target = effect.points?.[hit]
            if (!target) continue
            const targetAngle =
              Math.atan2(target.y - effect.y, target.x - effect.x) +
              Math.sin((effect.seed + hit * 17) * 0.71) * 0.18
            this.drawDiamondGlyph(
              graphics,
              target.x,
              target.y,
              5 + stage * 1.2,
              targetAngle + Math.PI * 0.25,
              hit % 2 ? profile.secondaryColor : profile.coreColor,
              impactAlpha * 0.86,
              true,
            )
            for (let shard = 0; shard < 3; shard += 1) {
              const shardAngle = targetAngle + (shard - 1) * 0.72
              const shardInner = 7 + stage * 1.5
              const shardOuter = 15 + stage * 3 + shard * 2
              graphics
                .moveTo(
                  target.x + Math.cos(shardAngle) * shardInner,
                  target.y + Math.sin(shardAngle) * shardInner,
                )
                .lineTo(
                  target.x + Math.cos(shardAngle) * shardOuter,
                  target.y + Math.sin(shardAngle) * shardOuter,
                )
                .stroke({
                  color: shard === 1 ? profile.coreColor : profile.accentColor,
                  width: 1.4 + stage * 0.18,
                  alpha: impactAlpha * 0.72,
                })
            }
          }
          break
        }
      }
    }
  }

  private drawEffects() {
    this.drawWeaponEffects()
    this.loopGraphics.clear()
    for (let index = this.loopEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.loopEffects[index]
      if (effect.life <= 0) {
        this.loopEffects.splice(index, 1)
        continue
      }
      const alpha = clamp(effect.life / effect.total, 0, 1)
      const flattened = effect.points.flatMap((point) => [point.x, point.y])
      if (effect.closed !== false) {
        this.loopGraphics.poly(flattened, true).fill({ color: effect.color, alpha: alpha * 0.12 })
        this.loopGraphics.stroke({ color: 0xffdf87, width: effect.width ?? 5, alpha: alpha * 0.8 })
      } else if (effect.points.length > 1) {
        this.loopGraphics.moveTo(effect.points[0].x, effect.points[0].y)
        for (let pointIndex = 1; pointIndex < effect.points.length; pointIndex += 1) {
          this.loopGraphics.lineTo(effect.points[pointIndex].x, effect.points[pointIndex].y)
        }
        this.loopGraphics.stroke({
          color: effect.color,
          width: effect.width ?? 5,
          alpha: alpha * 0.9,
        })
      }
    }

    this.telegraphGraphics.clear()
    this.telegraphGraphics.position.set(0, 0)
    this.telegraphGraphics.rotation = 0
    for (const telegraph of this.telegraphs) {
      if (!telegraph.active) continue
      const progress = 1 - telegraph.life / telegraph.total
      const bossProfile = telegraph.bossAttack
        ? bossPresentation(this.bossLevel.bossId)
        : undefined
      const color = telegraph.color ?? bossProfile?.primaryColor ?? HOSTILE_WARNING_COLOR
      const secondary = bossProfile?.secondaryColor ?? HOSTILE_WARNING_COLOR
      const shadow = bossProfile?.shadowColor ?? HOSTILE_SHADOW_COLOR
      const harden = clamp((progress - 0.58) / 0.42, 0, 1)
      const pulse =
        0.16 +
        progress * 0.22 +
        Math.sin(progress * Math.PI * (telegraph.bossAttack ? 10 : 8)) * 0.045
      const flashScale = this.settings.reducedFlash
        ? bossProfile?.reducedFlashScale ?? 0.44
        : 1
      if (telegraph.kind === 'circle') {
        this.telegraphGraphics
          .circle(telegraph.x, telegraph.y, telegraph.radius)
          .fill({ color: shadow, alpha: 0.11 + pulse * 0.12 })
        this.telegraphGraphics
          .circle(telegraph.x, telegraph.y, telegraph.radius)
          .stroke({
            color,
            width: (telegraph.bossAttack ? 4.5 : 2.5) + harden * 3,
            alpha: 0.48 + harden * 0.3,
          })
        const convergence = telegraph.radius * (1 - progress * 0.78)
        this.drawSegmentedRing(
          this.telegraphGraphics,
          telegraph.x,
          telegraph.y,
          Math.max(8, convergence),
          telegraph.bossAttack ? 12 + this.bossLevel.id : 8,
          this.motionClock * (telegraph.bossAttack ? 0.8 : 0.38),
          secondary,
          telegraph.bossAttack ? 3.2 : 1.8,
          (0.42 + harden * 0.42) * flashScale,
          telegraph.bossAttack ? 0.48 : 0.56,
        )
        if (telegraph.bossAttack) {
          this.drawRadialTicks(
            this.telegraphGraphics,
            telegraph.x,
            telegraph.y,
            telegraph.radius * 0.82,
            8 + Math.min(8, this.bossLevel.id),
            8 + harden * 12,
            -this.motionClock * 0.32,
            color,
            2.2,
            (0.24 + harden * 0.38) * flashScale,
          )
        }
        if (harden > 0.02) {
          this.telegraphGraphics
            .circle(
              telegraph.x,
              telegraph.y,
              Math.max(4, telegraph.radius * 0.11 * harden),
            )
            .fill({
              color: bossProfile?.impactColor ?? HOSTILE_IMPACT_COLOR,
              alpha: harden * 0.64 * flashScale,
            })
        }
      } else {
        const endX = telegraph.x + Math.cos(telegraph.angle) * telegraph.length
        const endY = telegraph.y + Math.sin(telegraph.angle) * telegraph.length
        const offsetX = -Math.sin(telegraph.angle) * telegraph.width * 0.5
        const offsetY = Math.cos(telegraph.angle) * telegraph.width * 0.5
        this.telegraphGraphics
          .poly(
            [
              telegraph.x + offsetX,
              telegraph.y + offsetY,
              endX + offsetX,
              endY + offsetY,
              endX - offsetX,
              endY - offsetY,
              telegraph.x - offsetX,
              telegraph.y - offsetY,
            ],
            true,
          )
          .fill({ color: shadow, alpha: 0.14 + pulse * 0.12 })
          .stroke({
            color,
            width: telegraph.bossAttack ? 3.4 : 2,
            alpha: 0.52 + harden * 0.26,
          })
        this.telegraphGraphics
          .moveTo(telegraph.x, telegraph.y)
          .lineTo(endX, endY)
          .stroke({
            color: bossProfile?.impactColor ?? HOSTILE_IMPACT_COLOR,
            width: 1.2 + harden * (telegraph.bossAttack ? 4.8 : 2.2),
            alpha: (0.16 + harden * 0.72) * flashScale,
          })
        if (telegraph.bossAttack) {
          const combCount = 3
          for (let index = 1; index <= combCount; index += 1) {
            const offset = (index / (combCount + 1) - 0.5) * telegraph.width * 1.46
            this.telegraphGraphics
              .moveTo(
                telegraph.x - Math.sin(telegraph.angle) * offset,
                telegraph.y + Math.cos(telegraph.angle) * offset,
              )
              .lineTo(
                endX - Math.sin(telegraph.angle) * offset,
                endY + Math.cos(telegraph.angle) * offset,
              )
              .stroke({
                color: secondary,
                width: 1.3,
                alpha: (0.16 + harden * 0.36) * flashScale,
              })
          }
        }
      }
    }

    this.ringGraphics.clear()
    for (let index = this.rings.length - 1; index >= 0; index -= 1) {
      const ring = this.rings[index]
      if (ring.life <= 0) {
        this.rings.splice(index, 1)
        continue
      }
      const progress = 1 - ring.life / ring.total
      const radius = lerp(ring.radius, ring.maxRadius, 1 - (1 - progress) ** 3)
      this.ringGraphics
        .circle(ring.x, ring.y, radius)
        .stroke({ color: ring.color, width: ring.width * (1 - progress * 0.72), alpha: 1 - progress })
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

    if (enemy.isBoss && bossProfile) {
      const authorityRadius = enemy.radius * (1.14 + enemy.phase * 0.055)
      const sealY = y + enemy.radius * 0.16
      const rotation = this.motionClock * (0.13 + enemy.phase * 0.015)
      this.motionGraphics
        .circle(x, sealY, authorityRadius * 0.72)
        .fill({ color: bossProfile.shadowColor, alpha: 0.12 })
      this.drawSegmentedRing(
        this.motionGraphics,
        x,
        sealY,
        authorityRadius,
        10 + enemy.phase * 2,
        rotation,
        bossProfile.primaryColor,
        2.4,
        0.2 + enemy.phase * 0.035,
        0.46,
      )
      this.drawSegmentedRing(
        this.motionGraphics,
        x,
        sealY,
        authorityRadius * 0.72,
        8 + enemy.phase * 2,
        -rotation * 1.35,
        bossProfile.secondaryColor,
        1.4,
        0.2,
        0.58,
      )
      this.drawRadialTicks(
        this.motionGraphics,
        x,
        sealY,
        authorityRadius * 1.02,
        8 + enemy.phase * 2,
        5 + enemy.phase,
        -rotation * 0.72,
        bossProfile.primaryColor,
        1.5,
        0.14 + enemy.phase * 0.025,
      )
    }

    if (
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
            .moveTo(trailX + sideX * side, trailY + sideY * side)
            .lineTo(
              trailX + backX * enemy.radius * 0.72 + sideX * side,
              trailY + backY * enemy.radius * 0.72 + sideY * side,
            )
            .stroke({
              color: accent,
              width: enemy.isBoss ? 3.5 : 1.8,
              alpha: footfall * (enemy.isBoss ? 0.3 : 0.14 * prominence),
            })
        } else {
          this.motionGraphics
            .ellipse(
              trailX + sideX * side,
              trailY + sideY * side,
              enemy.radius * 0.22,
              enemy.radius * 0.08,
            )
            .stroke({
              color: accent,
              width: enemy.isBoss ? 3 : 1.5,
              alpha: footfall * (enemy.isBoss ? 0.34 : 0.14 * prominence),
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
      this.drawBossSignatureMotif(enemy, x, y, angle, envelope)
      if (
        enemy.attackMotionStyle === 'boss-line' ||
        enemy.attackMotionStyle === 'boss-orbit' ||
        enemy.attackMotionStyle === 'boss-cross' ||
        enemy.attackMotionStyle === 'boss-mirror' ||
        enemy.attackMotionStyle === 'boss-cluster'
      ) {
        this.drawBossSpecialChoreography(enemy, x, y, angle, envelope)
      }
    }

    if (directional) {
      const reach = enemy.radius * (
        0.72 +
        envelope.release * (enemy.isBoss ? 1.55 : 1.05) +
        envelope.impact * (enemy.isBoss ? 0.62 : 0.34)
      )
      const halfWidth = enemy.radius * (
        0.22 +
        envelope.gather * 0.18 +
        envelope.release * 0.2
      )
      const centerX = x + forwardX * reach
      const centerY = y + forwardY * reach
      const tailX = x - forwardX * enemy.radius * (0.18 + envelope.gather * 0.42)
      const tailY = y - forwardY * enemy.radius * (0.18 + envelope.gather * 0.42)
      this.motionGraphics
        .poly(
          [
            tailX - sideX * halfWidth * 0.34,
            tailY - sideY * halfWidth * 0.34,
            centerX - sideX * halfWidth,
            centerY - sideY * halfWidth,
            centerX + forwardX * enemy.radius * 0.48,
            centerY + forwardY * enemy.radius * 0.48,
            centerX + sideX * halfWidth,
            centerY + sideY * halfWidth,
            tailX + sideX * halfWidth * 0.34,
            tailY + sideY * halfWidth * 0.34,
          ],
          true,
        )
        .fill({
          color: secondary,
          alpha: (0.035 + envelope.release * 0.085 + envelope.impact * 0.12) *
            prominence,
        })
      this.motionGraphics
        .moveTo(centerX - sideX * halfWidth, centerY - sideY * halfWidth)
        .lineTo(
          centerX + forwardX * enemy.radius * 0.42 + sideX * halfWidth,
          centerY + forwardY * enemy.radius * 0.42 + sideY * halfWidth,
        )
        .stroke({
          color: accent,
          width: enemy.isBoss ? 7.5 : 2.4,
          alpha: (0.12 + pulse * (enemy.isBoss ? 0.58 : 0.3)) *
            prominence *
            (this.settings.reducedFlash ? 0.58 : 1),
        })
      if (envelope.impact > 0.1) {
        this.motionGraphics
          .circle(
            centerX + forwardX * enemy.radius * 0.34,
            centerY + forwardY * enemy.radius * 0.34,
            enemy.radius * (0.12 + envelope.impact * (enemy.isBoss ? 0.34 : 0.18)),
          )
          .fill({
            color: bossProfile?.impactColor ?? hordeProfile?.impactColor ?? HOSTILE_IMPACT_COLOR,
            alpha: envelope.flashScale * (enemy.isBoss ? 0.42 : 0.18),
          })
      }
      return
    }

    const ringRadius = enemy.radius * (
      1.34 -
      envelope.gather * 0.38 +
      envelope.release * 0.26 +
      envelope.impact * (enemy.isBoss ? 0.72 : 0.36)
    )
    this.motionGraphics
      .circle(x, y + enemy.radius * 0.12, ringRadius)
      .fill({
        color: bossProfile?.shadowColor ?? hordeProfile?.shadowColor ?? HOSTILE_SHADOW_COLOR,
        alpha: (0.025 + envelope.gather * 0.05 + envelope.impact * 0.08) *
          prominence,
      })
    this.motionGraphics
      .circle(x, y + enemy.radius * 0.12, ringRadius)
      .stroke({
        color: accent,
        width: enemy.isBoss ? 5 : 2.4,
        alpha: (0.08 + pulse * (enemy.isBoss ? 0.54 : 0.24)) *
          prominence *
          (this.settings.reducedFlash ? 0.58 : 1),
      })
    if (envelope.release > 0.04 || envelope.impact > 0.04) {
      this.drawSegmentedRing(
        this.motionGraphics,
        x,
        y + enemy.radius * 0.12,
        ringRadius * (0.68 + envelope.impact * 0.25),
        enemy.isBoss ? 12 + enemy.phase * 2 : 7,
        this.motionClock * (enemy.isBoss ? -0.9 : -0.45),
        secondary,
        enemy.isBoss ? 3 : 1.4,
        (envelope.release * 0.38 + envelope.flashScale * 0.46) *
          prominence,
        0.5,
      )
    }

    if (
      enemy.attackMotionStyle === 'boss-cross' ||
      enemy.attackMotionStyle === 'boss-phase' ||
      enemy.attackMotionStyle === 'slam'
    ) {
      const spoke = ringRadius * (0.72 + pulse * 0.28)
      this.motionGraphics
        .moveTo(x - spoke, y)
        .lineTo(x + spoke, y)
        .moveTo(x, y - spoke)
        .lineTo(x, y + spoke)
        .stroke({
          color: accent,
          width: enemy.isBoss ? 4 : 2,
          alpha: pulse * (enemy.isBoss ? 0.42 : 0.18) * prominence,
        })
    }
  }

  private drawBossSignatureMotif(
    enemy: EnemyEntity,
    x: number,
    y: number,
    angle: number,
    envelope: ReturnType<typeof sampleHostileEnvelope>,
  ) {
    const profile = bossPresentation(this.bossLevel.bossId)
    const energy = Math.max(envelope.gather * 0.7, envelope.release, envelope.impact)
    if (energy <= 0.025) return
    const radius = enemy.radius * (
      1.1 +
      envelope.gather * 0.35 +
      envelope.release * 0.54 +
      envelope.impact * 0.78
    )
    const rotation = this.motionClock * (0.45 + enemy.phase * 0.08)
    const alpha = energy * (this.settings.reducedFlash ? 0.48 : 0.82)
    const centerY = y + enemy.radius * 0.08

    if (
      profile.motif === 'drowned-choir' ||
      profile.motif === 'undertow-rings' ||
      profile.motif === 'eclipse-corona'
    ) {
      const rings = 2 + Math.min(2, enemy.phase)
      for (let index = 0; index < rings; index += 1) {
        this.drawSegmentedRing(
          this.motionGraphics,
          x,
          centerY,
          radius * (0.58 + index * 0.22),
          8 + index * 4 + enemy.phase,
          (index % 2 ? -1 : 1) * rotation * (1 + index * 0.16),
          index % 2 ? profile.secondaryColor : profile.primaryColor,
          1.8 + index * 0.5,
          alpha * (0.64 - index * 0.1),
          profile.motif === 'eclipse-corona' ? 0.62 : 0.48,
        )
      }
      if (profile.motif === 'eclipse-corona') {
        this.motionGraphics
          .circle(x, centerY, radius * 0.5)
          .fill({ color: profile.shadowColor, alpha: alpha * 0.72 })
          .stroke({ color: profile.primaryColor, width: 4, alpha: alpha * 0.82 })
      }
      return
    }

    if (
      profile.motif === 'rail-cross' ||
      profile.motif === 'storm-comb' ||
      profile.motif === 'void-grid'
    ) {
      const spokes = profile.motif === 'storm-comb' ? 6 : 4
      this.drawRadialTicks(
        this.motionGraphics,
        x,
        centerY,
        radius * 0.46,
        spokes,
        radius * (profile.motif === 'void-grid' ? 0.72 : 0.52),
        angle + rotation * 0.3,
        profile.primaryColor,
        3.2,
        alpha * 0.72,
      )
      this.drawDiamondGlyph(
        this.motionGraphics,
        x,
        centerY,
        radius * 0.52,
        angle + rotation * 0.22,
        profile.secondaryColor,
        alpha * 0.64,
      )
      return
    }

    if (profile.motif === 'shard-mirror') {
      for (const side of [-1, 1]) {
        this.drawDiamondGlyph(
          this.motionGraphics,
          x + Math.cos(angle + Math.PI * 0.5) * radius * side * 0.42,
          centerY + Math.sin(angle + Math.PI * 0.5) * radius * side * 0.42,
          radius * 0.34,
          rotation * side,
          side > 0 ? profile.primaryColor : profile.secondaryColor,
          alpha * 0.74,
          envelope.impact > 0.2,
        )
      }
      return
    }

    if (profile.motif === 'clock-teeth' || profile.motif === 'furnace-cracks') {
      this.drawJaggedRing(
        this.motionGraphics,
        x,
        centerY,
        radius * 0.84,
        18 + enemy.phase * 4,
        profile.motif === 'clock-teeth' ? rotation : -rotation * 0.35,
        this.bossLevel.id * 97 + enemy.phase * 13,
        profile.motif === 'furnace-cracks' ? 9 : 4,
        profile.primaryColor,
        profile.motif === 'furnace-cracks' ? 4.5 : 2.8,
        alpha * 0.78,
      )
      return
    }

    const antlerSpread = radius * (0.5 + envelope.release * 0.4)
    for (const side of [-1, 1]) {
      const rayAngle = angle + side * 0.42
      this.motionGraphics
        .moveTo(x, centerY)
        .lineTo(
          x + Math.cos(rayAngle) * antlerSpread,
          centerY + Math.sin(rayAngle) * antlerSpread,
        )
        .lineTo(
          x + Math.cos(rayAngle + side * 0.24) * radius,
          centerY + Math.sin(rayAngle + side * 0.24) * radius,
        )
        .stroke({ color: profile.primaryColor, width: 4, alpha: alpha * 0.78 })
    }
  }

  private drawBossSpecialChoreography(
    enemy: EnemyEntity,
    x: number,
    y: number,
    angle: number,
    envelope: ReturnType<typeof sampleHostileEnvelope>,
  ) {
    const animationProfile = bossAnimationProfile(this.bossLevel.id)
    const presentation = bossPresentation(this.bossLevel.bossId)
    const energy = Math.max(
      envelope.gather * 0.68,
      envelope.release,
      envelope.impact,
    )
    if (energy <= 0.025) return

    const flashScale = this.settings.reducedFlash ? presentation.reducedFlashScale : 1
    const alpha = energy * flashScale
    const centerY = y + enemy.radius * 0.05
    const forwardX = Math.cos(angle)
    const forwardY = Math.sin(angle)
    const sideX = -forwardY
    const sideY = forwardX
    const reach = enemy.radius * (
      0.78 +
      envelope.gather * 0.28 +
      envelope.release * 0.66 +
      envelope.impact * 0.38
    )
    const rotation = this.motionClock * (0.72 + enemy.phase * 0.09)

    switch (animationProfile.signature) {
      case 'antler-prowl': {
        const spread = enemy.radius * (0.3 + envelope.release * 0.38)
        for (const side of [-1, 1]) {
          const shoulderX = x + forwardX * reach * 0.28 + sideX * spread * side
          const shoulderY = centerY + forwardY * reach * 0.28 + sideY * spread * side
          this.motionGraphics
            .moveTo(
              x - forwardX * enemy.radius * 0.18,
              centerY - forwardY * enemy.radius * 0.18,
            )
            .lineTo(shoulderX, shoulderY)
            .lineTo(
              x + forwardX * reach + sideX * spread * side * 0.58,
              centerY + forwardY * reach + sideY * spread * side * 0.58,
            )
            .stroke({
              color: side > 0 ? presentation.primaryColor : presentation.secondaryColor,
              width: 3.2 + envelope.impact * 2.8,
              alpha: alpha * 0.7,
            })
        }
        break
      }
      case 'choir-float': {
        const orbitRadius = enemy.radius * (0.78 + envelope.release * 0.42)
        for (let index = 0; index < 3; index += 1) {
          const orbit = rotation + (Math.PI * 2 * index) / 3
          const glyphX = x + Math.cos(orbit) * orbitRadius
          const glyphY = centerY + Math.sin(orbit) * orbitRadius * 0.62
          this.drawDiamondGlyph(
            this.motionGraphics,
            glyphX,
            glyphY,
            enemy.radius * (0.1 + envelope.impact * 0.08),
            -orbit,
            index % 2 ? presentation.secondaryColor : presentation.primaryColor,
            alpha * (0.52 + envelope.impact * 0.24),
            envelope.impact > 0.55,
          )
        }
        break
      }
      case 'rail-rush': {
        const railGap = enemy.radius * (0.3 + envelope.gather * 0.16)
        const startX = x - forwardX * enemy.radius * 0.42
        const startY = centerY - forwardY * enemy.radius * 0.42
        for (const side of [-1, 1]) {
          this.motionGraphics
            .moveTo(startX + sideX * railGap * side, startY + sideY * railGap * side)
            .lineTo(
              x + forwardX * reach + sideX * railGap * side,
              centerY + forwardY * reach + sideY * railGap * side,
            )
            .stroke({
              color: side > 0 ? presentation.primaryColor : presentation.secondaryColor,
              width: 4 + envelope.impact * 3,
              alpha: alpha * 0.68,
            })
        }
        const braceX = x + forwardX * reach * 0.48
        const braceY = centerY + forwardY * reach * 0.48
        this.motionGraphics
          .moveTo(braceX - sideX * railGap * 1.35, braceY - sideY * railGap * 1.35)
          .lineTo(braceX + sideX * railGap * 1.35, braceY + sideY * railGap * 1.35)
          .stroke({
            color: presentation.impactColor,
            width: 2.2 + envelope.impact * 2.2,
            alpha: alpha * 0.55,
          })
        break
      }
      case 'mirror-drift': {
        const separation = enemy.radius * (0.58 + envelope.release * 0.48)
        for (const side of [-1, 1]) {
          for (let depth = 0; depth < 2; depth += 1) {
            const distance = separation * (0.72 + depth * 0.46)
            this.drawDiamondGlyph(
              this.motionGraphics,
              x + sideX * distance * side + forwardX * reach * depth * 0.18,
              centerY + sideY * distance * side + forwardY * reach * depth * 0.18,
              enemy.radius * (0.18 + envelope.impact * 0.08 - depth * 0.025),
              rotation * side + depth * Math.PI * 0.25,
              depth % 2 ? presentation.secondaryColor : presentation.primaryColor,
              alpha * (0.6 - depth * 0.14),
              envelope.impact > 0.62 && depth === 0,
            )
          }
        }
        break
      }
      case 'undertow-glide': {
        const pullX = x - forwardX * enemy.radius * (0.2 + envelope.gather * 0.3)
        const pullY = centerY - forwardY * enemy.radius * (0.2 + envelope.gather * 0.3)
        for (let index = 0; index < 2; index += 1) {
          this.drawSegmentedRing(
            this.motionGraphics,
            pullX + forwardX * enemy.radius * index * 0.28,
            pullY + forwardY * enemy.radius * index * 0.28,
            enemy.radius * (0.62 + index * 0.3 + envelope.release * 0.22),
            7 + index * 3 + enemy.phase,
            (index % 2 ? -1 : 1) * rotation,
            index % 2 ? presentation.secondaryColor : presentation.primaryColor,
            2.4 + index,
            alpha * (0.58 - index * 0.12),
            0.54,
          )
        }
        break
      }
      case 'storm-engine': {
        const startX = x - forwardX * enemy.radius * 0.2
        const startY = centerY - forwardY * enemy.radius * 0.2
        this.motionGraphics
          .moveTo(startX, startY)
          .lineTo(x + forwardX * reach, centerY + forwardY * reach)
          .stroke({
            color: presentation.primaryColor,
            width: 3.4 + envelope.impact * 3.2,
            alpha: alpha * 0.68,
          })
        const teeth = 6 + enemy.phase
        for (let index = 1; index <= teeth; index += 1) {
          const progress = index / (teeth + 1)
          const toothX = lerp(startX, x + forwardX * reach, progress)
          const toothY = lerp(startY, centerY + forwardY * reach, progress)
          const toothLength = enemy.radius * (0.16 + (index % 2) * 0.13)
          this.motionGraphics
            .moveTo(toothX - sideX * toothLength, toothY - sideY * toothLength)
            .lineTo(toothX + sideX * toothLength, toothY + sideY * toothLength)
        }
        this.motionGraphics.stroke({
          color: presentation.secondaryColor,
          width: 2.1,
          alpha: alpha * 0.48,
        })
        break
      }
      case 'clock-stutter': {
        const clockRadius = enemy.radius * (0.82 + envelope.release * 0.36)
        this.drawRadialTicks(
          this.motionGraphics,
          x,
          centerY,
          clockRadius,
          12,
          enemy.radius * (0.11 + envelope.impact * 0.12),
          rotation,
          presentation.primaryColor,
          2.6,
          alpha * 0.62,
        )
        const minuteAngle = rotation * 0.42
        const hourAngle = -rotation * 0.19 + Math.PI * 0.5
        this.motionGraphics
          .moveTo(x, centerY)
          .lineTo(
            x + Math.cos(minuteAngle) * clockRadius * 0.82,
            centerY + Math.sin(minuteAngle) * clockRadius * 0.82,
          )
          .moveTo(x, centerY)
          .lineTo(
            x + Math.cos(hourAngle) * clockRadius * 0.58,
            centerY + Math.sin(hourAngle) * clockRadius * 0.58,
          )
          .stroke({
            color: presentation.impactColor,
            width: 3 + envelope.impact * 2,
            alpha: alpha * 0.6,
          })
        break
      }
      case 'furnace-stomp': {
        const fissureRadius = enemy.radius * (0.68 + envelope.impact * 0.72)
        this.drawJaggedRing(
          this.motionGraphics,
          x,
          centerY,
          fissureRadius,
          18 + enemy.phase * 3,
          -rotation * 0.24,
          this.bossLevel.id * 113 + enemy.phase * 19,
          7 + envelope.impact * 7,
          presentation.primaryColor,
          3.6 + envelope.impact * 2.8,
          alpha * 0.64,
        )
        for (let index = 0; index < 6; index += 1) {
          const fissureAngle = angle + (Math.PI * 2 * index) / 6
          const innerRadius = fissureRadius * 0.45
          const outerRadius = fissureRadius * (0.92 + (index % 2) * 0.24)
          this.motionGraphics
            .moveTo(
              x + Math.cos(fissureAngle) * innerRadius,
              centerY + Math.sin(fissureAngle) * innerRadius,
            )
            .lineTo(
              x + Math.cos(fissureAngle + 0.08 * (index % 2 ? -1 : 1)) * outerRadius,
              centerY + Math.sin(fissureAngle + 0.08 * (index % 2 ? -1 : 1)) * outerRadius,
            )
        }
        this.motionGraphics.stroke({
          color: presentation.secondaryColor,
          width: 2.4,
          alpha: alpha * 0.42,
        })
        break
      }
      case 'void-cartography': {
        const gridRadius = enemy.radius * (0.72 + envelope.release * 0.46)
        const gridStep = gridRadius * 0.46
        for (let index = -1; index <= 1; index += 1) {
          const sideOffset = gridStep * index
          this.motionGraphics
            .moveTo(
              x - forwardX * gridRadius + sideX * sideOffset,
              centerY - forwardY * gridRadius + sideY * sideOffset,
            )
            .lineTo(
              x + forwardX * gridRadius + sideX * sideOffset,
              centerY + forwardY * gridRadius + sideY * sideOffset,
            )
            .moveTo(
              x - sideX * gridRadius + forwardX * sideOffset,
              centerY - sideY * gridRadius + forwardY * sideOffset,
            )
            .lineTo(
              x + sideX * gridRadius + forwardX * sideOffset,
              centerY + sideY * gridRadius + forwardY * sideOffset,
            )
        }
        this.motionGraphics.stroke({
          color: presentation.primaryColor,
          width: 2.1 + envelope.impact * 1.8,
          alpha: alpha * 0.48,
        })
        break
      }
      case 'eclipse-majesty': {
        const coronaRadius = enemy.radius * (0.72 + envelope.release * 0.48)
        this.motionGraphics
          .circle(x, centerY, coronaRadius * 0.55)
          .fill({
            color: presentation.shadowColor,
            alpha: alpha * 0.72,
          })
          .stroke({
            color: presentation.impactColor,
            width: 3.8 + envelope.impact * 3.2,
            alpha: alpha * 0.7,
          })
        this.drawStarburst(
          this.motionGraphics,
          x,
          centerY,
          16 + enemy.phase * 2,
          coronaRadius * 0.68,
          coronaRadius * (1.12 + envelope.impact * 0.28),
          rotation,
          presentation.primaryColor,
          2.4 + envelope.impact * 1.8,
          alpha * 0.62,
        )
        break
      }
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
        .circle(x, y, coreRadius * 1.8)
        .fill({ color: profile.glowColor, alpha: 0.08 })
      this.drawSegmentedRing(
        graphics,
        x,
        y,
        coreRadius * 1.34,
        7 + stage * 2,
        this.motionClock * (2.1 + stage * 0.2) + projectile.visualSeed,
        profile.accentColor,
        1.6 + stage * 0.24,
        0.74,
        0.45,
      )
      if (stage >= 1) {
        this.drawSegmentedRing(
          graphics,
          x,
          y,
          coreRadius * 2.06,
          6 + stage * 2,
          -this.motionClock * 1.6 + projectile.visualSeed,
          profile.secondaryColor,
          1.2,
          0.48,
          0.58,
        )
      }
      const orbiters = 1 + stage
      for (let index = 0; index < orbiters; index += 1) {
        const angle =
          this.motionClock * (2.3 + index * 0.18) +
          projectile.visualSeed * 0.17 +
          (Math.PI * 2 * index) / orbiters
        this.drawDiamondGlyph(
          graphics,
          x + Math.cos(angle) * coreRadius * 1.9,
          y + Math.sin(angle) * coreRadius * 1.9,
          2.2 + stage * 0.5,
          angle,
          index % 2 ? profile.secondaryColor : profile.coreColor,
          0.7,
          stage >= 2,
        )
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
      if (stage >= 1) {
        for (const side of [-1, 1]) {
          const offset = side * (4 + stage * 1.2)
          graphics
            .moveTo(startX + normalX * offset, startY + normalY * offset)
            .lineTo(x + normalX * offset, y + normalY * offset)
            .stroke({
              color: side < 0 ? profile.secondaryColor : profile.accentColor,
              width: 1.2 + stage * 0.2,
              alpha: 0.52,
            })
        }
      }
      this.drawStarburst(
        graphics,
        x,
        y,
        6 + stage * 2,
        3,
        8 + stage * 2.4,
        projectile.sprite.rotation,
        profile.coreColor,
        1.2,
        0.72,
      )
      return
    }

    if (projectile.weaponId === 'crescent-array') {
      if (stage >= 1) {
        const echoOffset = 5 + stage * 1.4
        const echoPoints = trailPoints.map((point, index) => {
          const fade = 1 - index / Math.max(1, trailPoints.length - 1)
          return {
            x: point.x + normalX * echoOffset * fade,
            y: point.y + normalY * echoOffset * fade,
          }
        })
        this.drawPolyline(graphics, echoPoints, profile.secondaryColor, 1.5 + stage * 0.2, 0.48)
      }
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
      this.drawStarburst(
        graphics,
        x,
        y,
        6 + stage,
        2,
        7 + stage * 1.6,
        projectile.sprite.rotation,
        profile.coreColor,
        1.4,
        0.76,
      )
      return
    }

    if (projectile.weaponId === 'mirror-bow') {
      const echoCount = 1 + stage
      for (let echo = 1; echo <= echoCount; echo += 1) {
        const offset = (echo % 2 ? 1 : -1) * (4 + Math.ceil(echo / 2) * 3)
        graphics
          .moveTo(startX + normalX * offset, startY + normalY * offset)
          .lineTo(x + normalX * offset * 0.2, y + normalY * offset * 0.2)
          .stroke({
            color: echo % 2 ? profile.secondaryColor : profile.accentColor,
            width: Math.max(1, 1.8 - echo * 0.16),
            alpha: 0.46 - echo * 0.06,
          })
        const shardX = lerp(startX, x, echo / (echoCount + 1))
        const shardY = lerp(startY, y, echo / (echoCount + 1))
        this.drawDiamondGlyph(
          graphics,
          shardX + normalX * offset,
          shardY + normalY * offset,
          2.8 + stage * 0.5,
          projectile.sprite.rotation,
          echo % 2 ? profile.secondaryColor : profile.coreColor,
          0.58,
          stage >= 2,
        )
      }
      return
    }

    if (projectile.weaponId === 'ash-halo') {
      for (const side of [-1, 1]) {
        this.drawPolyline(
          graphics,
          [
            {
              x: startX + normalX * side * (3 + stage),
              y: startY + normalY * side * (3 + stage),
            },
            {
              x:
                lerp(startX, x, 0.58) +
                normalX * side * (7 + stage * 2),
              y:
                lerp(startY, y, 0.58) +
                normalY * side * (7 + stage * 2),
            },
            {
              x: x - dx * 3 + normalX * side * 1.5,
              y: y - dy * 3 + normalY * side * 1.5,
            },
          ],
          side > 0 ? profile.secondaryColor : profile.accentColor,
          side > 0 ? 1.6 : 2.2,
          side > 0 ? 0.5 : 0.42,
        )
      }
      this.drawCinderFeather(
        graphics,
        x - dx * 2,
        y - dy * 2,
        Math.atan2(dy, dx),
        12 + stage * 2,
        4 + stage,
        profile.glowColor,
        profile.coreColor,
        0.62,
        projectile.visualSeed % 2 === 0 ? 1 : -1,
      )
      return
    }

    if (projectile.weaponId === 'null-bell') {
      const echoes = 1 + Math.min(2, stage)
      for (let echo = 0; echo < echoes; echo += 1) {
        const centerX = x - dx * (8 + echo * 9)
        const centerY = y - dy * (8 + echo * 9)
        const depth = 7 + echo * 3
        const spread = 7 + stage * 1.5 + echo * 1.5
        this.drawPolyline(
          graphics,
          [
            {
              x: centerX - dx * depth + normalX * spread,
              y: centerY - dy * depth + normalY * spread,
            },
            { x: centerX + dx * depth, y: centerY + dy * depth },
            {
              x: centerX - dx * depth - normalX * spread,
              y: centerY - dy * depth - normalY * spread,
            },
          ],
          echo % 2 ? profile.secondaryColor : profile.accentColor,
          Math.max(1, 1.8 - echo * 0.28),
          0.48 - echo * 0.1,
        )
      }
      return
    }
  }

  private createVfxTextures() {
    const create = (weaponId: WeaponId, draw: (graphics: Graphics, color: number) => void) => {
      const graphics = new Graphics()
      draw(graphics, WEAPONS[weaponId].color)
      const texture = this.app.renderer.generateTexture({
        target: graphics,
        resolution: 2,
        antialias: true,
      })
      this.projectileTextures.set(weaponId, texture)
      graphics.destroy()
    }

    create('helio-lance', (graphics, color) => {
      graphics.poly([0, 14, 46, 1, 78, 14, 46, 27], true).fill({ color, alpha: 0.22 })
      graphics.poly([9, 14, 49, 7, 78, 14, 49, 21], true).fill({ color: 0xffd15f, alpha: 0.7 })
      graphics.poly([16, 14, 55, 10, 78, 14, 55, 18], true).fill({ color: 0xfff9dc, alpha: 0.98 })
      graphics.poly([28, 5, 43, 9, 36, 14, 43, 19, 28, 23, 34, 14], true).fill({ color: 0x76f5df, alpha: 0.68 })
      graphics.moveTo(4, 14).lineTo(70, 14).stroke({ color: 0xffffff, width: 1.5, alpha: 0.92 })
    })
    create('crescent-array', (graphics, color) => {
      graphics
        .poly([1, 20, 18, 2, 53, 1, 37, 18, 54, 39, 18, 37], true)
        .fill({ color, alpha: 0.38 })
      graphics
        .poly([7, 20, 23, 7, 44, 5, 31, 18, 46, 34, 23, 33], true)
        .fill({ color: 0xf2ffff, alpha: 0.96 })
      graphics.moveTo(9, 20).lineTo(44, 5).stroke({ color: 0x8cecff, width: 2, alpha: 0.74 })
      graphics.circle(29, 19, 3).fill({ color: 0xb18cff, alpha: 0.7 })
    })
    create('arc-choir', (graphics, color) => {
      graphics
        .poly([0, 14, 15, 5, 25, 11, 39, 2, 34, 13, 58, 18, 38, 22, 24, 16], true)
        .fill({ color, alpha: 0.46 })
      graphics.moveTo(3, 14).lineTo(52, 17).stroke({ color: 0xfaf4ff, width: 3, alpha: 0.96 })
      graphics.circle(26, 13, 7).stroke({ color: 0x70eaff, width: 2, alpha: 0.62 })
      graphics.circle(26, 13, 2.5).fill({ color: 0xffffff, alpha: 0.92 })
    })
    create('rift-seeds', (graphics, color) => {
      graphics.circle(19, 19, 18).fill({ color, alpha: 0.14 })
      graphics.circle(19, 19, 13).fill({ color: 0x010708, alpha: 0.98 })
      graphics.circle(19, 19, 14).stroke({ color, width: 3.5, alpha: 0.9 })
      graphics.ellipse(19, 19, 18, 8).stroke({ color: 0x9276ff, width: 2, alpha: 0.62 })
      graphics.circle(14, 13, 3).fill({ color: 0xe9fff6, alpha: 0.9 })
    })
    create('comet-swarm', (graphics, color) => {
      graphics.poly([0, 16, 31, 3, 52, 16, 31, 29], true).fill({ color, alpha: 0.28 })
      graphics.poly([6, 16, 34, 8, 50, 16, 34, 24], true).fill({ color: 0xffd25d, alpha: 0.62 })
      graphics.ellipse(43, 16, 12, 10).fill({ color, alpha: 0.9 })
      graphics.ellipse(46, 13, 6, 5).fill({ color: 0xfff4de, alpha: 0.98 })
      graphics.moveTo(17, 16).lineTo(48, 16).stroke({ color: 0xffffff, width: 1.4, alpha: 0.74 })
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
      graphics.moveTo(4, 8).lineTo(18, 4).stroke({ color: color, width: 1.5, alpha: 0.62 })
      graphics.moveTo(4, 20).lineTo(18, 24).stroke({ color: 0xffd06a, width: 1.2, alpha: 0.56 })
    })
    create('mirror-bow', (graphics, color) => {
      graphics.poly([0, 16, 20, 1, 65, 8, 82, 16, 65, 24, 20, 31], true).fill({ color, alpha: 0.24 })
      graphics.poly([9, 16, 30, 7, 70, 13, 79, 16, 70, 19, 30, 25], true).fill({ color: 0xffffff, alpha: 0.92 })
      graphics.moveTo(6, 16).lineTo(76, 16).stroke({ color: 0x8de9ff, width: 2.4, alpha: 0.8 })
      graphics.poly([34, 5, 42, 16, 34, 27, 26, 16], true).stroke({ color: 0xc196ff, width: 2, alpha: 0.68 })
    })
    create('null-bell', (graphics, color) => {
      graphics
        .poly([4, 25, 9, 10, 15, 4, 27, 4, 33, 10, 38, 25, 31, 30, 11, 30], true)
        .fill({ color: 0x0b0d21, alpha: 0.94 })
        .stroke({ color, width: 3.2, alpha: 0.86 })
      graphics
        .poly([21, 25, 27, 34, 21, 40, 15, 34], true)
        .fill({ color: 0xf0f1ff, alpha: 0.96 })
      graphics
        .poly([11, 18, 21, 11, 31, 18, 21, 23], true)
        .stroke({ color: 0xb6a0ff, width: 1.8, alpha: 0.68 })
    })

    const spark = new Graphics()
    spark.poly([10, 0, 16, 10, 10, 22, 4, 10], true).fill({ color: 0xffffff, alpha: 0.94 })
    spark.circle(10, 10, 8).fill({ color: 0xffffff, alpha: 0.18 })
    this.sparkTexture = this.app.renderer.generateTexture({
      target: spark,
      resolution: 2,
      antialias: true,
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
      Boolean(this.upgradeOptions?.length)
    )
  }

  private sliceTexture(texture: Texture, columns: number, rows: number) {
    const frameWidth = texture.width / columns
    const frameHeight = texture.height / rows
    const frames: Texture[] = []
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        frames.push(
          new Texture({
            source: texture.source,
            frame: new Rectangle(column * frameWidth, row * frameHeight, frameWidth, frameHeight),
          }),
        )
      }
    }
    return frames
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
