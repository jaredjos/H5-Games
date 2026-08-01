import type { CSSProperties } from 'react'
import { WEAPONS } from '../game/content'
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
    'Void Seed',
    'Twin Reliquary',
    'Eventide Cluster',
    'Gravitic Garden',
    'Abyssal Bloom',
    'Eventide Garden',
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
    'Paleglass Nock',
    'Twin Reflection',
    'Prismatic Hunt',
    'Refracted Volley',
    'Infinite Draw',
    'Infinite Refrain',
  ],
  'null-bell': ['Campaign-authored', 'Campaign-authored'],
}

const RANK_ROMAN = ['Off', 'I', 'II', 'III', 'IV', 'V'] as const

const SEED_POSITIONS = [
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
  return (
    <div className="spell-theater-effect spell-theater-effect--crescent" aria-hidden="true">
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
  const count = Math.min(ARC_POSITIONS.length, Math.max(2, density + 1))
  return (
    <div className="spell-theater-effect spell-theater-effect--choir" aria-hidden="true">
      {ARC_POSITIONS.slice(0, count).map(([left, top], index) => (
        <span
          className="spell-theater-choir-node"
          key={`${left}-${top}`}
          style={{ left: `${left}%`, top: `${top}%`, '--node-index': index } as CSSProperties}
        >
          <i />
        </span>
      ))}
      {Array.from({ length: Math.max(1, count - 1) }, (_, index) => (
        <i
          className="spell-theater-choir-arc"
          key={index}
          style={{
            '--arc-angle': `${-46 + index * (92 / Math.max(1, count - 2))}deg`,
            '--arc-delay': `${-index * 0.17}s`,
          } as CSSProperties}
        />
      ))}
      {awakened ? <span className="spell-theater-cathedral" /> : null}
    </div>
  )
}

function RiftSeedsEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const count = Math.min(SEED_POSITIONS.length, Math.max(1, density + (awakened ? 1 : 0)))
  return (
    <div className="spell-theater-effect spell-theater-effect--rift" aria-hidden="true">
      <span className="spell-theater-rift-haze" />
      {SEED_POSITIONS.slice(0, count).map(([left, top], index) => (
        <span
          className={`spell-theater-seed${awakened && index === count - 1 ? ' is-sovereign' : ''}`}
          key={`${left}-${top}`}
          style={{ left: `${left}%`, top: `${top}%`, '--seed-index': index } as CSSProperties}
        >
          <i className="spell-theater-seed__lens" />
          <i className="spell-theater-seed__splinters" />
        </span>
      ))}
      {density >= 4 ? <span className="spell-theater-rift-tide" /> : null}
    </div>
  )
}

function CometSwarmEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const count = Math.max(1, density + (awakened ? 3 : 0))
  return (
    <div className="spell-theater-effect spell-theater-effect--comet" aria-hidden="true">
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

function MirrorBowEffect({ density, awakened }: { density: number; awakened: boolean }) {
  const echoCount = Math.max(1, density + (awakened ? 3 : 0))
  return (
    <div className="spell-theater-effect spell-theater-effect--mirror" aria-hidden="true">
      <span className="spell-theater-mirror-bow">
        <i className="spell-theater-mirror-bow__upper" />
        <i className="spell-theater-mirror-bow__lower" />
        <i className="spell-theater-mirror-bow__nock" />
      </span>
      {Array.from({ length: echoCount }, (_, index) => (
        <span
          className="spell-theater-pale-bolt"
          key={index}
          style={{
            '--bolt-angle': `${-18 + index * (36 / Math.max(1, echoCount - 1))}deg`,
            '--bolt-delay': `${-index * 0.13}s`,
            '--bolt-offset': `${(index - (echoCount - 1) / 2) * 7}px`,
          } as CSSProperties}
        >
          <i />
        </span>
      ))}
      {density >= 3 ? <span className="spell-theater-prism-fan" /> : null}
      {awakened ? <span className="spell-theater-infinite-arch" /> : null}
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
  if (weaponId === 'rift-seeds') return <RiftSeedsEffect density={density} awakened={awakened} />
  if (weaponId === 'comet-swarm') return <CometSwarmEffect density={density} awakened={awakened} />
  if (weaponId === 'mirror-bow') return <MirrorBowEffect density={density} awakened={awakened} />
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
  const particleCount = rank > 0 ? Math.min(18, 3 + rank * 2 + (awakened ? 5 : 0)) : 0
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
