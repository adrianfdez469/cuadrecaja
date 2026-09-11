import { describe, it, expect } from "vitest";
import { DEFAULT_TICKET_PLANTILLA } from "@/schemas/ticketPlantilla";
import type { ITicketPlantilla } from "@/schemas/ticketPlantilla";
import type { ITicketPayload } from "@/features/printing/types/ITicketData";
import type { Sale, SaleProduct } from "@/store/salesStore";
import type { IVenta } from "@/schemas/venta";

/**
 * F-034, contract § 7.2, § 7.3, § 7.4 — criterion 11 ("the printed ticket says the
 * customer's name and the credit balance") and the ADR 0120 sanitization at the
 * printing boundary. Also propagation point P10 of § 2 (`ventaToSale`, server -> client).
 *
 * `buildTicketPayload`, `buildTicketLines`/`ticketLinesToStrings` and `ventaToSale`
 * already exist (F-021-era printing feature) and will be EDITED, not created — their
 * export names do not change, only their behaviour does. Loaded dynamically anyway,
 * for the same reason the rest of this suite does: consistent defense against a
 * collection-time surprise while the implementer is mid-edit (E-019).
 *
 * E-016 discipline throughout: every assertion below searches inside the lines
 * `buildTicketLines` returns (via `ticketLinesToStrings`), never `document.body`.
 */
const { buildTicketPayload } = await import(
  "@/features/printing/lib/buildTicketPayload"
);
const { buildTicketLines, ticketLinesToStrings } = await import(
  "@/features/printing/lib/buildTicketLines"
);
const { ventaToSale } = await import("@/features/printing/lib/ventaToSale");
const { CREDIT_TICKET_COPY } = await import("@/constants/creditoVenta");

const PLANTILLA: ITicketPlantilla = {
  ...DEFAULT_TICKET_PLANTILLA,
  tiendaId: "11111111-1111-1111-1111-111111111111",
};

const PRODUCT: SaleProduct = {
  cantidad: 1,
  productoTiendaId: "pt-1",
  productId: "pt-1",
  name: "Cerveza",
  price: 100,
};

function creditSale(overrides: Partial<Sale> = {}): Sale {
  return {
    identifier: "sale-1",
    tiendaId: "tienda-1",
    cierreId: "cierre-1",
    usuarioId: "usuario-1",
    total: 1000,
    totalcash: 600,
    totaltransfer: 0,
    productos: [PRODUCT],
    synced: true,
    syncState: "synced",
    createdAt: Date.now(),
    wasOffline: false,
    syncAttempts: 0,
    creditoBase: 400,
    clienteId: "cliente-1",
    // Deliberately NOT the same as the cashier's name below (E-016): a customer
    // named the same as the cashier would let this pass without printing anything.
    clienteNombre: "Roberto Pérez",
    ...overrides,
  } as Sale;
}

describe("buildTicketPayload — copies creditoBase/clienteNombre from the Sale (§ 7.2)", () => {
  it("carries creditoBase and clienteNombre when the sale left a debt", () => {
    const payload = buildTicketPayload(creditSale(), PLANTILLA, {
      tiendaNombre: "Mi Tienda",
      negocioNombre: "Mi Negocio",
      cajeroNombre: "Marta",
      monedaBase: "CUP",
    }) as ITicketPayload & { creditoBase?: number; clienteNombre?: string };

    expect(payload.creditoBase).toBe(400);
    expect(payload.clienteNombre).toBe("Roberto Pérez");
  });

  it("leaves both undefined for an ordinary sale (creditoBase 0 or absent) — NEVER derived from total - totalcash - totaltransfer (E-013, that subtraction is bug 2)", () => {
    const payload = buildTicketPayload(
      creditSale({ creditoBase: 0, clienteId: undefined, clienteNombre: undefined }),
      PLANTILLA,
      {
        tiendaNombre: "Mi Tienda",
        negocioNombre: "Mi Negocio",
        cajeroNombre: "Marta",
        monedaBase: "CUP",
      },
    ) as ITicketPayload & { creditoBase?: number; clienteNombre?: string };

    expect(payload.creditoBase).toBeUndefined();
    expect(payload.clienteNombre).toBeUndefined();
  });
});

