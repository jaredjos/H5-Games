import type { CSSProperties } from 'react'
import { appAssetUrl } from '../assetUrl'
import { WEAPONS } from '../game/content'
import { cinderwakeReaverPresentationProfile } from '../game/persistentSpellChoreography'
import type { OwnedWeapon, WeaponId } from '../shared/types'
import { AtlasSprite, WeaponGlyph } from './Primitives'

const LAB_REVIEW_SPELLS = new Set<WeaponId>([
  'helio-lance',
  'crescent-array',
  'arc-choir',
  'rift-seeds',
  'comet-swarm',
  'mirror-bow',
])

const RANK_TITLES: Record<WeaponId, readonly string[]> = {
  'helio-lance': [
    'Dormant',
    'Gilded Needle',
    'Twin-channel Lance',
    'Solar Filament',
    'Crownflight',
    'Zenith Lance',
    'Crowned Spear',
  ],
  'crescent-array': [
    'Dormant',
    'Moonshard Pair',
    'Silver Orbit',
    'Astral Quorum',
    'Tidewheel',
    'Full Array',
    'Eclipse Wheel',
  ],
  'arc-choir': [
    'Dormant',
    'First Canticle',
    'Resonant Triad',
    'Choirline',
    'Cathedral Chord',
    'Storm Liturgy',
    'Cathedral Storm',
  ],
  'rift-seeds': [
    'Dormant',
    'First Judgment',
    'Forked Omen',
    'Storm Litany',
    'Astral Tribunal',
    'Crownfall',
    "Heaven's Sentence",
  ],
  'comet-swarm': [
    'Dormant',
    'Ember Scout',
    'Hunting Pair',
    'Radiant Pack',
    'Perihelion Flight',
    'Solar Pursuit',
    'Perihelion Hunt',
  ],
  'ash-halo': ['Campaign-authored', 'Campaign-authored'],
  'mirror-bow': [
    'Dormant',
    'First Reaver',
    'Tempered Pursuit',
    'Twin Cinder Hunt',
    'Bloodglass Ricochet',
    'Reaver Procession',
    'Ravenous Eventide',
  ],
  'null-bell': ['Campaign-authored', 'Campaign-authored'],
}

const RANK_ROMAN = ['Off', 'I', 'II', 'III', 'IV', 'V'] as const

const VERDICT_POSITIONS = [
  [27, 33],
  [72, 31],
  [31, 71],
  [70, 69],
  [50, 19],
  [50, 51],
] as const

const ARC_POSITIONS = [
  [25, 31],
  [72, 27],
  [79, 65],
  [31, 72],
  [51, 17],
  [52, 79],
] as const

const CINDERWAKE_PATHS = ['alpha', 'beta', 'gamma', 'delta'] as const

function particleStyle(index: number, count: number): CSSProperties {
  const angle = (index / Math.max(1, count)) * Math.PI * 2
  const radius = 30 + (index % 3) * 7
  return {
    '--particle-x': `${50 + Math.cos(angle) * radius}%`,
    '--particle-y': `${49 + Math.sin(angle) * radius * 0.58}%`,
    '--particle-delay': `${-(index % 7) * 0.19}s`,
  } as CSSProperties
}

function HelioLanceEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const shardCount = density + (awakened ? 4 : 0)
  return (
    <div className="spell-theater-effect spell-theater-effect--helio" aria-hidden="true">
      <span className="spell-theater-lance spell-theater-lance--wake" />
      <span className="spell-theater-lance spell-theater-lance--body" />
      <span className="spell-theater-lance spell-theater-lance--core" />
      {Array.from({ length: shardCount }, (_, index) => (
        <i
          className="spell-theater-shard"
          key={index}
          style={{
            '--shard-angle': `${(index - (shardCount - 1) / 2) * 7}deg`,
            '--shard-offset': `${18 + (index % 3) * 12}px`,
            '--shard-delay': `${-index * 0.12}s`,
          } as CSSProperties}
        />
      ))}
      {awakened ? <span className="spell-theater-eclipse" /> : null}
    </div>
  )
}

function CrescentArrayEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const count = Math.max(2, density * 2 + (awakened ? 4 : 0))
  const sheetUrl = appAssetUrl('assets/spell-vfx/crescent-moonblade-v1.webp')
  return (
    <div
      className="spell-theater-effect spell-theater-effect--crescent"
      aria-hidden="true"
      style={{ '--crescent-sheet': `url("${sheetUrl}")` } as CSSProperties}
    >
      {Array.from({ length: count }, (_, index) => (
        <i
          className="spell-theater-crescent"
          key={index}
          style={{
            '--blade-angle': `${(index / count) * 360}deg`,
            '--blade-delay': `${-index * 0.11}s`,
          } as CSSProperties}
        />
      ))}
      {density >= 3 ? <span className="spell-theater-moonmist" /> : null}
      {awakened ? <span className="spell-theater-moonwell" /> : null}
    </div>
  )
}

function ArcChoirEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const count = awakened
    ? Math.min(4, Math.max(3, 1 + Math.ceil(density / 2)))
    : Math.min(ARC_POSITIONS.length, Math.max(2, density + 1))
  const arcCount = awakened ? 2 : Math.max(1, count - 1)
  const impactSheetUrl = appAssetUrl('assets/spell-vfx/arc-choir-impact-v1.webp')
  return (
    <div
      className="spell-theater-effect spell-theater-effect--choir"
      aria-hidden="true"
      style={{ '--arc-impact-sheet': `url("${impactSheetUrl}")` } as CSSProperties}
    >
      {ARC_POSITIONS.slice(0, count).map(([left, top], index) => (
        <span
          className="spell-theater-choir-node"
          key={`${left}-${top}`}
          style={{ left: `${left}%`, top: `${top}%`, '--node-index': index } as CSSProperties}
        >
          <i />
        </span>
      ))}
      {Array.from({ length: arcCount }, (_, index) => (
        <i
          className="spell-theater-choir-arc"
          key={index}
          style={{
            '--arc-angle': `${-38 + index * (76 / Math.max(1, arcCount - 1))}deg`,
            '--arc-delay': `${-index * 0.17}s`,
          } as CSSProperties}
        />
      ))}
      {awakened ? <span className="spell-theater-cathedral" /> : null}
    </div>
  )
}

function AstralVerdictEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const count = Math.min(VERDICT_POSITIONS.length, Math.max(1, density + (awakened ? 1 : 0)))
  return (
    <div className="spell-theater-effect spell-theater-effect--verdict" aria-hidden="true">
      <span className="spell-theater-verdict-cloud" />
      {VERDICT_POSITIONS.slice(0, count).map(([left, top], index) => (
        <span
          className={`spell-theater-verdict-strike${awakened && index === count - 1 ? ' is-sovereign' : ''}`}
          key={`${left}-${top}`}
          style={{
            left: `${left}%`,
            top: `${top}%`,
            '--verdict-index': index,
            '--verdict-delay': `${-index * 0.16}s`,
          } as CSSProperties}
        >
          <i className="spell-theater-verdict-strike__bolt" />
          <i className="spell-theater-verdict-strike__impact" />
          <i className="spell-theater-verdict-strike__motes" />
        </span>
      ))}
      {density >= 4 ? <span className="spell-theater-verdict-tempest" /> : null}
    </div>
  )
}

function CometSwarmEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const count = Math.max(1, density + (awakened ? 3 : 0))
  const sheetUrl = appAssetUrl('assets/spell-vfx/comet-orbit-v1.webp')
  return (
    <div
      className="spell-theater-effect spell-theater-effect--comet"
      aria-hidden="true"
      style={{ '--comet-sheet': `url("${sheetUrl}")` } as CSSProperties}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          className="spell-theater-comet"
          key={index}
          style={{
            '--comet-angle': `${-23 + index * (46 / Math.max(1, count - 1))}deg`,
            '--comet-top': `${22 + (index % 4) * 16}%`,
            '--comet-delay': `${-index * 0.18}s`,
          } as CSSProperties}
        >
          <i />
        </span>
      ))}
      {awakened ? <span className="spell-theater-perihelion" /> : null}
    </div>
  )
}

function CinderwakeReaversEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const tier = awakened ? 6 : Math.max(1, Math.min(5, density))
  const profile = cinderwakeReaverPresentationProfile(density, awakened)
  const sheetUrl = appAssetUrl('assets/spell-vfx/cinderwake-reaver-v1.webp')
  return (
    <div
      className="spell-theater-effect spell-theater-effect--cinderwake"
      aria-hidden="true"
      data-cinderwake-tier={tier}
      style={{
        '--cinderwake-sheet': `url("${sheetUrl}")`,
        '--reaver-duration': `${profile.duration}s`,
        '--reaver-scale': profile.scale,
      } as CSSProperties}
    >
      <span className="spell-theater-cinderwake-pressure" />
      {CINDERWAKE_PATHS.slice(0, profile.count).map((path, index) => (
        <span
          className={`spell-theater-reaver-flight spell-theater-reaver-flight--${path}`}
          key={path}
          style={{
            '--reaver-delay': `${-index * (profile.duration / Math.max(1, profile.count))}s`,
            '--reaver-phase': index,
          } as CSSProperties}
        >
          <i className="spell-theater-reaver-wake" />
          <i className="spell-theater-reaver-blade" />
          <i className="spell-theater-reaver-impact" />
        </span>
      ))}
      {Array.from({ length: profile.cinders }, (_, index) => (
        <i
          className="spell-theater-cinderwake-mote"
          key={index}
          style={{
            '--cinder-index': index,
            '--cinder-delay': `${-index * 0.31}s`,
          } as CSSProperties}
        />
      ))}
      {awakened ? <span className="spell-theater-eventide-vortex" /> : null}
    </div>
  )
}

