import type { CinematicLine, CinematicSpeaker } from './cinematics'

export type CinematicPortraitFrame = 0 | 1 | 2 | 3

export interface CinematicPortrait {
  readonly asset: string
  readonly frame: CinematicPortraitFrame
  readonly label: string
}

const PORTRAIT_ASSET_BY_SPEAKER: Readonly<Record<CinematicSpeaker, string>> = {
  Bearer: 'assets/cinematics/portraits/bearer-expressions.webp',
  'Last Star': 'assets/cinematics/portraits/last-star-expressions.webp',
  'Sun-Eater': 'assets/cinematics/portraits/sun-eater-expressions.webp',
  'Cartographer echo':
    'assets/cinematics/portraits/cartographer-expressions.webp',
}

const PORTRAIT_TONE_BY_SPEAKER_AND_FRAME: Readonly<
  Record<CinematicSpeaker, readonly [string, string, string, string]>
> = {
  Bearer: ['steady', 'strained', 'forceful', 'resolved'],
  'Last Star': ['composed', 'grieving', 'alarmed', 'radiant'],
  'Sun-Eater': ['imperious', 'predatory', 'fractured', 'defeated'],
  'Cartographer echo': ['lucid', 'faltering', 'warning', 'fading'],
}

const PORTRAIT_FRAME_BY_LINE_ID: Readonly<
  Partial<Record<string, CinematicPortraitFrame>>
> = {
  'intro-star-01': 3,
  'intro-star-02': 0,
  'intro-star-03': 2,
  'intro-bearer-01': 1,
  'intro-star-04': 1,
  'intro-bearer-02': 0,
  'intro-star-05': 3,
  'intro-bearer-03': 3,
  'intro-star-06': 3,

  'interlude-01-star-01': 3,
  'interlude-01-bearer-01': 0,
  'interlude-01-star-02': 3,
  'interlude-01-bearer-02': 3,
  'interlude-01-star-03': 3,

  'interlude-02-star-01': 1,
  'interlude-02-bearer-01': 1,
  'interlude-02-star-02': 2,
  'interlude-02-bearer-02': 0,
  'interlude-02-star-03': 1,
  'interlude-02-bearer-03': 0,

  'interlude-03-star-01': 3,
  'interlude-03-bearer-01': 0,
  'interlude-03-star-02': 0,
  'interlude-03-bearer-02': 0,
  'interlude-03-star-03': 3,
  'interlude-03-bearer-03': 3,

  'interlude-04-sun-eater-01': 0,
  'interlude-04-star-01': 2,
  'interlude-04-bearer-01': 1,
  'interlude-04-sun-eater-02': 1,
  'interlude-04-star-02': 2,
  'interlude-04-bearer-02': 0,
  'interlude-04-bearer-03': 3,

  'interlude-05-star-01': 1,
  'interlude-05-bearer-01': 0,
  'interlude-05-star-02': 3,
  'interlude-05-bearer-02': 0,
  'interlude-05-star-03': 2,
  'interlude-05-bearer-03': 3,

  'interlude-06-star-01': 0,
  'interlude-06-bearer-01': 3,
  'interlude-06-star-02': 3,
  'interlude-06-bearer-02': 0,
  'interlude-06-star-03': 2,
  'interlude-06-bearer-03': 3,

  'interlude-07-sun-eater-01': 0,
  'interlude-07-bearer-01': 3,
  'interlude-07-star-01': 2,
  'interlude-07-bearer-02': 0,
  'interlude-07-sun-eater-02': 1,
  'interlude-07-bearer-03': 3,
  'interlude-07-star-02': 1,
  'interlude-07-bearer-04': 3,

  'interlude-08-star-01': 1,
  'interlude-08-bearer-01': 1,
  'interlude-08-star-02': 1,
  'interlude-08-bearer-02': 1,
  'interlude-08-star-03': 1,
  'interlude-08-bearer-03': 1,
  'interlude-08-star-04': 1,
  'interlude-08-bearer-04': 3,

  'interlude-09-cartographer-01': 1,
  'interlude-09-bearer-01': 0,
  'interlude-09-cartographer-02': 2,
  'interlude-09-sun-eater-01': 1,
  'interlude-09-star-01': 2,
  'interlude-09-bearer-02': 0,
  'interlude-09-cartographer-03': 0,
  'interlude-09-star-02': 2,
  'interlude-09-bearer-03': 3,

  'finale-star-01': 3,
  'finale-bearer-01': 0,
  'finale-star-02': 3,
  'finale-bearer-02': 0,
  'finale-star-03': 3,
  'finale-sun-eater-01': 1,
  'finale-star-04': 2,
  'finale-sun-eater-02': 2,
  'finale-star-05': 2,
  'finale-bearer-03': 0,
  'finale-bearer-04': 2,
  'finale-sun-eater-03': 2,
  'finale-star-06': 3,
  'finale-bearer-05': 3,
}

const DEFAULT_FRAME_BY_SPEAKER: Readonly<
  Record<CinematicSpeaker, CinematicPortraitFrame>
> = {
  Bearer: 0,
  'Last Star': 0,
  'Sun-Eater': 0,
  'Cartographer echo': 0,
}

export function getCinematicPortrait(
  line: Pick<CinematicLine, 'id' | 'speaker'>,
): CinematicPortrait {
  const frame =
    PORTRAIT_FRAME_BY_LINE_ID[line.id] ??
    DEFAULT_FRAME_BY_SPEAKER[line.speaker]
  const tone = PORTRAIT_TONE_BY_SPEAKER_AND_FRAME[line.speaker][frame]

  return {
    asset: PORTRAIT_ASSET_BY_SPEAKER[line.speaker],
    frame,
    label: `${line.speaker} ${tone} portrait`,
  }
}

export function hasAuthoredCinematicPortraitFrame(lineId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PORTRAIT_FRAME_BY_LINE_ID, lineId)
}
