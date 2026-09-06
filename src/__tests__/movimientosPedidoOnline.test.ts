import { describe, it, expect } from "vitest";
import {
  TIPOS_MOVIMIENTO,
  TIPOS_MOVIMIENTO_MANUAL,
  TIPO_MOVIMIENTO_LABELS,
  TIPO_MOVIMIENTO_DESCRIPTIONS,
  TIPO_MOVIMIENTO_EJEMPLOS,
  TIPO_MOVIMIENTO_FLOW,
} from "@/constants/movimientos";
import {
  MovimientoTipoEnum,
  MovimientoTipoCreableEnum,
  movimientoCreateSchema,
} from "@/schemas/movimiento";
import {
  isMovimientoBaja,
  isMovementAllowedOnConsignment,
  FORBIDDEN_CONSIGNMENT_MOVEMENT_TYPES,
} from "@/utils/tipoMovimiento";

/**
 * F-014 (contract § 1, § 2.1, ADR 0071) — `PEDIDO_ONLINE_RESERVA` and
 * `PEDIDO_ONLINE_LIBERACION`, the two movement types the online-order landing
 * writes. They live OUTSIDE `TIPOS_MOVIMIENTO_MANUAL` (system writes, like
 * `DEVOLUCION_VENTA`) but inside every other `Record<ITipoMovimiento, …>` —
 * `tsc` will not compile with one of the four maps incomplete, but that
 * guarantee needs `npx tsc --noEmit` (E-026): these tests check the RUNTIME
 * values, in particular that a reserve is a baja and its release is not.
 */

describe("PEDIDO_ONLINE_RESERVA / PEDIDO_ONLINE_LIBERACION — TIPOS_MOVIMIENTO", () => {
  it("both new types are declared in TIPOS_MOVIMIENTO", () => {
    expect(TIPOS_MOVIMIENTO).toContain("PEDIDO_ONLINE_RESERVA");
    expect(TIPOS_MOVIMIENTO).toContain("PEDIDO_ONLINE_LIBERACION");
  });

  it("neither is in TIPOS_MOVIMIENTO_MANUAL — they are system writes, not a form a person fills (like DEVOLUCION_VENTA)", () => {
    expect(TIPOS_MOVIMIENTO_MANUAL).not.toContain("PEDIDO_ONLINE_RESERVA");
    expect(TIPOS_MOVIMIENTO_MANUAL).not.toContain("PEDIDO_ONLINE_LIBERACION");
  });

  it.each(["PEDIDO_ONLINE_RESERVA", "PEDIDO_ONLINE_LIBERACION"] as const)(
    "%s has a label, a description and an example — the four Record<ITipoMovimiento, …> maps must be complete",
    (tipo) => {
      expect(TIPO_MOVIMIENTO_LABELS[tipo]).toBeTruthy();
      expect(TIPO_MOVIMIENTO_DESCRIPTIONS[tipo]).toBeTruthy();
      expect(TIPO_MOVIMIENTO_EJEMPLOS[tipo]).toBeTruthy();
    },
  );

  it("PEDIDO_ONLINE_RESERVA flows OUT (a baja) and PEDIDO_ONLINE_LIBERACION flows IN (an alta) — ADR 0071", () => {
    expect(TIPO_MOVIMIENTO_FLOW.PEDIDO_ONLINE_RESERVA).toBe("out");
    expect(TIPO_MOVIMIENTO_FLOW.PEDIDO_ONLINE_LIBERACION).toBe("in");
  });
});

describe("MovimientoTipoEnum / MovimientoTipoCreableEnum (schemas/movimiento.ts)", () => {
  it.each(["PEDIDO_ONLINE_RESERVA", "PEDIDO_ONLINE_LIBERACION"] as const)(
    "MovimientoTipoEnum accepts %s",
    (tipo) => {
      expect(MovimientoTipoEnum.safeParse(tipo).success).toBe(true);
    },
  );

  it.each(["PEDIDO_ONLINE_RESERVA", "PEDIDO_ONLINE_LIBERACION"] as const)(
    "MovimientoTipoCreableEnum REJECTS %s — POST /api/movimiento (the generic endpoint) cannot create either",
    (tipo) => {
      expect(MovimientoTipoCreableEnum.safeParse(tipo).success).toBe(false);
    },
  );
});

describe("isMovimientoBaja — the landing's reservation must count as a baja, its release must not", () => {
  it("PEDIDO_ONLINE_RESERVA is a baja (existencia goes down at CONFIRMED)", () => {
    expect(isMovimientoBaja("PEDIDO_ONLINE_RESERVA")).toBe(true);
  });

  it("PEDIDO_ONLINE_LIBERACION is NOT a baja — it is the alta that gives the stock back", () => {
    expect(isMovimientoBaja("PEDIDO_ONLINE_LIBERACION")).toBe(false);
  });
});

describe("Consignment guard — unchanged by F-014", () => {
  it("neither new type is added to FORBIDDEN_CONSIGNMENT_MOVEMENT_TYPES — consigned goods get sold, so they also get reserved", () => {
    expect(FORBIDDEN_CONSIGNMENT_MOVEMENT_TYPES).not.toContain(
      "PEDIDO_ONLINE_RESERVA",
    );
    expect(FORBIDDEN_CONSIGNMENT_MOVEMENT_TYPES).not.toContain(
      "PEDIDO_ONLINE_LIBERACION",
    );
  });

  it.each(["PEDIDO_ONLINE_RESERVA", "PEDIDO_ONLINE_LIBERACION"] as const)(
    "%s is allowed on a consigned row",
    (tipo) => {
      expect(isMovementAllowedOnConsignment(tipo)).toBe(true);
    },
  );
});

describe("movimientoCreateSchema — what planReservationItems/planReservationRelease must produce", () => {
  it("validates a well formed reservation item (productoId + cantidad + proveedorId)", () => {
    const result = movimientoCreateSchema.safeParse({
      productoId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
      cantidad: 3,
      proveedorId: "1a2b3c4d-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(true);
  });

  it("validates a well formed item with no proveedorId — the product has no supplier", () => {
    const result = movimientoCreateSchema.safeParse({
      productoId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
      cantidad: 3,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a non-positive cantidad", () => {
    expect(
      movimientoCreateSchema.safeParse({
        productoId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
        cantidad: 0,
      }).success,
    ).toBe(false);
  });
});
