import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRINT_DEVICE_STORAGE_KEY } from "@/constants/ticket";
import {
  IPrintDeviceConfig,
  PrinterTransportType,
} from "../types/IPrinterConfig";
import { defaultDeviceConfig } from "../transports/createTransport";

interface PrintDeviceState {
  config: IPrintDeviceConfig | null;
  setConfig: (config: IPrintDeviceConfig) => void;
  setAutoPrint: (autoPrint: boolean) => void;
  setTransportType: (type: PrinterTransportType) => void;
  setCopias: (copias: number) => void;
  getConfigForTienda: (tiendaId: string) => IPrintDeviceConfig;
  clearConfig: () => void;
}

export const usePrintDeviceStore = create<PrintDeviceState>()(
  persist(
    (set, get) => ({
      config: null,
      setConfig: (config) => set({ config }),
      setAutoPrint: (autoPrint) => {
        const current = get().config;
        if (current) set({ config: { ...current, autoPrint } });
      },
      setTransportType: (transportType) => {
        const current = get().config;
        if (!current) return;
        let connection = current.connection;
        if (transportType === "bluetooth") {
          connection = { deviceId: "", deviceName: "" };
        } else if (transportType === "usb_serial") {
          connection = { configured: false };
        } else if (transportType === "network") {
          connection = { host: "", port: 9100 };
        } else {
          connection = { configured: false };
        }
        set({ config: { ...current, transportType, connection } });
      },
      setCopias: (copias) => {
        const current = get().config;
        if (current) set({ config: { ...current, copias: Math.max(1, copias) } });
      },
      getConfigForTienda: (tiendaId) => {
        const current = get().config;
        if (!current || current.tiendaId !== tiendaId) {
          const fresh = defaultDeviceConfig(tiendaId);
          set({ config: fresh });
          return fresh;
        }
        return current;
      },
      clearConfig: () => set({ config: null }),
    }),
    { name: PRINT_DEVICE_STORAGE_KEY },
  ),
);
