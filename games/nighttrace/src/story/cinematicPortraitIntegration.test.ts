import { describe, expect, it } from 'vitest'
import cinematicScreenSourceRaw from '../ui/CinematicScreen.tsx?raw'

const screenSource = cinematicScreenSourceRaw.replace(/\r\n/g, '\n')

describe('cinematic portrait presentation integration', () => {
  it('renders the mapped expression beside accessible speaker dialogue', () => {
    expect(screenSource).toContain(
      "import { getCinematicPortrait } from '../story/cinematicPortraits'",
    )
    expect(screenSource).toContain('getCinematicPortrait(activeLine)')
    expect(screenSource).toContain('appAssetUrl(activePortrait.asset)')
    expect(screenSource).toContain('activePortrait.frame * 25')
    expect(screenSource).toContain('aria-live="polite"')
    expect(screenSource).toContain('aria-atomic="true"')
    expect(screenSource).toContain('{activeLine.speaker}')
  })

  it('selects each expression as a percentage of the four-column sheet', () => {
    expect(screenSource).toContain('nt-cinematic__portrait-window')
    expect(screenSource).toContain('nt-cinematic__portrait-sheet')
    expect(screenSource).toContain(
      'translate3d(-${activePortrait.frame * 25}%, 0, 0)',
    )
  })

  it('keys the presentation per line and preserves the reduced-motion mode', () => {
    expect(screenSource).toContain('key={activeLine.id}')
    expect(screenSource).toContain(
      "reducedMotion ? 'nt-cinematic--reduced-motion' : ''",
    )
    expect(screenSource).toContain('SPEAKER_THEME[activeLine.speaker]')
  })
})
