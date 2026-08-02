import { createHash, randomUUID } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import {
  copyFile,
  link,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CINEMATIC_VOICE_MODEL,
  CINEMATIC_VOICE_PROMPT_REVISION,
  CINEMATIC_VOICE_PROVIDER,
  CINEMATIC_VOICE_SET,
  cinematicLineContentSha256,
  cinematicPlanSha256,
  cinematicVoiceWindowMs,
  inspectCinematicWav,
  validateCinematicVoicePlan,
  verifyCinematicVoiceSet,
} from './cinematic-voice-integrity.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const planPath = resolve(root, 'src/story/cinematicVoicePlan.json')
const pendingDefinitionPath = resolve(
  root,
  'scripts/pending-cinematic-voice-refresh-v1.23.json',
)
const cadenceReviewPath = resolve(
  root,
  'scripts/cinematic-voice-cadence-review-v3.json',
)
const liveAudioDirectory = resolve(root, 'public/assets/cinematics/audio/campaign')
const liveManifestPath = resolve(liveAudioDirectory, 'manifest.json')
const serviceWorkerPath = resolve(root, 'public/sw.js')
const workspaceDirectory = resolve(root, '.cinematic-voice-batch')
const statePath = resolve(workspaceDirectory, 'state.json')
const stagedDirectory = resolve(workspaceDirectory, 'staged')
const stagedManifestPath = resolve(workspaceDirectory, 'staged-manifest.json')
const cadenceReviewGenerationId = 'cadence-review-v3'
const cadenceReviewPromptRevision = 'nighttrace-campaign-cadence-review-v3'
const cadenceReviewDirectory = resolve(
  workspaceDirectory,
  'reviews',
  cadenceReviewGenerationId,
)
const cadenceReviewStatePath = resolve(cadenceReviewDirectory, 'state.json')
const cadenceReviewStagedDirectory = resolve(cadenceReviewDirectory, 'staged')
const cadenceReviewManifestPath = resolve(cadenceReviewDirectory, 'staged-manifest.json')
const sampleRate = 24_000
const requestTimeoutMs = 75_000
const fileReplaceRetries = 8
const stateSchemaVersion = 1
const terminalStates = new Set([
  'BATCH_STATE_SUCCEEDED',
  'BATCH_STATE_FAILED',
  'BATCH_STATE_CANCELLED',
  'BATCH_STATE_EXPIRED',
  'JOB_STATE_SUCCEEDED',
  'JOB_STATE_FAILED',
  'JOB_STATE_CANCELLED',
  'JOB_STATE_EXPIRED',
])
const batchPollBackoffScheduleMs = Object.freeze([15_000, 30_000, 60_000, 120_000])

export function batchPollDelayMs(pollIndex) {
  const safeIndex = Number.isFinite(pollIndex)
    ? Math.max(0, Math.floor(pollIndex))
    : 0
  return batchPollBackoffScheduleMs[
    Math.min(safeIndex, batchPollBackoffScheduleMs.length - 1)
  ]
}

const standardPaceDirections = Object.freeze([
  'Use a confident conversational pace with compact natural pauses.',
  'Use a brisk cinematic cadence around 175 words per minute. Keep punctuation pauses under 120 milliseconds and do not draw out words.',
  'Use a very brisk but fully intelligible cinematic cadence around 195 words per minute. Keep punctuation pauses under 60 milliseconds, avoid drawn-out consonants or breath gaps, and finish decisively.',
])

const spaciousPaceDirections = Object.freeze([
  'Use a spacious, intimate mythic cadence with deliberate breath and natural silence. Let each emotional image land; never rush.',
  'Use an expressive cinematic cadence around 145 words per minute. Preserve one clear reflective pause, but tighten silence that does not serve the thought.',
  'Use a measured but compact cinematic cadence around 165 words per minute. Preserve emotional emphasis while completing the line cleanly.',
])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function paceDirections(line) {
  return line.delivery === 'spacious'
    ? spaciousPaceDirections
    : standardPaceDirections
}

export function buildGoogleSpeechPrompt(line, performanceAttempt = 0) {
  const directions = paceDirections(line)
  const pace = directions[performanceAttempt]
  if (!pace) {
    throw new Error(
      `${line.id} has exhausted all ${directions.length} directed performances.`,
    )
  }
  return [
    line.direction,
    pace,
    'Deliver natural cinematic speech with clear neutral English.',
    'Do not add, omit, paraphrase, sing, whisper, or produce sound effects.',
    `Finish comfortably within ${(cinematicVoiceWindowMs(line) / 1_000).toFixed(1)} seconds.`,
    `Speak only this quoted dialogue:\n\n"${line.text}"`,
  ].join(' ')
}

function requestForLine(line, performanceAttempt) {
  const request = {
    contents: [
      {
        parts: [{ text: buildGoogleSpeechPrompt(line, performanceAttempt) }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: line.voiceName },
        },
      },
    },
  }
  const contentSha256 = cinematicLineContentSha256(line)
  const requestSha256 = sha256(
    JSON.stringify({
      model: CINEMATIC_VOICE_MODEL,
      clipId: line.id,
      contentSha256,
      performanceAttempt,
      request,
    }),
  )
  return {
    request,
    metadata: {
      clipId: line.id,
      sceneId: line.sceneId,
      speaker: line.speaker,
      voiceName: line.voiceName,
      contentSha256,
      requestSha256,
      performanceAttempt,
    },
  }
}

export function buildInlineBatchPayload(
  lines,
  attemptsById = new Map(),
  displayName = 'nighttrace-cinematic-voice-pending',
) {
  const requests = lines.map((line) =>
    requestForLine(line, attemptsById.get(line.id) ?? 0),
  )
  const body = {
    batch: {
      displayName,
      inputConfig: { requests: { requests } },
    },
  }
  return {
    body,
    requests: requests.map(({ metadata }) => metadata),
    inputSha256: sha256(
      JSON.stringify({
        model: CINEMATIC_VOICE_MODEL,
        requests,
      }),
    ),
  }
}

