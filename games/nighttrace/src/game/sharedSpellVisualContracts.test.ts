import { describe, expect, it } from 'vitest'
import runtimeSourceRaw from './GameCanvas.tsx?raw'
import {
  TRACE_POINT_LIFETIME_SECONDS,
  pruneExpiredTracePoints,
  traceSegmentAlpha,
  type TimestampedTracePoint,
} from './traceLifetime'

const runtimeSource = runtimeSourceRaw.replace(/\r\n/g, '\n')

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

const nestedSection = (
  source: string,
  startMarker: string,
  endMarker: string,
) => {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return source.slice(start, end)
}

const captureLoopLimit = (source: string, counter: string) => {
  const match = source.match(
    new RegExp(`for \\(let ${counter} = \\d+; ${counter} (?:<|<=) (\\d+)`),
  )
  expect(match, `${counter} loop`).not.toBeNull()
  return Number(match?.[1])
}

const colorChannels = (hex: string) => {
  const value = Number.parseInt(hex, 16)
  return {
    red: (value >> 16) & 0xff,
    green: (value >> 8) & 0xff,
    blue: value & 0xff,
  }
}

describe('shared persistent-spell visual contracts', () => {
  const render = section('  private render() {', '  private layout() {')
  const actorRenderer = section(
    '  private drawPersistentSpellActors(sceneVfxScale: number)',
    '  private updateSupportPickups()',
  )
  const comets = nestedSection(
    actorRenderer,
    '    for (const comet of this.orbitingComets)',
    '    this.cinderwakeFleetGlow.clear()',
  )
  const reavers = actorRenderer.slice(
    actorRenderer.indexOf('    this.cinderwakeFleetGlow.clear()'),
  )

  it('renders persistent spells through the shared Campaign renderer, not a Lab-only branch', () => {
    expect(render).toContain('this.drawPersistentSpellActors(sceneVfxScale)')
    expect(render).toContain('this.drawTrace()')
    expect(render.indexOf('this.drawPersistentSpellActors(sceneVfxScale)')).toBeLessThan(
      render.indexOf('this.drawTrace()'),
    )
    expect(actorRenderer).not.toContain('combat-lab')
    expect(actorRenderer).not.toContain("this.runConfig.mode === 'combat-lab'")
  })

  it('gives every orbiting Comet a short velocity/tangent-aligned trailing wake', () => {
    expect(comets).toContain('const motionX = comet.x - comet.previousX')
    expect(comets).toContain('const motionY = comet.y - comet.previousY')
    expect(comets).toMatch(
      /Math\.hypot\(motionX, motionY\)/,
    )
    expect(comets).toContain('const trailX = -motionX / motionLength')
    expect(comets).toContain('const trailY = -motionY / motionLength')
    expect(captureLoopLimit(comets, 'wake')).toBeLessThanOrEqual(3)
    expect(comets).toMatch(/renderX \+ trailX \* distance/)
    expect(comets).toMatch(/renderY \+ trailY \* distance/)
    expect(comets).toContain('const distance = 3 + wake *')
  })

  it('gives Cinderwake Reavers an additive edge silhouette and sparse material wake', () => {
    const entityShape = section(
      'interface CinderwakeReaverEntity {',
      'interface PersistentSpellDamageWindow {',
    )
    const reaverSync = section(
      '  private syncCinderwakeReavers(',
      '  private updatePersistentSpells(',
    )

    expect(entityShape).toContain('wakeGlow: Graphics')
    expect(entityShape).toContain('impactGlow: Graphics')
    expect(entityShape).toContain('auraSprite: Sprite')
    expect(entityShape).toContain('edgeSprite: Sprite')
    expect(entityShape).toContain('materialFilter: ColorMatrixFilter')
    expect(reaverSync).toContain('const wakeGlow = new Graphics()')
    expect(reaverSync).toContain('const impactGlow = new Graphics()')
    expect(reaverSync).toContain('const materialFilter = new ColorMatrixFilter()')
    expect(reaverSync).toContain('materialFilter.saturate(0.08, false)')
    expect(reaverSync).toContain('materialFilter.contrast(0.13, true)')
    expect(reaverSync).toContain('const auraSprite = new Sprite(')
    expect(reaverSync).toContain("auraSprite.blendMode = 'add'")
    expect(reaverSync).toContain('auraSprite.filters = [')
    expect(reaverSync).toContain('const edgeSprite = new Sprite(')
    expect(reaverSync).toContain("edgeSprite.blendMode = 'add'")
    expect(reavers).toContain('reaver.wakeGlow.position.set(renderX, renderY)')
    expect(reavers).toContain('reaver.impactGlow.position.set(renderX, renderY)')
    expect(reavers).toContain('reaver.auraSprite.position.set(renderX, renderY)')
    expect(reavers).toContain('reaver.edgeSprite.position.set(renderX, renderY)')
    expect(reavers).toContain('reaver.edgeSprite.rotation = reaver.spin')
    expect(reavers).toContain('reaver.edgeSprite.tint =')
    expect(reavers).toContain('0xf07178')
    expect(reavers).toContain('0xe95a68')
    expect(reavers).toContain("reaver.auraSprite.blendMode = 'add'")
    expect(reavers).toContain("reaver.edgeSprite.blendMode = 'add'")
    expect(reavers).toContain('reaver.auraSprite.visible = true')
    expect(reavers).toContain('reaver.edgeSprite.visible = true')

    expect(reavers).toContain('this.cinderwakeFleetGlow.clear()')
    expect(reavers).toContain('cinderwakeReaverPresentationProfile(')
    expect(reavers).toContain('fleetProfile.cinders')
    expect(reavers).toContain('fleetProfile.ambientParticleBudget')
    expect(reavers).toContain('const pressurePhase =')
    expect(reavers).toContain('const wakeCycle =')
    expect(reavers).toContain('const impactCycle =')
    expect(reavers).toContain('reaver.materialFilter.reset()')
    expect(reavers).toContain('reaver.materialFilter.brightness(1.08, true)')
    expect(reavers).not.toContain('rimMoteCount')
    expect(reavers).not.toContain('motePhase')
    const wakeColors = Array.from(
      reavers.matchAll(/0x([0-9a-f]{6})/gi),
      (match) => colorChannels(match[1]),
    )
    expect(
      wakeColors.some(
        ({ red, green, blue }) =>
          red >= 225 && green >= 80 && blue >= 80 && red > green * 1.5,
      ),
      'a bright bloodglass edge/spark color',
    ).toBe(true)
    expect(
      wakeColors.some(
        ({ red, green, blue }) => red >= 145 && red > green * 1.5 && red > blue,
      ),
      'a crimson wake color',
    ).toBe(true)
  })
})

