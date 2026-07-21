import platformAdapter from "#platform-adapter";
import { getEngagementSnapshot, recordEngagement } from "./engagementTracker";

export const GAME_PLATFORM = platformAdapter.id;

const query = new URLSearchParams(window.location.search);
const mockAds = GAME_PLATFORM === "standalone" && query.get("mockAds") === "1";
const listeners = new Set();
const eventLog = [];
const handledEvents = new Set();

let snapshot = {
  platform: GAME_PLATFORM,
  initialized: false,
  sdkReady: false,
  loading: true,
  adRequesting: false,
  adPlaying: false,
  platformMuted: false,
  supportsRewarded: platformAdapter.supportsRewarded || mockAds,
  lastAdResult: null,
  recentEvents: [],
};

let initializationPromise = null;
let loadingFinished = false;
let gameplayActive = false;

function publish(patch) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

function emit(type, detail = {}) {
  const entry = { type, detail, at: Date.now() };
  eventLog.push(entry);
  if (eventLog.length > 200) eventLog.shift();
  publish({ recentEvents: eventLog.slice(-24).map((event) => event.type) });
  recordEngagement(type, detail);
  window.dispatchEvent(new CustomEvent("impossible-snake:sdk-event", { detail: entry }));
}

function sdkError(label, error) {
  emit("sdk:error", {
    label,
    message: error instanceof Error ? error.message : String(error ?? "Unknown SDK error"),
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function initializePlatform() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    emit("loading:start", { platform: GAME_PLATFORM });
    let sdkReady = false;

    try {
      sdkReady = await platformAdapter.initialize({
        setMuted: (platformMuted) => publish({ platformMuted }),
      });
    } catch (error) {
      sdkError("initialize", error);
    }

    publish({ initialized: true, sdkReady });
    emit("sdk:initialized", { platform: GAME_PLATFORM, sdkReady });
    return { platform: GAME_PLATFORM, sdkReady };
  })();

  return initializationPromise;
}

export function finishPlatformLoading() {
  if (loadingFinished) return;
  loadingFinished = true;

  try {
    if (snapshot.sdkReady) platformAdapter.finishLoading();
  } catch (error) {
    sdkError("loading-finished", error);
  }

  publish({ loading: false });
  emit("loading:finished", { platform: GAME_PLATFORM });
}

export function gameplayStart(context = {}) {
  if (gameplayActive || snapshot.adRequesting) return false;
  gameplayActive = true;

  try {
    if (snapshot.sdkReady) platformAdapter.gameplayStart(context);
  } catch (error) {
    sdkError("gameplay-start", error);
  }

  emit("gameplay:start", context);
  return true;
}

export function gameplayStop(reason = "interruption") {
  if (!gameplayActive) return false;
  gameplayActive = false;

  try {
    if (snapshot.sdkReady) platformAdapter.gameplayStop();
  } catch (error) {
    sdkError("gameplay-stop", error);
  }

  emit("gameplay:stop", { reason });
  return true;
}

function once(key, callback) {
  if (handledEvents.has(key)) return;
  handledEvents.add(key);
  callback();
}

export function trackLevelEvent(eventId, action, level, totalLevels) {
  once(`level:${eventId}:${action}`, () => {
    try {
      if (snapshot.sdkReady) platformAdapter.levelEvent(action, level, totalLevels);
    } catch (error) {
      sdkError("level-progress", error);
    }
    emit(`level:${action}`, { eventId, level });
  });
}

export function trackRewardOffer(eventId, action) {
  once(`reward-offer:${eventId}:${action}`, () => {
    try {
      if (snapshot.sdkReady) platformAdapter.rewardOffer(action);
    } catch (error) {
      sdkError("reward-offer", error);
    }
    emit(`reward-offer:${action}`, { eventId });
  });
}

export function celebrateVictory(eventId) {
  once(`victory:${eventId}`, () => {
    try {
      if (snapshot.sdkReady) platformAdapter.victory();
    } catch (error) {
      sdkError("celebration", error);
    }
    emit("game:victory", { eventId });
  });
}

function beginAdRequest(kind, placement) {
  gameplayStop(`ad-${kind}`);
  publish({ adRequesting: true, adPlaying: false, lastAdResult: null });
  emit("ad:request", { kind, placement });
}

function markAdStarted(kind, placement) {
  publish({ adPlaying: true });
  emit("ad:start", { kind, placement });
}

function finishAdRequest(kind, placement, success, error = null) {
  const adWasShown = snapshot.adPlaying;
  const eventName = success
    ? (kind === "rewarded" || adWasShown ? "ad:complete" : "ad:resolved")
    : "ad:error";

  publish({
    adRequesting: false,
    adPlaying: false,
    lastAdResult: { kind, placement, success, error },
  });
  emit(eventName, {
    kind,
    placement,
    message: error ? String(error.message ?? error) : null,
  });
  return success;
}

async function requestMockAd(kind, placement) {
  await wait(200);
  markAdStarted(kind, placement);
  await wait(650);
  return finishAdRequest(kind, placement, true);
}

async function requestAd(kind, placement) {
  if (snapshot.adRequesting) return false;
  beginAdRequest(kind, placement);

  if (mockAds) return requestMockAd(kind, placement);
  if (!snapshot.sdkReady) return finishAdRequest(kind, placement, false, "SDK unavailable");

  try {
    const success = await platformAdapter.requestAd(kind, {
      onStart: () => markAdStarted(kind, placement),
    });
    return finishAdRequest(kind, placement, success === true);
  } catch (error) {
    return finishAdRequest(kind, placement, false, error);
  }
}

export async function requestMidgameBreak(placement) {
  if (!mockAds && !platformAdapter.midgamePlacements.has(placement)) {
    emit("ad:skipped-policy", { kind: "midgame", placement });
    return false;
  }
  return requestAd("midgame", placement);
}

export function requestRewardedRevive() {
  return requestAd("rewarded", "revive");
}

export function subscribePlatform(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlatformSnapshot() {
  return snapshot;
}

window.__IMPOSSIBLE_SNAKE_SDK__ = {
  platform: GAME_PLATFORM,
  events: eventLog,
  getState: getPlatformSnapshot,
  getEngagement: getEngagementSnapshot,
};
