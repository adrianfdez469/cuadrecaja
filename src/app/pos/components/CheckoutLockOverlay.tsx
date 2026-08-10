"use client";

import { Box, Fade, Stack, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

interface CheckoutLockOverlayProps {
  active: boolean;
  /** Called when the cashier clicks the scrim, to release the lock. */
  onDismiss: () => void;
}

/**
 * Covers the product side of the POS while the pinned cart panel is on its
 * checkout step. With both halves visible at once on desktop, nothing stopped
 * a tap on a product from changing the basket the cashier was already
 * charging for.
 *
 * Clicking it releases the lock, but the click itself does nothing else: it
 * is absorbed here and never reaches the product underneath, so the gesture
 * that dismisses the overlay can't also add something to the basket by
 * accident.
 *
 * `aria-hidden` is deliberate — this is a decorative click target with no
 * keyboard path of its own; the cart panel's own "Volver al carrito" button
 * is the accessible way back, and it stays focusable throughout.
 */
export function CheckoutLockOverlay({
  active,
  onDismiss,
}: CheckoutLockOverlayProps) {
  return (
    <Fade in={active} timeout={200} unmountOnExit>
      <Box
        aria-hidden
        onClick={onDismiss}
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          // The pane below sets `pointerEvents: "none"` while locked; this
          // re-enables it here only so the scrim itself absorbs the clicks
          // instead of letting them fall through to whatever is underneath.
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(15, 23, 42, 0.35)",
          backdropFilter: "blur(2px)",
          cursor: "pointer",
        }}
      >
        <Stack
          alignItems="center"
          gap={1}
          sx={{
            px: 3,
            py: 2,
            borderRadius: 2,
            bgcolor: "background.paper",
            boxShadow: 3,
            maxWidth: 320,
            textAlign: "center",
          }}
        >
          <LockOutlinedIcon color="action" />
          <Typography variant="subtitle2" fontWeight={700}>
            Cobro en curso
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Toca aquí para volver al carrito y seguir agregando productos.
          </Typography>
        </Stack>
      </Box>
    </Fade>
  );
}
