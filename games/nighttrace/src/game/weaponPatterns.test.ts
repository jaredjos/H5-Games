import { describe, expect, it } from 'vitest'
import {
  WEAPON_PATTERN_STAGES,
  buildEclipseHarrow,
  buildGraveglassSpires,
  buildReplacementWeaponPattern,
  findDensestRemoteCluster,
  pointInCapsule,
  pointInCircle,
  pointInPatternStrike,
  resolvePatternHits,
  type CirclePatternStrike,
  type PatternTarget,
} from './weaponPatterns'

const origin = Object.freeze({ x: 0, y: 0 })

const clusteredTargets: readonly PatternTarget<number>[] = Object.freeze([
  { id: 1, x: 18, y: 12 },
  { id: 2, x: 32, y: 18 },
  { id: 3, x: 46, y: 4 },
  { id: 10, x: 332, y: 92 },
  { id: 11, x: 356, y: 108 },
  { id: 12, x: 344, y: 128 },
  { id: 20, x: -460, y: -60 },
  { id: 21, x: -438, y: -42 },
])

describe('remote cluster selection', () => {
  it('ignores a denser near-player knot and selects the densest remote cluster', () => {
    const cluster = findDensestRemoteCluster(origin, clusteredTargets, {
      minimumRange: 120,
      clusterRadius: 90,
    })

    expect(cluster).toBeDefined()
    expect(cluster?.targetIds).toEqual([10, 11, 12])
    expect(cluster?.density).toBe(3)
    expect(Math.hypot(cluster?.center.x ?? 0, cluster?.center.y ?? 0)).toBeGreaterThan(120)
  })

  it('uses stable target IDs to break otherwise identical cluster ties', () => {
    const targets = [
      { id: 'right-b', x: 320, y: 20 },
      { id: 'left-b', x: -320, y: 20 },
      { id: 'right-a', x: 300, y: 20 },
      { id: 'left-a', x: -300, y: 20 },
    ] as const
    const cluster = findDensestRemoteCluster(origin, targets, {
      minimumRange: 100,
      clusterRadius: 50,
    })

    expect(cluster?.anchorId).toBe('left-a')
    expect(cluster?.targetIds).toEqual(['left-a', 'left-b'])
  })

  it('returns no cast when there is no valid remote target', () => {
    expect(
      findDensestRemoteCluster(
        origin,
        [
          { id: 1, x: 20, y: 20 },
          { id: 2, x: 40, y: 30, active: false },
        ],
        { minimumRange: 100 },
      ),
    ).toBeUndefined()
  })
})

describe('Graveglass Spires', () => {
  it('builds deterministic remote jagged branches independent of input order', () => {
    const input = {
      origin,
      targets: clusteredTargets,
      stage: 'final' as const,
      seed: 741,
      minimumRange: 120,
      clusterRadius: 90,
    }
    const first = buildGraveglassSpires(input)
    const second = buildGraveglassSpires({
      ...input,
      targets: [...clusteredTargets].reverse(),
    })

    expect(first).toEqual(second)
    expect(first?.kind).toBe('graveglass-spires')
    expect(first?.formation).toBe('jagged-branch')
    expect(first?.cluster.targetIds).toEqual([10, 11, 12])
    expect(first?.aimPoint).not.toEqual(origin)
    expect(first?.strikes).toHaveLength(6)
    expect(first?.strikes.map((strike) => strike.parentIndex)).toEqual([
      null,
      0,
      0,
      1,
      2,
      3,
    ])
    expect(first?.strikes.map((strike) => strike.delay)).toEqual(
      [...(first?.strikes ?? [])]
        .map((strike) => strike.delay)
        .sort((left, right) => left - right),
    )
  })

  it('progresses through two, three, four, and six staggered circles', () => {
    const counts = WEAPON_PATTERN_STAGES.map(
      (stage) =>
        buildGraveglassSpires({
          origin,
          targets: clusteredTargets,
          stage,
          seed: 19,
          minimumRange: 120,
          clusterRadius: 90,
        })?.strikes.length,
    )

    expect(counts).toEqual([2, 3, 4, 6])
  })

  it('uses the seed only as a deterministic geometry variation', () => {
    const baseInput = {
      origin,
      targets: clusteredTargets,
      stage: 'mastered' as const,
      minimumRange: 120,
      clusterRadius: 90,
    }
    const first = buildGraveglassSpires({ ...baseInput, seed: 7 })
    const replay = buildGraveglassSpires({ ...baseInput, seed: 7 })
    const alternate = buildGraveglassSpires({ ...baseInput, seed: 8 })

    expect(first).toEqual(replay)
    expect(first?.cluster).toEqual(alternate?.cluster)
    expect(first?.strikes).not.toEqual(alternate?.strikes)
  })
})

