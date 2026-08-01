import { describe, expect, it } from 'vitest'
import {
  COMBAT_TEXT_CAP_DESKTOP,
  COMBAT_TEXT_COALESCE_SECONDS,
  COMBAT_TEXT_COLORS,
  CombatTextQueue,
  HERO_BODY_CENTER_OFFSET_Y,
  HERO_BODY_HALF_HEIGHT,
  HERO_BODY_HALF_WIDTH,
  HERO_DAMAGE_FLASH_CRIMSON,
  HERO_DAMAGE_FLASH_CRIMSON_REDUCED,
  HERO_CONTACT_TRIGGER_PADDING,
  HERO_MELEE_RELEASE_PADDING,
  circleTouchesHeroBody,
  combatTextFontSize,
  combatTextPose,
  createPlayerHitFeedback,
  formatCombatDamage,
  heroDamageFlashTint,
  laneTouchesHeroBody,
} from './combatReadability'

describe('hero collision readability contract', () => {
  it('uses a model-aligned body ellipse instead of a feet circle', () => {
    expect(HERO_BODY_HALF_WIDTH).toBe(17)
    expect(HERO_BODY_HALF_HEIGHT).toBe(36)
    expect(HERO_BODY_CENTER_OFFSET_Y).toBe(-36)
    expect(HERO_CONTACT_TRIGGER_PADDING).toBe(8)
    expect(HERO_MELEE_RELEASE_PADDING).toBe(25)
  })

  it('hits the visible torso and boots while excluding space below the model', () => {
    expect(circleTouchesHeroBody(100, 100, 100, 66, 0)).toBe(true)
    expect(circleTouchesHeroBody(100, 100, 100, 99, 0)).toBe(true)
    expect(circleTouchesHeroBody(100, 100, 100, 106, 0)).toBe(false)
    expect(circleTouchesHeroBody(100, 100, 118, 64, 0)).toBe(false)
    expect(circleTouchesHeroBody(100, 100, 118, 64, 2)).toBe(true)
  })

  it('projects the body ellipse onto hostile lanes at every angle', () => {
    expect(laneTouchesHeroBody(100, 100, 0, 64, 0, 90, 8)).toBe(true)
    expect(laneTouchesHeroBody(100, 100, 0, 112, 0, 90, 8)).toBe(false)
    expect(
      laneTouchesHeroBody(100, 100, 100, 0, Math.PI / 2, 55, 8),
    ).toBe(true)
  })
})

describe('source-aware player hit feedback', () => {
  it('points away from the attacker and distinguishes boss projectile energy', () => {
    const feedback = createPlayerHitFeedback({
      playerX: 100,
      playerY: 50,
      maxHp: 100,
      healthDamage: 12,
      shieldDamage: 4,
      context: {
        kind: 'projectile',
        boss: true,
        originX: 70,
        originY: 10,
        color: 0x8e315f,
      },
    })

    expect(feedback).toBeDefined()
    expect(feedback?.directionX).toBeCloseTo(0.6)
    expect(feedback?.directionY).toBeCloseTo(0.8)
    expect(feedback?.color).toBe(0x8e315f)
    expect(feedback?.boss).toBe(true)
    expect(feedback?.kind).toBe('projectile')
    expect(feedback?.intensity).toBeGreaterThan(0.8)
    expect(feedback?.duration).toBe(0.32)
  })

  it('returns no visual hit for fully rejected damage and uses hostile fallbacks', () => {
    expect(
      createPlayerHitFeedback({
        playerX: 0,
        playerY: 0,
        maxHp: 100,
        healthDamage: 0,
        shieldDamage: 0,
        context: {
          kind: 'contact',
          boss: false,
          originX: 0,
          originY: 0,
        },
      }),
    ).toBeUndefined()

    const fallback = createPlayerHitFeedback({
      playerX: 0,
      playerY: 0,
      maxHp: 100,
      healthDamage: 1,
      shieldDamage: 0,
      context: {
        kind: 'telegraph',
        boss: false,
        originX: 0,
        originY: 0,
      },
    })
    expect(fallback?.color).toBeGreaterThan(0)
    expect(Math.hypot(fallback?.directionX ?? 0, fallback?.directionY ?? 0))
      .toBeCloseTo(1)
  })

  it('flashes the hero crimson briefly for every accepted hit event', () => {
    expect(heroDamageFlashTint(0, 0.4, false)).toBe(HERO_DAMAGE_FLASH_CRIMSON)
    expect(heroDamageFlashTint(0, 0.4, true))
      .toBe(HERO_DAMAGE_FLASH_CRIMSON_REDUCED)
    expect(heroDamageFlashTint(0.5, 1, false)).toBe(0xffffff)
    expect(heroDamageFlashTint(0, 0, false)).toBe(0xffffff)
  })
})

