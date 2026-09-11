import { describe, it, expect } from "vitest";
import {
  planOrderLandingEffect,
  selectReservableLines,
  planReservationItems,
  planReservationRelease,
  buildOnlineSaleAmounts,
  buildOnlineSaleLines,
  orderMovementMotivo,
} from "@/lib/tiendaOnline/orderLandingPlan";
import type {
  IOrderLineForReservation,
  IReservationCandidate,
  IReservationTarget,
  IReservationMovement,
  IOnlineSaleLineSource,
  IOnlineSaleLineCost,
} from "@/lib/tiendaOnline/orderLandingPlan";
import { movimientoCreateSchema } from "@/schemas/movimiento";
import { pagoLineaSchema } from "@/schemas/pago";
import { checkCreditInvariant } from "@/lib/cuentasPorCobrar/creditInvariant";
import { formatMovimientoMotivo } from "@/utils/formatters";
import {
  QAB_ORDER_STATUS_REPORTABLE,
} from "@/constants/qab";
import {
  TIENDA_ONLINE_ORDER_LANDING_EFFECTS,
  TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX,
} from "@/constants/tiendaOnline";

/**
 * F-014 (contract § 4) — `src/lib/tiendaOnline/orderLandingPlan.ts`, the pure
 * module this feature is built around. It never touches Prisma, so it is the
 * one place criterion 8 (the single stock write across the order's whole
 * journey) and criterion 9/10 (idempotency) can be exercised WITHOUT a
 * database: the DB-level wiring itself (`tiendaOnlineOrderLanding.ts`) is
 * Prisma-only and out of this file's reach (§ 9.1, E-015) — its own
 * behaviour is QA's to verify by executing, not this suite's to fabricate.
 */

const UUID_A = "aaaaaaaa-1111-4111-8111-111111111111";
const UUID_B = "bbbbbbbb-2222-4222-8222-222222222222";
const UUID_PROV = "cccccccc-3333-4333-8333-333333333333";
const UUID_DEST = "dddddddd-4444-4444-8444-444444444444";
const PEDIDO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";

function candidate(
  overrides: Partial<IReservationCandidate> = {},
): IReservationCandidate {
  return {
    productoTiendaId: "pt-1",
    productoId: UUID_A,
    proveedorId: null,
    existencia: 100,
    ...overrides,
  };
}

describe("planOrderLandingEffect", () => {
  const EXPECTED: Record<string, string> = {
    CONFIRMED: "RESERVE",
    DELIVERED: "SELL",
    CANCELLED: "RELEASE",
    REJECTED_BY_STORE: "RELEASE",
    READY: "NONE",
    IN_TRANSIT: "NONE",
  };

  it.each(QAB_ORDER_STATUS_REPORTABLE)(
    "maps %s to the effect the contract fixes",
    (status) => {
      expect(planOrderLandingEffect(status)).toBe(EXPECTED[status]);
    },
  );

  it("is total over the six reportable values — every one returns a member of TIENDA_ONLINE_ORDER_LANDING_EFFECTS", () => {
    for (const status of QAB_ORDER_STATUS_REPORTABLE) {
      expect(TIENDA_ONLINE_ORDER_LANDING_EFFECTS).toContain(
        planOrderLandingEffect(status),
      );
    }
  });
});

