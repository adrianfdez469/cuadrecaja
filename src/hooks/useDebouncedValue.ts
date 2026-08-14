import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs`, settling on it once it stops changing.
 *
 * Meant for the expensive half of a controlled input: the field keeps the raw
 * value so typing stays instant, while the work it drives — filtering a
 * catalog, rebuilding a grid — reads the debounced one.
 *
 * The first value is adopted synchronously rather than after a delay, so a
 * mount with a pre-filled field renders its results right away.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (Object.is(value, debounced)) return;
    const timeoutId = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeoutId);
    // `debounced` is deliberately out of the deps: including it would restart
    // the timer when it settles, and the guard above already makes the effect
    // a no-op once the two agree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);

  return debounced;
}
