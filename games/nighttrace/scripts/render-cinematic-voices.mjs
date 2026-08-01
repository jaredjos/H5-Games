import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CINEMATIC_VOICE_MODEL,
  CINEMATIC_VOICE_PROMPT_REVISION,
  CINEMATIC_VOICE_PROVIDER,
  CINEMATIC_VOICE_SET,
  cinematicLineContentSha256,
  cinematicManifestRevision,
  cinematicPlanSha256,
  cinematicVoiceWindowMs,
  inspectCinematicWav,
  validateCinematicVoicePlan,
} from './cinematic-voice-integrity.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const planPath = resolve(root, 'src/story/cinematicVoicePlan.json')
const outputDirectory = resolve(root, 'public/assets/cinematics/audio/campaign')
const manifestPath = resolve(outputDirectory, 'manifest.json')
const serviceWorkerPath = resolve(root, 'public/sw.js')
const sampleRate = 24_000
const requestSpacingMs = 7_000
const requestTimeoutMs = 75_000
const maximumRequestRetries = 4
const fileReplaceRetries = 8

const paceDirections = [
  'Use a confident conversational pace with compact natural pauses.',
  'Use a brisk cinematic cadence around 175 words per minute. Keep punctuation pauses under 120 milliseconds and do not draw out words.',
  'Use a very brisk but fully intelligible cinematic cadence around 195 words per minute. Keep punctuation pauses under 60 milliseconds, avoid drawn-out consonants or breath gaps, and finish decisively.',
]

function usage() {
  return [
    'Usage: node scripts/render-cinematic-voices.mjs [options]',
    '',
    '  --dry-run          Validate and report without requiring a key or writing files.',
    '  --force            Regenerate selected clips even when their content hash matches.',
    '  --scene <sceneId>  Render only one scene. Repeat to select multiple scenes.',
    '  --help             Print this help.',
  ].join('\n')
}

function parseArguments(argv) {
  const options = { dryRun: false, force: false, scenes: new Set(), help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--force') options.force = true
    else if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--scene') {
      const sceneId = argv[index + 1]
      if (!sceneId || sceneId.startsWith('--')) {
        throw new Error('--scene requires a scene id.')
      }
      options.scenes.add(sceneId)
      index += 1
    } else if (argument.startsWith('--scene=')) {
      const sceneId = argument.slice('--scene='.length)
      if (!sceneId) throw new Error('--scene requires a scene id.')
      options.scenes.add(sceneId)
    } else {
      throw new Error(`Unknown argument: ${argument}\n\n${usage()}`)
    }
  }
  return options
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
  const sampleCount = Math.floor(pcm.length / 2)
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

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

async function replaceGeneratedFile(destination, contents) {
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

  // Windows scanners and dev servers can briefly retain a read handle to the
  // existing manifest/service worker. A direct replacement is the final safe
  // fallback; the completed WAV files remain the source of truth either way.
  try {
    await writeFile(destination, contents)
    await rm(temporary, { force: true })
  } catch (error) {
    throw new AggregateError(
      [lastError, error].filter(Boolean),
      `Unable to replace generated file: ${destination}`,
    )
  }
}

function retryDelayMs(response, retryIndex) {
  const maximumWaitMs = 90_000
  const retryAfter = response?.headers?.get('retry-after')?.trim()
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(maximumWaitMs, Math.ceil(seconds * 1_000))
    }
    const retryAt = Date.parse(retryAfter)
    if (Number.isFinite(retryAt)) {
      return Math.min(maximumWaitMs, Math.max(1_000, retryAt - Date.now()))
    }
  }
  return Math.min(maximumWaitMs, 5_000 * 2 ** retryIndex)
}

let lastRequestAt = 0

