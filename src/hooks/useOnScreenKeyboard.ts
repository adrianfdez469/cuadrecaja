import { useEffect, useRef, useState } from "react";

/**
 * Minimum viewport shrink treated as "the on-screen keyboard is open".
 * Well below any real keyboard (~250px+) and well above the browser
 * chrome that appears and disappears while scrolling (~50-90px).
 */
const KEYBOARD_MIN_SHRINK = 140;

/**
 * CSS variable carrying the live height of the visual viewport.
 *
 * The height is published this way — a direct write to the root element —
 * instead of through React state on purpose. While the keyboard animates open
 * the height changes on every frame, and feeding that through state
 * re-rendered the entire POS and re-laid out the whole product grid fifteen to
 * twenty times in a row, which is most of the delay before the keyboard even
 * appeared. A custom property reaches the same CSS with no render at all.
 */
export const VISUAL_VIEWPORT_HEIGHT_VAR = "--pos-visual-vh";

interface OnScreenKeyboardState {
  /** Whether the on-screen keyboard is currently covering the viewport. */
  keyboardOpen: boolean;
  /** The visual viewport has been measured at least once. */
  measured: boolean;
}

/**
 * Tracks the on-screen keyboard through `window.visualViewport`.
 *
 * The usual test — comparing `visualViewport.height` against
 * `window.innerHeight` — only works on browsers that leave the layout
 * viewport alone when the keyboard opens (older iOS Safari). Chrome honours
 * `interactiveWidget: "resizes-content"` (set in `src/app/layout.tsx`), so
 * there `innerHeight` shrinks along with the visual viewport and the two are
 * always equal: the keyboard becomes invisible to that test.
 *
 * So the reference is the tallest visual viewport seen so far, which is the
 * keyboard-less height on every browser. Nothing else grows the viewport
 * past it, and a stale maximum can only ever come from a rotation, which
 * fires a resize and re-measures.
 *
 * Only `keyboardOpen` is state, and it flips once per keyboard. The height
 * itself goes out through {@link VISUAL_VIEWPORT_HEIGHT_VAR}.
 */
export function useOnScreenKeyboard(): OnScreenKeyboardState {
  const [state, setState] = useState<OnScreenKeyboardState>({
    keyboardOpen: false,
    measured: false,
  });
  const maxHeightRef = useRef(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // `visualViewport` fires `scroll` on every frame of a mobile scroll, and
      // its height carries sub-pixel noise; rounding keeps that noise out of
      // both the CSS variable and the state below.
      const height = Math.round(vv.height);
      maxHeightRef.current = Math.max(maxHeightRef.current, height);

      document.documentElement.style.setProperty(
        VISUAL_VIEWPORT_HEIGHT_VAR,
        `${height}px`,
      );

      const keyboardOpen = maxHeightRef.current - height > KEYBOARD_MIN_SHRINK;
      setState((prev) =>
        prev.keyboardOpen === keyboardOpen && prev.measured
          ? prev
          : { keyboardOpen, measured: true },
      );
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty(VISUAL_VIEWPORT_HEIGHT_VAR);
    };
  }, []);

  return state;
}
