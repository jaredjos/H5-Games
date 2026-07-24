import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Crown,
  Flame,
  FlaskConical,
  Gauge,
  Headphones,
  LockKeyhole,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Target,
  Volume2,
  VolumeX,
  Waves,
  Zap,
} from 'lucide-react'
import { appAssetUrl } from '../assetUrl'
import {
  LEVELS,
  MODULES,
  TRACE_MODS,
  WEAPONS,
} from '../game/content'
import {
  BOSS_TRIAL_PLAYER_LEVELS,
  COMBAT_LAB_ARENAS,
  COMBAT_LAB_BOSSES,
  COMBAT_LAB_BOSS_HEALTH_MAX,
  COMBAT_LAB_BOSS_HEALTH_MIN,
  COMBAT_LAB_PLAYER_LEVEL_MAX,
  COMBAT_LAB_PLAYER_LEVEL_MIN,
  COMBAT_LAB_PRESETS,
  getBossTrialLoadout,
  getBossTrialUnlockedLevel,
  getCombatLabPresetLoadout,
  isBossTrialUnlocked,
  normalizeCombatLabConfig,
  normalizeStartingLoadout,
  resolveArenaLevel,
  resolveBossLevel,
  type CombatLabPresetId,
} from '../game/modes'
import type {
  CombatLabConfig,
  GameSettings,
  LevelDefinition,
  ModuleId,
  ModuleDefinition,
  RunResult,
  SaveData,
  ScreenId,
  StartingLoadout,
  TraceModId,
  TraceModDefinition,
  WeaponId,
  WeaponDefinition,
} from '../shared/types'
import {
  ASTRARIUM_NODES,
  BOSS_CODEX,
  CAMPAIGN_NODE_LAYOUT,
  ENEMY_CODEX,
  type AstrariumNodeDefinition,
} from './data'
import {
  AppHeader,
  AstrariumGlyph,
  AtlasSprite,
  CrestButton,
  Diamond,
  OrnamentRule,
  PanelFrame,
  RankPips,
  StarMark,
  WeaponGlyph,
} from './Primitives'

type ShellScreenId = Exclude<ScreenId, 'title' | 'game' | 'results'>

interface ScreenHeaderProps {
  active: ShellScreenId
  save: SaveData
  onNavigate: (screen: ShellScreenId) => void
}

function ScreenHeader({ active, save, onNavigate }: ScreenHeaderProps) {
  return <AppHeader active={active} dawnShards={save.dawnShards} onNavigate={onNavigate} />
}

export function TitleScreen({
  hasProgress,
  reducedMotion,
  muted,
  onBegin,
  onBossTrials,
  onCombatLab,
  onCodex,
  onSettings,
  onToggleMute,
}: {
  hasProgress: boolean
  reducedMotion: boolean
  muted: boolean
  onBegin: () => void
  onBossTrials: () => void
  onCombatLab: () => void
  onCodex: () => void
  onSettings: () => void
  onToggleMute: () => void
}) {
  return (
    <main className={`title-screen${reducedMotion ? ' reduce-motion' : ''}`}>
      <div className="title-screen__world" aria-hidden="true" />
      <div className="title-screen__aurora" aria-hidden="true" />
      <div className="title-screen__hero" aria-hidden="true">
        <AtlasSprite atlas="hero" frame={0} columns={2} rows={2} />
        <span className="title-screen__hero-glow" />
      </div>
      <button className="title-audio" onClick={onToggleMute} aria-label={muted ? 'Unmute audio' : 'Mute audio'}>
        {muted ? <VolumeX /> : <Volume2 />}
        <span>{muted ? 'Sound off' : 'Sound on'}</span>
      </button>
      <section className="title-screen__content">
        <div className="title-kicker">
          <span />
          A world without dawn
        </div>
        <div className="title-lockup" aria-label="NIGHTTRACE">
          <img src={appAssetUrl('assets/nighttrace-wordmark.png')} alt="" />
          <h1 className="sr-only">NIGHTTRACE</h1>
        </div>
        <p className="title-tagline">Draw the path. Burn the horde.</p>
        <p className="title-copy">
          Carry the last living star through ten fallen sectors. Every step leaves a weapon behind you.
        </p>
        <div className="title-actions">
          <CrestButton onClick={onBegin}>{hasProgress ? 'Continue the Wake' : 'Begin the Wake'}</CrestButton>
          <CrestButton tone="gold" onClick={onBossTrials}>
            <Crown size={17} />
            Boss Trials
          </CrestButton>
          <button className="text-action" onClick={onCombatLab}>
            <FlaskConical size={17} />
            Combat Lab
          </button>
          <button className="text-action" onClick={onCodex}>
            <BookOpen size={17} />
            Open Codex
          </button>
          <button className="text-action" onClick={onSettings}>
            <Gauge size={17} />
            Settings
          </button>
        </div>
        <div className="title-meta">
          <span>10 handcrafted sectors</span>
          <Diamond active />
          <span>Persistent Astrarium</span>
          <Diamond active />
          <span>Keyboard · Touch</span>
        </div>
      </section>
      <div className="title-screen__edition">THE LAST LIGHT · CAMPAIGN I</div>
    </main>
  )
}

interface MasteryTargetView {
  traceLoops: number
  aegisChain: number
  aegisKills: number
}

function MasterySeals({
  mastery,
  targets,
}: {
  mastery: Array<'clear' | 'trace' | 'aegis'>
  targets: MasteryTargetView
}) {
  const seals: Array<{ id: 'clear' | 'trace' | 'aegis'; label: string; target: string; icon: typeof Check }> = [
    { id: 'clear', label: 'Clear', target: 'Defeat sovereign', icon: Check },
    { id: 'trace', label: 'Trace', target: `${targets.traceLoops} closed loops`, icon: Waves },
    { id: 'aegis', label: 'Aegis', target: `x${targets.aegisChain} chain · ${targets.aegisKills} kills`, icon: Shield },
  ]
  return (
    <div className="mastery-seals">
      {seals.map(({ id, label, target, icon: Icon }) => {
        const earned = mastery.includes(id)
        return (
          <div key={id} className={`mastery-seal${earned ? ' is-earned' : ''}`} title={target}>
            <span>
              <Icon size={22} strokeWidth={1.2} />
            </span>
            <small>{label}</small>
            <em>{target}</em>
          </div>
        )
      })}
    </div>
  )
}

