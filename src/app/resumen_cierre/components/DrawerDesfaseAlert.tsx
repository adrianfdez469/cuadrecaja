"use client";

import { Alert, AlertTitle, Button, Typography } from "@mui/material";
import {
  DESFASE_DRAWER_CUERPO,
  DESFASE_LABEL,
  DESFASE_SOLO_SUPERADMIN,
} from "./desfaseCopy";

interface Props {
  canRecalculate: boolean;
  isMobile: boolean;
  onRecalculate: () => void;
}

/**
 * First element of the detail drawer when the period's stored figures are
 * stale: everything below it is read through this warning. On a phone the
 * action leaves the Alert's `action` slot, which would starve the text.
 */
export default function DrawerDesfaseAlert({
  canRecalculate,
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
      action={canRecalculate && !isMobile ? button : undefined}
    >
      <AlertTitle>{DESFASE_LABEL}</AlertTitle>
      {DESFASE_DRAWER_CUERPO}
      {!canRecalculate && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {DESFASE_SOLO_SUPERADMIN}
        </Typography>
      )}
      {canRecalculate && isMobile && button}
    </Alert>
  );
}
