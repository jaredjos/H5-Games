import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
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
  verifyCinematicVoiceSet,
} from './cinematic-voice-integrity.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const planPath = resolve(projectRoot, 'src/story/cinematicVoicePlan.json')
const approvalPath = resolve(projectRoot, 'scripts/approved-cinematic-voices-v1.23.json')
const campaignDirectory = resolve(
  projectRoot,
  'public/assets/cinematics/audio/campaign',
)
const manifestPath = resolve(campaignDirectory, 'manifest.json')
const serviceWorkerPath = resolve(projectRoot, 'public/sw.js')
const defaultReviewDirectory =
  'D:\\Nighttrace-Voice-Review\\20260802-174919-cadence-review'
const defaultBackupRoot = 'D:\\Nighttrace-Voice-Backups'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function optionValue(name, fallback) {
  const prefix = `${name}=`
  const inline = process.argv.slice(2).find((argument) => argument.startsWith(prefix))
  if (inline) return resolve(inline.slice(prefix.length))
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) return resolve(process.argv[index + 1])
  return resolve(fallback)
}

const dryRun = process.argv.includes('--dry-run')
const reviewDirectory = optionValue('--source-dir', defaultReviewDirectory)
const backupRoot = optionValue('--backup-root', defaultBackupRoot)

async function replaceGeneratedFile(destination, contents) {
  const temporary = `${destination}.approved.partial`
  await writeFile(temporary, contents)
  let lastError
  for (let retryIndex = 0; retryIndex < 6; retryIndex += 1) {
    try {
      await rename(temporary, destination)
      return
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY', 'EEXIST'].includes(error?.code)) throw error
      lastError = error
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, Math.min(1_600, 50 * 2 ** retryIndex)),
      )
    }
  }
  try {
    await writeFile(destination, contents)
    await rm(temporary, { force: true })
  } catch (error) {
    throw new AggregateError(
      [lastError, error].filter(Boolean),
      `Unable to replace approved file: ${destination}`,
    )
  }
}