export function CampaignScreen({
  levels,
  save,
  selectedLevelId,
  onSelectLevel,
  onStart,
  onNavigate,
  formatTime,
  masteryTargets,
}: {
  levels: LevelDefinition[]
  save: SaveData
  selectedLevelId: number
  onSelectLevel: (level: number) => void
  onStart: (level: number) => void
  onNavigate: ScreenHeaderProps['onNavigate']
  formatTime: (seconds: number) => string
  masteryTargets: MasteryTargetView
}) {
  const selected = levels.find((level) => level.id === selectedLevelId) ?? levels[0]
  const isUnlocked = selected.id <= save.unlockedLevel
  const mastery = save.mastery[selected.id] ?? []
  const completedCount = levels.filter((level) => save.completedLevels.includes(level.id)).length

  return (
    <main className="shell-screen campaign-screen">
      <ScreenHeader active="campaign" save={save} onNavigate={onNavigate} />
      <section className="campaign-layout">
        <div className="campaign-map">
          <div className="campaign-map__image" aria-hidden="true" />
          <div className="campaign-map__vignette" aria-hidden="true" />
          <svg className="campaign-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              points={CAMPAIGN_NODE_LAYOUT.map((node) => `${node.x},${node.y}`).join(' ')}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {CAMPAIGN_NODE_LAYOUT.map((layout, index) => {
            const level = levels.find((item) => item.id === layout.id)
            if (!level) return null
            const unlocked = level.id <= save.unlockedLevel
            const completed = save.completedLevels.includes(level.id)
            const selectedNode = level.id === selected.id
            return (
              <button
                key={level.id}
                className={[
                  'campaign-node',
                  unlocked ? 'is-unlocked' : 'is-locked',
                  completed ? 'is-complete' : '',
                  selectedNode ? 'is-selected' : '',
                ].join(' ')}
                style={{ left: `${layout.x}%`, top: `${layout.y}%`, '--node-delay': `${index * 55}ms` } as React.CSSProperties}
                onClick={() => onSelectLevel(level.id)}
                aria-label={`${level.id}. ${level.name}${unlocked ? '' : ', locked'}`}
                aria-pressed={selectedNode}
              >
                <span className="campaign-node__orbit" aria-hidden="true" />
                <span className="campaign-node__core">{String(level.id).padStart(2, '0')}</span>
                <strong>{level.name}</strong>
                {completed ? <Check className="campaign-node__check" size={15} /> : null}
              </button>
            )
          })}
          <div className="campaign-core-strip" aria-label="Recovered arsenal">
            <div className="campaign-core-strip__heading">
              <Diamond active />
              <span>Recovered Arsenal</span>
            </div>
            <div className="core-loadout">
              {save.unlockedWeapons.slice(-4).map((id) => (
                <span key={id} className="loadout-slot">
                  <WeaponGlyph id={id} />
                  <Diamond active />
                </span>
              ))}
              {save.unlockedWeapons.length > 4 ? (
                <span className="loadout-overflow" aria-label={`${save.unlockedWeapons.length - 4} more weapons recovered`}>
                  +{save.unlockedWeapons.length - 4}
                </span>
              ) : null}
            </div>
          </div>
          <div className="campaign-progress">
            <StarMark small />
            <strong>{completedCount}</strong>
            <span>/ {levels.length} sectors relit</span>
            <div className="campaign-progress__rail">
              {levels.map((level) => (
                <Diamond key={level.id} active={save.completedLevels.includes(level.id)} />
              ))}
            </div>
          </div>
        </div>
        <PanelFrame className="stage-rail">
          <div key={selected.id} className="stage-rail__wipe">
            <div className="stage-rail__index">
              <span>{String(selected.id).padStart(2, '0')}</span>
              <i />
            </div>
            <h1>{selected.name}</h1>
            <OrnamentRule />
            <p className="stage-rail__description">{selected.description}</p>
            <div className="stage-rail__facts">
              <span>
                <Gauge size={16} />
                {formatTime(selected.duration)}
              </span>
              <span>
                <Swords size={16} />
                Threat {selected.difficulty}
              </span>
            </div>
            <div className="stage-rail__boss">
              <AtlasSprite atlas="boss" frame={selected.bossFrame} columns={3} rows={2} />
              <div>
                <small>Sector sovereign</small>
                <strong>{selected.bossName}</strong>
              </div>
            </div>
            <h2>Challenges</h2>
            <ul className="stage-challenges">
              {selected.hazards.slice(0, 3).map((hazard) => (
                <li key={hazard}>
                  <span><Flame size={16} /></span>
                  {hazard}
                </li>
              ))}
            </ul>
            <h2>Mastery seals</h2>
            <MasterySeals mastery={mastery} targets={masteryTargets} />
            <h2>Relight reward</h2>
            <div className="stage-reward">
              <Sparkles size={23} />
              <span>{selected.reward}</span>
            </div>
            <CrestButton disabled={!isUnlocked} onClick={() => onStart(selected.id)}>
              {isUnlocked ? (save.completedLevels.includes(selected.id) ? 'Return to the Night' : 'Enter the Night') : 'Sector Shrouded'}
            </CrestButton>
            <div className="stage-best">
              {save.completedLevels.includes(selected.id) ? 'Relit · mastery remains' : isUnlocked ? 'No light has returned yet' : `Relight sector ${selected.id - 1} to unlock`}
            </div>
          </div>
        </PanelFrame>
      </section>
    </main>
  )
}

