import { createWriteStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { once } from 'node:events'
import { spawnSync } from 'node:child_process'

const SAMPLE_RATE = 44_100
const CHANNELS = 2
const TAU = Math.PI * 2
const projectRoot = resolve(import.meta.dirname, '..')
const masterDir = join(projectRoot, 'qa', 'audio-masters')
const runtimeDir = join(projectRoot, 'public', 'assets', 'audio')
const metricsPath = join(projectRoot, 'qa', 'audio-masters', 'render-metrics.json')
const ffmpegPath = resolve(
  projectRoot,
  '..',
  'spekter-video-analysis',
  'node_modules',
  '.pnpm',
  'ffmpeg-static@5.3.0',
  'node_modules',
  'ffmpeg-static',
  'ffmpeg.exe',
)

mkdirSync(masterDir, { recursive: true })
mkdirSync(runtimeDir, { recursive: true })

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function midiToHz(note) {
  return 440 * 2 ** ((note - 69) / 12)
}

function constantPowerPan(pan) {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4
  return [Math.cos(angle), Math.sin(angle)]
}

function createBuffer(bars, bpm) {
  const duration = (bars * 4 * 60) / bpm
  const length = Math.round(duration * SAMPLE_RATE)
  return {
    left: new Float32Array(length),
    right: new Float32Array(length),
    duration: length / SAMPLE_RATE,
    bpm,
    bars,
  }
}

function addSample(buffer, sampleIndex, value, pan = 0) {
  if (sampleIndex < 0 || sampleIndex >= buffer.left.length) return
  const [leftGain, rightGain] = constantPowerPan(pan)
  buffer.left[sampleIndex] += value * leftGain
  buffer.right[sampleIndex] += value * rightGain
}

function oscillatorSample(type, phase) {
  const wrapped = phase - Math.floor(phase)
  if (type === 'triangle') return 1 - 4 * Math.abs(wrapped - 0.5)
  if (type === 'softSaw') {
    return (
      Math.sin(TAU * wrapped) +
      Math.sin(TAU * wrapped * 2) * 0.38 +
      Math.sin(TAU * wrapped * 3) * 0.2 +
      Math.sin(TAU * wrapped * 4) * 0.1
    ) / 1.68
  }
  if (type === 'hollow') {
    return Math.sin(TAU * wrapped) * 0.82 + Math.sin(TAU * wrapped * 3) * 0.18
  }
  if (type === 'brass') {
    return (
      Math.sin(TAU * wrapped) +
      Math.sin(TAU * wrapped * 2) * 0.55 +
      Math.sin(TAU * wrapped * 3) * 0.28 +
      Math.sin(TAU * wrapped * 5) * 0.12
    ) / 1.82
  }
  return Math.sin(TAU * wrapped)
}

function envelopeAt(time, duration, attack, release, curve = 1.4) {
  const attackGain = attack <= 0 ? 1 : Math.min(1, time / attack)
  const releaseGain = release <= 0 ? 1 : Math.min(1, (duration - time) / release)
  return Math.max(0, Math.min(1, attackGain, releaseGain)) ** curve
}

function addTone(
  buffer,
  {
    start,
    duration,
    frequency,
    gain,
    pan = 0,
    type = 'sine',
    attack = 0.008,
    release = 0.08,
    vibrato = 0,
    vibratoRate = 5,
    detune = 0,
  },
) {
  const startSample = Math.round(start * SAMPLE_RATE)
  const sampleCount = Math.max(1, Math.round(duration * SAMPLE_RATE))
  let phase = 0
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE
    const envelope = envelopeAt(time, duration, attack, release)
    const pitch = frequency * 2 ** (detune / 1200)
    const instantaneousPitch = pitch * (1 + Math.sin(TAU * vibratoRate * time) * vibrato)
    phase += instantaneousPitch / SAMPLE_RATE
    addSample(
      buffer,
      startSample + index,
      oscillatorSample(type, phase) * gain * envelope,
      pan,
    )
  }
}