describe("buildTicketLines — criterion 11: the customer's name and the credit balance are printed", () => {
  const width = 32;

  function fullPayload(extra: Partial<ITicketPayload> = {}): ITicketPayload {
    return {
      tiendaNombre: "Mi Tienda",
      negocioNombre: "Mi Negocio",
      cajeroNombre: "Marta",
      ticketId: "abc12345",
      fechaCompleta: "09/09/2026",
      productos: [
        {
          cantidad: 1,
          nombre: "Cerveza",
          precioUnitario: 100,
          subtotal: 100,
        },
      ],
      subtotalBase: 100,
      total: 1000,
      totalCash: 600,
      totalTransfer: 0,
      monedasUsadasEnVenta: [],
      monedasParaTasas: [],
      plantilla: PLANTILLA,
      monedaBase: "CUP",
      ...extra,
    };
  }

  it("prints the customer's name and the credit label + amount when creditoBase > 0", () => {
    const payload = fullPayload({
      creditoBase: 400,
      clienteNombre: "Roberto Pérez",
    } as Partial<ITicketPayload>);
    const lines = ticketLinesToStrings(buildTicketLines(payload), width);
    const joined = lines.join("\n");

    expect(joined).toContain("Roberto Pérez");
    expect(joined).toContain(CREDIT_TICKET_COPY.saldoLabel);
  });

  it("prints NOTHING about credit when creditoBase is 0 or absent", () => {
    const payload = fullPayload();
    const lines = ticketLinesToStrings(buildTicketLines(payload), width);
    const joined = lines.join("\n");

    expect(joined).not.toContain(CREDIT_TICKET_COPY.saldoLabel);
  });

  it("does NOT gate the credit lines behind plantilla.mostrarMultimoneda (§ 7.3: no template flag of its own)", () => {
    const payload = fullPayload({
      creditoBase: 400,
      clienteNombre: "Roberto Pérez",
      plantilla: { ...PLANTILLA, mostrarMultimoneda: false },
    } as Partial<ITicketPayload>);
    const lines = ticketLinesToStrings(buildTicketLines(payload), width);
    const joined = lines.join("\n");

    expect(joined).toContain(CREDIT_TICKET_COPY.saldoLabel);
  });

  it("ADR 0120: left()/center() strip control characters from EVERY rendered line, including a dirty clienteNombre that bypassed the schema (a row written before the bound existed)", () => {
    const payload = fullPayload({
      creditoBase: 400,
      clienteNombre: "Ana\x1Bp\x00\x19\xFA",
    } as Partial<ITicketPayload>);
    const rendered = buildTicketLines(payload);

    for (const line of rendered) {
      if (line.kind === "text") {
        // eslint-disable-next-line no-control-regex
        expect(/[\x00-\x1F\x7F-\x9F]/.test(line.text)).toBe(false);
      }
    }
  });
});

describe("ventaToSale — propagates creditoBase/clienteId/clienteNombre for reprinting (§ 7.4, propagation point P10)", () => {
  function baseVenta(overrides: Partial<IVenta> = {}): IVenta {
    return {
      id: "11111111-1111-1111-1111-111111111111",
      createdAt: new Date("2026-01-01"),
      total: 1000,
      totalcash: 600,
      totaltransfer: 0,
      tiendaId: "22222222-2222-2222-2222-222222222222",
      usuarioId: "33333333-3333-3333-3333-333333333333",
      cierrePeriodoId: "44444444-4444-4444-4444-444444444444",
      ...overrides,
    } as IVenta;
  }

  it("carries creditoBase, clienteId and clienteNombre onto the local Sale", () => {
    const venta = baseVenta({
      creditoBase: 400,
      clienteId: "cliente-1",
      clienteNombre: "Roberto Pérez",
    } as Partial<IVenta>);

    const sale = ventaToSale(venta) as Sale & {
      creditoBase?: number;
      clienteId?: string;
      clienteNombre?: string;
    };

    expect(sale.creditoBase).toBe(400);
    expect(sale.clienteId).toBe("cliente-1");
    expect(sale.clienteNombre).toBe("Roberto Pérez");
  });

  it("a plain sale (no credit) carries no customer at all", () => {
    const sale = ventaToSale(baseVenta()) as Sale & {
      creditoBase?: number;
      clienteId?: string;
      clienteNombre?: string;
    };

    expect(sale.creditoBase ?? 0).toBe(0);
    expect(sale.clienteId).toBeUndefined();
  });
});
