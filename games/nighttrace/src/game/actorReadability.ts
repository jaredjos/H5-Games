import type { WeaponVfxStage } from './weaponVfx'

export type OverdrawKind = 'dark' | 'bright'

/**
 * Presentation-only actor visibility contract.
 *
 * These values are expressed in world pixels and must only be used while
 * drawing decorative VFX. Collision shapes, damage areas, target selection,
 * telegraph geometry, and projectile simulation must remain unchanged.
 */
export const PROTECTED_HERO_RADIUS = 48
export const HERO_OVERDRAW_RELEASE_RADIUS = 112
export const MINIMUM_ACTOR_CLARITY = 0.82

/**
 * Alpha multipliers at or inside the protected hero silhouette.
 * Dark normal-blend shapes receive the strongest suppression because they can
 * directly erase the actor. Bright/additive shapes retain slightly more energy
 * while remaining below the actor-clarity floor at maximum source alpha.
 */
export const INNER_OVERDRAW_ATTENUATION = Object.freeze({
  dark: 0.05,
  bright: 0.12,
} as const satisfies Readonly<Record<OverdrawKind, number>>)

/**
 * Maximum decorative primitives emitted by one presentation event.
 * Gameplay-bearing primitives are deliberately outside this budget.
 */
export const DECORATIVE_DENSITY_CAP_BY_STAGE = Object.freeze({
  solo: 8,
  combined: 12,
  mastered: 16,
  final: 20,
} as const satisfies Readonly<Record<WeaponVfxStage, number>>)

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const safeDistance = (distance: number) => {
  if (distance === Number.POSITIVE_INFINITY) return distance
  if (!Number.isFinite(distance)) return 0
  return Math.max(0, distance)
}

/**
 * Returns 1 inside the protected silhouette and 0 at or beyond the release
 * radius, with a smooth transition between both boundaries.
 */
export function heroProtectionWeight(distanceToHero: number) {
  const distance = safeDistance(distanceToHero)
  if (distance <= PROTECTED_HERO_RADIUS) return 1
  if (distance >= HERO_OVERDRAW_RELEASE_RADIUS) return 0

  const progress = clamp01(
    (distance - PROTECTED_HERO_RADIUS) /
      (HERO_OVERDRAW_RELEASE_RADIUS - PROTECTED_HERO_RADIUS),
  )
  const smoothProgress = progress * progress * (3 - 2 * progress)
  return 1 - smoothProgress
}

/**
 * Resolves a distance-based presentation multiplier. Effects are strongly
 * attenuated over the hero and return to full strength away from the actor.
 */
export function overdrawAttenuation(
  distanceToHero: number,
  kind: OverdrawKind,
) {
  const protection = heroProtectionWeight(distanceToHero)
  const innerAttenuation = INNER_OVERDRAW_ATTENUATION[kind]
  if (protection >= 1) return innerAttenuation
  if (protection <= 0) return 1
  return 1 - protection * (1 - innerAttenuation)
}

/**
 * Applies the actor-readability contract to decorative alpha only.
 * The result is deterministic, clamped to [0, 1], and leaves remote effects
 * unchanged.
 */
export function attenuateOverdrawAlpha(
  sourceAlpha: number,
  distanceToHero: number,
  kind: OverdrawKind,
) {
  const alpha = Number.isFinite(sourceAlpha) ? clamp01(sourceAlpha) : 0
  return alpha * overdrawAttenuation(distanceToHero, kind)
}

/**
 * Caps decorative detail without affecting gameplay-bearing counts.
 */
export function capDecorativeDensity(
  requestedCount: number,
  stage: WeaponVfxStage,
) {
  const normalized = Number.isFinite(requestedCount)
    ? Math.max(0, Math.floor(requestedCount))
    : 0
  return Math.min(normalized, DECORATIVE_DENSITY_CAP_BY_STAGE[stage])
}

/**
 * Compresses presentation energy when several fully-evolved systems fire in
 * the same frame. Gameplay objects remain intact; only their aggregate visual
 * opacity is normalized so eight awakened weapons do not become a white plate.
 */
export function sceneVfxEnergyScale(
  activeWeaponCount: number,
  activePresentationObjects: number,
) {
  const weapons = Number.isFinite(activeWeaponCount)
    ? Math.max(0, Math.floor(activeWeaponCount))
    : 0
  const objects = Number.isFinite(activePresentationObjects)
    ? Math.max(0, Math.floor(activePresentationObjects))
    : 0
  const weaponPressure = Math.max(0, weapons - 3) * 0.08
  const objectPressure = Math.max(0, objects - 18) * 0.012
  return Math.max(0.4, Math.min(1, 1 / (1 + weaponPressure + objectPressure)))
}