export function spokenWordCount(text) {
  return text.match(/[A-Za-z0-9]+(?:[-'’][A-Za-z0-9]+)*/g)?.length ?? 0
}

function cadenceReviewContentSha256(line) {
  return cinematicLineContentSha256(line, {
    promptRevision: cadenceReviewPromptRevision,
  })
}

export function buildCadenceReviewPrompt(line, cadenceReview) {
  const speaker = cadenceReview.speakers[line.speaker]
  const durationTarget = cadenceReview.lineDurationTargetsMs[line.id]
  if (!speaker || !durationTarget) {
    throw new Error(`Missing cadence calibration for ${line.id}.`)
  }
  const performanceDirection =
    cadenceReview.directionOverrides[line.id] ?? line.direction
  const midpointMs = Math.round((durationTarget[0] + durationTarget[1]) / 2)
  return [
    performanceDirection,
    speaker.promptDirection,
    'Match the established performance rhythm organically; this is not a request for mechanical speed.',
    `Let the complete spoken line land naturally around ${(midpointMs / 1_000).toFixed(1)} seconds (acceptable range ${(durationTarget[0] / 1_000).toFixed(1)}-${(durationTarget[1] / 1_000).toFixed(1)} seconds), achieved through continuous phrasing, never by rushing or padding silence.`,
    'Keep breaths and pauses inside the spoken thought. Do not add trailer-style silence before, between, or after the words.',
    'Deliver natural cinematic speech with clear neutral English.',
    'Do not add, omit, paraphrase, sing, whisper, or produce sound effects.',
    `Speak exactly: ${JSON.stringify(line.text)}`,
  ].join('\n')
}

export function buildCadenceReviewBatchPayload(
  lines,
  cadenceReview,
  displayName = 'nighttrace-cadence-review-v3',
) {
  const requests = lines.map((line) => {
    const request = {
      contents: [
        { parts: [{ text: buildCadenceReviewPrompt(line, cadenceReview) }] },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: line.voiceName },
          },
        },
      },
    }
    const metadata = {
      clipId: line.id,
      sceneId: line.sceneId,
      speaker: line.speaker,
      voiceName: line.voiceName,
      contentSha256: cadenceReviewContentSha256(line),
      performanceAttempt: 0,
    }
    metadata.requestSha256 = sha256(
      JSON.stringify({
        model: CINEMATIC_VOICE_MODEL,
        generationId: cadenceReview.generationId,
        ...metadata,
        request,
      }),
    )
    return { request, metadata }
  })
  const body = {
    batch: {
      displayName,
      inputConfig: { requests: { requests } },
    },
  }
  return {
    body,
    requests: requests.map(({ metadata }) => metadata),
    inputSha256: sha256(
      JSON.stringify({
        model: CINEMATIC_VOICE_MODEL,
        generationId: cadenceReview.generationId,
        requests,
      }),
    ),
  }
}

function wrapPcmAsWav(pcm) {
  const channelCount = 1
  const bitsPerSample = 16
  const blockAlign = channelCount * (bitsPerSample / 8)
  const byteRate = sampleRate * blockAlign
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channelCount, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function trimOuterSilence(pcm) {
  if (!Buffer.isBuffer(pcm) || pcm.length === 0 || pcm.length % 2 !== 0) {
    throw new Error('Google returned an invalid 16-bit PCM payload.')
  }
  const sampleCount = pcm.length / 2
  const silenceThreshold = 180
  const paddingSamples = Math.round(sampleRate * 0.07)
  let firstAudible = 0
  let lastAudible = sampleCount - 1
  while (
    firstAudible < sampleCount &&
    Math.abs(pcm.readInt16LE(firstAudible * 2)) < silenceThreshold
  ) {
    firstAudible += 1
  }
  while (
    lastAudible > firstAudible &&
    Math.abs(pcm.readInt16LE(lastAudible * 2)) < silenceThreshold
  ) {
    lastAudible -= 1
  }
  if (firstAudible >= sampleCount) {
    throw new Error('Google returned a silent audio payload.')
  }
  const startSample = Math.max(0, firstAudible - paddingSamples)
  const endSample = Math.min(sampleCount, lastAudible + paddingSamples + 1)
  return pcm.subarray(startSample * 2, endSample * 2)
}

function decodeBase64Audio(data, label) {
  if (
    typeof data !== 'string' ||
    data.length === 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data) ||
    data.length % 4 !== 0
  ) {
    throw new Error(`${label} returned malformed base64 audio.`)
  }
  return Buffer.from(data, 'base64')
}

