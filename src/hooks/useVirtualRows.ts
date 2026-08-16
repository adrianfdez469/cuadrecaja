"use client";

import { useCallback, useState } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

interface UseVirtualRowsOptions {
  /** Below this many items nothing changes: the whole list is rendered. */
  minItems: number;
  /** First guess at an item's height, before it is measured. */
  estimateSize: number;
  overscan?: number;
}

export interface VirtualRow<T> {
  item: T;
  /** Present only while virtualizing; carries the index and offset. */
  virtual: VirtualItem | null;
}

/**
 * Renders only the visible part of a long list.
 *
 * Wraps `@tanstack/react-virtual` with the two things every call site in this
 * codebase needs and is easy to get wrong:
 *
 * 1. **The scroll container arrives as state, not as a ref.** Refs attach
 *    bottom-up, so a child renders while its parent's ref is still null and
 *    nothing re-renders to tell it otherwise — the virtualizer would measure a
 *    zero-height scroller and draw nothing.
 * 2. **The list is never rendered whole "just for one frame".** `visible` is
 *    empty until the container exists, rather than falling back to every item.
 *    That fallback cost 6.4 seconds of main thread on a 2000-row table before
 *    virtualization even kicked in.
 *
 * Below `minItems` the list behaves exactly as it did before: everything is
 * rendered, no inner scroll, no measuring.
 */
export function useVirtualRows<T>(
  items: T[],
  { minItems, estimateSize, overscan = 8 }: UseVirtualRowsOptions,
) {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const containerRef = useCallback(
    (el: HTMLElement | null) => setScrollEl(el),
    [],
  );

  const needsVirtualization = items.length >= minItems;
  const isVirtual = needsVirtualization && scrollEl !== null;

  const virtualizer = useVirtualizer({
    count: isVirtual ? items.length : 0,
    getScrollElement: () => scrollEl,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const visible: VirtualRow<T>[] = needsVirtualization
    ? isVirtual
      ? virtualItems.map((virtual) => ({ item: items[virtual.index], virtual }))
      : []
    : items.map((item) => ({ item, virtual: null }));

  // Para listas en tabla: dos filas vacías sostienen el alto de lo no pintado,
  // que es lo que permite virtualizar sin romper la alineación de columnas.
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  return {
    /** Pásalo como `ref` al elemento que hace scroll. */
    containerRef,
    /** La lista es lo bastante larga como para virtualizar. */
    needsVirtualization,
    /** Ya se está virtualizando (el contenedor existe y está medido). */
    isVirtual,
    visible,
    paddingTop,
    paddingBottom,
    totalSize: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
  };
}
