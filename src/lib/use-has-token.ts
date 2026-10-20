import { useSyncExternalStore } from "react";
import { getStoredToken } from "@/lib/auth-token";

function subscribe() {
  return () => {};
}

/**
 * Reads sessionStorage without a setState-in-effect round trip (flagged by
 * react-hooks/set-state-in-effect): useSyncExternalStore renders `false` for
 * the SSR/hydration pass (no window there) then re-renders synchronously
 * once mounted with the real client value, with no hydration mismatch.
 */
export function useHasStoredToken(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !!getStoredToken(),
    () => false,
  );
}
