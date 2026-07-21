import {
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flame,
  FlaskConical,
  Heart,
  House,
  Infinity as InfinityIcon,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { LEVELS, POWER_UPS } from "../game/constants";

const powerIcons = {
  aegis: Shield,
  fang: Flame,
  phase: Box,
};

function Metric({ label, value, pad = 4, className = "" }) {
  const formatted = typeof value === "number" ? String(value).padStart(pad, "0") : value;
  return (
    <div className={`metric ${className}`}>
      <span>{label}</span>
      <strong>{formatted}</strong>
    </div>
  );
}

function IconButton({ label, onClick, children, className = "", disabled = false }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function LivesControl({ lives, maxLives, configurable, testMode, onCycle }) {
  const label = testMode
    ? "Unlimited lives in test mode"
    : configurable
    ? `Lives per run: ${maxLives}. Click to change.`
    : `${lives} ${lives === 1 ? "life" : "lives"} remaining`;

  return (
    <button
      type="button"
      className={`lives-control ${testMode ? "lives-control-unlimited" : ""}`}
      onClick={onCycle}
      aria-label={label}
      title={label}
      disabled={!configurable}
    >
      {testMode ? <InfinityIcon /> : <Heart />}
      {testMode ? null : <strong>{lives}</strong>}
    </button>
  );
}

const directionControls = [
  { direction: "up", label: "Move up", Icon: ChevronUp },
  { direction: "left", label: "Move left", Icon: ChevronLeft },
  { direction: "right", label: "Move right", Icon: ChevronRight },
  { direction: "down", label: "Move down", Icon: ChevronDown },
];

function ObjectiveRail({ progress, target }) {
  return (
    <div className="objective-rail" role="progressbar" aria-label="Cores collected" aria-valuemin="0" aria-valuemax={target} aria-valuenow={progress}>
      {Array.from({ length: target }, (_, index) => (
        <span key={index} className={index < progress ? "objective-filled" : ""} />
      ))}
    </div>
  );
}

function PowerReadout({ activePower }) {
  if (!activePower) return null;
  const definition = POWER_UPS[activePower.type];
  const Icon = powerIcons[activePower.type];
  const seconds = Math.max(1, Math.ceil(activePower.remainingMs / 1000));
  const progress = Math.max(0, Math.min(1, activePower.remainingMs / definition.durationMs));

  return (
    <div className={`power-readout power-${activePower.type}`} aria-live="polite">
      <Icon />
      <strong>{definition.label}</strong>
      <span>{String(seconds).padStart(2, "0")}s</span>
      <i className="power-meter" aria-hidden="true">
        <b style={{ transform: `scaleX(${progress})` }} />
      </i>
    </div>
  );
}

const testPowers = ["aegis", "fang", "phase"];

function TestConsole({
  testMode,
  levelIndex,
  activePower,
  onToggle,
  onSelectLevel,
  onActivatePower,
  disabled,
}) {
  return (
    <div className={`test-console ${testMode ? "test-console-active" : ""}`}>
      <IconButton
        label={testMode ? "Disable test mode" : "Enable test mode"}
        onClick={onToggle}
        className="test-toggle"
        disabled={disabled}
      >
        <FlaskConical />
      </IconButton>
      {testMode ? (
        <div className="test-console-tools">
          <div className="test-mode-mark" aria-label="Unlimited lives">
            <InfinityIcon />
            <span>TEST</span>
          </div>
          <div className="test-levels" role="group" aria-label="Select test level">
            {LEVELS.map((testLevel, index) => (
              <button
                key={testLevel.number}
                type="button"
                className={index === levelIndex ? "test-option-active" : ""}
                aria-label={`Test level ${testLevel.number}`}
                aria-pressed={index === levelIndex}
                title={`Level ${testLevel.number}: ${testLevel.name}`}
                onClick={() => onSelectLevel(index)}
                disabled={disabled}
              >
                {String(testLevel.number).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div className="test-powers" role="group" aria-label="Activate test booster">
            {testPowers.map((power) => {
              const Icon = powerIcons[power];
              return (
                <button
                  key={power}
                  type="button"
                  className={`test-power test-power-${power} ${activePower?.type === power ? "test-option-active" : ""}`}
                  aria-label={`Activate ${POWER_UPS[power].label}`}
                  aria-pressed={activePower?.type === power}
                  title={`Activate ${POWER_UPS[power].label}`}
                  onClick={() => onActivatePower(power)}
                  disabled={disabled}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Hud({
  state,
  controlMode,
  soundEnabled,
  onToggleSound,
  onTogglePause,
  onReturnToMenu,
  onReset,
  onRetry,
  onRewardedRevive,
  rewardedReviveAvailable,
  rewardMessage,
  interactionLocked,
  onCycleLives,
  onToggleTestMode,
  onSelectTestLevel,
  onActivateTestPower,
  onSteer,
}) {
  const level = LEVELS[state.levelIndex];
  const runEnded = state.status === "gameover" || state.status === "victory";
  const lifeLost = state.status === "lifeLost";
  const transition = state.status === "levelup";
  const controlsLabel = controlMode === "wasd"
    ? "WASD"
    : controlMode === "arrows"
      ? "ARROWS"
      : "WASD / ARROWS";
  const activeHint = state.status === "ready" ? `${controlsLabel} TO BEGIN` : controlsLabel;
  const primaryAction = lifeLost ? onRetry : runEnded ? onReset : onTogglePause;
  const primaryLabel = state.status === "ready"
    ? "Start game"
    : state.status === "paused"
      ? "Resume game"
      : lifeLost
        ? `Retry level ${level.number}`
      : runEnded
        ? "Restart game"
        : transition
          ? "Next sector loading"
          : "Pause game";

  return (
    <div className="hud-layer">
      <header className="top-hud">
        <div className="brand" aria-label="The Impossible Snake">IMPOSSIBLE//SNAKE</div>
        <Metric label="LEVEL" value={level.number} pad={2} className="metric-level" />
        <Metric label="CORES" value={`${state.levelProgress}/${level.target}`} className="metric-cores" />
        <Metric label="SCORE" value={state.score} className="metric-score" />
        <Metric label="BEST" value={state.best} className="metric-best" />
        <div className="hud-actions">
          <LivesControl
          lives={state.lives}
          maxLives={state.maxLives}
          configurable={state.status === "ready"
            && state.levelIndex === 0
            && !state.testMode
            && !state.rewardReviveUsed}
            testMode={state.testMode}
            onCycle={onCycleLives}
          />
          <IconButton label="Return to main menu" onClick={onReturnToMenu} disabled={interactionLocked}>
            <House />
          </IconButton>
          <IconButton label={primaryLabel} onClick={primaryAction} disabled={transition || interactionLocked}>
            {runEnded || lifeLost
              ? <RotateCcw />
              : state.status === "ready" || state.status === "paused"
                ? <Play />
                : <Pause />}
          </IconButton>
          <IconButton
            label={soundEnabled ? "Mute sound" : "Enable sound"}
            onClick={onToggleSound}
            disabled={interactionLocked}
          >
            {soundEnabled ? <Volume2 /> : <VolumeX />}
          </IconButton>
        </div>
      </header>

      <ObjectiveRail progress={state.levelProgress} target={level.target} />
      <PowerReadout activePower={state.activePower} />
      {state.activePower ? <div className={`power-frame power-frame-${state.activePower.type}`} aria-hidden="true" /> : null}

      <div className={`state-message state-message-${state.status}`} aria-live="polite">
        {state.status === "paused" ? (
          <>
            <span>PAUSED</span>
            <IconButton label="Resume game" onClick={onTogglePause} className="state-action" disabled={interactionLocked}>
              <Play />
            </IconButton>
          </>
        ) : null}
        {state.status === "levelup" ? (
          <>
            <span>SECTOR CLEARED</span>
            <strong>LEVEL {String(level.number + 1).padStart(2, "0")}</strong>
            <em>{LEVELS[state.levelIndex + 1]?.name}</em>
          </>
        ) : null}
        {lifeLost ? (
          <>
            <span>LIFE LOST</span>
            <strong>{state.testMode ? "UNLIMITED" : `${String(state.lives).padStart(2, "0")} REMAIN`}</strong>
            <em>RETRY LEVEL {String(level.number).padStart(2, "0")}</em>
            <IconButton label={`Retry level ${level.number}`} onClick={onRetry} className="state-action" disabled={interactionLocked}>
              <RotateCcw />
            </IconButton>
          </>
        ) : null}
        {state.status === "gameover" ? (
          <>
            <span>RUN ENDED</span>
            <strong>{String(state.score).padStart(4, "0")}</strong>
            <em>ALL LIVES SPENT / RETURN TO LEVEL 01</em>
            {rewardedReviveAvailable ? (
              <div className="gameover-actions">
                <button type="button" className="gameover-choice gameover-choice-rewarded" onClick={onRewardedRevive} disabled={interactionLocked}>
                  <Video />
                  <span>WATCH AD</span>
                  <em>REVIVE LEVEL {String(level.number).padStart(2, "0")}</em>
                </button>
                <button type="button" className="gameover-choice gameover-choice-standard" onClick={onReset} disabled={interactionLocked}>
                  <RotateCcw />
                  <span>RESTART</span>
                  <em>RETURN TO LEVEL 01</em>
                </button>
              </div>
            ) : (
              <IconButton label="Restart game" onClick={onReset} className="state-action" disabled={interactionLocked}>
                <RotateCcw />
              </IconButton>
            )}
            {rewardMessage ? <em className="reward-message">{rewardMessage}</em> : null}
          </>
        ) : null}
        {state.status === "victory" ? (
          <>
            <span>SINGULARITY CLEARED</span>
            <strong>{String(state.score).padStart(4, "0")}</strong>
            <IconButton label="Start a new hunt" onClick={onReset} className="state-action" disabled={interactionLocked}>
              <RotateCcw />
            </IconButton>
          </>
        ) : null}
      </div>

      <div className="desktop-hint">
        {state.status === "paused"
          ? "SPACE TO RESUME"
          : lifeLost
            ? "SPACE TO RETRY"
          : runEnded
            ? "SPACE TO RESET RUN"
            : transition
              ? "NEXT SECTOR"
              : activeHint}
      </div>

      {import.meta.env.DEV ? (
        <TestConsole
          testMode={state.testMode}
          levelIndex={state.levelIndex}
          activePower={state.activePower}
          onToggle={onToggleTestMode}
          onSelectLevel={onSelectTestLevel}
          onActivatePower={onActivateTestPower}
          disabled={interactionLocked}
        />
      ) : null}

      <div className="mobile-input">
        <span>{state.status === "ready" ? "SWIPE OR TAP TO BEGIN" : lifeLost ? "TAP TO RETRY" : runEnded ? "TAP TO RESET RUN" : "SWIPE OR TAP"}</span>
        <div className="direction-pad" role="group" aria-label="Movement controls">
          {directionControls.map(({ direction, label, Icon }) => (
            <button
              key={direction}
              type="button"
              className={`direction-button direction-${direction}`}
              aria-label={label}
              title={label}
              disabled={transition || lifeLost || runEnded || interactionLocked}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSteer(direction);
              }}
            >
              <Icon />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
