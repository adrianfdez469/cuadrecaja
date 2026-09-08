import { describe, expect, it } from "vitest";
import {
  getStockAfterMovement,
  isMovimientoBaja,
} from "@/utils/tipoMovimiento";
import { MovimientoTipoEnum } from "@/schemas/movimiento";
import type { ITipoMovimiento } from "@/schemas/movimiento";

describe("getStockAfterMovement", () => {
  it("adds the quantity for an inbound movement", () => {
    expect(getStockAfterMovement(10, 4, "COMPRA")).toBe(14);
  });

  it("subtracts the quantity for an outbound movement", () => {
    expect(getStockAfterMovement(10, 4, "VENTA")).toBe(6);
  });

  it("reads the direction from the type, never from the sign of the quantity", () => {
    // `cantidad` is stored positive for both halves of the same operation:
    // taking the sign from the number would paint them identically.
    expect(getStockAfterMovement(10, 2, "DESAGREGACION_BAJA")).toBe(8);
    expect(getStockAfterMovement(10, 2, "DESAGREGACION_ALTA")).toBe(12);
  });

  it("returns null when the stock before the movement is unknown", () => {
    // Rows written before `existenciaAnterior` existed: the caller must show
    // its fallback rather than a fabricated count.
    expect(getStockAfterMovement(null, 5, "COMPRA")).toBeNull();
    expect(getStockAfterMovement(undefined, 5, "COMPRA")).toBeNull();
  });

  it("keeps zero as a real starting count, not as a missing one", () => {
    expect(getStockAfterMovement(0, 3, "AJUSTE_ENTRADA")).toBe(3);
  });

  it("does not clamp a movement that leaves the count negative", () => {
    // The screen reports what happened; hiding an impossible count would hide
    // exactly the row worth investigating.
    expect(getStockAfterMovement(1, 3, "MERMA")).toBe(-2);
  });

  it("supports the decimal counts fractioned products produce", () => {
    expect(getStockAfterMovement(2.5, 0.5, "VENTA")).toBe(2);
  });

  it("agrees with isMovimientoBaja for every movement type", () => {
    // A type added to the enum without a decision here would silently be
    // treated as an inbound movement.
    MovimientoTipoEnum.options.forEach((tipo: ITipoMovimiento) => {
      const expected = isMovimientoBaja(tipo) ? 7 : 13;
      expect(getStockAfterMovement(10, 3, tipo)).toBe(expected);
    });
  });
});