function addPluck(buffer, start, note, gain, pan, brightness = 1) {
  const frequency = midiToHz(note)
  const duration = 0.32
  const startSample = Math.round(start * SAMPLE_RATE)
  const sampleCount = Math.round(duration * SAMPLE_RATE)
  let phase = 0
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE
    const decay = Math.exp(-time * (9.5 - brightness * 1.8))
    phase += frequency / SAMPLE_RATE
    const value =
      (Math.sin(TAU * phase) +
        Math.sin(TAU * phase * 2) * 0.34 * brightness +
        Math.sin(TAU * phase * 5) * 0.13 * brightness) *
      decay *
      gain
    addSample(buffer, startSample + index, value, pan)
  }
}

function addKick(buffer, start, gain = 0.55, pan = 0) {
  const duration = 0.46
  const startSample = Math.round(start * SAMPLE_RATE)
  const count = Math.round(duration * SAMPLE_RATE)
  let phase = 0
  for (let index = 0; index < count; index += 1) {
    const time = index / SAMPLE_RATE
    const frequency = 42 + 94 * Math.exp(-time * 24)
    phase += frequency / SAMPLE_RATE
    const body = Math.sin(TAU * phase) * Math.exp(-time * 8.5)
    const click = (index % 2 ? -1 : 1) * Math.exp(-time * 95) * 0.1
    addSample(buffer, startSample + index, (body + click) * gain, pan)
  }
}

function addSnare(buffer, start, gain, random, pan = 0) {
  const duration = 0.3
  const startSample = Math.round(start * SAMPLE_RATE)
  const count = Math.round(duration * SAMPLE_RATE)
  for (let index = 0; index < count; index += 1) {
    const time = index / SAMPLE_RATE
    const noise = random() * 2 - 1
    const tone = Math.sin(TAU * 176 * time) * 0.38
    const value = (noise * 0.64 + tone) * Math.exp(-time * 13) * gain
    addSample(buffer, startSample + index, value, pan)
  }
}

function addHat(buffer, start, gain, random, pan = 0, open = false) {
  const duration = open ? 0.22 : 0.075
  const startSample = Math.round(start * SAMPLE_RATE)
  const count = Math.round(duration * SAMPLE_RATE)
  let previous = 0
  for (let index = 0; index < count; index += 1) {
    const time = index / SAMPLE_RATE
    const noise = random() * 2 - 1
    const high = noise - previous * 0.82
    previous = noise
    const value = high * Math.exp(-time * (open ? 18 : 55)) * gain
    addSample(buffer, startSample + index, value, pan)
  }
}

function addSubImpact(buffer, start, gain, random, pan = 0) {
  addKick(buffer, start, gain * 0.78, pan)
  const duration = 0.9
  const startSample = Math.round(start * SAMPLE_RATE)
  const count = Math.round(duration * SAMPLE_RATE)
  for (let index = 0; index < count; index += 1) {
    const time = index / SAMPLE_RATE
    const grit = (random() * 2 - 1) * Math.exp(-time * 5.8)
    const rumble = Math.sin(TAU * (31 + 5 * Math.exp(-time * 3)) * time) * Math.exp(-time * 3.2)
    addSample(buffer, startSample + index, (grit * 0.11 + rumble * 0.48) * gain, pan)
  }
}

function addLoopOscillator(buffer, targetFrequency, gain, pan, amplitudeCycles = 3) {
  const duration = buffer.duration
  const frequency = Math.round(targetFrequency * duration) / duration
  const [leftGain, rightGain] = constantPowerPan(pan)
  for (let index = 0; index < buffer.left.length; index += 1) {
    const normalized = index / buffer.left.length
    const amplitude = 0.74 + 0.26 * Math.sin(TAU * amplitudeCycles * normalized - Math.PI / 2)
    const value =
      (Math.sin(TAU * frequency * index / SAMPLE_RATE) * 0.86 +
        Math.sin(TAU * frequency * 2 * index / SAMPLE_RATE) * 0.14) *
      gain *
      amplitude
    buffer.left[index] += value * leftGain
    buffer.right[index] += value * rightGain
  }
}