describe("selectReservableLines", () => {
  it("groups two lines of the SAME product into one target and sums their cantidad", () => {
    const lineas: IOrderLineForReservation[] = [
      { lineaId: "l-2", storeProductExternalId: "pt-1", cantidad: 3 },
      { lineaId: "l-1", storeProductExternalId: "pt-1", cantidad: 2 },
    ];
    const catalog = new Map([
      ["pt-1", candidate({ productoTiendaId: "pt-1", existencia: 10 })],
    ]);

    const { targets, skipped } = selectReservableLines({ lineas, catalog });

    expect(skipped).toEqual([]);
    expect(targets).toHaveLength(1);
    expect(targets[0].cantidad).toBe(5);
    // Ascending lineaId, NOT the input order (l-2 arrived first).
    expect(targets[0].lineaIds).toEqual(["l-1", "l-2"]);
  });

  it("skips BOTH lines of a product when their COMBINED demand exceeds existencia — all-or-none per product (ADR 0071)", () => {
    // Each line ALONE (4) fits inside existencia (5); only their SUM (8) does
    // not. A per-line check (instead of per-product) would wrongly reserve
    // both — this is the E-008 discriminator for that mistake.
    const lineas: IOrderLineForReservation[] = [
      { lineaId: "l-1", storeProductExternalId: "pt-2", cantidad: 4 },
      { lineaId: "l-2", storeProductExternalId: "pt-2", cantidad: 4 },
    ];
    const catalog = new Map([
      ["pt-2", candidate({ productoTiendaId: "pt-2", existencia: 5 })],
    ]);

    const { targets, skipped } = selectReservableLines({ lineas, catalog });

    expect(targets).toEqual([]);
    expect(skipped).toEqual([
      { lineaId: "l-1", reason: "INSUFFICIENT_STOCK" },
      { lineaId: "l-2", reason: "INSUFFICIENT_STOCK" },
    ]);
  });

  it("skips a line with storeProductExternalId: null as NO_PRODUCT_REFERENCE — criterion 12", () => {
    const lineas: IOrderLineForReservation[] = [
      { lineaId: "l-1", storeProductExternalId: null, cantidad: 1 },
    ];

    const { targets, skipped } = selectReservableLines({
      lineas,
      catalog: new Map(),
    });

    expect(targets).toEqual([]);
    expect(skipped).toEqual([{ lineaId: "l-1", reason: "NO_PRODUCT_REFERENCE" }]);
  });

  it("skips a line whose storeProductExternalId is not a key of catalog as PRODUCT_NOT_RESOLVED — criterion 13 (and criterion 11's multi-tenant guarantee: a product of another negocio is simply never a key of `catalog`)", () => {
    const lineas: IOrderLineForReservation[] = [
      { lineaId: "l-1", storeProductExternalId: "pt-ghost", cantidad: 1 },
    ];

    const { targets, skipped } = selectReservableLines({
      lineas,
      catalog: new Map(),
    });

    expect(targets).toEqual([]);
    expect(skipped).toEqual([
      { lineaId: "l-1", reason: "PRODUCT_NOT_RESOLVED" },
    ]);
  });

  it("returns targets ascending by productoTiendaId, regardless of the order lines arrived in", () => {
    const lineas: IOrderLineForReservation[] = [
      { lineaId: "l-3", storeProductExternalId: "pt-3", cantidad: 1 },
      { lineaId: "l-1", storeProductExternalId: "pt-1", cantidad: 1 },
    ];
    const catalog = new Map([
      ["pt-3", candidate({ productoTiendaId: "pt-3", existencia: 10 })],
      ["pt-1", candidate({ productoTiendaId: "pt-1", existencia: 10 })],
    ]);

    const { targets } = selectReservableLines({ lineas, catalog });

    expect(targets.map((t) => t.productoTiendaId)).toEqual(["pt-1", "pt-3"]);
  });

  it("returns skipped lines ascending by lineaId, mixing both skip reasons", () => {
    const lineas: IOrderLineForReservation[] = [
      { lineaId: "l-9", storeProductExternalId: null, cantidad: 1 },
      { lineaId: "l-2", storeProductExternalId: "pt-ghost", cantidad: 1 },
    ];

    const { skipped } = selectReservableLines({ lineas, catalog: new Map() });

    expect(skipped.map((s) => s.lineaId)).toEqual(["l-2", "l-9"]);
  });

  it("criterion 14 — the reservation depends ONLY on each line's cantidad: the function takes no delivery-fee-shaped input at all", () => {
    const lineas: IOrderLineForReservation[] = [
      { lineaId: "l-1", storeProductExternalId: "pt-1", cantidad: 7 },
    ];
    const catalog = new Map([
      ["pt-1", candidate({ productoTiendaId: "pt-1", existencia: 100 })],
    ]);

    const { targets } = selectReservableLines({ lineas, catalog });

    expect(targets[0].cantidad).toBe(7);
  });

  it("carries productoId and proveedorId from the resolved candidate into the target — planReservationItems needs both to hit the SAME ProductoTienda row", () => {
    const lineas: IOrderLineForReservation[] = [
      { lineaId: "l-1", storeProductExternalId: "pt-1", cantidad: 2 },
    ];
    const catalog = new Map([
      [
        "pt-1",
        candidate({
          productoTiendaId: "pt-1",
          productoId: UUID_A,
          proveedorId: UUID_PROV,
          existencia: 10,
        }),
      ],
    ]);

    const { targets } = selectReservableLines({ lineas, catalog });

    expect(targets[0]).toMatchObject({
      productoId: UUID_A,
      proveedorId: UUID_PROV,
    });
  });
});

