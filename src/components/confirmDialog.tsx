import { useState, useCallback } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { ONBOARDING_JOYRIDE_Z_INDEX } from "@/features/onboarding/constants";

export interface IConfirmDialogTourAttrs {
  dialog?: string;
  confirm?: string;
  cancel?: string;
}

const useConfirmDialog = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [onConfirm, setOnConfirm] = useState(() => () => {});
  const [onCancel, setOnCancel] = useState(() => () => {});
  const [tourAttrs, setTourAttrs] = useState<IConfirmDialogTourAttrs | null>(null);

  const confirmDialog = useCallback(
    (
      dialogMessage: string,
      onConfirmCallback?: () => void | Promise<void>,
      onCancelCallback?: () => void | Promise<void>,
      attrs?: IConfirmDialogTourAttrs
    ) => {
      setMessage(dialogMessage);
      setTourAttrs(attrs ?? null);
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
    []
  );

  const ConfirmDialogComponent = (
    <Dialog
      open={open}
      onClose={onCancel}
      {...(tourAttrs?.dialog ? { "data-tour": tourAttrs.dialog } : {})}
      sx={
        tourAttrs
          ? { zIndex: ONBOARDING_JOYRIDE_Z_INDEX + 5 }
          : undefined
      }
    >
      <DialogTitle>Confirmación</DialogTitle>
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
          color="primary"
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
