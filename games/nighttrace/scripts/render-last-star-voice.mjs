import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiKey = process.env.GEMINI_API_KEY?.trim()
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is required in the current process.')
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(
  root,
  'public/assets/cinematics/audio/last-star',
)

const lines = [
  {
    id: 'intro-star-01',
    text: 'Once, dawn crossed this world in a single breath. Then the horizon learned to close.',
    maximumMs: 8_600,
  },
  {
    id: 'intro-star-02',
    text: 'I survived as a spark. Not enough to become day. Enough to remember it.',
    maximumMs: 7_800,
  },
  {
    id: 'intro-star-03',
    text: 'Ten Sovereigns keep the morning chained.',
    maximumMs: 4_000,
  },
  {
    id: 'intro-star-04',
    text: 'Walk, Bearer. I will burn in every step.',
    maximumMs: 7_200,
  },
  {
    id: 'finale-star-01',
    text: "It isn't dying. It's opening.",
    maximumMs: 3_700,
  },
  {
    id: 'finale-star-02',
    text: 'If it takes me, the world goes dark.',
    maximumMs: 4_800,
  },
  {
    id: 'finale-star-03',
    text: 'I was never the last light. I was the first.',
    maximumMs: 5_700,
  },
]

const performanceDirection = [
  'Perform as the Last Star with a young-adult feminine voice.',
  'Luminous but grounded, intimate cinematic dark-fantasy delivery.',
  'Clear neutral English with warm confidence and restrained emotion.',
  'Natural human phrasing; never breathy, childish, theatrical, sing-song, or synthetic.',
  'Respect punctuation and finish cleanly without adding words or vocal effects.',
].join(' ')

function wrapPcmAsWav(pcm, sampleRate = 24_000) {
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

function trimOuterSilence(pcm, sampleRate = 24_000) {
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

  const startSample = Math.max(0, firstAudible - paddingSamples)
  const endSample = Math.min(sampleCount, lastAudible + paddingSamples + 1)
  return pcm.subarray(startSample * 2, endSample * 2)
}

const paceDirections = [
  'Use a confident conversational pace with compact, natural pauses.',
  'Use a brisk cinematic cadence around 175 words per minute. Keep punctuation pauses under 120 milliseconds and never draw out a word.',
]

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

let lastRequestAt = 0

async function requestLine(line, attempt) {
  const elapsedSinceRequest = Date.now() - lastRequestAt
  if (elapsedSinceRequest < 7_000) {
    await delay(7_000 - elapsedSinceRequest)
  }

  const request = () => {
    lastRequestAt = Date.now()
    return fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${performanceDirection} ${paceDirections[attempt]} Finish comfortably within ${(line.maximumMs / 1_000).toFixed(1)} seconds. Speak only this quoted dialogue, without reading the direction aloud:\n\n"${line.text}"`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Leda' },
              },
            },
          },
        }),
      },
    )
  }

  let response = await request()
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(90_000, retryAfter * 1_000)
      : 65_000
    console.log(
      `${line.id}: Google quota window reached; waiting ${Math.round(waitMs / 1_000)}s before one retry.`,
    )
    await response.text()
    await delay(waitMs)
    response = await request()
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
  return Math.round((dataBytes / byteRate) * 1_000)
}

async function generateLine(line) {
  const destination = resolve(outputDirectory, `${line.id}.wav`)
  try {
    const existingAudio = await readFile(destination)
    const existingDurationMs = wavDurationMs(existingAudio)
    if (existingDurationMs <= line.maximumMs) {
      console.log(`${line.id}: reusing ${existingDurationMs}ms local take.`)
      return {
        id: line.id,
        path: destination,
        durationMs: existingDurationMs,
        bytes: existingAudio.length,
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  let pcm
  let durationMs = Number.POSITIVE_INFINITY
  for (let attempt = 0; attempt < paceDirections.length; attempt += 1) {
    pcm = await requestLine(line, attempt)
    durationMs = Math.round((pcm.length / (24_000 * 2)) * 1_000)
    if (durationMs <= line.maximumMs) break
    console.log(
      `${line.id}: take ${attempt + 1} was ${durationMs}ms; requesting a tighter performance.`,
    )
  }

  if (!pcm) {
    throw new Error(`Google returned no usable PCM audio for ${line.id}.`)
  }
  const audio = wrapPcmAsWav(pcm)
  if (durationMs > line.maximumMs) {
    throw new Error(
      `${line.id} remained ${durationMs}ms after ${paceDirections.length} directed takes, exceeding its ${line.maximumMs}ms scene window.`,
    )
  }

  const temporary = `${destination}.partial`
  await writeFile(temporary, audio)
  await rename(temporary, destination)
  return { id: line.id, path: destination, durationMs, bytes: audio.length }
}

await mkdir(outputDirectory, { recursive: true })

const generated = []
try {
  for (const line of lines) {
    generated.push(await generateLine(line))
  }
  const manifest = {
    provider: 'Google Gemini API',
    model: 'gemini-3.1-flash-tts-preview',
    voice: 'Leda',
    generatedAt: new Date().toISOString(),
    clips: generated.map(({ id, durationMs, bytes }) => ({
      id,
      durationMs,
      bytes,
    })),
  }
  await writeFile(
    resolve(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  for (const clip of generated) {
    console.log(`${clip.id}: ${clip.durationMs}ms (${clip.bytes} bytes)`)
  }
} catch (error) {
  for (const line of lines) {
    await rm(resolve(outputDirectory, `${line.id}.wav.partial`), { force: true })
  }
  throw error
}
