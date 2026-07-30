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
  readonly audioSrc: string
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
  readonly heroAsset: string
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

const HERO_ASSET_BY_POSE: Readonly<Record<CinematicHeroAction, string>> = {
  idle: 'assets/nighttrace-title-hero-v2.png',
  walk: 'assets/hero-animations/hero-walk-runtime.webp',
  charge: 'assets/hero-animations/hero-charge-runtime.webp',
  fire: 'assets/hero-animations/hero-fire-runtime.webp',
}

const BOSS_ATLAS = 'assets/nighttrace-boss-atlas.webp'

const NARRATION_REMOTE_REELS = {
  star:
    'https://resource2.heygen.ai/text_to_speech/eff3caa328f246b192c5cc03e7f2d48a/0fe77e0eee104bc78469a57bbe1a6550/id=d39ed1ef-e7fe-4b5d-b3e0-11d8c3bb0d19.wav',
  bearer:
    'https://resource2.heygen.ai/text_to_speech/eff3caa328f246b192c5cc03e7f2d48a/0a0b38624ac64ec6afcd5842a977ca10/id=9aa06026-f195-4240-ac7f-662c321d8792.wav',
  sovereign:
    'https://resource2.heygen.ai/text_to_speech/eff3caa328f246b192c5cc03e7f2d48a/054af44a167344d0af2722fdfef08d17/id=96c84639-68a6-4181-a103-ec628a0e985c.wav',
} as const

const NARRATION_LOCAL_REELS = {
  star: 'assets/cinematics/audio/last-star.mp3',
  bearer: 'assets/cinematics/audio/bearer.mp3',
  sovereign: 'assets/cinematics/audio/sun-eater.mp3',
} as const

interface NarrationClip {
  readonly audioSrc: string
  readonly audioFallbackSrc: string
  readonly startMs: number
  readonly endMs: number
}

const clip = (
  reel: keyof typeof NARRATION_REMOTE_REELS,
  startMs: number,
  endMs: number,
): NarrationClip => ({
  audioSrc: NARRATION_LOCAL_REELS[reel],
  audioFallbackSrc: NARRATION_REMOTE_REELS[reel],
  startMs,
  endMs,
})

/**
 * Actor reels are deliberately shipped as three cacheable performances rather
 * than dozens of tiny requests. Each story line seeks into its authored take.
 * Captions remain the deterministic fallback when a browser is offline.
 */
const NARRATION_CLIPS: Readonly<Record<string, NarrationClip>> = {
  'intro-star-01': clip('star', 239, 8_099),
  'intro-star-02': clip('star', 8_920, 15_799),
  'intro-star-03': clip('star', 16_139, 19_199),
  'intro-star-04': clip('star', 20_219, 23_920),
  'interlude-01-star-01': clip('star', 24_760, 27_979),
  'interlude-02-star-01': clip('star', 28_799, 31_760),
  'interlude-03-star-01': clip('star', 33_419, 37_279),
  'interlude-04-star-01': clip('star', 38_059, 38_799),
  'interlude-05-star-01': clip('star', 39_479, 41_719),
  'interlude-06-star-01': clip('star', 42_040, 45_159),
  'interlude-07-star-01': clip('star', 46_239, 48_459),
  'interlude-08-star-01': clip('star', 49_159, 50_619),
  'interlude-09-star-01': clip('star', 51_299, 52_459),
  'finale-star-01': clip('star', 52_799, 55_259),
  'finale-star-02': clip('star', 56_520, 59_619),
  'finale-star-03': clip('star', 60_180, 63_439),

  'intro-bearer-01': clip('bearer', 140, 1_620),
  'interlude-01-bearer-01': clip('bearer', 2_180, 3_220),
  'interlude-02-bearer-01': clip('bearer', 3_720, 6_399),
  'interlude-03-bearer-01': clip('bearer', 6_899, 8_659),
  'interlude-04-bearer-01': clip('bearer', 8_979, 10_559),
  'interlude-05-bearer-01': clip('bearer', 11_079, 12_239),
  'interlude-06-bearer-01': clip('bearer', 12_739, 13_640),
  'interlude-07-bearer-01': clip('bearer', 14_119, 15_100),
  'interlude-08-bearer-01': clip('bearer', 15_500, 17_000),
  'interlude-09-bearer-01': clip('bearer', 17_539, 20_379),
  'finale-bearer-01': clip('bearer', 20_760, 21_540),
  'finale-bearer-02': clip('bearer', 22_139, 22_459),
  'finale-bearer-03': clip('bearer', 23_039, 24_879),

  'interlude-04-sun-eater-01': clip('sovereign', 140, 2_619),
  'interlude-07-sun-eater-01': clip('sovereign', 3_279, 5_539),
  'interlude-09-cartographer-01': clip('sovereign', 6_139, 7_159),
  'interlude-09-sun-eater-01': clip('sovereign', 7_559, 10_719),
  'finale-sun-eater-01': clip('sovereign', 10_760, 13_840),
  'finale-sun-eater-02': clip('sovereign', 14_839, 15_679),
}

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
  const narration = NARRATION_CLIPS[id]
  return {
    id,
    speaker,
    text,
    start,
    duration,
    startMs: start,
    endMs: start + duration,
    audioSrc: narration?.audioSrc ?? `assets/cinematics/audio/${id}.mp3`,
    audioFallbackSrc: narration?.audioFallbackSrc,
    audioStartMs: narration?.startMs,
    audioEndMs: narration?.endMs,
  }
}

