import { describe, expect, it } from 'vitest'
import {
  parseLocalWeaponShowcase,
  showcaseLabel,
  showcaseLoadout,
} from './showcase'

describe('local weapon showcase', () => {
  it('is restricted to local development hosts', () => {
    expect(
      parseLocalWeaponShowcase(
        'jaredjos.github.io',
        '?showcase=weapon&weapon=helio-lance&state=final',
      ),
    ).toBeUndefined()
    expect(
      parseLocalWeaponShowcase(
        '127.0.0.1',
        '?showcase=weapon&weapon=helio-lance&state=final',
      ),
    ).toEqual({ weaponId: 'helio-lance', state: 'final' })
  })

  it('rejects invalid weapon and state values', () => {
    expect(
      parseLocalWeaponShowcase(
        'localhost',
        '?showcase=weapon&weapon=unknown&state=solo',
      ),
    ).toBeUndefined()
    expect(
      parseLocalWeaponShowcase(
        'localhost',
        '?showcase=weapon&weapon=helio-lance&state=unknown',
      ),
    ).toBeUndefined()
  })

  it('builds the three documented runtime states', () => {
    const solo = showcaseLoadout({ weaponId: 'comet-swarm', state: 'solo' })
    const combined = showcaseLoadout({ weaponId: 'comet-swarm', state: 'combined' })
    const mastered = showcaseLoadout({ weaponId: 'comet-swarm', state: 'mastered' })
    const final = showcaseLoadout({ weaponId: 'comet-swarm', state: 'final' })

    expect(solo).toEqual({
      weapons: [{ id: 'comet-swarm', rank: 1, awakened: undefined }],
      modules: [],
    })
    expect(combined).toEqual({
      weapons: [{ id: 'comet-swarm', rank: 1, awakened: undefined }],
      modules: [{ id: 'guidance-filament', rank: 1 }],
    })
    expect(mastered).toEqual({
      weapons: [{ id: 'comet-swarm', rank: 5, awakened: undefined }],
      modules: [],
    })
    expect(final.weapons[0]).toEqual({
      id: 'comet-swarm',
      rank: 5,
      awakened: true,
    })
    expect(showcaseLabel({ weaponId: 'comet-swarm', state: 'final' })).toContain(
      'PERIHELION HUNT',
    )
  })
})