describe("planReservationItems", () => {
  it("maps each target 1:1 to a real, valid movimientoCreateSchema item, in the SAME order", () => {
    const targets: IReservationTarget[] = [
      {
        productoTiendaId: "pt-1",
        productoId: UUID_A,
        proveedorId: null,
        cantidad: 3,
        lineaIds: ["l-1"],
      },
      {
        productoTiendaId: "pt-2",
        productoId: UUID_B,
        proveedorId: UUID_PROV,
        cantidad: 5,
        lineaIds: ["l-2"],
      },
    ];

    const items = planReservationItems(targets);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ productoId: UUID_A, cantidad: 3 });
    expect(items[0].proveedorId).toBeUndefined();
    expect(items[1]).toMatchObject({
      productoId: UUID_B,
      cantidad: 5,
      proveedorId: UUID_PROV,
    });
    for (const item of items) {
      expect(movimientoCreateSchema.safeParse(item).success).toBe(true);
    }
  });

  it("does not reorder — a caller that locks rows in the given order relies on this order being preserved", () => {
    const targets: IReservationTarget[] = [
      {
        productoTiendaId: "pt-9",
        productoId: UUID_B,
        proveedorId: null,
        cantidad: 1,
        lineaIds: ["l-1"],
      },
      {
        productoTiendaId: "pt-1",
        productoId: UUID_A,
        proveedorId: null,
        cantidad: 1,
        lineaIds: ["l-2"],
      },
    ];

    const items = planReservationItems(targets);

    expect(items.map((i) => i.productoId)).toEqual([UUID_B, UUID_A]);
  });
});

describe("planReservationRelease", () => {
  it("mirrors the movements it is given — one item per movement, with a real, valid shape", () => {
    const movements: IReservationMovement[] = [
      { productoTiendaId: "pt-1", productoId: UUID_A, proveedorId: null, cantidad: 3 },
    ];

    const items = planReservationRelease(movements);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productoId: UUID_A, cantidad: 3 });
    expect(movimientoCreateSchema.safeParse(items[0]).success).toBe(true);
  });

  it("a product skipped at CONFIRMED took no movement and gives back nothing — ADR 0072's core guarantee, and the executable form of 'el reverso espeja los movimientos realmente escritos, nunca las líneas del pedido'", () => {
    // Simulates an order whose CONFIRMED reserved only ONE of two products
    // (the other was skipped as INSUFFICIENT_STOCK or similar): the release
    // must see only the movement that really exists, never a second one
    // invented from "the order also had a line for the other product".
    const movements: IReservationMovement[] = [
      { productoTiendaId: "pt-reserved", productoId: UUID_A, proveedorId: null, cantidad: 2 },
    ];

    const items = planReservationRelease(movements);

    expect(items).toHaveLength(1);
    expect(items.map((i) => i.productoId)).toEqual([UUID_A]);
  });

  it("returns items ascending by productoTiendaId — same lock order as the reservation", () => {
    const movements: IReservationMovement[] = [
      { productoTiendaId: "pt-9", productoId: UUID_B, proveedorId: null, cantidad: 1 },
      { productoTiendaId: "pt-1", productoId: UUID_A, proveedorId: null, cantidad: 1 },
    ];

    const items = planReservationRelease(movements);

    expect(items.map((i) => i.productoId)).toEqual([UUID_A, UUID_B]);
  });

  it("preserves each movement's OWN cantidad exactly — never a value recomputed from the order's lines", () => {
    const movements: IReservationMovement[] = [
      { productoTiendaId: "pt-1", productoId: UUID_A, proveedorId: null, cantidad: 2.5 },
    ];

    const items = planReservationRelease(movements);

    expect(items[0].cantidad).toBe(2.5);
  });
});

