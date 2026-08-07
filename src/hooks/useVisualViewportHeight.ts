import { useEffect, useState } from "react";

/**
 * Tracks `window.visualViewport`'s height while `enabled`.
 *
 * `100dvh`-sized layouts are supposed to shrink when the on-screen keyboard
 * opens (helped along here by `interactiveWidget: "resizes-content"` in
 * `src/app/layout.tsx`), but iOS Safari support for that is version-gated —
 * on unsupported versions `dvh` stays keyboard-unaware while `position:
 * fixed` elements still track the real visible area, so the two end up in
 * different coordinate spaces. `visualViewport` has reliably reported the
 * true visible height since iOS 13, independent of that gap.
 *
 * Returns null when disabled, unsupported, or before the first measurement.
 */
export function useVisualViewportHeight(enabled: boolean) {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHeight(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return height;
}
