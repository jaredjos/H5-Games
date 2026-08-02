import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const modesSource = readFileSync(new URL('./modes.ts', import.meta.url), 'utf8')
const screensSource = readFileSync(new URL('../ui/Screens.tsx', import.meta.url), 'utf8')
const theaterSource = readFileSync(
  new URL('../ui/CombatLabSpellTheater.tsx', import.meta.url),
  'utf8',
)
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

describe('Combat Lab spell review theater', () => {
  it('exposes an explicit damage protocol and Spell Rank 0 for isolated testing', () => {
    expect(screensSource).toContain('Invincibility {normalized.invincible ? \'active\' : \'disabled\'}')
    expect(screensSource).toContain('<span>Spell rank <strong>{owned?.rank ?? 0}</strong></span>')
    expect(modesSource).toContain('normalizeCombatLabLoadout')
    expect(modesSource).toContain('invincible: config.invincible')
  })

  it('keeps the six review presentations scoped to the Combat Lab renderer', () => {
    for (const id of [
      'helio-lance',
      'crescent-array',
      'arc-choir',
      'rift-seeds',
      'comet-swarm',
      'mirror-bow',
    ]) {
      expect(theaterSource).toContain(`'${id}'`)
      expect(stylesSource).toContain(`.spell-theater__stage--${id}`)
    }
    expect(screensSource).toContain('<CombatLabSpellTheater')
  })

  it('provides materially distinct Astral Verdict and Cinderwake Reavers structures', () => {
    expect(theaterSource).toContain('spell-theater-verdict-strike__bolt')
    expect(theaterSource).toContain('spell-theater-verdict-strike__impact')
    expect(theaterSource).toContain('spell-theater-verdict-tempest')
    expect(theaterSource).toContain('CinderwakeReaversEffect')
    expect(theaterSource).toContain('spell-theater-reaver-flight')
    expect(theaterSource).toContain('spell-theater-reaver-blade')
    expect(theaterSource).toContain('spell-theater-eventide-vortex')
    expect(theaterSource).toContain('assets/spell-vfx/cinderwake-reaver-v1.webp')
    expect(theaterSource).not.toContain('spell-theater-mirror-bow__upper')
    expect(theaterSource).not.toContain('spell-theater-pale-bolt')
    expect(theaterSource).not.toContain('VeilglassReliquaryEffect')
  })

  it('sources every Cinderwake rank from the shared presentation profile', () => {
    expect(theaterSource).toContain('cinderwakeReaverPresentationProfile')
    expect(theaterSource).toContain(
      'const profile = cinderwakeReaverPresentationProfile(density, awakened)',
    )
    expect(theaterSource).toContain('cinderwakePresentation?.ambientParticleBudget')
    expect(theaterSource).not.toContain('const CINDERWAKE_RANK_PROFILES')
    expect(stylesSource).toContain('@keyframes spell-theater-reaver-hunt-alpha')
    expect(stylesSource).toContain('@keyframes spell-theater-reaver-hunt-delta')
  })

  it('previews authored Crescent blades and Arc impacts instead of CSS line substitutes', () => {
    expect(theaterSource).toContain('assets/spell-vfx/crescent-moonblade-v1.webp')
    expect(theaterSource).toContain('assets/spell-vfx/arc-choir-impact-v1.webp')
    expect(theaterSource).toContain("'--crescent-sheet'")
    expect(theaterSource).toContain("'--arc-impact-sheet'")
    const crescentStart = stylesSource.indexOf('.spell-theater-crescent {')
    const crescentEnd = stylesSource.indexOf('.spell-theater-moonmist', crescentStart)
    const crescentStyles = stylesSource.slice(crescentStart, crescentEnd)
    expect(crescentStyles).toContain('background-image: var(--crescent-sheet)')
    expect(crescentStyles).not.toContain('border-right')
    expect(stylesSource).toContain('background-image: var(--arc-impact-sheet)')
    expect(stylesSource).toContain('@keyframes spell-theater-atlas-4x4')
  })

  it('previews authored Comet stones with a bright molten corona and compact wake', () => {
    expect(theaterSource).toContain('assets/spell-vfx/comet-orbit-v1.webp')
    expect(theaterSource).toContain("'--comet-sheet'")
    expect(stylesSource).toContain('background-image: var(--comet-sheet)')
    expect(stylesSource).toContain('@keyframes spell-theater-comet-corona')
    expect(stylesSource).toContain('rgba(255, 104, 16, .95)')
    expect(stylesSource).toContain('#ff6710 72%')
  })
})