describe("buildOnlineSaleAmounts", () => {
  it("EFECTIVO puts the whole total in totalcash and 0 in totaltransfer; same-currency conversion is the identity", () => {
    const amounts = buildOnlineSaleAmounts({
      pedidoTotal: 105,
      pedidoCurrencyCode: "CUP",
      monedaBase: "CUP",
      tasas: {},
      pago: { metodo: "EFECTIVO" },
    });

    expect(amounts.total).toBe(105);
    expect(amounts.totalcash).toBe(105);
    expect(amounts.totaltransfer).toBe(0);
    expect(amounts.monedaCobro).toBe("CUP");
    expect(amounts.transferDestinationId).toBeUndefined();
    expect(amounts.pagosDetalle).toHaveLength(1);
    expect(amounts.pagosDetalle[0]).toMatchObject({
      tipo: "cash",
      moneda: "CUP",
      monto: 105,
      equivalenteBase: 105,
    });
    expect(pagoLineaSchema.safeParse(amounts.pagosDetalle[0]).success).toBe(
      true,
    );
  });

  it("TRANSFERENCIA does the mirror, and converts through cuadrecaja's OWN tasas — never a rateSnapshot from the order (ADR 0060, ADR 0073)", () => {
    const amounts = buildOnlineSaleAmounts({
      pedidoTotal: 10,
      pedidoCurrencyCode: "USD",
      monedaBase: "CUP",
      tasas: { USD: 400 },
      pago: { metodo: "TRANSFERENCIA", transferDestinationId: UUID_DEST },
    });

    expect(amounts.total).toBe(4000);
    expect(amounts.totalcash).toBe(0);
    expect(amounts.totaltransfer).toBe(4000);
    expect(amounts.monedaCobro).toBe("USD");
    expect(amounts.transferDestinationId).toBe(UUID_DEST);
    expect(amounts.pagosDetalle[0]).toMatchObject({
      tipo: "transfer",
      moneda: "USD",
      // The line's own `monto` is the ORDER's amount, in the order's currency
      // — NOT converted. `equivalenteBase` carries the conversion.
      monto: 10,
      equivalenteBase: 4000,
      transferDestinationId: UUID_DEST,
    });
    expect(pagoLineaSchema.safeParse(amounts.pagosDetalle[0]).success).toBe(
      true,
    );
  });

  it("a pedidoTotal of 0 yields pagosDetalle: [] — pagoLineaSchema.monto is positive(), a zero line would not validate", () => {
    const amounts = buildOnlineSaleAmounts({
      pedidoTotal: 0,
      pedidoCurrencyCode: "CUP",
      monedaBase: "CUP",
      tasas: {},
      pago: { metodo: "EFECTIVO" },
    });

    expect(amounts.pagosDetalle).toEqual([]);
    expect(amounts.total).toBe(0);
  });

  it("when the order is already in the business's base currency, conversion is the identity regardless of what `tasas` holds", () => {
    const amounts = buildOnlineSaleAmounts({
      pedidoTotal: 250,
      pedidoCurrencyCode: "CUP",
      monedaBase: "CUP",
      tasas: { USD: 400 }, // irrelevant: a same-currency conversion never reads it
      pago: { metodo: "EFECTIVO" },
    });

    expect(amounts.total).toBe(250);
  });

  /**
   * F-038 (contract § 4, § 8.2 point 2) — the THIRD branch, CREDITO. It moves
   * nothing into either cash column and contributes NO `pagosDetalle` line:
   * that absence is what keeps the period's cash reconciliation untouched by
   * construction (criterion 2), because `buildResumenMonedas` only ever walks
   * `pagosDetalle`.
   *
   * The "identical total" assertion is what discriminates (E-008): a branch
   * that returned 0 for everything would still pass `totalcash === 0` and
   * `totaltransfer === 0`, so the suite also compares `total` against what the
   * OTHER two branches compute from the exact same input — proving the credit
   * branch reuses the same `convertToBase` call and does not invent its own
   * arithmetic.
   */
  it("CREDITO puts the whole total in creditoBase, moves NOTHING to totalcash/totaltransfer, and contributes NO pagosDetalle line", () => {
    const args = {
      pedidoTotal: 10,
      pedidoCurrencyCode: "USD",
      monedaBase: "CUP",
      tasas: { USD: 400 },
    };

    const creditAmounts = buildOnlineSaleAmounts({
      ...args,
      pago: { metodo: "CREDITO", clienteId: UUID_A },
    });
    const cashAmounts = buildOnlineSaleAmounts({
      ...args,
      pago: { metodo: "EFECTIVO" },
    });
    const transferAmounts = buildOnlineSaleAmounts({
      ...args,
      pago: { metodo: "TRANSFERENCIA", transferDestinationId: UUID_DEST },
    });

    expect(creditAmounts.totalcash).toBe(0);
    expect(creditAmounts.totaltransfer).toBe(0);
    expect(creditAmounts.pagosDetalle).toEqual([]);
    expect(creditAmounts.creditoBase).toBe(creditAmounts.total);
    expect(creditAmounts.transferDestinationId).toBeUndefined();
    expect(creditAmounts.monedaCobro).toBe("USD");

    // The SAME total the other two branches compute from the same input —
    // the credit branch does not run its own conversion.
    expect(creditAmounts.total).toBe(4000);
    expect(creditAmounts.total).toBe(cashAmounts.total);
    expect(creditAmounts.total).toBe(transferAmounts.total);

    // The other two branches never carry a credit.
    expect(cashAmounts.creditoBase).toBe(0);
    expect(transferAmounts.creditoBase).toBe(0);
  });

  it("CREDITO carries the order's own currency and amount as informative fields, read by no arithmetic", () => {
    const amounts = buildOnlineSaleAmounts({
      pedidoTotal: 20,
      pedidoCurrencyCode: "USD",
      monedaBase: "CUP",
      tasas: { USD: 400 },
      pago: { metodo: "CREDITO", clienteId: UUID_A },
    });

    expect(amounts.monedaDeudaCode).toBe("USD");
    expect(amounts.montoDeudaMonedaOriginal).toBe(20);
  });

  it("a zero-total order declared CREDITO still yields creditoBase: 0 and the two informative debt fields (contract § 4.3)", () => {
    const amounts = buildOnlineSaleAmounts({
      pedidoTotal: 0,
      pedidoCurrencyCode: "USD",
      monedaBase: "CUP",
      tasas: { USD: 400 },
      pago: { metodo: "CREDITO", clienteId: UUID_A },
    });

    expect(amounts.total).toBe(0);
    expect(amounts.creditoBase).toBe(0);
    expect(amounts.pagosDetalle).toEqual([]);
    // Deliberately gated on isCredit alone and not on pedidoTotal > 0 (§ 4.3):
    // sellOrder never reads these two for a zero total, since its own guard
    // is creditoBase > 0, but they still travel.
    expect(amounts.monedaDeudaCode).toBe("USD");
    expect(amounts.montoDeudaMonedaOriginal).toBe(0);
  });
});

