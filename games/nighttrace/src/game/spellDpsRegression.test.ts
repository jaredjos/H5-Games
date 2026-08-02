import { describe, expect, it } from 'vitest'
import type { OwnedWeapon, WeaponId } from '../shared/types'
import { ALL_WEAPON_IDS, WEAPONS } from './content'
import runtimeSourceRaw from './GameCanvas.tsx?raw'
import {
  cinderwakeReaverProfile,
  orbitingCometProfile,
  persistentWindowDamage,
} from './persistentSpellChoreography'
import {
  NORMALIZED_WEAPON_BASE_DPS,
  weaponCastDamageBudget,
  weaponConnectedDps,
  weaponCooldownSeconds,
} from './weaponBalance'

const runtimeSource = runtimeSourceRaw.replace(/\r\n/g, '\n')

const EXPECTED_WEAPON_IDS = [
  'helio-lance',
  'crescent-array',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
  'ash-halo',
  'mirror-bow',
  'null-bell',
] as const satisfies readonly WeaponId[]

const SPELL_RANK_LADDER = [
  { label: 'Rank I', rank: 1, moduleRank: 0, awakened: false, expectedDps: 52 },
  {
    label: 'Rank II',
    rank: 2,
    moduleRank: 0,
    awakened: false,
    expectedDps: 72.08465608465609,
  },
  {
    label: 'Rank III',
    rank: 3,
    moduleRank: 0,
    awakened: false,
    expectedDps: 94.65168539325843,
  },
  {
    label: 'Rank IV',
    rank: 4,
    moduleRank: 0,
    awakened: false,
    expectedDps: 120.19161676646706,
  },
  {
    label: 'Rank V',
    rank: 5,
    moduleRank: 0,
    awakened: false,
    expectedDps: 149.33333333333334,
  },
  {
    label: 'Awakened',
    rank: 5,
    // Awakening requires the paired module, so use its minimum legal rank.
    moduleRank: 1,
    awakened: true,
    expectedDps: 372.47848401105415,
  },
] as const

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

const caseSection = (source: string, weaponId: WeaponId, nextWeaponId: WeaponId) => {
  const startMarker = `      case '${weaponId}'`
  const endMarker = `      case '${nextWeaponId}'`
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return source.slice(start, end)
}

const ownedWeapon = (
  id: WeaponId,
  rank: number,
  awakened: boolean,
): OwnedWeapon => ({ id, rank, awakened })

describe('production spell sustained-DPS regression', () => {
  it('covers exactly the eight live arsenal spells', () => {
    expect(ALL_WEAPON_IDS).toEqual(EXPECTED_WEAPON_IDS)
    expect(new Set(ALL_WEAPON_IDS).size).toBe(8)
  })

  it.each(SPELL_RANK_LADDER)(
    'keeps every spell on the shared $label sustained-DPS rung',
    ({ rank, moduleRank, awakened, expectedDps }) => {
      const connectedDps = ALL_WEAPON_IDS.map((id) =>
        weaponConnectedDps(ownedWeapon(id, rank, awakened), moduleRank),
      )

      expect(Math.min(...connectedDps)).toBeGreaterThan(0)
      expect(Math.max(...connectedDps) - Math.min(...connectedDps)).toBeLessThan(
        1e-9,
      )
      for (const dps of connectedDps) {
        expect(dps).toBeCloseTo(expectedDps, 10)
      }
    },
  )

  it('keeps authored base damage/cooldown ratios pinned to the shared 52 DPS budget', () => {
    for (const weaponId of ALL_WEAPON_IDS) {
      expect(WEAPONS[weaponId].damage / WEAPONS[weaponId].cooldown).toBeCloseTo(
        NORMALIZED_WEAPON_BASE_DPS,
        10,
      )
    }
  })
})

describe('persistent spell damage-window invariance', () => {
  it.each(SPELL_RANK_LADDER)(
    'Comets and Reavers deliver one $label cast budget regardless of actor count',
    ({ rank, moduleRank, awakened }) => {
      const cases = [
        {
          id: 'comet-swarm' as const,
          actorCount: orbitingCometProfile(rank, awakened).count,
        },
        {
          id: 'mirror-bow' as const,
          actorCount: cinderwakeReaverProfile(rank, awakened).count,
        },
      ]

      for (const { id, actorCount } of cases) {
        const owned = ownedWeapon(id, rank, awakened)
        const castBudget = weaponCastDamageBudget(owned, moduleRank)
        const cooldown = weaponCooldownSeconds(
          id,
          rank,
          moduleRank,
          awakened,
        )

        for (const connectedActors of [1, actorCount, actorCount * 3]) {
          const shares = persistentWindowDamage(castBudget, connectedActors)
          expect(shares).toHaveLength(connectedActors)
          expect(shares.reduce((total, damage) => total + damage, 0)).toBeCloseTo(
            castBudget,
            10,
          )

          // Repeated deterministic cast windows preserve the same sustained
          // damage rate even when a rank adds more visible persistent actors.
          const windowCount = 240
          const delivered =
            shares.reduce((total, damage) => total + damage, 0) * windowCount
          const elapsed = cooldown * windowCount
          expect(delivered / elapsed).toBeCloseTo(
            weaponConnectedDps(owned, moduleRank),
            10,
          )
        }
      }
    },
  )
})

describe('runtime cast-budget wiring', () => {
  const fireWeapon = section(
    '  private fireWeapon(owned: OwnedWeapon)',
    '  private pushWeaponEffect(',
  )

  it('creates one cast-wide production budget before weapon choreography', () => {
    expect(fireWeapon.match(/weaponCastDamageBudget\(owned, moduleRank\)/g)).toHaveLength(
      1,
    )
  })

  it('arms persistent Comets and Cinderwake Reavers with that shared budget', () => {
    const comets = caseSection(fireWeapon, 'comet-swarm', 'ash-halo')
    const reavers = caseSection(fireWeapon, 'mirror-bow', 'null-bell')

    expect(comets).toContain(
      'this.armOrbitingComets(owned, visualState, damage, visualSeed)',
    )
    expect(comets).not.toContain('this.spawnProjectile(')
    expect(reavers).toContain(
      'this.armCinderwakeReavers(owned, visualState, damage, visualSeed, target)',
    )
    expect(reavers).not.toContain('this.spawnProjectile(')
  })

  it('splits Crescent Array boss damage instead of multiplying it per blade', () => {
    const crescents = caseSection(fireWeapon, 'crescent-array', 'arc-choir')
    expect(crescents).toMatch(
      /visualSeed \+ index,\s*damage \/ blades,\s*\)/,
    )
  })

  it('normalizes Arc Choir against the links that actually connected', () => {
    const arcChoir = section(
      '  private chainLightning(',
      '  private bossAttack(',
    )
    expect(arcChoir).toContain('const chain: EnemyEntity[] = []')
    expect(arcChoir).toContain(
      'const totalWeight = weights.reduce((total, weight) => total + weight, 0)',
    )
    expect(arcChoir).toContain('(damage * weights[index]) / totalWeight')
  })

  it('shares remote-field damage across bosses and adds as one budget', () => {
    const replacementCast = section(
      '  private castReplacementWeapon(',
      '  private fireWeapon(owned: OwnedWeapon)',
    )
    expect(replacementCast).toContain(
      'distributeRemoteCastDamage(\n      castDamageBudget,\n      connectedEnemies,\n    )',
    )
  })
})