async function requestGoogleSpeech(line, performanceAttempt, ordinal, total, apiKey) {
  const elapsedSinceRequest = Date.now() - lastRequestAt
  if (elapsedSinceRequest < requestSpacingMs) {
    await delay(requestSpacingMs - elapsedSinceRequest)
  }

  for (let retryIndex = 0; retryIndex <= maximumRequestRetries; retryIndex += 1) {
    lastRequestAt = Date.now()
    console.log(
      `[${ordinal}/${total}] requesting ${line.id}, performance ${performanceAttempt + 1}, network attempt ${retryIndex + 1}.`,
    )

    let response
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${CINEMATIC_VOICE_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(requestTimeoutMs),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: [
                      line.direction,
                      paceDirections[performanceAttempt],
                      'Deliver natural cinematic speech with clear neutral English.',
                      'Do not add, omit, paraphrase, sing, whisper, or produce sound effects.',
                      `Finish comfortably within ${(cinematicVoiceWindowMs(line) / 1_000).toFixed(1)} seconds.`,
                      `Speak only this quoted dialogue:\n\n"${line.text}"`,
                    ].join(' '),
                  },
                ],
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
          }),
        },
      )
    } catch (error) {
      if (retryIndex === maximumRequestRetries) {
        const reason = error?.name === 'TimeoutError' ? 'timed out' : 'failed'
        throw new Error(
          `${line.id}: Google speech request ${reason} after ${maximumRequestRetries + 1} network attempts. Completed WAVs remain reusable.`,
        )
      }
      const waitMs = retryDelayMs(undefined, retryIndex)
      console.warn(`${line.id}: transient request failure; retrying in ${Math.ceil(waitMs / 1_000)}s.`)
      await delay(waitMs)
      continue
    }

    console.log(`[${ordinal}/${total}] ${line.id}: Google responded ${response.status}.`)
    if (response.ok) {
      const payload = await response.json()
      const part = payload.candidates?.[0]?.content?.parts?.find(
        (candidatePart) => candidatePart.inlineData?.data,
      )
      if (!part?.inlineData?.data) {
        throw new Error(`Google returned no audio payload for ${line.id}.`)
      }
      return trimOuterSilence(Buffer.from(part.inlineData.data, 'base64'))
    }

    const responseBody = await response.text()
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || retryIndex === maximumRequestRetries) {
      throw new Error(
        `Google speech generation failed for ${line.id}: ${response.status} ${responseBody.slice(0, 240)}`,
      )
    }
    const waitMs = retryDelayMs(response, retryIndex)
    console.warn(
      `${line.id}: Google is temporarily unavailable or rate-limited; retrying in ${Math.ceil(waitMs / 1_000)}s. Completed WAVs remain reusable.`,
    )
    await delay(waitMs)
  }

  throw new Error(`Google returned no usable response for ${line.id}.`)
}

function clipMetadata(line, audio, durationMs) {
  return {
    id: line.id,
    sceneId: line.sceneId,
    speaker: line.speaker,
    voiceName: line.voiceName,
    contentSha256: cinematicLineContentSha256(line),
    durationMs,
    bytes: audio.length,
    sha256: createHash('sha256').update(audio).digest('hex'),
  }
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return undefined
    throw error
  }
}

async function reusableClip(line, priorClip) {
  if (
    !priorClip ||
    priorClip.contentSha256 !== cinematicLineContentSha256(line) ||
    priorClip.sceneId !== line.sceneId ||
    priorClip.speaker !== line.speaker ||
    priorClip.voiceName !== line.voiceName
  ) {
    return undefined
  }

  try {
    const audio = await readFile(resolve(outputDirectory, `${line.id}.wav`))
    const durationMs = inspectCinematicWav(audio, `${line.id}.wav`)
    const sha256 = createHash('sha256').update(audio).digest('hex')
    if (
      durationMs > cinematicVoiceWindowMs(line) ||
      priorClip.durationMs !== durationMs ||
      priorClip.bytes !== audio.length ||
      priorClip.sha256 !== sha256
    ) {
      return undefined
    }
    return clipMetadata(line, audio, durationMs)
  } catch {
    return undefined
  }
}

async function renderLine(line, ordinal, total, apiKey) {
  let pcm
  let durationMs = Number.POSITIVE_INFINITY
  const voiceWindowMs = cinematicVoiceWindowMs(line)
  for (let attempt = 0; attempt < paceDirections.length; attempt += 1) {
    pcm = await requestGoogleSpeech(line, attempt, ordinal, total, apiKey)
    durationMs = Math.round((pcm.length / (sampleRate * 2)) * 1_000)
    if (durationMs <= voiceWindowMs) break
    console.log(
      `${line.id}: performance ${attempt + 1} was ${durationMs}ms; requesting a tighter take.`,
    )
  }
  if (!pcm || durationMs > voiceWindowMs) {
    throw new Error(
      `${line.id} exceeded its ${voiceWindowMs}ms narration window after ${paceDirections.length} directed performances.`,
    )
  }

  const audio = wrapPcmAsWav(pcm)
  const destination = resolve(outputDirectory, `${line.id}.wav`)
  await replaceGeneratedFile(destination, audio)
  return clipMetadata(line, audio, durationMs)
}

