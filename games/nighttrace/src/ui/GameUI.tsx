import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  CircuitBoard,
  Droplets,
  Flame,
  Gauge,
  Gem,
  GitBranch,
  HeartPulse,
  Menu,
  MousePointer2,
  Pause,
  Play,
  RefreshCw,
  Repeat2,
  RotateCcw,
  ScanLine,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from 'lucide-react'
import type {
  GameSettings,
  GameSnapshot,
  LevelDefinition,
  ModuleId,
  ModuleDefinition,
  TraceModId,
  TraceModDefinition,
  UpgradeOption,
  WeaponDefinition,
} from '../shared/types'
import { CrestButton, OrnamentRule, PanelFrame, RankPips, StarMark, WeaponGlyph } from './Primitives'

function clampPercent(value: number, max: number) {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

function useModalFocusTrap(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const dialog = containerRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const focusableSelector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')

    const focusFrame = window.requestAnimationFrame(() => {
      ;(getFocusable()[0] ?? dialog).focus()
    })

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', trapFocus)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      dialog.removeEventListener('keydown', trapFocus)
      previouslyFocused?.focus()
    }
  }, [containerRef])
}

const traceIcons: Record<TraceModId, typeof Waves> = {
  'closed-circuit': CircuitBoard,
  afterimage: ScanLine,
  crossfire: Repeat2,
  nightglass: Gem,
  faultline: GitBranch,
  sunblood: Droplets,
  'quiet-step': Wind,
  'red-shift': Gauge,
}

const moduleStatLines: Record<ModuleId, string> = {
  'prism-lens': 'DAMAGE +8%  ·  RANGE +14%',
  'gyro-crown': 'BLADES +1  ·  INTERCEPT +1',
  'resonance-coil': 'JUMPS +1  ·  CHAIN +7%',
  'grav-anchor': 'FIELD +12%  ·  HOLD +0.12s',
  'guidance-filament': 'HOMING +0.8  ·  SPEED +35',
  'thermal-mantle': 'DAMAGE +10%  ·  RADIUS +18',
  'flux-mirror': 'PIERCE +1  ·  DAMAGE +8%',
  'deep-capacitor': 'DAMAGE +13%  ·  RECOVERY +3.5%',
}

const traceStatLines: Record<TraceModId, string> = {
  'closed-circuit': 'LOOP DAMAGE +35%',
  afterimage: 'TRACE MEMORY EXTENDED',
  crossfire: 'MIRROR VOLLEY  ·  EVERY 4TH',
  nightglass: 'CRIT 6%  ·  CRIT DAMAGE +75%',
  faultline: 'FRACTURE 18%  ·  THRESHOLD 45',
  sunblood: 'HEAL 3.5%  ·  EVERY 20 KILLS',
  'quiet-step': 'MOVE +18%  ·  AFTER 4s SAFE',
  'red-shift': 'CADENCE SCALES WITH DENSITY',
}

function UpgradeIcon({ option }: { option: UpgradeOption }) {
  if (option.type === 'module' && option.moduleId) {
    return <WeaponGlyph id={option.moduleId} module size={58} />
  }
  if (option.weaponId) return <WeaponGlyph id={option.weaponId} size={58} />
  if (option.traceModId) {
    const Icon = traceIcons[option.traceModId]
    return <Icon size={58} strokeWidth={1.15} aria-hidden="true" />
  }
  if (option.type === 'heal') return <HeartPulse size={58} strokeWidth={1.1} />
  return <Waves size={58} strokeWidth={1.1} />
}

function getUpgradeStatLine(
  option: UpgradeOption,
  weapon?: WeaponDefinition,
) {
  if (option.rarity === 'awakening') return 'DAMAGE ×1.5  ·  CADENCE +32%'
  if (option.type === 'weapon' && weapon) {
    if ((option.rank ?? 1) > 1) return 'DAMAGE +31%  ·  CADENCE +5.5%'
    return `BASE ${weapon.damage} DMG  ·  ${weapon.cooldown.toFixed(2)}s CADENCE`
  }
  if (option.type === 'module' && option.moduleId) return moduleStatLines[option.moduleId]
  if (option.type === 'trace' && option.traceModId) return traceStatLines[option.traceModId]
  if (option.type === 'heal') {
    if (option.title.toLowerCase().includes('aegis')) return 'SHIELD RESTORED  ·  CAPACITY UP'
    if (option.title.toLowerCase().includes('pulse')) return 'PULSE FULL  ·  INVULNERABLE BEAT'
    return 'RESTORE 30% MAX VITALITY'
  }
  return 'NEW PATTERN ACQUIRED'
}

