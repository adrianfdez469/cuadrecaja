"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { AppDialog } from "@/components/AppDialog";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SectionLabel } from "@/components/SectionLabel";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { VENTAS_VIRTUALIZATION_MIN_ROWS } from "@/constants/pos";
import {
  SALES_CUTOFF_DIALOG_TITLE,
  SALES_CUTOFF_LIST_LABEL,
  SALES_CUTOFF_ROW_HEIGHT,
} from "@/constants/cierre";
import {
  buildSalesCutoffListItems,
  groupSalesByDay,
  partitionSalesByCutoff,
  resolveSalesCutoffRequest,
  type SalesCutoffChoice,
} from "@/lib/cierre/salesCutoff";
import { setSalesCutoff } from "@/services/cierrePeriodService";
import { getSells } from "@/services/sellService";
import type { IVenta } from "@/schemas/venta";
import { getRelativeDate } from "@/utils/formatters";
import SalesCutoffLine from "./SalesCutoffLine";
import SalesCutoffSaleRow from "./SalesCutoffSaleRow";
import SalesCutoffSaveAlert from "./SalesCutoffSaveAlert";
import SalesCutoffShortcuts from "./SalesCutoffShortcuts";

interface Props {
  open: boolean;
  tiendaId: string;
  cierreId: string;
  /** Start of the open period. Bounds the "Nada" shortcut and every clamp. */
  fechaInicio: Date;
  /** The cut currently stored, which is also what the optimistic check sends. */
  storedCutoffAt: Date | null;
  onClose: () => void;
  /** The cut was written: the caller closes the dialog and reloads the screen. */
  onSaved: () => void;
  /** Someone else moved the cut: the caller closes the dialog and reloads. */
  onRefresh: () => void;
}

const INSTRUCTION =
  "Toca una venta para cerrar hasta ella: entra esa venta y todas las anteriores.";
const SUBTITLE =
  "Elige hasta dónde llega este cierre. Lo posterior pasa al próximo período.";

type LoadFailure = "error" | "offline";
type SaveFailure = "conflict" | "error";

/**
 * "Seleccionar ventas": where the operator says HOW FAR this close reaches.
 *
 * There are no checkboxes and no toggles, because a checkbox per sale would
 * suggest that one from the middle can be left out — precisely what the cut
 * makes impossible. Tapping a sale means "close up to here".
 *
 * The list runs OLDEST FIRST, the opposite of /ventas: this is not a history
 * being read but a boundary being found, and with time running downwards
 * "everything above enters, everything below is deferred" is one sentence that
 * needs no translating.
 *
 * ONE write, on confirm. The chips and the taps move local state: pressing
 * "Guardar corte" sends a single PATCH. Two reasons — `getInitData()` on the
 * screen flips it into its loading branch, which renders no dialog at all, so
 * writing per tap would close this dialog by itself; and moving the cut is
 * exploratory, so writing every trial would publish to the other cashiers
 * states the operator never chose.
 */
