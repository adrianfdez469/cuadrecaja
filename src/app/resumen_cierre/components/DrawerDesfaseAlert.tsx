"use client";

import { Alert, AlertTitle, Button } from "@mui/material";
import { DESFASE_DRAWER_CUERPO, DESFASE_LABEL } from "./desfaseCopy";

interface Props {
  isMobile: boolean;
  onRecalculate: () => void;
}

/**
 * First element of the detail drawer when the period's stored figures are
 * stale: everything below it is read through this warning. On a phone the
 * action leaves the Alert's `action` slot, which would starve the text.
 * Rendered only for a superadmin — the only role that can recalculate.
 */
export default function DrawerDesfaseAlert({
  isMobile,
  onRecalculate,
}: Readonly<Props>) {
  const button = (
    <Button
      variant="outlined"
      color="warning"
      onClick={onRecalculate}
      fullWidth={isMobile}
      sx={{ minHeight: 44, ...(isMobile && { mt: 1 }) }}
    >
      Recalcular
    </Button>
  );

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={!isMobile ? button : undefined}
    >
      <AlertTitle>{DESFASE_LABEL}</AlertTitle>
      {DESFASE_DRAWER_CUERPO}
      {isMobile && button}
    </Alert>
  );
}