export function UpgradeOverlay({
  snapshot,
  weapons,
  modules,
  traceMods,
  rerollUnlocked,
  rerollAvailable,
  onSelect,
  onReroll,
}: {
  snapshot: GameSnapshot
  weapons: WeaponDefinition[]
  modules: ModuleDefinition[]
  traceMods: TraceModDefinition[]
  rerollUnlocked: boolean
  rerollAvailable: boolean
  onSelect: (id: string) => void
  onReroll: () => void
}) {
  const options = snapshot.upgradeOptions ?? []
  const hasAwakening = options.some((option) => option.rarity === 'awakening')
  const dialogRef = useRef<HTMLElement>(null)
  useModalFocusTrap(dialogRef)

  return (
    <section
      ref={dialogRef}
      className={`upgrade-overlay${hasAwakening ? ' upgrade-overlay--awakening' : ''}`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="upgrade-title"
      tabIndex={-1}
    >
      <div className="upgrade-overlay__veil" />
      <header className="upgrade-heading">
        <OrnamentRule />
        <h1 id="upgrade-title">{hasAwakening ? 'Awaken the Light' : 'Choose Your Trace'}</h1>
        <span>Level {snapshot.level}</span>
      </header>
      <div className="upgrade-loadout" aria-label="Current loadout">
        <div>
          <small>Weapons</small>
          <span className="upgrade-loadout__slots">
            {snapshot.weapons.map((weapon) => (
              <i key={weapon.id}>
                <WeaponGlyph id={weapon.id} size={23} />
                <RankPips rank={weapon.rank} awakened={weapon.awakened} />
              </i>
            ))}
          </span>
        </div>
        <div>
          <small>Modules</small>
          <span className="upgrade-loadout__slots">
            {snapshot.modules.map((module) => (
              <i key={module.id}>
                <WeaponGlyph id={module.id} module size={23} />
                <RankPips rank={module.rank} max={3} />
              </i>
            ))}
          </span>
        </div>
      </div>
      <div className="upgrade-cards">
        {options.map((option, index) => {
          const weapon = option.weaponId ? weapons.find((entry) => entry.id === option.weaponId) : undefined
          const module = option.moduleId ? modules.find((entry) => entry.id === option.moduleId) : undefined
          const trace = option.traceModId ? traceMods.find((entry) => entry.id === option.traceModId) : undefined
          const description = option.description || weapon?.description || module?.description || trace?.description || ''
          const statLine = getUpgradeStatLine(option, weapon)
          return (
            <button
              key={option.id}
              className={`upgrade-card upgrade-card--${option.type} upgrade-card--${option.rarity ?? 'standard'}`}
              style={{ '--card-index': index } as React.CSSProperties}
              onClick={() => onSelect(option.id)}
            >
              <span className="panel-corner panel-corner--tl" aria-hidden="true" />
              <span className="panel-corner panel-corner--tr" aria-hidden="true" />
              <span className="panel-corner panel-corner--bl" aria-hidden="true" />
              <span className="panel-corner panel-corner--br" aria-hidden="true" />
              <span className="upgrade-card__number">{index + 1}</span>
              <small>{option.category}</small>
              <h2>{option.title}</h2>
              <div className="upgrade-card__art">
                <span />
                <UpgradeIcon option={option} />
              </div>
              <p>{description}</p>
              <span className="upgrade-card__stats">{statLine}</span>
              <span className="upgrade-card__footer">
                {option.rank ? <RankPips rank={option.rank} max={option.type === 'module' ? 3 : 5} /> : <span className="upgrade-card__rarity">{option.rarity === 'elite' ? 'Elite Mod' : option.rarity === 'awakening' ? 'Awakening' : 'New Pattern'}</span>}
                {weapon ? (
                  <span className="upgrade-card__pairing">
                    Awakes with {modules.find((entry) => entry.id === weapon.moduleId)?.name ?? weapon.moduleId}
                  </span>
                ) : <span className="upgrade-card__pairing">Bound to the current run</span>}
              </span>
            </button>
          )
        })}
      </div>
      <button className="reroll-button" onClick={onReroll} disabled={!rerollAvailable}>
        <RefreshCw size={16} />
        {rerollAvailable ? 'Reroll 1' : rerollUnlocked ? 'Reroll spent' : 'Unlock in Astrarium'}
      </button>
      <p className="smart-draft-note">Smart draft protects an owned weapon.</p>
    </section>
  )
}

function VitalityHud({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <div className="vitality-hud">
      <div className="vitality-crest"><StarMark small /></div>
      <div className="vitality-bars">
        <div className="health-line">
          <span style={{ width: `${clampPercent(snapshot.hp, snapshot.maxHp)}%` }} />
          <strong>{Math.ceil(snapshot.hp)} / {snapshot.maxHp}</strong>
        </div>
        <div className="shield-line">
          <Shield size={14} />
          <span><i style={{ width: `${clampPercent(snapshot.shield, snapshot.maxShield)}%` }} /></span>
          <strong>{Math.ceil(snapshot.shield)} / {snapshot.maxShield}</strong>
        </div>
      </div>
    </div>
  )
}

function ArsenalHud({
  snapshot,
  weaponDefinitions,
}: {
  snapshot: GameSnapshot
  weaponDefinitions: WeaponDefinition[]
}) {
  return (
    <div className="arsenal-hud" aria-label="Current weapons">
      {snapshot.weapons.map((weapon, index) => {
        const definition = weaponDefinitions.find((entry) => entry.id === weapon.id)
        const accent = definition
          ? `#${definition.color.toString(16).padStart(6, '0')}`
          : '#f0d695'
        return (
          <div
            key={weapon.id}
            className={`arsenal-slot${weapon.awakened ? ' is-awakened' : ''}`}
            style={{ '--weapon-accent': accent } as React.CSSProperties}
          >
            <span className="arsenal-slot__key">{index + 1}</span>
            <WeaponGlyph id={weapon.id} size={30} />
            <small>{definition?.shortName ?? definition?.name ?? weapon.id}</small>
            <RankPips rank={weapon.rank} awakened={weapon.awakened} />
          </div>
        )
      })}
      {snapshot.modules.slice(0, 4).map((module) => (
        <div key={module.id} className="arsenal-slot arsenal-slot--module">
          <WeaponGlyph id={module.id} module size={23} />
          <RankPips rank={module.rank} max={3} />
        </div>
      ))}
    </div>
  )
}

export function PulseControl({
  charge,
  ready,
  compact = false,
  onPulse,
}: {
  charge: number
  ready: boolean
  compact?: boolean
  onPulse: () => void
}) {
  const normalized = charge <= 1 ? charge * 100 : charge
  return (
    <button
      className={`pulse-control${ready ? ' is-ready' : ''}${compact ? ' pulse-control--compact' : ''}`}
      style={{ '--pulse-charge': `${Math.max(0, Math.min(100, normalized)) * 3.6}deg` } as React.CSSProperties}
      onClick={onPulse}
      aria-label={ready ? 'Activate Trace Pulse' : `Trace Pulse ${Math.round(normalized)} percent charged`}
    >
      <span className="pulse-control__ring" />
      <StarMark />
      <strong>Pulse</strong>
      <kbd>Space</kbd>
    </button>
  )
}

function BossHud({ snapshot }: { snapshot: GameSnapshot }) {
  if (!snapshot.boss) return null
  const percent = clampPercent(snapshot.boss.hp, snapshot.boss.maxHp)
  return (
    <div className="boss-hud">
      <div>
        <small>Phase {snapshot.boss.phase}</small>
        <strong>{snapshot.boss.name}</strong>
      </div>
      <span><i style={{ width: `${percent}%` }} /></span>
      <b>{Math.max(0, Math.ceil(percent))}%</b>
    </div>
  )
}

function BossIntro({
  bossName,
  reducedFlash,
}: {
  bossName?: string
  reducedFlash: boolean
}) {
  const [visibleBoss, setVisibleBoss] = useState<string>()
  const lastBoss = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!bossName || bossName === lastBoss.current) return
    lastBoss.current = bossName
    setVisibleBoss(bossName)
    const timeout = window.setTimeout(() => setVisibleBoss(undefined), reducedFlash ? 900 : 1550)
    return () => window.clearTimeout(timeout)
  }, [bossName, reducedFlash])
  return visibleBoss ? (
    <div className={`boss-intro${reducedFlash ? ' boss-intro--soft' : ''}`} aria-live="assertive">
      <span />
      <div>
        <small>Sovereign manifestation</small>
        <strong>{visibleBoss}</strong>
      </div>
      <span />
    </div>
  ) : null
}

