import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_CINEMATICS,
  CINEMATIC_BY_ID,
  FINALE_CINEMATIC_ID,
  INTRO_CINEMATIC_ID,
  cinematicForFirstClear,
  cinematicIdsForCompletedLevels,
  getCinematic,
} from './cinematics'

describe('NIGHTTRACE campaign cinematics', () => {
  it('defines one intro, nine interludes, and one finale with unique identities', () => {
    expect(CAMPAIGN_CINEMATICS).toHaveLength(11)
    expect(new Set(CAMPAIGN_CINEMATICS.map((scene) => scene.id)).size).toBe(11)
    expect(CAMPAIGN_CINEMATICS.filter((scene) => scene.kind === 'intro')).toHaveLength(1)
    expect(CAMPAIGN_CINEMATICS.filter((scene) => scene.kind === 'interlude')).toHaveLength(9)
    expect(CAMPAIGN_CINEMATICS.filter((scene) => scene.kind === 'finale')).toHaveLength(1)
    expect(CAMPAIGN_CINEMATICS[0].id).toBe(INTRO_CINEMATIC_ID)
    expect(CAMPAIGN_CINEMATICS.at(-1)?.id).toBe(FINALE_CINEMATIC_ID)
  })

  it('bridges every first clear to the next sector and closes after level ten', () => {
    const intro = getCinematic(INTRO_CINEMATIC_ID)
    expect(intro?.nextLevelId).toBe(1)
    expect(intro?.afterLevelId).toBeUndefined()

    for (let levelId = 1; levelId <= 9; levelId += 1) {
      const interlude = cinematicForFirstClear(levelId)
      expect(interlude, `missing cinematic after level ${levelId}`).toBeDefined()
      expect(interlude?.kind).toBe('interlude')
      expect(interlude?.afterLevelId).toBe(levelId)
      expect(interlude?.nextLevelId).toBe(levelId + 1)
    }

    const finale = cinematicForFirstClear(10)
    expect(finale?.id).toBe(FINALE_CINEMATIC_ID)
    expect(finale?.afterLevelId).toBe(10)
    expect(finale?.nextLevelId).toBeUndefined()
    expect(cinematicForFirstClear(0)).toBeUndefined()
    expect(cinematicForFirstClear(11)).toBeUndefined()
    expect(cinematicForFirstClear(Number.NaN)).toBeUndefined()
  })

  it('keeps every subtitle and authored voice take inside its scene timeline', () => {
    const audioPaths = new Set<string>()
    const audioSegments = new Set<string>()
    const lineIds = new Set<string>()
    const voicedLineIds = new Set<string>()

    for (const scene of CAMPAIGN_CINEMATICS) {
      expect(scene.duration).toBeGreaterThan(0)
      expect(scene.durationMs).toBe(scene.duration)
      expect(scene.arenaAsset).toMatch(/^assets\//)
      expect(scene.heroAsset).toMatch(/^assets\//)
      expect(scene.lines.length).toBeGreaterThan(0)

      for (const line of scene.lines) {
        expect(line.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        expect(lineIds.has(line.id), `duplicate line id ${line.id}`).toBe(false)
        lineIds.add(line.id)

        expect(line.start).toBeGreaterThanOrEqual(0)
        expect(line.duration).toBeGreaterThan(0)
        expect(line.startMs).toBe(line.start)
        expect(line.endMs).toBe(line.start + line.duration)
        expect(line.endMs).toBeLessThanOrEqual(scene.duration)
        expect(line.text.trim().length).toBeGreaterThan(1)

        if (scene.kind === 'interlude') {
          expect(line.audioSrc).toBeUndefined()
          expect(line.audioFallbackSrc).toBeUndefined()
          expect(line.audioStartMs).toBeUndefined()
          expect(line.audioEndMs).toBeUndefined()
        } else {
          if (line.speaker === 'Last Star') {
            expect(line.audioSrc).toMatch(
              /^assets\/cinematics\/audio\/last-star\/.+\.wav$/,
            )
          } else {
            expect(line.audioSrc).toMatch(
              /^https:\/\/resource2\.heygen\.ai\/.+\.wav$/,
            )
          }
          expect(line.audioFallbackSrc).toBeUndefined()
          expect(line.audioStartMs).toBeGreaterThanOrEqual(0)
          expect(line.audioEndMs).toBeGreaterThan(line.audioStartMs ?? 0)
          expect((line.audioEndMs ?? 0) - (line.audioStartMs ?? 0))
            .toBeLessThanOrEqual(line.duration)
          const segment = `${line.audioSrc}#${line.audioStartMs}-${line.audioEndMs}`
          expect(audioSegments.has(segment), `duplicate voice segment ${segment}`).toBe(false)
          audioSegments.add(segment)
          audioPaths.add(line.audioSrc ?? '')
          voicedLineIds.add(line.id)
        }
      }
    }

    expect(audioPaths.size).toBe(9)
    expect(audioSegments.size).toBe(voicedLineIds.size)
    expect(voicedLineIds.size).toBe(13)
    expect(lineIds.size).toBe(35)
  })

  it('keeps Memories I-IX subtitle-only without losing dialogue or portraits', () => {
    const memories = CAMPAIGN_CINEMATICS.filter(
      (scene) => scene.kind === 'interlude',
    )

    expect(memories).toHaveLength(9)
    expect(memories.flatMap((scene) => scene.lines)).toHaveLength(22)
    for (const scene of memories) {
      for (const line of scene.lines) {
        expect(line.text.trim()).not.toBe('')
        expect(line.audioSrc).toBeUndefined()
      }
    }

    const cartographer = memories
      .flatMap((scene) => scene.lines)
      .find((line) => line.id === 'interlude-09-cartographer-01')
    expect(cartographer?.speaker).toBe('Cartographer echo')
    expect(cartographer?.audioSrc).toBeUndefined()
  })

  it('maps every Last Star line to a unique same-origin narration asset', () => {
    const localAudioSources = CAMPAIGN_CINEMATICS.flatMap((scene) =>
      scene.lines.flatMap((line) =>
        line.audioSrc && !/^https?:\/\//i.test(line.audioSrc)
          ? [line.audioSrc]
          : [],
      ),
    )

    expect(localAudioSources).toHaveLength(7)
    expect(new Set(localAudioSources).size).toBe(7)
    expect(localAudioSources.every((source) =>
      /^assets\/cinematics\/audio\/last-star\/.+\.wav$/.test(source),
    )).toBe(true)
  })

  it('uses contiguous beats with no gaps, overlaps, or out-of-bounds frames', () => {
    for (const scene of CAMPAIGN_CINEMATICS) {
      expect(scene.beats.length).toBeGreaterThan(0)
      expect(scene.beats[0].start).toBe(0)

      let cursor = 0
      for (const beat of scene.beats) {
        expect(beat.start, `${scene.id}/${beat.id} does not meet the prior beat`).toBe(cursor)
        expect(beat.duration).toBeGreaterThan(0)
        expect(beat.startMs).toBe(beat.start)
        expect(beat.endMs).toBe(beat.start + beat.duration)
        expect(beat.endMs).toBeLessThanOrEqual(scene.duration)
        cursor = beat.endMs
      }

      expect(cursor, `${scene.id} does not cover its full duration`).toBe(scene.duration)
    }
  })

  it('indexes all scenes and migrates completed campaign progress deterministically', () => {
    expect(Object.keys(CINEMATIC_BY_ID)).toHaveLength(CAMPAIGN_CINEMATICS.length)
    for (const scene of CAMPAIGN_CINEMATICS) {
      expect(getCinematic(scene.id)).toBe(scene)
    }
    expect(getCinematic('not-a-real-cinematic')).toBeUndefined()

    expect(cinematicIdsForCompletedLevels([])).toEqual([])
    expect(cinematicIdsForCompletedLevels([1])).toEqual([
      INTRO_CINEMATIC_ID,
      'interlude-01-the-road-remembers',
    ])
    expect(cinematicIdsForCompletedLevels([3, 1, 3, 99, -1])).toEqual([
      INTRO_CINEMATIC_ID,
      'interlude-01-the-road-remembers',
      'interlude-03-what-night-couldnt-kill',
    ])
    expect(cinematicIdsForCompletedLevels([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual(
      CAMPAIGN_CINEMATICS.map((scene) => scene.id),
    )
  })

  it('preserves the campaign reveal and the Bearer’s final choice in subtitle copy', () => {
    const allDialogue = CAMPAIGN_CINEMATICS.flatMap((scene) =>
      scene.lines.map((line) => line.text),
    ).join(' ')

    expect(allDialogue).toContain('Ten Sovereigns keep the morning chained.')
    expect(allDialogue).toContain('The map… was bait.')
    expect(allDialogue).toContain('taught us where to close the line')
    expect(allDialogue).toContain('I was never the last light. I was the first.')
    expect(allDialogue).toContain('Then let morning belong to everyone.')
  })
})
