"use client";

import React, { useState } from "react";
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
} from "@mui/material";
import { Close, Print, Bluetooth, Usb, Wifi, Language } from "@mui/icons-material";
import { useMessageContext } from "@/context/MessageContext";
import { getPrintCapabilities, isIosDevice } from "../lib/capabilities";
import { usePrintDeviceStore } from "../store/printDeviceStore";
import { PrinterTransportType } from "../types/IPrinterConfig";
import { usePrinter } from "../hooks/usePrinter";

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

  const handleUsbPair = async () => {
    try {
      if (!navigator.serial) {
        showMessage("USB Serial no disponible", "warning");
        return;
      }
      await navigator.serial.requestPort();
      setConfig({
        ...config,
        tiendaId,
        transportType: "usb_serial",
        connection: { configured: true, label: "USB" },
        lastConnectedAt: Date.now(),
      });
      showMessage("Puerto USB configurado", "success");
    } catch (error) {
      if (error instanceof Error && error.name !== "NotFoundError") {
        showMessage(error.message, "error");
      }
    }
  };

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      await testPrint();
      showMessage("Ticket de prueba enviado", "success");
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Error al imprimir prueba",
        "error",
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "90vh" } }}>
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
            En iOS la impresión térmica por Bluetooth/USB es limitada. Use impresora en red o vista previa del navegador.
          </Alert>
        )}

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Tipo de conexión</InputLabel>
          <Select
            value={config.transportType}
            label="Tipo de conexión"
            onChange={(e) => handleTransportChange(e.target.value as PrinterTransportType)}
          >
            <MenuItem value="bluetooth" disabled={!caps.bluetooth}>
              <Bluetooth fontSize="small" sx={{ mr: 1 }} /> Bluetooth
            </MenuItem>
            <MenuItem value="usb_serial" disabled={!caps.usbSerial}>
              <Usb fontSize="small" sx={{ mr: 1 }} /> USB
            </MenuItem>
            <MenuItem value="network">
              <Wifi fontSize="small" sx={{ mr: 1 }} /> Red / Wi‑Fi
            </MenuItem>
            <MenuItem value="browser">
              <Language fontSize="small" sx={{ mr: 1 }} /> Navegador (vista previa)
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
            <Button variant="outlined" onClick={handleBluetoothPair} startIcon={<Bluetooth />}>
              Buscar impresora Bluetooth
            </Button>
          </Stack>
        )}

        {config.transportType === "usb_serial" && (
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Button variant="outlined" onClick={handleUsbPair} startIcon={<Usb />}>
              Seleccionar puerto USB
            </Button>
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
  );
};
