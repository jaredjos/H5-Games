import { describe, expect, it } from 'vitest'
import runtimeSourceRaw from './GameCanvas.tsx?raw'

const runtimeSource = runtimeSourceRaw.replace(/\r\n/g, '\n')
import {
  HERO_POWER_FORBIDDEN_HELPERS,
  inspectHeroPowerVisualScope,
} from './heroPowerVisualPolicy'
import {
  pointInCapsule,
  pointInCircle,
  resolvePatternHits,
  type PatternStrike,
} from './weaponPatterns'

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

const expectPolicyClean = (label: string, source: string) => {
  expect(inspectHeroPowerVisualScope(source), label).toEqual([])
}

describe('hero-power visual-language policy', () => {
  it('rejects every prohibited diagram choreography family', () => {
    const fixture = `
      this.drawSegmentedRing(graphics)
      this.drawJaggedRing(graphics)
      this.drawRadialTicks(graphics)
      this.drawStarburst(graphics)
      this.drawDiamondGlyph(graphics)
      this.drawBellGlyph(graphics)
      this.drawPressureWedge(graphics)
      graphics.circle(x, y, 12).stroke({ width: 2 })
      graphics.circle(x, y, 18).fill({ alpha: 0.2 })
      const starPoints = []
      for (const side of [-1, 1]) {
        graphics.moveTo(x, y).lineTo(x + side, y).stroke({ width: 1 })
      }
    `
    const codes = new Set(
      inspectHeroPowerVisualScope(fixture).map((violation) => violation.code),
    )

    expect(codes).toEqual(
      new Set([
        'segmented-ring',
        'jagged-ring',
        'radial-ticks',
        'burst-lines',
        'generic-diamond',
        'outlined-gate',
        'polygon-fan',
        'outlined-zone',
        'concentric-circles',
        'decorative-rails',
      ]),
    )
  })

  it('allows grounded materials, particles, one physical orb, and a true lightning core', () => {
    const fixture = `
      this.drawGroundedFieldMaterial('graveglass-field')
      this.drawGroundedLaneMaterial('eclipse-lane')
      graphics.circle(x, y, coreRadius).fill({ color, alpha })
      this.drawPolyline(graphics, lightning, coreColor, width, alpha)
      this.spawnBurst(x, y, ashColor, debrisCount, speed)
    `
    expect(inspectHeroPowerVisualScope(fixture)).toEqual([])
  })

  it('returns deterministic, immutable violations with compact evidence', () => {
    const source = 'this.drawStarburst(graphics)'
    const first = inspectHeroPowerVisualScope(source)
    const second = inspectHeroPowerVisualScope(source)

    expect(second).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first[0])).toBe(true)
    expect(first[0].evidence).toContain('drawStarburst')
    expect(Object.isFrozen(HERO_POWER_FORBIDDEN_HELPERS)).toBe(true)
  })
})

