import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { GameCanvasHandle } from './game/GameCanvas'
import { LEVELS, MODULES, TRACE_MODS, WEAPONS, formatTime, getLevel } from './game/content'
import {
  SAVE_KEY,
  applyBossTrialReward,
  applyPersistentReward,
  getMasteryTargets,
  loadSave,
  resetSave,
  saveSave,
} from './game/save'
import {
  DEFAULT_COMBAT_LAB_CONFIG,
  buildBossTrialRunConfig,
  buildCombatLabRunConfig,
  isBossTrialUnlocked,
  normalizeCombatLabConfig,
} from './game/modes'
import { currentLocalWeaponShowcase } from './game/showcase'
import type {
  GameSettings,
  GameSnapshot,
  CombatLabConfig,
  LevelDefinition,
  ModuleDefinition,
  RunResult,
  RunConfig,
  SaveData,
  ScreenId,
  TraceModDefinition,
  WeaponDefinition,
} from './shared/types'
import {
  EncounterGate,
  GameHud,
  GameLoading,
  MobileTouchControls,
  PauseOverlay,
  UpgradeOverlay,
} from './ui/GameUI'
import {
  AstrariumScreen,
  BossTrialsScreen,
  CampaignScreen,
  CombatLabScreen,
  CodexScreen,
  ResultsScreen,
  SettingsScreen,
  TitleScreen,
} from './ui/Screens'
import { ASTRARIUM_NODES, type AstrariumNodeDefinition } from './ui/data'

const WEAPON_LIST = Object.values(WEAPONS) as WeaponDefinition[]
const MODULE_LIST = Object.values(MODULES) as ModuleDefinition[]
const TRACE_MOD_LIST = Object.values(TRACE_MODS) as TraceModDefinition[]
const GameCanvas = lazy(() => import('./game/GameCanvas'))

type ShellScreen = Exclude<ScreenId, 'title' | 'game' | 'results'>

function isShellScreen(screen: ScreenId): screen is ShellScreen {
  return (
    screen === 'campaign' ||
    screen === 'boss-trials' ||
    screen === 'combat-lab' ||
    screen === 'astrarium' ||
    screen === 'codex' ||
    screen === 'settings'
  )
}

function buildCampaignRunConfig(levelId: number): RunConfig {
  return {
    mode: 'campaign',
    arenaLevelId: levelId,
    bossLevelId: levelId,
    bossOnly: false,
    invincible: false,
    fixedLoadout: false,
    playerLevel: 1,
    bossHealthMultiplier: 1,
  }
}

function getNodeCost(node: AstrariumNodeDefinition, rank: number) {
  return node.baseCost * (rank + 1)
}

function getRefundTotal(save: SaveData) {
  return ASTRARIUM_NODES.reduce((total, node) => {
    const rank = save.upgrades[node.id] ?? 0
    let nodeTotal = 0
    for (let index = 0; index < rank; index += 1) nodeTotal += getNodeCost(node, index)
    return total + nodeTotal
  }, 0)
}

function safeLoadSave() {
  try {
    return loadSave()
  } catch {
    return resetSave()
  }
}

function isNarrowPortrait() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 900 && window.matchMedia('(orientation: portrait)').matches
}

