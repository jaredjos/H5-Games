import { describe, expect, it } from 'vitest'
import {
  allocateHostileBoundaryPriorityPools,
  HOSTILE_BOUNDARY_BRIGHTNESS_GAIN,
  HOSTILE_BOUNDARY_FRAME_BUDGET,
  HOSTILE_BOUNDARY_HORDE_MINIMUM,
  HOSTILE_BOUNDARY_PARTICLE_KINDS,
  HOSTILE_BOUNDARY_PRIORITY_MINIMUM,
  reserveHostileBoundaryParticleQuota,
  sampleHostileBoundaryParticles,
  type HostileBoundaryParticle,
} from './hostileBoundaryParticles'

const activeInput = {
  footprint: 'field',
  prominence: 'boss',
  stage: 2,
  lod: 'desktop',
  progress: 0.72,
  motionTime: 4.25,
  seed: 817,
} as const

const numericValues = (particle: HostileBoundaryParticle) =>
  Object.values(particle).filter(
    (value): value is number => typeof value === 'number',
  )

describe('hostile boundary particles', () => {
  it('keeps the approved high-contrast dodge perimeter legible', () => {
    expect(HOSTILE_BOUNDARY_BRIGHTNESS_GAIN).toBeGreaterThanOrEqual(2)
    expect(HOSTILE_BOUNDARY_FRAME_BUDGET).toEqual({
      desktop: 560,
      mobile: 320,
    })
  })

  it('provides enough broken spray density for boss, horde, desktop, and mobile warnings', () => {
    const sampleCount = (
      prominence: 'boss' | 'horde',
      lod: 'desktop' | 'mobile',
      stage: 0 | 1 | 2 | 3,
    ) => sampleHostileBoundaryParticles({
      ...activeInput,
      prominence,
      lod,
      stage,
    }).length

    expect(sampleCount('boss', 'desktop', 0)).toBe(48)
    expect(sampleCount('boss', 'desktop', 3)).toBe(72)
    expect(sampleCount('boss', 'mobile', 0)).toBe(28)
    expect(sampleCount('boss', 'mobile', 3)).toBe(40)
    expect(sampleCount('horde', 'desktop', 0)).toBe(28)
    expect(sampleCount('horde', 'desktop', 3)).toBe(40)
    expect(sampleCount('horde', 'mobile', 0)).toBe(18)
    expect(sampleCount('horde', 'mobile', 3)).toBe(24)
  })

  it('returns immutable finite particles for every footprint, prominence, stage, and LOD', () => {
    expect(HOSTILE_BOUNDARY_PARTICLE_KINDS).toEqual(['filament', 'mote'])

    for (const footprint of ['field', 'lane'] as const) {
      for (const prominence of ['boss', 'horde'] as const) {
        for (const stage of [0, 1, 2, 3] as const) {
          for (const lod of ['desktop', 'mobile'] as const) {
            const particles = sampleHostileBoundaryParticles({
              ...activeInput,
              footprint,
              prominence,
              stage,
              lod,
            })

            expect(Object.isFrozen(particles)).toBe(true)
            expect(particles.length).toBeGreaterThanOrEqual(2)
            expect(new Set(particles.map(({ kind }) => kind))).toEqual(
              new Set(['filament', 'mote']),
            )
            for (const particle of particles) {
              expect(Object.isFrozen(particle)).toBe(true)
              expect(numericValues(particle).every(Number.isFinite)).toBe(true)
              expect(particle.alpha).toBeGreaterThanOrEqual(0)
              expect(particle.alpha).toBeLessThanOrEqual(1)
              expect(particle.glowAlpha).toBeGreaterThanOrEqual(0)
              expect(particle.glowAlpha).toBeLessThanOrEqual(1)
              expect(particle.size).toBeGreaterThan(0)
              expect(particle.stretch).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })

  it('keeps field filaments on the broken perimeter and lane filaments near both edges', () => {
    const field = sampleHostileBoundaryParticles({
      ...activeInput,
      footprint: 'field',
    })
    const fieldFilaments = field.filter(({ kind }) => kind === 'filament')
    for (const filament of fieldFilaments) {
      const radius = Math.hypot(filament.u, filament.v)
      expect(radius).toBeGreaterThanOrEqual(0.91)
      expect(radius).toBeLessThanOrEqual(1.04)
    }

    const lane = sampleHostileBoundaryParticles({
      ...activeInput,
      footprint: 'lane',
    })
    const laneFilaments = lane.filter(({ kind }) => kind === 'filament')
    expect(laneFilaments.some(({ v }) => v < 0)).toBe(true)
    expect(laneFilaments.some(({ v }) => v > 0)).toBe(true)
    for (const filament of laneFilaments) {
      expect(Math.abs(filament.v)).toBeGreaterThanOrEqual(0.44)
      expect(Math.abs(filament.v)).toBeLessThanOrEqual(0.52)
    }
  })

  it('includes both particle types whenever the cap permits two particles', () => {
    for (const maxParticles of [2, 3, 5, 12]) {
      const particles = sampleHostileBoundaryParticles({
        ...activeInput,
        maxParticles,
      })
      expect(particles).toHaveLength(maxParticles)
      expect(new Set(particles.map(({ kind }) => kind))).toEqual(
        new Set(['filament', 'mote']),
      )
    }
  })

  it('is deterministic while time and seed animate spatial positions', () => {
    const first = sampleHostileBoundaryParticles(activeInput)
    const repeated = sampleHostileBoundaryParticles(activeInput)
    const later = sampleHostileBoundaryParticles({
      ...activeInput,
      motionTime: activeInput.motionTime + 0.5,
    })
    const reseeded = sampleHostileBoundaryParticles({
      ...activeInput,
      seed: activeInput.seed + 1,
    })

    expect(repeated).toEqual(first)
    expect(later.map(({ u, v }) => [u, v])).not.toEqual(
      first.map(({ u, v }) => [u, v]),
    )
    expect(reseeded.map(({ baseU, baseV }) => [baseU, baseV])).not.toEqual(
      first.map(({ baseU, baseV }) => [baseU, baseV]),
    )
  })

  it('remains visible through the final dodge frame before release', () => {
    const late = sampleHostileBoundaryParticles({
      ...activeInput,
      progress: 0.98,
    })

    expect(late).not.toHaveLength(0)
    expect(Math.max(...late.map(({ alpha }) => alpha))).toBeGreaterThan(0.55)
  })

  it('establishes a readable perimeter early in the windup', () => {
    const early = sampleHostileBoundaryParticles({
      ...activeInput,
      progress: 0.12,
    })

    expect(early).not.toHaveLength(0)
    expect(Math.max(...early.map(({ alpha }) => alpha))).toBeGreaterThan(0.5)
  })

  it('reduces flash energy and motion without moving authored anchors', () => {
    const normal = sampleHostileBoundaryParticles(activeInput)
    const reduced = sampleHostileBoundaryParticles({
      ...activeInput,
      reducedFlash: true,
    })

    expect(reduced).toHaveLength(normal.length)
    for (let index = 0; index < normal.length; index += 1) {
      expect(reduced[index].kind).toBe(normal[index].kind)
      expect(reduced[index].baseU).toBe(normal[index].baseU)
      expect(reduced[index].baseV).toBe(normal[index].baseV)
      expect(reduced[index].size).toBe(normal[index].size)
      expect(reduced[index].stretch).toBe(normal[index].stretch)
      expect(reduced[index].alpha).toBeLessThan(normal[index].alpha)
      expect(reduced[index].glowAlpha).toBeLessThan(
        normal[index].glowAlpha,
      )

      const normalMotion = Math.hypot(
        normal[index].u - normal[index].baseU,
        normal[index].v - normal[index].baseV,
      )
      const reducedMotion = Math.hypot(
        reduced[index].u - reduced[index].baseU,
        reduced[index].v - reduced[index].baseV,
      )
      expect(reducedMotion).toBeLessThanOrEqual(normalMotion + 1e-12)
    }
  })

  it('returns an immutable empty set outside the active warning window', () => {
    for (const progress of [-0.1, 0, 1, 1.1]) {
      const particles = sampleHostileBoundaryParticles({
        ...activeInput,
        progress,
      })
      expect(particles).toEqual([])
      expect(Object.isFrozen(particles)).toBe(true)
    }
  })
})

describe('hostile boundary quota reservation', () => {
  const collectQuotas = (remainingBudget: number, remainingFootprints: number) => {
    const quotas: number[] = []
    let state = { remainingBudget, remainingFootprints }
    while (state.remainingFootprints > 0) {
      const reservation = reserveHostileBoundaryParticleQuota(state)
      quotas.push(reservation.quota)
      state = {
        remainingBudget: reservation.remainingBudget,
        remainingFootprints: reservation.remainingFootprints,
      }
    }
    return { quotas, state }
  }

  it.each([
    [64, 3],
    [96, 5],
    [144, 8],
  ])(
    'fairly divides a %i-particle cap over %i remaining footprints',
    (cap, footprintCount) => {
      const { quotas, state } = collectQuotas(cap, footprintCount)

      expect(quotas).toHaveLength(footprintCount)
      expect(quotas.reduce((sum, quota) => sum + quota, 0)).toBe(cap)
      expect(Math.min(...quotas)).toBeGreaterThanOrEqual(2)
      expect(Math.max(...quotas) - Math.min(...quotas)).toBeLessThanOrEqual(1)
      expect(state).toEqual({
        remainingBudget: 0,
        remainingFootprints: 0,
      })
    },
  )

  it.each([
    [HOSTILE_BOUNDARY_FRAME_BUDGET.mobile, 80],
    [HOSTILE_BOUNDARY_FRAME_BUDGET.desktop, 120],
  ])(
    'reserves both particle classes across the %i-particle runtime cap and %i maximum visible footprints',
    (cap, footprintCount) => {
      const { quotas, state } = collectQuotas(cap, footprintCount)

      expect(Math.min(...quotas)).toBeGreaterThanOrEqual(2)
      expect(quotas.reduce((sum, quota) => sum + quota, 0)).toBe(cap)
      expect(state).toEqual({
        remainingBudget: 0,
        remainingFootprints: 0,
      })
    },
  )

  it('safely handles exhausted and invalid budgets', () => {
    expect(
      reserveHostileBoundaryParticleQuota({
        remainingBudget: Number.NaN,
        remainingFootprints: 3,
      }),
    ).toEqual({
      quota: 0,
      remainingBudget: 0,
      remainingFootprints: 2,
    })
    expect(
      reserveHostileBoundaryParticleQuota({
        remainingBudget: 12,
        remainingFootprints: 0,
      }),
    ).toEqual({
      quota: 0,
      remainingBudget: 12,
      remainingFootprints: 0,
    })
  })

  it.each([
    ['mobile', HOSTILE_BOUNDARY_FRAME_BUDGET.mobile, 3, 80, 40],
    ['desktop', HOSTILE_BOUNDARY_FRAME_BUDGET.desktop, 3, 120, 72],
  ] as const)(
    'prioritizes boss and projectile footprints under crowded %s load',
    (lod, frameBudget, priorityFootprints, hordeFootprints, expectedPriorityQuota) => {
      const pools = allocateHostileBoundaryPriorityPools({
        frameBudget,
        priorityFootprints,
        hordeFootprints,
        lod,
      })
      const priorityQuota = Math.floor(
        pools.priorityBudget / priorityFootprints,
      )
      const hordeQuota = Math.ceil(pools.hordeBudget / hordeFootprints)

      expect(priorityQuota).toBe(expectedPriorityQuota)
      expect(priorityQuota).toBeGreaterThan(hordeQuota)
      expect(hordeQuota).toBeGreaterThanOrEqual(
        HOSTILE_BOUNDARY_HORDE_MINIMUM,
      )
      expect(
        pools.priorityBudget + pools.hordeBudget + pools.unusedBudget,
      ).toBe(frameBudget)
    },
  )

  it('protects priority warnings first when the minimum floors exceed the frame cap', () => {
    const priorityFootprints = 30
    const pools = allocateHostileBoundaryPriorityPools({
      frameBudget: HOSTILE_BOUNDARY_FRAME_BUDGET.mobile,
      priorityFootprints,
      hordeFootprints: 100,
      lod: 'mobile',
    })

    expect(pools.priorityBudget).toBe(
      priorityFootprints * HOSTILE_BOUNDARY_PRIORITY_MINIMUM.mobile,
    )
    expect(pools.priorityBudget / priorityFootprints).toBeGreaterThan(
      pools.hordeBudget / 100,
    )
    expect(
      pools.priorityBudget + pools.hordeBudget + pools.unusedBudget,
    ).toBe(HOSTILE_BOUNDARY_FRAME_BUDGET.mobile)
  })

  it('does not spend unused warning budget when all footprints reach authored density', () => {
    expect(
      allocateHostileBoundaryPriorityPools({
        frameBudget: HOSTILE_BOUNDARY_FRAME_BUDGET.mobile,
        priorityFootprints: 1,
        hordeFootprints: 1,
        lod: 'mobile',
      }),
    ).toEqual({
      priorityBudget: 40,
      hordeBudget: 24,
      unusedBudget: HOSTILE_BOUNDARY_FRAME_BUDGET.mobile - 64,
    })
  })
})