function addCircularDelay(buffer, delaySeconds, gain, crossFeed = 0.28) {
  const delaySamples = Math.max(1, Math.round(delaySeconds * SAMPLE_RATE))
  const length = buffer.left.length
  const sourceLeft = buffer.left.slice()
  const sourceRight = buffer.right.slice()
  for (let index = 0; index < length; index += 1) {
    const delayed = (index - delaySamples + length) % length
    buffer.left[index] +=
      sourceLeft[delayed] * gain * (1 - crossFeed) + sourceRight[delayed] * gain * crossFeed
    buffer.right[index] +=
      sourceRight[delayed] * gain * (1 - crossFeed) + sourceLeft[delayed] * gain * crossFeed
  }
}

function addDungeonArrangement(buffer, seed) {
  const random = mulberry32(seed)
  const beat = 60 / buffer.bpm
  const progression = [
    [38, 45, 50, 53],
    [39, 46, 50, 55],
    [36, 43, 48, 51],
    [37, 44, 49, 53],
  ]
  const ostinato = [38, 45, 50, 51, 45, 53, 50, 45]
  addLoopOscillator(buffer, midiToHz(26), 0.095, -0.08, 3)

  for (let bar = 0; bar < buffer.bars; bar += 1) {
    const barStart = bar * beat * 4
    const chord = progression[bar % progression.length]
    const section = Math.floor((bar % 16) / 4)
    for (let index = 0; index < chord.length; index += 1) {
      addTone(buffer, {
        start: barStart,
        duration: beat * 3.78,
        frequency: midiToHz(chord[index]),
        gain: 0.035 + section * 0.004,
        pan: -0.56 + index * 0.37,
        type: index < 2 ? 'hollow' : 'triangle',
        attack: beat * 0.48,
        release: beat * 0.72,
        vibrato: 0.0012,
        vibratoRate: 3.1,
      })
    }

    for (let step = 0; step < 8; step += 1) {
      const variation = bar % 4 === 3 && step === 6 ? 1 : 0
      const note = ostinato[(step + (bar % 2) * 2) % ostinato.length] + variation
      addPluck(
        buffer,
        barStart + step * beat * 0.5,
        note + 12,
        0.052 + (step % 4 === 0 ? 0.015 : 0),
        step % 2 === 0 ? -0.48 : 0.48,
        0.78,
      )
    }

    addKick(buffer, barStart, 0.48)
    addKick(buffer, barStart + beat * 2.75, 0.28)
    addSnare(buffer, barStart + beat * 2, 0.18, random, 0.08)
    for (let step = 0; step < 8; step += 1) {
      addHat(
        buffer,
        barStart + step * beat * 0.5,
        step % 2 === 0 ? 0.056 : 0.037,
        random,
        step % 2 ? 0.55 : -0.55,
        bar % 4 === 3 && step === 7,
      )
    }
    if (bar % 4 === 0) addSubImpact(buffer, barStart, 0.35, random, -0.08)
    if (bar % 4 === 3) {
      addTone(buffer, {
        start: barStart + beat * 3,
        duration: beat * 0.74,
        frequency: midiToHz(62 + ((bar / 4) % 2)),
        gain: 0.034,
        pan: 0.62,
        type: 'hollow',
        attack: 0.012,
        release: beat * 0.44,
      })
    }
  }

  addCircularDelay(buffer, beat * 0.75, 0.13, 0.72)
  addCircularDelay(buffer, beat * 1.5, 0.055, 0.54)
}