function manifestFor(plan, clipById) {
  const clips = plan.flatMap((line) => {
    const clip = clipById.get(line.id)
    return clip ? [clip] : []
  })
  const status =
    clips.length === 0
      ? 'pending-generation'
      : clips.length === plan.length
        ? 'ready'
        : 'partial'
  return {
    status,
    provider: CINEMATIC_VOICE_PROVIDER,
    model: CINEMATIC_VOICE_MODEL,
    promptRevision: CINEMATIC_VOICE_PROMPT_REVISION,
    set: CINEMATIC_VOICE_SET,
    expectedClipCount: plan.length,
    planSha256: cinematicPlanSha256(plan),
    generatedAt: new Date().toISOString(),
    clips,
  }
}

async function updateServiceWorkerRevision(manifestContents) {
  const revision = cinematicManifestRevision(Buffer.from(manifestContents))
  const source = await readFile(serviceWorkerPath, 'utf8')
  const revisionPattern = /const CINEMATIC_VOICE_REVISION = '[^']*'/
  if (!revisionPattern.test(source)) {
    throw new Error('Unable to locate CINEMATIC_VOICE_REVISION in public/sw.js.')
  }
  const updated = source.replace(
    revisionPattern,
    `const CINEMATIC_VOICE_REVISION = '${revision}'`,
  )
  await replaceGeneratedFile(serviceWorkerPath, updated)
  return revision
}

async function writeCheckpoint(plan, clipById) {
  const manifest = manifestFor(plan, clipById)
  const contents = `${JSON.stringify(manifest, null, 2)}\n`
  await replaceGeneratedFile(manifestPath, contents)
  const revision = await updateServiceWorkerRevision(contents)
  return { manifest, revision }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const plan = validateCinematicVoicePlan(
    JSON.parse(await readFile(planPath, 'utf8')),
  )
  const knownScenes = new Set(plan.map((line) => line.sceneId))
  for (const sceneId of options.scenes) {
    if (!knownScenes.has(sceneId)) {
      throw new Error(
        `Unknown scene '${sceneId}'. Available scenes: ${[...knownScenes].join(', ')}`,
      )
    }
  }
  const selected = plan.filter(
    (line) => options.scenes.size === 0 || options.scenes.has(line.sceneId),
  )

  const priorManifest = await readManifest()
  const priorClipById = new Map(
    Array.isArray(priorManifest?.clips)
      ? priorManifest.clips.map((clip) => [clip.id, clip])
      : [],
  )
  const clipById = new Map()
  for (const line of plan) {
    const clip = await reusableClip(line, priorClipById.get(line.id))
    if (clip) clipById.set(line.id, clip)
  }

  const selectedIds = new Set(selected.map((line) => line.id))
  const actions = plan.map((line) => ({
    line,
    action:
      selectedIds.has(line.id) && (options.force || !clipById.has(line.id))
        ? 'render'
        : clipById.has(line.id)
          ? 'reuse'
          : 'skip',
  }))
  const renderCount = actions.filter(({ action }) => action === 'render').length
  const reuseCount = actions.filter(({ action }) => action === 'reuse').length
  const skippedCount = actions.filter(({ action }) => action === 'skip').length

  console.log(
    `Cinematic narration plan: ${plan.length} lines across ${knownScenes.size} scenes; ${renderCount} render, ${reuseCount} reuse, ${skippedCount} unselected/missing.`,
  )
  for (const { line, action } of actions) {
    console.log(`${action.padEnd(6)} ${line.sceneId} / ${line.id}`)
  }
  if (options.dryRun) {
    console.log('Dry run complete. No API request was made and no file was written.')
    return
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is required. Use render-cinematic-voices.ps1 for a masked, non-persistent prompt.',
    )
  }

  await mkdir(outputDirectory, { recursive: true })
  try {
    let ordinal = 0
    for (const { line, action } of actions) {
      if (action !== 'render') continue
      ordinal += 1
      const clip = await renderLine(line, ordinal, renderCount, apiKey)
      clipById.set(line.id, clip)
      await writeCheckpoint(plan, clipById)
      console.log(`${line.id}: saved ${clip.durationMs}ms (${clip.bytes} bytes).`)
    }

    const { manifest, revision } = await writeCheckpoint(plan, clipById)
    console.log(
      `Cinematic narration manifest: ${manifest.status} (${manifest.clips.length}/${plan.length}); service-worker revision ${revision}.`,
    )
  } catch (error) {
    await rm(`${manifestPath}.partial`, { force: true })
    await rm(`${serviceWorkerPath}.partial`, { force: true })
    for (const entry of await readdir(outputDirectory)) {
      if (entry.endsWith('.partial')) {
        await rm(resolve(outputDirectory, entry), { force: true })
      }
    }
    await writeCheckpoint(plan, clipById)
    throw error
  }
}

await main()
