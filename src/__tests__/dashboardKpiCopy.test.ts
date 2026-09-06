import { describe, it, expect } from "vitest";
import {
  tiendaOnlineNote,
  MERCANCIA_TIENDA_ONLINE_LABEL,
  ENVIO_TIENDA_ONLINE_LABEL,
  ENVIO_TIENDA_ONLINE_NOTE,
} from "@/components/dashboard/dashboardKpiCopy";

/**
 * F-024 criterion 5 — the copy of the two split KPI cells, fixed by the
 * `ui-designer` in `.agents/designs/F-024.md` § "Copy exacto" and
 * § "Símbolos de copy". `dashboardKpiCopy.ts` is a plain `.ts` file inside
 * `components/` precisely so this is importable: no symbol living in a
 * `.tsx` is importable from a test in this project (E-015), and
 * `DashboardKpiRow.tsx` is where these used to live.
 *
 * This file lives on its own, separate from every other F-024 test: the
 * module is new (owned by the `implementer`, contract § 10) and, until it
 * lands, importing it fails at collection — which would take down every
 * other test sharing the file (E-019). Isolating it here means only this
 * file is red in the meantime, not the whole suite.
 *
 * `tiendaOnlineNote`'s NAME and SIGNATURE are unchanged from F-014 (design
 * § "Símbolos de copy": already listed in contract § 9.2, renaming it would
 * strand a symbol the contract promised). Only the TEXT it returns changes,
 * because it is now the note of the "Mercancía" cell, not "Ventas de tienda
 * online" — it has to say "sin el envío" so nobody reads it as the whole
 * channel's revenue.
 */
describe("dashboardKpiCopy", () => {
  describe("tiendaOnlineNote — the note under the merchandise cell", () => {
    it("returns the exact singular form for one sale", () => {
      expect(tiendaOnlineNote(1)).toBe(
        "1 venta, sin el envío. Ya contada en el total de ventas",
      );
    });

    it("returns the exact plural form, with the count formatted, for more than one sale", () => {
      expect(tiendaOnlineNote(2)).toBe(
        "2 ventas, sin el envío. Ya contadas en el total de ventas",
      );
    });

    it("never produces the malformed plural '1 ventas' (E-016)", () => {
      expect(tiendaOnlineNote(1)).not.toContain("1 ventas");
    });

    it("always says 'sin el envío', even though this file cannot know whether any online order in the range charged one — the sentence has to be true in both cases (design doc rationale)", () => {
      expect(tiendaOnlineNote(1)).toContain("sin el envío");
      expect(tiendaOnlineNote(5)).toContain("sin el envío");
    });
  });

  describe("Cell labels and the delivery note — exact strings from the design contract", () => {
    it("MERCANCIA_TIENDA_ONLINE_LABEL is exactly 'Mercancía de tienda online'", () => {
      expect(MERCANCIA_TIENDA_ONLINE_LABEL).toBe("Mercancía de tienda online");
    });

    it("ENVIO_TIENDA_ONLINE_LABEL is exactly 'Envío de tienda online'", () => {
      expect(ENVIO_TIENDA_ONLINE_LABEL).toBe("Envío de tienda online");
    });

    it("ENVIO_TIENDA_ONLINE_NOTE is exactly 'No está en el total de ventas: súmalo a la mercancía'", () => {
      expect(ENVIO_TIENDA_ONLINE_NOTE).toBe(
        "No está en el total de ventas: súmalo a la mercancía",
      );
    });

    it("neither label is the retired 'Ventas de tienda online' — that string is the bug ADR 0090 corrects and must not survive under a new name", () => {
      expect(MERCANCIA_TIENDA_ONLINE_LABEL).not.toBe("Ventas de tienda online");
      expect(ENVIO_TIENDA_ONLINE_LABEL).not.toBe("Ventas de tienda online");
    });

    it("the delivery note never claims delivery is already counted in the sales total — that is the opposite error, the one that lets a charged delivery go unreconciled forever", () => {
      expect(ENVIO_TIENDA_ONLINE_NOTE).not.toContain("Ya está contado");
      expect(ENVIO_TIENDA_ONLINE_NOTE).not.toContain("ya contado");
    });
  });
});
