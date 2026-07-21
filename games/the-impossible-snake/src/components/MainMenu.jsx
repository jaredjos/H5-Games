import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Music2,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { LEVELS, LIFE_OPTIONS } from "../game/constants";

const CONTROL_OPTIONS = [
  { value: "wasd", label: "WASD" },
  { value: "arrows", label: "ARROWS" },
  { value: "both", label: "BOTH" },
];

function MenuCommand({ children, active = false, onClick, onFocus, onPointerEnter }) {
  return (
    <button
      type="button"
      className={`menu-command ${active ? "menu-command-active" : ""}`}
      onClick={onClick}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
    >
      <ChevronRight aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}

function BackCommand({ onClick }) {
  return (
    <button type="button" className="menu-back" onClick={onClick}>
      <ChevronLeft aria-hidden="true" />
      <span>BACK</span>
    </button>
  );
}

function TitleMenu({ playerName, onPlay, onOptions, onHighScore, onExit }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const items = useMemo(() => [
    { label: "PLAY", action: onPlay },
    { label: "OPTIONS", action: onOptions },
    { label: "HIGH SCORE", action: onHighScore },
    { label: "EXIT", action: onExit },
  ], [onExit, onHighScore, onOptions, onPlay]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (["ArrowDown", "KeyS"].includes(event.code)) {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % items.length);
      } else if (["ArrowUp", "KeyW"].includes(event.code)) {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + items.length) % items.length);
      } else if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        items[activeIndex].action();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, items]);

  return (
    <section className="menu-panel menu-panel-home" aria-labelledby="game-title">
      <div className="title-lockup">
        <h1 id="game-title">
          <span>THE</span>
          IMPOSSIBLE
          <br />
          SNAKE
        </h1>
        <p>DARE TO CHALLENGE?</p>
      </div>

      <nav className="main-menu" aria-label="Main menu">
        {items.map((item, index) => (
          <MenuCommand
            key={item.label}
            active={index === activeIndex}
            onClick={item.action}
            onFocus={() => setActiveIndex(index)}
            onPointerEnter={() => setActiveIndex(index)}
          >
            {item.label}
          </MenuCommand>
        ))}
      </nav>

      {playerName ? (
        <div className="menu-profile">
          <span>PLAYER</span>
          <strong>{playerName}</strong>
        </div>
      ) : null}
    </section>
  );
}

function NamePrompt({ initialName, onConfirm, onBack }) {
  const [name, setName] = useState(initialName);
  const validName = name.trim();

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === "Escape") onBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <section className="menu-panel menu-panel-detail" aria-labelledby="identify-title">
      <form
        className="name-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (validName) onConfirm(validName);
        }}
      >
        <h2 id="identify-title">IDENTIFY PLAYER</h2>
        <label className="menu-field">
          <span>PLAYER NAME</span>
          <input
            autoFocus
            type="text"
            value={name}
            maxLength={18}
            autoComplete="nickname"
            spellCheck="false"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" className="menu-primary" disabled={!validName}>
          <ChevronRight aria-hidden="true" />
          <span>ENTER ARENA</span>
        </button>
        <BackCommand onClick={onBack} />
      </form>
    </section>
  );
}

function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="option-group">
      <span className="option-label">{label}</span>
      <div className="segmented-control" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "segment-active" : ""}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleControl({ label, checked, onChange, IconOn, IconOff }) {
  const Icon = checked ? IconOn : IconOff;
  return (
    <div className="option-toggle-row">
      <span className="option-label">{label}</span>
      <button
        type="button"
        className={`menu-switch ${checked ? "menu-switch-on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${checked ? "on" : "off"}`}
        onClick={() => onChange(!checked)}
      >
        <Icon aria-hidden="true" />
        <span>{checked ? "ON" : "OFF"}</span>
        <i aria-hidden="true" />
      </button>
    </div>
  );
}

function VolumeControl({ label, value, onChange, Icon }) {
  return (
    <label className="option-volume-row">
      <span className="volume-label">
        <span className="option-label">{label}</span>
        <output>{value}%</output>
      </span>
      <span className="volume-slider">
        <Icon aria-hidden="true" />
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={value}
          aria-label={`${label} volume`}
          onInput={(event) => onChange(Number(event.currentTarget.value))}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
      </span>
    </label>
  );
}