function useNarrowPortrait() {
  const [isPortrait, setIsPortrait] = useState(isNarrowPortrait)

  useEffect(() => {
    const orientation = window.matchMedia('(orientation: portrait)')
    const update = () => setIsPortrait(isNarrowPortrait())
    orientation.addEventListener('change', update)
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      orientation.removeEventListener('change', update)
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return isPortrait
}

export default function App() {
  const showcase = useMemo(() => currentLocalWeaponShowcase(), [])
  const [save, setSave] = useState<SaveData>(safeLoadSave)
  const [screen, setScreen] = useState<ScreenId>(showcase ? 'game' : 'title')
  const [selectedLevelId, setSelectedLevelId] = useState(() =>
    showcase ? 1 : Math.max(1, Math.min(LEVELS.length, save.unlockedLevel)))
  const [selectedTrialLevelId, setSelectedTrialLevelId] = useState(() =>
    Math.min(LEVELS.length, save.bossTrialClears + 1))
  const [combatLabConfig, setCombatLabConfig] = useState<CombatLabConfig>(() =>
    normalizeCombatLabConfig(DEFAULT_COMBAT_LAB_CONFIG))
  const [activeRun, setActiveRun] = useState<RunConfig>(() => buildCampaignRunConfig(1))
  const [snapshot, setSnapshot] = useState<GameSnapshot>()
  const [result, setResult] = useState<RunResult>()
  const [resultRewards, setResultRewards] = useState<{
    mastery: Array<'clear' | 'trace' | 'aegis'>
    unlockedWeaponId?: string
  }>({ mastery: [] })
  const [runKey, setRunKey] = useState(0)
  const [rerollAvailable, setRerollAvailable] = useState(false)
  const [toast, setToast] = useState<string>()
  const gameRef = useRef<GameCanvasHandle>(null)
  const completionTokenRef = useRef('')
  const lastAudibleVolume = useRef(save.settings.masterVolume || 0.8)
  const isTouchDevicePortrait = useNarrowPortrait()

  const currentLevel = useMemo(() => getLevel(activeRun.arenaLevelId), [activeRun.arenaLevelId])
  const currentBossLevel = useMemo(() => getLevel(activeRun.bossLevelId), [activeRun.bossLevelId])
  const reducedMotion = save.settings.reducedShake
  const muted = save.settings.masterVolume === 0
  const rerollUnlocked = (save.upgrades['bright-draft'] ?? 0) > 0

  const persist = useCallback((next: SaveData) => {
    setSave(next)
    saveSave(next)
  }, [])

  useEffect(() => {
    const refreshSaveFromAnotherWindow = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== SAVE_KEY) return
      const next = safeLoadSave()
      setSave(next)
      setSelectedLevelId((levelId) => Math.max(1, Math.min(levelId, next.unlockedLevel)))
      setSelectedTrialLevelId((levelId) =>
        Math.max(1, Math.min(levelId, Math.min(LEVELS.length, next.bossTrialClears + 1))))
    }

    window.addEventListener('storage', refreshSaveFromAnotherWindow)
    return () => window.removeEventListener('storage', refreshSaveFromAnotherWindow)
  }, [])

  const announce = useCallback((message: string) => {
    setToast(message)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(undefined), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const updateSettings = useCallback((settings: GameSettings) => {
    persist({ ...save, settings })
  }, [persist, save])

  const toggleMute = useCallback(() => {
    if (save.settings.masterVolume > 0) {
      lastAudibleVolume.current = save.settings.masterVolume
      updateSettings({ ...save.settings, masterVolume: 0 })
      announce('Sound muted')
    } else {
      updateSettings({ ...save.settings, masterVolume: lastAudibleVolume.current || 0.8 })
      announce('Sound restored')
    }
  }, [announce, save.settings, updateSettings])

  const navigate = useCallback((destination: ShellScreen) => {
    setScreen(destination)
  }, [])

  const requestLandscapeMode = useCallback(async () => {
    if (
      !(
        window.matchMedia('(pointer: coarse)').matches ||
        navigator.maxTouchPoints > 0
      )
    ) {
      return
    }

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      }
    } catch {
      // iOS Safari and embedded browsers can reject fullscreen; the rotate gate
      // remains available as the manual, standards-safe fallback.
    }

    try {
      const orientation = window.screen.orientation as ScreenOrientation & {
        lock?: (orientation: 'landscape') => Promise<void>
      }
      await orientation.lock?.('landscape')
    } catch {
      // Orientation locking is only permitted by some browsers/fullscreen modes.
    }
  }, [])

  const launchRun = useCallback((runConfig: RunConfig) => {
    void requestLandscapeMode()
    setActiveRun(runConfig)
    setSnapshot(undefined)
    setResult(undefined)
    setResultRewards({ mastery: [] })
    setRerollAvailable(runConfig.mode === 'campaign' && rerollUnlocked)
    completionTokenRef.current = ''
    setRunKey((value) => value + 1)
    setScreen('game')
  }, [requestLandscapeMode, rerollUnlocked])

  const startLevel = useCallback((levelId: number) => {
    const safeLevelId = Math.max(1, Math.min(save.unlockedLevel, levelId))
    setSelectedLevelId(safeLevelId)
    launchRun(buildCampaignRunConfig(safeLevelId))
  }, [launchRun, save.unlockedLevel])

  const startCombatLab = useCallback((config: CombatLabConfig) => {
    const normalized = normalizeCombatLabConfig(config)
    setCombatLabConfig(normalized)
    launchRun(buildCombatLabRunConfig(normalized))
  }, [launchRun])

  const startBossTrial = useCallback((levelId: number) => {
    if (!isBossTrialUnlocked(levelId, save.bossTrialClears)) {
      announce('Defeat the previous sovereign to open this trial')
      return
    }
    setSelectedTrialLevelId(levelId)
    launchRun(buildBossTrialRunConfig(levelId))
  }, [announce, launchRun, save.bossTrialClears])

  const leaveGame = useCallback(() => {
    setSnapshot(undefined)
    setScreen(
      activeRun.mode === 'combat-lab'
        ? 'combat-lab'
        : activeRun.mode === 'boss-trial'
          ? 'boss-trials'
          : 'campaign',
    )
  }, [activeRun.mode])

  const restartLevel = useCallback(() => {
    setSnapshot(undefined)
    setRerollAvailable(activeRun.mode === 'campaign' && rerollUnlocked)
    completionTokenRef.current = ''
    setRunKey((value) => value + 1)
    setScreen('game')
  }, [activeRun.mode, rerollUnlocked])

  const completeRun = useCallback((runResult: RunResult) => {
    const completionToken = String(runKey)
    if (completionTokenRef.current === completionToken) return
    completionTokenRef.current = completionToken
    const progressedSave =
      runResult.runMode === 'campaign'
        ? applyPersistentReward(save, runResult)
        : runResult.runMode === 'boss-trial'
          ? applyBossTrialReward(save, runResult)
          : save
    const awardedShards = Math.max(0, progressedSave.dawnShards - save.dawnShards)
    const previousMastery = new Set(
      runResult.runMode === 'campaign' ? save.mastery[runResult.levelId] ?? [] : [],
    )
    const newlyEarnedMastery =
      runResult.runMode === 'campaign'
        ? (progressedSave.mastery[runResult.levelId] ?? []).filter(
            (seal) => !previousMastery.has(seal),
          )
        : []
    const unlockedWeaponId =
      runResult.runMode === 'campaign'
        ? progressedSave.unlockedWeapons.find((id) => !save.unlockedWeapons.includes(id))
        : undefined
    if (runResult.runMode !== 'combat-lab') persist(progressedSave)
    setResult({ ...runResult, dawnShards: awardedShards })
    setResultRewards({ mastery: newlyEarnedMastery, unlockedWeaponId })
    if (runResult.runMode === 'campaign') setSelectedLevelId(runResult.levelId)
    if (runResult.runMode === 'boss-trial') setSelectedTrialLevelId(runResult.levelId)
    setSnapshot(undefined)
    setScreen('results')
  }, [persist, runKey, save])

  const selectUpgrade = useCallback((optionId: string) => {
    gameRef.current?.selectUpgrade(optionId)
  }, [])

  const rerollUpgrade = useCallback(() => {
    if (!rerollAvailable) return
    gameRef.current?.rerollUpgrade()
    setRerollAvailable(false)
  }, [rerollAvailable])

  const togglePause = useCallback(() => {
    gameRef.current?.togglePause()
  }, [])

  const activatePulse = useCallback(() => {
    gameRef.current?.activatePulse()
  }, [])

  const beginEncounter = useCallback(() => {
    gameRef.current?.beginEncounter()
  }, [])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'KeyM') {
        event.preventDefault()
        toggleMute()
        return
      }
      if (screen !== 'game') return
      if ((event.code === 'Escape' || event.code === 'KeyP') && !snapshot?.upgradeOptions?.length) {
        event.preventDefault()
        togglePause()
        return
      }
      if (event.code === 'Space' && !snapshot?.paused && !snapshot?.upgradeOptions?.length) {
        event.preventDefault()
        activatePulse()
        return
      }
      if (snapshot?.upgradeOptions?.length && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
        const index = Number(event.code.at(-1)) - 1
        const option = snapshot.upgradeOptions[index]
        if (option) {
          event.preventDefault()
          selectUpgrade(option.id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [activatePulse, screen, selectUpgrade, snapshot?.paused, snapshot?.upgradeOptions, toggleMute, togglePause])

  const purchaseNode = useCallback((node: AstrariumNodeDefinition) => {
    const rank = save.upgrades[node.id] ?? 0
    if (rank >= node.maxRank) return
    if (node.requires && (save.upgrades[node.requires] ?? 0) <= 0) {
      announce('The linked constellation must be ignited first')
      return
    }
    const cost = getNodeCost(node, rank)
    if (save.dawnShards < cost) {
      announce(`You need ${cost - save.dawnShards} more Dawn Shards`)
      return
    }
    persist({
      ...save,
      dawnShards: save.dawnShards - cost,
      upgrades: { ...save.upgrades, [node.id]: rank + 1 },
    })
    announce(`${node.name} reached rank ${rank + 1}`)
  }, [announce, persist, save])

  const refundAstrarium = useCallback(() => {
    const refund = getRefundTotal(save)
    if (refund <= 0) return
    const clearedUpgrades = Object.fromEntries(Object.keys(save.upgrades).map((id) => [id, 0]))
    persist({
      ...save,
      dawnShards: save.dawnShards + refund,
      upgrades: clearedUpgrades,
    })
    announce(`${refund} Dawn Shards returned`)
  }, [announce, persist, save])

  const resetProgress = useCallback(() => {
    const freshSave = resetSave()
    const settingsPreserved = { ...freshSave, settings: { ...save.settings } }
    saveSave(settingsPreserved)
    setSave(settingsPreserved)
    setSelectedLevelId(1)
    setSelectedTrialLevelId(1)
    setCombatLabConfig(normalizeCombatLabConfig(DEFAULT_COMBAT_LAB_CONFIG))
    setActiveRun(buildCampaignRunConfig(1))
    setSnapshot(undefined)
    setResult(undefined)
    setScreen('title')
    announce('The archive has been cleared')
  }, [announce, save.settings])

  const nextLevel = result && result.runMode === 'campaign' && result.victory && result.levelId < LEVELS.length
    ? LEVELS[result.levelId]
    : undefined
  const nextTrial = result &&
    result.runMode === 'boss-trial' &&
    result.victory &&
    result.levelId < LEVELS.length &&
    save.bossTrialClears >= result.levelId
    ? LEVELS[result.levelId]
    : undefined
  const resultLevel: LevelDefinition | undefined = result ? getLevel(result.levelId) : undefined
  const nextGoal =
    result?.runMode === 'combat-lab'
      ? 'Reconfigure the simulation or repeat this encounter'
      : result?.runMode === 'boss-trial'
        ? nextTrial
          ? `Challenge ${nextTrial.bossName}`
          : result.victory
            ? 'Replay cleared sovereigns or perfect the full ladder'
            : `Return to ${resultLevel?.bossName ?? 'the unfinished trial'}`
        : nextLevel
          ? `Relight ${nextLevel.name}`
          : result?.victory
            ? 'Complete the remaining mastery seals'
            : `Return to ${resultLevel?.name ?? 'the unfinished sector'}`

  let content: React.ReactNode

  if (screen === 'title') {
    content = (
      <TitleScreen
        hasProgress={save.completedLevels.length > 0 || save.dawnShards > 0}
        reducedMotion={reducedMotion}
        muted={muted}
        onBegin={() => setScreen('campaign')}
        onBossTrials={() => setScreen('boss-trials')}
        onCombatLab={() => setScreen('combat-lab')}
        onCodex={() => setScreen('codex')}
        onSettings={() => setScreen('settings')}
        onToggleMute={toggleMute}
      />
    )
  } else if (screen === 'campaign') {
    content = (
      <CampaignScreen
        levels={LEVELS}
        save={save}
        selectedLevelId={selectedLevelId}
        onSelectLevel={setSelectedLevelId}
        onStart={startLevel}
        onNavigate={navigate}
        formatTime={formatTime}
        masteryTargets={getMasteryTargets(selectedLevelId)}
      />
    )
  } else if (screen === 'boss-trials') {
    content = (
      <BossTrialsScreen
        save={save}
        selectedLevelId={selectedTrialLevelId}
        onSelectLevel={setSelectedTrialLevelId}
        onStart={startBossTrial}
        onNavigate={navigate}
      />
    )
  } else if (screen === 'combat-lab') {
    content = (
      <CombatLabScreen
        save={save}
        config={combatLabConfig}
        onConfigChange={(config) =>
          setCombatLabConfig(normalizeCombatLabConfig(config))}
        onLaunch={startCombatLab}
        onNavigate={navigate}
      />
    )
  } else if (screen === 'astrarium') {
    content = (
      <AstrariumScreen
        save={save}
        onNavigate={navigate}
        onPurchase={purchaseNode}
        onRefund={refundAstrarium}
      />
    )
  } else if (screen === 'codex') {
    content = (
      <CodexScreen
        save={save}
        weapons={WEAPON_LIST}
        modules={MODULE_LIST}
        traceMods={TRACE_MOD_LIST}
        onNavigate={navigate}
      />
    )
  } else if (screen === 'settings') {
    content = (
      <SettingsScreen
        save={save}
        onNavigate={navigate}
        onSettingsChange={updateSettings}
        onReset={resetProgress}
      />
    )
  } else if (screen === 'game') {
    content = (
      <main className={`game-screen${save.settings.reducedFlash ? ' reduced-flash' : ''}`}>
        <Suspense fallback={<GameLoading levelName={currentLevel.name} />}>
          <GameCanvas
            key={`${activeRun.mode}-${currentLevel.id}-${currentBossLevel.id}-${runKey}`}
            ref={gameRef}
            level={currentLevel}
            runConfig={activeRun}
            settings={save.settings}
            unlockedWeapons={save.unlockedWeapons}
            persistentUpgrades={save.upgrades}
            orientationPaused={isTouchDevicePortrait}
            onSnapshot={setSnapshot}
            onComplete={completeRun}
            onExit={leaveGame}
          />
        </Suspense>
        {snapshot ? (
          <>
            <div
              className="game-interface"
              aria-hidden={
                snapshot.paused ||
                snapshot.awaitingStart ||
                Boolean(snapshot.upgradeOptions?.length)
                  ? true
                  : undefined
              }
              inert={
                snapshot.paused ||
                snapshot.awaitingStart ||
                Boolean(snapshot.upgradeOptions?.length)
                  ? true
                  : undefined
              }
            >
              <GameHud
                snapshot={snapshot}
                level={currentLevel}
                settings={save.settings}
                weaponDefinitions={WEAPON_LIST}
                formatTime={formatTime}
                onPause={togglePause}
                onPulse={activatePulse}
              />
              <MobileTouchControls
                pulseCharge={snapshot.pulseCharge}
                pulseReady={snapshot.pulseReady}
                onPulse={activatePulse}
                onPause={togglePause}
              />
            </div>
            {snapshot.upgradeOptions?.length ? (
              <UpgradeOverlay
                snapshot={snapshot}
                weapons={WEAPON_LIST}
                modules={MODULE_LIST}
                traceMods={TRACE_MOD_LIST}
                rerollUnlocked={rerollUnlocked}
                rerollAvailable={rerollAvailable}
                onSelect={selectUpgrade}
                onReroll={rerollUpgrade}
              />
            ) : null}
            {snapshot.awaitingStart && !isTouchDevicePortrait ? (
              <EncounterGate
                mode={snapshot.runMode}
                bossName={currentBossLevel.bossName}
                onBegin={beginEncounter}
              />
            ) : null}
            {snapshot.paused &&
            !snapshot.awaitingStart &&
            !isTouchDevicePortrait &&
            !snapshot.upgradeOptions?.length ? (
              <PauseOverlay
                muted={muted}
                onResume={togglePause}
                onRestart={restartLevel}
                onExit={leaveGame}
                onToggleMute={toggleMute}
              />
            ) : null}
          </>
        ) : (
          <GameLoading levelName={currentLevel.name} />
        )}
      </main>
    )
  } else if (screen === 'results' && result && resultLevel) {
    content = (
      <ResultsScreen
        result={result}
        level={resultLevel}
        weaponDefinitions={WEAPON_LIST}
        settings={save.settings}
        nextGoal={nextGoal}
        earnedMastery={resultRewards.mastery}
        unlockedWeapon={resultRewards.unlockedWeaponId
          ? WEAPON_LIST.find((weapon) => weapon.id === resultRewards.unlockedWeaponId)
          : undefined}
        onReturn={() =>
          setScreen(
            result.runMode === 'combat-lab'
              ? 'combat-lab'
              : result.runMode === 'boss-trial'
                ? 'boss-trials'
                : 'campaign',
          )}
        onRetry={restartLevel}
        onNext={
          nextLevel
            ? () => startLevel(nextLevel.id)
            : nextTrial
              ? () => startBossTrial(nextTrial.id)
              : undefined
        }
      />
    )
  } else {
    content = null
  }

  return (
    <div
      className={[
        'nighttrace-app',
        reducedMotion ? 'reduce-motion' : '',
        save.settings.reducedFlash ? 'reduce-flash' : '',
        isShellScreen(screen) ? 'is-shell' : '',
        screen === 'game' ? 'is-game' : '',
      ].join(' ')}
    >
      {content}
      {screen === 'game' && isTouchDevicePortrait ? (
        <section
          className="landscape-gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="landscape-gate-title"
          aria-describedby="landscape-gate-copy"
        >
          <div className="landscape-gate__glow" aria-hidden="true" />
          <div className="landscape-gate__phone" aria-hidden="true">
            <span />
          </div>
          <RotateCw size={28} aria-hidden="true" />
          <small>Battlefield orientation</small>
          <h1 id="landscape-gate-title">Rotate into the trace</h1>
          <p id="landscape-gate-copy">
            Turn your phone sideways. Combat is paused and will resume exactly where you left it.
          </p>
          <button onClick={() => void requestLandscapeMode()}>
            Enter landscape
          </button>
          <span className="landscape-gate__fallback">
            If your browser cannot rotate automatically, turn the device manually.
          </span>
        </section>
      ) : null}
      <div className={`toast-region${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
        <span>{toast}</span>
      </div>
    </div>
  )
}
