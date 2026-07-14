"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns false during SSR and the first client render, then true once the
 * component has hydrated. Use it to guard timezone/locale-dependent output so
 * the server HTML and the first client render match (avoiding hydration
 * mismatches) while still rendering the correct value in the viewer's browser.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