function addBossArrangement(buffer, seed) {
  const random = mulberry32(seed)
  const beat = 60 / buffer.bpm
  const progression = [
    [28, 40, 47, 52],
    [29, 41, 48, 53],
    [25, 37, 44, 49],
    [30, 42, 46, 51],
  ]
  const ostinato = [40, 40, 47, 41, 40, 52, 48, 47, 40, 53, 52, 47, 41, 48, 47, 40]
  addLoopOscillator(buffer, midiToHz(28), 0.13, 0, 4)

  for (let bar = 0; bar < buffer.bars; bar += 1) {
    const barStart = bar * beat * 4
    const chord = progression[bar % progression.length]
    const pressure = 1 + (bar % 16 >= 8 ? 0.12 : 0)
    for (let index = 0; index < chord.length; index += 1) {
      addTone(buffer, {
        start: barStart,
        duration: beat * 3.76,
        frequency: midiToHz(chord[index]),
        gain: (index === 0 ? 0.058 : 0.038) * pressure,
        pan: -0.58 + index * 0.38,
        type: index <= 1 ? 'brass' : 'hollow',
        attack: beat * 0.12,
        release: beat * 0.55,
        vibrato: 0.0017,
        vibratoRate: 4.3,
      })
    }

    for (let step = 0; step < 16; step += 1) {
      const note = ostinato[(step + (bar % 4) * 3) % ostinato.length]
      addPluck(
        buffer,
        barStart + step * beat * 0.25,
        note + (step % 8 === 7 ? 12 : 0),
        (step % 4 === 0 ? 0.078 : 0.049) * pressure,
        step % 2 ? 0.42 : -0.42,
        1.08,
      )
    }

    for (const kickBeat of [0, 1.5, 2.5, 3.25]) {
      addKick(buffer, barStart + beat * kickBeat, kickBeat === 0 ? 0.68 : 0.48)
    }
    addSnare(buffer, barStart + beat, 0.2, random, -0.12)
    addSnare(buffer, barStart + beat * 3, 0.3, random, 0.12)
    for (let step = 0; step < 16; step += 1) {
      addHat(
        buffer,
        barStart + step * beat * 0.25,
        (step % 4 === 0 ? 0.07 : 0.044) * pressure,
        random,
        step % 2 ? 0.62 : -0.62,
        bar % 4 === 3 && step === 15,
      )
    }
    if (bar % 2 === 0) addSubImpact(buffer, barStart, 0.48, random, 0)
    if (bar % 4 === 3) {
      for (let stab = 0; stab < 3; stab += 1) {
        addTone(buffer, {
          start: barStart + beat * (2.5 + stab * 0.42),
          duration: beat * 0.34,
          frequency: midiToHz([53, 54, 48][stab]),
          gain: 0.07,
          pan: [-0.58, 0.58, 0][stab],
          type: 'brass',
          attack: 0.006,
          release: beat * 0.2,
        })
      }
    }
  }

  addCircularDelay(buffer, beat * 0.5, 0.095, 0.76)
  addCircularDelay(buffer, beat, 0.04, 0.6)
}

function masterBuffer(buffer, targetRms, targetPeak) {
  let leftMean = 0
  let rightMean = 0
  for (let index = 0; index < buffer.left.length; index += 1) {
    leftMean += buffer.left[index]
    rightMean += buffer.right[index]
  }
  leftMean /= buffer.left.length
  rightMean /= buffer.right.length

  let sumSquares = 0
  for (let index = 0; index < buffer.left.length; index += 1) {
    const left = Math.tanh((buffer.left[index] - leftMean) * 1.16)
    const right = Math.tanh((buffer.right[index] - rightMean) * 1.16)
    buffer.left[index] = left
    buffer.right[index] = right
    sumSquares += left * left + right * right
  }
  const rmsBefore = Math.sqrt(sumSquares / (buffer.left.length * 2))
  const rmsGain = targetRms / Math.max(0.000_001, rmsBefore)
  let peak = 0
  for (let index = 0; index < buffer.left.length; index += 1) {
    buffer.left[index] *= rmsGain
    buffer.right[index] *= rmsGain
    peak = Math.max(peak, Math.abs(buffer.left[index]), Math.abs(buffer.right[index]))
  }
  const peakGain = peak > targetPeak ? targetPeak / peak : 1
  if (peakGain < 1) {
    for (let index = 0; index < buffer.left.length; index += 1) {
      buffer.left[index] *= peakGain
      buffer.right[index] *= peakGain
    }
  }
}

function sealLoopBoundary(buffer, fadeMilliseconds = 10) {
  const fadeSamples = Math.max(2, Math.round((fadeMilliseconds / 1000) * SAMPLE_RATE))
  for (let index = 0; index < fadeSamples; index += 1) {
    const position = index / (fadeSamples - 1)
    const fadeIn = Math.sin(position * Math.PI * 0.5) ** 2
    const fadeOut = Math.cos(position * Math.PI * 0.5) ** 2
    const endIndex = buffer.left.length - fadeSamples + index
    buffer.left[index] *= fadeIn
    buffer.right[index] *= fadeIn
    buffer.left[endIndex] *= fadeOut
    buffer.right[endIndex] *= fadeOut
  }
}

