import { describe, expect, it } from 'vitest'
import {
  HOSTILE_PROJECTILE_CAPS,
  advanceHostileProjectile,
  canQueueHostileProjectile,
  hostileProjectileCap,
  hostileProjectilePoseAt,
  queueHostileProjectile,
  type HostileProjectileRequest,
} from './hostileProjectiles'

const projectileRequest = (
  overrides: Partial<HostileProjectileRequest> = {},
): HostileProjectileRequest => ({
  id: 'cantor-orb-7',
  sourceUid: 7,
  origin: { x: 100, y: 220 },
  destination: { x: 500, y: 420 },
  windupSeconds: 0.5,
  flightSeconds: 1,
  impactHoldSeconds: 0.25,
  arcHeight: 100,
  impactRadius: 72,
  damage: 18,
  color: 0x8d55a5,
  boss: false,
  ...overrides,
})

describe('hostile projectile queue caps', () => {
  it('uses separate desktop and mobile safety budgets', () => {
    expect(HOSTILE_PROJECTILE_CAPS).toEqual({
      desktop: 48,
      mobile: 24,
    })
    expect(hostileProjectileCap('desktop')).toBe(48)
    expect(hostileProjectileCap('mobile')).toBe(24)

    expect(canQueueHostileProjectile(47, 'desktop')).toBe(true)
    expect(canQueueHostileProjectile(48, 'desktop')).toBe(false)
    expect(canQueueHostileProjectile(23, 'mobile')).toBe(true)
    expect(canQueueHostileProjectile(24, 'mobile')).toBe(false)
    expect(canQueueHostileProjectile(Number.NaN, 'mobile')).toBe(true)
  })

  it('declines a capped queue without partially constructing state', () => {
    expect(
      queueHostileProjectile(projectileRequest(), {
        lod: 'mobile',
        activeCount: 24,
      }),
    ).toBeUndefined()
    expect(
      queueHostileProjectile(projectileRequest(), {
        lod: 'mobile',
        activeCount: 23,
      }),
    ).toBeDefined()
  })
})

describe('hostile projectile simulation', () => {
  it('holds a fixed destination throughout windup and flight', () => {
    const destination = { x: 500, y: 420 }
    const state = queueHostileProjectile(
      projectileRequest({ destination }),
    )
    expect(state).toBeDefined()
    if (!state) return

    destination.x = 900
    destination.y = 900
    expect(state.config.destination).toEqual({ x: 500, y: 420 })
    expect(Object.isFrozen(state.config.destination)).toBe(true)

    const windup = hostileProjectilePoseAt(state)
    expect(windup.phase).toBe('windup')
    expect(windup.position).toEqual({ x: 100, y: 220 })
    expect(windup.destinationVisible).toBe(true)

    const released = advanceHostileProjectile(state, 0.5)
    expect(released.events).toEqual([
      {
        type: 'release',
        projectileId: 'cantor-orb-7',
        sourceUid: 7,
        origin: { x: 100, y: 220 },
        destination: { x: 500, y: 420 },
      },
    ])
    expect(released.pose.phase).toBe('flight')
    expect(released.pose.position).toEqual({ x: 100, y: 220 })
    expect(released.pose.destinationVisible).toBe(true)
  })

  it('samples a deterministic ballistic arc over the ground trajectory', () => {
    const initial = queueHostileProjectile(projectileRequest())
    expect(initial).toBeDefined()
    if (!initial) return

    const released = advanceHostileProjectile(initial, 0.5)
    const midpoint = advanceHostileProjectile(released.state, 0.5)

    expect(midpoint.events).toEqual([])
    expect(midpoint.pose.phase).toBe('flight')
    expect(midpoint.pose.flightProgress).toBeCloseTo(0.5)
    expect(midpoint.pose.arcOffset).toBeCloseTo(100)
    expect(midpoint.pose.shadowPosition).toEqual({ x: 300, y: 320 })
    expect(midpoint.pose.position).toEqual({ x: 300, y: 220 })
    expect(midpoint.pose.shadowScale).toBeCloseTo(0.9)
    expect(midpoint.pose.projectileVisible).toBe(true)
  })

  it('emits impact damage exactly once at the fixed destination', () => {
    const initial = queueHostileProjectile(projectileRequest())
    expect(initial).toBeDefined()
    if (!initial) return

    const beforeImpact = advanceHostileProjectile(initial, 1.49)
    expect(beforeImpact.events.map((event) => event.type)).toEqual(['release'])
    expect(beforeImpact.state.impactResolved).toBe(false)

    const impact = advanceHostileProjectile(beforeImpact.state, 0.01)
    expect(impact.events).toEqual([
      {
        type: 'impact',
        projectileId: 'cantor-orb-7',
        sourceUid: 7,
        destination: { x: 500, y: 420 },
        radius: 72,
        damage: 18,
        color: 0x8d55a5,
        boss: false,
      },
    ])
    expect(impact.state.impactResolved).toBe(true)
    expect(impact.pose.phase).toBe('impact')
    expect(impact.pose.position).toEqual({ x: 500, y: 420 })

    const held = advanceHostileProjectile(impact.state, 0.1)
    const expired = advanceHostileProjectile(held.state, 1)
    expect(held.events).toEqual([])
    expect(expired.events).toEqual([])
    expect(expired.pose.phase).toBe('expired')
  })

  it('preserves release then impact ordering across a dropped frame', () => {
    const state = queueHostileProjectile(projectileRequest())
    expect(state).toBeDefined()
    if (!state) return

    const step = advanceHostileProjectile(state, 9)
    expect(step.events.map((event) => event.type)).toEqual([
      'release',
      'impact',
    ])
    expect(step.state.released).toBe(true)
    expect(step.state.impactResolved).toBe(true)
    expect(step.pose.phase).toBe('expired')

    const repeated = advanceHostileProjectile(step.state, 9)
    expect(repeated.events).toEqual([])
  })

  it('normalizes malformed timing and combat values into finite bounds', () => {
    const state = queueHostileProjectile(
      projectileRequest({
        sourceUid: -20,
        origin: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
        destination: { x: Number.NEGATIVE_INFINITY, y: 12 },
        windupSeconds: -1,
        flightSeconds: 0,
        impactHoldSeconds: Number.NaN,
        arcHeight: Number.POSITIVE_INFINITY,
        impactRadius: -5,
        damage: Number.NaN,
        color: Number.POSITIVE_INFINITY,
      }),
    )
    expect(state).toBeDefined()
    if (!state) return

    expect(state.config).toMatchObject({
      sourceUid: 0,
      origin: { x: 0, y: 0 },
      destination: { x: 0, y: 12 },
      windupSeconds: 0,
      flightSeconds: 0.05,
      impactHoldSeconds: 0.24,
      arcHeight: 0,
      impactRadius: 2,
      damage: 0,
      color: 0x6d294c,
    })
    for (const value of Object.values(hostileProjectilePoseAt(state))) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true)
    }
  })
})
