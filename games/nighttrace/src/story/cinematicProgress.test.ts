import { describe, expect, it } from 'vitest'
import { shouldRecordCinematicSeen } from './cinematicProgress'

describe('cinematic progression', () => {
  it('records campaign story scenes but keeps replay viewers consequence-free', () => {
    expect(shouldRecordCinematicSeen('campaign')).toBe(true)
    expect(shouldRecordCinematicSeen('results')).toBe(true)
    expect(shouldRecordCinematicSeen('codex')).toBe(false)
    expect(shouldRecordCinematicSeen('combat-lab')).toBe(false)
  })
})
