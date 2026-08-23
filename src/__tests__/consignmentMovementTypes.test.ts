import { describe, it, expect } from "vitest";
import {
  FORBIDDEN_CONSIGNMENT_MOVEMENT_TYPES,
  isMovementAllowedOnConsignment,
} from "@/utils/tipoMovimiento";

describe("isMovementAllowedOnConsignment", () => {
  it("rejects purchases and adjustments", () => {
    expect(isMovementAllowedOnConsignment("COMPRA")).toBe(false);
    expect(isMovementAllowedOnConsignment("AJUSTE_ENTRADA")).toBe(false);
    expect(isMovementAllowedOnConsignment("AJUSTE_SALIDA")).toBe(false);
  });

  it("allows the consignment movements, merma and transfers", () => {
    expect(isMovementAllowedOnConsignment("CONSIGNACION_ENTRADA")).toBe(true);
    expect(isMovementAllowedOnConsignment("CONSIGNACION_DEVOLUCION")).toBe(
      true,
    );
    expect(isMovementAllowedOnConsignment("MERMA")).toBe(true);
    expect(isMovementAllowedOnConsignment("TRASPASO_SALIDA")).toBe(true);
    expect(isMovementAllowedOnConsignment("TRASPASO_ENTRADA")).toBe(true);
  });

  it("keeps the forbidden list to the three types the rule names", () => {
    expect(FORBIDDEN_CONSIGNMENT_MOVEMENT_TYPES).toEqual([
      "COMPRA",
      "AJUSTE_ENTRADA",
      "AJUSTE_SALIDA",
    ]);
  });
});