const beat = (
  id: string,
  start: number,
  duration: number,
  visual: CinematicVisual,
  focus: CinematicFocus,
  heroAction: CinematicHeroAction,
  transition: CinematicTransition,
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
})

const cinema = (
  cinematic: Omit<
    CampaignCinematic,
    'chapterLabel' | 'durationMs' | 'heroAsset'
  >,
): CampaignCinematic => ({
  ...cinematic,
  chapterLabel: cinematic.chapter,
  durationMs: cinematic.duration,
  heroAsset: HERO_ASSET_BY_POSE[cinematic.heroPose],
})

export const CAMPAIGN_CINEMATICS = Object.freeze([
  cinema({
    id: INTRO_CINEMATIC_ID,
    kind: 'intro',
    title: 'A World Without Dawn',
    chapter: 'Prologue',
    eyebrow: 'Before the First Beacon',
    summary:
      'The Last Star wakes the unnamed Bearer and reveals ten Sovereigns holding ten severed memories of daylight.',
    duration: 36_000,
    nextLevelId: 1,
    arenaAsset: 'assets/cinematics/intro-a-world-without-dawn.webp',
    heroPose: 'walk',
    tone: 'mythic',
    accent: '#f5d98a',
    lines: [
      line(
        'intro-star-01',
        'Last Star',
        'Once, dawn crossed this world in a single breath. Then the horizon learned to close.',
        1_200,
        7_900,
      ),
      line(
        'intro-star-02',
        'Last Star',
        'I survived as a spark. Not enough to become day. Enough to remember it.',
        10_000,
        6_900,
      ),
      line(
        'intro-star-03',
        'Last Star',
        'Ten Sovereigns keep the morning chained.',
        18_000,
        3_400,
      ),
      line(
        'intro-bearer-01',
        'Bearer',
        'Then we break ten crowns.',
        22_200,
        2_500,
      ),
      line(
        'intro-star-04',
        'Last Star',
        'Walk, Bearer. I will burn in every step.',
        28_400,
        3_900,
      ),
    ],
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
    duration: 15_000,
    afterLevelId: 1,
    nextLevelId: 2,
    arenaAsset: 'assets/first-beacon-arena.webp',
    heroPose: 'walk',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(0),
    bossFrameIndex: 0,
    tone: 'hopeful',
    accent: '#7cf7d4',
    lines: [
      line(
        'interlude-01-star-01',
        'Last Star',
        'The first fire remembers where the roads once led.',
        1_100,
        3_700,
      ),
      line('interlude-01-bearer-01', 'Bearer', 'Then let it lead us.', 6_100, 2_100),
    ],
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
    duration: 17_000,
    afterLevelId: 2,
    nextLevelId: 3,
    arenaAsset: 'assets/glassreed-mire-arena.webp',
    heroPose: 'idle',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(1),
    bossFrameIndex: 1,
    tone: 'haunted',
    accent: '#65d9b0',
    lines: [
      line(
        'interlude-02-star-01',
        'Last Star',
        'Six voices. None of them were the monster.',
        1_200,
        3_400,
      ),
      line(
        'interlude-02-bearer-01',
        'Bearer',
        'We carry the voices. Leave the monster here.',
        6_800,
        3_600,
      ),
    ],
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
    duration: 16_000,
    afterLevelId: 3,
    nextLevelId: 4,
    arenaAsset: 'assets/campaign-disk-background.webp',
    heroPose: 'walk',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(2),
    bossFrameIndex: 2,
    tone: 'defiant',
    accent: '#ffcf63',
    lines: [
      line(
        'interlude-03-star-01',
        'Last Star',
        'They laughed here, even while the sky was failing.',
        1_200,
        3_900,
      ),
      line(
        'interlude-03-bearer-01',
        'Bearer',
        'Good. Let the night hear them.',
        6_500,
        2_800,
      ),
    ],
    beats: [
      beat('interlude-03-01', 0, 5_500, 'lost-laughter', 'world', 'idle', 'fade'),
      beat('interlude-03-02', 5_500, 5_000, 'bearer-vow', 'hero', 'walk', 'cut'),
      beat('interlude-03-03', 10_500, 5_500, 'memory-road', 'world', 'walk', 'dissolve'),
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
    duration: 18_000,
    afterLevelId: 4,
    nextLevelId: 5,
    arenaAsset: 'assets/campaign-disk-background.webp',
    heroPose: 'charge',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(3),
    bossFrameIndex: 3,
    tone: 'uncanny',
    accent: '#d4a5ff',
    lines: [
      line(
        'interlude-04-sun-eater-01',
        'Sun-Eater',
        'Every reflection ends inside me.',
        1_100,
        3_200,
      ),
      line('interlude-04-star-01', 'Last Star', 'Don’t look.', 5_700, 1_500),
      line(
        'interlude-04-bearer-01',
        'Bearer',
        'I saw the one that doesn’t.',
        9_000,
        2_800,
      ),
    ],
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
    duration: 15_000,
    afterLevelId: 5,
    nextLevelId: 6,
    arenaAsset: 'assets/glassreed-mire-arena.webp',
    heroPose: 'walk',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(1),
    bossFrameIndex: 1,
    tone: 'resolute',
    accent: '#57b7ff',
    lines: [
      line(
        'interlude-05-star-01',
        'Last Star',
        'The sea buried the final road.',
        1_200,
        2_900,
      ),
      line('interlude-05-bearer-01', 'Bearer', 'Buried isn’t gone.', 6_000, 2_100),
    ],
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
    duration: 15_000,
    afterLevelId: 6,
    nextLevelId: 7,
    arenaAsset: 'assets/campaign-disk-background.webp',
    heroPose: 'fire',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(4),
    bossFrameIndex: 4,
    tone: 'electric',
    accent: '#9ca7ff',
    lines: [
      line(
        'interlude-06-star-01',
        'Last Star',
        'The Engine guarded a door no map remembers.',
        1_100,
        3_600,
      ),
      line('interlude-06-bearer-01', 'Bearer', 'The thunder remembered.', 6_300, 2_400),
    ],
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
    duration: 20_000,
    afterLevelId: 7,
    nextLevelId: 8,
    arenaAsset: 'assets/campaign-disk-background.webp',
    heroPose: 'walk',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(4),
    bossFrameIndex: 4,
    tone: 'foreboding',
    accent: '#8de9ff',
    lines: [
      line(
        'interlude-07-sun-eater-01',
        'Sun-Eater',
        'I have watched you fail in every hour.',
        1_100,
        3_400,
      ),
      line('interlude-07-bearer-01', 'Bearer', 'You only watched.', 6_200, 2_000),
      line(
        'interlude-07-star-01',
        'Last Star',
        'The Foundry still burns beneath us.',
        10_000,
        3_100,
      ),
    ],
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
    duration: 17_000,
    afterLevelId: 8,
    nextLevelId: 9,
    arenaAsset: 'assets/cinder-foundry-arena.webp',
    heroPose: 'charge',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(2),
    bossFrameIndex: 2,
    tone: 'revelatory',
    accent: '#ff784f',
    lines: [
      line(
        'interlude-08-star-01',
        'Last Star',
        'They made you to carry me.',
        1_200,
        2_800,
      ),
      line(
        'interlude-08-bearer-01',
        'Bearer',
        'They don’t choose what I become.',
        6_200,
        3_000,
      ),
    ],
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
    duration: 23_000,
    afterLevelId: 9,
    nextLevelId: 10,
    arenaAsset: 'assets/campaign-disk-background.webp',
    heroPose: 'charge',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(3),
    bossFrameIndex: 3,
    tone: 'apocalyptic',
    accent: '#6d74ff',
    lines: [
      line(
        'interlude-09-cartographer-01',
        'Cartographer echo',
        'The map… was bait.',
        1_000,
        2_500,
      ),
      line(
        'interlude-09-sun-eater-01',
        'Sun-Eater',
        'Complete the circuit. Bring me the star.',
        5_000,
        3_400,
      ),
      line('interlude-09-star-01', 'Last Star', 'It used our wake.', 10_000, 2_200),
      line(
        'interlude-09-bearer-01',
        'Bearer',
        'Yes—and taught us where to close the line.',
        13_800,
        3_500,
      ),
    ],
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
    duration: 42_000,
    afterLevelId: 10,
    arenaAsset: 'assets/cinematics/finale-the-first-light.webp',
    heroPose: 'fire',
    bossAsset: BOSS_ATLAS,
    bossFrame: frame(5),
    bossFrameIndex: 5,
    tone: 'radiant',
    accent: '#ffd979',
    lines: [
      line(
        'finale-star-01',
        'Last Star',
        'It isn’t dying. It’s opening.',
        1_100,
        2_900,
      ),
      line(
        'finale-sun-eater-01',
        'Sun-Eater',
        'At last. The final light.',
        5_000,
        3_200,
      ),
      line(
        'finale-star-02',
        'Last Star',
        'If it takes me, the world goes dark.',
        9_200,
        3_300,
      ),
      line('finale-bearer-01', 'Bearer', 'Trust the path.', 14_200, 2_000),
      line('finale-bearer-02', 'Bearer', 'Now.', 18_000, 1_100),
      line(
        'finale-sun-eater-02',
        'Sun-Eater',
        'What have you—',
        20_600,
        2_000,
      ),
      line(
        'finale-star-03',
        'Last Star',
        'I was never the last light. I was the first.',
        24_300,
        3_800,
      ),
      line(
        'finale-bearer-03',
        'Bearer',
        'Then let morning belong to everyone.',
        30_200,
        3_400,
      ),
    ],
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
