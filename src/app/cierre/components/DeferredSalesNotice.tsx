"use client";

import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { LoadingState } from "@/components/LoadingState";
import { SALES_CUTOFF_DEFERRED_NOTICE_LABEL } from "@/constants/cierre";
import { formatDeferredSalesNotice } from "@/lib/cierre/salesCutoffCopy";

interface Props {
  /** The refetch of the closing data is still in flight. */
  loading: boolean;
  deferredCount: number;
  deferredTotal: number;
  /** What the screen's banner showed when this dialog was opened. */
  expectedCount: number;
  /** The stored cut is no longer the one the screen was showing. */
  cutoffChanged: boolean;
  isMobile: boolean;
  onRefresh: () => void;
}

const REFRESH_LABEL = "Actualizar";
const CUTOFF_CHANGED =
  "El corte cambió desde que abriste la pantalla de cierre.";

/**
 * What the confirmation dialog says goes to the next period, recounted against
 * the real state of the period rather than against the snapshot the selector
 * had. The sentence comes from the very function the screen's banner renders,
 * so the two figures the operator reads are one wording and not two that can
 * drift apart.
 *
 * The two ways the recount can disagree are NOT treated alike:
 *
 * - only the figures moved, same cut -> a warning, and confirming stays
 *   enabled: sales later than the cut arrived, which is the property of the
 *   model and not a fault.
 * - the cut itself moved -> a warning with a way to resync, and confirming is
 *   disabled: sending an `expectedCutoffAt` the server is already going to
 *   reject with a 409 is a race worth avoiding rather than awaiting.
 */
export default function DeferredSalesNotice({
  loading,
  deferredCount,
  deferredTotal,
  expectedCount,
  cutoffChanged,
  isMobile,
  onRefresh,
}: Readonly<Props>) {
  const countChanged = !cutoffChanged && deferredCount !== expectedCount;

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
    <Box
      component="section"
      aria-label={SALES_CUTOFF_DEFERRED_NOTICE_LABEL}
      sx={{ mt: 2 }}
    >
      {loading ? (
        <LoadingState variant="text" count={1} />
      ) : (
        <Stack spacing={1}>
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="body2">
              {formatDeferredSalesNotice(deferredCount, deferredTotal)}
            </Typography>
          </Alert>

          {countChanged && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              <Typography variant="body2">
                {`La cifra cambió: ahora pasan ${deferredCount} ventas al próximo período; al abrir la pantalla eran ${expectedCount}.`}
              </Typography>
            </Alert>
          )}

          {cutoffChanged && (
            <Alert
              severity="warning"
              sx={{ py: 0.5 }}
              action={!isMobile ? refreshButton : undefined}
            >
              {CUTOFF_CHANGED}
              {isMobile && refreshButton}
            </Alert>
          )}
        </Stack>
      )}
    </Box>
  );
}
