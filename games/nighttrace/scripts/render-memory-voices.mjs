import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiKey = process.env.GEMINI_API_KEY?.trim()
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is required in the current process.')
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const planPath = resolve(root, 'src/story/memoryVoicePlan.json')
const outputDirectory = resolve(
  root,
  'public/assets/cinematics/audio/memories',
)
const manifestPath = resolve(outputDirectory, 'manifest.json')
const serviceWorkerPath = resolve(root, 'public/sw.js')
const provider = 'Google Gemini API'
const model = 'gemini-3.1-flash-tts-preview'
const sampleRate = 24_000

const voiceBySpeaker = Object.freeze({
  'Last Star': 'Leda',
  Bearer: 'Orus',
  'Sun-Eater': 'Algenib',
  'Cartographer echo': 'Rasalgethi',
})

const directionBySpeaker = Object.freeze({
  'Last Star': [
    'Perform as the Last Star with a youthful young-adult feminine voice.',
    'Luminous, warm, intelligent and grounded; intimate cinematic dark-fantasy delivery.',
    'Clear neutral English with restrained feeling; never childish, breathy, theatrical, sing-song, or synthetic.',
  ].join(' '),
  Bearer: [
    'Perform as the Bearer with a young-adult masculine voice.',
    'Quietly resolute, humane and controlled; a battle-worn hero speaking to one trusted companion.',
    'Clear neutral English; never bombastic, growled, theatrical, or synthetic.',
  ].join(' '),
  'Sun-Eater': [
    'Perform as the Sun-Eater with a masculine voice.',
    'Controlled, ancient and ominous with precise diction and contained power.',
    'Keep every word intelligible; never shout, growl, whisper, overact, or add effects.',
  ].join(' '),
  'Cartographer echo': [
    'Perform as the Cartographer echo with a distinct mature and androgynous archival voice.',
    'Measured, lucid and haunted, like a recovered field recording without an electronic filter.',
    'Clear neutral English; never imitate the Sun-Eater and never add words or sound effects.',
  ].join(' '),
})

const paceDirections = [
  'Use a confident conversational pace with compact natural pauses.',
  'Use a brisk cinematic cadence around 175 words per minute. Keep punctuation pauses under 120 milliseconds and do not draw out words.',
  'Use a very brisk but fully intelligible cinematic cadence around 195 words per minute. Keep punctuation pauses under 60 milliseconds, avoid drawn-out consonants or breath gaps, and finish the line decisively.',
]

