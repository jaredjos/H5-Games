import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hud } from "./components/Hud";
import { MainMenu, ShutdownScreen } from "./components/MainMenu";
import { AdTransition, LoadingScreen } from "./components/PublishingStates";
import { LEVELS, LIFE_OPTIONS } from "./game/constants";
import { createPreviewState } from "./game/gameEngine";
import { safeStorageGet, safeStorageSet } from "./game/safeStorage";
import { useGameAudio } from "./game/useGameAudio";
import { usePlayerProfile } from "./game/usePlayerProfile";
import { useSnakeGame } from "./game/useSnakeGame";
import {
  celebrateVictory,
  finishPlatformLoading,
  gameplayStart,
  gameplayStop,
  initializePlatform,
  requestMidgameBreak,
  requestRewardedRevive,
  trackLevelEvent,
  trackRewardOffer,
} from "./platform/platformSdk";
import { usePlatformState } from "./platform/usePlatformState";

const SWIPE_THRESHOLD = 28;
const BEST_LEVEL_KEY = "impossible-snake-best-level";
const loadGameScene = () => import("./components/GameScene");
const GameScene = lazy(() =>
  loadGameScene().then((module) => ({ default: module.GameScene })),
);
const BOOT_ASSETS = ["assets/void-environment.png", "assets/arena-obsidian.png"];

function preloadImage(path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = `${import.meta.env.BASE_URL}${path}`;
  });
}

function readBestLevel() {
  const saved = Number.parseInt(safeStorageGet(BEST_LEVEL_KEY, "1"), 10);
  return Number.isFinite(saved) ? Math.max(1, Math.min(LEVELS.length, saved)) : 1;
}

