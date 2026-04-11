import { ITipoCalculo, IRecurrenciaGasto } from "@/schemas/gastos";

export const TIPO_CALCULO_LABELS: Record<ITipoCalculo, string> = {
  MONTO_FIJO: "Monto fijo",
  PORCENTAJE_VENTAS: "% sobre ventas",
  PORCENTAJE_GANANCIAS: "% sobre ganancias",
};

export const TIPO_CALCULO_DESCRIPTIONS: Record<ITipoCalculo, string> = {
  MONTO_FIJO: "Se descuenta un monto fijo en cada aplicación",
  PORCENTAJE_VENTAS: "Se descuenta un porcentaje del total de ventas del período",
  PORCENTAJE_GANANCIAS: "Se descuenta un porcentaje de las ganancias brutas del período",
};

export const TIPO_CALCULO_COLORS: Record<ITipoCalculo, string> = {
  MONTO_FIJO: "#1976d2",
  PORCENTAJE_VENTAS: "#7b1fa2",
  PORCENTAJE_GANANCIAS: "#388e3c",
};

export const RECURRENCIA_LABELS: Record<IRecurrenciaGasto, string> = {
  UNICO: "Único",
  DIARIO: "Diario",
  MENSUAL: "Mensual",
  ANUAL: "Anual",
};

export const RECURRENCIA_DESCRIPTIONS: Record<IRecurrenciaGasto, string> = {
  UNICO: "Se registra una sola vez (no se aplica automáticamente)",
  DIARIO: "Se aplica en cada cierre de período",
  MENSUAL: "Se aplica cuando el cierre ocurre en el día configurado del mes",
  ANUAL: "Se aplica cuando el cierre ocurre en la fecha configurada del año",
};

export const RECURRENCIA_COLORS: Record<IRecurrenciaGasto, string> = {
  UNICO: "#757575",
  DIARIO: "#1976d2",
  MENSUAL: "#388e3c",
  ANUAL: "#f57c00",
};

export const MESES: { value: number; label: string }[] = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

export const DIAS_MES: { value: number; label: string }[] = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));
