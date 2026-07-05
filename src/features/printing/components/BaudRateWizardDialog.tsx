"use client";

import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  Alert,
  Box,
} from "@mui/material";
import { SERIAL_BAUD_RATES } from "@/constants/ticket";
import {
  encodeBaudTestTicket,
  mapSerialError,
  serialPortManager,
} from "../lib/serialPortManager";
import { usePrintDeviceStore } from "../store/printDeviceStore";
import { IUsbSerialConnection } from "../types/IPrinterConfig";
import { useMessageContext } from "@/context/MessageContext";

interface BaudRateWizardDialogProps {
  open: boolean;
  onClose: () => void;
  tiendaId: string;
  connection: IUsbSerialConnection;
  onBaudDetected: (baudRate: number) => void;
}

type WizardStep = "intro" | "testing" | "confirm" | "done" | "exhausted";

export const BaudRateWizardDialog: React.FC<BaudRateWizardDialogProps> = ({
  open,
  onClose,
  tiendaId,
  connection,
  onBaudDetected,
}) => {
  const { showMessage } = useMessageContext();
  const setConfig = usePrintDeviceStore((s) => s.setConfig);
  const config = usePrintDeviceStore((s) => s.config);

  const [step, setStep] = useState<WizardStep>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentBaud, setCurrentBaud] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setStep("intro");
    setCurrentIndex(0);
    setCurrentBaud(null);
    setError(null);
    setBusy(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const tryCurrentBaud = async (index: number) => {
    const baud = SERIAL_BAUD_RATES[index];
    setCurrentBaud(baud);
    setStep("testing");
    setError(null);
    setBusy(true);

    try {
      await serialPortManager.release();
      await serialPortManager.ensureOpen({
        baudRate: baud,
        portHint: connection.portHint,
      });
      await serialPortManager.write(encodeBaudTestTicket(baud));
      setStep("confirm");
    } catch (err) {
      setError(mapSerialError(err));
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!connection.configured) {
      showMessage("Primero empareje el puerto serie (COM)", "warning");
      return;
    }
    setCurrentIndex(0);
    await tryCurrentBaud(0);
  };

  const handleYes = () => {
    if (!currentBaud || !config) return;

    const updatedConnection: IUsbSerialConnection = {
      ...connection,
      configured: true,
      baudRate: currentBaud,
    };

    setConfig({
      ...config,
      tiendaId,
      transportType: "usb_serial",
      connection: updatedConnection,
    });

    onBaudDetected(currentBaud);
    setStep("done");
    showMessage(`Velocidad guardada: ${currentBaud} baud`, "success");
  };

  const handleNo = async () => {
    const next = currentIndex + 1;
    if (next >= SERIAL_BAUD_RATES.length) {
      setStep("exhausted");
      return;
    }
    setCurrentIndex(next);
    await tryCurrentBaud(next);
  };

  const progress =
    step === "intro"
      ? 0
      : Math.round(((currentIndex + 1) / SERIAL_BAUD_RATES.length) * 100);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Detectar velocidad del puerto</DialogTitle>
      <DialogContent>
        {step === "intro" && (
          <Box>
            <Typography variant="body2" paragraph>
              Enviaremos una impresión de prueba con distintas velocidades. Usted
              solo debe indicar cuál salió legible en la impresora.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Asegúrese de que la impresora esté encendida y que COM1 no esté
              ocupado por Windows.
            </Typography>
          </Box>
        )}

        {(step === "testing" || step === "confirm") && (
          <Box>
            <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
            <Typography variant="body2" gutterBottom>
              Probando velocidad: <strong>{currentBaud}</strong> (
              {currentIndex + 1} de {SERIAL_BAUD_RATES.length})
            </Typography>
            {busy && (
              <Typography variant="body2" color="text.secondary">
                Enviando impresión de prueba…
              </Typography>
            )}
            {error && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {error}
              </Alert>
            )}
            {step === "confirm" && !busy && !error && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Revise la impresora. ¿Salió una línea legible que diga «PRUEBA{" "}
                {currentBaud}»?
              </Alert>
            )}
            {step === "confirm" && !busy && error && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                ¿Desea probar la siguiente velocidad?
              </Typography>
            )}
          </Box>
        )}

        {step === "done" && (
          <Alert severity="success">
            Velocidad <strong>{currentBaud}</strong> guardada. Ya puede imprimir el
            ticket de prueba completo.
          </Alert>
        )}

        {step === "exhausted" && (
          <Alert severity="error">
            No se encontró una velocidad válida. Verifique que COM1 no esté ocupado
            por la impresora de Windows, que eligió el puerto correcto (impresora,
            no cajón) y que la impresora esté encendida.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {step === "intro" && (
          <>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button variant="contained" onClick={handleStart}>
              Comenzar
            </Button>
          </>
        )}

        {step === "confirm" && !busy && (
          <>
            <Button onClick={handleNo}>No / Siguiente</Button>
            <Button variant="contained" onClick={handleYes} disabled={!!error}>
              Sí, imprimió bien
            </Button>
          </>
        )}

        {step === "confirm" && busy && <Button disabled>Enviando…</Button>}

        {(step === "done" || step === "exhausted") && (
          <Button variant="contained" onClick={handleClose}>
            Cerrar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
