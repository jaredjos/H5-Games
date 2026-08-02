import cinematicVoicePlanJson from './cinematicVoicePlan.json'

/**
 * NIGHTTRACE campaign cinema bible.
 *
 * All timing values are milliseconds. The duplicated `startMs` / `endMs` and
 * `durationMs` fields are intentional: the concise values make the data easy
 * to author, while the explicit aliases keep React media players unambiguous.
 */

export type CampaignLevelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type CinematicId =
  | 'intro-a-world-without-dawn'
  | 'interlude-01-the-road-remembers'
  | 'interlude-02-six-voices'
  | 'interlude-03-what-night-couldnt-kill'
  | 'interlude-04-the-reflection-that-waits'
  | 'interlude-05-the-road-beneath-the-tide'
  | 'interlude-06-thunder-opens-the-vault'
  | 'interlude-07-every-ending'
  | 'interlude-08-a-vessel-reforged'
  | 'interlude-09-the-shape-of-the-wake'
  | 'finale-the-first-light'

export type CinematicSpeaker =
  | 'Last Star'
  | 'Bearer'
  | 'Sun-Eater'
  | 'Cartographer echo'

export type CinematicTone =
  | 'mythic'
  | 'hopeful'
  | 'haunted'
  | 'defiant'
  | 'uncanny'
  | 'resolute'
  | 'electric'
  | 'foreboding'
  | 'revelatory'
  | 'apocalyptic'
  | 'radiant'

export type CinematicKind = 'intro' | 'interlude' | 'finale'
export type CinematicFocus = 'world' | 'hero' | 'boss' | 'relic'
export type CinematicHeroAction = 'idle' | 'walk' | 'charge' | 'fire'
export type CinematicTransition = 'fade' | 'cut' | 'dissolve'
export type CinematicVisual =
  | 'sealed-horizon'
  | 'last-star-ember'
  | 'sovereign-crowns'
  | 'bearer-vow'
  | 'memory-road'
  | 'voice-reeds'
  | 'lost-laughter'
  | 'false-reflection'
  | 'drowned-causeway'
  | 'storm-door'
  | 'fractured-hours'
  | 'foundry-origin'
  | 'world-trace'
  | 'eclipse-maw'
  | 'trace-closure'
  | 'shared-dawn'

export interface CinematicLine {
  readonly id: string
  readonly speaker: CinematicSpeaker
  readonly text: string
  readonly start: number
  readonly duration: number
  readonly startMs: number
  readonly endMs: number
  readonly audioSrc?: string
  readonly audioFallbackSrc?: string
  readonly audioStartMs?: number
  readonly audioEndMs?: number
}

export interface CinematicBeat {
  readonly id: string
  readonly start: number
  readonly duration: number
  readonly startMs: number
  readonly endMs: number
  readonly visual: CinematicVisual
  /** Optional shot plate used only for this beat. */
  readonly backgroundAsset?: string
  readonly focus: CinematicFocus
  readonly heroAction: CinematicHeroAction
  readonly transition: CinematicTransition
}

export interface CinematicAtlasFrame {
  readonly column: number
  readonly row: number
  readonly columns: number
  readonly rows: number
}

export interface CampaignCinematic {
  readonly id: CinematicId
  readonly kind: CinematicKind
  readonly title: string
  readonly chapter: string
  readonly chapterLabel: string
  readonly eyebrow: string
  readonly summary: string
  readonly duration: number
  readonly durationMs: number
  readonly afterLevelId?: CampaignLevelId
  readonly nextLevelId?: CampaignLevelId
  readonly arenaAsset: string
  readonly bossAsset?: string
  readonly heroPose: CinematicHeroAction
  readonly bossFrame?: CinematicAtlasFrame
  readonly bossFrameIndex?: number
  readonly tone: CinematicTone
  readonly accent: string
  readonly lines: readonly CinematicLine[]
  readonly beats: readonly CinematicBeat[]
}

export const INTRO_CINEMATIC_ID: CinematicId = 'intro-a-world-without-dawn'
export const FINALE_CINEMATIC_ID: CinematicId = 'finale-the-first-light'

const BOSS_ATLAS = 'assets/nighttrace-boss-atlas.webp'
const CAMPAIGN_AUDIO_ROOT = 'assets/cinematics/audio/campaign'
export const CINEMATIC_VOICE_HEADROOM_MS = 1_600

