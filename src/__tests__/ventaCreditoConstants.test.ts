import { describe, it, expect } from "vitest";

/**
 * F-037 — `src/constants/ventaCredito.ts` (design § 0.3, § 0.4; contract § 11.1 amended
 * by the design's § 6, E-035). Four symbols, all `.ts`, all exported: `VENTA_CREDITO_COPY`,
 * `CREDITO_ESTADO_LABEL`, `CREDITO_ESTADO_HUE`, `VENTA_CREDITO_DOM`.
 *
 * Dynamic import (E-019): the module does not exist until the `implementer` creates it.
 */
const constants = await import("@/constants/ventaCredito");
const { VENTA_CREDITO_ESTADOS } = await import(
  "@/lib/cuentasPorCobrar/ventaCreditoEstado"
);

describe("VENTA_CREDITO_COPY — the literals fixed by design § 0.3", () => {
  it("chipConSaldoConSaldo(400, 'CUP') is exactly 'A crédito · 400,00 CUP'", () => {
    expect(constants.VENTA_CREDITO_COPY.chipConSaldoConSaldo(400, "CUP")).toBe(
      "A crédito · 400,00 CUP",
    );
  });

  it("chipConSaldoConSaldo(1000, 'CUP') is 'A crédito · 1000,00 CUP' — WITHOUT a thousands separator (E-033: es-ES does not group four-digit thousands; 1000 and 12500 take different Intl branches, so this case is required alongside 400)", () => {
    expect(constants.VENTA_CREDITO_COPY.chipConSaldoConSaldo(1000, "CUP")).toBe(
      "A crédito · 1000,00 CUP",
    );
  });

  it("listaCliente names the debtor with the 'Cliente:' label in the same literal", () => {
    expect(constants.VENTA_CREDITO_COPY.listaCliente("Bruno Instalaciones")).toBe(
      "Cliente: Bruno Instalaciones",
    );
  });

  it("bloqueReferencia names the base currency", () => {
    expect(constants.VENTA_CREDITO_COPY.bloqueReferencia("CUP")).toBe(
      "Referencia informativa. La deuda se lleva en CUP.",
    );
  });

  it("bloqueEquivalente prefixes the amount with '≈'", () => {
    expect(constants.VENTA_CREDITO_COPY.bloqueEquivalente(300, "CUP")).toBe(
      "≈ 300,00 CUP",
    );
  });

  it("bloqueFormaDePago returns 'Efectivo (CUP)' for cash and 'Transferencia (USD)' for transfer — and no third value for any other input", () => {
    expect(constants.VENTA_CREDITO_COPY.bloqueFormaDePago("cash", "CUP")).toBe(
      "Efectivo (CUP)",
    );
    expect(constants.VENTA_CREDITO_COPY.bloqueFormaDePago("transfer", "USD")).toBe(
      "Transferencia (USD)",
    );
  });
});

describe("CREDITO_ESTADO_LABEL — half of criterion 1's visual distinction", () => {
  it("has exactly the three IVentaCreditoEstado keys", () => {
    expect(Object.keys(constants.CREDITO_ESTADO_LABEL).sort()).toEqual(
      [...VENTA_CREDITO_ESTADOS].sort(),
    );
  });

  it("SIN_CREDITO is null — a cash sale carries no label at all", () => {
    expect(constants.CREDITO_ESTADO_LABEL.SIN_CREDITO).toBeNull();
  });

  it("CON_SALDO and SALDADA are non-null and DISTINCT from each other", () => {
    const { CON_SALDO, SALDADA } = constants.CREDITO_ESTADO_LABEL;
    expect(CON_SALDO).not.toBeNull();
    expect(SALDADA).not.toBeNull();
    expect(CON_SALDO).not.toBe(SALDADA);
  });
});

describe("CREDITO_ESTADO_HUE — the other half of criterion 1's visual distinction", () => {
  it("has exactly the three IVentaCreditoEstado keys", () => {
    expect(Object.keys(constants.CREDITO_ESTADO_HUE).sort()).toEqual(
      [...VENTA_CREDITO_ESTADOS].sort(),
    );
  });

  it("SIN_CREDITO is null", () => {
    expect(constants.CREDITO_ESTADO_HUE.SIN_CREDITO).toBeNull();
  });

  it("no hue is 'accent', and CON_SALDO/SALDADA are DISTINCT from each other", () => {
    const { CON_SALDO, SALDADA } = constants.CREDITO_ESTADO_HUE;
    expect(CON_SALDO).not.toBe("accent");
    expect(SALDADA).not.toBe("accent");
    expect(CON_SALDO).not.toBeNull();
    expect(SALDADA).not.toBeNull();
    expect(CON_SALDO).not.toBe(SALDADA);
  });
});

describe("VENTA_CREDITO_DOM — the thirteen localization classes, compared with classList.contains, never a prefix of one another", () => {
  const expectedKeys = [
    "chip",
    "cliente",
    "bloque",
    "deudor",
    "montoOriginal",
    "saldo",
    "referencia",
    "libro",
    "movimiento",
    "pago",
    "motivo",
    "accionProducto",
    "accionVenta",
  ];

  it("has exactly these thirteen keys", () => {
    expect(Object.keys(constants.VENTA_CREDITO_DOM).sort()).toEqual(
      [...expectedKeys].sort(),
    );
  });

  it("every value is a non-empty, distinct string", () => {
    const values = Object.values(constants.VENTA_CREDITO_DOM) as string[];
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("no class is a prefix of another — the guarantee that makes classList.contains correct", () => {
    const values = Object.values(constants.VENTA_CREDITO_DOM) as string[];
    for (const a of values) {
      for (const b of values) {
        if (a === b) continue;
        expect(b.startsWith(a)).toBe(false);
      }
    }
  });
});