export default function App() {
  const { profile, updateProfile } = usePlayerProfile();
  const platform = usePlatformState();
  const [bootProgress, setBootProgress] = useState(4);
  const [bootReady, setBootReady] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [view, setView] = useState("menu");
  const [bestLevel, setBestLevel] = useState(readBestLevel);
  const [rewardMessage, setRewardMessage] = useState("");
  const {
    state,
    threat,
    steer,
    togglePause,
    reset,
    retry,
    rewardRevive,
    setMaxLives,
    newCampaign,
    toggleTestMode,
    selectTestLevel,
    activateTestPower,
  } = useSnakeGame({
    controlMode: profile.controls,
    inputEnabled: bootReady && view === "game" && !platform.adRequesting,
  });
  const pointerStart = useRef(null);
  const level = LEVELS[state.levelIndex];
  const menuState = useMemo(
    () => createPreviewState(LEVELS.length - 1, state.best, true, state.maxLives),
    [state.best, state.maxLives],
  );
  const sceneState = view === "game" ? state : menuState;
  const { prime: primeAudio, playUi } = useGameAudio({
    event: state.event,
    enabled: profile.soundEnabled
      && view !== "shutdown"
      && !platform.adPlaying
      && !platform.platformMuted,
    bgmVolume: profile.bgmVolume,
    sfxVolume: profile.sfxVolume,
    status: view === "game" ? state.status : "menu",
    level: level.number,
    progress: state.levelProgress,
    target: level.target,
    threat: view === "game" ? threat : 0,
    activePower: view === "game" ? state.activePower : null,
  });

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        setBootError(false);
        setBootProgress(12);
        await initializePlatform();
        if (!active) return;
        setBootProgress(36);

        const tasks = [loadGameScene(), ...BOOT_ASSETS.map(preloadImage)];
        let completed = 0;
        await Promise.all(tasks.map((task) => Promise.resolve(task).finally(() => {
          completed += 1;
          if (active) setBootProgress(36 + Math.round((completed / tasks.length) * 60));
        })));

        if (!active) return;
        setBootProgress(100);
        finishPlatformLoading();
        setBootReady(true);
      } catch {
        if (active) setBootError(true);
      }
    }

    boot();
    return () => { active = false; };
  }, [bootAttempt]);

  useEffect(() => {
    safeStorageSet(BEST_LEVEL_KEY, String(bestLevel));
  }, [bestLevel]);

  const gameplayRunning = bootReady
    && view === "game"
    && state.status === "playing"
    && !platform.adRequesting;

  useEffect(() => {
    if (gameplayRunning) {
      const started = gameplayStart({ level: level.number, score: state.score });
      if (started && !state.testMode) {
        trackLevelEvent(state.event.id, "start", level.number, LEVELS.length);
      }
      return;
    }
    gameplayStop(view === "game" ? state.status : "menu");
  }, [gameplayRunning, level.number, state.event.id, state.score, state.status, state.testMode, view]);

  useEffect(() => () => gameplayStop("unmount"), []);

  useEffect(() => {
    if (!bootReady || view !== "game" || state.testMode) return;
    if (state.event.type === "crash") {
      trackLevelEvent(state.event.id, "fail", level.number, LEVELS.length);
    }
    if (state.event.type === "levelup" || state.event.type === "victory") {
      trackLevelEvent(state.event.id, "complete", level.number, LEVELS.length);
    }
    if (state.event.type === "victory") celebrateVictory(state.event.id);
  }, [bootReady, level.number, state.event, state.testMode, view]);

  useEffect(() => {
    const offerVisible = view === "game"
      && state.status === "gameover"
      && platform.supportsRewarded
      && !state.rewardReviveUsed;
    if (offerVisible) trackRewardOffer(state.event.id, "visible");
    if (state.status !== "gameover") setRewardMessage("");
  }, [platform.supportsRewarded, state.event.id, state.rewardReviveUsed, state.status, view]);

  useEffect(() => {
    if (view !== "game" || state.testMode) return;
    const reachedLevel = state.levelIndex + 1;
    setBestLevel((current) => Math.max(current, reachedLevel));
  }, [state.levelIndex, state.testMode, view]);

  const handleSteer = useCallback((direction) => {
    if (platform.adRequesting) return;
    primeAudio();
    steer(direction);
  }, [platform.adRequesting, primeAudio, steer]);

  const handleTogglePause = useCallback(async () => {
    if (platform.adRequesting) return;
    primeAudio();
    if (state.status === "paused") await requestMidgameBreak("resume");
    togglePause();
  }, [platform.adRequesting, primeAudio, state.status, togglePause]);

  const handleRetry = useCallback(async () => {
    if (platform.adRequesting || state.status !== "lifeLost") return;
    primeAudio();
    await requestMidgameBreak("retry");
    retry();
  }, [platform.adRequesting, primeAudio, retry, state.status]);

  const handleReset = useCallback(async () => {
    if (platform.adRequesting) return;
    primeAudio();
    if (state.status === "gameover" || state.status === "victory") {
      await requestMidgameBreak("restart");
    }
    reset();
  }, [platform.adRequesting, primeAudio, reset, state.status]);

  const handleRewardedRevive = useCallback(async () => {
    if (platform.adRequesting || state.status !== "gameover" || state.rewardReviveUsed) return;
    setRewardMessage("");
    trackRewardOffer(state.event.id, "interact");
    const rewarded = await requestRewardedRevive();
    if (rewarded) {
      rewardRevive();
      return;
    }
    setRewardMessage("AD UNAVAILABLE // RESTART TO CONTINUE");
  }, [platform.adRequesting, rewardRevive, state.event.id, state.rewardReviveUsed, state.status]);

  const handleToggleSound = useCallback(() => {
    if (!profile.soundEnabled) primeAudio(true);
    updateProfile({ soundEnabled: !profile.soundEnabled });
  }, [primeAudio, profile.soundEnabled, updateProfile]);

  const handleUpdateProfile = useCallback((updates) => {
    if (updates.soundEnabled === true && !profile.soundEnabled) primeAudio(true);
    if ("soundEnabled" in updates || "controls" in updates || "reducedMotion" in updates) {
      playUi("toggle");
    }
    updateProfile(updates);
  }, [playUi, primeAudio, profile.soundEnabled, updateProfile]);

  const handleSetLives = useCallback((maxLives) => {
    playUi("toggle");
    setMaxLives(maxLives);
  }, [playUi, setMaxLives]);

  const handleCycleLives = useCallback(() => {
    const currentIndex = LIFE_OPTIONS.indexOf(state.maxLives);
    const maxLives = LIFE_OPTIONS[(currentIndex + 1) % LIFE_OPTIONS.length];
    setMaxLives(maxLives);
  }, [setMaxLives, state.maxLives]);

  const enterGame = useCallback(() => {
    newCampaign();
    setView("game");
  }, [newCampaign]);

  const handlePlay = useCallback(() => {
    playUi("confirm");
    if (!profile.name) {
      setView("name");
      return;
    }
    enterGame();
  }, [enterGame, playUi, profile.name]);

  const handleConfirmName = useCallback((name) => {
    playUi("confirm");
    updateProfile({ name });
    enterGame();
  }, [enterGame, playUi, updateProfile]);

  const handleNavigate = useCallback((nextView) => {
    playUi(nextView === "menu" ? "back" : "select");
    setView(nextView);
  }, [playUi]);

  const handleReturnToMenu = useCallback(() => {
    playUi("back");
    newCampaign();
    setView("menu");
  }, [newCampaign, playUi]);

  const handleExit = useCallback(() => {
    playUi("back");
    setView("shutdown");
    window.setTimeout(() => window.close(), 120);
  }, [playUi]);

  const handleReconnect = useCallback(() => {
    setView("menu");
    playUi("confirm");
  }, [playUi]);

  const handleToggleTestMode = useCallback(() => {
    primeAudio();
    toggleTestMode();
  }, [primeAudio, toggleTestMode]);

  const handleActivateTestPower = useCallback((power) => {
    primeAudio();
    activateTestPower(power);
  }, [activateTestPower, primeAudio]);

  const handlePointerDown = useCallback((event) => {
    if (view !== "game" || platform.adRequesting || event.target.closest("button")) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }, [platform.adRequesting, view]);

  const handlePointerUp = useCallback((event) => {
    if (view !== "game" || platform.adRequesting || !pointerStart.current || event.target.closest("button")) return;
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    pointerStart.current = null;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) {
      if (state.status === "ready") handleTogglePause();
      else if (state.status === "lifeLost") handleRetry();
      else if (state.status === "gameover" || state.status === "victory") handleReset();
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) handleSteer(deltaX > 0 ? "right" : "left");
    else handleSteer(deltaY > 0 ? "down" : "up");
  }, [handleReset, handleRetry, handleSteer, handleTogglePause, platform.adRequesting, state.status, view]);

  useEffect(() => {
    if (!bootReady || view !== "game") return undefined;

    function handleGameKey(event) {
      if (["ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
      if (event.code !== "Space" || platform.adRequesting) return;

      if (state.status === "lifeLost") handleRetry();
      else if (state.status === "gameover" || state.status === "victory") handleReset();
      else handleTogglePause();
    }

    function preventWheel(event) {
      event.preventDefault();
    }

    window.addEventListener("keydown", handleGameKey);
    window.addEventListener("wheel", preventWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleGameKey);
      window.removeEventListener("wheel", preventWheel);
    };
  }, [bootReady, handleReset, handleRetry, handleTogglePause, platform.adRequesting, state.status, view]);

  if (!bootReady) {
    return (
      <LoadingScreen
        progress={bootProgress}
        error={bootError}
        onRetry={() => setBootAttempt((attempt) => attempt + 1)}
      />
    );
  }

  if (view === "shutdown") {
    return (
      <main className="game-shell game-shutdown">
        <ShutdownScreen onReconnect={handleReconnect} />
      </main>
    );
  }

  return (
    <main
      className={`game-shell game-${state.status} view-${view} ${platform.adRequesting ? "game-ad-active" : ""} ${state.testMode && view === "game" ? "game-test-mode" : ""} ${state.activePower && view === "game" ? `game-power-${state.activePower.type}` : ""} ${profile.reducedMotion ? "reduced-motion" : ""}`}
      data-sdk-events={import.meta.env.DEV ? platform.recentEvents.join("|") : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerStart.current = null; }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Suspense fallback={null}>
        <GameScene
          state={sceneState}
          threat={view === "game" ? threat : 0}
          presentationMode={view !== "game"}
          reducedMotion={profile.reducedMotion}
        />
      </Suspense>

      {view === "game" ? (
        <Hud
          state={state}
          controlMode={profile.controls}
          soundEnabled={profile.soundEnabled}
          onToggleSound={handleToggleSound}
          onTogglePause={handleTogglePause}
          onReturnToMenu={handleReturnToMenu}
          onReset={handleReset}
          onRetry={handleRetry}
          onRewardedRevive={handleRewardedRevive}
          rewardedReviveAvailable={platform.supportsRewarded && !state.rewardReviveUsed && !rewardMessage}
          rewardMessage={rewardMessage}
          interactionLocked={platform.adRequesting}
          onCycleLives={handleCycleLives}
          onToggleTestMode={handleToggleTestMode}
          onSelectTestLevel={selectTestLevel}
          onActivateTestPower={handleActivateTestPower}
          onSteer={handleSteer}
        />
      ) : (
        <div className="menu-layer">
          <MainMenu
            view={view}
            profile={profile}
            maxLives={state.maxLives}
            bestScore={state.best}
            bestLevel={bestLevel}
            onPlay={handlePlay}
            onConfirmName={handleConfirmName}
            onUpdateProfile={handleUpdateProfile}
            onSetLives={handleSetLives}
            onNavigate={handleNavigate}
            onExit={handleExit}
          />
        </div>
      )}

      {view === "game" ? (
        <p className="sr-only">
          Use {profile.controls === "wasd" ? "W, A, S, and D" : profile.controls === "arrows" ? "the arrow keys" : "W, A, S, and D or the arrow keys"} or the on-screen direction pad to steer. Press Space to pause or resume.
        </p>
      ) : null}

      {platform.adRequesting ? <AdTransition playing={platform.adPlaying} /> : null}
    </main>
  );
}
