import { useSyncExternalStore } from "react";
import { getPlatformSnapshot, subscribePlatform } from "./platformSdk";

export function usePlatformState() {
  return useSyncExternalStore(
    subscribePlatform,
    getPlatformSnapshot,
    getPlatformSnapshot,
  );
}
