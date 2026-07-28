import {
  createHash,
} from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const TARGET_LUFS = -14
const TARGET_TRUE_PEAK = -1.5
const TARGET_LRA = 11
const FULL_BITRATE = '192k'
const COMPACT_BITRATE = '96k'
const projectRoot = resolve(import.meta.dirname, '..')
const runtimeDir = join(projectRoot, 'public', 'assets', 'audio')

const TRACKS = {
  haunted: {
    argument: 'haunted',
    title: 'Haunted House Explorer - Instrumental',
    artist: 'UniqueCreativeAudio',
    sourceSha256:
      '541925e9a4c6afc84c76c24172066f5bddb94b10d15304194fdf1d519f79266e',
    audibleEndSeconds: 147.78,
    seamSeconds: 2.5,
    sourceUrl:
      'https://pixabay.com/music/mystery-haunted-house-explorer-instrumental-168968/',
  },
  retro: {
    argument: 'retro',
    title: 'Creepy Retro Gaming Music (No Copyright)',
    artist: 'BouncyRunner',
    sourceSha256:
      '0e1a74cfa79823f811f49a8872627ab898697e3a77ba54281c29ce31c33331b1',
    audibleEndSeconds: 258.98,
    seamSeconds: 2.5,
    sourceUrl:
      'https://pixabay.com/music/video-games-creepy-retro-gaming-music-no-copyright-401536/',
  },
  phonk: {
    argument: 'phonk',
    title: 'Drift Phonk Music (Phonk Mix)',
    artist: 'Tunetank',
    sourceSha256:
      'f41d3e5998b51be53457d2485f5bf09897d3aa5bbee91bfb7907dd9913eacc28',
    audibleEndSeconds: 144.45,
    seamSeconds: 1.5,
    sourceUrl:
      'https://pixabay.com/music/video-games-drift-phonk-music-phonk-mix-349313/',
  },
}

function usage() {
  return [
    'Import and master the three approved Nighttrace music sources.',
    '',
    'Usage:',
    '  node scripts/import-third-party-audio.mjs \\',
    '    --haunted <source.mp3> --retro <source.mp3> --phonk <source.mp3> \\',
    '    [--ffmpeg <ffmpeg executable>]',
    '',
    'FFmpeg may also be supplied through FFMPEG_PATH or resolved from PATH.',
  ].join('\n')
}

function parseArguments(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--help' || token === '-h') {
      process.stdout.write(`${usage()}\n`)
      process.exit(0)
    }
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`)
    }
    const key = token.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    parsed[key] = value
    index += 1
  }
  return parsed
}

function runFfmpeg(ffmpegPath, args, label) {
  const result = spawnSync(ffmpegPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (${result.status}).\n${result.stdout}\n${result.stderr}`,
    )
  }
  return `${result.stdout}\n${result.stderr}`
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function parseLoudnorm(output) {
  const start = output.lastIndexOf('{')
  const end = output.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error(`FFmpeg did not return loudnorm JSON.\n${output}`)
  }
  return JSON.parse(output.slice(start, end + 1))
}

function measureLoudness(ffmpegPath, inputPath) {
  const output = runFfmpeg(
    ffmpegPath,
    [
      '-hide_banner',
      '-nostats',
      '-i',
      inputPath,
      '-af',
      `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TRUE_PEAK}:LRA=${TARGET_LRA}:print_format=json`,
      '-f',
      'null',
      '-',
    ],
    `loudness analysis for ${basename(inputPath)}`,
  )
  return parseLoudnorm(output)
}

function renderCircularLoop(ffmpegPath, sourcePath, track, outputPath) {
  const end = track.audibleEndSeconds
  const seam = track.seamSeconds
  const middleEnd = end - seam
  const filter = [
    `[0:a]atrim=start=0:end=${end},asetpts=PTS-STARTPTS,asplit=3[headsrc][midsrc][tailsrc]`,
    `[headsrc]atrim=start=0:end=${seam},asetpts=PTS-STARTPTS[head]`,
    `[tailsrc]atrim=start=${middleEnd}:end=${end},asetpts=PTS-STARTPTS[tail]`,
    `[tail][head]acrossfade=d=${seam}:c1=qsin:c2=qsin[cross]`,
    `[midsrc]atrim=start=${seam}:end=${middleEnd},asetpts=PTS-STARTPTS[middle]`,
    '[cross][middle]concat=n=2:v=0:a=1,aresample=48000[loop]',
  ].join(';')

  runFfmpeg(
    ffmpegPath,
    [
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      sourcePath,
      '-filter_complex',
      filter,
      '-map',
      '[loop]',
      '-ac',
      '2',
      '-ar',
      '48000',
      '-c:a',
      'pcm_f32le',
      outputPath,
    ],
    `equal-power loop render for ${track.argument}`,
  )
}

