import { describe, expect, it } from 'vitest'
import {
  cinderwakeReaverProfile,
  cinderwakeReaverPresentationProfile,
  orbitingCometProfile,
  persistentWindowDamage,
} from './persistentSpellChoreography'

describe('persistent spell choreography', () => {
  it('gives every Comet rank a distinct orbit profile', () => {
    const ranks = [1, 2, 3, 4, 5].map((rank) =>
      orbitingCometProfile(rank, false),
    )
    expect(ranks.map((profile) => profile.count)).toEqual([2, 3, 3, 4, 5])
    expect(new Set(ranks.map((profile) => JSON.stringify(profile))).size).toBe(5)
    expect(orbitingCometProfile(5, true).count).toBe(6)
    expect(orbitingCometProfile(5, true).counterRotating).toBe(true)
  })

  it('adds Reavers without multiplying their cast budget', () => {
    const ranks = [1, 2, 3, 4, 5].map((rank) =>
      cinderwakeReaverProfile(rank, false),
    )
    expect(ranks.map((profile) => profile.count)).toEqual([1, 1, 2, 2, 3])
    expect(new Set(ranks.map((profile) => JSON.stringify(profile))).size).toBe(5)
    expect(cinderwakeReaverProfile(5, true).count).toBe(4)

    for (const count of [1, 2, 3, 4, 12]) {
      const shares = persistentWindowDamage(120, count)
      expect(shares.reduce((total, share) => total + share, 0)).toBeCloseTo(120)
    }
  })

  it('shares the exact Cinderwake Theater material profile across renderers', () => {
    const presentations = [1, 2, 3, 4, 5].map((rank) =>
      cinderwakeReaverPresentationProfile(rank, false),
    )
    const awakened = cinderwakeReaverPresentationProfile(5, true)

    expect(presentations.map(({ count }) => count)).toEqual([1, 1, 2, 2, 3])
    expect(presentations.map(({ duration }) => duration)).toEqual([
      5.2, 4.45, 4.05, 3.45, 3.05,
    ])
    expect(presentations.map(({ scale }) => scale)).toEqual([
      0.72, 0.82, 0.78, 0.86, 0.9,
    ])
    expect(presentations.map(({ cinders }) => cinders)).toEqual([1, 2, 2, 3, 4])
    expect(presentations.map(({ ambientParticleBudget }) => ambientParticleBudget)).toEqual([
      5, 7, 9, 11, 13,
    ])
    expect(presentations.map(({ visualDiameter }) => visualDiameter)).toEqual([
      49, 57.4, 56.2, 63.6, 68.4,
    ])
    expect(awakened).toEqual({
      count: 4,
      duration: 2.48,
      scale: 1,
      cinders: 6,
      ambientParticleBudget: 18,
      visualDiameter: 76,
    })
    expect(Object.isFrozen(awakened)).toBe(true)
  })

  it('fails safely for empty contacts and malformed budgets', () => {
    expect(persistentWindowDamage(120, 0)).toEqual([])
    expect(persistentWindowDamage(Number.NaN, 2)).toEqual([0, 0])
  })
})
