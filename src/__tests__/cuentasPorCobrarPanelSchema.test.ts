import { describe, it, expect } from "vitest";
import { AGING_BUCKETS } from "@/lib/cuentasPorCobrar/aging";
import { movimientoCuentaPorCobrarSchema } from "@/schemas/cuentaPorCobrar";
import { CONTROL_CHARACTERS_MESSAGE } from "@/utils/printableText";

/**
 * F-035 — `src/schemas/cuentasPorCobrarPanel.ts` (contract § 2). Covers testability
 * symbols 11, 12, 13, 14, plus the sibling schemas in the same file that back the API
 * responses and the perdonar/revertir bodies.
 *
 * Dynamic import (E-019): the module does not exist until the `implementer` creates it.
 */
const {
  agingBucketEnum,
  deudorEstadoEnum,
  DEUDOR_ESTADOS,
  cuentasPorCobrarFiltrosSchema,
  cuentaAbiertaSchema,
  abonoPagoLineaSchema,
  registrarAbonoSchema,
  perdonarDeudaSchema,
  revertirAbonoSchema,
  movimientoAplicadoResponseSchema,
  saldoInsuficienteResponseSchema,
  movimientoCuentaPorCobrarConAutorSchema,
  motivoField,
  CUENTAS_POR_COBRAR_MOTIVO_MAX,
  MOTIVO_CONTROL_CHARACTERS_MESSAGE,
} = await import("@/schemas/cuentasPorCobrarPanel");

/** A byte built at runtime, never written literally in the file (E-071). */
const controlByte = (code: number) => String.fromCharCode(code);

describe("agingBucketEnum — symbol 12: derived from AGING_BUCKETS, never a second list (E-014)", () => {
  it("accepts exactly the buckets AGING_BUCKETS declares, in the same order, and nothing else", () => {
    expect(agingBucketEnum.options).toEqual(AGING_BUCKETS.map((b) => b.bucket));
  });

  it("rejects a value that is not one of those buckets", () => {
    expect(agingBucketEnum.safeParse("0-15").success).toBe(false);
  });
});

describe("deudorEstadoEnum / DEUDOR_ESTADOS — exactly two values, no 'vencido' (progress Q1)", () => {
  it("is exactly CON_DEUDA and SALDADA", () => {
    expect(DEUDOR_ESTADOS).toEqual(["CON_DEUDA", "SALDADA"]);
    expect(deudorEstadoEnum.options).toEqual(["CON_DEUDA", "SALDADA"]);
  });

  it("rejects any third value", () => {
    expect(deudorEstadoEnum.safeParse("VENCIDA").success).toBe(false);
  });
});

describe("motivoField — symbol 13: rejects the ENTIRE control-character range, including \\n (E-071-safe: bytes built at runtime)", () => {
  it("accepts a normal string of exactly the max length (300)", () => {
    expect(motivoField.safeParse("a".repeat(CUENTAS_POR_COBRAR_MOTIVO_MAX)).success).toBe(true);
  });

  it("rejects one character past the max (301)", () => {
    expect(motivoField.safeParse("a".repeat(CUENTAS_POR_COBRAR_MOTIVO_MAX + 1)).success).toBe(
      false,
    );
  });

  it("is optional: undefined parses fine", () => {
    expect(motivoField.safeParse(undefined).success).toBe(true);
  });

  it("rejects a line feed (\\x0A) — the field is single-line on purpose (§ 5.5)", () => {
    const result = motivoField.safeParse(`una nota${controlByte(0x0a)}con salto`);
    expect(result.success).toBe(false);
  });

  it("rejects ESC (\\x1B), the classic ESC/POS injection byte", () => {
    const result = motivoField.safeParse(`nota${controlByte(0x1b)}mala`);
    expect(result.success).toBe(false);
  });

  it("rejects the C1 range too (e.g. \\x9F), not just C0", () => {
    const result = motivoField.safeParse(`nota${controlByte(0x9f)}rara`);
    expect(result.success).toBe(false);
  });

  it("the rejection message is MOTIVO_CONTROL_CHARACTERS_MESSAGE (symbol 14), never the value itself (E-031)", () => {
    const result = motivoField.safeParse(`nota${controlByte(0x0a)}mala`);
    if (result.success) throw new Error("expected failure");
    const message = result.error.issues[0]?.message;
    expect(message).toBe(MOTIVO_CONTROL_CHARACTERS_MESSAGE);
  });
});

