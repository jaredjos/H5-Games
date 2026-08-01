/**
 * The Bearer's collision body follows the visible character instead of the
 * old feet-centred circle. The authored sprite root sits at the boots, so the
 * ellipse extends upward through the torso while excluding cape flourishes.
 */
export const HERO_BODY_HALF_WIDTH = 17
export const HERO_BODY_HALF_HEIGHT = 36
export const HERO_BODY_CENTER_OFFSET_Y = -36
export const HERO_CONTACT_TRIGGER_PADDING = 8
export const HERO_MELEE_RELEASE_PADDING = 25

export interface HeroBodyPoint {
  readonly x: number
  readonly y: number
}

const heroBodyCenter = (
  playerX: number,
  playerY: number,
): HeroBodyPoint => ({
  x: finiteOr(playerX, 0),
  y: finiteOr(playerY, 0) + HERO_BODY_CENTER_OFFSET_Y,
})

/**
 * Tests a circular hostile footprint against the Bearer's body ellipse.
 * Expanding both ellipse axes by the hostile radius is a stable, conservative
 * Minkowski approximation that remains readable at every camera scale.
 */
export function circleTouchesHeroBody(
  playerX: number,
  playerY: number,
  circleX: number,
  circleY: number,
  circleRadius: number,
) {
  const center = heroBodyCenter(playerX, playerY)
  const radius = Math.max(0, finiteOr(circleRadius, 0))
  const halfWidth = HERO_BODY_HALF_WIDTH + radius
  const halfHeight = HERO_BODY_HALF_HEIGHT + radius
  const dx = finiteOr(circleX, 0) - center.x
  const dy = finiteOr(circleY, 0) - center.y
  return (dx / halfWidth) ** 2 + (dy / halfHeight) ** 2 <= 1
}

/**
 * Tests an oriented hostile lane against the Bearer's body ellipse. Ellipse
 * support radii are projected onto the lane's tangent and normal, keeping the
 * collision footprint aligned with the visible model for every attack angle.
 */
export function laneTouchesHeroBody(
  playerX: number,
  playerY: number,
  laneX: number,
  laneY: number,
  laneAngle: number,
  laneLength: number,
  laneWidth: number,
) {
  const center = heroBodyCenter(playerX, playerY)
  const angle = finiteOr(laneAngle, 0)
  const tangentX = Math.cos(angle)
  const tangentY = Math.sin(angle)
  const normalX = -tangentY
  const normalY = tangentX
  const dx = center.x - finiteOr(laneX, 0)
  const dy = center.y - finiteOr(laneY, 0)
  const localX = tangentX * dx + tangentY * dy
  const localY = normalX * dx + normalY * dy
  const supportX = Math.hypot(
    HERO_BODY_HALF_WIDTH * tangentX,
    HERO_BODY_HALF_HEIGHT * tangentY,
  )
  const supportY = Math.hypot(
    HERO_BODY_HALF_WIDTH * normalX,
    HERO_BODY_HALF_HEIGHT * normalY,
  )
  const length = Math.max(0, finiteOr(laneLength, 0))
  const halfLaneWidth = Math.max(0, finiteOr(laneWidth, 0)) * 0.5

  return (
    localX >= -supportX &&
    localX <= length + supportX &&
    Math.abs(localY) <= halfLaneWidth + supportY
  )
}

export const COMBAT_TEXT_COLORS = Object.freeze({
  critical: 0xffdf79,
  heroHealth: 0xff727c,
  heroShield: 0x86e7ff,
} as const)

export const COMBAT_TEXT_COALESCE_SECONDS = 0.1
export const COMBAT_TEXT_LIFETIME_SECONDS = 0.64
export const COMBAT_TEXT_CAP_DESKTOP = 88
export const COMBAT_TEXT_CAP_MOBILE = 44
export const HERO_DAMAGE_FLASH_CRIMSON = 0xff3548
export const HERO_DAMAGE_FLASH_CRIMSON_REDUCED = 0xff6670

export type PlayerDamageKind = 'contact' | 'telegraph' | 'projectile'
export type CombatTextTarget =
  | 'horde'
  | 'boss'
  | 'hero-health'
  | 'hero-shield'