function SpellEffect({ weaponId, density, awakened }: {
  weaponId: WeaponId
  density: number
  awakened: boolean
}) {
  if (density <= 0) return null
  if (weaponId === 'helio-lance') return <HelioLanceEffect density={density} awakened={awakened} />
  if (weaponId === 'crescent-array') return <CrescentArrayEffect density={density} awakened={awakened} />
  if (weaponId === 'arc-choir') return <ArcChoirEffect density={density} awakened={awakened} />
  if (weaponId === 'rift-seeds') return <AstralVerdictEffect density={density} awakened={awakened} />
  if (weaponId === 'comet-swarm') return <CometSwarmEffect density={density} awakened={awakened} />
  if (weaponId === 'mirror-bow') return <CinderwakeReaversEffect density={density} awakened={awakened} />
  return null
}

export function CombatLabSpellTheater({
  weaponId,
  ownedWeapon,
}: {
  weaponId: WeaponId
  ownedWeapon?: OwnedWeapon
}) {
  const weapon = WEAPONS[weaponId]
  const supported = LAB_REVIEW_SPELLS.has(weaponId)
  const rank = ownedWeapon?.rank ?? 0
  const awakened = Boolean(ownedWeapon?.awakened)
  const presentationIndex = awakened ? 6 : rank
  const cinderwakePresentation = weaponId === 'mirror-bow' && rank > 0
    ? cinderwakeReaverPresentationProfile(rank, awakened)
    : undefined
  const particleCount = rank > 0
    ? cinderwakePresentation?.ambientParticleBudget
      ?? Math.min(18, 3 + rank * 2 + (awakened ? 5 : 0))
    : 0
  const rankTitle = RANK_TITLES[weaponId][presentationIndex] ?? weapon.name

  return (
    <section className="spell-theater" aria-label={`${weapon.name} spell presentation review`}>
      <header className="spell-theater__header">
        <span className="spell-theater__glyph"><WeaponGlyph id={weaponId} size={20} /></span>
        <span>
          <small>Lab VFX theater</small>
          <strong>{awakened ? weapon.awakening : weapon.name}</strong>
        </span>
        <em>{awakened ? 'Awakened' : `Spell Rank ${RANK_ROMAN[rank]}`}</em>
      </header>
      <div
        className={[
          'spell-theater__stage',
          `spell-theater__stage--${weaponId}`,
          `is-rank-${rank}`,
          awakened ? 'is-awakened' : '',
          !supported ? 'is-campaign-retained' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--spell-rank': rank } as CSSProperties}
      >
        <span className="spell-theater__floor" aria-hidden="true" />
        {supported ? (
          <SpellEffect weaponId={weaponId} density={rank} awakened={awakened} />
        ) : (
          <div className="spell-theater__retained">
            <WeaponGlyph id={weaponId} size={38} />
            <span>Campaign-authored presentation retained</span>
          </div>
        )}
        {Array.from({ length: particleCount }, (_, index) => (
          <i
            className="spell-theater__particle"
            key={index}
            style={particleStyle(index, particleCount)}
          />
        ))}
        <span className="spell-theater__hero" aria-hidden="true">
          <span className="spell-theater__hero-aura" />
          <AtlasSprite atlas="hero" frame={0} columns={2} rows={2} />
        </span>
        {rank === 0 && supported ? (
          <span className="spell-theater__dormant">Spell disabled · isolated Aegis testing ready</span>
        ) : null}
      </div>
      <footer className="spell-theater__readout">
        <span><small>Material state</small><strong>{rankTitle}</strong></span>
        <span><small>Energy density</small><strong>{rank === 0 ? 'None' : awakened ? 'Ascendant' : `${20 + rank * 16}%`}</strong></span>
        <span><small>Layer budget</small><strong>{rank === 0 ? '0' : `${2 + rank + (awakened ? 2 : 0)}`}</strong></span>
      </footer>
    </section>
  )
}
