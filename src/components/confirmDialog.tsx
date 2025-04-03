import { useState, useCallback } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";

const useConfirmDialog = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [onConfirm, setOnConfirm] = useState(() => () => {});
  const [onCancel, setOnCancel] = useState(() => () => {});

  const confirmDialog = useCallback((message, onConfirmCallback, onCancelCallback) => {
    setMessage(message);
    setOnConfirm(() => async () => {
      setOpen(false);
      if (onConfirmCallback) {
        await onConfirmCallback();
      }
    });

    setOnCancel(() => async () => {
      setOpen(false);
      if(onCancelCallback) {
        await onCancelCallback()
      }
    })

    setOpen(true);
  }, []);

  const ConfirmDialogComponent = (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Confirmación</DialogTitle>
      <DialogContent>{message}</DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="error">No</Button>
        <Button onClick={onConfirm} color="primary">Sí</Button>
      </DialogActions>
    </Dialog>
  );

  return { confirmDialog, ConfirmDialogComponent };
};

export default useConfirmDialog;
