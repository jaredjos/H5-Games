import { describe, expect, it } from 'vitest'
import {
  parseLocalWeaponShowcase,
  showcaseCaptureSeconds,
  showcaseLabel,
  showcaseLoadout,
} from './showcase'
import { ALL_WEAPON_VFX_IDS } from './weaponVfx'

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

  it('builds all four documented runtime states for every weapon', () => {
    for (const weaponId of ALL_WEAPON_VFX_IDS) {
      const solo = showcaseLoadout({ weaponId, state: 'solo' })
      const combined = showcaseLoadout({ weaponId, state: 'combined' })
      const mastered = showcaseLoadout({ weaponId, state: 'mastered' })
      const final = showcaseLoadout({ weaponId, state: 'final' })

      expect(solo.weapons[0]).toEqual({ id: weaponId, rank: 1, awakened: undefined })
      expect(solo.modules).toEqual([])
      expect(combined.weapons[0]).toEqual({
        id: weaponId,
        rank: 1,
        awakened: undefined,
      })
      expect(combined.modules).toHaveLength(1)
      expect(combined.modules[0].rank).toBe(1)
      expect(mastered.weapons[0]).toEqual({
        id: weaponId,
        rank: 5,
        awakened: undefined,
      })
      expect(mastered.modules).toEqual([])
      expect(final.weapons[0]).toEqual({
        id: weaponId,
        rank: 5,
        awakened: true,
      })
      expect(final.modules[0].rank).toBe(3)
      expect(showcaseCaptureSeconds(weaponId)).toBeGreaterThan(0.75)
      expect(showcaseCaptureSeconds(weaponId)).toBeLessThanOrEqual(1.5)
    }
    expect(showcaseLabel({ weaponId: 'comet-swarm', state: 'final' })).toContain(
      'PERIHELION HUNT',
    )
  })
})