describe('Eclipse Harrow', () => {
  const movingTargets = Object.freeze([
    { id: 30, x: 300, y: 30, vx: 80, vy: 20 },
    { id: 31, x: 340, y: 50, vx: 80, vy: 20 },
    { id: 32, x: 330, y: 80, vx: 80, vy: 20 },
  ] satisfies readonly PatternTarget<number>[])

  it('aims at the predicted remote cluster rather than the hero or current centroid', () => {
    const pattern = buildEclipseHarrow({
      origin,
      targets: movingTargets,
      stage: 'solo',
      seed: 91,
      minimumRange: 120,
      clusterRadius: 100,
      predictionSeconds: 0.5,
    })

    expect(pattern).toBeDefined()
    expect(pattern?.cluster.targetIds).toEqual([30, 31, 32])
    expect(pattern?.aimPoint.x).toBeCloseTo((340 + 380 + 370) / 3, 10)
    expect(pattern?.aimPoint.y).toBeCloseTo((40 + 60 + 90) / 3, 10)
    expect(pattern?.aimPoint.x).toBeGreaterThan(
      movingTargets.reduce((sum, target) => sum + target.x, 0) /
        movingTargets.length,
    )
    expect(pattern?.aimPoint).not.toEqual(origin)
  })

  it('progresses from a single lane to crossed, staggered, and cathedral formations', () => {
    const patterns = WEAPON_PATTERN_STAGES.map((stage) =>
      buildEclipseHarrow({
        origin,
        targets: movingTargets,
        stage,
        seed: 91,
        minimumRange: 120,
        clusterRadius: 100,
      }),
    )

    expect(patterns.map((pattern) => pattern?.strikes.length)).toEqual([
      1,
      2,
      3,
      4,
    ])
    expect(patterns.map((pattern) => pattern?.formation)).toEqual([
      'single-lane',
      'crossed-lanes',
      'staggered-lanes',
      'cathedral',
    ])
    expect(patterns[3]?.strikes.map((strike) => strike.role)).toEqual([
      'left-nave',
      'right-nave',
      'left-vault',
      'right-vault',
    ])
  })

  it('keeps the solo strike directional with clear inclusion and exclusion', () => {
    const pattern = buildEclipseHarrow({
      origin,
      targets: [{ id: 90, x: 360, y: 0 }],
      stage: 'solo',
      minimumRange: 120,
      clusterRadius: 80,
    })
    const strike = pattern?.strikes[0]

    expect(strike?.kind).toBe('capsule')
    if (!strike) throw new Error('Expected a solo Harrow strike.')
    expect(pointInCapsule({ x: 360, y: 20 }, strike.start, strike.end, strike.radius)).toBe(true)
    expect(pointInPatternStrike({ x: 360, y: 20 }, strike)).toBe(true)
    expect(pointInPatternStrike({ x: 360, y: 80 }, strike)).toBe(false)
    expect(pointInPatternStrike(origin, strike)).toBe(false)
  })

  it('dispatches stable legacy IDs to the replacement patterns', () => {
    const input = {
      origin,
      targets: movingTargets,
      stage: 'combined' as const,
      seed: 14,
      minimumRange: 120,
      clusterRadius: 100,
    }

    expect(buildReplacementWeaponPattern('ash-halo', input)?.kind).toBe(
      'graveglass-spires',
    )
    expect(buildReplacementWeaponPattern('null-bell', input)?.kind).toBe(
      'eclipse-harrow',
    )
  })
})

describe('pattern collision and hit resolution', () => {
  const circle = (
    index: number,
    x: number,
    delay: number,
  ): CirclePatternStrike => ({
    kind: 'circle',
    index,
    center: { x, y: 0 },
    radius: 42,
    delay,
    parentIndex: index === 0 ? null : 0,
  })

  it('treats circle and capsule boundaries as inclusive', () => {
    expect(pointInCircle({ x: 42, y: 0 }, origin, 42)).toBe(true)
    expect(pointInCircle({ x: 42.01, y: 0 }, origin, 42)).toBe(false)
    expect(
      pointInCapsule(
        { x: 50, y: 12 },
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        12,
      ),
    ).toBe(true)
  })

  it('hits overlapping targets only once and assigns the earliest strike', () => {
    const strikes = [
      circle(4, 24, 0.2),
      circle(2, 0, 0.05),
      circle(7, 72, 0.3),
    ]
    const targets = [
      { id: 2, x: 72, y: 0 },
      { id: 1, x: 18, y: 0 },
      { id: 3, x: 160, y: 0 },
      { id: 1, x: 22, y: 0 },
    ]
    const hits = resolvePatternHits(targets, strikes)

    expect(hits.map((hit) => hit.targetId)).toEqual([1, 2])
    expect(hits.filter((hit) => hit.targetId === 1)).toHaveLength(1)
    expect(hits.find((hit) => hit.targetId === 1)?.strike.index).toBe(2)
    expect(hits.find((hit) => hit.targetId === 1)?.delay).toBe(0.05)
  })
})
