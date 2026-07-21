import { useCallback, useEffect, useState } from "react";
import { safeStorageGet, safeStorageSet } from "./safeStorage";

const PROFILE_KEY = "impossible-snake-profile-v1";
const CONTROL_MODES = new Set(["both", "wasd", "arrows"]);

const DEFAULT_PROFILE = {
  name: "",
  controls: "both",
  soundEnabled: true,
  bgmVolume: 85,
  sfxVolume: 75,
  reducedMotion: false,
};

function normalizeVolume(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.max(0, Math.min(100, parsed)) / 5) * 5;
}

function normalizeName(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
}

function normalizeProfile(value = {}) {
  return {
    name: normalizeName(value.name),
    controls: CONTROL_MODES.has(value.controls) ? value.controls : DEFAULT_PROFILE.controls,
    soundEnabled: value.soundEnabled !== false,
    bgmVolume: normalizeVolume(value.bgmVolume, DEFAULT_PROFILE.bgmVolume),
    sfxVolume: normalizeVolume(value.sfxVolume, DEFAULT_PROFILE.sfxVolume),
    reducedMotion: value.reducedMotion === true,
  };
}

function readProfile() {
  try {
    const saved = safeStorageGet(PROFILE_KEY);
    return saved ? normalizeProfile(JSON.parse(saved)) : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function usePlayerProfile() {
  const [profile, setProfile] = useState(readProfile);

  useEffect(() => {
    safeStorageSet(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  const updateProfile = useCallback((updates) => {
    setProfile((current) => normalizeProfile({ ...current, ...updates }));
  }, []);

  return { profile, updateProfile };
}
