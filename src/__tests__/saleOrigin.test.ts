import { describe, it, expect } from "vitest";
import { SALE_ORIGINS } from "@/constants/venta";

/**
 * F-014 (contract § 2.3, ADR 0075/ADR 0072) — the origin of a `Venta`. It is a
 * sales concept, declared in `@/constants/venta`, precisely so
 * `src/lib/reports/**` never has to import from `@/constants/tiendaOnline`.
 */
describe("SALE_ORIGINS", () => {
  it("has exactly POS and TIENDA_ONLINE, in that order", () => {
    expect(SALE_ORIGINS).toEqual(["POS", "TIENDA_ONLINE"]);
  });
});