describe('all eight hero-power renderers', () => {
  const weaponEffectScopes = [
    ['Helio gate', "        case 'helio-gate':", "        case 'helio-impact':"],
    ['Helio impact', "        case 'helio-impact':", "        case 'crescent-orbit':"],
    ['Crescent orbit', "        case 'crescent-orbit':", "        case 'crescent-impact':"],
    ['Crescent impact', "        case 'crescent-impact':", "        case 'arc-chain':"],
    ['Arc Choir', "        case 'arc-chain':", "        case 'astral-verdict':"],
    ['Astral Verdict', "        case 'astral-verdict':", "        case 'comet-launch':"],
    ['Comet launch', "        case 'comet-launch':", "        case 'comet-impact':"],
    ['Comet impact', "        case 'comet-impact':", "        case 'graveglass-eruption':"],
    ['Graveglass', "        case 'graveglass-eruption':", "        case 'mirror-gate':"],
    ['Mirror gate', "        case 'mirror-gate':", "        case 'mirror-impact':"],
    ['Mirror impact', "        case 'mirror-impact':", "        case 'eclipse-harrow':"],
    [
      'Eclipse Harrow',
      "        case 'eclipse-harrow':",
      '    this.finishAuthoredSpellMaterialFrame()',
    ],
  ] as const

  it.each(weaponEffectScopes)(
    'keeps the %s effect recipe material-led',
    (label, startMarker, endMarker) => {
      expectPolicyClean(label, section(startMarker, endMarker))
    },
  )

  const projectileScopes = [
    [
      'Astral Verdict legacy projectile fallback',
      "    if (projectile.weaponId === 'rift-seeds')",
      "    if (projectile.weaponId === 'mirror-bow')",
    ],
    [
      'Mirror projectile',
      "    if (projectile.weaponId === 'mirror-bow')",
      '    const trailPoints: Vec2[] = []',
    ],
    [
      'Helio projectile',
      "    if (projectile.weaponId === 'helio-lance')",
      "    if (projectile.weaponId === 'crescent-array')",
    ],
    [
      'Crescent projectile',
      "    if (projectile.weaponId === 'crescent-array')",
      "    if (projectile.weaponId === 'arc-choir')",
    ],
    [
      'Arc Choir projectile',
      "    if (projectile.weaponId === 'arc-choir')",
      "    if (projectile.weaponId === 'comet-swarm')",
    ],
    [
      'Comet projectile',
      "    if (projectile.weaponId === 'comet-swarm')",
      "    if (projectile.weaponId === 'ash-halo')",
    ],
    [
      'Graveglass projectile fallback',
      "    if (projectile.weaponId === 'ash-halo')",
      "    if (projectile.weaponId === 'null-bell')",
    ],
    [
      'Eclipse projectile fallback',
      "    if (projectile.weaponId === 'null-bell')",
      '  }\n\n  private createVfxTextures()',
    ],
  ] as const

  it.each(projectileScopes)(
    'keeps the %s free of diagram overlays',
    (label, startMarker, endMarker) => {
      expectPolicyClean(label, section(startMarker, endMarker))
    },
  )

  it('keeps generic projectile trails linear and free of diagram helpers', () => {
    const genericTrail = section(
      '    const trailPoints: Vec2[] = []',
      "    if (projectile.weaponId === 'helio-lance')",
    )
    expectPolicyClean('generic projectile trail', genericTrail)
  })

  const textureScopes = [
    ['Helio texture', "    create('helio-lance'", "    create('crescent-array'"],
    ['Crescent texture', "    create('crescent-array'", "    create('arc-choir'"],
    ['Arc Choir texture', "    create('arc-choir'", "    create('rift-seeds'"],
    ['Astral Verdict legacy texture', "    create('rift-seeds'", "    create('comet-swarm'"],
    ['Comet texture', "    create('comet-swarm'", "    create('ash-halo'"],
    ['Graveglass texture', "    create('ash-halo'", "    create('mirror-bow'"],
    ['Mirror texture', "    create('mirror-bow'", "    create('null-bell'"],
    ['Eclipse texture', "    create('null-bell'", '    const spark = new Graphics()'],
  ] as const

  it.each(textureScopes)(
    'keeps the %s silhouette free of outlined diagram motifs',
    (label, startMarker, endMarker) => {
      expectPolicyClean(label, section(startMarker, endMarker))
    },
  )

  it('does not use the generic effects layer to restore outlined hero zones', () => {
    const effects = section('  private drawEffects()', '  private drawJoystick()')
    expect(effects).not.toContain('this.ringGraphics')
    expect(effects).not.toContain('this.loopGraphics.stroke')
    expectPolicyClean('generic effects layer', effects)
  })
})

describe('visual policy collision isolation', () => {
  it('retains inclusive circle and capsule boundaries and earliest-hit resolution', () => {
    expect(pointInCircle({ x: 42, y: 0 }, { x: 0, y: 0 }, 42)).toBe(true)
    expect(pointInCircle({ x: 42.01, y: 0 }, { x: 0, y: 0 }, 42)).toBe(false)
    expect(
      pointInCapsule(
        { x: 50, y: 12 },
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        12,
      ),
    ).toBe(true)
    expect(
      pointInCapsule(
        { x: 50, y: 12.01 },
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        12,
      ),
    ).toBe(false)

    const strikes: PatternStrike[] = [
      {
        kind: 'circle',
        index: 4,
        center: { x: 24, y: 0 },
        radius: 42,
        delay: 0.2,
        parentIndex: null,
      },
      {
        kind: 'circle',
        index: 2,
        center: { x: 0, y: 0 },
        radius: 42,
        delay: 0.05,
        parentIndex: null,
      },
      {
        kind: 'capsule',
        index: 7,
        start: { x: 30, y: 0 },
        end: { x: 110, y: 0 },
        radius: 12,
        delay: 0.3,
        role: 'primary',
      },
    ]
    const hits = resolvePatternHits(
      [
        { id: 2, x: 90, y: 0 },
        { id: 1, x: 18, y: 0 },
        { id: 3, x: 160, y: 0 },
      ],
      strikes,
    )

    expect(hits.map((hit) => hit.targetId)).toEqual([1, 2])
    expect(hits.find((hit) => hit.targetId === 1)?.strike.index).toBe(2)
    expect(hits.find((hit) => hit.targetId === 1)?.delay).toBe(0.05)
  })
})
