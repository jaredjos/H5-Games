function sdk() {
  return window.CrazyGames?.SDK ?? null;
}

export default {
  id: "crazygames",
  supportsRewarded: true,
  midgamePlacements: new Set(["resume", "retry", "restart"]),

  async initialize({ setMuted }) {
    const api = sdk();
    if (!api?.init) throw new Error("CrazyGames SDK was not loaded");
    await api.init();
    if (api.environment === "disabled") {
      throw new Error("CrazyGames SDK is disabled on this host");
    }

    api.game.loadingStart();
    const applySettings = (settings = {}) => setMuted(settings.muteAudio === true);
    applySettings(api.game.settings);
    api.game.addSettingsChangeListener?.(applySettings);
    return true;
  },

  finishLoading() {
    sdk().game.loadingStop();
  },

  gameplayStart(context) {
    sdk().game.gameplayStart();
    sdk().game.setGameContext?.({
      level: String(context.level ?? ""),
      score: String(context.score ?? 0),
    });
  },

  gameplayStop() {
    sdk().game.gameplayStop();
  },

  levelEvent(action, level, totalLevels) {
    sdk().game.setGameContext?.({ level: String(level) });
    if (action === "complete") {
      sdk().game.reportGameCompletedPercentage?.(Math.round((level / totalLevels) * 100));
    }
  },

  rewardOffer() {},

  victory() {
    sdk().game.happytime?.();
  },

  requestAd(kind, { onStart }) {
    return new Promise((resolve, reject) => {
      sdk().ad.requestAd(kind === "rewarded" ? "rewarded" : "midgame", {
        adStarted: onStart,
        adFinished: () => resolve(true),
        adError: reject,
      });
    });
  },
};
