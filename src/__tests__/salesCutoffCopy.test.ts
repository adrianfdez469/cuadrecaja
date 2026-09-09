import { describe, expect, it } from "vitest";
import { formatDeferredSalesNotice } from "@/lib/cierre/salesCutoffCopy";
import { formatCurrency } from "@/utils/formatters";

/**
 * F-029 — the design contract's own literal strings (`.agents/designs/F-029.md`,
 * "Símbolos puros nuevos"). The banner and the confirmation dialog both render
 * this single function so the two can never drift (contract § 2.0.1).
 */
describe("formatDeferredSalesNotice", () => {
  it("names NO amount when count is 0 — not even $0.00, which would say the same nothing twice", () => {
    expect(formatDeferredSalesNotice(0, 0)).toBe(
      "Ninguna venta queda para el próximo período.",
    );
  });

  it("ignores a non-zero total when count is 0 — the wording never mentions an amount there", () => {
    expect(formatDeferredSalesNotice(0, 999)).toBe(
      "Ninguna venta queda para el próximo período.",
    );
  });

  it("uses the singular for exactly one deferred sale", () => {
    expect(formatDeferredSalesNotice(1, 45)).toBe(
      `1 venta pasa al próximo período, por ${formatCurrency(45)}.`,
    );
  });

  it("uses the plural for more than one deferred sale", () => {
    expect(formatDeferredSalesNotice(3, 120.5)).toBe(
      `3 ventas pasan al próximo período, por ${formatCurrency(120.5)}.`,
    );
  });

  it("uses the app's own formatCurrency, so grouping and decimals never drift from the rest of the screen", () => {
    expect(formatDeferredSalesNotice(2, 1234.5)).toBe(
      `2 ventas pasan al próximo período, por ${formatCurrency(1234.5)}.`,
    );
  });
});