export function GameHud({
  snapshot,
  level,
  settings,
  weaponDefinitions,
  formatTime,
  onPause,
  onPulse,
}: {
  snapshot: GameSnapshot
  level: LevelDefinition
  settings: GameSettings
  weaponDefinitions: WeaponDefinition[]
  formatTime: (seconds: number) => string
  onPause: () => void
  onPulse: () => void
}) {
  const xpPercent = clampPercent(snapshot.xp, snapshot.xpToNext)
  const remaining = Math.max(0, snapshot.duration - snapshot.elapsed)
  return (
    <div className="game-hud" aria-label="Game status">
      <div className="xp-rail">
        <span>XP</span>
        <i><b style={{ width: `${xpPercent}%` }} /></i>
        <strong>Lv. {snapshot.level}</strong>
      </div>
      <VitalityHud snapshot={snapshot} />
      <div className="timer-hud">
        <strong>{formatTime(remaining)}</strong>
        <span>{snapshot.nextEvent}</span>
      </div>
      <div className="objective-hud">
        <span>Sector {String(level.id).padStart(2, '0')}</span>
        <strong>Hold the light</strong>
        <StarMark small />
      </div>
      <button className="pause-control" onClick={onPause} aria-label="Pause game">
        <Pause size={19} />
      </button>
      <BossHud snapshot={snapshot} />
      <BossIntro bossName={snapshot.boss?.name} reducedFlash={settings.reducedFlash} />
      <div className="run-metrics">
        <span><Flame size={15} /> {snapshot.kills.toLocaleString()}</span>
        <span><Waves size={15} /> {snapshot.closedLoops} loops</span>
        <span><Sparkles size={15} /> x{snapshot.largestChain}</span>
      </div>
      <ArsenalHud snapshot={snapshot} weaponDefinitions={weaponDefinitions} />
      <PulseControl charge={snapshot.pulseCharge} ready={snapshot.pulseReady} onPulse={onPulse} />
      {snapshot.tutorial ? (
        <div className="tutorial-callout" role="status">
          <MousePointer2 size={18} />
          <span>{snapshot.tutorial}</span>
        </div>
      ) : null}
    </div>
  )
}

