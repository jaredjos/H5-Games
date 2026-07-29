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
  createGroundShadowFilter,
  updateGroundShadowFilter,
  type GroundShadowFilter,
} from './characterMaterial'
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
  createBossHostileField,
  destroyActorAtmosphereField,
  updateBossHostileField,
  type BossHostileField,
} from './actorAtmosphere'
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
  x;Í¶ë{h‘éì¶»§q«^v&÷74FÖ÷7†W&UVæ–f÷&×3¢Væ–f÷&×2ÒÀ¢&W6öÇWF–öã¢v–æ†W&—BrÀ¢çF–Æ–3¢v–æ†W&—BrÀ¢FF–æs¢À¢&ÆVæE&WV—&VC¢fÇ6RÀ¢Ò’À¢Væ–f÷&×2À¢’2&÷74†÷7F–ÆTf–VÆ@¢WFFT&÷74†÷7F–ÆTf–VÆB†f–VÆBÂ–æ—F–Å7FFR¢&WGW&âf–VÆ@§Ğ ¦W‡÷'BgVæ7F–öâWFFT&÷74†÷7F–ÆTf–VÆB€¢f–VÆC¢&÷74†÷7F–ÆTf–VÆBÂVæFVf–æVBÀ¢7FFS¢'F–ÃÄ&÷74†÷7F–ÆTf–VÆE7FFSâÀ¢’°¢–b‚f–VÆBÇÂf–VÆBæFW7G&÷–VB’&WGW&à¢6öç7B&W6öÇfVBÒ&W6öÇfT&÷74†÷7F–ÆTf–VÆE&ÖWFW'2‡7FFR¢f–VÆBçVæ–f÷&×2çVæ–f÷&×2çUF–ÖRÒ&W6öÇfVBçF–ÖP¢f–VÆBçVæ–f÷&×2çVæ–f÷&×2çT–çFVç6—G’Ò&W6öÇfVBæ–çFVç6—G¢f–VÆBçVæ–f÷&×2çVæ–f÷&×2çU7V6–ÂÒ&W6öÇfVBç7V6–À¢f–VÆBçVæ–f÷&×2çVæ–f÷&×2çTGF6´ævÆRÒ&W6öÇfVBæGF6´ævÆP¢f–VÆBçVæ–f÷&×2çVæ–f÷&×2çU†6RÒ&W6öÇfVBç†6P¢f–VÆBçVæ–f÷&×2çVæ–f÷&×2çTÇ†6V–Æ–ærÒ&W6öÇfVBæÇ†6V–Æ–æp§Ğ ¦W‡÷'BgVæ7F–öâFW7G&÷”7F÷$FÖ÷7†W&Tf–VÆB€¢f–VÆC¢7F÷$FÖ÷7†W&Tf–VÆBÂVæFVf–æVBÀ¢’°¢f–VÆCòæFW7G&÷’‚§Ğ 