const cinematicVoiceWindowMs = (maximumMs: number) =>
  maximumMs + CINEMATIC_VOICE_HEADROOM_MS

export interface CinematicVoicePlanEntry {
  readonly id: string
  readonly sceneId: CinematicId
  readonly speaker: CinematicSpeaker
  readonly text: string
  readonly voiceName: string
  readonly maximumMs: number
  readonly direction: string
  readonly delivery?: 'standard' | 'spacious'
}

export const CINEMATIC_VOICE_PLAN = Object.freeze(
  cinematicVoicePlanJson as readonly CinematicVoicePlanEntry[],
)

interface NarrationClip {
  readonly audioSrc: string
  readonly startMs: number
  readonly endMs: number
}

const localCampaignClip = (
  id: string,
  maximumMs: number,
): NarrationClip => ({
  audioSrc: `${CAMPAIGN_AUDIO_ROOT}/${id}.wav`,
  startMs: 0,
  endMs: maximumMs,
})

/**
 * Every campaign line is an independent same-origin Google take. No scene
 * depends on a remote reel, CORS, buffering, or seek offsets.
 */
const NARRATION_CLIPS: Readonly<Record<string, NarrationClip>> =
  Object.freeze(
    Object.fromEntries(
      CINEMATIC_VOICE_PLAN.map((entry) => [
        entry.id,
        localCampaignClip(entry.id, cinematicVoiceWindowMs(entry.maximumMs)),
      ]),
    ),
  )

const VOICE_PLAN_BY_ID = new Map(
  CINEMATIC_VOICE_PLAN.map((entry) => [entry.id, entry] as const),
)

const frame = (index: number): CinematicAtlasFrame => ({
  column: index % 3,
  row: Math.floor(index / 3),
  columns: 3,
  rows: 2,
})

const line = (
  id: string,
  speaker: CinematicSpeaker,
  text: string,
  start: number,
  duration: number,
): CinematicLine => {
  const authored = VOICE_PLAN_BY_ID.get(id)
  const narration = NARRATION_CLIPS[id]
  return {
    id,
    speaker: authored?.speaker ?? speaker,
    text: authored?.text ?? text,
    start,
    duration,
    startMs: start,
    endMs: start + duration,
    ...(narration
      ? {
          audioSrc: narration.audioSrc,
          audioStartMs: narration.startMs,
          audioEndMs: narration.endMs,
        }
      : {}),
  }
}

const dialogue = (ids: readonly string[]): readonly CinematicLine[] => {
  let cursor = CINEMATIC_LEAD_IN_MS
  return ids.map((id) => {
    const authored = VOICE_PLAN_BY_ID.get(id)
    if (!authored) throw new Error(`Missing cinematic voice plan entry: ${id}`)
    const duration = cinematicVoiceWindowMs(authored.maximumMs) + 220
    const entry = line(
      id,
      authored.speaker,
      authored.text,
      cursor,
      duration,
    )
    cursor = entry.endMs + CINEMATIC_DIALOGUE_GAP_MS
    return entry
  })
}

const beat = (
  id: string,
  start: number,
  duration: number,
  visual: CinematicVisual,
  focus: CinematicFocus,
  heroAction: CinematicHeroAction,
  transition: CinematicTransition,
  backgroundAsset?: string,
): CinematicBeat => ({
  id,
  start,
  duration,
  startMs: start,
  endMs: start + duration,
  visual,
  focus,
  heroAction,
  transition,
  ...(backgroundAsset ? { backgroundAsset } : {}),
})

export const CINEMATIC_LEAD_IN_MS = 1_100
export const CINEMATIC_DIALOGUE_GAP_MS = 560
export const CINEMATIC_OUTRO_MS = 850

function scaleVisualBeats(
  beats: readonly CinematicBeat[],
  sourceDuration: number,
  targetDuration: number,
) {
  let cursor = 0
  return beats.map((entry, index) => {
    const isLast = index === beats.length - 1
    const sourceEnd = entry.start + entry.duration
    const scaledEnd = isLast
      ? targetDuration
      : Math.max(cursor + 1, Math.round((sourceEnd / sourceDuration) * targetDuration))
    const scaled = {
      ...entry,
      start: cursor,
      startMs: cursor,
      duration: scaledEnd - cursor,
      endMs: scaledEnd,
    }
    cursor = scaledEnd
    return scaled
  })
}