/**
 * F-038 (contract § 5.2, § 8.2 point 3) — `checkCreditInvariant` is NOT called
 * at runtime by `sellOrder` (contract § 5.2 explains why: it would be a
 * function checking its own output, an unreachable and therefore untested
 * rejection branch, E-032). The guarantee is obtained here instead: the
 * output of the third branch of `buildOnlineSaleAmounts` must satisfy the
 * invariant `checkCreditInvariant` already enforces for the POS's own credit
 * sales (F-031), with no tip and no change.
 */
describe("checkCreditInvariant over the third branch of buildOnlineSaleAmounts", () => {
  it("is ok: true, violation: null for a CREDITO order with no tip and no change", () => {
    const amounts = buildOnlineSaleAmounts({
      pedidoTotal: 10,
      pedidoCurrencyCode: "USD",
      monedaBase: "CUP",
      tasas: { USD: 400 },
      pago: { metodo: "CREDITO", clienteId: UUID_A },
    });

    const result = checkCreditInvariant({
      total: amounts.total,
      creditoBase: amounts.creditoBase,
      clienteId: UUID_A,
      pagosDetalle: amounts.pagosDetalle,
      vueltoDetalle: [],
      tasaSnapshot: { USD: 400 },
      monedaBase: "CUP",
    });

    expect(result.ok).toBe(true);
    expect(result.violation).toBeNull();
  });
});

