"use client";

import { Button, Stack, Typography } from "@mui/material";
import { ErrorOutline, Refresh, WifiOff } from "@mui/icons-material";

/**
 * A failed region, with a way out of it.
 *
 * The app has no error component at all: failures surface as a bare red string,
 * a toast that disappears, or nothing. That leaves the user staring at an empty
 * table with no idea whether it is empty or broken — which is exactly the case
 * where "there is no data" is the wrong thing to show.
 *
 * `offline` is a separate kind on purpose. This app sells without a connection,
 * so losing the network is a normal state, not a fault, and it should not be
 * dressed up as one.
 */
export type ErrorStateProps = {
  kind?: "error" | "offline";
  /** What went wrong, in the user's terms. */
  title?: string;
  /** What they can do about it. Avoid stack traces and status codes. */
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  kind = "error",
  title,
  description,
  onRetry,
  retryLabel = "Reintentar",
}: ErrorStateProps) {
  const isOffline = kind === "offline";

  const heading =
    title ?? (isOffline ? "Sin conexión" : "No se pudieron cargar los datos");

  const body =
    description ??
    (isOffline
      ? "Seguí trabajando: los cambios se guardan y se sincronizan cuando vuelva la conexión."
      : "Revisá tu conexión y volvé a intentarlo.");

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ textAlign: "center", py: 6, px: 3, width: "100%" }}
    >
      {isOffline ? (
        <WifiOff sx={{ fontSize: 40, color: "warning.main" }} />
      ) : (
        <ErrorOutline sx={{ fontSize: 40, color: "error.main" }} />
      )}

      <Typography variant="subtitle1" fontWeight={600}>
        {heading}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        {body}
      </Typography>

      {onRetry && (
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={onRetry}
          sx={{ mt: 0.5 }}
        >
          {retryLabel}
        </Button>
      )}
    </Stack>
  );
}

export default ErrorState;
