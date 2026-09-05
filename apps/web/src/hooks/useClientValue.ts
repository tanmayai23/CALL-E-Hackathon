"use client";

/**
 * Two small hooks for reading browser-only state without a cascading render.
 *
 * The naive shape — `useState(null)` plus a `useEffect` that immediately calls
 * `setState` — renders twice on every mount and trips
 * `react-hooks/set-state-in-effect`. `useSyncExternalStore` is the intended
 * mechanism: it gives a server snapshot for SSR, a client snapshot after
 * hydration, and a subscription for changes, in one pass.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";

const NEVER_CHANGES = () => () => {};

/**
 * Read a value that only exists in the browser (localStorage, a dataset
 * attribute, a media query). Returns `serverValue` during SSR and the first
 * client render, then the real value.
 *
 * `read` must return a primitive, and the same primitive for the same browser
 * state — `useSyncExternalStore` compares snapshots with `Object.is`.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  // `useSyncExternalStore` does not require memoised readers — it only requires
  // that `read` return the same primitive for the same browser state. Pass a
  // module-scope function so the identity is stable anyway.
  return useSyncExternalStore(NEVER_CHANGES, read, () => serverValue);
}

/**
 * A ticking clock. Returns `null` on the server and the first client render —
 * so a timestamp can never cause a hydration mismatch — then the current epoch
 * milliseconds, refreshed every `intervalMs` while `active`.
 */
export function useNow(intervalMs = 1000, active = true): number | null {
  const cache = useRef(0);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      cache.current = Date.now();
      if (!active) return () => {};
      const id = setInterval(() => {
        cache.current = Date.now();
        onStoreChange();
      }, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs, active],
  );

  const get = useCallback(() => cache.current, []);
  const getServer = useCallback(() => 0, []);

  const value = useSyncExternalStore(subscribe, get, getServer);
  return value === 0 ? null : value;
}