describe('shared Trace presentation and lifetime contracts', () => {
  const render = section('  private render() {', '  private layout() {')
  const updateTrace = section('  private updateTrace() {', '  private closeLoop(')
  const drawTrace = section('  private drawTrace() {', '  private vfxStageIndex(')

  it('retains independent twelve-second point expiry before movement early-outs', () => {
    const points: TimestampedTracePoint[] = [
      { x: 0, y: 0, bornAt: 0 },
      { x: 10, y: 0, bornAt: 4 },
      { x: 20, y: 0, bornAt: 8 },
    ]

    expect(TRACE_POINT_LIFETIME_SECONDS).toBe(12)
    expect(pruneExpiredTracePoints(points, 12)).toEqual(points.slice(1))
    expect(traceSegmentAlpha(points[1], points[2], 14)).toBeGreaterThan(0)
    expect(traceSegmentAlpha(points[0], points[1], 16)).toBe(0)
    expect(updateTrace.indexOf('pruneExpiredTracePoints(this.trace, this.elapsed)'))
      .toBeLessThan(updateTrace.indexOf('TRACE_SAMPLE_DISTANCE'))
  })

  it('uses connected layered blue, turquoise and blue-white strokes without broken gaps', () => {
    expect(render).toContain('this.drawTrace()')
    expect(drawTrace).not.toContain('combat-lab')
    expect(drawTrace).not.toContain('brokenStart')
    expect(drawTrace).not.toContain('brokenEnd')
    expect(drawTrace).toContain('traceSegmentAlpha(start, end, this.elapsed)')
    expect(drawTrace).toContain('.moveTo(start.x, start.y)')
    expect(drawTrace).toContain(
      '.quadraticCurveTo(controlX, controlY, end.x, end.y)',
    )

    const strokeCount = drawTrace.match(/\.stroke\(\{/g)?.length ?? 0
    expect(strokeCount).toBeGreaterThanOrEqual(3)

    const colors = Array.from(
      drawTrace.matchAll(/color: 0x([0-9a-f]{6})/gi),
      (match) => colorChannels(match[1]),
    )
    expect(
      colors.some(
        ({ red, blue }) => blue >= 110 && blue > red * 1.5,
      ),
      'a blue foundation layer',
    ).toBe(true)
    expect(
      colors.some(
        ({ red, green, blue }) => green >= 145 && blue >= 145 && red < green,
      ),
      'a turquoise/cyan energy layer',
    ).toBe(true)
    expect(
      colors.some(({ red, green, blue }) => red >= 200 && green >= 220 && blue >= 225),
      'a blue-white core layer',
    ).toBe(true)
  })
})
