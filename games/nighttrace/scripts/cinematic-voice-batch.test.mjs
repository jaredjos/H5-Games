import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildGoogleSpeechPrompt,
  buildInlineBatchPayload,
  assessCadenceReviewTake,
  batchPollDelayMs,
  buildCadenceReviewBatchPayload,
  buildCadenceReviewPrompt,
  createFileWithoutOverwrite,
  decodeBatchOperation,
  recoverableCadenceReviewJob,
  replaceCheckpointFile,
  spokenWordCount,
} from './render-cinematic-voices-batch.mjs'
import {
  CINEMATIC_VOICE_MODEL,
  cinematicLineContentSha256,
  cinematicVoiceWindowMs,
  validateCinematicVoicePlan,
} from './cinematic-voice-integrity.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const plan = validateCinematicVoicePlan(
  JSON.parse(
    readFileSync(resolve(projectRoot, 'src/story/cinematicVoicePlan.json'), 'utf8'),
  ),
)
const pending = validateCinematicVoicePlan(
  JSON.parse(
    readFileSync(
      resolve(projectRoot, 'scripts/pending-cinematic-voice-refresh-v1.23.json'),
      'utf8',
    ),
  ).lineOverrides,
)
const cadenceReview = JSON.parse(
  readFileSync(
    resolve(projectRoot, 'scripts/cinematic-voice-cadence-review-v3.json'),
    'utf8',
  ),
)

function pcmFixture() {
  const samples = Buffer.alloc(24_000 * 2)
  for (let offset = 0; offset < samples.length; offset += 2) {
    samples.writeInt16LE(2_000, offset)
  }
  return samples.toString('base64')
}

function responseFor(request) {
  return {
    metadata: { ...request },
    response: {
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/L16;codec=pcm;rate=24000',
                  data: pcmFixture(),
                },
              },
            ],
          },
        },
      ],
    },
  }
}

