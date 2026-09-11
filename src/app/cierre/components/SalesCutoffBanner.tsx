"use client";

import { Alert, AlertTitle, Box, Button, Typography } from "@mui/material";
import { SALES_CUTOFF_BANNER_LABEL } from "@/constants/cierre";
import { formatDeferredSalesNotice } from "@/lib/cierre/salesCutoffCopy";
import { formatDateTime } from "@/utils/formatters";

interface Props {
  cutoffAt: Date;
  deferredCount: number;
  deferredTotal: number;
  /** True when the cut leaves no sale inside the close. */
  closeHasNoSales: boolean;
  /** Only whoever can close the period may undo the cut. */
  canRemove: boolean;
  isMobile: boolean;
  removing: boolean;
  onRemove: () => void;
}

const REMOVE_LABEL = "Quitar corte";
const NO_SALES_LINE = "Este cierre no incluye ninguna venta.";

/**
 * The first thing on the closing screen while a cut is set, because it is what
 * explains every figure below it. A cashier who arrives later must not read the
 * lower totals as sales gone missing.
 *
 * `info`, never `caution` or `negative`: a cut in place is not a fault and not a
 * risk to attend to. And never `accent` — the violet is reserved for what can
 * be pressed, and an alert painted in it would cost the screen its only way of
 * saying what is tappable.
 *
 * Shown to everyone, with or without the closing permission. What the permission
 * hides is the BUTTON, not the explanation.
 *
 * On a phone the action leaves the Alert's `action` slot, which strangles the
 * text — the same rule `DrawerDesfaseAlert` already follows.
 */
export default function SalesCutoffBanner({
  cutoffAt,
  deferredCount,
  deferredTotal,
  closeHasNoSales,
  canRemove,
  isMobile,
  removing,
  onRemove,
}: Readonly<Props>) {
  const removeButton = canRemove ? (
    <Button
      aria-label={REMOVE_LABEL}
      variant="outlined"
      color="info"
      onClick={onRemove}
      disabled={removing}
      fullWidth={isMobile}
      sx={{ minHeight: 44, ...(isMobile && { mt: 1 }) }}
    >
      {REMOVE_LABEL}
    </Button>
  ) : undefined;

  return (
    <Box component="section" aria-label={SALES_CUTOFF_BANNER_LABEL}>
      <Alert
        severity="info"
        action={!isMobile ? removeButton : undefined}
        sx={{ "& .MuiAlert-message": { width: "100%" } }}
      >
        <AlertTitle>{`Cierre preparado hasta el ${formatDateTime(cutoffAt)}`}</AlertTitle>
        <Typography variant="body2">
          {formatDeferredSalesNotice(deferredCount, deferredTotal)}
        </Typography>
        {closeHasNoSales && (
          <Typography variant="body2">{NO_SALES_LINE}</Typography>
        )}
        {isMobile && removeButton}
      </Alert>
    </Box>
  );
}
