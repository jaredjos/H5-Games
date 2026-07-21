import { safeStorageGet, safeStorageSet } from "../game/safeStorage";

const METRICS_KEY = "poki_ignore_impossible-snake-metrics-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(timestamp = Date.now()) {
  return Math.floor(timestamp / DAY_MS);
}

function readMetrics() {
  try {
    const saved = safeStorageGet(METRICS_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

const sessionStartedAt = Date.now();
const currentDay = dayNumber(sessionStartedAt);
const savedMetrics = readMetrics();
const baseSessionMs = savedMetrics?.totalSessionMs ?? 0;
const baseGameplayMs = savedMetrics?.totalGameplayMs ?? 0;
let gameplayStartedAt = null;
let gameplayMsThisSession = 0;

const metrics = {
  version: 1,
  firstSeenDay: savedMetrics?.firstSeenDay ?? currentDay,
  lastSeenDay: currentDay,
  sessionCount: (savedMetrics?.sessionCount ?? 0) + 1,
  totalSessionMs: baseSessionMs,
  totalGameplayMs: baseGameplayMs,
  retainedAfterDay1: savedMetrics?.retainedAfterDay1 === true,
  retainedAfterDay7: savedMetrics?.retainedAfterDay7 === true,
  adRequests: savedMetrics?.adRequests ?? 0,
  adStarts: savedMetrics?.adStarts ?? 0,
  adCompletions: savedMetrics?.adCompletions ?? 0,
  rewardedRequests: savedMetrics?.rewardedRequests ?? 0,
  rewardedCompletions: savedMetrics?.rewardedCompletions ?? 0,
  lastEvent: null,
};

const ageInDays = currentDay - metrics.firstSeenDay;
if (ageInDays >= 1) metrics.retainedAfterDay1 = true;
if (ageInDays >= 7) metrics.retainedAfterDay7 = true;

function currentGameplayMs() {
  const activeMs = gameplayStartedAt ? Date.now() - gameplayStartedAt : 0;
  return baseGameplayMs + gameplayMsThisSession + activeMs;
}

export function flushEngagementMetrics() {
  metrics.totalSessionMs = baseSessionMs + (Date.now() - sessionStartedAt);
  metrics.totalGameplayMs = currentGameplayMs();
  safeStorageSet(METRICS_KEY, JSON.stringify(metrics));
}

export function recordEngagement(type, detail = {}) {
  if (type === "gameplay:start" && gameplayStartedAt === null) {
    gameplayStartedAt = Date.now();
  }

  if (type === "gameplay:stop" && gameplayStartedAt !== null) {
    gameplayMsThisSession += Date.now() - gameplayStartedAt;
    gameplayStartedAt = null;
  }

  if (type === "ad:request") metrics.adRequests += 1;
  if (type === "ad:start") metrics.adStarts += 1;
  if (type === "ad:complete") metrics.adCompletions += 1;
  if (type === "ad:request" && detail.kind === "rewarded") metrics.rewardedRequests += 1;
  if (type === "ad:complete" && detail.kind === "rewarded") metrics.rewardedCompletions += 1;

  metrics.lastEvent = { type, at: Date.now(), ...detail };
  flushEngagementMetrics();
}

export function getEngagementSnapshot() {
  flushEngagementMetrics();
  return { ...metrics };
}

window.addEventListener("pagehide", flushEngagementMetrics);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushEngagementMetrics();
});
