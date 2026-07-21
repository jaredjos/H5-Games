import { useCallback, useEffect, useMemo, useReducer } from "react";
import { DEFAULT_LIVES, KEY_DIRECTIONS, LIFE_OPTIONS } from "./constants";
import { safeStorageGet, safeStorageSet } from "./safeStorage";
import {
  createInitialState,
  createPreviewState,
  gameReducer,
  getThreatLevel,
  getTickDelay,
} from "./gameEngine";

const BEST_SCORE_KEY = "viper-zero-best";
const LIVES_KEY = "viper-zero-lives";
const WASD_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);
const ARROW_CODES = new Set(["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

function readBestScore() {
  const saved = Number.parseInt(safeStorageGet(BEST_SCORE_KEY, "0"), 10);
  return Number.isFinite(saved) ? saved : 0;
}

function readMaxLives() {
  const saved = Number.parseInt(safeStorageGet(LIVES_KEY, ""), 10);
  return LIFE_OPTIONS.includes(saved) ? saved : DEFAULT_LIVES;
}

function controlAllows(code, controlMode) {
  if (controlMode === "wasd") return WASD_CODES.has(code);
  if (controlMode === "arrows") return ARROW_CODES.has(code);
  return WASD_CODES.has(code) || ARROW_CODES.has(code);
}

export function useSnakeGame({ controlMode = "both", inputEnabled = true } = {}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const best = readBestScore();
    const maxLives = readMaxLives();
    if (!import.meta.env.DEV) return createInitialState(best, maxLives);

    const params = new URLSearchParams(window.location.search);
    const requestedSector = Number.parseInt(params.get("sector") ?? "1", 10);
    if (!Number.isFinite(requestedSector) || requestedSector <= 1) return createInitialState(best, maxLives);
    return createPreviewState(
      requestedSector - 1,
      best,
      params.get("showcase") === "1",
      maxLives,
    );
  });
  const tickDelay = getTickDelay(state);
  const threat = getThreatLevel(state);

  useEffect(() => {
    safeStorageSet(BEST_SCORE_KEY, String(state.best));
  }, [state.best]);

  useEffect(() => {
    safeStorageSet(LIVES_KEY, String(state.maxLives));
  }, [state.maxLives]);

  useEffect(() => {
    if (state.status !== "playing") return undefined;
    const timer = window.setInterval(
      () => dispatch({ type: "TICK", elapsedMs: tickDelay }),
      tickDelay,
    );
    return () => window.clearInterval(timer);
  }, [state.status, tickDelay]);

  useEffect(() => {
    if (state.status !== "levelup") return undefined;
    const timer = window.setTimeout(() => dispatch({ type: "ADVANCE_LEVEL" }), 1650);
    return () => window.clearTimeout(timer);
  }, [state.status]);

  const steer = useCallback((direction) => {
    dispatch({ type: "STEER", direction });
  }, []);

  const togglePause = useCallback(() => {
    dispatch({ type: "TOGGLE_PAUSE" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: "RETRY_LEVEL" });
  }, []);

  const rewardRevive = useCallback(() => {
    dispatch({ type: "REWARDED_REVIVE" });
  }, []);

  const setMaxLives = useCallback((maxLives) => {
    dispatch({ type: "SET_MAX_LIVES", maxLives });
  }, []);

  const newCampaign = useCallback(() => {
    dispatch({ type: "NEW_CAMPAIGN" });
  }, []);

  const toggleTestMode = useCallback(() => {
    dispatch({ type: "TOGGLE_TEST_MODE" });
  }, []);

  const selectTestLevel = useCallback((levelIndex) => {
    dispatch({ type: "SELECT_TEST_LEVEL", levelIndex });
  }, []);

  const activateTestPower = useCallback((power) => {
    dispatch({ type: "ACTIVATE_TEST_POWER", power });
  }, []);

  useEffect(() => {
    if (!inputEnabled) return undefined;

    function handleKeyDown(event) {
      const direction = KEY_DIRECTIONS[event.code];
      if (direction && controlAllows(event.code, controlMode)) {
        event.preventDefault();
        steer(direction);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controlMode, inputEnabled, steer]);

  return useMemo(
    () => ({
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
    }),
    [
      activateTestPower,
      newCampaign,
      reset,
      retry,
      rewardRevive,
      selectTestLevel,
      setMaxLives,
      state,
      steer,
      threat,
      togglePause,
      toggleTestMode,
    ],
  );
}
