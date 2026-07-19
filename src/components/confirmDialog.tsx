import { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { ONBOARDING_JOYRIDE_Z_INDEX } from "@/features/onboarding/constants";

export interface IConfirmDialogTourAttrs {
  dialog?: string;
  confirm?: string;
  cancel?: string;
}

export type IConfirmDialogSeverity = "warning" | "error";

export interface IConfirmDialogOptions {
  tourAttrs?: IConfirmDialogTourAttrs;
  // Uso: cualquier confirmación que advierta de un riesgo, dato inusual o
  // consecuencia no obvia (ej. una compra que supera la caja disponible)
  // DEBE pasar severity: "warning" — el estilo neutro por defecto no
  // comunica que hay algo que revisar antes de confirmar.
  severity?: IConfirmDialogSeverity;
}

const SEVERITY_CONFIG = {
  warning: {
    icon: <WarningAmberIcon color="warning" />,
    titleColor: "warning.main",
    confirmColor: "warning" as const,
  },
  error: {
    icon: <ErrorOutlineIcon color="error" />,
    titleColor: "error.main",
    confirmColor: "error" as const,
  },
};

const useConfirmDialog = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [onConfirm, setOnConfirm] = useState(() => () => {});
  const [onCancel, setOnCancel] = useState(() => () => {});
  const [tourAttrs, setTourAttrs] = useState<IConfirmDialogTourAttrs | null>(
    null,
  );
  const [severity, setSeverity] = useState<IConfirmDialogSeverity | null>(null);

  const confirmDialog = useCallback(
    (
      dialogMessage: string,
      onConfirmCallback?: () => void | Promise<void>,
      onCancelCallback?: () => void | Promise<void>,
      options?: IConfirmDialogOptions,
    ) => {
      setMessage(dialogMessage);
      setTourAttrs(options?.tourAttrs ?? null);
      setSeverity(options?.severity ?? null);
      setOnConfirm(() => async () => {
        setOpen(false);
        if (onConfirmCallback) {
          await onConfirmCallback();
        }
      });

      setOnCancel(() => async () => {
        setOpen(false);
        if (onCancelCallback) {
          await onCancelCallback();
        }
      });

      setOpen(true);
    },
    [],
  );

  const severityConfig = severity ? SEVERITY_CONFIG[severity] : null;

  const ConfirmDialogComponent = (
    <Dialog
      open={open}
      onClose={onCancel}
      {...(tourAttrs?.dialog ? { "data-tour": tourAttrs.dialog } : {})}
      sx={tourAttrs ? { zIndex: ONBOARDING_JOYRIDE_Z_INDEX + 5 } : undefined}
    >
      <DialogTitle
        sx={
          severityConfig
            ? {
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: severityConfig.titleColor,
              }
            : undefined
        }
      >
        {severityConfig?.icon}
        Confirmación
      </DialogTitle>
      <DialogContent>{message}</DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          color="error"
          {...(tourAttrs?.cancel ? { "data-tour": tourAttrs.cancel } : {})}
        >
          No
        </Button>
        <Button
          onClick={onConfirm}
          color={severityConfig?.confirmColor ?? "primary"}
          variant={severityConfig ? "contained" : "text"}
          {...(tourAttrs?.confirm ? { "data-tour": tourAttrs.confirm } : {})}
        >
          Sí
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { confirmDialog, ConfirmDialogComponent };
};

export default useConfirmDialog;
