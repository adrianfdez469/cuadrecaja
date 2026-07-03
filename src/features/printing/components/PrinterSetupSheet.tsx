"use client";

import React, { useEffect, useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  Stack,
  Divider,
  Chip,
} from "@mui/material";
import {
  Close,
  Print,
  Bluetooth,
  SettingsInputComponent,
  Wifi,
  Language,
  LinkOff,
  Speed,
} from "@mui/icons-material";
import { useMessageContext } from "@/context/MessageContext";
import { getPrintCapabilities, isIosDevice } from "../lib/capabilities";
import { usePrintDeviceStore } from "../store/printDeviceStore";
import { IUsbSerialConnection, PrinterTransportType } from "../types/IPrinterConfig";
import { usePrinter } from "../hooks/usePrinter";
import { DEFAULT_SERIAL_BAUD_RATE } from "@/constants/ticket";
import {
  mapSerialError,
  serialPortManager,
} from "../lib/serialPortManager";
import { BaudRateWizardDialog } from "./BaudRateWizardDialog";

interface PrinterSetupSheetProps {
  open: boolean;
  onClose: () => void;
  tiendaId: string;
}

export const PrinterSetupSheet: React.FC<PrinterSetupSheetProps> = ({
  open,
  onClose,
  tiendaId,
}) => {
  const { showMessage } = useMessageContext();
  const caps = getPrintCapabilities();
  const { config, testPrint } = usePrinter(tiendaId);
  const setConfig = usePrintDeviceStore((s) => s.setConfig);
  const setAutoPrint = usePrintDeviceStore((s) => s.setAutoPrint);
  const setTransportType = usePrintDeviceStore((s) => s.setTransportType);
  const setCopias = usePrintDeviceStore((s) => s.setCopias);

  const [host, setHost] = useState(
    config?.transportType === "network" && "host" in config.connection
      ? config.connection.host
      : "",
  );
  const [port, setPort] = useState(
    config?.transportType === "network" && "host" in config.connection
      ? String(config.connection.port || 9100)
      : "9100",
  );
  const [testing, setTesting] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [serialOpen, setSerialOpen] = useState(false);
  const [baudWizardOpen, setBaudWizardOpen] = useState(false);

  const serialConnection: IUsbSerialConnection =
    config?.transportType === "usb_serial" && "configured" in config.connection
      ? config.connection
      : { configured: false };

  useEffect(() => {
    if (open && config?.transportType === "usb_serial") {
      setSerialOpen(serialPortManager.isOpen());
    }
  }, [open, config?.transportType]);

  if (!config) return null;

  const handleTransportChange = (type: PrinterTransportType) => {
    setTransportType(type);
    const updated = usePrintDeviceStore.getState().config;
    if (updated) setConfig({ ...updated, tiendaId });
  };

  const handleSaveNetwork = () => {
    setConfig({
      ...config,
      tiendaId,
      transportType: "network",
      connection: { host: host.trim(), port: Number(port) || 9100 },
    });
    showMessage("Configuración de red guardada", "success");
  };

  const handleBluetoothPair = async () => {
    try {
      if (!navigator.bluetooth) {
        showMessage("Bluetooth no disponible en este dispositivo", "warning");
        return;
      }
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "00001101-0000-1000-8000-00805f9b34fb",
          "000018f0-0000-1000-8000-00805f9b34fb",
        ],
      });
      setConfig({
        ...config,
        tiendaId,
        transportType: "bluetooth",
        connection: {
          deviceId: device.id,
          deviceName: device.name || "Impresora BT",
        },
        lastConnectedAt: Date.now(),
      });
      showMessage(`Emparejado: ${device.name || device.id}`, "success");
    } catch (error) {
      if (error instanceof Error && error.name !== "NotFoundError") {
        showMessage(error.message, "error");
      }
    }
  };

  const handleSerialPair = async () => {
    setPairing(true);
    try {
      if (!navigator.serial) {
        showMessage(
          "Puerto serie no disponible. Use Chrome o Edge con HTTPS.",
          "warning",
        );
        return;
      }

      const baud = serialConnection.baudRate ?? DEFAULT_SERIAL_BAUD_RATE;
      const hint = await serialPortManager.requestAndBind(baud);

      const allPorts = await navigator.serial.getPorts();
      const connection: IUsbSerialConnection = {
        configured: true,
        baudRate: baud,
        portHint: hint,
        lastPortCount: allPorts.length,
      };

      setConfig({
        ...config,
        tiendaId,
        transportType: "usb_serial",
        connection,
        lastConnectedAt: Date.now(),
      });

      setSerialOpen(true);
      showMessage("Puerto serie (COM) emparejado y conectado", "success");
    } catch (error) {
      if (error instanceof Error && error.name === "NotFoundError") {
        return;
      }
      showMessage(mapSerialError(error), "error");
      setSerialOpen(false);
    } finally {
      setPairing(false);
    }
  };

  const handleDisconnectSerial = async () => {
    try {
      await serialPortManager.release();
      setSerialOpen(false);
      showMessage("Puerto serie desconectado", "info");
    } catch (error) {
      showMessage(mapSerialError(error), "error");
    }
  };

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      await testPrint();
      setSerialOpen(serialPortManager.isOpen());
      showMessage("Ticket de prueba enviado", "success");
    } catch (error) {
      showMessage(
        config.transportType === "usb_serial"
          ? mapSerialError(error)
          : error instanceof Error
            ? error.message
            : "Error al imprimir prueba",
        "error",
      );
    } finally {
      setTesting(false);
    }
  };

  const serialStatusChip = () => {
    if (!serialConnection.configured) {
      return <Chip size="small" label="Sin puerto COM" color="default" />;
    }
    if (serialOpen || serialPortManager.isOpen()) {
      const baud = serialConnection.baudRate ?? "sin detectar";
      return (
        <Chip
          size="small"
          label={`COM conectado · ${baud} baud`}
          color="success"
        />
      );
    }
    return (
      <Chip size="small" label="COM emparejado (desconectado)" color="warning" />
    );
  };

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "90vh",
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Configurar impresora
            </Typography>
            <IconButton onClick={onClose} aria-label="cerrar">
              <Close />
            </IconButton>
          </Box>

          {isIosDevice() && (
            <Alert severity="info" sx={{ mb: 2 }}>
              En iOS la impresión térmica por Bluetooth/USB es limitada. Use
              impresora en red o vista previa del navegador.
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Tipo de conexión</InputLabel>
            <Select
              value={config.transportType}
              label="Tipo de conexión"
              onChange={(e) =>
                handleTransportChange(e.target.value as PrinterTransportType)
              }
            >
              <MenuItem value="bluetooth" disabled={!caps.bluetooth}>
                <Bluetooth fontSize="small" sx={{ mr: 1 }} /> Bluetooth
              </MenuItem>
              <MenuItem value="usb_serial" disabled={!caps.usbSerial}>
                <SettingsInputComponent fontSize="small" sx={{ mr: 1 }} />{" "}
                Puerto serie (COM)
              </MenuItem>
              <MenuItem value="network">
                <Wifi fontSize="small" sx={{ mr: 1 }} /> Red / Wi‑Fi
              </MenuItem>
              <MenuItem value="browser">
                <Language fontSize="small" sx={{ mr: 1 }} /> Impresora Windows
                (navegador)
              </MenuItem>
            </Select>
          </FormControl>

          {config.transportType === "bluetooth" && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {config.connection && "deviceName" in config.connection
                  ? `Dispositivo: ${config.connection.deviceName}`
                  : "Sin dispositivo emparejado"}
              </Typography>
              <Button
                variant="outlined"
                onClick={handleBluetoothPair}
                startIcon={<Bluetooth />}
              >
                Buscar impresora Bluetooth
              </Button>
            </Stack>
          )}

          {config.transportType === "usb_serial" && (
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Alert severity="warning">
                En Windows, si la impresora también está en «Impresoras y
                escáneres», el puerto COM puede quedar ocupado y fallar al abrir.
                Quite o desactive esa impresora del sistema antes de emparejar.
                Use <strong>COM1</strong> para tickets (no COM2 si es el cajón).
              </Alert>

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {serialStatusChip()}
              </Box>

              <Button
                variant="outlined"
                onClick={handleSerialPair}
                startIcon={<SettingsInputComponent />}
                disabled={pairing}
              >
                {pairing
                  ? "Conectando…"
                  : "Seleccionar puerto serie (COM)"}
              </Button>

              {serialConnection.configured && (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => setBaudWizardOpen(true)}
                    startIcon={<Speed />}
                  >
                    Detectar velocidad del puerto
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={handleDisconnectSerial}
                    startIcon={<LinkOff />}
                  >
                    Desconectar puerto
                  </Button>
                </>
              )}

              <Typography variant="caption" color="text.secondary">
                Pasos: 1) Emparejar COM1 · 2) Detectar velocidad · 3) Imprimir
                prueba · 4) Activar auto-impresión
              </Typography>
            </Stack>
          )}

          {config.transportType === "network" && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              <TextField
                label="IP de la impresora"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100"
                fullWidth
                size="small"
              />
              <TextField
                label="Puerto"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                fullWidth
                size="small"
              />
              <Button variant="outlined" onClick={handleSaveNetwork}>
                Guardar IP
              </Button>
            </Stack>
          )}

          {config.transportType === "browser" && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Alert severity="info">
                Para imprimir sin diálogo en Windows, abra el POS con Chrome o
                Edge usando{" "}
                <strong>
                  --kiosk-printing --disable-print-preview
                </strong>{" "}
                y la URL de la app. En «Propiedades de impresora» configure el
                papel en rollo <strong>58 mm</strong> o <strong>80 mm</strong>{" "}
                (no A4) y longitud <strong>automática / según contenido</strong>{" "}
                en preferencias de impresora para evitar papel en blanco al final.
              </Alert>
              <Typography variant="caption" color="text.secondary">
                Ejemplo: chrome.exe --kiosk-printing --disable-print-preview
                --app=https://cuadrecaja.ventario.cloud
              </Typography>
            </Stack>
          )}

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={config.autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
              />
            }
            label="Imprimir automáticamente al cobrar"
          />

          <TextField
            label="Copias"
            type="number"
            value={config.copias}
            onChange={(e) => setCopias(Number(e.target.value))}
            inputProps={{ min: 1, max: 5 }}
            size="small"
            sx={{ mt: 1, mb: 2, width: 100 }}
          />

          <Button
            variant="contained"
            fullWidth
            startIcon={<Print />}
            onClick={handleTestPrint}
            disabled={testing}
          >
            {testing ? "Imprimiendo..." : "Imprimir ticket de prueba"}
          </Button>
        </Box>
      </Drawer>

      <BaudRateWizardDialog
        open={baudWizardOpen}
        onClose={() => setBaudWizardOpen(false)}
        tiendaId={tiendaId}
        connection={serialConnection}
        onBaudDetected={(baudRate) => {
          setSerialOpen(serialPortManager.isOpen());
          const updated = usePrintDeviceStore.getState().config;
          if (updated) {
            setConfig({
              ...updated,
              connection: {
                ...(updated.connection as IUsbSerialConnection),
                baudRate,
              },
            });
          }
        }}
      />
    </>
  );
};
