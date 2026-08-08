import { useEffect, useRef, useState } from "react";

/**
 * Minimum viewport shrink treated as "the on-screen keyboard is open".
 * Well below any real keyboard (~250px+) and well above the browser
 * chrome that appears and disappears while scrolling (~50-90px).
 */
const KEYBOARD_MIN_SHRINK = 140;

interface OnScreenKeyboardState {
  /** Whether the on-screen keyboard is currently covering the viewport. */
  keyboardOpen: boolean;
  /** Real visible height, from `visualViewport`. Null until first measured. */
  viewportHeight: number | null;
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
 */
export function useOnScreenKeyboard(): OnScreenKeyboardState {
  const [state, setState] = useState<OnScreenKeyboardState>({
    keyboardOpen: false,
    viewportHeight: null,
  });
  const maxHeightRef = useRef(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const height = vv.height;
      maxHeightRef.current = Math.max(maxHeightRef.current, height);
      setState({
        keyboardOpen: maxHeightRef.current - height > KEYBOARD_MIN_SHRINK,
        viewportHeight: height,
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}