function calculateMetrics(buffer) {
  let peak = 0
  let sumSquares = 0
  let correlationNumerator = 0
  let leftSquares = 0
  let rightSquares = 0
  for (let index = 0; index < buffer.left.length; index += 1) {
    const left = buffer.left[index]
    const right = buffer.right[index]
    peak = Math.max(peak, Math.abs(left), Math.abs(right))
    sumSquares += left * left + right * right
    correlationNumerator += left * right
    leftSquares += left * left
    rightSquares += right * right
  }
  const rms = Math.sqrt(sumSquares / (buffer.left.length * 2))
  const firstLeft = buffer.left[0]
  const firstRight = buffer.right[0]
  const lastLeft = buffer.left.at(-1) ?? 0
  const lastRight = buffer.right.at(-1) ?? 0
  const seamDelta = Math.max(Math.abs(firstLeft - lastLeft), Math.abs(firstRight - lastRight))
  const stereoCorrelation =
    correlationNumerator / Math.max(0.000_001, Math.sqrt(leftSquares * rightSquares))
  return {
    durationSeconds: Number(buffer.duration.toFixed(6)),
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    bars: buffer.bars,
    bpm: buffer.bpm,
    samplePeakDbfs: Number((20 * Math.log10(Math.max(0.000_001, peak))).toFixed(3)),
    rmsDbfs: Number((20 * Math.log10(Math.max(0.000_001, rms))).toFixed(3)),
    seamSampleDelta: Number(seamDelta.toFixed(7)),
    stereoCorrelation: Number(stereoCorrelation.toFixed(4)),
  }
}

async function writeWav(filePath, buffer) {
  mkdirSync(dirname(filePath), { recursive: true })
  const stream = createWriteStream(filePath)
  const dataBytes = buffer.left.length * CHANNELS * 2
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataBytes, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(CHANNELS, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28)
  header.writeUInt16LE(CHANNELS * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataBytes, 40)
  stream.write(header)

  const chunkFrames = 16_384
  for (let offset = 0; offset < buffer.left.length; offset += chunkFrames) {
    const frames = Math.min(chunkFrames, buffer.left.length - offset)
    const chunk = Buffer.allocUnsafe(frames * CHANNELS * 2)
    for (let index = 0; index < frames; index += 1) {
      const left = Math.max(-1, Math.min(1, buffer.left[offset + index]))
      const right = Math.max(-1, Math.min(1, buffer.right[offset + index]))
      chunk.writeInt16LE(Math.round(left * 32_767), index * 4)
      chunk.writeInt16LE(Math.round(right * 32_767), index * 4 + 2)
    }
    if (!stream.write(chunk)) await once(stream, 'drain')
  }
  stream.end()
  await once(stream, 'finish')
}

function runFfmpeg(args, description) {
  if (!existsSync(ffmpegPath)) {
    throw new Error(`Local FFmpeg not found at ${ffmpegPath}`)
  }
  const result = spawnSync(ffmpegPath, args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`${description} failed:\n${result.stderr || result.stdout}`)
  }
  return result
}

function encodeRuntime(id, wavPath, compact) {
  const oggPath = join(runtimeDir, `${id}.ogg`)
  const m4aPath = join(runtimeDir, `${id}.m4a`)
  runFfmpeg(
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-map_metadata',
      '-1',
      '-metadata',
      'title=Nighttrace Original Score',
      '-metadata',
      'artist=Nighttrace',
      '-metadata',
      'copyright=Original composition for Nighttrace',
      '-c:a',
      'libvorbis',
      '-q:a',
      compact ? '3' : '5',
      oggPath,
    ],
    `${id} OGG encode`,
  )
  runFfmpeg(
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-map_metadata',
      '-1',
      '-metadata',
      'title=Nighttrace Original Score',
      '-metadata',
      'artist=Nighttrace',
      '-metadata',
      'copyright=Original composition for Nighttrace',
      '-c:a',
      'aac',
      '-b:a',
      compact ? '112k' : '160k',
      '-movflags',
      '+faststart',
      m4aPath,
    ],
    `${id} M4A encode`,
  )
  return {
    oggPath,
    m4aPath,
    oggBytes: statSync(oggPath).size,
    m4aBytes: statSync(m4aPath).size,
  }
}