describe("MOTIVO_CONTROL_CHARACTERS_MESSAGE — symbol 14: its OWN message, not the shared one about 'nombre'", () => {
  it("is not the same string as CONTROL_CHARACTERS_MESSAGE", () => {
    expect(MOTIVO_CONTROL_CHARACTERS_MESSAGE).not.toBe(CONTROL_CHARACTERS_MESSAGE);
  });

  it("does not contain the word 'nombre' — a motivo is not a name", () => {
    expect(MOTIVO_CONTROL_CHARACTERS_MESSAGE.toLowerCase()).not.toContain("nombre");
  });
});

describe("abonoPagoLineaSchema — symbol 11: equivalenteBase is NOT part of the accepted body (ADR 0125)", () => {
  it("strips equivalenteBase even when the client sends it", () => {
    const result = abonoPagoLineaSchema.safeParse({
      tipo: "cash",
      moneda: "USD",
      monto: 100,
      equivalenteBase: 999999, // a client-forged conversion — must never survive parsing
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("equivalenteBase");
    }
  });

  it("accepts a transfer line with a valid transferDestinationId", () => {
    const result = abonoPagoLineaSchema.safeParse({
      tipo: "transfer",
      moneda: "CUP",
      monto: 500,
      transferDestinationId: crypto.randomUUID(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive monto", () => {
    expect(
      abonoPagoLineaSchema.safeParse({ tipo: "cash", moneda: "CUP", monto: 0 }).success,
    ).toBe(false);
  });
});

describe("registrarAbonoSchema", () => {
  it("requires at least one payment line", () => {
    expect(registrarAbonoSchema.safeParse({ pagos: [] }).success).toBe(false);
  });

  it("accepts one valid line with no motivo (optional)", () => {
    expect(
      registrarAbonoSchema.safeParse({
        pagos: [{ tipo: "cash", moneda: "CUP", monto: 100 }],
      }).success,
    ).toBe(true);
  });

  it("rejects a motivo with a control character, same as the bare field", () => {
    expect(
      registrarAbonoSchema.safeParse({
        pagos: [{ tipo: "cash", moneda: "CUP", monto: 100 }],
        motivo: `x${controlByte(0x0a)}y`,
      }).success,
    ).toBe(false);
  });
});

describe("perdonarDeudaSchema / revertirAbonoSchema", () => {
  it("perdonarDeudaSchema accepts an empty body (motivo optional)", () => {
    expect(perdonarDeudaSchema.safeParse({}).success).toBe(true);
  });

  it("revertirAbonoSchema requires a valid uuid movimientoId", () => {
    expect(revertirAbonoSchema.safeParse({}).success).toBe(false);
    expect(revertirAbonoSchema.safeParse({ movimientoId: "no-es-uuid" }).success).toBe(
      false,
    );
    expect(
      revertirAbonoSchema.safeParse({ movimientoId: crypto.randomUUID() }).success,
    ).toBe(true);
  });
});

describe("cuentasPorCobrarFiltrosSchema — all four filters optional", () => {
  it("accepts an empty object", () => {
    expect(cuentasPorCobrarFiltrosSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a full, valid set of filters", () => {
    expect(
      cuentasPorCobrarFiltrosSchema.safeParse({
        tiendaId: crypto.randomUUID(),
        clienteId: crypto.randomUUID(),
        antiguedad: "31-60",
        estado: "CON_DEUDA",
      }).success,
    ).toBe(true);
  });

  it("rejects an antiguedad value outside AGING_BUCKETS", () => {
    expect(
      cuentasPorCobrarFiltrosSchema.safeParse({ antiguedad: "0-15" }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid tiendaId", () => {
    expect(
      cuentasPorCobrarFiltrosSchema.safeParse({ tiendaId: "no-es-uuid" }).success,
    ).toBe(false);
  });
});

describe("cuentaAbiertaSchema — cierrePeriodoAbiertoId (decision 13 of the amendment, § 2/§ 5.1)", () => {
  function validCuenta(over: Record<string, unknown> = {}) {
    return {
      id: crypto.randomUUID(),
      ventaId: crypto.randomUUID(),
      tiendaId: crypto.randomUUID(),
      tiendaNombre: "Tienda Centro",
      fechaVenta: new Date().toISOString(),
      montoOriginal: 1000,
      saldoPendiente: 600,
      settledAt: null,
      monedaDeudaCode: null,
      montoDeudaMonedaOriginal: null,
      dias: 10,
      bucket: "0-30",
      cierrePeriodoAbiertoId: null,
      ...over,
    };
  }

  it("accepts cierrePeriodoAbiertoId: null (no open till)", () => {
    expect(cuentaAbiertaSchema.safeParse(validCuenta()).success).toBe(true);
  });

  it("accepts a valid uuid for cierrePeriodoAbiertoId", () => {
    expect(
      cuentaAbiertaSchema.safeParse(validCuenta({ cierrePeriodoAbiertoId: crypto.randomUUID() }))
        .success,
    ).toBe(true);
  });

  it("rejects a non-uuid, non-null cierrePeriodoAbiertoId", () => {
    expect(
      cuentaAbiertaSchema.safeParse(validCuenta({ cierrePeriodoAbiertoId: "abierto" })).success,
    ).toBe(false);
  });
});

describe("movimientoAplicadoResponseSchema — the ONE body shape shared by abono/perdonar/reversion", () => {
  function validBody(over: Record<string, unknown> = {}) {
    return {
      movimientoId: crypto.randomUUID(),
      cuentaId: crypto.randomUUID(),
      tipo: "ABONO",
      monto: 400,
      saldoPendiente: 600,
      settledAt: null,
      ...over,
    };
  }

  it("accepts a body with duplicado omitted", () => {
    expect(movimientoAplicadoResponseSchema.safeParse(validBody()).success).toBe(true);
  });

  it("accepts duplicado: true, the replay marker", () => {
    expect(
      movimientoAplicadoResponseSchema.safeParse(validBody({ duplicado: true })).success,
    ).toBe(true);
  });

  it("rejects a tipo outside the closed vocabulary", () => {
    expect(
      movimientoAplicadoResponseSchema.safeParse(validBody({ tipo: "OTRO" })).success,
    ).toBe(false);
  });
});

describe("saldoInsuficienteResponseSchema", () => {
  it("accepts {error, saldoPendiente}", () => {
    expect(
      saldoInsuficienteResponseSchema.safeParse({ error: "x", saldoPendiente: 500 }).success,
    ).toBe(true);
  });

  it("rejects a missing saldoPendiente", () => {
    expect(saldoInsuficienteResponseSchema.safeParse({ error: "x" }).success).toBe(false);
  });
});

describe("movimientoCuentaPorCobrarConAutorSchema — extends the F-031 read schema, read side only (§ 5.6)", () => {
  function validMovimiento(over: Record<string, unknown> = {}) {
    return {
      id: crypto.randomUUID(),
      cuentaPorCobrarId: crypto.randomUUID(),
      tipo: "ABONO",
      monto: 400,
      fecha: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      usuarioNombre: null,
      ...over,
    };
  }

  it("accepts usuarioNombre: null (no author or a deleted user)", () => {
    expect(movimientoCuentaPorCobrarConAutorSchema.safeParse(validMovimiento()).success).toBe(
      true,
    );
  });

  it("accepts a real usuarioNombre string", () => {
    expect(
      movimientoCuentaPorCobrarConAutorSchema.safeParse(
        validMovimiento({ usuarioNombre: "Ana Pérez" }),
      ).success,
    ).toBe(true);
  });

  it("still requires every field of the base movimientoCuentaPorCobrarSchema (it EXTENDS, not replaces)", () => {
    const base = movimientoCuentaPorCobrarSchema.safeParse(validMovimiento());
    expect(base.success).toBe(true);
  });

  it("rejects a body missing usuarioNombre entirely — the field is nullable, not optional", () => {
    const { usuarioNombre: _drop, ...withoutField } = validMovimiento();
    expect(movimientoCuentaPorCobrarConAutorSchema.safeParse(withoutField).success).toBe(false);
  });
});
