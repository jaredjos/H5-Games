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

  it('provides materially distinct Rift Seeds and Mirror Bow structures', () => {
    expect(theaterSource).toContain('spell-theater-seed__lens')
    expect(theaterSource).toContain('spell-theater-seed__splinters')
    expect(theaterSource).toContain('spell-theater-rift-tide')
    expect(theaterSource).toContain('spell-theater-mirror-bow__upper')
    expect(theaterSource).toContain('spell-theater-pale-bolt')
    expect(theaterSource).toContain('spell-theater-infinite-arch')
  })
})
