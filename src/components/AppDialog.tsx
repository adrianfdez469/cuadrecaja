"use client";

import { ReactNode } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

/**
 * The dialog shell for the whole app.
 *
 * Fifty files build a `<Dialog>` from scratch today, so each one re-decides its
 * header, its padding and — worse — the order and weight of its buttons. In
 * "Crear Movimiento" the result is a Cancel that reads heavier than the Save
 * beside it. Those are not choices a screen should be making one at a time.
 *
 * What this fixes by construction:
 * - the confirming action is always last and always the emphasised one
 * - there is always a way out: a close control in the corner, plus Escape
 * - the body scrolls, the header and footer do not
 * - it goes full-screen on phones instead of floating in a cramped card
 */
export type AppDialogProps = {
  open: boolean;
  /** Called by the close icon, the cancel button, Escape and backdrop clicks. */
  onClose: () => void;
  title: string;
  /** Optional line under the title. Context, not instructions. */
  subtitle?: string;
  children: ReactNode;

  /**
   * The confirming action. Rendered last and emphasised.
   * Omit it for a read-only dialog: then the footer only offers a way out.
   */
  confirm?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    /** `danger` for anything that destroys data. */
    tone?: "primary" | "danger";
  };
  cancelLabel?: string;
  /** Extra footer content, pinned left — a secondary action or a hint. */
  footerStart?: ReactNode;

  maxWidth?: "xs" | "sm" | "md" | "lg";
  /** Blocks the close control while work is in flight. */
  busy?: boolean;
};

export function AppDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  confirm,
  cancelLabel = "Cancelar",
  footerStart,
  maxWidth = "sm",
  busy = false,
}: AppDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth={maxWidth}
      fullScreen={fullScreen}
      aria-labelledby="app-dialog-title"
    >
      <DialogTitle id="app-dialog-title" component="div" sx={{ pr: 6, py: 2 }}>
        <Typography variant="h6" component="h2" fontWeight={600}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
        <IconButton
          aria-label="Cerrar"
          onClick={handleClose}
          disabled={busy}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 2.5 }}>{children}</DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        {footerStart && <Box sx={{ mr: "auto" }}>{footerStart}</Box>}

        <Stack direction="row" spacing={1}>
          <Button onClick={handleClose} disabled={busy} color="inherit">
            {cancelLabel}
          </Button>

          {confirm && (
            <Button
              variant="contained"
              color={confirm.tone === "danger" ? "error" : "primary"}
              onClick={confirm.onClick}
              disabled={confirm.disabled || confirm.loading}
              startIcon={
                confirm.loading ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {confirm.label}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default AppDialog;