function OptionsPanel({ profile, maxLives, onUpdateProfile, onSetLives, onBack }) {
  const [nameDraft, setNameDraft] = useState(profile.name);

  const saveName = useCallback(() => onUpdateProfile({ name: nameDraft }), [nameDraft, onUpdateProfile]);
  const saveAndBack = useCallback(() => {
    saveName();
    onBack();
  }, [onBack, saveName]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === "Escape") saveAndBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveAndBack]);

  return (
    <section className="menu-panel menu-panel-detail options-panel" aria-labelledby="options-title">
      <h2 id="options-title">OPTIONS</h2>

      <label className="menu-field">
        <span>PLAYER NAME</span>
        <input
          type="text"
          value={nameDraft}
          maxLength={18}
          autoComplete="nickname"
          spellCheck="false"
          onBlur={saveName}
          onChange={(event) => setNameDraft(event.target.value)}
        />
      </label>

      <SegmentedControl
        label="CONTROLS"
        value={profile.controls}
        options={CONTROL_OPTIONS}
        onChange={(controls) => onUpdateProfile({ controls })}
      />

      <SegmentedControl
        label="LIVES PER RUN"
        value={maxLives}
        options={LIFE_OPTIONS.map((lives) => ({ value: lives, label: String(lives) }))}
        onChange={onSetLives}
      />

      <ToggleControl
        label="AUDIO"
        checked={profile.soundEnabled}
        onChange={(soundEnabled) => onUpdateProfile({ soundEnabled })}
        IconOn={Volume2}
        IconOff={VolumeX}
      />

      <div className="volume-controls" aria-label="Audio mix">
        <VolumeControl
          label="BGM"
          value={profile.bgmVolume}
          onChange={(bgmVolume) => onUpdateProfile({ bgmVolume })}
          Icon={Music2}
        />
        <VolumeControl
          label="SFX"
          value={profile.sfxVolume}
          onChange={(sfxVolume) => onUpdateProfile({ sfxVolume })}
          Icon={AudioLines}
        />
      </div>

      <ToggleControl
        label="REDUCED MOTION"
        checked={profile.reducedMotion}
        onChange={(reducedMotion) => onUpdateProfile({ reducedMotion })}
        IconOn={CircleOff}
        IconOff={Activity}
      />

      <BackCommand onClick={saveAndBack} />
    </section>
  );
}

function HighScorePanel({ playerName, bestScore, bestLevel, onBack }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === "Escape" || event.code === "Enter") onBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <section className="menu-panel menu-panel-detail score-panel" aria-labelledby="score-title">
      <h2 id="score-title">HIGH SCORE</h2>
      <div className="record-score">
        <span>PERSONAL RECORD</span>
        <strong>{String(bestScore).padStart(6, "0")}</strong>
      </div>
      <dl className="record-details">
        <div>
          <dt>PLAYER</dt>
          <dd>{playerName || "UNREGISTERED"}</dd>
        </div>
        <div>
          <dt>DEEPEST LEVEL</dt>
          <dd>{String(bestLevel).padStart(2, "0")} / {LEVELS.length}</dd>
        </div>
      </dl>
      <BackCommand onClick={onBack} />
    </section>
  );
}

function ExitPanel({ onConfirm, onBack }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === "Escape") onBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <section className="menu-panel menu-panel-detail exit-panel" aria-labelledby="exit-title">
      <h2 id="exit-title">EXIT GAME?</h2>
      <p>Your record and settings are saved on this device.</p>
      <div className="exit-actions">
        <button type="button" className="menu-danger" onClick={onConfirm}>EXIT</button>
        <button type="button" className="menu-secondary" onClick={onBack}>CANCEL</button>
      </div>
    </section>
  );
}

export function ShutdownScreen({ onReconnect }) {
  return (
    <section className="shutdown-screen" aria-labelledby="shutdown-title">
      <div>
        <span>THE IMPOSSIBLE SNAKE</span>
        <h1 id="shutdown-title">SESSION CLOSED</h1>
        <button type="button" className="menu-primary" onClick={onReconnect}>
          <RotateCcw aria-hidden="true" />
          <span>RECONNECT</span>
        </button>
      </div>
    </section>
  );
}

export function MainMenu({
  view,
  profile,
  maxLives,
  bestScore,
  bestLevel,
  onPlay,
  onConfirmName,
  onUpdateProfile,
  onSetLives,
  onNavigate,
  onExit,
}) {
  if (view === "name") {
    return <NamePrompt initialName={profile.name} onConfirm={onConfirmName} onBack={() => onNavigate("menu")} />;
  }
  if (view === "options") {
    return (
      <OptionsPanel
        profile={profile}
        maxLives={maxLives}
        onUpdateProfile={onUpdateProfile}
        onSetLives={onSetLives}
        onBack={() => onNavigate("menu")}
      />
    );
  }
  if (view === "scores") {
    return (
      <HighScorePanel
        playerName={profile.name}
        bestScore={bestScore}
        bestLevel={bestLevel}
        onBack={() => onNavigate("menu")}
      />
    );
  }
  if (view === "exit") {
    return <ExitPanel onConfirm={onExit} onBack={() => onNavigate("menu")} />;
  }

  return (
    <TitleMenu
      playerName={profile.name}
      onPlay={onPlay}
      onOptions={() => onNavigate("options")}
      onHighScore={() => onNavigate("scores")}
      onExit={() => onNavigate("exit")}
    />
  );
}
