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

  it('ships authored live Verdict and persistent Cinderwake signatures', () => {
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

    expect(projectilePresentation).not.toContain("case 'veilglass-reliquary'")
    expect(effectPresentation).toContain("case 'astral-verdict'")
    expect(effectPresentation).not.toContain("case 'veilglass-reliquary'")
    expect(runtimeSource).toContain('private drawPersistentSpellActors(')
    expect(runtimeSource).toContain('this.cinderwakeReavers')
  })

  it('arms persistent Cinderwake projectiles and renders their authored desktop/mobile atlas', () => {
    expect(runtimeSource).toContain('private armCinderwakeReavers(')
    expect(runtimeSource).toContain('private syncCinderwakeReavers(')
    expect(runtimeSource).toContain('assets/spell-vfx/cinderwake-reaver-v1.webp')
    expect(runtimeSource).toContain('assets/spell-vfx/cinderwake-reaver-v1-mobile.webp')
    expect(runtimeSource).not.toContain('private castVeilglassReliquary(')
    expect(runtimeSource).not.toContain("kind: 'veilglass-reliquary'")
  })

  it('renders Astral Verdict from authored material rather than vector lightning rails', () => {
    expect(runtimeSource).toContain('assets/spell-vfx/astral-verdict-v1.webp')
    expect(runtimeSource).toContain('assets/spell-vfx/astral-verdict-v1-mobile.webp')
    expect(runtimeSource).toContain('this.astralVerdictFrames')
  })

  it('keeps hero-originating Lab geometry within the historical projectile bounds', () => {
    expect(runtimeSource).toContain("'helio-lance': [54, 18]")
    expect(runtimeSource).toContain("'comet-swarm': [38, 22]")
    const signatureStart = runtimeSource.indexOf(
      '  private drawCombatLabProjectileSignature(',
    )
    const signatureEnd = runtimeSource.indexOf(
      '  private drawProjectileTrail(',
      signatureStart,
    )
    const signature = runtimeSource.slice(signatureStart, signatureEnd)
    expect(signature).toContain('const geometryScale = presentation.geometryScale')
    expect(signature.match(/geometryScale/g)?.length).toBeGreaterThanOrEqual(10)
    expect(runtimeSource).toContain('color: 0xffc166')
  })

  it('caps Arc Choir target chains and thins awakened ornamental forks', () => {
    expect(runtimeSource).toContain(
      'Math.min(6, 2 + rank + moduleRank + (owned.awakened ? 1 : 0))',
    )
    expect(runtimeSource).toContain('? index % 2 === 0')
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