describe('bounded combat text queue', () => {
  it('shows and coalesces ordinary low-damage horde hits', () => {
    const queue = new CombatTextQueue(8)
    queue.request({
      targetKey: 'enemy:12:helio-lance',
      target: 'horde',
      x: 100,
      y: 120,
      amount: 7,
      color: 0xf7d46c,
    })
    queue.advance(COMBAT_TEXT_COALESCE_SECONDS * 0.5)
    queue.request({
      targetKey: 'enemy:12:helio-lance',
      target: 'horde',
      x: 103,
      y: 118,
      amount: 8,
      color: 0xf7d46c,
    })

    expect(queue.active()).toHaveLength(1)
    expect(queue.active()[0].amount).toBe(15)
    expect(queue.active()[0].x).toBe(103)
    expect(combatTextFontSize(queue.active()[0])).toBe(12)
  })

  it('keeps boss, hero-health, shield, and critical styles separate', () => {
    const queue = new CombatTextQueue(8)
    for (const [target, color] of [
      ['boss', 0xcfe3ff],
      ['hero-health', COMBAT_TEXT_COLORS.heroHealth],
      ['hero-shield', COMBAT_TEXT_COLORS.heroShield],
    ] as const) {
      queue.request({
        targetKey: String(target),
        target,
        x: 0,
        y: 0,
        amount: 9,
        color,
        critical: target === 'boss',
      })
    }

    expect(queue.active()).toHaveLength(3)
    expect(combatTextFontSize(queue.active()[0])).toBe(15)
    expect(combatTextFontSize(queue.active()[1])).toBe(13)
    expect(combatTextFontSize(queue.active()[2])).toBe(13)
  })

  it('recycles the oldest labels at the cap and expires everything on the tick', () => {
    const queue = new CombatTextQueue(3)
    for (let index = 0; index < 5; index += 1) {
      queue.request({
        targetKey: `enemy:${index}`,
        target: 'horde',
        x: index,
        y: index,
        amount: index + 1,
        color: 0xffffff,
      })
      queue.advance(0.02)
    }

    expect(queue.active()).toHaveLength(3)
    expect(queue.active().map(({ targetKey }) => targetKey))
      .toEqual(['enemy:2', 'enemy:3', 'enemy:4'])

    queue.advance(2)
    expect(queue.active()).toHaveLength(0)
  })

  it('keeps poses finite and formats compact values', () => {
    const queue = new CombatTextQueue(COMBAT_TEXT_CAP_DESKTOP)
    const entry = queue.request({
      targetKey: 'boss:1',
      target: 'boss',
      x: 100,
      y: 200,
      amount: 27_000,
      color: 0xffffff,
    })
    expect(entry).toBeDefined()
    if (!entry) return

    queue.advance(0.32)
    expect(Object.values(combatTextPose(entry)).every(Number.isFinite)).toBe(true)
    expect(formatCombatDamage(999)).toBe('999')
    expect(formatCombatDamage(1_250)).toBe('1.3K')
    expect(formatCombatDamage(27_000)).toBe('27K')
    expect(formatCombatDamage(1_200_000)).toBe('1.2M')
  })
})
