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
  RunResult,
  TraceModId,
  UpgradeOption,
  WeaponId,
  Vec2,
} from '../shared/types'
import { WEAPONS, createUpgradeDraft, type UpgradeDraftContext } from './content'
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
} from './animation'
import { GameInput } from './input'
import {
  DeterministicRandom,
  clamp,
  distanceSquared,
  lerp,
  pointInPolygon,
  polygonArea,
  segmentIntersection,
} from './math'

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
  selectUpgrade(optionId: string): void
  rerollUpgrade(): void
  togglePause(): void
  activatePulse(): void
}

export interface GameCanvasProps {
  level: LevelDefinition
  settings: GameSettings
  unlockedWeapons: WeaponId[]
  persistentUpgrades: Record<string, number>
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
  hitIds: number[]
  sprite: Sprite
}

interface PickupEntity {
  active: boolean
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
  private readonly loopGraphics = new Graphics()
  private readonly telegraphGraphics = new Graphics()
  private readonly ringGraphics = new Graphics()
  private readonly motionGraphics = new Graphics()
  private readonly projectileTrailGraphics = new Graphics()
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
  private upgradeOptions?: UpgradeOption[]
  private upgradeSeed: number
  private rerollsUsed = 0
  private completed = false
  private completionSent = false
  private kills = 0
  private closedLoops = 0
  private largestChain = 0
  private weapons: OwnedWeapon[] = [{ id: 'helio-lance', rank: 1 }]
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
  private readonly trace: Vec2[] = []
  private readonly weaponCooldowns = new Map<WeaponId, number>()
  private enemyUid = 0
  private spawnBudget = 4
  private hazardTimer = 9
  private bossSpawned = false
  private boss?: EnemyEntity
  private bossIntroTimer = 0
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
    import.meta.env.DEV &&
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).has('qa')
  private readonly player: PlayerState
  private lastWidth = 0
  private lastHeight = 0

  constructor(
    host: HTMLDivElement,
    level: LevelDefinition,
    settings: GameSettings,
    unlockedWeapons: WeaponId[],
    persistentUpgrades: Record<string, number>,
    callbacks: RuntimeCallbacks,
  ) {
    this.host = host
    this.level = level
    this.settings = settings
    this.unlockedWeapons = unlockedWeapons.length ? [...unlockedWeapons] : ['helio-lance']
    this.persistentUpgrades = persistentUpgrades
    this.callbacks = callbacks
    this.audio = new NighttraceAudio(settings)
    this.upgradeSeed = (level.id * 0x9e3779b1) >>> 0
    this.random = new DeterministicRandom((level.id * 0x85ebca6b + 0x27d4eb2d) >>> 0)

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
      xpToNext: 16,
      level: 1,
      pulseCharge: 0,
    }

    for (const id of ALL_WEAPON_IDS) this.weaponDamage.set(id, 0)
    for (const id of ALL_WEAPON_IDS) this.weaponCooldowns.set(id, this.random.range(0.08, 0.32))
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
      this.enemyLayer.addChild(this.motionGraphics)
      this.projectileLayer.addChild(this.projectileTrailGraphics)
      this.effectLayer.addChild(this.motionEchoLayer, this.telegraphGraphics, this.ringGraphics)
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
      for (let index = 0; index < 6; index += 1) this.spawnEnemy()
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

    if (this.qaMode && !this.qaUpgradeGranted && this.elapsed >= 8) {
      this.qaUpgradeGranted = true
      this.player.xp = this.player.xpToNext
      this.levelUp()
      return
    }

    this.updateTrace()
    this.updateSpawning(delta)
    this.updateEnemies(delta)
    this.rebuildEnemyGrid()
    this.updateWeapons(delta)
    this.updateProjectiles(delta)
    this.updatePickups(delta)
    this.updateTelegraphs(delta)
    this.updateVisualEffects(delta)

    const bossAt = this.qaMode
      ? Math.min(45, this.level.duration * 0.2)
      : Math.max(45, this.level.duration - 38)
    if (!this.bossSpawned && this.elapsed >= bossAt) this.spawnBoss()

    this.hazardTimer -= delta
    if (this.hazardTimer <= 0 && !this.bossIntroTimer) {
      this.spawnHazard()
      this.hazardTimer = Math.max(5.2, 14 - this.level.difficulty * 1.15)
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
            bossFrame: this.level.bossFrame,
            levelId: this.level.id,
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

    for (const pickup of this.pickups) {
      if (!pickup.active) continue
      pickup.sprite.position.set(
        lerp(pickup.previousX, pickup.x, this.interpolation),
        lerp(pickup.previousY, pickup.y, this.interpolation) + Math.sin(pickup.age * 5) * 3,
      )
      pickup.sprite.rotation = pickup.age * 0.7
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
    const progress = clamp(this.elapsed / this.level.duration, 0, 1)
    const activeCount = this.enemies.reduce(
      (total, enemy) => total + (enemy.active && !enemy.isBoss ? 1 : 0),
      0,
    )
    const cap = Math.min(380, 80 + this.level.id * 18 + Math.floor(progress * 120))
    const intensity = this.level.spawnRate * (2.1 + progress * 4.8)
    this.spawnBudget += delta * intensity * (this.boss ? 0.45 : 1)

    while (this.spawnBudget >= 1 && activeCount + 1 < cap) {
      this.spawnEnemy()
      this.spawnBudget -= 1
      if (this.spawnBudget > 8) this.spawnBudget = 8
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

    const id = this.random.pick(this.level.enemyPool)
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
    const progress = clamp(this.elapsed / this.level.duration, 0, 1)
    const health = 34 * this.level.enemyHealth * typeScale * (1 + progress * 0.72)
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
      (1 + this.level.difficulty * 0.035)
    enemy.hp = health
    enemy.maxHp = health
    enemy.damage = 7 + this.level.difficulty * 2.1 + typeScale * 1.7
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
    const health = (this.qaMode ? 850 : 1120) * this.level.enemyHealth * (1 + this.level.id * 0.12)

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
    enemy.speed = 48 + this.level.difficulty * 4
    enemy.hp = health
    enemy.maxHp = health
    enemy.damage = 18 + this.level.difficulty * 3.1
    enemy.xp = 0
    enemy.contactCooldown = 0
    enemy.hitFlash = 0
    enemy.isBoss = true
    enemy.phase = 1
    enemy.facing = 1
    enemy.attackMotionStyle = 'boss-intro'
    enemy.attackMotionRemaining = this.qaMode ? 1.3 : 2.2
    enemy.attackMotionDuration = enemy.attackMotionRemaining
    enemy.attackMotionAngle = Math.atan2(this.player.y - y, this.player.x - x)
    enemy.attackTimer = 1.75
    enemy.sprite.texture = this.bossFrames[this.level.bossFrame % 6]
    enemy.sprite.anchor.set(0.5, 0.62)
    enemy.sprite.width = 210 + this.level.id * 3
    enemy.sprite.height = 245 + this.level.id * 4
    enemy.baseScaleX = Math.abs(enemy.sprite.scale.x)
    enemy.baseScaleY = Math.abs(enemy.sprite.scale.y)
    enemy.sprite.scale.set(enemy.baseScaleX, enemy.baseScaleY)
    enemy.sprite.rotation = 0
    enemy.sprite.tint = this.bossTint()
    enemy.sprite.visible = true
    enemy.sprite.position.set(x, y)
    this.boss = enemy
    this.bossIntroTimer = this.qaMode ? 1.3 : 2.2
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
            color: 0xff6e52,
            width: 8,
          })
          this.audio.playBossPhase(nextPhase)
        }
        enemy.attackTimer -= delta
        if (enemy.attackTimer <= 0) {
          this.bossAttack(enemy)
          enemy.attackTimer = Math.max(0.72, 2.15 - enemy.phase * 0.36 - this.level.difficulty * 0.05)
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
        this.triggerEnemyAttack(enemy, 'melee', enemy.isBoss ? 0.42 : 0.34, Math.atan2(dy, dx))
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
      this.queueCircleTelegraph(enemy.x, enemy.y, 92, 0.92, enemy.damage)
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
        this.spawnProjectile(
          owned.id,
          angle,
          720 + moduleRank * 55,
          damage * (1 + moduleRank * 0.08),
          1 + Math.floor(rank / 3),
          0,
          definition.color,
          1.45 + moduleRank * 0.14,
        )
        if (owned.awakened) {
          this.spawnProjectile(owned.id, angle + 0.08, 760, damage * 0.72, 2, 0, 0xffffff)
          this.spawnProjectile(owned.id, angle - 0.08, 760, damage * 0.72, 2, 0, 0xffffff)
        }
        break
      case 'crescent-array': {
        const blades = Math.min(10, 2 + rank + moduleRank + (owned.awakened ? 2 : 0))
        for (let index = 0; index < blades; index += 1) {
          const bladeAngle = (Math.PI * 2 * index) / blades + this.elapsed * 1.4
          this.spawnProjectile(owned.id, bladeAngle, 310, damage, 2, 0, definition.color)
        }
        break
      }
      case 'arc-choir':
        this.chainLightning(
          target,
          damage * (1 + moduleRank * 0.07),
          Math.min(10, 2 + rank + moduleRank + (owned.awakened ? 2 : 0)),
          owned.id,
        )
        break
      case 'rift-seeds':
        this.spawnProjectile(
          owned.id,
          angle,
          235,
          damage * (1 + moduleRank * 0.12),
          0,
          0.4,
          definition.color,
          1.25 + moduleRank * 0.12,
        )
        break
      case 'comet-swarm': {
        const count = Math.min(7, 1 + Math.ceil(rank / 2) + (owned.awakened ? 2 : 0))
        for (let index = 0; index < count; index += 1) {
          this.spawnProjectile(
            owned.id,
            angle + (index - (count - 1) / 2) * 0.19,
            385 + moduleRank * 35,
            damage * (1 + moduleRank * 0.06),
            0,
            3.2 + moduleRank * 0.8,
            definition.color,
          )
        }
        break
      }
      case 'ash-halo':
        this.areaDamage(
          this.player.x,
          this.player.y,
          126 + rank * 16 + moduleRank * 18,
          damage * (1 + moduleRank * 0.1),
          owned.id,
        )
        this.rings.push({
          x: this.player.x,
          y: this.player.y,
          radius: 72,
          maxRadius: 136 + rank * 16,
          life: 0.32,
          total: 0.32,
          color: definition.color,
          width: 7,
        })
        break
      case 'mirror-bow':
        this.spawnProjectile(
          owned.id,
          angle,
          620,
          damage * (1 + moduleRank * 0.08),
          3 + Math.floor(rank / 2) + moduleRank,
          0,
          definition.color,
        )
        this.spawnProjectile(owned.id, angle + Math.PI, 620, damage * 0.75, 2, 0, 0xdaf6ff)
        break
      case 'null-bell':
        this.areaDamage(
          this.player.x,
          this.player.y,
          220 + rank * 22 + moduleRank * 14,
          damage * (1 + moduleRank * 0.13),
          owned.id,
        )
        this.rings.push({
          x: this.player.x,
          y: this.player.y,
          radius: 24,
          maxRadius: 230 + rank * 22,
          life: 0.8,
          total: 0.8,
          color: definition.color,
          width: 10,
        })
        break
    }

    if (this.traceMods.includes('crossfire') && this.attackVolley % 4 === 0) {
      this.spawnProjectile(owned.id, angle + Math.PI, 520, damage * 0.72, 1, 0, definition.color)
    }
    this.audio.play('shot', owned.id === 'null-bell' ? 0.65 : 0.22)
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
    projectile.hitIds.length = 0
    projectile.sprite.texture = this.projectileTextures.get(weaponId) ?? Texture.WHITE
    projectile.sprite.tint = 0xffffff
    const [projectileWidth, projectileHeight] = this.projectileDimensions(weaponId)
    projectile.sprite.width = projectileWidth
    projectile.sprite.height = projectileHeight
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
          this.rings.push({
            x: projectile.x,
            y: projectile.y,
            radius: 8,
            maxRadius: 96,
            life: 0.48,
            total: 0.48,
            color: WEAPONS['rift-seeds'].color,
            width: 6,
          })
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
        projectile.pierce -= 1
        if (projectile.pierce < 0) {
          this.deactivateProjectile(projectile)
          break
        }
      }
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
      if (pickup.age > 30) {
        pickup.active = false
        pickup.sprite.visible = false
        continue
      }
      const dx = this.player.x - pickup.x
      const dy = this.player.y - pickup.y
      const distance = Math.max(0.001, Math.hypot(dx, dy))
      if (distance < magnetRadius) {
        const speed = 120 + (1 - distance / magnetRadius) * 540
        pickup.x += (dx / distance) * speed * delta
        pickup.y += (dy / distance) * speed * delta
      }
      if (distance < 33) {
        pickup.active = false
        pickup.sprite.visible = false
        this.player.xp += pickup.value
        this.player.pulseCharge = clamp(this.player.pulseCharge + pickup.value * 0.16, 0, 100)
        this.audio.play('pickup', 0.36)
        while (this.player.xp >= this.player.xpToNext && !this.upgradeOptions?.length) {
          this.levelUp()
        }
      }
    }
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
      this.rings.push({
        x: telegraph.x,
        y: telegraph.y,
        radius: telegraph.kind === 'circle' ? 10 : Math.min(telegraph.length, 80),
        maxRadius: telegraph.kind === 'circle' ? telegraph.radius : Math.min(telegraph.length, 180),
        life: 0.26,
        total: 0.26,
        color: telegraph.bossAttack ? 0xff4e64 : 0xffb45e,
        width: 10,
      })
      this.spawnBurst(telegraph.x, telegraph.y, 0xff6a4f, 14, 180)
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
        this.spawnMotionEcho(enemy.sprite, enemy.x, enemy.y, this.bossTint(), 0.7, 0, -18, 0.34)
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
    let remaining = amount * (this.qaMode ? 0.1 : 0.72)
    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, remaining)
      this.player.shield -= absorbed
      remaining -= absorbed
    }
    if (remaining > 0) this.player.hp = Math.max(0, this.player.hp - remaining)
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
      victory,
      levelId: this.level.id,
      survivalTime: Math.min(this.elapsed, this.level.duration),
      kills: this.kills,
      closedLoops: this.closedLoops,
      largestChain: this.largestChain,
      dawnShards: victory
        ? 28 + this.level.id * 16 + Math.floor(this.kills * 0.08) + this.closedLoops * 2
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

  private spawnPickup(x: number, y: number, value: number) {
    let pickup = this.pickups.find((candidate) => !candidate.active)
    if (!pickup && this.pickups.length >= 320) {
      pickup = this.pickups.reduce((oldest, candidate) =>
        candidate.age > oldest.age ? candidate : oldest,
      )
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
    pickup.x = x
    pickup.y = y
    pickup.previousX = x
    pickup.previousY = y
    pickup.value = value
    pickup.age = this.random.range(0, Math.PI * 2)
    pickup.sprite.texture = this.pickupFrames[value >= 5 ? 1 : 0] ?? Texture.WHITE
    pickup.sprite.width = value >= 5 ? 34 : 24
    pickup.sprite.height = value >= 5 ? 34 : 24
    pickup.sprite.tint = this.settings.highContrastPickups ? 0xffffff : 0xbafcff
    pickup.sprite.visible = true
    pickup.sprite.position.set(x, y)
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
    for (const enemy of this.enemies) {
      if (!enemy.active || (enemy.x - x) ** 2 + (enemy.y - y) ** 2 > radiusSquared) continue
      this.damageEnemy(enemy, damage, weaponId)
    }
  }

  private chainLightning(first: EnemyEntity, damage: number, jumps: number, weaponId: WeaponId) {
    const hit: number[] = []
    let current: EnemyEntity | undefined = first
    for (let jump = 0; jump < jumps && current; jump += 1) {
      hit.push(current.uid)
      this.damageEnemy(current, damage * Math.max(0.48, 1 - jump * 0.09), weaponId)
      this.rings.push({
        x: current.x,
        y: current.y,
        radius: 4,
        maxRadius: 34,
        life: 0.18,
        total: 0.18,
        color: WEAPONS['arc-choir'].color,
        width: 4,
      })
      current = this.nearestEnemy(current.x, current.y, hit)
      if (current && distanceSquared(current, { x: first.x, y: first.y }) > 320 ** 2) break
    }
  }

  private bossAttack(enemy: EnemyEntity) {
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x)
    const pattern = (this.level.id - 1) % 5
    const warningTime = Math.max(0.52, 0.9 - enemy.phase * 0.08)
    const attackStyle: AttackMotionStyle = [
      'boss-line',
      'boss-orbit',
      'boss-cross',
      'boss-mirror',
      'boss-cluster',
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
      const mirroredX = clamp(WORLD_WIDTH - this.player.x, 72, WORLD_WIDTH - 72)
      const mirroredY = clamp(WORLD_HEIGHT - this.player.y, 72, WORLD_HEIGHT - 72)
      this.queueCircleTelegraph(this.player.x, this.player.y, 72 + enemy.phase * 7, warningTime, enemy.damage, true)
      this.queueCircleTelegraph(mirroredX, mirroredY, 72 + enemy.phase * 7, warningTime, enemy.damage, true)
      if (enemy.phase >= 2) {
        this.queueLineTelegraph(enemy.x, enemy.y, angle, 820, 44, warningTime, enemy.damage * 1.12, true)
      }
      return
    }

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
  ) {
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
  ) {
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

  private drawEffects() {
    this.loopGraphics.clear()
    for (let index = this.loopEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.loopEffects[index]
      if (effect.life <= 0) {
        this.loopEffects.splice(index, 1)
        continue
      }
      const alpha = clamp(effect.life / effect.total, 0, 1)
      const flattened = effect.points.flatMap((point) => [point.x, point.y])
      this.loopGraphics.poly(flattened, true).fill({ color: effect.color, alpha: alpha * 0.12 })
      this.loopGraphics.stroke({ color: 0xffdf87, width: 5, alpha: alpha * 0.8 })
    }

    this.telegraphGraphics.clear()
    this.telegraphGraphics.position.set(0, 0)
    this.telegraphGraphics.rotation = 0
    for (const telegraph of this.telegraphs) {
      if (!telegraph.active) continue
      const progress = 1 - telegraph.life / telegraph.total
      const pulse = 0.22 + progress * 0.28 + Math.sin(progress * Math.PI * 8) * 0.05
      const color = telegraph.bossAttack ? 0xff405b : 0xffad55
      if (telegraph.kind === 'circle') {
        this.telegraphGraphics
          .circle(telegraph.x, telegraph.y, telegraph.radius)
          .fill({ color, alpha: pulse * 0.25 })
        this.telegraphGraphics
          .circle(telegraph.x, telegraph.y, telegraph.radius)
          .stroke({ color, width: 3 + progress * 4, alpha: 0.68 })
        this.telegraphGraphics
          .circle(telegraph.x, telegraph.y, telegraph.radius * progress)
          .stroke({ color: 0xfff0bd, width: 2, alpha: 0.72 })
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
          .fill({ color, alpha: pulse * 0.32 })
          .stroke({ color, width: 2, alpha: 0.65 })
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
    if (enemy.isBoss) return this.bossTint()
    return {
      maskling: 0xff765f,
      shardwing: 0x8de9ff,
      cantor: 0xb993ff,
      railjaw: 0xffa95c,
      chronowisp: 0x75f2ff,
      'cinder-guard': 0xff674f,
    }[enemy.id]
  }

  private projectileDimensions(weaponId: WeaponId): [number, number] {
    return {
      'helio-lance': [42, 16],
      'crescent-array': [34, 27],
      'arc-choir': [34, 18],
      'rift-seeds': [27, 27],
      'comet-swarm': [31, 18],
      'ash-halo': [24, 24],
      'mirror-bow': [44, 18],
      'null-bell': [32, 32],
    }[weaponId] as [number, number]
  }

  private drawProjectileTrail(projectile: ProjectileEntity, x: number, y: number) {
    const speed = Math.hypot(projectile.vx, projectile.vy)
    if (speed < 1) return
    const dx = projectile.vx / speed
    const dy = projectile.vy / speed
    const trail = {
      'helio-lance': [64, 3.2],
      'crescent-array': [25, 4.2],
      'arc-choir': [36, 3.5],
      'rift-seeds': [13, 5.4],
      'comet-swarm': [48, 4],
      'ash-halo': [16, 4],
      'mirror-bow': [58, 3],
      'null-bell': [20, 5],
    }[projectile.weaponId]
    const [length, width] = trail
    const startX = x - dx * length
    const startY = y - dy * length
    this.projectileTrailGraphics
      .moveTo(startX, startY)
      .lineTo(x, y)
      .stroke({ color: projectile.color, width: width * 3.4, alpha: 0.08 })
    this.projectileTrailGraphics
      .moveTo(startX + dx * length * 0.25, startY + dy * length * 0.25)
      .lineTo(x, y)
      .stroke({
        color: projectile.weaponId === 'helio-lance' ? 0xfff4c4 : 0xecffff,
        width,
        alpha: 0.72,
      })
    if (projectile.weaponId === 'comet-swarm') {
      for (let index = 1; index <= 2; index += 1) {
        this.projectileTrailGraphics
          .circle(x - dx * length * (index / 3), y - dy * length * (index / 3), 2.6 - index * 0.5)
          .fill({ color: projectile.color, alpha: 0.36 - index * 0.09 })
      }
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
      graphics.poly([0, 12, 43, 3, 66, 12, 43, 21], true).fill({ color, alpha: 0.28 })
      graphics.poly([8, 12, 47, 7, 66, 12, 47, 17], true).fill({ color: 0xfff5cf, alpha: 0.96 })
      graphics.moveTo(2, 12).lineTo(54, 12).stroke({ color, width: 2, alpha: 0.72 })
    })
    create('crescent-array', (graphics, color) => {
      graphics
        .poly([2, 18, 20, 3, 50, 1, 36, 17, 51, 34, 20, 32], true)
        .fill({ color, alpha: 0.54 })
      graphics
        .poly([10, 18, 24, 8, 42, 6, 31, 17, 43, 29, 24, 27], true)
        .fill({ color: 0xecffff, alpha: 0.92 })
    })
    create('arc-choir', (graphics, color) => {
      graphics
        .poly([0, 13, 18, 4, 27, 10, 45, 2, 33, 14, 56, 18, 37, 20, 22, 15], true)
        .fill({ color, alpha: 0.58 })
      graphics.moveTo(4, 13).lineTo(50, 16).stroke({ color: 0xf4eaff, width: 3, alpha: 0.9 })
    })
    create('rift-seeds', (graphics, color) => {
      graphics.ellipse(16, 16, 15, 13).fill({ color: 0x01080b, alpha: 0.96 })
      graphics.ellipse(16, 16, 14, 12).stroke({ color, width: 4, alpha: 0.84 })
      graphics.circle(12, 11, 3.2).fill({ color: 0xdffff2, alpha: 0.82 })
    })
    create('comet-swarm', (graphics, color) => {
      graphics.poly([0, 14, 23, 3, 45, 14, 23, 25], true).fill({ color, alpha: 0.44 })
      graphics.ellipse(33, 14, 11, 9).fill({ color, alpha: 0.82 })
      graphics.ellipse(36, 12, 5, 4).fill({ color: 0xfff0d8, alpha: 0.96 })
    })
    create('ash-halo', (graphics, color) => {
      graphics
        .poly([14, 0, 24, 13, 18, 30, 6, 30, 1, 16, 9, 7], true)
        .fill({ color, alpha: 0.78 })
      graphics
        .poly([13, 9, 18, 17, 14, 27, 8, 24, 8, 16], true)
        .fill({ color: 0xfff0d0, alpha: 0.9 })
    })
    create('mirror-bow', (graphics, color) => {
      graphics.poly([0, 14, 18, 2, 54, 8, 68, 14, 54, 20, 18, 26], true).fill({ color, alpha: 0.36 })
      graphics.poly([12, 14, 27, 7, 58, 12, 65, 14, 58, 16, 27, 21], true).fill({ color: 0xffffff, alpha: 0.86 })
      graphics.moveTo(8, 14).lineTo(62, 14).stroke({ color: 0x8de9ff, width: 2, alpha: 0.68 })
    })
    create('null-bell', (graphics, color) => {
      graphics.circle(18, 18, 16).stroke({ color, width: 4, alpha: 0.66 })
      graphics.circle(18, 18, 9).stroke({ color: 0xe9ecff, width: 3, alpha: 0.84 })
      graphics.circle(18, 18, 3).fill({ color: 0xffffff, alpha: 0.94 })
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
    if (this.level.id <= 6) return 0xffffff
    const accent = Number.parseInt(this.level.accent.replace('#', ''), 16)
    return Number.isFinite(accent) ? accent : 0xffffff
  }

  private levelUp() {
    this.player.xp -= this.player.xpToNext
    this.player.level += 1
    this.player.xpToNext = Math.round(16 + this.player.level * 8 + this.player.level ** 1.35 * 2)
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
          name: this.level.bossName,
          hp: Math.max(0, this.boss.hp),
          maxHp: this.boss.maxHp,
          phase: this.boss.phase,
        }
      : undefined
    return {
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
        this.elapsed < 10
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
    return this.manualPaused || this.visibilityPaused || Boolean(this.upgradeOptions?.length)
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
    settings,
    unlockedWeapons,
    persistentUpgrades,
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
    settings,
    unlockedWeapons,
    persistentUpgrades,
  })
  callbacksRef.current = { onSnapshot, onComplete, onExit }

  useImperativeHandle(
    ref,
    () => ({
      selectUpgrade: (optionId) => runtimeRef.current?.selectUpgrade(optionId),
      rerollUpgrade: () => runtimeRef.current?.rerollUpgrade(),
      togglePause: () => runtimeRef.current?.togglePause(),
      activatePulse: () => runtimeRef.current?.activatePulse(),
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
