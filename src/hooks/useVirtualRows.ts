"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  useVirtualizer,
  useWindowVirtualizer,
  type VirtualItem,
} from "@tanstack/react-virtual";

interface UseVirtualRowsOptions {
  /** Below this many items nothing changes: the whole list is rendered. */
  minItems: number;
  /** First guess at an item's height, before it is measured. */
  estimateSize: number;
  overscan?: number;
  /**
   * Which element scrolls.
   *
   * `"window"` — the page itself, which is what these screens already did
   * before they were virtualized: the list simply grows down the page, there
   * is one scrollbar, and nothing has to reserve a fixed height. Prefer it.
   *
   * `"container"` — an element with a bounded height. Only for lists that
   * genuinely live inside their own scroll area, such as a drawer.
   */
  scroller?: "window" | "container";
}

export interface VirtualRow<T> {
  item: T;
  /** Present only while virtualizing; carries the index and offset. */
  virtual: VirtualItem | null;
}

/**
 * Renders only the visible part of a long list.
 *
 * Wraps `@tanstack/react-virtual` with the things every call site in this
 * codebase needs and are easy to get wrong:
 *
 * 1. **The scroll container arrives as state, not as a ref.** Refs attach
 *    bottom-up, so a child renders while its parent's ref is still null and
 *    nothing re-renders to tell it otherwise — the virtualizer would measure a
 *    zero-height scroller and draw nothing.
 * 2. **The list is never rendered whole "just for one frame".** `visible` is
 *    empty until the scroller is known, rather than falling back to every
 *    item. That fallback cost 6.4 seconds of main thread on a 2000-row table
 *    before virtualization even kicked in.
 * 3. **Window mode carries its own `scrollMargin`.** The virtualizer measures
 *    against the document, so it has to know where in the page the list
 *    starts; without it the first rows are placed above the viewport.
 *
 * Below `minItems` the list behaves exactly as it did before: everything is
 * rendered, no measuring, no offsets.
 */
export function useVirtualRows<T>(
  items: T[],
  {
    minItems,
    estimateSize,
    overscan = 8,
    scroller = "window",
  }: UseVirtualRowsOptions,
) {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [listEl, setListEl] = useState<HTMLElement | null>(null);
  const containerRef = useCallback((el: HTMLElement | null) => {
    setScrollEl(el);
    setListEl(el);
  }, []);

  // Dónde empieza la lista dentro del documento. Solo lo usa el modo ventana,
  // y se remide en cada layout porque los filtros y las tarjetas de totales
  // que hay encima cambian de alto al desplegarse.
  const [scrollMargin, setScrollMargin] = useState(0);
  const scrollMarginRef = useRef(0);
  useLayoutEffect(() => {
    if (scroller !== "window" || !listEl) return;
    const medir = () => {
      const top = listEl.getBoundingClientRect().top + window.scrollY;
      if (Math.abs(scrollMarginRef.current - top) > 0.5) {
        scrollMarginRef.current = top;
        setScrollMargin(top);
      }
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [scroller, listEl]);

  const needsVirtualization = items.length >= minItems;
  const ready = scroller === "window" ? listEl !== null : scrollEl !== null;
  const isVirtual = needsVirtualization && ready;

  const commonOptions = {
    count: isVirtual ? items.length : 0,
    estimateSize: () => estimateSize,
    overscan,
  };

  const windowVirtualizer = useWindowVirtualizer({
    ...commonOptions,
    count: scroller === "window" ? commonOptions.count : 0,
    scrollMargin,
  });
  const containerVirtualizer = useVirtualizer({
    ...commonOptions,
    count: scroller === "container" ? commonOptions.count : 0,
    getScrollElement: () => scrollEl,
  });

  const virtualizer =
    scroller === "window" ? windowVirtualizer : containerVirtualizer;
  const virtualItems = virtualizer.getVirtualItems();

  const visible: VirtualRow<T>[] = needsVirtualization
    ? isVirtual
      ? virtualItems.map((virtual) => ({ item: items[virtual.index], virtual }))
      : []
    : items.map((item) => ({ item, virtual: null }));

  // En modo ventana los desplazamientos vienen medidos desde el documento, así
  // que hay que restarles dónde empieza la lista.
  const offset = scroller === "window" ? scrollMargin : 0;

  // Para listas en tabla: dos filas vacías sostienen el alto de lo no pintado,
  // que es lo que permite virtualizar sin romper la alineación de columnas.
  const paddingTop =
    virtualItems.length > 0 ? virtualItems[0].start - offset : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() -
        (virtualItems[virtualItems.length - 1].end - offset)
      : 0;

  return {
    /** Pásalo como `ref` al elemento que contiene la lista. */
    containerRef,
    /** La lista es lo bastante larga como para virtualizar. */
    needsVirtualization,
    /** Ya se está virtualizando. */
    isVirtual,
    visible,
    paddingTop,
    paddingBottom,
    totalSize: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
    /** Resta esto al `start` de cada item para posicionarlo dentro de la lista. */
    offset,
  };
}
