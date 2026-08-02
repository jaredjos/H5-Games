import { describe, expect, it } from 'vitest'
import { COMBAT_SFX_PROFILES } from './combatSfx'
import { MODULES, WEAPONS } from './content'
import {
  cinderwakeReaverProfile,
  persistentWindowDamage,
} from './persistentSpellChoreography'
import runtimeSourceRaw from './GameCanvas.tsx?raw'

const runtimeSource = runtimeSourceRaw.replace(/\r\n/g, '\n')

describe('Cinderwake Reavers replacement spell', () => {
  it('keeps the stable save id while exposing the new public identity', () => {
    expect(WEAPONS['mirror-bow']).toMatchObject({
      id: 'mirror-bow',
      name: 'Cinderwake Reavers',
      shortName: 'Reavers',
      awakening: 'Ravenous Eventide',
      moduleId: 'flux-mirror',
    })
    expect(WEAPONS['mirror-bow'].description).toContain('ricochet')
    expect(MODULES['flux-mirror']).toMatchObject({ name: 'Ricochet Seal' })
  })

  it('arms persistent hunting projectiles instead of a remote prison event', () => {
    const fireStart = runtimeSource.indexOf("      case 'mirror-bow': {")
    const fireEnd = runtimeSource.indexOf("      case 'null-bell':", fireStart)
    const fireRecipe = runtimeSource.slice(fireStart, fireEnd)

    expect(fireStart).toBeGreaterThanOrEqual(0)
    expect(fireEnd).toBeGreaterThan(fireStart)
    expect(fireRecipe).toContain('this.armCinderwakeReavers(')
    expect(fireRecipe).not.toContain('this.castVeilglassReliquary(')
    expect(runtimeSource).toContain('private updatePersistentSpells(')
    expect(runtimeSource).toContain('private drawPersistentSpellActors(')
    expect(runtimeSource).not.toContain('private castVeilglassReliquary(')
  })

  it('adds speed, coverage and blades across ranks without multiplying damage', () => {
    const ranks = [1, 2, 3, 4, 5].map((rank) =>
      cinderwakeReaverProfile(rank, false),
    )
    expect(ranks.map(({ count }) => count)).toEqual([1, 1, 2, 2, 3])
    expect(ranks.map(({ speed }) => speed)).toEqual([270, 300, 320, 350, 378])
    expect(cinderwakeReaverProfile(5, true).count).toBe(4)
    expect(persistentWindowDamage(96, 4)).toEqual([24, 24, 24, 24])
  })

  it('keeps a distinct authored ricochet cue', () => {
    const cue = COMBAT_SFX_PROFILES['mirror-bow']
    expect(cue.priority).toBe(2)
    expect(cue.tones.length).toBeGreaterThanOrEqual(2)
  })

  it('commits outbound blades to arena ricochets and preserves independent lanes', () => {
    const updateStart = runtimeSource.indexOf(
      '  private updatePersistentSpells(delta: number)',
    )
    const updateEnd = runtimeSource.indexOf(
      '  private drawPersistentSpellActors(sceneVfxScale: number)',
      updateStart,
    )
    const update = runtimeSource.slice(updateStart, updateEnd)

    expect(update).toContain(
      'const outboundReach = Math.hypot(WORLD_WIDTH, WORLD_HEIGHT) * 1.2',
    )
    expect(update).toContain('reaver.outboundX = reaver.x +')
    expect(update).toContain('aimX = reaver.outboundX')
    expect(update).not.toContain('targetDistance >= 176 + reaver.slot * 18')
    expect(update).toContain('const separationRadius = Math.max(')
    expect(update).toContain('108,')
    expect(update).toContain("reaver.flightMode = 'seeking'")
    expect(update).toContain('reaver.bounceLock = 0.34')
  })
})
