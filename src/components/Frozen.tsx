"use client";

import { useRef, type ReactElement } from "react";

interface FrozenProps {
  /** While false, `children` stops re-rendering and holds its last output. */
  active: boolean;
  children: ReactElement;
}

/**
 * Keeps a subtree mounted but idle while it is off screen.
 *
 * Returning the *same* React element object as the previous render is React's
 * own signal to skip reconciling that subtree, so an inactive child neither
 * re-renders nor re-runs its hooks — while keeping all of its state, which is
 * the whole reason it stays mounted.
 *
 * Written for the POS checkout: it is deliberately not unmounted when the
 * cashier steps back to the basket, because a half-entered payment must
 * survive the trip. But it is 800 lines with two hooks full of chained memos,
 * and it was re-rendering on every `+` and `−` while completely invisible.
 *
 * The subtree resumes with fresh props the moment it becomes active again.
 */
export function Frozen({ active, children }: FrozenProps): ReactElement {
  const frozen = useRef(children);
  if (active) frozen.current = children;
  return frozen.current;
}
