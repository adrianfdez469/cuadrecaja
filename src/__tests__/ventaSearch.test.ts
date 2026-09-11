import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "@/utils/formatters";

/**
 * F-037 — `src/app/ventas/utils/ventaSearch.ts` (contract § 6; criterion 4).
 *
 * Dynamic import (E-019): the module does not exist until the `implementer` creates it.
 */
const { matchesVentaSearch } = await import("@/app/ventas/utils/ventaSearch");

const fecha = new Date("2026-03-05T14:30:00.000Z");

const ventaDeCredito = {
  id: "venta-zoraida-1",
  createdAt: fecha,
  clienteNombre: "Zoraida Paneles",
  usuario: { nombre: "Cajero Uno" },
  productos: [{ name: "Refresco 355ml" }, { name: "Pan de agua" }],
};

const ventaSinCliente = {
  id: "venta-control-2",
  createdAt: new Date("2026-04-01T10:00:00.000Z"),
  usuario: { nombre: "Cajero Dos" },
  productos: [{ name: "Aceite 1L" }],
};

describe("matchesVentaSearch — the debtor's name is a NEW searchable field (criterion 4)", () => {
  it("finds the sale by the debtor's full name", () => {
    expect(matchesVentaSearch(ventaDeCredito, "Zoraida Paneles")).toBe(true);
  });

  it("is case-insensitive on the debtor's name", () => {
    expect(matchesVentaSearch(ventaDeCredito, "zoraida paneles")).toBe(true);
  });

  it("does NOT match a sale that has no clienteNombre against a term naming someone else's debtor — the negative half of the criterion (E-008): a predicate that ignored the term and matched everything would pass the positive case above just as easily", () => {
    expect(matchesVentaSearch(ventaSinCliente, "Zoraida Paneles")).toBe(false);
  });

  it("does not match this sale against the name of a customer who has no sales at all", () => {
    expect(matchesVentaSearch(ventaDeCredito, "Carmen Sin Ventas")).toBe(false);
  });
});

describe("matchesVentaSearch — the five fields it already matched keep working (nothing is trimmed)", () => {
  it("still matches by id", () => {
    expect(matchesVentaSearch(ventaDeCredito, "venta-zoraida-1")).toBe(true);
  });

  it("still matches by the formatted date", () => {
    expect(matchesVentaSearch(ventaDeCredito, formatDate(fecha))).toBe(true);
  });

  it("still matches by the formatted date and time", () => {
    expect(matchesVentaSearch(ventaDeCredito, formatDateTime(fecha))).toBe(true);
  });

  it("still matches by a product name — including the SECOND product, not just the first (E-008: two products, not one)", () => {
    expect(matchesVentaSearch(ventaDeCredito, "Pan de agua")).toBe(true);
  });

  it("still matches by the seller's name", () => {
    expect(matchesVentaSearch(ventaDeCredito, "Cajero Uno")).toBe(true);
  });

  it("does not match a product name that is not in this sale", () => {
    expect(matchesVentaSearch(ventaDeCredito, "Aceite 1L")).toBe(false);
  });
});

describe("matchesVentaSearch — an empty term matches everything, same as today's empty search box", () => {
  it("matches with an empty string", () => {
    expect(matchesVentaSearch(ventaDeCredito, "")).toBe(true);
    expect(matchesVentaSearch(ventaSinCliente, "")).toBe(true);
  });

  it("matches with a whitespace-only string", () => {
    expect(matchesVentaSearch(ventaDeCredito, "   ")).toBe(true);
  });
});