function validatePlan(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error('Memory voice plan must contain exactly 22 dialogue lines.')
  }

  const ids = new Set()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Memory voice plan contains a non-object entry.')
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id ?? '')) {
      throw new Error(`Invalid Memory voice id: ${String(entry.id)}`)
    }
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate Memory voice id: ${entry.id}`)
    }
    ids.add(entry.id)

    const expectedVoice = voiceBySpeaker[entry.speaker]
    if (!expectedVoice || entry.voiceName !== expectedVoice) {
      throw new Error(
        `Invalid speaker or voice assignment for ${entry.id}: ${String(entry.speaker)} / ${String(entry.voiceName)}`,
      )
    }
    if (typeof entry.text !== 'string' || entry.text.trim().length < 2) {
      throw new Error(`Missing dialogue text for ${entry.id}.`)
    }
    if (
      !Number.isInteger(entry.maximumMs) ||
      entry.maximumMs < 800 ||
      entry.maximumMs > 6_000
    ) {
      throw new Error(`Invalid maximum duration for ${entry.id}.`)
    }
  }

  return value
}

const lines = validatePlan(JSON.parse(await readFile(planPath, 'utf8')))

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

function wavDurationMs(audio) {
  if (
    audio.length < 44 ||
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('Existing narration asset is not a valid WAV file.')
  }
  const byteRate = audio.readUInt32LE(28)
  const dataBytes = audio.readUInt32LE(40)
  if (byteRate <= 0 || dataBytes <= 0 || dataBytes > audio.length - 44) {
    throw new Error('Existing narration WAV metadata is invalid.')
  }
  return Math.round((dataBytes / byteRate) * 1_000)
}

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

let lastRequestAt = 0

function retryDelayMs(response, retryIndex) {
  const maximumWaitMs = 90_000
  const retryAfter = response.headers.get('retry-after')?.trim()
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
  return Math.min(maximumWaitMs, 30_000 * 2 ** retryIndex)
}

async function requestLine(line, attempt, ordinal) {
  const elapsedSinceRequest = Date.now() - lastRequestAt
  if (elapsedSinceRequest < 7_000) {
    await delay(7_000 - elapsedSinceRequest)
  }

  const request = () => {
    lastRequestAt = Date.now()
    console.log(
      `[${ordinal}/${lines.length}] requesting ${line.id}, take ${attempt + 1}.`,
    )
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(75_000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${directionBySpeaker[line.speaker]} ${paceDirections[attempt]} Respect punctuation, finish cleanly, and fit comfortably within ${(line.maximumMs / 1_000).toFixed(1)} seconds. Speak only this quoted dialogue, without reading the direction aloud:\n\n"${line.text}"`,
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
  }

  const maximumRateLimitRetries = 3
  let response
  for (let retryIndex = 0; retryIndex <= maximumRateLimitRetries; retryIndex += 1) {
    try {
      response = await request()
    } catch (error) {
      if (error?.name === 'TimeoutError') {
        throw new Error(
          `${line.id}: Google speech request timed out after 75 seconds. No API key was retained; rerun to resume completed WAVs.`,
        )
      }
      throw error
    }
    console.log(
      `[${ordinal}/${lines.length}] ${line.id}: Google responded ${response.status}.`,
    )
    if (response.status !== 429) break

    const responseBody = await response.text()
    if (retryIndex === maximumRateLimitRetries) {
      throw new Error(
        `Google speech generation remained rate-limited for ${line.id} after ${maximumRateLimitRetries} retries: ${responseBody.slice(0, 240)}`,
      )
    }

    const waitMs = retryDelayMs(response, retryIndex)
    console.log(
      `${line.id}: Google quota window reached; waiting ${Math.round(waitMs / 1_000)}s before retry ${retryIndex + 1}/${maximumRateLimitRetries}. Completed WAVs remain reusable.`,
    )
    await delay(waitMs)
  }

  if (!response) {
    throw new Error(`Google returned no response for ${line.id}.`)
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Google speech generation failed for ${line.id}: ${response.status} ${body.slice(0, 240)}`,
    )
  }

  const payload = await response.json()
  const part = payload.candidates?.[0]?.content?.parts?.find(
    (candidatePart) => candidatePart.inlineData?.data,
  )
  if (!part?.inlineData?.data) {
    throw new Error(`Google returned no audio payload for ${line.id}.`)
  }
  return trimOuterSilence(Buffer.from(part.inlineData.data, 'base64'))
}

function describeAudio(line, audio, durationMs) {
  return {
    id: line.id,
    speaker: line.speaker,
    voiceName: line.voiceName,
    durationMs,
    bytes: audio.length,
    sha256: createHash('sha256').update(audio).digest('hex'),
  }
}

async function generateLine(line, ordinal) {
  const destination = resolve(outputDirectory, `${line.id}.wav`)
  try {
    const existingAudio = await readFile(destination)
    const existingDurationMs = wavDurationMs(existingAudio)
    if (existingDurationMs <= line.maximumMs) {
      console.log(`${line.id}: reusing ${existingDurationMs}ms local take.`)
      return describeAudio(line, existingAudio, existingDurationMs)
    }
    console.log(
      `${line.id}: existing take is ${existingDurationMs}ms and exceeds ${line.maximumMs}ms; regenerating.`,
    )
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.log(`${line.id}: existing take is unusable; regenerating.`)
    }
  }

  let pcm
  let durationMs = Number.POSITIVE_INFINITY
  for (let attempt = 0; attempt < paceDirections.length; attempt += 1) {
    pcm = await requestLine(line, attempt, ordinal)
    durationMs = Math.round((pcm.length / (sampleRate * 2)) * 1_000)
    if (durationMs <= line.maximumMs) break
    console.log(
      `${line.id}: take ${attempt + 1} was ${durationMs}ms; requesting a tighter performance.`,
    )
  }

  if (!pcm) {
    throw new Error(`Google returned no usable PCM audio for ${line.id}.`)
  }
  if (durationMs > line.maximumMs) {
    throw new Error(
      `${line.id} remained ${durationMs}ms after ${paceDirections.length} directed takes, exceeding its ${line.maximumMs}ms scene window.`,
    )
  }

  const audio = wrapPcmAsWav(pcm)
  const temporary = `${destination}.partial`
  await writeFile(temporary, audio)
  await rename(temporary, destination)
  return describeAudio(line, audio, durationMs)
}

async function updateServiceWorkerRevision(manifestContents) {
  const revision = createHash('sha256')
    .update(manifestContents)
    .digest('hex')
    .slice(0, 16)
  const source = await readFile(serviceWorkerPath, 'utf8')
  const revisionPattern = /const MEMORY_VOICE_REVISION = '[^']*'/
  if (!revisionPattern.test(source)) {
    throw new Error('Unable to locate MEMORY_VOICE_REVISION in public/sw.js.')
  }
  const updated = source.replace(
    revisionPattern,
    `const MEMORY_VOICE_REVISION = '${revision}'`,
  )
  const temporary = `${serviceWorkerPath}.partial`
  await writeFile(temporary, updated)
  await rename(temporary, serviceWorkerPath)
  return revision
}

await mkdir(outputDirectory, { recursive: true })

const generated = []
try {
  for (const [index, line] of lines.entries()) {
    generated.push(await generateLine(line, index + 1))
  }

  const manifest = {
    status: 'ready',
    provider,
    model,
    set: 'memories-i-ix',
    expectedClipCount: lines.length,
    generatedAt: new Date().toISOString(),
    clips: generated,
  }
  const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`
  const temporaryManifest = `${manifestPath}.partial`
  await writeFile(temporaryManifest, manifestContents)
  await rename(temporaryManifest, manifestPath)
  const serviceWorkerRevision = await updateServiceWorkerRevision(manifestContents)

  for (const clip of generated) {
    console.log(
      `${clip.id}: ${clip.durationMs}ms (${clip.bytes} bytes, ${clip.voiceName})`,
    )
  }
  console.log(`Service-worker Memory voice revision: ${serviceWorkerRevision}`)
} catch (error) {
  for (const line of lines) {
    await rm(resolve(outputDirectory, `${line.id}.wav.partial`), { force: true })
  }
  await rm(`${manifestPath}.partial`, { force: true })
  await rm(`${serviceWorkerPath}.partial`, { force: true })
  throw error
}