describe('Cinematic voice Google Batch API contract', () => {
  it('uses a bounded polling backoff for automatic watch mode', () => {
    expect([0, 1, 2, 3, 8].map(batchPollDelayMs)).toEqual([
      15_000,
      30_000,
      60_000,
      120_000,
      120_000,
    ])
  })

  it('keeps the intro on the accepted campaign cadence windows', () => {
    const first = pending.find((line) => line.id === 'intro-star-01')
    const second = pending.find((line) => line.id === 'intro-star-02')

    expect(cinematicVoiceWindowMs(first)).toBe(7_200)
    expect(cinematicVoiceWindowMs(second)).toBe(7_800)
    expect(first.voiceName).toBe('Aoede')
    expect(second.voiceName).toBe('Aoede')
  })

  it('uses the fixed cadence detector and speaker-calibrated natural prompts', () => {
    expect(spokenWordCount('The Sun-Eater cannot return.')).toBe(4)
    const intro = pending.find((line) => line.id === 'intro-star-01')
    const prompt = buildCadenceReviewPrompt(intro, cadenceReview)

    expect(prompt).toContain('Match the accepted Last Star')
    expect(prompt).toContain('acceptable range 4.9-6.0 seconds')
    expect(prompt).toContain('continuous phrasing, never by rushing or padding silence')
    expect(prompt).not.toContain('Spacious, expressive, and never brisk')
  })

  it('builds one isolated review request for every rejected take without changing model or voices', () => {
    const batch = buildCadenceReviewBatchPayload(
      pending,
      cadenceReview,
      'review-contract',
    )
    expect(batch.requests.map((entry) => entry.clipId)).toEqual(
      pending.map((line) => line.id),
    )
    expect(batch.requests).toHaveLength(10)
    const inlined = batch.body.batch.inputConfig.requests.requests
    for (let index = 0; index < pending.length; index += 1) {
      expect(inlined[index].request.generationConfig.speechConfig.voiceConfig)
        .toEqual({ prebuiltVoiceConfig: { voiceName: pending[index].voiceName } })
      expect(inlined[index].request.generationConfig.responseModalities).toEqual([
        'AUDIO',
      ])
    }
    expect(CINEMATIC_VOICE_MODEL).toBe('gemini-3.1-flash-tts-preview')
  })

  it('classifies all prior staged cadence outcomes against the fixed speaker bands', () => {
    const priorDurations = {
      'intro-star-01': 10_712,
      'intro-star-02': 11_048,
      'finale-star-03': 4_779,
      'finale-sun-eater-01': 4_657,
      'finale-star-04': 3_770,
      'finale-sun-eater-02': 4_176,
      'finale-star-05': 2_370,
      'finale-bearer-03': 1_625,
      'finale-bearer-04': 4_171,
      'finale-sun-eater-03': 3_449,
    }
    const assessments = pending.map((line) => ({
      id: line.id,
      ...assessCadenceReviewTake(line, priorDurations[line.id], cadenceReview),
    }))

    expect(
      assessments.filter((entry) => entry.speakerBandMatch).map((entry) => entry.id),
    ).toEqual([
      'finale-star-03',
      'finale-sun-eater-01',
      'finale-star-04',
      'finale-star-05',
      'finale-bearer-03',
    ])
    expect(
      assessments.filter((entry) => entry.durationMatch).map((entry) => entry.id),
    ).toEqual([
      'finale-star-03',
      'finale-star-04',
      'finale-star-05',
      'finale-bearer-03',
    ])
  })

  it('submits exactly the approved ten pending IDs with the unchanged model, voices and prompt contract', () => {
    expect(pending).toHaveLength(10)
    const batch = buildInlineBatchPayload(pending, new Map(), 'contract-test')
    const inlined = batch.body.batch.inputConfig.requests.requests

    expect(inlined).toHaveLength(10)
    expect(batch.requests.map((entry) => entry.clipId)).toEqual(
      pending.map((line) => line.id),
    )
    for (let index = 0; index < pending.length; index += 1) {
      const line = pending[index]
      const entry = inlined[index]
      expect(entry.metadata.contentSha256).toBe(cinematicLineContentSha256(line))
      expect(entry.metadata.voiceName).toBe(line.voiceName)
      expect(entry.request.generationConfig.responseModalities).toEqual(['AUDIO'])
      expect(
        entry.request.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig
          .voiceName,
      ).toBe(line.voiceName)
      expect(entry.request.contents[0].parts[0].text).toBe(
        buildGoogleSpeechPrompt(line, 0),
      )
    }
    expect(CINEMATIC_VOICE_MODEL).toBe('gemini-3.1-flash-tts-preview')
  })

  it('uses the tighter second performance without changing clip identity or voice', () => {
    const retryLines = pending.filter((line) =>
      ['intro-star-01', 'intro-star-02', 'finale-sun-eater-03'].includes(line.id),
    )
    const attempts = new Map(retryLines.map((line) => [line.id, 1]))
    const batch = buildInlineBatchPayload(retryLines, attempts, 'retry-contract')

    expect(batch.requests.map((entry) => entry.clipId)).toEqual([
      'intro-star-01',
      'intro-star-02',
      'finale-sun-eater-03',
    ])
    for (const line of retryLines) {
      const entry = batch.body.batch.inputConfig.requests.requests.find(
        (candidate) => candidate.metadata.clipId === line.id,
      )
      expect(entry.metadata.performanceAttempt).toBe(1)
      expect(entry.metadata.contentSha256).toBe(cinematicLineContentSha256(line))
      expect(entry.metadata.voiceName).toBe(line.voiceName)
      expect(entry.request.contents[0].parts[0].text).toBe(
        buildGoogleSpeechPrompt(line, 1),
      )
      expect(entry.request.contents[0].parts[0].text).toContain(
        line.delivery === 'spacious'
          ? 'around 145 words per minute'
          : 'around 175 words per minute',
      )
    }
  })

  it('maps out-of-order results only by authenticated per-clip metadata', () => {
    const batch = buildInlineBatchPayload(pending.slice(0, 2), new Map(), 'test')
    const operation = {
      response: {
        output: {
          inlinedResponses: {
            inlinedResponses: batch.requests.toReversed().map(responseFor),
          },
        },
      },
    }
    const decoded = decodeBatchOperation(operation, batch.requests)
    expect(decoded.map((entry) => entry.expected.clipId)).toEqual(
      batch.requests.map((entry) => entry.clipId),
    )
    expect(decoded.every((entry) => entry.durationMs === 1_000)).toBe(true)
  })

  it('preserves valid sibling audio when one batch response has no audio payload', () => {
    const batch = buildInlineBatchPayload(pending.slice(0, 2), new Map(), 'test')
    const missingAudio = {
      metadata: { ...batch.requests[0] },
      response: {
        candidates: [
          {
            finishReason: 'OTHER',
            content: { parts: [{ text: 'No audio was returned.' }] },
          },
        ],
      },
    }
    const operation = {
      response: {
        output: {
          inlinedResponses: {
            inlinedResponses: [
              missingAudio,
              responseFor(batch.requests[1]),
            ],
          },
        },
      },
    }

    const decoded = decodeBatchOperation(operation, batch.requests)
    expect(decoded[0]).toMatchObject({
      expected: batch.requests[0],
      error: {
        code: 'NO_AUDIO_PAYLOAD',
      },
    })
    expect(decoded[1].expected).toEqual(batch.requests[1])
    expect(decoded[1].durationMs).toBe(1_000)
  })

  it('rejects forged metadata, duplicate IDs and incomplete response sets', () => {
    const batch = buildInlineBatchPayload(pending.slice(0, 2), new Map(), 'test')
    const forged = responseFor(batch.requests[0])
    forged.metadata.requestSha256 = '0'.repeat(64)
    expect(() =>
      decodeBatchOperation(
        {
          response: {
            output: {
              inlinedResponses: {
                inlinedResponses: [forged, responseFor(batch.requests[1])],
              },
            },
          },
        },
        batch.requests,
      ),
    ).toThrow('batch metadata mismatch for requestSha256')

    expect(() =>
      decodeBatchOperation(
        {
          response: {
            output: {
              inlinedResponses: {
                inlinedResponses: [
                  responseFor(batch.requests[0]),
                  responseFor(batch.requests[0]),
                ],
              },
            },
          },
        },
        batch.requests,
      ),
    ).toThrow('unknown or duplicate clip metadata')

    expect(() =>
      decodeBatchOperation(
        {
          response: {
            output: {
              inlinedResponses: {
                inlinedResponses: [responseFor(batch.requests[0])],
              },
            },
          },
        },
        batch.requests,
      ),
    ).toThrow('responses for 2 requests')
  })

  it('never overwrites an existing staged WAV path', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'nighttrace-voice-batch-'))
    const destination = resolve(directory, 'clip.wav')
    const original = Buffer.from('existing-take')
    try {
      await writeFile(destination, original)
      await expect(
        createFileWithoutOverwrite(destination, Buffer.from('different-take')),
      ).rejects.toThrow('Refusing to overwrite existing staged file')
      expect(await readFile(destination)).toEqual(original)
      await expect(createFileWithoutOverwrite(destination, original)).resolves.toBe(
        'reused',
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('creates a fresh nested review directory before writing a checkpoint', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'nighttrace-voice-review-'))
    const destination = resolve(
      directory,
      'reviews',
      'cadence-review-v3',
      'state.json',
    )
    const checkpoint = '{"status":"review-pending"}\n'
    try {
      await expect(replaceCheckpointFile(destination, checkpoint)).resolves.toBe(
        undefined,
      )
      expect(await readFile(destination, 'utf8')).toBe(checkpoint)
      await expect(readFile(`${destination}.partial`)).rejects.toMatchObject({
        code: 'ENOENT',
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('recovers a completed review operation before submitting another generation', () => {
    const completed = {
      operationName: 'batches/completed-review',
      state: 'BATCH_STATE_SUCCEEDED',
      results: [
        {
          id: 'intro-star-01',
          status: 'cadence-outlier',
          durationMs: 6_698,
        },
      ],
    }
    expect(
      recoverableCadenceReviewJob({
        jobs: [completed],
      }),
    ).toBe(completed)

    completed.results[0].candidateRelativePath =
      'candidates/intro-star-01.review.wav'
    expect(recoverableCadenceReviewJob({ jobs: [completed] })).toBeUndefined()
  })
})