export function BossTrialsScreen({
  save,
  selectedLevelId,
  onSelectLevel,
  onStart,
  onNavigate,
}: {
  save: SaveData
  selectedLevelId: number
  onSelectLevel: (levelId: number) => void
  onStart: (levelId: number) => void
  onNavigate: ScreenHeaderProps['onNavigate']
}) {
  const clears = save.bossTrialClears
  const unlockedLevel = getBossTrialUnlockedLevel(clears)
  const selected = LEVELS.find((level) => level.id === selectedLevelId)
    ?? LEVELS[unlockedLevel - 1]
    ?? LEVELS[0]
  const selectedBoss = BOSS_CODEX.find((boss) => boss.id === selected.bossId)
  const loadout = getBossTrialLoadout(selected.id)
  const canLaunch = isBossTrialUnlocked(selected.id, clears)
  const allTrialsCleared = clears >= LEVELS.length

  return (
    <main className="shell-screen boss-trials-screen">
      <ScreenHeader active="boss-trials" save={save} onNavigate={onNavigate} />
      <section className="boss-trials-layout">
        <header className="boss-trials-heading">
          <span className="section-number">V</span>
          <div>
            <span className="boss-trials-heading__kicker"><Crown size={15} /> Sovereign ladder</span>
            <h1>Boss Trials</h1>
            <p>Ten sovereigns. Curated power. No horde between you and the throne.</p>
          </div>
          <div className="boss-trials-progress" aria-label={`${Math.min(clears, LEVELS.length)} of ${LEVELS.length} trials cleared`}>
            <strong>{Math.min(clears, LEVELS.length)}</strong>
            <span>/ {LEVELS.length} crowns broken</span>
            <div>
              {LEVELS.map((level) => (
                <Diamond key={level.id} active={level.id <= clears} />
              ))}
            </div>
          </div>
        </header>

        <div className="boss-trials-body">
          <div className="boss-trial-ladder" aria-label="Boss trial ladder">
            {LEVELS.map((level) => {
              const cleared = level.id <= clears
              const unlocked = isBossTrialUnlocked(level.id, clears)
              const current = !allTrialsCleared && level.id === unlockedLevel
              const trialSelected = level.id === selected.id
              const boss = BOSS_CODEX.find((entry) => entry.id === level.bossId)
              return (
                <button
                  key={level.id}
                  className={[
                    'boss-trial-card',
                    cleared ? 'is-cleared' : '',
                    current ? 'is-current' : '',
                    unlocked ? '' : 'is-locked',
                    trialSelected ? 'is-selected' : '',
                  ].join(' ')}
                  onClick={() => onSelectLevel(level.id)}
                  aria-pressed={trialSelected}
                  aria-label={`Trial ${level.id}: ${level.bossName}${unlocked ? '' : ', locked'}`}
                >
                  <span className="boss-trial-card__number">{String(level.id).padStart(2, '0')}</span>
                  <span className="boss-trial-card__portrait">
                    <AtlasSprite atlas="boss" frame={level.bossFrame} columns={3} rows={2} />
                  </span>
                  <span className="boss-trial-card__copy">
                    <small>{cleared ? 'Crown broken' : current ? 'Current trial' : unlocked ? 'Open trial' : 'Shrouded'}</small>
                    <strong>{level.bossName}</strong>
                    <em>{boss?.epithet ?? level.name}</em>
                  </span>
                  <span className="boss-trial-card__state" aria-hidden="true">
                    {cleared ? <Check size={18} /> : unlocked ? <ChevronRight size={18} /> : <LockKeyhole size={16} />}
                  </span>
                </button>
              )
            })}
          </div>

          <PanelFrame className="boss-trial-detail">
            <div
              className="boss-trial-detail__hero"
              style={{ '--boss-accent': selected.accent } as React.CSSProperties}
            >
              <div className="boss-trial-detail__portrait" aria-hidden="true">
                <AtlasSprite atlas="boss" frame={selected.bossFrame} columns={3} rows={2} />
                <span />
              </div>
              <div className="boss-trial-detail__identity">
                <small>Trial {String(selected.id).padStart(2, '0')} · Sovereign</small>
                <h2>{selected.bossName}</h2>
                <p>{selectedBoss?.epithet ?? selected.description}</p>
              </div>
            </div>
            <OrnamentRule />

            <div className="boss-trial-detail__facts">
              <span><Gauge size={16} /> Bearer level {BOSS_TRIAL_PLAYER_LEVELS[selected.id - 1]}</span>
              <span><Swords size={16} /> Threat {selected.difficulty}</span>
              <span><Shield size={16} /> Fixed arsenal</span>
            </div>

            <section className="boss-trial-signature">
              <small>Threat signature</small>
              <ul>
                {selected.hazards.slice(0, 2).map((hazard) => (
                  <li key={hazard}><Flame size={15} /> {hazard}</li>
                ))}
              </ul>
            </section>

            <section className="boss-trial-loadout">
              <div className="boss-trial-loadout__heading">
                <div>
                  <small>Curated loadout</small>
                  <strong>Power chosen for this duel</strong>
                </div>
                <span>{loadout.weapons.length} weapons · {loadout.modules.length} modules</span>
              </div>
              <div className="boss-trial-loadout__weapons">
                {loadout.weapons.map((weapon) => {
                  const definition = WEAPONS[weapon.id]
                  return (
                    <div key={weapon.id} className={`boss-trial-weapon${weapon.awakened ? ' is-awakened' : ''}`}>
                      <WeaponGlyph id={weapon.id} size={22} />
                      <span>
                        <strong>{weapon.awakened ? definition.awakening : definition.name}</strong>
                        <small>{weapon.awakened ? 'Awakened' : `Rank ${weapon.rank}`}</small>
                      </span>
                      <RankPips rank={weapon.rank} max={5} />
                    </div>
                  )
                })}
              </div>
              {loadout.modules.length > 0 ? (
                <div className="boss-trial-loadout__modules">
                  {loadout.modules.map((module) => (
                    <span key={module.id}>
                      <Diamond active />
                      {MODULES[module.id].name}
                      <b>{'I'.repeat(module.rank)}</b>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="boss-trial-loadout__empty">No supporting modules. Precision is the only advantage.</p>
              )}
              {loadout.traceMods.length > 0 ? (
                <div className="boss-trial-loadout__traces">
                  {loadout.traceMods.map((id) => <span key={id}>{TRACE_MODS[id].name}</span>)}
                </div>
              ) : null}
            </section>

            <CrestButton disabled={!canLaunch} onClick={() => onStart(selected.id)}>
              {canLaunch
                ? selected.id <= clears
                  ? 'Challenge Again'
                  : 'Enter the Trial'
                : `Break Crown ${String(unlockedLevel).padStart(2, '0')} First`}
            </CrestButton>
            <p className="boss-trial-detail__note">
              {allTrialsCleared
                ? 'The entire sovereign ladder is open for rematches.'
                : canLaunch
                  ? 'Victory opens the next crown. Defeat costs no campaign progress.'
                  : `Trial ${String(unlockedLevel).padStart(2, '0')} is the next unbeaten crown.`}
            </p>
          </PanelFrame>
        </div>
      </section>
    </main>
  )
}

const COMBAT_LAB_TRACE_LIMIT = 3

function setLoadoutWeaponRank(loadout: StartingLoadout, id: WeaponId, rank: number) {
  const weapons = loadout.weapons.filter((weapon) => weapon.id !== id)
  const existing = loadout.weapons.find((weapon) => weapon.id === id)
  if (rank > 0) {
    weapons.push({
      ...existing,
      id,
      rank,
      awakened: rank === 5 ? existing?.awakened : undefined,
    })
  }
  return normalizeStartingLoadout({ ...loadout, weapons })
}

function setLoadoutModuleRank(loadout: StartingLoadout, id: ModuleId, rank: number) {
  const modules = loadout.modules.filter((module) => module.id !== id)
  if (rank > 0) modules.push({ id, rank })
  return normalizeStartingLoadout({ ...loadout, modules })
}

function setWeaponAwakened(loadout: StartingLoadout, id: WeaponId, awakened: boolean) {
  return normalizeStartingLoadout({
    ...loadout,
    weapons: loadout.weapons.map((weapon) => (
      weapon.id === id ? { ...weapon, awakened } : weapon
    )),
  })
}

export function CombatLabScreen({
  save,
  config,
  onConfigChange,
  onLaunch,
  onNavigate,
}: {
  save: SaveData
  config: CombatLabConfig
  onConfigChange: (config: CombatLabConfig) => void
  onLaunch: (config: CombatLabConfig) => void
  onNavigate: ScreenHeaderProps['onNavigate']
}) {
  const normalized = useMemo(() => normalizeCombatLabConfig(config), [config])
  const [presetWeaponId, setPresetWeaponId] = useState<WeaponId>(normalized.loadout.weapons[0]?.id ?? 'helio-lance')
  const [activePreset, setActivePreset] = useState<CombatLabPresetId | undefined>()
  const arena = resolveArenaLevel(normalized.arenaLevelId)
  const boss = resolveBossLevel(normalized.bossLevelId)
  const bossCodex = BOSS_CODEX.find((entry) => entry.id === boss.bossId)

  const updateConfig = (patch: Partial<CombatLabConfig>) => {
    onConfigChange(normalizeCombatLabConfig({ ...normalized, ...patch }))
  }
  const updateLoadout = (loadout: StartingLoadout) => {
    setActivePreset(undefined)
    updateConfig({ loadout: normalizeStartingLoadout(loadout) })
  }
  const applyPreset = (presetId: CombatLabPresetId) => {
    setActivePreset(presetId)
    updateConfig({ loadout: getCombatLabPresetLoadout(presetId, presetWeaponId) })
  }
  const toggleTraceMod = (id: TraceModId) => {
    const selected = normalized.loadout.traceMods.includes(id)
    if (!selected && normalized.loadout.traceMods.length >= COMBAT_LAB_TRACE_LIMIT) return
    updateLoadout({
      ...normalized.loadout,
      traceMods: selected
        ? normalized.loadout.traceMods.filter((traceId) => traceId !== id)
        : [...normalized.loadout.traceMods, id],
    })
  }

  return (
    <main className="shell-screen combat-lab-screen">
      <ScreenHeader active="combat-lab" save={save} onNavigate={onNavigate} />
      <section className="combat-lab-layout">
        <header className="combat-lab-heading">
          <span className="section-number">VI</span>
          <div>
            <span className="combat-lab-heading__kicker"><FlaskConical size={15} /> Unbound simulation</span>
            <h1>Combat Lab</h1>
            <p>Isolate a sovereign, bend the arena, and measure every recovered pattern at full clarity.</p>
          </div>
          <span className="combat-lab-heading__safety"><Shield size={15} /> Invincibility protocol active</span>
        </header>

        <div className="combat-lab-body">
          <div className="combat-lab-controls">
            <PanelFrame title="Encounter matrix">
              <div className="combat-lab-encounter" role="radiogroup" aria-label="Encounter type">
                <button
                  className={normalized.encounter === 'boss' ? 'is-selected' : ''}
                  role="radio"
                  aria-checked={normalized.encounter === 'boss'}
                  onClick={() => updateConfig({ encounter: 'boss' })}
                >
                  <Crown size={18} />
                  <span><strong>Boss isolate</strong><small>Begin at the sovereign</small></span>
                </button>
                <button
                  className={normalized.encounter === 'sector' ? 'is-selected' : ''}
                  role="radio"
                  aria-checked={normalized.encounter === 'sector'}
                  onClick={() => updateConfig({ encounter: 'sector' })}
                >
                  <Waves size={18} />
                  <span><strong>Full sector</strong><small>Horde, events, sovereign</small></span>
                </button>
              </div>
              <div className="combat-lab-selectors">
                <label>
                  <span>Arena architecture</span>
                  <select
                    value={normalized.arenaLevelId}
                    onChange={(event) => updateConfig({ arenaLevelId: Number(event.currentTarget.value) })}
                  >
                    {COMBAT_LAB_ARENAS.map((option) => (
                      <option key={option.levelId} value={option.levelId}>
                        {String(option.levelId).padStart(2, '0')} · {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Sovereign pattern</span>
                  <select
                    value={normalized.bossLevelId}
                    onChange={(event) => updateConfig({ bossLevelId: Number(event.currentTarget.value) })}
                  >
                    {COMBAT_LAB_BOSSES.map((option) => (
                      <option key={option.levelId} value={option.levelId}>
                        {String(option.levelId).padStart(2, '0')} · {option.bossName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="combat-lab-tuning">
                <label>
                  <span><Gauge size={15} /> Bearer level <strong>{normalized.playerLevel}</strong></span>
                  <input
                    type="range"
                    min={COMBAT_LAB_PLAYER_LEVEL_MIN}
                    max={COMBAT_LAB_PLAYER_LEVEL_MAX}
                    value={normalized.playerLevel}
                    onChange={(event) => updateConfig({ playerLevel: Number(event.currentTarget.value) })}
                  />
                </label>
                <label>
                  <span><Shield size={15} /> Boss vitality <strong>{normalized.bossHealthMultiplier.toFixed(2)}×</strong></span>
                  <input
                    type="range"
                    min={COMBAT_LAB_BOSS_HEALTH_MIN}
                    max={COMBAT_LAB_BOSS_HEALTH_MAX}
                    step={0.25}
                    value={normalized.bossHealthMultiplier}
                    onChange={(event) => updateConfig({ bossHealthMultiplier: Number(event.currentTarget.value) })}
                  />
                </label>
              </div>
            </PanelFrame>

            <PanelFrame title="Calibration presets">
              <div className="combat-lab-preset-source">
                <label htmlFor="combat-lab-preset-weapon">Pattern</label>
                <select
                  id="combat-lab-preset-weapon"
                  value={presetWeaponId}
                  onChange={(event) => {
                    setPresetWeaponId(event.currentTarget.value as WeaponId)
                    setActivePreset(undefined)
                  }}
                >
                  {Object.values(WEAPONS).map((weapon) => (
                    <option key={weapon.id} value={weapon.id}>{weapon.name}</option>
                  ))}
                </select>
              </div>
              <div className="combat-lab-presets">
                {COMBAT_LAB_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={activePreset === preset.id ? 'is-selected' : ''}
                    onClick={() => applyPreset(preset.id)}
                    aria-pressed={activePreset === preset.id}
                  >
                    <span>{preset.label}</span>
                    <small>{preset.description}</small>
                  </button>
                ))}
              </div>
            </PanelFrame>
          </div>

          <PanelFrame className="combat-lab-arsenal">
            <div className="combat-lab-arsenal__heading">
              <div>
                <small><SlidersHorizontal size={14} /> Manual calibration</small>
                <h2>Arsenal matrix</h2>
              </div>
              <span>Rank 0 removes a pattern</span>
            </div>
            <div className="combat-lab-weapon-list">
              {Object.values(WEAPONS).map((weapon) => {
                const owned = normalized.loadout.weapons.find((entry) => entry.id === weapon.id)
                const pairedModule = normalized.loadout.modules.find((entry) => entry.id === weapon.moduleId)
                const canAwaken = owned?.rank === 5 && Boolean(pairedModule)
                return (
                  <div key={weapon.id} className={`combat-lab-weapon${owned ? ' is-equipped' : ''}${owned?.awakened ? ' is-awakened' : ''}`}>
                    <div className="combat-lab-weapon__identity">
                      <WeaponGlyph id={weapon.id} size={23} />
                      <span>
                        <strong>{owned?.awakened ? weapon.awakening : weapon.name}</strong>
                        <small>{MODULES[weapon.moduleId].name} pairing</small>
                      </span>
                    </div>
                    <label>
                      <span>Weapon rank <strong>{owned?.rank ?? 0}</strong></span>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        value={owned?.rank ?? 0}
                        onChange={(event) => updateLoadout(setLoadoutWeaponRank(
                          normalized.loadout,
                          weapon.id,
                          Number(event.currentTarget.value),
                        ))}
                      />
                    </label>
                    <label>
                      <span>Module rank <strong>{pairedModule?.rank ?? 0}</strong></span>
                      <input
                        type="range"
                        min={0}
                        max={3}
                        value={pairedModule?.rank ?? 0}
                        onChange={(event) => updateLoadout(setLoadoutModuleRank(
                          normalized.loadout,
                          weapon.moduleId,
                          Number(event.currentTarget.value),
                        ))}
                      />
                    </label>
                    <button
                      className={`combat-lab-awakening${owned?.awakened ? ' is-active' : ''}`}
                      disabled={!canAwaken}
                      onClick={() => updateLoadout(setWeaponAwakened(
                        normalized.loadout,
                        weapon.id,
                        !owned?.awakened,
                      ))}
                      aria-pressed={Boolean(owned?.awakened)}
                      title={canAwaken ? weapon.awakening : 'Requires Rank V and its paired module'}
                    >
                      <Sparkles size={15} />
                      {owned?.awakened ? 'Awakened' : 'Awaken'}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="combat-lab-traces">
              <div className="combat-lab-traces__heading">
                <span><Zap size={16} /> Trace modifications</span>
                <strong>{normalized.loadout.traceMods.length} / {COMBAT_LAB_TRACE_LIMIT}</strong>
              </div>
              <div className="combat-lab-traces__grid">
                {Object.values(TRACE_MODS).map((trace) => {
                  const selected = normalized.loadout.traceMods.includes(trace.id)
                  const disabled = !selected && normalized.loadout.traceMods.length >= COMBAT_LAB_TRACE_LIMIT
                  return (
                    <button
                      key={trace.id}
                      className={selected ? 'is-selected' : ''}
                      disabled={disabled}
                      onClick={() => toggleTraceMod(trace.id)}
                      aria-pressed={selected}
                    >
                      <Diamond active={selected} />
                      <span><strong>{trace.name}</strong><small>{trace.description}</small></span>
                    </button>
                  )
                })}
              </div>
            </div>
          </PanelFrame>

          <PanelFrame className="combat-lab-preview">
            <div
              className="combat-lab-preview__arena"
              style={{ '--arena-accent': arena.accent, '--boss-accent': boss.accent } as React.CSSProperties}
            >
              <div className="combat-lab-preview__boss" aria-hidden="true">
                <AtlasSprite atlas="boss" frame={boss.bossFrame} columns={3} rows={2} />
              </div>
              <small>{normalized.encounter === 'boss' ? 'Isolated target' : 'Terminal sovereign'}</small>
              <h2>{boss.bossName}</h2>
              <p>{bossCodex?.epithet ?? boss.description}</p>
              <span className="combat-lab-preview__arena-name">{arena.name} simulation</span>
            </div>
            <div className="combat-lab-preview__summary">
              <span><Target size={16} /> {normalized.encounter === 'boss' ? 'Boss only' : 'Full sector'}</span>
              <span><Gauge size={16} /> Level {normalized.playerLevel}</span>
              <span><Shield size={16} /> {normalized.bossHealthMultiplier.toFixed(2)}× boss HP</span>
              <span><Swords size={16} /> {normalized.loadout.weapons.length} active patterns</span>
            </div>
            <CrestButton onClick={() => onLaunch(normalized)}>
              Launch Simulation
            </CrestButton>
            <p className="combat-lab-preview__note">
              Damage is recorded. Death, rewards, and campaign progression are disabled.
            </p>
          </PanelFrame>
        </div>
      </section>
    </main>
  )
}

function nodeCost(node: AstrariumNodeDefinition, rank: number) {
  return node.baseCost * (rank + 1)
}

export function AstrariumScreen({
  save,
  onNavigate,
  onPurchase,
  onRefund,
}: {
  save: SaveData
  onNavigate: ScreenHeaderProps['onNavigate']
  onPurchase: (node: AstrariumNodeDefinition) => void
  onRefund: () => void
}) {
  const [selectedId, setSelectedId] = useState(ASTRARIUM_NODES[0].id)
  const selected = ASTRARIUM_NODES.find((node) => node.id === selectedId) ?? ASTRARIUM_NODES[0]
  const rank = save.upgrades[selected.id] ?? 0
  const requirementMet = selected.requires ? (save.upgrades[selected.requires] ?? 0) > 0 : true
  const cost = nodeCost(selected, rank)
  const canPurchase = requirementMet && rank < selected.maxRank && save.dawnShards >= cost
  const invested = ASTRARIUM_NODES.reduce((sum, node) => {
    const ownedRank = save.upgrades[node.id] ?? 0
    let spent = 0
    for (let index = 0; index < ownedRank; index += 1) spent += nodeCost(node, index)
    return sum + spent
  }, 0)

  return (
    <main className="shell-screen astrarium-screen">
      <ScreenHeader active="astrarium" save={save} onNavigate={onNavigate} />
      <section className="astrarium-layout">
        <div className="astrarium-copy">
          <span className="section-number">II</span>
          <h1>The Astrarium</h1>
          <p>Permanent constellations. Modest power. Meaningful choice.</p>
          <OrnamentRule />
        </div>
        <div className="astrarium-board">
          <div className="astrarium-rings" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <svg className="astrarium-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {ASTRARIUM_NODES.filter((node) => node.requires).map((node) => {
              const parent = ASTRARIUM_NODES.find((candidate) => candidate.id === node.requires)
              if (!parent) return null
              return <line key={node.id} x1={parent.x} y1={parent.y} x2={node.x} y2={node.y} vectorEffect="non-scaling-stroke" />
            })}
          </svg>
          {ASTRARIUM_NODES.map((node, index) => {
            const nodeRank = save.upgrades[node.id] ?? 0
            const parentMet = node.requires ? (save.upgrades[node.requires] ?? 0) > 0 : true
            return (
              <button
                key={node.id}
                className={[
                  'astrarium-node',
                  nodeRank > 0 ? 'is-lit' : '',
                  parentMet ? 'is-available' : 'is-dormant',
                  selected.id === node.id ? 'is-selected' : '',
                ].join(' ')}
                style={{ left: `${node.x}%`, top: `${node.y}%`, '--node-delay': `${index * 60}ms` } as React.CSSProperties}
                onClick={() => setSelectedId(node.id)}
                aria-label={`${node.name}, rank ${nodeRank} of ${node.maxRank}`}
                aria-pressed={selected.id === node.id}
              >
                <span className="astrarium-node__orbit" />
                <AstrariumGlyph icon={node.icon} />
                <strong>{node.name}</strong>
                <RankPips rank={nodeRank} max={node.maxRank} />
              </button>
            )
          })}
          <div className="astrarium-heart" aria-hidden="true">
            <StarMark />
          </div>
        </div>
        <PanelFrame className="astrarium-detail">
          <div key={selected.id} className="detail-swap">
            <div className="astrarium-detail__icon">
              <AstrariumGlyph icon={selected.icon} size={44} />
            </div>
            <small>Constellation node</small>
            <h2>{selected.name}</h2>
            <RankPips rank={rank} max={selected.maxRank} />
            <p>{selected.description}</p>
            <div className="astrarium-stat">{selected.stat}</div>
            {selected.requires && !requirementMet ? (
              <div className="astrarium-requirement">
                Requires {ASTRARIUM_NODES.find((node) => node.id === selected.requires)?.name}
              </div>
            ) : null}
            <CrestButton
              onClick={() => onPurchase(selected)}
              disabled={!canPurchase}
              tone={rank >= selected.maxRank ? 'quiet' : 'gold'}
            >
              {rank >= selected.maxRank ? 'Constellation Complete' : `Ignite · ${cost} shards`}
            </CrestButton>
            <div className="astrarium-balance">
              <span>Available</span>
              <strong>{save.dawnShards}</strong>
            </div>
          </div>
          <button className="refund-action" onClick={onRefund} disabled={invested === 0}>
            <RotateCcw size={15} />
            Refund constellation
            <span>+{invested}</span>
          </button>
        </PanelFrame>
      </section>
    </main>
  )
}

type CodexTab = 'bestiary' | 'arsenal' | 'trace'

export function CodexScreen({
  save,
  weapons,
  modules,
  traceMods,
  onNavigate,
}: {
  save: SaveData
  weapons: WeaponDefinition[]
  modules: ModuleDefinition[]
  traceMods: TraceModDefinition[]
  onNavigate: ScreenHeaderProps['onNavigate']
}) {
  const [tab, setTab] = useState<CodexTab>('bestiary')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const bestiaryEntries = useMemo(() => [
    ...ENEMY_CODEX.map((entry) => ({ ...entry, kind: 'enemy' as const, discovered: true })),
    ...BOSS_CODEX.map((entry, index) => ({
      ...entry,
      behavior: index < save.completedLevels.length ? 'Sovereign pattern recorded in the Dawn Archive.' : 'No surviving record.',
      kind: 'boss' as const,
      discovered: save.completedLevels.includes(index + 1),
    })),
  ], [save.completedLevels])
  const arsenalEntries = useMemo(() => weapons.map((weapon) => ({
    ...weapon,
    discovered: save.unlockedWeapons.includes(weapon.id),
  })), [save.unlockedWeapons, weapons])
  const selectedBestiary = bestiaryEntries[Math.min(selectedIndex, bestiaryEntries.length - 1)]
  const selectedWeapon = arsenalEntries[Math.min(selectedIndex, arsenalEntries.length - 1)]
  const selectedTrace = traceMods[Math.min(selectedIndex, traceMods.length - 1)]
  const selectedTraceDiscovered = selectedIndex < Math.max(2, save.unlockedLevel)

  return (
    <main className="shell-screen codex-screen">
      <ScreenHeader active="codex" save={save} onNavigate={onNavigate} />
      <section className="codex-layout">
        <header className="codex-heading">
          <span className="section-number">III</span>
          <div>
            <h1>Codex of the Night</h1>
            <p>What we name can no longer hide completely.</p>
          </div>
          <div className="codex-tabs" role="tablist" aria-label="Codex sections">
            {([
              ['bestiary', 'Bestiary'],
              ['arsenal', 'Arsenal'],
              ['trace', 'Trace Mods'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'is-active' : ''}
                onClick={() => {
                  setTab(id)
                  setSelectedIndex(0)
                }}
              >
                {label}
                <Diamond active={tab === id} />
              </button>
            ))}
          </div>
        </header>
        <div className="codex-browser">
          <div className="codex-list" role="tabpanel">
            {tab === 'bestiary'
              ? bestiaryEntries.map((entry, index) => (
                  <button
                    key={`${entry.kind}-${entry.id}`}
                    className={`${selectedIndex === index ? 'is-selected' : ''}${entry.discovered ? '' : ' is-locked'}`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <span className="codex-list__index">{String(index + 1).padStart(2, '0')}</span>
                    {entry.discovered ? entry.name : 'Unrecorded'}
                    <ChevronRight size={15} />
                  </button>
                ))
              : null}
            {tab === 'arsenal'
              ? arsenalEntries.map((entry, index) => (
                  <button
                    key={entry.id}
                    className={`${selectedIndex === index ? 'is-selected' : ''}${entry.discovered ? '' : ' is-locked'}`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <WeaponGlyph id={entry.id} size={19} />
                    {entry.discovered ? entry.name : 'Shrouded armament'}
                    <ChevronRight size={15} />
                  </button>
                ))
              : null}
            {tab === 'trace'
              ? traceMods.map((entry, index) => {
                  const discovered = index < Math.max(2, save.unlockedLevel)
                  return (
                    <button
                      key={entry.id}
                      className={`${selectedIndex === index ? 'is-selected' : ''}${discovered ? '' : ' is-locked'}`}
                      onClick={() => setSelectedIndex(index)}
                    >
                      <Waves size={19} />
                      {discovered ? entry.name : 'Unresolved pattern'}
                      <ChevronRight size={15} />
                    </button>
                  )
                })
              : null}
          </div>
          <PanelFrame className="codex-detail">
            {tab === 'bestiary' && selectedBestiary ? (
              <div key={`${selectedBestiary.kind}-${selectedBestiary.id}`} className="codex-reveal">
                <div className="codex-art">
                  {selectedBestiary.discovered ? (
                    <AtlasSprite
                      atlas={selectedBestiary.kind === 'boss' ? 'boss' : 'enemy'}
                      frame={selectedBestiary.frame}
                      columns={3}
                      rows={2}
                    />
                  ) : (
                    <span className="codex-unknown">?</span>
                  )}
                </div>
                <small>{selectedBestiary.kind === 'boss' ? 'Sovereign entity' : 'Nocturne species'}</small>
                <h2>{selectedBestiary.discovered ? selectedBestiary.name : 'Unrecorded'}</h2>
                <p className="codex-epithet">{selectedBestiary.discovered ? selectedBestiary.epithet : 'Relight more sectors to recover this record.'}</p>
                <OrnamentRule />
                <p>{selectedBestiary.discovered ? selectedBestiary.behavior : 'The page is cold and without ink.'}</p>
              </div>
            ) : null}
            {tab === 'arsenal' && selectedWeapon ? (
              <div key={selectedWeapon.id} className="codex-reveal">
                <div className="codex-glyph-art"><WeaponGlyph id={selectedWeapon.id} size={76} /></div>
                <small>Awakenable weapon</small>
                <h2>{selectedWeapon.discovered ? selectedWeapon.name : 'Shrouded Armament'}</h2>
                <p>{selectedWeapon.discovered ? selectedWeapon.description : 'Relight the sector holding this weapon memory.'}</p>
                {selectedWeapon.discovered ? (
                  <>
                    <div className="codex-awakening">
                      <Sparkles size={18} />
                      <div>
                        <small>Awakening</small>
                        <strong>{selectedWeapon.awakening}</strong>
                      </div>
                    </div>
                    <div className="codex-pairing">
                      <span>Aligned module</span>
                      <strong>{modules.find((module) => module.id === selectedWeapon.moduleId)?.name ?? selectedWeapon.moduleId}</strong>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {tab === 'trace' && selectedTrace ? (
              <div key={selectedTrace.id} className="codex-reveal">
                <div className="codex-glyph-art codex-glyph-art--trace"><Waves size={76} /></div>
                <small>Elite Trace Mod</small>
                <h2>{selectedTraceDiscovered ? selectedTrace.name : 'Unresolved Pattern'}</h2>
                <p>{selectedTraceDiscovered ? selectedTrace.description : 'Relight more sectors to resolve this pattern in the Archive.'}</p>
                <div className="codex-note">
                  {selectedTraceDiscovered
                    ? 'Trace Mods rewrite the rules of your luminous wake for one descent. Elite guardians carry them.'
                    : 'The geometry is present, but the light needed to read it has not returned.'}
                </div>
              </div>
            ) : null}
          </PanelFrame>
        </div>
      </section>
    </main>
  )
}

function SettingSlider({
  label,
  value,
  icon,
  onChange,
}: {
  label: string
  value: number
  icon: React.ReactNode
  onChange: (value: number) => void
}) {
  return (
    <label className="setting-slider">
      <span className="setting-slider__icon">{icon}</span>
      <span className="setting-slider__label">{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--range-value': `${value * 100}%` } as React.CSSProperties}
      />
      <output>{Math.round(value * 100)}</output>
    </label>
  )
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button className="setting-toggle" onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <i className={checked ? 'is-on' : ''}><b /></i>
    </button>
  )
}

export function SettingsScreen({
  save,
  onNavigate,
  onSettingsChange,
  onReset,
}: {
  save: SaveData
  onNavigate: ScreenHeaderProps['onNavigate']
  onSettingsChange: (settings: GameSettings) => void
  onReset: () => void
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const settings = save.settings
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <main className="shell-screen settings-screen">
      <ScreenHeader active="settings" save={save} onNavigate={onNavigate} />
      <section className="settings-layout">
        <header className="settings-heading">
          <span className="section-number">IV</span>
          <div>
            <h1>Settings</h1>
            <p>Tune the light to your hands and your screen.</p>
          </div>
        </header>
        <div className="settings-columns">
          <PanelFrame title="Sound">
            <SettingSlider label="Master" value={settings.masterVolume} icon={<Headphones size={18} />} onChange={(value) => update('masterVolume', value)} />
            <SettingSlider label="Music" value={settings.musicVolume} icon={<Sparkles size={18} />} onChange={(value) => update('musicVolume', value)} />
            <SettingSlider label="Effects" value={settings.sfxVolume} icon={<Zap size={18} />} onChange={(value) => update('sfxVolume', value)} />
          </PanelFrame>
          <PanelFrame title="Visual clarity">
            <SettingToggle label="Reduced flash" description="Softens awakening and impact flashes." checked={settings.reducedFlash} onChange={(value) => update('reducedFlash', value)} />
            <SettingToggle label="Reduced motion & shake" description="Removes nonessential UI motion and camera shake." checked={settings.reducedShake} onChange={(value) => update('reducedShake', value)} />
            <SettingToggle label="High-contrast motes" description="Adds bright outlines to XP and pickups." checked={settings.highContrastPickups} onChange={(value) => update('highContrastPickups', value)} />
            <SettingToggle label="Damage numbers" description="Show damage values over struck enemies." checked={settings.showDamageNumbers} onChange={(value) => update('showDamageNumbers', value)} />
          </PanelFrame>
          <PanelFrame title="Assistance">
            <SettingToggle label="Auto Pulse" description="Detonates a ready Trace automatically." checked={settings.autoPulse} onChange={(value) => update('autoPulse', value)} />
            <div className="control-reference">
              <div><kbd>WASD</kbd><span>Move</span></div>
              <div><kbd>SPACE</kbd><span>Pulse</span></div>
              <div><kbd>1–3</kbd><span>Choose upgrade</span></div>
              <div><kbd>ESC</kbd><span>Pause</span></div>
              <div><kbd>M</kbd><span>Mute</span></div>
            </div>
          </PanelFrame>
        </div>
        <div className="settings-footer">
          <button className="back-action" onClick={() => onNavigate('campaign')}>
            <ArrowLeft size={16} />
            Return to campaign
          </button>
          {!confirmReset ? (
            <button className="reset-progress" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={16} />
              Reset campaign progress
            </button>
          ) : (
            <div className="reset-confirm">
              <span>This erases every relit sector and Astrarium node.</span>
              <button onClick={() => setConfirmReset(false)}>Keep progress</button>
              <button onClick={onReset}>Erase the wake</button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function useCountUp(target: number, reducedMotion: boolean, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (reducedMotion) return
    const started = performance.now()
    let frame = 0
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / duration)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [duration, reducedMotion, target])
  return reducedMotion ? target : value
}

export function ResultsScreen({
  result,
  level,
  weaponDefinitions,
  settings,
  nextGoal,
  earnedMastery = [],
  unlockedWeapon,
  onCampaign,
  onReturn,
  onRetry,
  onNext,
}: {
  result: RunResult
  level: LevelDefinition
  weaponDefinitions: WeaponDefinition[]
  settings: GameSettings
  nextGoal: string
  earnedMastery?: Array<'clear' | 'trace' | 'aegis'>
  unlockedWeapon?: WeaponDefinition
  onCampaign?: () => void
  onReturn?: () => void
  onRetry: () => void
  onNext?: () => void
}) {
  const runMode = result.runMode ?? 'campaign'
  const isCampaign = runMode === 'campaign'
  const isBossTrial = runMode === 'boss-trial'
  const isCombatLab = runMode === 'combat-lab'
  const kills = useCountUp(result.kills, settings.reducedShake)
  const shards = useCountUp(result.dawnShards, settings.reducedShake, 1000)
  const totalDamageTarget = result.weaponDamage.reduce((sum, entry) => sum + entry.damage, 0)
  const totalDamage = useCountUp(totalDamageTarget, settings.reducedShake, 900)
  const maxDamage = Math.max(1, ...result.weaponDamage.map((entry) => entry.damage))
  const returnAction = onReturn ?? onCampaign
  const returnLabel = isCampaign ? 'Campaign' : isBossTrial ? 'Boss Trials' : 'Combat Lab'
  const retryLabel = isCampaign ? 'Retry Sector' : isBossTrial ? 'Retry Trial' : 'Repeat Test'
  const nextLabel = isBossTrial ? 'Next Sovereign' : 'Next Sector'
  const goalLabel = isCampaign ? 'Next light' : isBossTrial ? 'Next trial' : 'Lab note'
  const eyebrow = isCampaign
    ? result.victory
      ? `Sector ${String(level.id).padStart(2, '0')} relit`
      : 'The light returns to its bearer'
    : isBossTrial
      ? result.victory
        ? `Trial ${String(level.id).padStart(2, '0')} conquered`
        : 'The sovereign keeps its crown'
      : result.victory
        ? 'Simulation cycle complete'
        : 'Simulation safely terminated'
  const heading = isCampaign
    ? result.victory ? 'Dawn Answers' : 'Night Prevails'
    : isBossTrial
      ? result.victory ? 'Sovereign Broken' : 'Trial Severed'
      : result.victory ? 'Pattern Recorded' : 'Simulation Ended'
  const summary = isCampaign
    ? result.victory
      ? `${level.name} carries light again.`
      : `The path through ${level.name} remains unfinished.`
    : isBossTrial
      ? result.victory
        ? `${level.bossName} yields the crown.`
        : `${level.bossName} remains unbeaten. Recalibrate, then return.`
      : `${level.bossName} was measured inside the ${level.name} architecture.`

  return (
    <main className={`results-screen results-screen--${runMode}${result.victory ? ' is-victory' : ' is-defeat'}`}>
      <div className="results-screen__world" aria-hidden="true" />
      <div className="results-screen__flare" aria-hidden="true" />
      <section className="results-summary">
        <div className="results-emblem">
          <StarMark />
          <span />
        </div>
        <small>{eyebrow}</small>
        <h1>{heading}</h1>
        <p>{summary}</p>
        <OrnamentRule />
        <div className="result-stats">
          {isCampaign ? (
            <>
              <div><strong>{kills.toLocaleString()}</strong><span>Nightborn ended</span></div>
              <div><strong>{result.closedLoops}</strong><span>Circuits closed</span></div>
              <div><strong>{result.largestChain}</strong><span>Largest chain</span></div>
              <div><strong>{Math.floor(result.survivalTime / 60)}:{String(Math.floor(result.survivalTime % 60)).padStart(2, '0')}</strong><span>Time held</span></div>
            </>
          ) : (
            <>
              <div><strong>{totalDamage.toLocaleString()}</strong><span>{isBossTrial ? 'Damage dealt' : 'Damage recorded'}</span></div>
              <div><strong>{kills.toLocaleString()}</strong><span>{isBossTrial ? 'Threats ended' : 'Targets ended'}</span></div>
              <div><strong>{result.closedLoops}</strong><span>Circuits closed</span></div>
              <div><strong>{Math.floor(result.survivalTime / 60)}:{String(Math.floor(result.survivalTime % 60)).padStart(2, '0')}</strong><span>{isBossTrial ? 'Duel time' : 'Sample time'}</span></div>
            </>
          )}
        </div>
        {isCampaign ? (
          <div className="result-reward">
            <Sparkles size={23} />
            <span>Dawn Shards recovered</span>
            <strong>+{shards}</strong>
          </div>
        ) : isBossTrial ? (
          <div className="result-reward result-reward--trial">
            <Crown size={23} />
            <span>
              {result.victory
                ? `Sovereign crown ${String(level.id).padStart(2, '0')} broken`
                : 'No crown recovered'}
            </span>
            <strong>{result.victory ? `+${shards}` : '—'}</strong>
          </div>
        ) : (
          <div className="result-reward result-reward--lab">
            <FlaskConical size={23} />
            <span>Campaign rewards disabled</span>
            <strong>LAB</strong>
          </div>
        )}
        {isCampaign && (earnedMastery.length > 0 || unlockedWeapon) ? (
          <div className="result-unlocks" aria-label="New rewards">
            {earnedMastery.map((seal) => (
              <span key={seal}>
                {seal === 'clear' ? <Check size={16} /> : seal === 'trace' ? <Waves size={16} /> : <Shield size={16} />}
                {seal} seal earned
              </span>
            ))}
            {unlockedWeapon ? (
              <span className="result-unlocks__weapon">
                <WeaponGlyph id={unlockedWeapon.id} size={18} />
                {unlockedWeapon.name} recovered
              </span>
            ) : null}
          </div>
        ) : null}
      </section>
      <PanelFrame className="results-breakdown">
        <h2>Arsenal record</h2>
        <div className="damage-list">
          {result.weaponDamage
            .slice()
            .sort((a, b) => b.damage - a.damage)
            .map((entry, index) => {
              const definition = weaponDefinitions.find((weapon) => weapon.id === entry.id)
              return (
                <div key={entry.id} className="damage-row" style={{ '--row-delay': `${index * 80}ms` } as React.CSSProperties}>
                  <WeaponGlyph id={entry.id} size={20} />
                  <span>{definition?.name ?? entry.id}</span>
                  <i><b style={{ width: `${(entry.damage / maxDamage) * 100}%` }} /></i>
                  <strong>{entry.damage.toLocaleString()}</strong>
                </div>
              )
            })}
        </div>
        <div className="next-goal">
          <Target size={20} />
          <div>
            <small>{goalLabel}</small>
            <strong>{nextGoal}</strong>
          </div>
        </div>
        <div className="results-actions">
          {returnAction ? (
            <button className="text-action" onClick={returnAction}><ArrowLeft size={17} /> {returnLabel}</button>
          ) : null}
          <CrestButton tone="quiet" compact onClick={onRetry}>{retryLabel}</CrestButton>
          {!isCombatLab && onNext ? <CrestButton compact onClick={onNext}>{nextLabel}</CrestButton> : null}
        </div>
      </PanelFrame>
    </main>
  )
}