export interface PlayerDamageContext {
  readonly kind: PlayerDamageKind
  readonly boss: boolean
  readonly originX: number
  readonly originY: number
  readonly color?: number
}

export interface PlayerHitFeedbackInput {
  readonly playerX: number
  readonly playerY: number
  readonly maxHp: number
  readonly healthDamage: number
  readonly shieldDamage: number
  readonly context: PlayerDamageContext
}

export interface PlayerHitFeedback {
  readonly directionX: number
  readonly directionY: number
  readonly color: number
  readonly intensity: number
  readonly duration: number
  readonly healthDamage: number
  readonly shieldDamage: number
  readonly boss: boolean
  readonly kind: PlayerDamageKind
}

export interface CombatTextRequest {
  readonly targetKey: string
  readonly target: CombatTextTarget
  readonly x: number
  readonly y: number
  readonly amount: number
  readonly color: number
  readonly critical?: boolean
}

export interface CombatTextEntry {
  readonly id: number
  readonly targetKey: string
  readonly target: CombatTextTarget
  x: number
  y: number
  amount: number
  color: number
  critical: boolean
  age: number
  readonly lifetime: number
  readonly driftX: number
}

export interface CombatTextPose {
  readonly x: number
  readonly y: number
  readonly alpha: number
  readonly scale: number
}

const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const clamp01 = (value: number) => clamp(value, 0, 1)

const normalizeColor = (value: number, fallback: number) =>
  clamp(Math.round(finiteOr(value, fallback)), 0, 0xffffff)

const hostileFallbackColor = (
  kind: PlayerDamageKind,
  boss: boolean,
) => {
  if (boss) return kind === 'projectile' ? 0xa054b5 : 0x8e2f49
  return kind === 'projectile' ? 0x744582 : 0x7d293e
}

/**
 * Converts applied player damage into a short, source-aware visual event.
 * This is presentation-only: callers calculate shield and HP loss first.
 */
export function createPlayerHitFeedback(
  input: PlayerHitFeedbackInput,
): PlayerHitFeedback | undefined {
  const healthDamage = Math.max(0, finiteOr(input.healthDamage, 0))
  const shieldDamage = Math.max(0, finiteOr(input.shieldDamage, 0))
  const totalDamage = healthDamage + shieldDamage
  if (totalDamage <= 0) return undefined

  const dx =
    finiteOr(input.playerX, 0) -
    finiteOr(input.context.originX, input.playerX - 1)
  const dy =
    finiteOr(input.playerY, 0) -
    finiteOr(input.context.originY, input.playerY)
  const length = Math.hypot(dx, dy)
  const directionX = length > 0.001 ? dx / length : 1
  const directionY = length > 0.001 ? dy / length : 0
  const damageRatio = totalDamage / Math.max(1, finiteOr(input.maxHp, 1))
  const bossGain = input.context.boss ? 0.12 : 0
  const healthGain = healthDamage > 0 ? 0.1 : 0

  return Object.freeze({
    directionX,
    directionY,
    color: normalizeColor(
      input.context.color ?? Number.NaN,
      hostileFallbackColor(input.context.kind, input.context.boss),
    ),
    intensity: clamp(0.36 + damageRatio * 2.2 + bossGain + healthGain, 0.36, 1),
    duration: input.context.boss ? 0.32 : 0.27,
    healthDamage,
    shieldDamage,
    boss: input.context.boss,
    kind: input.context.kind,
  })
}

/**
 * Returns a short, unmistakable crimson sprite tint at the front of every
 * accepted damage event. It releases quickly so the authored hero palette is
 * restored well before the directional cinders and vignette finish fading.
 */
export function heroDamageFlashTint(
  progress: number,
  intensity: number,
  reducedFlash: boolean,
) {
  const safeProgress = clamp01(finiteOr(progress, 1))
  const safeIntensity = clamp01(finiteOr(intensity, 0))
  const flashWindow = reducedFlash ? 0.16 : 0.24
  if (safeProgress >= flashWindow || safeIntensity <= 0) return 0xffffff
  const cadence = safeProgress / flashWindow
  const visible = cadence < 0.44 || cadence > 0.62
  if (!visible) return 0xffffff
  return reducedFlash
    ? HERO_DAMAGE_FLASH_CRIMSON_REDUCED
    : HERO_DAMAGE_FLASH_CRIMSON
}

