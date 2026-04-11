import { MESES } from "@/constants/gastos";

interface GastoRecurrencia {
  recurrencia: string;
  diaMes?: number | null;
  mesAnio?: number | null;
  diaAnio?: number | null;
}

export function gastoAplicaEnFecha(
  gasto: GastoRecurrencia,
  fecha: Date
): { aplica: boolean; motivo: string } {
  const dia = fecha.getDate();
  const mes = fecha.getMonth() + 1;
  const anio = fecha.getFullYear();

  switch (gasto.recurrencia) {
    case "DIARIO":
      return { aplica: true, motivo: "Diario" };

    case "MENSUAL": {
      if (gasto.diaMes == null) return { aplica: false, motivo: "" };
      // Maneja meses cortos: si diaMes=31 y el mes tiene 28 días, aplica el último día
      const diasEnMes = new Date(anio, mes, 0).getDate();
      const diaEfectivo = Math.min(gasto.diaMes, diasEnMes);
      if (dia === diaEfectivo) {
        return { aplica: true, motivo: `Día ${gasto.diaMes} del mes` };
      }
      return { aplica: false, motivo: "" };
    }

    case "ANUAL": {
      if (gasto.mesAnio == null || gasto.diaAnio == null) return { aplica: false, motivo: "" };
      const diasEnMesAnual = new Date(anio, gasto.mesAnio, 0).getDate();
      const diaAnualEfectivo = Math.min(gasto.diaAnio, diasEnMesAnual);
      if (mes === gasto.mesAnio && dia === diaAnualEfectivo) {
        const nombreMes = MESES.find((m) => m.value === gasto.mesAnio)?.label ?? "";
        return { aplica: true, motivo: `${diaAnualEfectivo} de ${nombreMes}` };
      }
      return { aplica: false, motivo: "" };
    }

    case "UNICO":
    default:
      // Los gastos únicos solo se registran manualmente como ad-hoc, nunca se auto-aplican
      return { aplica: false, motivo: "" };
  }
}

export function formatearCuandoAplica(gasto: GastoRecurrencia): string {
  switch (gasto.recurrencia) {
    case "DIARIO":
      return "En cada cierre";
    case "MENSUAL":
      if (gasto.diaMes == null) return "Mensual (día no configurado)";
      return `Día ${gasto.diaMes} de cada mes`;
    case "ANUAL": {
      if (gasto.mesAnio == null || gasto.diaAnio == null) return "Anual (fecha no configurada)";
      const nombreMes = MESES.find((m) => m.value === gasto.mesAnio)?.label ?? "";
      return `${gasto.diaAnio} de ${nombreMes} cada año`;
    }
    case "UNICO":
    default:
      return "Solo una vez (ad-hoc)";
  }
}