const cinema = (
  cinematic: Omit<
    CampaignCinematic,
    'chapterLabel' | 'durationMs'
  >,
): CampaignCinematic => {
  const lastLine = cinematic.lines.at(-1)
  const duration = Math.max(
    cinematic.duration,
    (lastLine?.endMs ?? CINEMATIC_LEAD_IN_MS) + CINEMATIC_OUTRO_MS,
  )

  return {
    ...cinematic,
    duration,
    durationMs: duration,
    lines: cinematic.lines,
    beats: scaleVisualBeats(cinematic.beats, cinematic.duration, duration),
    chapterLabel: cinematic.chapter,
  }
}

export const CAMPAIGN_CINEMATICS = Object.freeze([
  cinema({
    id: INTRO_CINEMATIC_ID,
    kind: 'intro',
    title: 'A World Without Dawn',
    chapter: 'Prologue',
    eyebrow: 'Before the First Beacon',
    summary:
      'The Last Star wakes the unnamed Bearer and reveals ten Sovereigns holding ten severed memories of daylight.',
    duration: 50_000,
    nextLevelId: 1,
    arenaAsset: 'assets/cinematics/intro-a-world-without-dawn.webp',
    heroPose: 'walk',
    tone: 'mythic',
    accent: '#f5d98a',
    lines: dialogue([
      'intro-star-01',
      'intro-star-02',
      'intro-star-03',
      'intro-bearer-01',
      'intro-star-04',
      'intro-bearer-02',
      'intro-star-05',
      'intro-bearer-03',
      'intro-star-06',
    ]),
    beats: [
      beat('intro-01', 0, 7_200, 'sealed-horizon', 'world', 'idle', 'fade'),
      beat('intro-02', 7_200, 7_200, 'last-star-ember', 'relic', 'idle', 'dissolve'),
      beat('intro-03', 14_400, 6_600, 'sovereign-crowns', 'boss', 'idle', 'dissolve'),
      beat('intro-04', 21_000, 6_000, 'bearer-vow', 'hero', 'charge', 'cut'),
      beat('intro-05', 27_000, 9_000, 'memory-road', 'hero', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: 'interlude-01-the-road-remembers',
    kind: 'interlude',
    title: 'The Road Remembers',
    chapter: 'Memory I',
    eyebrow: 'First Beacon Restored',
    summary:
      'The first recovered memory is not a place but a direction: daylight once connected every road.',
    duration: 28_000,
    afterLevelId: 1,
    nextLevelId: 2,
    arenaAsset: 'assets/first-beacon-arena.webp',
    heroPose: 'walk',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(0),
    bossFrameIndex: 0,
    tone: 'hopeful',
    accent: '#7cf7d4',
    lines: dialogue([
      'interlude-01-star-01',
      'interlude-01-bearer-01',
      'interlude-01-star-02',
      'interlude-01-bearer-02',
      'interlude-01-star-03',
    ]),
    beats: [
      beat('interlude-01-01', 0, 5_000, 'memory-road', 'world', 'idle', 'fade'),
      beat('interlude-01-02', 5_000, 5_000, 'bearer-vow', 'hero', 'walk', 'cut'),
      beat('interlude-01-03', 10_000, 5_000, 'last-star-ember', 'relic', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: 'interlude-02-six-voices',
    kind: 'interlude',
    title: 'Six Voices',
    chapter: 'Memory II',
    eyebrow: 'Glassreed Mire Silenced',
    summary:
      'The Mire releases the voices it consumed; the Bearer chooses remembrance over vengeance.',
    duration: 32_000,
    afterLevelId: 2,
    nextLevelId: 3,
    arenaAsset: 'assets/glassreed-mire-arena.webp',
    heroPose: 'idle',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(1),
    bossFrameIndex: 1,
    tone: 'haunted',
    accent: '#65d9b0',
    lines: dialogue([
      'interlude-02-star-01',
      'interlude-02-bearer-01',
      'interlude-02-star-02',
      'interlude-02-bearer-02',
      'interlude-02-star-03',
      'interlude-02-bearer-03',
    ]),
    beats: [
      beat('interlude-02-01', 0, 5_500, 'voice-reeds', 'boss', 'idle', 'fade'),
      beat('interlude-02-02', 5_500, 6_000, 'bearer-vow', 'hero', 'idle', 'dissolve'),
      beat('interlude-02-03', 11_500, 5_500, 'last-star-ember', 'world', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: 'interlude-03-what-night-couldnt-kill',
    kind: 'interlude',
    title: 'What Night Couldn’t Kill',
    chapter: 'Memory III',
    eyebrow: 'Shattered Arcade Reclaimed',
    summary:
      'A memory of laughter survives the ruined district, becoming an act of defiance instead of nostalgia.',
    duration: 32_000,
    afterLevelId: 3,
    nextLevelId: 4,
    arenaAsset: 'assets/cinematics/interlude-03-shattered-arcade.webp',
    heroPose: 'walk',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(2),
    bossFrameIndex: 2,
    tone: 'defiant',
    accent: '#ffcf63',
    lines: dialogue([
      'interlude-03-star-01',
      'interlude-03-bearer-01',
      'interlude-03-star-02',
      'interlude-03-bearer-02',
      'interlude-03-star-03',
      'interlude-03-bearer-03',
    ]),
    beats: [
      beat('interlude-03-01', 0, 5_500, 'lost-laughter', 'world', 'idle', 'fade'),
      beat('interlude-03-02', 5_500, 5_000, 'bearer-vow', 'hero', 'walk', 'cut'),
      beat(
        'interlude-03-03',
        10_500,
        5_500,
        'memory-road',
        'world',
        'walk',
        'dissolve',
        'assets/campaign-disk-background.webp',
      ),
    ],
  }),
  cinema({
    id: 'interlude-04-the-reflection-that-waits',
    kind: 'interlude',
    title: 'The Reflection That Waits',
    chapter: 'Memory IV',
    eyebrow: 'Prism Garden Broken',
    summary:
      'The Sun-Eater speaks through the shattered mirrors, but the Bearer finds a reflection beyond its control.',
    duration: 36_000,
    afterLevelId: 4,
    nextLevelId: 5,
    arenaAsset: 'assets/cinematics/interlude-04-prism-garden.webp',
    heroPose: 'charge',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(3),
    bossFrameIndex: 3,
    tone: 'uncanny',
    accent: '#d4a5ff',
    lines: dialogue([
      'interlude-04-sun-eater-01',
      'interlude-04-star-01',
      'interlude-04-bearer-01',
      'interlude-04-sun-eater-02',
      'interlude-04-star-02',
      'interlude-04-bearer-02',
      'interlude-04-bearer-03',
    ]),
    beats: [
      beat('interlude-04-01', 0, 5_000, 'false-reflection', 'boss', 'idle', 'fade'),
      beat('interlude-04-02', 5_000, 4_000, 'last-star-ember', 'relic', 'idle', 'cut'),
      beat('interlude-04-03', 9_000, 5_000, 'bearer-vow', 'hero', 'charge', 'cut'),
      beat('interlude-04-04', 14_000, 4_000, 'memory-road', 'world', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: 'interlude-05-the-road-beneath-the-tide',
    kind: 'interlude',
    title: 'The Road Beneath the Tide',
    chapter: 'Memory V',
    eyebrow: 'Drowned Docks Raised',
    summary:
      'Beneath the black tide, the next causeway remains intact—proof that burial is not erasure.',
    duration: 34_000,
    afterLevelId: 5,
    nextLevelId: 6,
    arenaAsset: 'assets/cinematics/interlude-05-drowned-causeway.webp',
    heroPose: 'walk',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(1),
    bossFrameIndex: 1,
    tone: 'resolute',
    accent: '#57b7ff',
    lines: dialogue([
      'interlude-05-star-01',
      'interlude-05-bearer-01',
      'interlude-05-star-02',
      'interlude-05-bearer-02',
      'interlude-05-star-03',
      'interlude-05-bearer-03',
    ]),
    beats: [
      beat('interlude-05-01', 0, 5_000, 'drowned-causeway', 'world', 'idle', 'fade'),
      beat('interlude-05-02', 5_000, 5_000, 'bearer-vow', 'hero', 'walk', 'cut'),
      beat('interlude-05-03', 10_000, 5_000, 'memory-road', 'world', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: 'interlude-06-thunder-opens-the-vault',
    kind: 'interlude',
    title: 'Thunder Opens the Vault',
    chapter: 'Memory VI',
    eyebrow: 'Stormrail Conducted',
    summary:
      'The last current becomes a key, opening a door erased from every surviving map.',
    duration: 34_000,
    afterLevelId: 6,
    nextLevelId: 7,
    arenaAsset: 'assets/cinematics/interlude-06-stormrail-vault.webp',
    heroPose: 'fire',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(4),
    bossFrameIndex: 4,
    tone: 'electric',
    accent: '#9ca7ff',
    lines: dialogue([
      'interlude-06-star-01',
      'interlude-06-bearer-01',
      'interlude-06-star-02',
      'interlude-06-bearer-02',
      'interlude-06-star-03',
      'interlude-06-bearer-03',
    ]),
    beats: [
      beat('interlude-06-01', 0, 5_000, 'storm-door', 'boss', 'charge', 'fade'),
      beat('interlude-06-02', 5_000, 5_000, 'bearer-vow', 'hero', 'fire', 'cut'),
      beat('interlude-06-03', 10_000, 5_000, 'memory-road', 'world', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: 'interlude-07-every-ending',
    kind: 'interlude',
    title: 'Every Ending',
    chapter: 'Memory VII',
    eyebrow: 'Hourglass Vault Unsealed',
    summary:
      'The Sun-Eater mistakes observation for victory; beyond the broken hours, the Foundry answers.',
    duration: 40_000,
    afterLevelId: 7,
    nextLevelId: 8,
    arenaAsset: 'assets/cinematics/interlude-07-hourglass-vault.webp',
    heroPose: 'walk',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(4),
    bossFrameIndex: 4,
    tone: 'foreboding',
    accent: '#8de9ff',
    lines: dialogue([
      'interlude-07-sun-eater-01',
      'interlude-07-bearer-01',
      'interlude-07-star-01',
      'interlude-07-bearer-02',
      'interlude-07-sun-eater-02',
      'interlude-07-bearer-03',
      'interlude-07-star-02',
      'interlude-07-bearer-04',
    ]),
    beats: [
      beat('interlude-07-01', 0, 5_500, 'fractured-hours', 'boss', 'idle', 'fade'),
      beat('interlude-07-02', 5_500, 4_000, 'bearer-vow', 'hero', 'idle', 'cut'),
      beat('interlude-07-03', 9_500, 5_500, 'foundry-origin', 'relic', 'walk', 'dissolve'),
      beat('interlude-07-04', 15_000, 5_000, 'memory-road', 'world', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: 'interlude-08-a-vessel-reforged',
    kind: 'interlude',
    title: 'A Vessel, Reforged',
    chapter: 'Memory VIII',
    eyebrow: 'Cinder Foundry Extinguished',
    summary:
      'The Foundry reveals the Bearer was made as a vessel; the Bearer claims the right to become something else.',
    duration: 42_000,
    afterLevelId: 8,
    nextLevelId: 9,
    arenaAsset: 'assets/cinder-foundry-arena.webp',
    heroPose: 'charge',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(2),
    bossFrameIndex: 2,
    tone: 'revelatory',
    accent: '#ff784f',
    lines: dialogue([
      'interlude-08-star-01',
      'interlude-08-bearer-01',
      'interlude-08-star-02',
      'interlude-08-bearer-02',
      'interlude-08-star-03',
      'interlude-08-bearer-03',
      'interlude-08-star-04',
      'interlude-08-bearer-04',
    ]),
    beats: [
      beat('interlude-08-01', 0, 5_000, 'foundry-origin', 'relic', 'idle', 'fade'),
      beat('interlude-08-02', 5_000, 6_000, 'bearer-vow', 'hero', 'charge', 'cut'),
      beat('interlude-08-03', 11_000, 6_000, 'last-star-ember', 'hero', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: 'interlude-09-the-shape-of-the-wake',
    kind: 'interlude',
    title: 'The Shape of the Wake',
    chapter: 'Memory IX',
    eyebrow: 'Void Observatory Aligned',
    summary:
      'The recovered sectors reveal a world-scale Trace. It was the Sun-Eater’s bait—and is now the Bearer’s weapon.',
    duration: 46_000,
    afterLevelId: 9,
    nextLevelId: 10,
    arenaAsset: 'assets/cinematics/interlude-09-void-observatory.webp',
    heroPose: 'charge',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(3),
    bossFrameIndex: 3,
    tone: 'apocalyptic',
    accent: '#6d74ff',
    lines: dialogue([
      'interlude-09-cartographer-01',
      'interlude-09-bearer-01',
      'interlude-09-cartographer-02',
      'interlude-09-sun-eater-01',
      'interlude-09-star-01',
      'interlude-09-bearer-02',
      'interlude-09-cartographer-03',
      'interlude-09-star-02',
      'interlude-09-bearer-03',
    ]),
    beats: [
      beat('interlude-09-01', 0, 4_500, 'false-reflection', 'boss', 'idle', 'fade'),
      beat('interlude-09-02', 4_500, 5_000, 'eclipse-maw', 'boss', 'idle', 'cut'),
      beat('interlude-09-03', 9_500, 4_000, 'world-trace', 'world', 'charge', 'dissolve'),
      beat('interlude-09-04', 13_500, 5_000, 'bearer-vow', 'hero', 'charge', 'cut'),
      beat('interlude-09-05', 18_500, 4_500, 'trace-closure', 'world', 'walk', 'dissolve'),
    ],
  }),
  cinema({
    id: FINALE_CINEMATIC_ID,
    kind: 'finale',
    title: 'The First Light',
    chapter: 'Finale',
    eyebrow: 'The Crown of Dawn',
    summary:
      'The Sun-Eater springs its trap. The Bearer closes the ten-sector Trace, releasing the Last Star as a dawn shared by everyone.',
    duration: 62_000,
    afterLevelId: 10,
    arenaAsset: 'assets/cinematics/finale-the-first-light.webp',
    heroPose: 'fire',
    tone: 'radiant',
    accent: '#ffd979',
    lines: dialogue([
      'finale-star-01',
      'finale-bearer-01',
      'finale-star-02',
      'finale-bearer-02',
      'finale-star-03',
      'finale-sun-eater-01',
      'finale-star-04',
      'finale-sun-eater-02',
      'finale-star-05',
      'finale-bearer-03',
      'finale-bearer-04',
      'finale-sun-eater-03',
      'finale-star-06',
      'finale-bearer-05',
    ]),
    beats: [
      beat('finale-01', 0, 4_500, 'eclipse-maw', 'boss', 'idle', 'fade'),
      beat('finale-02', 4_500, 4_500, 'last-star-ember', 'relic', 'charge', 'cut'),
      beat('finale-03', 9_000, 5_000, 'eclipse-maw', 'boss', 'charge', 'dissolve'),
      beat('finale-04', 14_000, 5_000, 'world-trace', 'hero', 'charge', 'cut'),
      beat('finale-05', 19_000, 5_000, 'trace-closure', 'hero', 'fire', 'cut'),
      beat('finale-06', 24_000, 6_000, 'last-star-ember', 'relic', 'idle', 'dissolve'),
      beat('finale-07', 30_000, 7_000, 'shared-dawn', 'world', 'walk', 'dissolve'),
      beat('finale-08', 37_000, 5_000, 'shared-dawn', 'hero', 'walk', 'fade'),
    ],
  }),
] as const satisfies readonly CampaignCinematic[])

export const CINEMATIC_BY_ID = Object.freeze(
  Object.fromEntries(
    CAMPAIGN_CINEMATICS.map((cinematic) => [cinematic.id, cinematic]),
  ) as Record<CinematicId, CampaignCinematic>,
)

const CINEMATIC_AFTER_LEVEL = Object.freeze(
  Object.fromEntries(
    CAMPAIGN_CINEMATICS.flatMap((cinematic) =>
      cinematic.afterLevelId === undefined
        ? []
        : [[cinematic.afterLevelId, cinematic] as const],
    ),
  ) as Partial<Record<CampaignLevelId, CampaignCinematic>>,
)

export function cinematicForFirstClear(levelId: number): CampaignCinematic | undefined {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 10) return undefined
  return CINEMATIC_AFTER_LEVEL[levelId as CampaignLevelId]
}

export function getCinematic(id: CinematicId | string): CampaignCinematic | undefined {
  return CINEMATIC_BY_ID[id as CinematicId]
}

/**
 * Save migration helper for players whose campaign predates cinematics.
 * Existing progress implies the intro was seen; each recorded first clear
 * marks only its matching interlude or finale as seen.
 */
export function cinematicIdsForCompletedLevels(
  completedLevels: readonly number[],
): CinematicId[] {
  const completed = new Set(
    completedLevels.filter(
      (levelId): levelId is CampaignLevelId =>
        Number.isInteger(levelId) && levelId >= 1 && levelId <= 10,
    ),
  )

  if (completed.size === 0) return []

  const seen: CinematicId[] = [INTRO_CINEMATIC_ID]
  for (let levelId = 1; levelId <= 10; levelId += 1) {
    if (!completed.has(levelId as CampaignLevelId)) continue
    const cinematic = cinematicForFirstClear(levelId)
    if (cinematic) seen.push(cinematic.id)
  }
  return seen
}