function encodeNormalizedMp3(
  ffmpegPath,
  loopMasterPath,
  track,
  measured,
  bitrate,
  outputPath,
) {
  const filter = [
    `loudnorm=I=${TARGET_LUFS}`,
    `TP=${TARGET_TRUE_PEAK}`,
    `LRA=${TARGET_LRA}`,
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
    'print_format=summary',
  ].join(':')

  runFfmpeg(
    ffmpegPath,
    [
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      loopMasterPath,
      '-af',
      filter,
      '-ac',
      '2',
      '-ar',
      '48000',
      '-c:a',
      'libmp3lame',
      '-b:a',
      bitrate,
      '-write_xing',
      '1',
      '-id3v2_version',
      '3',
      '-metadata',
      `title=${track.title}`,
      '-metadata',
      `artist=${track.artist}`,
      '-metadata',
      'album=Nighttrace',
      '-metadata',
      `comment=Integrated game soundtrack source: ${track.sourceUrl}`,
      outputPath,
    ],
    `normalized ${bitrate} MP3 encode for ${track.argument}`,
  )
}

function assertDeliveredLoudness(path, measurement) {
  const integrated = Number(measurement.input_i)
  const truePeak = Number(measurement.input_tp)
  if (!Number.isFinite(integrated) || Math.abs(integrated - TARGET_LUFS) > 0.45) {
    throw new Error(
      `${basename(path)} measured ${integrated} LUFS; expected ${TARGET_LUFS} +/- 0.45.`,
    )
  }
  if (!Number.isFinite(truePeak) || truePeak > -1.2) {
    throw new Error(
      `${basename(path)} measured ${truePeak} dBTP; expected no more than -1.2 dBTP.`,
    )
  }
}

const args = parseArguments(process.argv.slice(2))
const ffmpegPath = args.ffmpeg ?? process.env.FFMPEG_PATH ?? 'ffmpeg'
runFfmpeg(ffmpegPath, ['-hide_banner', '-version'], 'FFmpeg probe')

for (const track of Object.values(TRACKS)) {
  const sourcePath = args[track.argument]
  if (!sourcePath) {
    throw new Error(`Missing --${track.argument} source path.\n\n${usage()}`)
  }
  const resolvedSource = resolve(sourcePath)
  if (!existsSync(resolvedSource)) {
    throw new Error(`Source does not exist: ${resolvedSource}`)
  }
  const actualSha = sha256(resolvedSource)
  if (actualSha !== track.sourceSha256) {
    throw new Error(
      `${track.argument} source hash mismatch.\nExpected ${track.sourceSha256}\nReceived ${actualSha}`,
    )
  }
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'nighttrace-audio-'))
const report = {}
try {
  for (const [trackId, track] of Object.entries(TRACKS)) {
    const sourcePath = resolve(args[track.argument])
    const loopMasterPath = join(temporaryRoot, `${trackId}-loop.wav`)
    renderCircularLoop(ffmpegPath, sourcePath, track, loopMasterPath)
    const masterMeasurement = measureLoudness(ffmpegPath, loopMasterPath)

    const variants = {}
    for (const [variant, bitrate] of [
      ['full', FULL_BITRATE],
      ['compact', COMPACT_BITRATE],
    ]) {
      const suffix = variant === 'compact' ? '-compact' : ''
      const outputPath = join(
        runtimeDir,
        `nighttrace-${trackId}-loop${suffix}.mp3`,
      )
      encodeNormalizedMp3(
        ffmpegPath,
        loopMasterPath,
        track,
        masterMeasurement,
        bitrate,
        outputPath,
      )
      const deliveredMeasurement = measureLoudness(ffmpegPath, outputPath)
      assertDeliveredLoudness(outputPath, deliveredMeasurement)
      variants[variant] = {
        file: outputPath.slice(projectRoot.length + 1).replaceAll('\\', '/'),
        bytes: statSync(outputPath).size,
        sha256: sha256(outputPath),
        integratedLufs: Number(deliveredMeasurement.input_i),
        truePeakDbtp: Number(deliveredMeasurement.input_tp),
        loudnessRangeLu: Number(deliveredMeasurement.input_lra),
      }
    }
    report[trackId] = {
      source: basename(sourcePath),
      sourceSha256: track.sourceSha256,
      audibleEndSeconds: track.audibleEndSeconds,
      equalPowerSeamSeconds: track.seamSeconds,
      deliveredLoopSeconds: track.audibleEndSeconds - track.seamSeconds,
      variants,
    }
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

process.stdout.write(
  `${JSON.stringify(
    {
      target: {
        integratedLufs: TARGET_LUFS,
        truePeakDbtp: TARGET_TRUE_PEAK,
        loudnessRangeLu: TARGET_LRA,
      },
      report,
    },
    null,
    2,
  )}\n`,
)
