import { describe, it, expect } from "vitest";
import { QAB_ORDER_STATUSES } from "@/constants/qab";
import {
  tiendaOnlineEstadoSchema,
  tiendaOnlineScaffoldSchema,
  pedidoEntranteStatusUpdateSchema,
} from "@/schemas/tiendaOnline";

/**
 * F-004 — the three Zod schemas of `src/schemas/tiendaOnline.ts`. All `.strict()`, following
 * the precedent of `src/schemas/qabNegocio.ts` (ADR 0025): an extra key on the object being
 * parsed must make `parse` throw, not silently drop it.
 */

describe("tiendaOnlineEstadoSchema", () => {
  it("should accept { tiendaOnlineHabilitada: true }", () => {
    expect(
      tiendaOnlineEstadoSchema.parse({ tiendaOnlineHabilitada: true }),
    ).toEqual({ tiendaOnlineHabilitada: true });
  });

  it("should accept { tiendaOnlineHabilitada: false }", () => {
    expect(
      tiendaOnlineEstadoSchema.parse({ tiendaOnlineHabilitada: false }),
    ).toEqual({ tiendaOnlineHabilitada: false });
  });

  it("should reject a non-boolean value", () => {
    const result = tiendaOnlineEstadoSchema.safeParse({
      tiendaOnlineHabilitada: "true",
    });

    expect(result.success).toBe(false);
  });

  it("should reject an extra key (.strict())", () => {
    const result = tiendaOnlineEstadoSchema.safeParse({
      tiendaOnlineHabilitada: true,
      negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    });

    expect(result.success).toBe(false);
  });
});

describe("tiendaOnlineScaffoldSchema", () => {
  const base = {
    negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    tiendaOnlineHabilitada: true as const,
  };

  it("should accept negocioId + tiendaOnlineHabilitada: true", () => {
    expect(tiendaOnlineScaffoldSchema.parse(base)).toEqual(base);
  });

  it("should reject tiendaOnlineHabilitada: false — this is the switch-off canary (z.literal(true))", () => {
    // Contract §6: this literal is deliberate. If the server-side gate ever let a disabled
    // business through, this parse is what makes it explode into a 500 instead of leaking a
    // 200 with false content.
    const result = tiendaOnlineScaffoldSchema.safeParse({
      ...base,
      tiendaOnlineHabilitada: false,
    });

    expect(result.success).toBe(false);
  });

  it("should reject a negocioId that is not a UUID", () => {
    const result = tiendaOnlineScaffoldSchema.safeParse({
      ...base,
      negocioId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("should reject an extra key (.strict())", () => {
    const result = tiendaOnlineScaffoldSchema.safeParse({
      ...base,
      qabToken: "should-never-be-here",
    });

    expect(result.success).toBe(false);
  });
});

describe("pedidoEntranteStatusUpdateSchema", () => {
  it.each(QAB_ORDER_STATUSES)("should accept status %s", (status) => {
    const result = pedidoEntranteStatusUpdateSchema.safeParse({ status });

    expect(result.success).toBe(true);
  });

  it("should reject a status value outside QAB_ORDER_STATUSES", () => {
    const result = pedidoEntranteStatusUpdateSchema.safeParse({
      status: "NOT_A_REAL_STATUS",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a missing status", () => {
    const result = pedidoEntranteStatusUpdateSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("should reject an extra key (.strict())", () => {
    const result = pedidoEntranteStatusUpdateSchema.safeParse({
      status: QAB_ORDER_STATUSES[0],
      negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    });

    expect(result.success).toBe(false);
  });

  it("should NOT validate whether the transition itself is legal — shape only (F-011's job)", () => {
    // Contract §2 is explicit: "every value of the enum parses here, including nonsensical
    // ones". A nonsense-but-in-enum transition (e.g. going back to PENDING) must still parse.
    const result = pedidoEntranteStatusUpdateSchema.safeParse({
      status: "PENDING",
    });

    expect(result.success).toBe(true);
  });
});
