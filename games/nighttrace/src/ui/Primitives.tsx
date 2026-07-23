import {
  Aperture,
  CircleDot,
  Flame,
  HeartPulse,
  Orbit,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Waves,
  Zap,
} from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ModuleId, ScreenId, WeaponId } from '../shared/types'

type ShellScreenId = Exclude<ScreenId, 'title' | 'game' | 'results'>

export function StarMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`star-mark${small ? ' star-mark--small' : ''}`} aria-hidden="true">
      <span />
      <span />
      <i />
    </span>
  )
}

export function Diamond({ active = false }: { active?: boolean }) {
  return <span className={`diamond${active ? ' diamond--active' : ''}`} aria-hidden="true" />
}

export function OrnamentRule({ label }: { label?: string }) {
  return (
    <div className="ornament-rule" aria-hidden={label ? undefined : true}>
      <span />
      <Diamond active />
      {label ? <em>{label}</em> : null}
      <Diamond active />
      <span />
    </div>
  )
}

interface CrestButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  tone?: 'cyan' | 'gold' | 'danger' | 'quiet'
  compact?: boolean
}

export function CrestButton({ children, tone = 'cyan', compact = false, className = '', ...props }: CrestButtonProps) {
  return (
    <button
      className={`crest-button crest-button--${tone}${compact ? ' crest-button--compact' : ''} ${className}`}
      {...props}
    >
      <span className="crest-button__edge crest-button__edge--left" aria-hidden="true" />
      <span className="crest-button__label">{children}</span>
      <span className="crest-button__edge crest-button__edge--right" aria-hidden="true" />
    </button>
  )
}

export function PanelFrame({
  children,
  className = '',
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <section className={`panel-frame ${className}`}>
      <span className="panel-corner panel-corner--tl" aria-hidden="true" />
      <span className="panel-corner panel-corner--tr" aria-hidden="true" />
      <span className="panel-corner panel-corner--bl" aria-hidden="true" />
      <span className="panel-corner panel-corner--br" aria-hidden="true" />
      {title ? <h2 className="panel-frame__title">{title}</h2> : null}
      {children}
    </section>
  )
}

const NAV_ITEMS: Array<{ id: ShellScreenId; label: string }> = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'astrarium', label: 'Astrarium' },
  { id: 'codex', label: 'Codex' },
  { id: 'settings', label: 'Settings' },
]

export function AppHeader({
  active,
  dawnShards,
  onNavigate,
}: {
  active: ShellScreenId
  dawnShards: number
  onNavigate: (screen: ShellScreenId) => void
}) {
  return (
    <header className="app-header">
      <button className="wordmark" onClick={() => onNavigate('campaign')} aria-label="NIGHTTRACE campaign">
        <img src="/assets/nighttrace-wordmark.png" alt="" />
        <span className="sr-only">NIGHTTRACE</span>
      </button>
      <nav className="primary-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={active === item.id ? 'is-active' : ''}
            onClick={() => onNavigate(item.id)}
            aria-current={active === item.id ? 'page' : undefined}
          >
            {item.label}
            <Diamond active={active === item.id} />
          </button>
        ))}
      </nav>
      <div className="shard-balance" aria-label={`${dawnShards} Dawn Shards`}>
        <span>Dawn Shards</span>
        <strong>{dawnShards.toLocaleString()}</strong>
        <i aria-hidden="true" />
      </div>
    </header>
  )
}

const weaponIcons: Record<WeaponId, typeof Zap> = {
  'helio-lance': Target,
  'crescent-array': Orbit,
  'arc-choir': Zap,
  'rift-seeds': CircleDot,
  'comet-swarm': Sparkles,
  'ash-halo': Flame,
  'mirror-bow': Aperture,
  'null-bell': Radio,
}

const moduleIcons: Record<ModuleId, typeof Zap> = {
  'prism-lens': Aperture,
  'gyro-crown': Orbit,
  'resonance-coil': Zap,
  'grav-anchor': CircleDot,
  'guidance-filament': Target,
  'thermal-mantle': Shield,
  'flux-mirror': Sparkles,
  'deep-capacitor': Waves,
}

export function WeaponGlyph({
  id,
  module = false,
  size = 28,
}: {
  id: WeaponId | ModuleId
  module?: boolean
  size?: number
}) {
  const Icon = module ? moduleIcons[id as ModuleId] : weaponIcons[id as WeaponId]
  return <Icon size={size} strokeWidth={1.35} aria-hidden="true" />
}

export function AstrariumGlyph({ icon, size = 28 }: { icon: string; size?: number }) {
  const icons: Record<string, typeof Zap> = {
    vitality: HeartPulse,
    aegis: Shield,
    lance: Target,
    trace: Waves,
    magnet: Orbit,
    reroll: RefreshCw,
    speed: Zap,
    crit: Aperture,
    echo: Radio,
    dawn: Sparkles,
  }
  const Icon = icons[icon] ?? Sparkles
  return <Icon size={size} strokeWidth={1.2} aria-hidden="true" />
}

export function RankPips({
  rank,
  max = 5,
  awakened = false,
}: {
  rank: number
  max?: number
  awakened?: boolean
}) {
  return (
    <span className={`rank-pips${awakened ? ' rank-pips--awakened' : ''}`} aria-label={`Rank ${rank} of ${max}`}>
      {Array.from({ length: max }, (_, index) => (
        <Diamond key={index} active={index < rank} />
      ))}
    </span>
  )
}

export function AtlasSprite({
  atlas,
  frame,
  columns,
  rows,
  className = '',
}: {
  atlas: 'enemy' | 'boss' | 'hero'
  frame: number
  columns: number
  rows: number
  className?: string
}) {
  const column = frame % columns
  const row = Math.floor(frame / columns) % rows
  const x = columns === 1 ? 0 : (column / (columns - 1)) * 100
  const y = rows === 1 ? 0 : (row / (rows - 1)) * 100
  return (
    <span
      className={`atlas-sprite atlas-sprite--${atlas} ${className}`}
      style={{
        backgroundImage: `url(/assets/nighttrace-${atlas}-${atlas === 'hero' ? 'sheet' : 'atlas'}.png)`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        backgroundPosition: `${x}% ${y}%`,
      }}
      aria-hidden="true"
    />
  )
}