function writeSpectrogram(id, wavPath) {
  const outputPath = join(masterDir, `${id}-spectrogram.png`)
  runFfmpeg(
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-lavfi',
      'showspectrumpic=s=1600x900:legend=1:color=fiery:scale=log',
      '-frames:v',
      '1',
      outputPath,
    ],
    `${id} spectrogram`,
  )
  return outputPath
}

function measureLoudness(wavPath) {
  const result = runFfmpeg(
    [
      '-hide_banner',
      '-nostats',
      '-i',
      wavPath,
      '-af',
      'loudnorm=I=-16:TP=-1:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ],
    'EBU R128 loudness analysis',
  )
  const output = `${result.stdout}\n${result.stderr}`
  const start = output.lastIndexOf('{')
  const end = output.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  const measured = JSON.parse(output.slice(start, end + 1))
  return {
    integratedLufs: Number(measured.input_i),
    truePeakDbtp: Number(measured.input_tp),
    loudnessRangeLu: Number(measured.input_lra),
    thresholdLufs: Number(measured.input_thresh),
  }
}

const renders = [
  {
    id: 'nighttrace-dungeon-loop',
    bars: 48,
    bpm: 132,
    seed: 0x4e494748,
    arrange: addDungeonArrangement,
    rms: 0.128,
    peak: 0.88,
  },
  {
    id: 'nighttrace-sovereign-loop',
    bars: 48,
    bpm: 152,
    seed: 0x534f5645,
    arrange: addBossArrangement,
    rms: 0.155,
    peak: 0.9,
  },
  {
    id: 'nighttrace-dungeon-loop-compact',
    bars: 16,
    bpm: 132,
    seed: 0x4e494748,
    arrange: addDungeonArrangement,
    rms: 0.128,
    peak: 0.88,
  },
  {
    id: 'nighttrace-sovereign-loop-compact',
    bars: 16,
    bpm: 152,
    seed: 0x534f5645,
    arrange: addBossArrangement,
    rms: 0.155,
    peak: 0.9,
  },
]

const metrics = {}
for (const render of renders) {
  process.stdout.write(`Rendering ${render.id}...\n`)
  const buffer = createBuffer(render.bars, render.bpm)
  render.arrange(buffer, render.seed)
  masterBuffer(buffer, render.rms, render.peak)
  sealLoopBoundary(buffer)
  const wavPath = join(masterDir, `${render.id}.wav`)
  await writeWav(wavPath, buffer)
  const compact = render.id.endsWith('-compact')
  const encoded = encodeRuntime(render.id, wavPath, compact)
  const spectrogramPath = writeSpectrogram(render.id, wavPath)
  metrics[render.id] = {
    ...calculateMetrics(buffer),
    ...measureLoudness(wavPath),
    wavBytes: statSync(wavPath).size,
    oggBytes: encoded.oggBytes,
    m4aBytes: encoded.m4aBytes,
    spectrogram: spectrogramPath.slice(projectRoot.length + 1).replaceAll('\\', '/'),
  }
  process.stdout.write(
    `  ${metrics[render.id].durationSeconds}s, peak ${metrics[render.id].samplePeakDbfs} dBFS, ` +
      `RMS ${metrics[render.id].rmsDbfs} dBFS, seam Δ ${metrics[render.id].seamSampleDelta}\n`,
  )
}

writeFileSync(
  metricsPath,
  `${JSON.stringify(
    {
      renderer: 'Nighttrace deterministic original synthesis v1',
      generatedAt: new Date().toISOString(),
      copyright: 'Original score generated for Nighttrace; no third-party samples or melodies.',
      metrics,
    },
    null,
    2,
  )}\n`,
)

process.stdout.write(`WAV masters: ${masterDir}\n`)
process.stdout.write(`Runtime output target: ${runtimeDir}\n`)