export default function SalesCutoffDialog({
  open,
  tiendaId,
  cierreId,
  fechaInicio,
  storedCutoffAt,
  onClose,
  onSaved,
  onRefresh,
}: Readonly<Props>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [sales, setSales] = useState<IVenta[] | null>(null);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [choice, setChoice] = useState<SalesCutoffChoice | null>(null);
  const [localCutoffAt, setLocalCutoffAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);

  const loadSales = useCallback(async () => {
    setSales(null);
    setLoadFailure(null);
    try {
      const data = await getSells(tiendaId, cierreId);
      // `getSells` returns `response.data` unparsed, so `createdAt` is an ISO
      // STRING at runtime even though the type says Date. Comparing a string
      // with a Date returns false without throwing, so the whole cut would fail
      // in silence: the coercion happens once, here, at the boundary.
      // The list also runs ascending, and /ventas answers descending.
      const coerced = data
        .map((v) => ({ ...v, createdAt: new Date(v.createdAt) }))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setSales(coerced);
    } catch {
      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      setLoadFailure(offline ? "offline" : "error");
    }
  }, [tiendaId, cierreId]);

  useEffect(() => {
    if (!open) return;
    setChoice(null);
    setLocalCutoffAt(storedCutoffAt);
    setSaveFailure(null);
    setSaving(false);
    loadSales();
  }, [open, storedCutoffAt, loadSales]);

  const days = useMemo(
    () => (sales ? groupSalesByDay(sales).map((g) => g.dayStart) : []),
    [sales],
  );

  const items = useMemo(
    () => (sales ? buildSalesCutoffListItems(sales, localCutoffAt) : []),
    [sales, localCutoffAt],
  );

  const counts = useMemo(() => {
    const { included, deferred } = partitionSalesByCutoff(
      sales ?? [],
      localCutoffAt,
    );
    return { included: included.length, deferred: deferred.length };
  }, [sales, localCutoffAt]);

  const handleChoose = (next: SalesCutoffChoice) => {
    const target = resolveSalesCutoffRequest(next, { fechaInicio }, new Date());
    // The instant the list is drawn with comes from the same translation the
    // request uses, so what the operator sees and what the server stores can
    // never be two different rules. "now" is stamped by the server; locally the
    // closest honest stand-in is this instant.
    setLocalCutoffAt(
      target.mode === "clear"
        ? null
        : target.mode === "now"
          ? new Date()
          : target.cutoffAt,
    );
    setChoice(next);
    setSaveFailure(null);
  };

  const handleSave = async () => {
    if (!choice) return;
    setSaving(true);
    setSaveFailure(null);
    try {
      const target = resolveSalesCutoffRequest(
        choice,
        { fechaInicio },
        new Date(),
      );
      await setSalesCutoff(tiendaId, cierreId, target, storedCutoffAt);
      onSaved();
    } catch (error) {
      setSaveFailure(error?.response?.status === 409 ? "conflict" : "error");
    } finally {
      setSaving(false);
    }
  };

  const listVirtual = useVirtualRows(items, {
    minItems: VENTAS_VIRTUALIZATION_MIN_ROWS,
    estimateSize: SALES_CUTOFF_ROW_HEIGHT,
    scroller: "container",
  });

  const scrollerRef = useRef<HTMLElement | null>(null);
  const cutRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!open) scrolledRef.current = false;
  }, [open]);

  // The dialog opens ON the stored cut, and the list opens showing it. Without
  // a cut it opens at the end: that is where the boundary would fall if it were
  // set right now.
  // The virtualizer is read through a ref: the hook hands back a fresh object
  // every render, and depending on it would re-run this effect endlessly.
  const listVirtualRef = useRef(listVirtual);
  listVirtualRef.current = listVirtual;

  useEffect(() => {
    if (!open || sales === null || scrolledRef.current) return;
    const cutIndex = items.findIndex((item) => item.kind === "cut");
    const target = cutIndex >= 0 ? cutIndex : items.length - 1;
    if (target < 0) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      const virtual = listVirtualRef.current;
      if (virtual.isVirtual) {
        virtual.scrollToIndex(target, { align: "center" });
        return;
      }
      if (cutIndex >= 0 && cutRef.current) {
        cutRef.current.scrollIntoView({ block: "center" });
      } else if (scrollerRef.current) {
        scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      }
    });
  }, [open, sales, items]);

  // Memoised on purpose: a fresh callback ref on every render would detach and
  // re-attach the scroller, and `useVirtualRows` keeps it in state — the
  // null/element pair would loop the component forever.
  const { containerRef } = listVirtual;
  const attachScroller = useCallback(
    (el: HTMLElement | null) => {
      scrollerRef.current = el;
      containerRef(el);
    },
    [containerRef],
  );

  const isEmpty = sales !== null && sales.length === 0;
  const showControls = sales !== null && !isEmpty && loadFailure === null;

  const renderItem = (item: (typeof items)[number]) => {
    if (item.kind === "day") {
      return (
        <SectionLabel sx={{ mb: 0, py: 1 }}>
          {getRelativeDate(item.dayStart)}
        </SectionLabel>
      );
    }
    if (item.kind === "cut") {
      return (
        <Box ref={cutRef}>
          <SalesCutoffLine cutoffAt={item.cutoffAt} />
        </Box>
      );
    }
    return (
      <SalesCutoffSaleRow
        venta={item.sale}
        included={item.included}
        onSelect={() =>
          handleChoose({ kind: "sale", createdAt: item.sale.createdAt })
        }
      />
    );
  };

  const itemKey = (item: (typeof items)[number], index: number) => {
    if (item.kind === "sale") return item.sale.id;
    if (item.kind === "day") return `day-${item.dayStart.getTime()}`;
    return `cut-${index}`;
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={SALES_CUTOFF_DIALOG_TITLE}
      subtitle={SUBTITLE}
      maxWidth="sm"
      busy={saving}
      confirm={
        isEmpty
          ? undefined
          : {
              label: "Guardar corte",
              onClick: handleSave,
              // Enabled only after a gesture. It is NOT compared against the
              // stored cut: the chip for today resolves to `mode: "now"`, whose
              // instant the server stamps, so "identical to the stored one" is
              // not computable here and promising it would be an absolute the
              // code cannot hold (E-017).
              disabled: !choice || saveFailure === "conflict",
              loading: saving,
            }
      }
    >
      <Stack
        spacing={1.5}
        sx={{ height: "100%", minHeight: 0, display: "flex" }}
      >
        {loadFailure === "offline" && (
          <ErrorState
            kind="offline"
            description="El corte se guarda en el servidor: vuelve a intentarlo cuando haya conexión."
            onRetry={loadSales}
          />
        )}
        {loadFailure === "error" && <ErrorState onRetry={loadSales} />}

        {isEmpty && (
          <EmptyState
            variant="empty"
            title="No hay ventas en este período"
            description="No hay nada que separar: este cierre no incluye ninguna venta."
          />
        )}

        {sales === null && loadFailure === null && (
          <LoadingState variant="list" />
        )}

        {showControls && (
          <>
            <Typography variant="caption" color="semantic.text.secondary">
              {INSTRUCTION}
            </Typography>

            <SalesCutoffShortcuts days={days} onChoose={handleChoose} />

            <Typography variant="body2">
              {`Entran ${counts.included} · Se difieren ${counts.deferred}`}
            </Typography>

            {saveFailure && (
              <SalesCutoffSaveAlert
                kind={saveFailure}
                isMobile={isMobile}
                onRefresh={onRefresh}
              />
            )}

            <Box
              component="section"
              aria-label={SALES_CUTOFF_LIST_LABEL}
              ref={attachScroller}
              sx={{
                overflowY: "auto",
                overflowX: "hidden",
                ...(isMobile ? { flex: 1, minHeight: 0 } : { height: "60dvh" }),
              }}
            >
              <Box
                sx={
                  listVirtual.needsVirtualization
                    ? {
                        position: "relative",
                        height: `${listVirtual.totalSize}px`,
                      }
                    : undefined
                }
              >
                {listVirtual.visible.map(({ item, virtual }) => (
                  <Box
                    key={itemKey(item, virtual ? virtual.index : 0)}
                    {...(virtual
                      ? {
                          "data-index": virtual.index,
                          ref: listVirtual.measureElement,
                          style: {
                            position: "absolute" as const,
                            top: 0,
                            left: 0,
                            right: 0,
                            transform: `translateY(${virtual.start - listVirtual.offset}px)`,
                          },
                        }
                      : {})}
                  >
                    {renderItem(item)}
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
      </Stack>
    </AppDialog>
  );
}
