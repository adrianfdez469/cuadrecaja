"use client";

import { Alert, Button } from "@mui/material";
import {
  SALES_CUTOFF_CONFLICT_MESSAGE,
  SALES_CUTOFF_SAVE_ERROR_MESSAGE,
} from "@/constants/cierre";

interface Props {
  kind: "conflict" | "error";
  isMobile: boolean;
  onRefresh: () => void;
}

const REFRESH_LABEL = "Actualizar";

/**
 * What the cutoff dialog says when the save did not go through.
 *
 * `conflict` is another cashier having moved the cut first — the optimistic
 * check answered 409 and wrote NOTHING. `warning`, never `error`: nothing broke
 * and nothing was written, and painting a race red teaches the operator to fear
 * a button they can press again. There is no "save anyway": overwriting in
 * silence the decision another cashier just made is exactly what the optimistic
 * check exists to prevent.
 *
 * It goes ABOVE the list, never over the footer: below 600px the list takes the
 * remaining height of the body, so anything added under it either steals that
 * height or falls out of view.
 */
export default function SalesCutoffSaveAlert({
  kind,
  isMobile,
  onRefresh,
}: Readonly<Props>) {
  if (kind === "error") {
    return <Alert severity="error">{SALES_CUTOFF_SAVE_ERROR_MESSAGE}</Alert>;
  }

  const refreshButton = (
    <Button
      color="warning"
      variant="outlined"
      onClick={onRefresh}
      fullWidth={isMobile}
      sx={{ minHeight: 44, ...(isMobile && { mt: 1 }) }}
    >
      {REFRESH_LABEL}
    </Button>
  );

  return (
    <Alert severity="warning" action={!isMobile ? refreshButton : undefined}>
      {SALES_CUTOFF_CONFLICT_MESSAGE}
      {isMobile && refreshButton}
    </Alert>
  );
}
