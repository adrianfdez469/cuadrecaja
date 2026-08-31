import { describe, expect, it } from "vitest";

import { formatMovimientoMotivo } from "@/utils/formatters";

describe("formatMovimientoMotivo", () => {
  it("shortens the sale id a stock movement was created from", () => {
    expect(
      formatMovimientoMotivo("Venta 587664ec-63a7-436a-adb3-36c1b7f2d2b4"),
    ).toBe("Venta #587664ec");
  });

  it("shortens the id inside a disaggregation reason", () => {
    expect(
      formatMovimientoMotivo(
        "Desagregación para venta 587664ec-63a7-436a-adb3-36c1b7f2d2b4",
      ),
    ).toBe("Desagregación para venta #587664ec");
  });

  it("shortens every id when the reason carries more than one", () => {
    expect(
      formatMovimientoMotivo(
        "Traspaso de ce4d28a1-7332-4760-8c79-6cddde442369 a 587664ec-63a7-436a-adb3-36c1b7f2d2b4",
      ),
    ).toBe("Traspaso de #ce4d28a1 a #587664ec");
  });

  it("is case insensitive, since seeded ids are not always lowercase", () => {
    expect(
      formatMovimientoMotivo("Venta 587664EC-63A7-436A-ADB3-36C1B7F2D2B4"),
    ).toBe("Venta #587664EC");
  });

  it("leaves a reason written by a person untouched", () => {
    expect(formatMovimientoMotivo("Se rompieron 3 botellas")).toBe(
      "Se rompieron 3 botellas",
    );
  });

  it("does not mangle numbers that merely look like id fragments", () => {
    expect(formatMovimientoMotivo("Ajuste por conteo 2026-08-15")).toBe(
      "Ajuste por conteo 2026-08-15",
    );
  });

  it("returns an empty string for a missing reason", () => {
    expect(formatMovimientoMotivo(null)).toBe("");
    expect(formatMovimientoMotivo(undefined)).toBe("");
    expect(formatMovimientoMotivo("")).toBe("");
  });
});