export function PauseOverlay({
  muted,
  onResume,
  onRestart,
  onExit,
  onToggleMute,
}: {
  muted: boolean
  onResume: () => void
  onRestart: () => void
  onExit: () => void
  onToggleMute: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  useModalFocusTrap(dialogRef)

  return (
    <section
      ref={dialogRef}
      className="pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      tabIndex={-1}
    >
      <div className="pause-overlay__veil" />
      <PanelFrame className="pause-panel">
        <StarMark />
        <small>The wake is held</small>
        <h1 id="pause-title">Paused</h1>
        <OrnamentRule />
        <CrestButton onClick={onResume}><Play size={17} /> Resume</CrestButton>
        <button className="pause-action" onClick={onRestart}><RotateCcw size={17} /> Restart sector</button>
        <button className="pause-action" onClick={onToggleMute}>
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          {muted ? 'Restore sound' : 'Mute sound'}
        </button>
        <button className="pause-action pause-action--exit" onClick={onExit}><ArrowLeft size={17} /> Leave the night</button>
        <p><kbd>ESC</kbd> to return</p>
      </PanelFrame>
    </section>
  )
}

export function MobileTouchControls({
  pulseCharge,
  pulseReady,
  onPulse,
  onPause,
}: {
  pulseCharge: number
  pulseReady: boolean
  onPulse: () => void
  onPause: () => void
}) {
  return (
    <div className="mobile-controls">
      <PulseControl charge={pulseCharge} ready={pulseReady} compact onPulse={onPulse} />
      <button className="touch-pause" onClick={onPause} aria-label="Pause"><Menu /></button>
    </div>
  )
}

export function GameLoading({ levelName }: { levelName: string }) {
  return (
    <div className="game-loading" role="status">
      <span className="game-loading__orbit"><StarMark /></span>
      <small>Opening the path</small>
      <strong>{levelName}</strong>
    </div>
  )
}
