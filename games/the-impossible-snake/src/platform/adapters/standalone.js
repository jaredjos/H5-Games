export default {
  id: "standalone",
  supportsRewarded: false,
  midgamePlacements: new Set(),
  async initialize() {
    return true;
  },
  finishLoading() {},
  gameplayStart() {},
  gameplayStop() {},
  levelEvent() {},
  rewardOffer() {},
  victory() {},
  async requestAd() {
    return false;
  },
};
