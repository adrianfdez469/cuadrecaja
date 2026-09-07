import { describe, it, expect } from "vitest";
import { formatGastoValor } from "@/utils/gastos";
import {
  createGastoTiendaSchema,
  updateGastoTiendaSchema,
  gastoPreviewSchema,
  gastoAdHocCreateSchema,
} from "@/schemas/gastos";

describe("formatGastoValor", () => {
  it("prints a base-currency amount with the plain symbol", () => {
    expect(
      formatGastoValor(
        { tipoCalculo: "MONTO_FIJO", monto: 1500, monedaCode: null },
        "CUP",
      ),
    ).toContain("$");
  });

  it("labels a foreign amount with its code so it cannot be read as base money", () => {
    expect(
      formatGastoValor(
        { tipoCalculo: "MONTO_FIJO", monto: 200, monedaCode: "USD" },
        "CUP",
      ),
    ).toContain("USD");
  });

  it("treats a currency equal to the base as base", () => {
    const value = formatGastoValor(
      { tipoCalculo: "MONTO_FIJO", monto: 200, monedaCode: "CUP" },
      "CUP",
    );
    expect(value).not.toContain("CUP");
    expect(value).toContain("$");
  });

  it("shows a rate, not money, for percentage-based expenses", () => {
    expect(
      formatGastoValor(
        { tipoCalculo: "PORCENTAJE_VENTAS", porcentaje: 7 },
        "CUP",
      ),
    ).toBe("7%");
  });
});

const gastoFijo = {
  nombre: "Alquiler",
  categoria: "Local",
  tipoCalculo: "MONTO_FIJO" as const,
  naturaleza: "OPERATIVO" as const,
  recurrencia: "MENSUAL" as const,
  diaMes: 1,
  monto: 200,
  activo: true,
};

describe("createGastoTiendaSchema — currency", () => {
  it("accepts a currency on a fixed amount", () => {
    const parsed = createGastoTiendaSchema.safeParse({
      ...gastoFijo,
      monedaCode: "USD",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.monedaCode).toBe("USD");
  });

  it("accepts a fixed amount with no currency — that means the base currency", () => {
    expect(
      createGastoTiendaSchema.safeParse({ ...gastoFijo, monedaCode: null })
        .success,
    ).toBe(true);
  });

  it("rejects a currency on a percentage: its amount is already in base", () => {
    const parsed = createGastoTiendaSchema.safeParse({
      ...gastoFijo,
      tipoCalculo: "PORCENTAJE_VENTAS",
      monto: null,
      porcentaje: 10,
      monedaCode: "USD",
    });
    expect(parsed.success).toBe(false);
    expect(
      !parsed.success && parsed.error.issues.some((i) => i.path[0] === "monedaCode"),
    ).toBe(true);
  });

  it("applies the same rule to ad-hoc expenses", () => {
    expect(
      gastoAdHocCreateSchema.safeParse({
        nombre: "Reparación",
        categoria: "Mantenimiento",
        tipoCalculo: "PORCENTAJE_VENTAS",
        naturaleza: "OPERATIVO",
        montoCalculado: 50,
        porcentaje: 5,
        monedaCode: "USD",
      }).success,
    ).toBe(false);
  });
});

describe("updateGastoTiendaSchema", () => {
  it("lets a partial update clear the currency back to base", () => {
    const parsed = updateGastoTiendaSchema.safeParse({ monedaCode: null });
    expect(parsed.success).toBe(true);
  });
});

describe("gastoPreviewSchema", () => {
  it("carries monedaCode so it survives preview → apply", () => {
    const parsed = gastoPreviewSchema.safeParse({
      gastoTiendaId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      nombre: "Alquiler",
      categoria: "Local",
      tipoCalculo: "MONTO_FIJO",
      naturaleza: "OPERATIVO",
      montoCalculado: 200,
      monto: 200,
      recurrencia: "MENSUAL",
      esAdHoc: false,
      monedaCode: "USD",
    });
    expect(parsed.success && parsed.data.monedaCode).toBe("USD");
  });
});