export function formatCombatDamage(amount: number) {
  const safe = Math.max(0, Math.round(finiteOr(amount, 0)))
  if (safe < 1_000) return String(safe)
  if (safe < 10_000) {
    const compact = (safe / 1_000).toFixed(1).replace(/\.0$/, '')
    return `${compact}K`
  }
  if (safe < 1_000_000) return `${Math.round(safe / 1_000)}K`
  const compact = (safe / 1_000_000).toFixed(1).replace(/\.0$/, '')
  return `${compact}M`
}

export function combatTextFontSize(entry: CombatTextEntry) {
  if (entry.critical) return 15
  return entry.target === 'horde' ? 12 : 13
}

export function combatTextPose(entry: CombatTextEntry): CombatTextPose {
  const progress = clamp01(entry.age / Math.max(0.01, entry.lifetime))
  const lift = 8 + progress * 28
  const fade = 1 - clamp01((progress - 0.56) / 0.44)
  const entrance = clamp01(progress / 0.08)
  const targetScale =
    entry.target === 'boss'
      ? 1.06
      : entry.target === 'hero-health' || entry.target === 'hero-shield'
        ? 1.03
        : 1

  return Object.freeze({
    x: entry.x + entry.driftX * progress,
    y: entry.y - lift,
    alpha: entrance * fade,
    scale: targetScale * (0.9 + entrance * 0.1),
  })
}

/**
 * A simulation-ticked, bounded queue. Rendering code can pool Pixi Text
 * instances against the stable entry ids without creating one RAF per hit.
 */
export class CombatTextQueue {
  private readonly capacity: number
  private nextId = 1
  private entries: CombatTextEntry[] = []

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(finiteOr(capacity, 1)))
  }

  request(request: CombatTextRequest) {
    const amount = Math.max(0, finiteOr(request.amount, 0))
    if (amount <= 0) return undefined

    const critical = Boolean(request.critical)
    const color = normalizeColor(request.color, 0xffffff)
    const existing = this.entries.find(
      (entry) =>
        entry.targetKey === request.targetKey &&
        entry.target === request.target &&
        entry.color === color &&
        entry.critical === critical &&
        entry.age <= COMBAT_TEXT_COALESCE_SECONDS,
    )
    if (existing) {
      existing.amount += amount
      existing.x = finiteOr(request.x, existing.x)
      existing.y = finiteOr(request.y, existing.y)
      existing.age = 0
      return existing
    }

    if (this.entries.length >= this.capacity) {
      let oldestIndex = 0
      let oldestProgress = -1
      for (let index = 0; index < this.entries.length; index += 1) {
        const entry = this.entries[index]
        const progress = entry.age / Math.max(0.01, entry.lifetime)
        if (progress > oldestProgress) {
          oldestProgress = progress
          oldestIndex = index
        }
      }
      this.entries.splice(oldestIndex, 1)
    }

    const id = this.nextId
    this.nextId += 1
    const entry: CombatTextEntry = {
      id,
      targetKey: request.targetKey,
      target: request.target,
      x: finiteOr(request.x, 0),
      y: finiteOr(request.y, 0),
      amount,
      color,
      critical,
      age: 0,
      lifetime: COMBAT_TEXT_LIFETIME_SECONDS,
      driftX: ((id * 17) % 9) - 4,
    }
    this.entries.push(entry)
    return entry
  }

  advance(deltaSeconds: number) {
    const delta = Math.max(0, finiteOr(deltaSeconds, 0))
    for (const entry of this.entries) entry.age += delta
    this.entries = this.entries.filter((entry) => entry.age < entry.lifetime)
  }

  active() {
    return this.entries as readonly CombatTextEntry[]
  }

  clear() {
    this.entries = []
  }
}