async function optionalFile(path) {
  try {
    return await readFile(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

function clipMetadata(line, audio) {
  return {
    id: line.id,
    sceneId: line.sceneId,
    speaker: line.speaker,
    voiceName: line.voiceName,
    contentSha256: cinematicLineContentSha256(line),
    durationMs: inspectCinematicWav(audio, `${line.id}.wav`),
    bytes: audio.length,
    sha256: sha256(audio),
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

async function main() {
  const plan = validateCinematicVoicePlan(JSON.parse(await readFile(planPath, 'utf8')))
  const approval = JSON.parse(await readFile(approvalPath, 'utf8'))
  if (
    approval?.schemaVersion !== 1 ||
    approval.approvedClipCount !== 10 ||
    !Array.isArray(approval.clips) ||
    approval.clips.length !== 10
  ) {
    throw new Error('Approved cinematic voice manifest must contain exactly ten clips.')
  }

  const planById = new Map(plan.map((line) => [line.id, line]))
  const approvedAudioById = new Map()
  for (const clip of approval.clips) {
    if (approvedAudioById.has(clip.id) || !planById.has(clip.id)) {
      throw new Error(`Unknown or duplicate approved cinematic clip: ${String(clip.id)}`)
    }
    const audio = await readFile(resolve(reviewDirectory, clip.reviewFile))
    const durationMs = inspectCinematicWav(audio, clip.reviewFile)
    const audioSha256 = sha256(audio)
    if (durationMs !== clip.durationMs || audioSha256 !== clip.sha256) {
      throw new Error(`${clip.reviewFile} does not match the user-approved review asset.`)
    }
    if (durationMs > cinematicVoiceWindowMs(planById.get(clip.id))) {
      throw new Error(`${clip.id} exceeds its current cinematic dialogue window.`)
    }
    approvedAudioById.set(clip.id, audio)
  }

  const priorManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const priorClipById = new Map(priorManifest.clips.map((clip) => [clip.id, clip]))
  const wavById = new Map()
  const clipById = new Map()
  for (const line of plan) {
    const approvedAudio = approvedAudioById.get(line.id)
    if (approvedAudio) {
      wavById.set(line.id, approvedAudio)
      clipById.set(line.id, clipMetadata(line, approvedAudio))
      continue
    }

    const priorClip = priorClipById.get(line.id)
    if (!priorClip) throw new Error(`Existing campaign manifest is missing ${line.id}.`)
    const audio = await readFile(resolve(campaignDirectory, `${line.id}.wav`))
    const metadata = clipMetadata(line, audio)
    if (
      priorClip.sceneId !== metadata.sceneId ||
      priorClip.speaker !== metadata.speaker ||
      priorClip.voiceName !== metadata.voiceName ||
      priorClip.contentSha256 !== metadata.contentSha256 ||
      priorClip.durationMs !== metadata.durationMs ||
      priorClip.bytes !== metadata.bytes ||
      priorClip.sha256 !== metadata.sha256
    ) {
      throw new Error(`${line.id}.wav no longer matches the existing campaign manifest.`)
    }
    wavById.set(line.id, audio)
    clipById.set(line.id, metadata)
  }

  const manifest = {
    status: 'ready',
    provider: CINEMATIC_VOICE_PROVIDER,
    model: CINEMATIC_VOICE_MODEL,
    promptRevision: CINEMATIC_VOICE_PROMPT_REVISION,
    set: CINEMATIC_VOICE_SET,
    expectedClipCount: plan.length,
    planSha256: cinematicPlanSha256(plan),
    generatedAt: new Date().toISOString(),
    clips: plan.map((line) => clipById.get(line.id)),
  }
  const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`
  const manifestBuffer = Buffer.from(manifestContents)
  const revision = cinematicManifestRevision(manifestBuffer)
  const serviceWorker = await readFile(serviceWorkerPath, 'utf8')
  const revisionPattern = /const CINEMATIC_VOICE_REVISION = '[^']*'/
  if (!revisionPattern.test(serviceWorker)) {
    throw new Error('Unable to locate CINEMATIC_VOICE_REVISION in public/sw.js.')
  }
  const updatedServiceWorker = serviceWorker.replace(
    revisionPattern,
    `const CINEMATIC_VOICE_REVISION = '${revision}'`,
  )

  verifyCinematicVoiceSet({
    manifest,
    manifestBuffer,
    plan,
    wavById,
    serviceWorkerRevision: revision,
  })

  if (dryRun) {
    console.log(
      `Approved promotion ready: ${approval.clips.length} replacements, ${manifest.clips.length}/${plan.length} total clips, plan ${manifest.planSha256}, revision ${revision}.`,
    )
    return
  }

  await mkdir(backupRoot, { recursive: true })
  const backupDirectory = resolve(backupRoot, `${timestamp()}-${approval.reviewSet}`)
  await mkdir(backupDirectory, { recursive: false })
  await copyFile(manifestPath, resolve(backupDirectory, 'manifest.json'))
  await copyFile(serviceWorkerPath, resolve(backupDirectory, 'sw.js'))
  for (const clip of approval.clips) {
    const destination = resolve(campaignDirectory, `${clip.id}.wav`)
    if ((await optionalFile(destination)) !== undefined) {
      await copyFile(destination, resolve(backupDirectory, `${clip.id}.wav`))
    }
  }

  for (const [id, audio] of approvedAudioById) {
    await replaceGeneratedFile(resolve(campaignDirectory, `${id}.wav`), audio)
  }
  await replaceGeneratedFile(manifestPath, manifestContents)
  await replaceGeneratedFile(serviceWorkerPath, updatedServiceWorker)

  const backupStats = await stat(backupDirectory)
  if (!backupStats.isDirectory()) throw new Error('Approved voice backup was not created.')
  console.log(
    `Promoted ${approval.clips.length} approved clips. Campaign narration is ${manifest.clips.length}/${plan.length} ready.`,
  )
  console.log(`Plan SHA-256: ${manifest.planSha256}`)
  console.log(`Cinematic voice revision: ${revision}`)
  console.log(`Recoverable backup: ${backupDirectory}`)
}

await main()