function inlineResponseArray(operation) {
  const candidates = [
    operation?.response?.output?.inlinedResponses?.inlinedResponses,
    operation?.response?.inlinedResponses?.inlinedResponses,
    operation?.response?.dest?.inlinedResponses,
  ].filter(Array.isArray)
  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one inline response array; found ${candidates.length}.`,
    )
  }
  return candidates[0]
}

export function decodeBatchOperation(operation, expectedRequests) {
  const expectedById = new Map(
    expectedRequests.map((request) => [request.clipId, request]),
  )
  if (expectedById.size !== expectedRequests.length) {
    throw new Error('Batch checkpoint contains duplicate request clip IDs.')
  }
  const responses = inlineResponseArray(operation)
  if (responses.length !== expectedRequests.length) {
    throw new Error(
      `Batch returned ${responses.length} responses for ${expectedRequests.length} requests.`,
    )
  }

  const decodedById = new Map()
  for (const inlineResponse of responses) {
    const metadata = inlineResponse?.metadata
    const clipId = metadata?.clipId
    const expected = expectedById.get(clipId)
    if (!expected || decodedById.has(clipId)) {
      throw new Error(`Batch returned unknown or duplicate clip metadata: ${String(clipId)}`)
    }
    for (const key of [
      'sceneId',
      'speaker',
      'voiceName',
      'contentSha256',
      'requestSha256',
    ]) {
      if (metadata[key] !== expected[key]) {
        throw new Error(`${clipId} batch metadata mismatch for ${key}.`)
      }
    }
    if (Number(metadata.performanceAttempt) !== expected.performanceAttempt) {
      throw new Error(`${clipId} batch metadata mismatch for performanceAttempt.`)
    }

    if (inlineResponse.error) {
      decodedById.set(clipId, {
        expected,
        error: {
          code: inlineResponse.error.code,
          message: String(inlineResponse.error.message ?? 'Unknown batch request error'),
        },
      })
      continue
    }

    const parts = inlineResponse?.response?.candidates?.[0]?.content?.parts
    const audioPart = Array.isArray(parts)
      ? parts.find((part) => (part.inlineData ?? part.inline_data)?.data)
      : undefined
    const inlineData = audioPart?.inlineData ?? audioPart?.inline_data
    const mimeType = inlineData?.mimeType ?? inlineData?.mime_type
    if (!inlineData?.data || !String(mimeType ?? '').toLowerCase().startsWith('audio/')) {
      decodedById.set(clipId, {
        expected,
        error: {
          code: 'NO_AUDIO_PAYLOAD',
          message: `${clipId} batch response contains no audio payload.`,
        },
      })
      continue
    }
    const pcm = trimOuterSilence(decodeBase64Audio(inlineData.data, clipId))
    const audio = wrapPcmAsWav(pcm)
    const durationMs = inspectCinematicWav(audio, `${clipId}.wav`)
    decodedById.set(clipId, { expected, audio, durationMs })
  }

  return expectedRequests.map((request) => decodedById.get(request.clipId))
}

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

export async function replaceCheckpointFile(destination, contents) {
  await mkdir(dirname(destination), { recursive: true })
  const temporary = `${destination}.partial`
  await writeFile(temporary, contents)
  let lastError
  for (let retryIndex = 0; retryIndex < fileReplaceRetries; retryIndex += 1) {
    try {
      await rename(temporary, destination)
      return
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY', 'EEXIST'].includes(error?.code)) throw error
      lastError = error
      await delay(Math.min(1_600, 50 * 2 ** retryIndex))
    }
  }
  try {
    await writeFile(destination, contents)
    await rm(temporary, { force: true })
  } catch (error) {
    throw new AggregateError(
      [lastError, error].filter(Boolean),
      `Unable to replace batch checkpoint file: ${destination}`,
    )
  }
}

export async function createFileWithoutOverwrite(destination, contents) {
  await mkdir(dirname(destination), { recursive: true })
  try {
    const existing = await readFile(destination)
    if (!existing.equals(contents)) {
      throw new Error(`Refusing to overwrite existing staged file: ${destination}`)
    }
    return 'reused'
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const temporary = `${destination}.${process.pid}.${randomUUID()}.partial`
  await writeFile(temporary, contents, { flag: 'wx' })
  try {
    try {
      await link(temporary, destination)
    } catch (error) {
      if (error?.code === 'EEXIST') {
        const existing = await readFile(destination)
        if (!existing.equals(contents)) {
          throw new Error(`Refusing to overwrite existing staged file: ${destination}`)
        }
        return 'reused'
      }
      if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) throw error
      await copyFile(temporary, destination, fsConstants.COPYFILE_EXCL)
    }
    return 'created'
  } finally {
    await rm(temporary, { force: true })
  }
}

async function readJson(path, { optional = false } = {}) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (optional && error?.code === 'ENOENT') return undefined
    throw error
  }
}

function validatePendingDefinition(plan, definition) {
  const overrides = validateCinematicVoicePlan(definition?.lineOverrides)
  const planById = new Map(plan.map((line) => [line.id, line]))
  for (const line of overrides) {
    const planned = planById.get(line.id)
    if (
      !planned ||
      cinematicLineContentSha256(planned) !== cinematicLineContentSha256(line)
    ) {
      throw new Error(`${line.id} pending definition does not match the live voice plan.`)
    }
  }
  return {
    lines: overrides,
    byId: new Map(overrides.map((line) => [line.id, line])),
    sha256: sha256(
      JSON.stringify(
        overrides.map((line) => ({
          id: line.id,
          contentSha256: cinematicLineContentSha256(line),
        })),
      ),
    ),
  }
}

function validateCadenceReview(value, pendingDefinition, inventory) {
  if (
    value?.schemaVersion !== 1 ||
    value.generationId !== cadenceReviewGenerationId ||
    value.source?.clipCount !== inventory.liveIds.size ||
    value.source?.manifestSha256 !== inventory.manifestSha256
  ) {
    throw new Error('Cadence review calibration does not match the 74-clip live source set.')
  }
  const targetIds = Object.keys(value.lineDurationTargetsMs ?? {})
  const expectedIds = pendingDefinition.lines.map((line) => line.id)
  if (
    targetIds.length !== expectedIds.length ||
    targetIds.some((id, index) => id !== expectedIds[index])
  ) {
    throw new Error('Cadence review must target exactly the ten approved refresh IDs.')
  }
  for (const line of pendingDefinition.lines) {
    const profile = value.speakers?.[line.speaker]
    const target = value.lineDurationTargetsMs[line.id]
    if (
      !profile ||
      profile.sampleCount < 1 ||
      !Array.isArray(profile.targetWpm) ||
      !Array.isArray(profile.acceptanceWpm) ||
      !Array.isArray(target) ||
      target.length !== 2 ||
      !target.every(Number.isInteger) ||
      target[0] < 800 ||
      target[1] <= target[0]
    ) {
      throw new Error(`Invalid cadence calibration for ${line.id}.`)
    }
  }
  return Object.freeze({
    ...value,
    sha256: sha256(JSON.stringify(value)),
  })
}

async function loadLiveInventory(plan, pendingById) {
  const manifestBuffer = await readFile(liveManifestPath)
  const manifest = JSON.parse(manifestBuffer.toString('utf8'))
  const wavById = new Map()
  for (const clip of manifest.clips ?? []) {
    wavById.set(clip.id, await readFile(resolve(liveAudioDirectory, `${clip.id}.wav`)))
  }
  const serviceWorker = await readFile(serviceWorkerPath, 'utf8')
  const revision = serviceWorker.match(
    /const CINEMATIC_VOICE_REVISION = '([^']+)'/,
  )?.[1]
  verifyCinematicVoiceSet({
    manifest,
    manifestBuffer,
    plan,
    wavById,
    serviceWorkerRevision: revision,
  })
  const liveIds = new Set(manifest.clips.map((clip) => clip.id))
  const missing = plan.filter((line) => !liveIds.has(line.id))
  const unexpected = missing.filter((line) => !pendingById.has(line.id))
  if (unexpected.length > 0) {
    throw new Error(
      `Live narration is missing clips outside the approved pending set: ${unexpected.map((line) => line.id).join(', ')}`,
    )
  }
  const physicalWavs = (await readdir(liveAudioDirectory)).filter((entry) =>
    entry.endsWith('.wav'),
  )
  return {
    manifest,
    manifestSha256: sha256(manifestBuffer),
    liveIds,
    missing,
    physicalWavCount: physicalWavs.length,
  }
}

function initialState(planSha256, pendingSha256) {
  const now = new Date().toISOString()
  return {
    schemaVersion: stateSchemaVersion,
    provider: CINEMATIC_VOICE_PROVIDER,
    model: CINEMATIC_VOICE_MODEL,
    promptRevision: CINEMATIC_VOICE_PROMPT_REVISION,
    set: CINEMATIC_VOICE_SET,
    planSha256,
    pendingSha256,
    createdAt: now,
    updatedAt: now,
    activeOperationName: null,
    attemptsById: {},
    stagedClips: [],
    jobs: [],
  }
}

function initialCadenceReviewState(planSha256, pendingSha256, cadenceSha256) {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    generationId: cadenceReviewGenerationId,
    provider: CINEMATIC_VOICE_PROVIDER,
    model: CINEMATIC_VOICE_MODEL,
    promptRevision: cadenceReviewPromptRevision,
    set: CINEMATIC_VOICE_SET,
    planSha256,
    pendingSha256,
    cadenceSha256,
    createdAt: now,
    updatedAt: now,
    activeOperationName: null,
    stagedClips: [],
    jobs: [],
  }
}

function validateCadenceReviewState(
  state,
  planSha256,
  pendingSha256,
  cadenceSha256,
) {
  if (
    state?.schemaVersion !== 1 ||
    state.generationId !== cadenceReviewGenerationId ||
    state.provider !== CINEMATIC_VOICE_PROVIDER ||
    state.model !== CINEMATIC_VOICE_MODEL ||
    state.promptRevision !== cadenceReviewPromptRevision ||
    state.set !== CINEMATIC_VOICE_SET ||
    state.planSha256 !== planSha256 ||
    state.pendingSha256 !== pendingSha256 ||
    state.cadenceSha256 !== cadenceSha256 ||
    !Array.isArray(state.stagedClips) ||
    !Array.isArray(state.jobs)
  ) {
    throw new Error('Cadence review checkpoint does not match its isolated generation.')
  }
  return state
}

function validateState(state, planSha256, pendingSha256) {
  if (
    state.schemaVersion !== stateSchemaVersion ||
    state.provider !== CINEMATIC_VOICE_PROVIDER ||
    state.model !== CINEMATIC_VOICE_MODEL ||
    state.promptRevision !== CINEMATIC_VOICE_PROMPT_REVISION ||
    state.set !== CINEMATIC_VOICE_SET ||
    state.planSha256 !== planSha256 ||
    state.pendingSha256 !== pendingSha256 ||
    !Array.isArray(state.stagedClips) ||
    !Array.isArray(state.jobs) ||
    !state.attemptsById ||
    typeof state.attemptsById !== 'object'
  ) {
    throw new Error(
      'The local batch checkpoint does not match the current narration plan. Preserve it for audit, then start a new workspace explicitly.',
    )
  }
  return state
}

function stagedRelativePath(line) {
  return `staged/${line.id}.${cinematicLineContentSha256(line).slice(0, 16)}.wav`
}

async function validateStagedClips(state, pendingById) {
  const byId = new Map()
  for (const clip of state.stagedClips) {
    const line = pendingById.get(clip.id)
    const expectedRelativePath = line ? stagedRelativePath(line) : undefined
    if (
      !line ||
      byId.has(clip.id) ||
      clip.contentSha256 !== cinematicLineContentSha256(line) ||
      clip.relativePath !== expectedRelativePath
    ) {
      throw new Error(`Invalid staged clip checkpoint: ${String(clip?.id)}`)
    }
    const destination = resolve(workspaceDirectory, clip.relativePath)
    if (relative(workspaceDirectory, destination).startsWith('..')) {
      throw new Error(`Unsafe staged clip path: ${clip.relativePath}`)
    }
    const audio = await readFile(destination)
    const durationMs = inspectCinematicWav(audio, `${clip.id}.wav`)
    if (
      clip.bytes !== audio.length ||
      clip.durationMs !== durationMs ||
      clip.sha256 !== sha256(audio) ||
      durationMs > cinematicVoiceWindowMs(line)
    ) {
      throw new Error(`${clip.id} staged WAV does not match its checkpoint metadata.`)
    }
    byId.set(clip.id, clip)
  }
  return byId
}

function cadenceReviewRelativePath(line) {
  return `staged/${line.id}.${cadenceReviewContentSha256(line).slice(0, 16)}.wav`
}

function cadenceReviewCandidateRelativePath(line, operationName) {
  return `candidates/${line.id}.${cadenceReviewContentSha256(line).slice(0, 16)}.${sha256(operationName).slice(0, 10)}.wav`
}

function cadenceWpm(line, durationMs) {
  return Number(((spokenWordCount(line.text) * 60_000) / durationMs).toFixed(1))
}

export function assessCadenceReviewTake(line, durationMs, cadenceReview) {
  const cadence = cadenceWpm(line, durationMs)
  const durationTarget = cadenceReview.lineDurationTargetsMs[line.id]
  const speakerBand = cadenceReview.speakers[line.speaker].acceptanceWpm
  return {
    durationMs,
    cadenceWpm: cadence,
    durationTarget,
    speakerBand,
    durationMatch: durationMs >= durationTarget[0] && durationMs <= durationTarget[1],
    speakerBandMatch: cadence >= speakerBand[0] && cadence <= speakerBand[1],
  }
}

async function validateCadenceReviewStagedClips(
  state,
  pendingDefinition,
  cadenceReview,
) {
  const byId = new Map()
  for (const clip of state.stagedClips) {
    const line = pendingDefinition.byId.get(clip.id)
    const target = cadenceReview.lineDurationTargetsMs[clip.id]
    const expectedRelativePath = line ? cadenceReviewRelativePath(line) : undefined
    if (
      !line ||
      !target ||
      byId.has(clip.id) ||
      clip.contentSha256 !== cadenceReviewContentSha256(line) ||
      clip.relativePath !== expectedRelativePath
    ) {
      throw new Error(`Invalid cadence review clip checkpoint: ${String(clip?.id)}`)
    }
    const destination = resolve(cadenceReviewDirectory, clip.relativePath)
    if (relative(cadenceReviewDirectory, destination).startsWith('..')) {
      throw new Error(`Unsafe cadence review clip path: ${clip.relativePath}`)
    }
    const audio = await readFile(destination)
    const durationMs = inspectCinematicWav(audio, `${clip.id}.wav`)
    const assessment = assessCadenceReviewTake(line, durationMs, cadenceReview)
    if (
      clip.bytes !== audio.length ||
      clip.durationMs !== durationMs ||
      clip.sha256 !== sha256(audio) ||
      clip.cadenceWpm !== assessment.cadenceWpm ||
      clip.speakerBandMatch !== assessment.speakerBandMatch ||
      !assessment.durationMatch
    ) {
      throw new Error(`${clip.id} cadence review WAV failed its checkpoint contract.`)
    }
    byId.set(clip.id, clip)
  }
  return byId
}

async function writeState(state, inventory, pendingDefinition) {
  state.updatedAt = new Date().toISOString()
  await mkdir(workspaceDirectory, { recursive: true })
  await replaceCheckpointFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
  const stagedById = new Set(state.stagedClips.map((clip) => clip.id))
  const stillPending = inventory.missing
    .filter((line) => !stagedById.has(line.id))
    .map((line) => line.id)
  const stagedManifest = {
    status: stillPending.length === 0 ? 'staged-ready' : 'staged-partial',
    provider: CINEMATIC_VOICE_PROVIDER,
    model: CINEMATIC_VOICE_MODEL,
    promptRevision: CINEMATIC_VOICE_PROMPT_REVISION,
    set: CINEMATIC_VOICE_SET,
    planSha256: state.planSha256,
    pendingSha256: pendingDefinition.sha256,
    liveManifestSha256: inventory.manifestSha256,
    liveReusableClipCount: inventory.liveIds.size,
    physicalLiveWavCount: inventory.physicalWavCount,
    stagedClipCount: state.stagedClips.length,
    stillPending,
    updatedAt: state.updatedAt,
    clips: state.stagedClips,
  }
  await replaceCheckpointFile(
    stagedManifestPath,
    `${JSON.stringify(stagedManifest, null, 2)}\n`,
  )
}

async function writeCadenceReviewState(
  state,
  inventory,
  pendingDefinition,
  cadenceReview,
) {
  state.updatedAt = new Date().toISOString()
  await replaceCheckpointFile(
    cadenceReviewStatePath,
    `${JSON.stringify(state, null, 2)}\n`,
  )
  const stagedById = new Set(state.stagedClips.map((clip) => clip.id))
  const stillPending = pendingDefinition.lines
    .filter((line) => !stagedById.has(line.id))
    .map((line) => line.id)
  const manifest = {
    status: stillPending.length === 0 ? 'review-ready' : 'review-partial',
    generationId: cadenceReviewGenerationId,
    provider: CINEMATIC_VOICE_PROVIDER,
    model: CINEMATIC_VOICE_MODEL,
    promptRevision: cadenceReviewPromptRevision,
    sourceLiveClipCount: inventory.liveIds.size,
    sourceManifestSha256: inventory.manifestSha256,
    cadenceSha256: cadenceReview.sha256,
    stagedClipCount: state.stagedClips.length,
    stillPending,
    updatedAt: state.updatedAt,
    clips: state.stagedClips,
  }
  await replaceCheckpointFile(
    cadenceReviewManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
}

function operationState(operation) {
  if (typeof operation?.metadata?.state === 'string') return operation.metadata.state
  if (typeof operation?.response?.state === 'string') return operation.response.state
  if (typeof operation?.metadata?.batch?.state === 'string') {
    return operation.metadata.batch.state
  }
  if (operation?.done && operation?.error) return 'BATCH_STATE_FAILED'
  if (operation?.done) return 'BATCH_STATE_SUCCEEDED'
  return 'BATCH_STATE_UNSPECIFIED'
}

function validateOperationName(name) {
  if (typeof name !== 'string' || !/^batches\/[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(`Google returned an invalid batch operation name: ${String(name)}`)
  }
  return name
}

async function requestGoogle(path, apiKey, options = {}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${path}`,
    {
      ...options,
      headers: {
        'x-goog-api-key': apiKey,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(requestTimeoutMs),
    },
  )
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Google Batch API failed: ${response.status} ${body.slice(0, 500)}`)
  }
  try {
    return JSON.parse(body)
  } catch {
    throw new Error('Google Batch API returned malformed JSON.')
  }
}

function activeJob(state) {
  if (!state.activeOperationName) return undefined
  const job = state.jobs.find(
    (candidate) => candidate.operationName === state.activeOperationName,
  )
  if (!job) throw new Error('Batch checkpoint references an unknown active operation.')
  return job
}

function pendingLines(inventory, stagedById) {
  return inventory.missing.filter((line) => !stagedById.has(line.id))
}

function localSummary(inventory, stagedById, state) {
  const pending = pendingLines(inventory, stagedById)
  return {
    liveReusable: inventory.liveIds.size,
    physicalLiveWavs: inventory.physicalWavCount,
    staged: stagedById.size,
    pending: pending.map((line) => line.id),
    activeOperationName: state.activeOperationName,
  }
}

async function submitBatch({ plan, pendingDefinition, inventory, state, apiKey }) {
  const stagedById = await validateStagedClips(state, pendingDefinition.byId)
  const job = activeJob(state)
  if (job) {
    throw new Error(
      `Batch ${job.operationName} is already active. Run status or resume instead of submitting a duplicate.`,
    )
  }
  const pending = pendingLines(inventory, stagedById)
  if (pending.length === 0) {
    console.log('All ten refreshed takes are already staged. No batch was submitted.')
    return
  }
  const attemptsById = new Map(
    pending.map((line) => [line.id, Number(state.attemptsById[line.id] ?? 0)]),
  )
  for (const [id, attempt] of attemptsById) {
    if (!Number.isInteger(attempt) || attempt < 0 || attempt >= paceDirections(pendingDefinition.byId.get(id)).length) {
      throw new Error(`${id} has no remaining automatic performance direction.`)
    }
  }
  const displayName = `nighttrace-voice-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`
  const batch = buildInlineBatchPayload(pending, attemptsById, displayName)
  const operation = await requestGoogle(
    `models/${CINEMATIC_VOICE_MODEL}:batchGenerateContent`,
    apiKey,
    { method: 'POST', body: JSON.stringify(batch.body) },
  )
  const operationName = validateOperationName(operation.name)
  const now = new Date().toISOString()
  state.jobs.push({
    operationName,
    displayName,
    inputSha256: batch.inputSha256,
    submittedAt: now,
    lastCheckedAt: now,
    state: operationState(operation),
    requests: batch.requests,
    results: [],
  })
  state.activeOperationName = operationName
  await writeState(state, inventory, pendingDefinition)
  console.log(
    `Submitted ${batch.requests.length} pending clips as ${operationName}. Run -Mode Status or -Mode Resume later.`,
  )
}

async function fetchActiveOperation(state, apiKey) {
  const job = activeJob(state)
  if (!job) throw new Error('There is no active batch operation in the local checkpoint.')
  const operation = await requestGoogle(validateOperationName(job.operationName), apiKey)
  job.state = operationState(operation)
  job.lastCheckedAt = new Date().toISOString()
  return { job, operation }
}

async function checkStatus({ state, inventory, pendingDefinition, apiKey }) {
  const { job, operation } = await fetchActiveOperation(state, apiKey)
  await writeState(state, inventory, pendingDefinition)
  console.log(
    `${job.operationName}: ${job.state}${operation.done ? ' (terminal)' : ''}. No WAV was written.`,
  )
}

async function processTerminalBatchOperation({
  state,
  inventory,
  pendingDefinition,
  job,
  operation,
}) {
  if (!terminalStates.has(job.state) && !operation.done) {
    throw new Error(`Cannot process non-terminal batch ${job.operationName}.`)
  }
  if (operation.error || !/_(?:SUCCEEDED)$/.test(job.state)) {
    job.processedAt = new Date().toISOString()
    job.results = job.requests.map((request) => ({
      id: request.clipId,
      status: 'batch-failed',
      message: String(operation.error?.message ?? job.state),
    }))
    state.activeOperationName = null
    await writeState(state, inventory, pendingDefinition)
    throw new Error(
      `${job.operationName} ended as ${job.state}. Its checkpoint is preserved; submit can retry only the still-pending clips.`,
    )
  }

  const decoded = decodeBatchOperation(operation, job.requests)
  const stagedById = await validateStagedClips(state, pendingDefinition.byId)
  for (const result of decoded) {
    const line = pendingDefinition.byId.get(result.expected.clipId)
    if (result.error) {
      job.results = [
        ...job.results.filter((entry) => entry.id !== line.id),
        { id: line.id, status: 'request-failed', ...result.error },
      ]
      await writeState(state, inventory, pendingDefinition)
      continue
    }
    state.attemptsById[line.id] = Math.max(
      Number(state.attemptsById[line.id] ?? 0),
      result.expected.performanceAttempt + 1,
    )
    if (result.durationMs > cinematicVoiceWindowMs(line)) {
      job.results = [
        ...job.results.filter((entry) => entry.id !== line.id),
        {
          id: line.id,
          status: 'too-long',
          durationMs: result.durationMs,
          maximumMs: cinematicVoiceWindowMs(line),
        },
      ]
      await writeState(state, inventory, pendingDefinition)
      continue
    }

    const relativePath = stagedRelativePath(line)
    const destination = resolve(workspaceDirectory, relativePath)
    await createFileWithoutOverwrite(destination, result.audio)
    const clip = {
      id: line.id,
      sceneId: line.sceneId,
      speaker: line.speaker,
      voiceName: line.voiceName,
      contentSha256: cinematicLineContentSha256(line),
      durationMs: result.durationMs,
      bytes: result.audio.length,
      sha256: sha256(result.audio),
      relativePath,
      operationName: job.operationName,
      requestSha256: result.expected.requestSha256,
      performanceAttempt: result.expected.performanceAttempt,
    }
    stagedById.set(line.id, clip)
    state.stagedClips = pendingDefinition.lines.flatMap((pendingLine) => {
      const staged = stagedById.get(pendingLine.id)
      return staged ? [staged] : []
    })
    job.results = [
      ...job.results.filter((entry) => entry.id !== line.id),
      { id: line.id, status: 'staged', sha256: clip.sha256 },
    ]
    await writeState(state, inventory, pendingDefinition)
    console.log(`${line.id}: staged ${clip.durationMs}ms without touching live WAVs.`)
  }
  job.processedAt = new Date().toISOString()
  state.activeOperationName = null
  await writeState(state, inventory, pendingDefinition)
  const stillPending = pendingLines(inventory, stagedById)
  console.log(
    `Batch resume complete: ${stagedById.size}/10 staged; ${stillPending.length} still pending. Live narration remains unchanged.`,
  )
}

async function resumeBatch({ state, inventory, pendingDefinition, apiKey }) {
  const { job, operation } = await fetchActiveOperation(state, apiKey)
  if (!terminalStates.has(job.state) && !operation.done) {
    await writeState(state, inventory, pendingDefinition)
    console.log(`${job.operationName}: ${job.state}. Nothing is ready to stage yet.`)
    return
  }
  await processTerminalBatchOperation({
    state,
    inventory,
    pendingDefinition,
    job,
    operation,
  })
}

async function watchBatch({ state, inventory, pendingDefinition, apiKey }) {
  let pollIndex = 0
  while (true) {
    const { job, operation } = await fetchActiveOperation(state, apiKey)
    if (terminalStates.has(job.state) || operation.done) {
      console.log(`${job.operationName}: ${job.state} (terminal). Validating results.`)
      await processTerminalBatchOperation({
        state,
        inventory,
        pendingDefinition,
        job,
        operation,
      })
      return
    }

    await writeState(state, inventory, pendingDefinition)
    const waitMs = batchPollDelayMs(pollIndex)
    console.log(`Batch watch: ${job.state}; next check in ${waitMs / 1_000}s.`)
    await delay(waitMs)
    pollIndex += 1
  }
}

function activeCadenceReviewJob(state) {
  if (!state.activeOperationName) return undefined
  const job = state.jobs.find(
    (candidate) => candidate.operationName === state.activeOperationName,
  )
  if (!job) throw new Error('Cadence review checkpoint references an unknown batch.')
  return job
}

export function recoverableCadenceReviewJob(state) {
  return state.jobs
    .toReversed()
    .find(
      (job) =>
        /_(?:SUCCEEDED)$/.test(job.state) &&
        job.results?.some(
          (result) =>
            ['cadence-outlier', 'review-staged'].includes(result.status) &&
            !result.candidateRelativePath,
        ),
    )
}

async function processCadenceReviewOperation({
  state,
  inventory,
  pendingDefinition,
  cadenceReview,
  job,
  operation,
}) {
  if (operation.error || !/_(?:SUCCEEDED)$/.test(job.state)) {
    job.processedAt = new Date().toISOString()
    job.results = job.requests.map((request) => ({
      id: request.clipId,
      status: 'batch-failed',
      message: String(operation.error?.message ?? job.state),
    }))
    state.activeOperationName = null
    await writeCadenceReviewState(
      state,
      inventory,
      pendingDefinition,
      cadenceReview,
    )
    throw new Error(`${job.operationName} ended as ${job.state}.`)
  }

  const decoded = decodeBatchOperation(operation, job.requests)
  const stagedById = await validateCadenceReviewStagedClips(
    state,
    pendingDefinition,
    cadenceReview,
  )
  for (const result of decoded) {
    const line = pendingDefinition.byId.get(result.expected.clipId)
    if (result.error) {
      job.results = [
        ...job.results.filter((entry) => entry.id !== line.id),
        { id: line.id, status: 'request-failed', ...result.error },
      ]
      await writeCadenceReviewState(
        state,
        inventory,
        pendingDefinition,
        cadenceReview,
      )
      continue
    }
    const assessment = assessCadenceReviewTake(
      line,
      result.durationMs,
      cadenceReview,
    )
    const candidateRelativePath = cadenceReviewCandidateRelativePath(
      line,
      job.operationName,
    )
    const candidateDestination = resolve(
      cadenceReviewDirectory,
      candidateRelativePath,
    )
    await createFileWithoutOverwrite(candidateDestination, result.audio)
    const candidateSha256 = sha256(result.audio)
    if (!assessment.durationMatch) {
      job.results = [
        ...job.results.filter((entry) => entry.id !== line.id),
        {
          id: line.id,
          status: 'cadence-outlier',
          durationMs: result.durationMs,
          cadenceWpm: assessment.cadenceWpm,
          targetDurationMs: assessment.durationTarget,
          speakerBand: assessment.speakerBand,
          speakerBandMatch: assessment.speakerBandMatch,
          candidateRelativePath,
          candidateSha256,
        },
      ]
      await writeCadenceReviewState(
        state,
        inventory,
        pendingDefinition,
        cadenceReview,
      )
      continue
    }

    const relativePath = cadenceReviewRelativePath(line)
    const destination = resolve(cadenceReviewDirectory, relativePath)
    await createFileWithoutOverwrite(destination, result.audio)
    const clip = {
      id: line.id,
      sceneId: line.sceneId,
      speaker: line.speaker,
      voiceName: line.voiceName,
      contentSha256: cadenceReviewContentSha256(line),
      durationMs: result.durationMs,
      cadenceWpm: assessment.cadenceWpm,
      targetDurationMs: assessment.durationTarget,
      speakerBand: assessment.speakerBand,
      speakerBandMatch: assessment.speakerBandMatch,
      bytes: result.audio.length,
      sha256: sha256(result.audio),
      relativePath,
      operationName: job.operationName,
      requestSha256: result.expected.requestSha256,
    }
    stagedById.set(line.id, clip)
    state.stagedClips = pendingDefinition.lines.flatMap((pendingLine) => {
      const staged = stagedById.get(pendingLine.id)
      return staged ? [staged] : []
    })
    job.results = [
      ...job.results.filter((entry) => entry.id !== line.id),
      {
        id: line.id,
        status: 'review-staged',
        durationMs: clip.durationMs,
        cadenceWpm: clip.cadenceWpm,
        sha256: clip.sha256,
        candidateRelativePath,
        candidateSha256,
      },
    ]
    await writeCadenceReviewState(
      state,
      inventory,
      pendingDefinition,
      cadenceReview,
    )
    console.log(
      `${line.id}: review-staged ${clip.durationMs}ms / ${clip.cadenceWpm} WPM.`,
    )
  }
  job.processedAt = new Date().toISOString()
  state.activeOperationName = null
  await writeCadenceReviewState(
    state,
    inventory,
    pendingDefinition,
    cadenceReview,
  )
  console.log(
    `Cadence review complete: ${state.stagedClips.length}/10 passed into the isolated review. Live and prior staged WAVs remain unchanged.`,
  )
}

async function watchCadenceReview({
  state,
  inventory,
  pendingDefinition,
  cadenceReview,
  apiKey,
}) {
  let pollIndex = 0
  while (true) {
    const job = activeCadenceReviewJob(state)
    if (!job) throw new Error('Cadence review has no active batch to watch.')
    const operation = await requestGoogle(validateOperationName(job.operationName), apiKey)
    job.state = operationState(operation)
    job.lastCheckedAt = new Date().toISOString()
    if (terminalStates.has(job.state) || operation.done) {
      console.log(`${job.operationName}: ${job.state} (terminal). Validating review.`)
      await processCadenceReviewOperation({
        state,
        inventory,
        pendingDefinition,
        cadenceReview,
        job,
        operation,
      })
      return
    }
    await writeCadenceReviewState(
      state,
      inventory,
      pendingDefinition,
      cadenceReview,
    )
    const waitMs = batchPollDelayMs(pollIndex)
    console.log(`Cadence review: ${job.state}; next check in ${waitMs / 1_000}s.`)
    await delay(waitMs)
    pollIndex += 1
  }
}

async function submitAndWatchCadenceReview({
  state,
  inventory,
  pendingDefinition,
  cadenceReview,
  apiKey,
}) {
  let job = activeCadenceReviewJob(state)
  if (!job) {
    job = recoverableCadenceReviewJob(state)
    if (job) {
      state.activeOperationName = job.operationName
      await writeCadenceReviewState(
        state,
        inventory,
        pendingDefinition,
        cadenceReview,
      )
      console.log(
        `Recovering isolated candidate WAVs from completed cadence review ${job.operationName}; no new generation request will be submitted.`,
      )
    }
  }
  if (!job) {
    const stagedById = await validateCadenceReviewStagedClips(
      state,
      pendingDefinition,
      cadenceReview,
    )
    const pending = pendingDefinition.lines.filter((line) => !stagedById.has(line.id))
    if (pending.length === 0) {
      console.log('All ten cadence-review takes are already staged.')
      return
    }
    const displayName = `nighttrace-${cadenceReviewGenerationId}-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`
    const batch = buildCadenceReviewBatchPayload(
      pending,
      cadenceReview,
      displayName,
    )
    await writeCadenceReviewState(
      state,
      inventory,
      pendingDefinition,
      cadenceReview,
    )
    const operation = await requestGoogle(
      `models/${CINEMATIC_VOICE_MODEL}:batchGenerateContent`,
      apiKey,
      { method: 'POST', body: JSON.stringify(batch.body) },
    )
    const operationName = validateOperationName(operation.name)
    console.log(
      `Google accepted isolated ${cadenceReviewGenerationId} as ${operationName}; persisting its local checkpoint.`,
    )
    const now = new Date().toISOString()
    job = {
      operationName,
      displayName,
      inputSha256: batch.inputSha256,
      submittedAt: now,
      lastCheckedAt: now,
      state: operationState(operation),
      requests: batch.requests,
      results: [],
    }
    state.jobs.push(job)
    state.activeOperationName = operationName
    await writeCadenceReviewState(
      state,
      inventory,
      pendingDefinition,
      cadenceReview,
    )
    console.log(
      `Submitted isolated ${cadenceReviewGenerationId} with ${batch.requests.length} requests as ${operationName}.`,
    )
  } else {
    console.log(`Continuing isolated cadence review ${job.operationName}.`)
  }
  await watchCadenceReview({
    state,
    inventory,
    pendingDefinition,
    cadenceReview,
    apiKey,
  })
}

function usage() {
  return [
    'Usage: node scripts/render-cinematic-voices-batch.mjs [options]',
    '',
    '  --mode submit   Submit only current approved pending clips (default).',
    '  --mode status   Fetch one status update; never writes WAVs.',
    '  --mode resume   Fetch once and stage completed, validated results.',
    '  --mode watch    Poll the active batch and stage validated results when terminal.',
    '  --mode review-auto  Submit and watch the isolated cadence-review-v3 generation.',
    '  --dry-run       Validate and print the local plan; no key, network or writes.',
    '  --help          Print this help.',
    '',
    'Generated takes are staged under .cinematic-voice-batch/. Existing live WAVs are never overwritten.',
  ].join('\n')
}

function parseArguments(argv) {
  const options = { mode: 'submit', dryRun: false, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--mode') {
      options.mode = argv[index + 1]
      index += 1
    } else if (argument.startsWith('--mode=')) {
      options.mode = argument.slice('--mode='.length)
    } else {
      throw new Error(`Unknown argument: ${argument}\n\n${usage()}`)
    }
  }
  if (!['submit', 'status', 'resume', 'watch', 'review-auto'].includes(options.mode)) {
    throw new Error(`Unknown batch mode: ${String(options.mode)}`)
  }
  return options
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  const plan = validateCinematicVoicePlan(await readJson(planPath))
  const pendingDefinition = validatePendingDefinition(
    plan,
    await readJson(pendingDefinitionPath),
  )
  const inventory = await loadLiveInventory(plan, pendingDefinition.byId)
  const planHash = cinematicPlanSha256(plan)
  if (options.mode === 'review-auto') {
    const cadenceReview = validateCadenceReview(
      await readJson(cadenceReviewPath),
      pendingDefinition,
      inventory,
    )
    const existingReviewState = await readJson(cadenceReviewStatePath, {
      optional: true,
    })
    const reviewState = existingReviewState
      ? validateCadenceReviewState(
          existingReviewState,
          planHash,
          pendingDefinition.sha256,
          cadenceReview.sha256,
        )
      : initialCadenceReviewState(
          planHash,
          pendingDefinition.sha256,
          cadenceReview.sha256,
        )
    const reviewStagedById = await validateCadenceReviewStagedClips(
      reviewState,
      pendingDefinition,
      cadenceReview,
    )
    const reviewPending = pendingDefinition.lines.filter(
      (line) => !reviewStagedById.has(line.id),
    )
    const oldAuditState = await readJson(statePath, { optional: true })
    console.log(
      `Cadence review ${cadenceReviewGenerationId}: ${inventory.liveIds.size} live preserved; ${oldAuditState?.stagedClips?.length ?? 0} prior staged preserved; ${reviewStagedById.size} new review staged; ${reviewPending.length} pending.`,
    )
    for (const [speaker, profile] of Object.entries(cadenceReview.speakers)) {
      console.log(
        `${speaker}: ${profile.sampleCount} accepted references; target ${profile.targetWpm.join('-')} WPM; acceptance ${profile.acceptanceWpm.join('-')} WPM.`,
      )
    }
    const priorReviewById = new Map(
      (oldAuditState?.stagedClips ?? []).map((clip) => [clip.id, clip]),
    )
    for (const line of pendingDefinition.lines) {
      const prior = priorReviewById.get(line.id)
      if (!prior) {
        console.log(`Prior ${line.id}: no staged comparison take.`)
        continue
      }
      const assessment = assessCadenceReviewTake(
        line,
        prior.durationMs,
        cadenceReview,
      )
      console.log(
        `Prior ${line.id}: ${assessment.durationMs}ms / ${assessment.cadenceWpm} WPM; speaker band ${assessment.speakerBandMatch ? 'match' : 'miss'}; duration target ${assessment.durationMatch ? 'match' : 'miss'}.`,
      )
    }
    if (options.dryRun) {
      if (reviewState.activeOperationName) {
        console.log(`Would continue and watch ${reviewState.activeOperationName}.`)
      } else if (recoverableCadenceReviewJob(reviewState)) {
        console.log(
          `Would recover isolated candidate WAVs from ${recoverableCadenceReviewJob(reviewState).operationName}; no new generation request would be submitted.`,
        )
      } else if (reviewPending.length > 0) {
        const preview = buildCadenceReviewBatchPayload(
          reviewPending,
          cadenceReview,
        )
        console.log(
          `Would submit and watch ${preview.requests.length} isolated requests to ${CINEMATIC_VOICE_MODEL}; input SHA-256 ${preview.inputSha256}.`,
        )
        console.log(`Review IDs: ${preview.requests.map((entry) => entry.clipId).join(', ')}`)
      } else {
        console.log('All ten cadence-review takes are already staged.')
      }
      console.log(
        `Review output stays isolated under ${relative(root, cadenceReviewDirectory)}. No API request or file write was made.`,
      )
      return
    }
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is required. Use render-cinematic-voices-batch.ps1 -Mode Review for a masked, non-persistent prompt.',
      )
    }
    await submitAndWatchCadenceReview({
      state: reviewState,
      inventory,
      pendingDefinition,
      cadenceReview,
      apiKey,
    })
    return
  }
  const existingState = await readJson(statePath, { optional: true })
  const state = existingState
    ? validateState(existingState, planHash, pendingDefinition.sha256)
    : initialState(planHash, pendingDefinition.sha256)
  const stagedById = await validateStagedClips(state, pendingDefinition.byId)
  const summary = localSummary(inventory, stagedById, state)
  console.log(
    `Cinematic batch plan: ${summary.liveReusable} live reusable; ${summary.staged} staged; ${summary.pending.length} pending.`,
  )
  console.log(`Pending IDs: ${summary.pending.join(', ') || '(none)'}`)
  if (summary.physicalLiveWavs > summary.liveReusable) {
    console.log(
      `Safety note: ${summary.physicalLiveWavs - summary.liveReusable} stale physical WAVs are outside the current manifest and will not be overwritten.`,
    )
  }
  if (options.dryRun) {
    if (options.mode === 'submit' && summary.pending.length > 0) {
      const pending = pendingLines(inventory, stagedById)
      const attempts = new Map(
        pending.map((line) => [line.id, Number(state.attemptsById[line.id] ?? 0)]),
      )
      const preview = buildInlineBatchPayload(pending, attempts)
      console.log(
        `Would submit ${preview.requests.length} inline requests to ${CINEMATIC_VOICE_MODEL}; input SHA-256 ${preview.inputSha256}.`,
      )
    } else {
      console.log(
        `Local active operation: ${summary.activeOperationName ?? '(none)'}.`,
      )
    }
    console.log('Dry run complete. No API request was made and no file was written.')
    return
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is required. Use render-cinematic-voices-batch.ps1 for a masked, non-persistent prompt.',
    )
  }
  if (options.mode === 'submit') {
    await submitBatch({ plan, pendingDefinition, inventory, state, apiKey })
  } else if (options.mode === 'status') {
    await checkStatus({ state, inventory, pendingDefinition, apiKey })
  } else if (options.mode === 'resume') {
    await resumeBatch({ state, inventory, pendingDefinition, apiKey })
  } else {
    await watchBatch({ state, inventory, pendingDefinition, apiKey })
  }
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) await main()
