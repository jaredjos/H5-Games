function sdk() {
  return window.PokiSDK ?? null;
}

export default {
  id: "poki",
  supportsRewarded: true,
  midgamePlacements: new Set(["resume"]),

  async initialize() {
    const api = sdk();
    if (!api?.init) throw new Error("Poki SDK was not loaded");
    await api.init();
    return true;
  },

  finishLoading() {
    sdk().gameLoadingFinished();
  },

  gameplayStart() {
    sdk().gameplayStart();
  },

  gameplayStop() {
    sdk().gameplayStop();
  },

  levelEvent(action, level) {
    sdk().measure?.("level", String(level), action);
  },

  rewardOffer(action) {
    sdk().measure?.("button", "reward-revive", action);
  },

  victory() {
    sdk().happyTime?.(1);
  },

  async requestAd(kind, { onStart }) {
    if (kind === "rewarded") {
      return (await sdk().rewardedBreak({ size: "medium", onStart })) === true;
    }
    await sdk().commercialBreak(onStart);
    return true;
  },
};
