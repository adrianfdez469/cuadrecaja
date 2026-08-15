import type { StateStorage } from "zustand/middleware";

/**
 * `localStorage` with writes batched.
 *
 * `localStorage.setItem` is synchronous and blocks the main thread, and Zustand's
 * `persist` calls it on every single mutation. In the POS that meant serializing
 * the whole basket on every tap of `+`, right in the middle of the interaction
 * the cashier is waiting on.
 *
 * Reads always see the pending value, so nothing observes a stale store. The
 * only exposure is the write window itself, which `flushPendingWrites` closes
 * on every event that precedes the page going away.
 */
const pending = new Map<string, string | null>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function commit(name: string) {
  const timer = timers.get(name);
  if (timer) {
    clearTimeout(timer);
    timers.delete(name);
  }
  if (!pending.has(name)) return;
  const value = pending.get(name);
  pending.delete(name);
  try {
    if (value === null) {
      window.localStorage.removeItem(name);
    } else {
      window.localStorage.setItem(name, value);
    }
  } catch {
    // Quota or a locked-down browser: losing the cached copy is survivable,
    // crashing the sale is not.
  }
}

/** Writes every batched value out now. Safe to call when nothing is pending. */
export function flushPendingWrites() {
  for (const name of Array.from(pending.keys())) commit(name);
}

let listenersAttached = false;

function attachFlushListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  // `pagehide` covers navigation and the bfcache; `visibilitychange` covers a
  // phone being locked or the app being swiped away, which on mobile is how
  // most sessions actually end and does not always fire `pagehide`.
  window.addEventListener("pagehide", flushPendingWrites);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingWrites();
  });
}

/**
 * A `StateStorage` for Zustand's `persist` that batches writes by `delayMs`.
 *
 * Pass the result to `createJSONStorage(() => createDebouncedStorage(ms))`.
 */
export function createDebouncedStorage(delayMs: number): StateStorage {
  attachFlushListeners();
  return {
    getItem: (name) => {
      if (pending.has(name)) return pending.get(name);
      try {
        return window.localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending.set(name, value);
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(
        name,
        setTimeout(() => commit(name), delayMs),
      );
    },
    removeItem: (name) => {
      pending.set(name, null);
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(
        name,
        setTimeout(() => commit(name), delayMs),
      );
    },
  };
}