describe("buildOnlineSaleLines", () => {
  function cost(overrides: Partial<IOnlineSaleLineCost> = {}): IOnlineSaleLineCost {
    return { costo: 0, monedaCostoCode: null, ...overrides };
  }

  it("orders ascending by lineaId, regardless of input order", () => {
    const lineas: IOnlineSaleLineSource[] = [
      { lineaId: "l-9", storeProductExternalId: "pt-b", cantidad: 9, unitPrice: 90 },
      { lineaId: "l-1", storeProductExternalId: "pt-a", cantidad: 1, unitPrice: 10 },
    ];

    const lines = buildOnlineSaleLines({
      lineas,
      reservedProductoTiendaIds: new Set(["pt-a", "pt-b"]),
      costs: new Map(),
      pedidoCurrencyCode: "CUP",
    });

    // l-1 first, even though l-9 arrived first in `lineas`.
    expect(lines.map((l) => l.cantidad)).toEqual([1, 9]);
  });

  it("a line whose product was NOT reserved produces NO row — nothing for VentaProducto.productoTiendaId (a required FK) to point at", () => {
    const lineas: IOnlineSaleLineSource[] = [
      { lineaId: "l-1", storeProductExternalId: "pt-skipped", cantidad: 1, unitPrice: 10 },
    ];

    const lines = buildOnlineSaleLines({
      lineas,
      reservedProductoTiendaIds: new Set(),
      costs: new Map(),
      pedidoCurrencyCode: "CUP",
    });

    expect(lines).toEqual([]);
  });

  it("copies price and currency VERBATIM from the line — precio = unitPrice, monedaPrecioCode = pedidoCurrencyCode (ADR 0062)", () => {
    const lineas: IOnlineSaleLineSource[] = [
      { lineaId: "l-1", storeProductExternalId: "pt-a", cantidad: 3, unitPrice: 12.5 },
    ];

    const [line] = buildOnlineSaleLines({
      lineas,
      reservedProductoTiendaIds: new Set(["pt-a"]),
      costs: new Map(),
      pedidoCurrencyCode: "USD",
    });

    expect(line.precio).toBe(12.5);
    expect(line.monedaPrecioCode).toBe("USD");
    expect(line.cantidad).toBe(3);
    expect(line.productoTiendaId).toBe("pt-a");
  });

  it("a reserved product missing from `costs` gets costo: 0 and monedaCostoCode: null — must not throw (soft-deleted between CONFIRMED and DELIVERED)", () => {
    const lineas: IOnlineSaleLineSource[] = [
      { lineaId: "l-1", storeProductExternalId: "pt-a", cantidad: 1, unitPrice: 10 },
    ];

    const [line] = buildOnlineSaleLines({
      lineas,
      reservedProductoTiendaIds: new Set(["pt-a"]),
      costs: new Map(),
      pedidoCurrencyCode: "CUP",
    });

    expect(line.costo).toBe(0);
    expect(line.monedaCostoCode).toBeNull();
  });

  it("a reserved product present in `costs` carries its costo and monedaCostoCode", () => {
    const lineas: IOnlineSaleLineSource[] = [
      { lineaId: "l-1", storeProductExternalId: "pt-a", cantidad: 1, unitPrice: 10 },
    ];
    const costs = new Map([["pt-a", cost({ costo: 6, monedaCostoCode: "USD" })]]);

    const [line] = buildOnlineSaleLines({
      lineas,
      reservedProductoTiendaIds: new Set(["pt-a"]),
      costs,
      pedidoCurrencyCode: "CUP",
    });

    expect(line.costo).toBe(6);
    expect(line.monedaCostoCode).toBe("USD");
  });
});

describe("orderMovementMotivo", () => {
  it("contains the fixed prefix and the pedidoId — never PedidoEntrante.code (ADR 0061)", () => {
    const motivo = orderMovementMotivo(PEDIDO_ID);

    expect(motivo).toContain(TIENDA_ONLINE_ORDER_MOVEMENT_MOTIVO_PREFIX);
    expect(motivo).toContain(PEDIDO_ID);
  });

  it("formatMovimientoMotivo shortens the id inside it to #xxxxxxxx — real integration between the two modules, not a fabricated string", () => {
    const motivo = orderMovementMotivo(PEDIDO_ID);
    const formatted = formatMovimientoMotivo(motivo);

    expect(formatted).toContain("#8f14e45f");
    expect(formatted).not.toContain(PEDIDO_ID);
  });
});
