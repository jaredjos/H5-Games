import { describe, expect, it } from 'vitest'
import cinematicScreenSourceRaw from '../ui/CinematicScreen.tsx?raw'

const source = cinematicScreenSourceRaw.replace(/\r\n/g, '\n')

describe('cinematic beat background presentation', () => {
  it('falls back to the cinematic arena plate and preloads authored beat plates', () => {
    expect(source).toContain(
      'activeBeat?.backgroundAsset ?? cinematic.arenaAsset',
    )
    expect(source).toContain('beat.backgroundAsset ? [beat.backgroundAsset] : []')
    expect(source).toContain('image.decoding = \'async\'')
  })

  it('keeps the outgoing plate while the active beat plate enters', () => {
    expect(source).toContain('previousPlateAsset === desiredPlateAsset')
    expect(source).toContain('outgoingPlateAsset')
    expect(source).toContain('nt-cinematic__plate--previous')
    expect(source).toContain('nt-cinematic__plate--current')
    expect(source).toContain(
      'nt-cinematic__plate--transition-${desiredPlateTransition}',
    )
  })

  it('passes the authored transition into the plate class and preserves reduced motion', () => {
    expect(source).toContain(
      'desiredPlateTransition = activeBeat?.transition ?? \'fade\'',
    )
    expect(source).toContain(
      'nt-cinematic__plate--transition-${desiredPlateTransition}',
    )
    expect(source).toContain(
      "reducedMotion ? 'nt-cinematic--reduced-motion' : ''",
    )
  })
})
