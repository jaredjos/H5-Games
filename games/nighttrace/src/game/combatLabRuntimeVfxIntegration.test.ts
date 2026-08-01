import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'

describe('Combat Lab Pixi runtime VFX integration', () => {
  it('routes casts, projectiles, trails and impacts through the lab-only profile', () => {
    expect(runtimeSource).toContain('private combatLabRuntimeVfx(')
    expect(runtimeSource).toContain('this.runConfig.mode,')
    expect(runtimeSource.match(/this\.weaponPresentationProfile\(/g)?.length)
      .toBeGreaterThanOrEqual(5)
    expect(runtimeSource).toContain('this.drawCombatLabProjectileSignature(')
    expect(runtimeSource).toContain('this.drawCombatLabWeaponEffectAccent(')
  })

  it('ships materially separate live Verdict and Mirror signatures', () => {
    const projectileStart = runtimeSource.indexOf(
      '  private drawCombatLabProjectileSignature(',
    )
    const projectileEnd = runtimeSource.indexOf(
      '  private drawProjectileTrail(',
      projectileStart,
    )
    const projectilePresentation = runtimeSource.slice(
      projectileStart,
      projectileEnd,
    )
    const effectStart = runtimeSource.indexOf(
      '  private drawCombatLabWeaponEffectAccent(',
    )
    const effectEnd = runtimeSource.indexOf(
      '  private drawWeaponEffects()',
      effectStart,
    )
    const effectPresentation = runtimeSource.slice(effectStart, effectEnd)

    for (const section of [projectilePresentation, effectPresentation]) {
      expect(section).toContain("case 'astral-verdict'")
      expect(section).toContain("case 'prismatic-fletching'")
      expect(section).toContain('this.drawPolyline(')
    }
  })

  it('renders Arc Choir as violet bloom, lavender body and a narrow white core', () => {
    const arcStart = runtimeSource.indexOf("        case 'arc-chain': {")
    const arcEnd = runtimeSource.indexOf("        case 'astral-verdict': {", arcStart)
    const arcPresentation = runtimeSource.slice(arcStart, arcEnd)

    expect(arcPresentation).toContain('profile.glowColor, 20 + stage * 4')
    expect(arcPresentation).toContain('profile.accentColor, 6.6 + stage * 0.9')
    expect(arcPresentation).toContain('profile.coreColor, 1.15 + stage * 0.18')
  })
})
