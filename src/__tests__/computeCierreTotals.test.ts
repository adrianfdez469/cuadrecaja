import { describe, expect, it, vi } from "vitest";
import {
  computeCierreTotals,
  hasTotalsDrift,
  mergeLiquidaciones,
  sumSalesTotals,
  valueSales,
  type CierreComputationInput,
  type CierreSale,
  type CierreSaleLine,
} from "@/lib/cierre/computeCierreTotals";
import type { IPagoLinea } from "@/schemas/pago";

// A USD-based business paid mostly in CUP — the shape of the production
// period that motivated ADR 0036. The USD rate rose from 675 to 680 during
// the day, so a sale valued with the wrong rate is visible in the totals.
const T_675 = new Date("2026-09-02T10:00:00Z");
const T_680 = new Date("2026-09-02T16:50:00Z");
const historialTasas = [
  { monedaCode: "USD", tasa: 675, createdAt: T_675 },
  { monedaCode: "EUR", tasa: 775, createdAt: T_675 },
  { monedaCode: "USD", tasa: 680, createdAt: T_680 },
];

const line = (over: Partial<CierreSaleLine>): CierreSaleLine => ({
  productoTiendaId: "pt-1",
  productoId: "p-1",
  nombre: "Producto",
  cantidad: 1,
  costo: 0,
  precio: 0,
  monedaCostoCode: null,
  monedaPrecioCode: null,
  proveedor: null,
  existencia: 10,
  ...over,
});

const sale = (over: Partial<CierreSale>): CierreSale => ({
  id: "v",
  createdAt: new Date("2026-09-02T18:00:00Z"),
  discountTotal: 0,
  tipTotal: 0,
  totaltransfer: 0,
  // F-030: part of `total` handed over on credit, in base currency. 0 is every sale that
  // predates the feature and every cash sale in these fixtures unless overridden.
  creditoBase: 0,
  tasaSnapshot: { USD: 680, EUR: 775 },
  pagosDetalle: null,
  vueltoDetalle: null,
  tipDetail: null,
  usuario: { id: "u-1", nombre: "Cajero" },
  transferDestination: null,
  appliedDiscounts: [],
  productos: [],
  ...over,
});

const baseInput = (over: Partial<CierreComputationInput> = {}) =>
  ({
    monedaBase: "USD",
    fechaFin: new Date("2026-09-03T01:18:00Z"),
    historialTasas,
    ventas: [],
    gastos: [],
    movimientos: [],
    initialFundAmounts: {},
    // F-030: ABONO rows of the period, receivables still open at the cutoff, and the
    // store's transfer destinations — see the "credit (F-030)" suite below.
    abonos: [],
    cuentasPorCobrar: [],
    transferDestinations: [],
    ...over,
  }) satisfies CierreComputationInput;

describe("valueSales", () => {
  it("values a USD-priced line paid in CUP without depending on the rate", () => {
    const [valued] = valueSales(
      [
        sale({
          productos: [line({ precio: 10, monedaPrecioCode: "USD", costo: 4 })],
          pagosDetalle: [
            { tipo: "cash", moneda: "CUP", monto: 6800, equivalenteBase: 10 },
          ],
        }),
      ],
      "USD",
      historialTasas,
    );
    expect(valued.ventaBruta).toBe(10);
    expect(valued.lineas[0].gananciaProducto).toBe(6);
  });

  it("values a CUP-priced line with the sale's own rate", () => {
    const [valued] = valueSales(
      [sale({ productos: [line({ precio: 6800, monedaPrecioCode: "CUP" })] })],
      "USD",
      historialTasas,
    );
    expect(valued.ventaBruta).toBeCloseTo(10, 6);
  });

  it("completes a snapshot missing the base currency with the historical rate", () => {
    // The mobile app persisted { EUR } only; at 12:00 the USD rate was 675.
    const [valued] = valueSales(
      [
        sale({
          createdAt: new Date("2026-09-02T12:00:00Z"),
          tasaSnapshot: { EUR: 775 },
          productos: [line({ precio: 675, monedaPrecioCode: "CUP" })],
        }),
      ],
      "USD",
      historialTasas,
    );
    expect(valued.tasas.USD).toBe(675);
    expect(valued.ventaBruta).toBeCloseTo(1, 6);
  });

  it("nets the discount per sale and never below zero", () => {
    const totals = sumSalesTotals(
      valueSales(
        [
          sale({
            discountTotal: 3,
            productos: [line({ precio: 10, monedaPrecioCode: "USD" })],
          }),
          sale({
            id: "v2",
            discountTotal: 50,
            productos: [line({ precio: 10, monedaPrecioCode: "USD" })],
          }),
        ],
        "USD",
        historialTasas,
      ),
    );
    expect(totals).toEqual({
      totalVentasBrutas: 20,
      totalDescuentos: 53,
      totalVentas: 7,
    });
  });
});

describe("computeCierreTotals", () => {
  const ventas = [
    // 25 USD paid with 17 000 CUP, exact.
    sale({
      id: "v1",
      productos: [line({ precio: 25, monedaPrecioCode: "USD", costo: 15 })],
      pagosDetalle: [
        { tipo: "cash", moneda: "CUP", monto: 17000, equivalenteBase: 25 },
      ],
    }),
    // 44 USD paid with 50 USD, 6 USD change.
    sale({
      id: "v2",
      productos: [line({ precio: 22, cantidad: 2, costo: 10 })],
      pagosDetalle: [
        { tipo: "cash", moneda: "USD", monto: 50, equivalenteBase: 50 },
      ],
      vueltoDetalle: [{ moneda: "USD", monto: 6 }],
    }),
    // 900 CUP × 13 = 11 700 CUP paid with 11 768 CUP: 68 CUP (0.10 USD) tip.
    sale({
      id: "v3",
      tipTotal: 0.1,
      tipDetail: [
        { tipo: "cash", moneda: "CUP", monto: 68, equivalenteBase: 0.1 },
      ],
      productos: [
        line({
          precio: 900,
          cantidad: 13,
          monedaPrecioCode: "CUP",
          costo: 450,
          monedaCostoCode: "CUP",
        }),
      ],
      pagosDetalle: [
        {
          tipo: "cash",
          moneda: "CUP",
          monto: 11768,
          equivalenteBase: 11768 / 680,
        },
      ],
    }),
  ];

  it("stores net sales that match what the drawer received minus the fund and tips", () => {
    const { totals, resumenMonedas } = computeCierreTotals(
      baseInput({ ventas, initialFundAmounts: { USD: 200, CUP: 1000 } }),
    );

    const ventasEsperadas = 25 + 44 + 11700 / 680;
    expect(totals.totalVentas).toBeCloseTo(ventasEsperadas, 6);
    expect(totals.totalVentasBrutas).toBeCloseTo(ventasEsperadas, 6);
    expect(totals.totalDescuentos).toBe(0);
    expect(totals.totalTips).toBeCloseTo(0.1, 6);

    const usd = resumenMonedas.find((r) => r.monedaCode === "USD")!;
    const cup = resumenMonedas.find((r) => r.monedaCode === "CUP")!;
    // Drawer = fund + cash in − change; the fund is in the gross figure too.
    expect(usd.totalEfectivo).toBe(200 + 50 - 6);
    expect(usd.initialFund).toBe(200);
    expect(usd.totalEfectivoBruto).toBe(usd.totalEfectivo);
    expect(cup.totalEfectivo).toBe(1000 + 17000 + 11768);
    expect(cup.tipCash).toBe(68);

    const cajaEnBase = usd.equivalenteBase + cup.equivalenteBase;
    const fondoEnBase = 200 + 1000 / 680;
    expect(cajaEnBase).toBeCloseTo(
      totals.totalVentas + fondoEnBase + totals.totalTips,
      6,
    );
  });

  it("nets profit of discounts and prorates them between own and consigned goods", () => {
    const { totals, totalVentasPropiasNeto, totalVentasConsignacionNeto } =
      computeCierreTotals(
        baseInput({
          ventas: [
            sale({
              discountTotal: 10,
              productos: [
                line({ precio: 60, costo: 30 }),
                line({
                  productoTiendaId: "pt-2",
                  productoId: "p-2",
                  precio: 40,
                  costo: 30,
                  proveedor: { id: "prov", nombre: "Proveedor" },
                }),
              ],
            }),
          ],
        }),
      );
    expect(totals.totalVentasPropias).toBe(60);
    expect(totals.totalVentasConsignacion).toBe(40);
    expect(totals.totalGananciasPropias).toBe(30 - 6);
    expect(totals.totalGananciasConsignacion).toBe(10 - 4);
    expect(totals.totalGanancia).toBe(30);
    expect(totals.totalInversion).toBe(30);
    expect(totalVentasPropiasNeto).toBe(54);
    expect(totalVentasConsignacionNeto).toBe(36);
  });

  it("deducts expenses, cash purchases and refunds from cash but only operating ones from profit", () => {
    const { totals, resumenMonedas, gananciaDeducciones, cajaDeducciones } =
      computeCierreTotals(
        baseInput({
          ventas: [
            sale({
              productos: [line({ precio: 100, costo: 40 })],
              pagosDetalle: [
                {
                  tipo: "cash",
                  moneda: "USD",
                  monto: 100,
                  equivalenteBase: 100,
                },
              ],
            }),
          ],
          gastos: [
            {
              id: "g1",
              nombre: "Luz",
              tipoCalculo: "FIJO",
              montoCalculado: 6800,
              monedaCode: "CUP",
              naturaleza: "OPERATIVO",
              esAdHoc: true,
            },
            {
              id: "g2",
              nombre: "Vitrina",
              tipoCalculo: "FIJO",
              montoCalculado: 20,
              monedaCode: "USD",
              naturaleza: "INVERSION",
              esAdHoc: true,
            },
          ],
          movimientos: [
            {
              id: "m1",
              tipo: "COMPRA",
              formaPago: "EFECTIVO_CAJA",
              costoTotal: 5,
              monedaOriginal: "USD",
              montoOriginal: 5,
              productoNombre: "Compra",
            },
            {
              id: "m2",
              tipo: "MERMA",
              costoTotal: 3,
              productoNombre: "Rota",
            },
            {
              id: "m3",
              tipo: "DEVOLUCION_VENTA",
              costoTotal: 2,
              montoReembolso: 7,
              monedaOriginal: "USD",
              montoOriginal: 7,
              productoNombre: "Devuelta",
            },
          ],
        }),
      );

    expect(totals.totalGanancia).toBe(60);
    expect(totals.totalGastos).toBeCloseTo(10, 6);
    expect(totals.totalMerma).toBe(3);
    expect(totals.totalDevoluciones).toBe(5);
    expect(totals.totalComprasCaja).toBe(5);
    expect(totals.totalGananciaFinal).toBeCloseTo(60 - 10 - 3 - 5, 6);
    expect(gananciaDeducciones.map((d) => d.tipo)).toEqual([
      "GASTO",
      "MERMA",
      "DEVOLUCION",
    ]);

    const usd = resumenMonedas.find((r) => r.monedaCode === "USD")!;
    expect(usd.totalEfectivoBruto).toBe(100);
    expect(usd.totalEfectivo).toBe(100 - 20 - 5 - 7);
    const cup = resumenMonedas.find((r) => r.monedaCode === "CUP")!;
    expect(cup.totalEfectivo).toBe(-6800);
    expect(cajaDeducciones.CUP.map((d) => d.label)).toEqual(["Luz"]);
    expect(cajaDeducciones.USD.map((d) => d.tipo)).toEqual([
      "GASTO",
      "COMPRA",
      "DEVOLUCION",
    ]);
  });

  it("values expenses with the rate in force at the close, not the latest one", () => {
    const { totals } = computeCierreTotals(
      baseInput({
        fechaFin: new Date("2026-09-02T12:00:00Z"),
        gastos: [
          {
            id: "g1",
            nombre: "Luz",
            tipoCalculo: "FIJO",
            montoCalculado: 675,
            monedaCode: "CUP",
            naturaleza: "OPERATIVO",
            esAdHoc: true,
          },
        ],
      }),
    );
    expect(totals.totalGastos).toBeCloseTo(1, 6);
  });

  it("groups consignment settlements by supplier and product with the average cost", () => {
    const { liquidaciones } = computeCierreTotals(
      baseInput({
        ventas: [
          sale({
            productos: [
              line({
                precio: 10,
                costo: 4,
                cantidad: 2,
                proveedor: { id: "prov", nombre: "P" },
              }),
            ],
          }),
          sale({
            id: "v2",
            productos: [
              line({
                precio: 12,
                costo: 5,
                cantidad: 1,
                proveedor: { id: "prov", nombre: "P" },
                existencia: 7,
              }),
            ],
          }),
        ],
      }),
    );
    expect(liquidaciones).toEqual([
      {
        proveedorId: "prov",
        productoId: "p-1",
        vendidos: 3,
        monto: 13,
        costo: 13 / 3,
        precio: 12,
        existencia: 7,
      },
    ]);
  });

  it("is deterministic: the same input always yields the same figures", () => {
    const input = baseInput({ ventas, initialFundAmounts: { USD: 200 } });
    expect(computeCierreTotals(input)).toEqual(computeCierreTotals(input));
  });
});

describe("hasTotalsDrift", () => {
  it("ignores float noise and flags a real change", () => {
    expect(hasTotalsDrift(1368.27037037037, 1368.2703703704)).toBe(false);
    expect(hasTotalsDrift(1488.23, 1368.35)).toBe(true);
  });
});

describe("mergeLiquidaciones", () => {
  it("keeps settlements already paid and drops their recomputed line", () => {
    const existing = [
      { proveedorId: "a", productoId: "1", liquidatedAt: new Date() },
      { proveedorId: "a", productoId: "2", liquidatedAt: null },
    ];
    const computed = [
      {
        proveedorId: "a",
        productoId: "1",
        vendidos: 1,
        monto: 1,
        costo: 1,
        precio: 2,
        existencia: 0,
      },
      {
        proveedorId: "a",
        productoId: "2",
        vendidos: 1,
        monto: 1,
        costo: 1,
        precio: 2,
        existencia: 0,
      },
      {
        proveedorId: "b",
        productoId: "3",
        vendidos: 1,
        monto: 1,
        costo: 1,
        precio: 2,
        existencia: 0,
      },
    ];
    const { toCreate, kept } = mergeLiquidaciones(existing, computed);
    expect(kept).toHaveLength(1);
    expect(toCreate.map((l) => `${l.proveedorId}_${l.productoId}`)).toEqual([
      "a_2",
      "b_3",
    ]);
  });
});

/**
 * F-030 — computeCierreTotals gains three figures and reads two new input
 * arrays (abonos, cuentasPorCobrar) plus transferDestinations. `sale`/`baseInput`
 * above already carry the two mandatory additions (contract § 1.3): `creditoBase: 0`
 * and `abonos: []`/`cuentasPorCobrar: []`/`transferDestinations: []`.
 *
 * All fixtures in this suite use monedaBase "CUP" (not "USD" like the suites above)
 * so a payment line's currency and the base currency are the same by default — that
 * makes every amount here direct CUP arithmetic, with no implicit rate multiplying in,
 * except where a test is specifically about rates (criterion 4).
 */
const creditBaseInput = (over: Partial<CierreComputationInput> = {}) =>
  baseInput({
    monedaBase: "CUP",
    historialTasas: [],
    ...over,
  });

const abono = (over: {
  id?: string;
  fecha?: Date;
  tasaSnapshot?: Record<string, number> | null;
  pagosDetalle?: IPagoLinea[] | null;
}) => ({
  id: "ab-1",
  fecha: new Date("2026-09-02T20:00:00Z"),
  tasaSnapshot: null as Record<string, number> | null,
  pagosDetalle: null as IPagoLinea[] | null,
  ...over,
});

describe("computeCierreTotals — credit (F-030)", () => {
  it("a cash sale of 1000 and a credit sale of 1000 in the same period give totalVentas 2000, totalCreditoOtorgado 1000, and totalGanancia equal to the sum of the two margins (criterion 1)", () => {
    const { totals } = computeCierreTotals(
      creditBaseInput({
        ventas: [
          sale({
            id: "cash",
            productos: [line({ precio: 1000, costo: 400 })],
            pagosDetalle: [
              { tipo: "cash", moneda: "CUP", monto: 1000, equivalenteBase: 1000 },
            ],
          }),
          sale({
            id: "credit",
            creditoBase: 1000,
            productos: [line({ precio: 1000, costo: 600 })],
            pagosDetalle: [],
            vueltoDetalle: null,
          }),
        ],
      }),
    );
    expect(totals.totalVentas).toBe(2000);
    expect(totals.totalCreditoOtorgado).toBe(1000);
    // Profit is ACCRUED: the credit sale contributes its full margin (1000 - 600 = 400),
    // exactly like the cash one (1000 - 400 = 600). A wrong implementation that
    // subtracted the uncollected credit from profit would give 600 here, not 1000.
    expect(totals.totalGanancia).toBe(600 + 400);
  });

  it("ResumenMonedaCierre does NOT grow from the credit sale — identical totalEfectivo, totalTransfer and equivalenteBase with and without it (criterion 2)", () => {
    const cashOnly = sale({
      id: "cash",
      productos: [line({ precio: 500, costo: 200 })],
      pagosDetalle: [
        { tipo: "cash", moneda: "CUP", monto: 500, equivalenteBase: 500 },
      ],
    });
    const creditSale = sale({
      id: "credit",
      creditoBase: 700,
      productos: [line({ precio: 700, costo: 300 })],
      pagosDetalle: [],
      vueltoDetalle: null,
    });

    const without = computeCierreTotals(
      creditBaseInput({ ventas: [cashOnly] }),
    ).resumenMonedas;
    const withCredit = computeCierreTotals(
      creditBaseInput({ ventas: [cashOnly, creditSale] }),
    ).resumenMonedas;

    expect(withCredit).toEqual(without);
  });

  it("a cash abono of 300 in the period enters totalEfectivo and totalCobrosCredito, and does NOT enter totalVentas nor totalGanancia (criterion 3)", () => {
    const ventas = [
      sale({
        id: "cash",
        productos: [line({ precio: 500, costo: 200 })],
        pagosDetalle: [
          { tipo: "cash", moneda: "CUP", monto: 500, equivalenteBase: 500 },
        ],
      }),
    ];

    const without = computeCierreTotals(creditBaseInput({ ventas }));
    const withAbono = computeCierreTotals(
      creditBaseInput({
        ventas,
        abonos: [
          abono({
            pagosDetalle: [
              { tipo: "cash", moneda: "CUP", monto: 300, equivalenteBase: 300 },
            ],
          }),
        ],
      }),
    );

    expect(withAbono.totals.totalCobrosCredito).toBe(300);
    expect(without.totals.totalCobrosCredito).toBe(0);
    expect(withAbono.totals.totalVentas).toBe(without.totals.totalVentas);
    expect(withAbono.totals.totalGanancia).toBe(without.totals.totalGanancia);

    const cupWith = withAbono.resumenMonedas.find(
      (r) => r.monedaCode === "CUP",
    )!;
    const cupWithout = without.resumenMonedas.find(
      (r) => r.monedaCode === "CUP",
    )!;
    expect(cupWith.totalEfectivo).toBe(cupWithout.totalEfectivo + 300);
    expect(cupWith.equivalenteBase).toBe(cupWithout.equivalenteBase + 300);
  });

  it("an abono in USD is valued with its OWN tasaSnapshot, never the closing rate (criterion 4)", () => {
    // The business's rate history has USD at 680 by the closing instant (fechaFin is
    // after T_680) — that is what the abono would be worth if it were (wrongly) valued
    // with tasasCierre: 10 * 680 = 6800. Its OWN snapshot says USD was 500 the day it
    // was collected, so the right answer is 10 * 500 = 5000, and the two must differ
    // for this test to mean anything (E-008).
    const { totals, resumenMonedas } = computeCierreTotals(
      creditBaseInput({
        historialTasas, // USD @ 680 as of T_680, well before fechaFin
        abonos: [
          abono({
            tasaSnapshot: { USD: 500 },
            pagosDetalle: [
              { tipo: "cash", moneda: "USD", monto: 10, equivalenteBase: 6800 },
            ],
          }),
        ],
      }),
    );
    const usd = resumenMonedas.find((r) => r.monedaCode === "USD")!;
    expect(usd.equivalenteBase).toBe(5000);
    expect(usd.equivalenteBase).not.toBe(6800);
    expect(totals.totalCobrosCredito).toBe(5000);
  });

  it("an abono by transfer accumulates under its destination in totalTransferenciasByDestination, WITHOUT moving the totalTransferencia column (criterion 5)", () => {
    const { totals, totalTransferenciasByDestination } = computeCierreTotals(
      creditBaseInput({
        transferDestinations: [{ id: "dest-1", nombre: "Banco X" }],
        ventas: [
          sale({
            id: "v1",
            totaltransfer: 200,
            transferDestination: { id: "dest-1", nombre: "Banco X" },
            productos: [line({ precio: 200, costo: 100 })],
            pagosDetalle: [
              {
                tipo: "transfer",
                moneda: "CUP",
                monto: 200,
                equivalenteBase: 200,
                transferDestinationId: "dest-1",
              },
            ],
          }),
        ],
        abonos: [
          abono({
            pagosDetalle: [
              {
                tipo: "transfer",
                moneda: "CUP",
                monto: 150,
                equivalenteBase: 150,
                transferDestinationId: "dest-1",
              },
            ],
          }),
        ],
      }),
    );
    expect(totalTransferenciasByDestination).toEqual([
      { id: "dest-1", nombre: "Banco X", total: 200 + 150 },
    ]);
    // Deliberate asymmetry (dosier § 6 / contract § 3.3d): the COLUMN stays a sales
    // figure and does not pick up the abono, even though the per-destination
    // breakdown — the one reconciled against the bank statement — does.
    expect(totals.totalTransferencia).toBe(200);
  });

  it("an abono does NOT generate tip: totalTips, tipCash and tipTransfer do not move (criterion 6)", () => {
    const { totals, resumenMonedas } = computeCierreTotals(
      creditBaseInput({
        ventas: [],
        abonos: [
          abono({
            pagosDetalle: [
              { tipo: "cash", moneda: "CUP", monto: 300, equivalenteBase: 300 },
            ],
          }),
        ],
      }),
    );
    expect(totals.totalTips).toBe(0);
    const cup = resumenMonedas.find((r) => r.monedaCode === "CUP")!;
    // The 300 is real money in the drawer (an abono, not a tip): asserting on tipCash
    // alone would pass vacuously on an empty currency bucket.
    expect(cup.totalEfectivo).toBe(300);
    expect(cup.tipCash).toBe(0);
    expect(cup.tipTransfer).toBe(0);
  });

  it("a DEVOLUCION_VENTA fully applied to debt does not lower the drawer, while the profit reversal stays the full refund minus cost (criterion 11)", () => {
    const ventas = [
      sale({
        id: "v1",
        productos: [line({ precio: 500, costo: 200 })],
        pagosDetalle: [
          { tipo: "cash", moneda: "CUP", monto: 500, equivalenteBase: 500 },
        ],
      }),
    ];
    const devolucion = (montoAplicadoADeuda: number | null) => ({
      id: "m1",
      tipo: "DEVOLUCION_VENTA" as const,
      costoTotal: 40,
      montoReembolso: 100,
      montoOriginal: 100,
      monedaOriginal: "CUP",
      montoAplicadoADeuda,
      productoNombre: "Devuelta",
    });

    const appliedToDebt = computeCierreTotals(
      creditBaseInput({ ventas, movimientos: [devolucion(100)] }),
    );
    const refundedInCash = computeCierreTotals(
      creditBaseInput({ ventas, movimientos: [devolucion(null)] }),
    );

    const cupApplied = appliedToDebt.resumenMonedas.find(
      (r) => r.monedaCode === "CUP",
    )!;
    const cupCash = refundedInCash.resumenMonedas.find(
      (r) => r.monedaCode === "CUP",
    )!;
    // montoAplicadoADeuda === montoReembolso: nothing left the drawer.
    expect(cupApplied.totalEfectivo).toBe(500);
    // No debt portion: the full refund left the drawer, same as before this feature.
    expect(cupCash.totalEfectivo).toBe(500 - 100);

    // The margin reversal (montoReembolso - costoTotal = 60) is the same either way —
    // whether the refund went to cash or to debt has no bearing on profit.
    expect(appliedToDebt.totals.totalGananciaFinal).toBe(300 - 60);
    expect(refundedInCash.totals.totalGananciaFinal).toBe(300 - 60);

    // The SECOND caller of refundCashRatio (contract § 3.3f): the DEVOLUCION entry of
    // cajaDeducciones — the very line ADR 0105 reads `reembolsosEnEfectivo` from — has to
    // agree with resumenMonedas on how much of the refund left the drawer. It is a
    // DIFFERENT code path than applyComprasYDevolucionesToResumenMap (which only moves
    // resumenMonedas), so asserting on resumenMonedas alone does not exercise it: a
    // regression here reads as "money left the drawer" on the deductions panel while the
    // total next to it says otherwise.
    const cajaDevolucionApplied = appliedToDebt.cajaDeducciones.CUP.find(
      (d) => d.tipo === "DEVOLUCION",
    )!;
    const cajaDevolucionCash = refundedInCash.cajaDeducciones.CUP.find(
      (d) => d.tipo === "DEVOLUCION",
    )!;
    expect(cajaDevolucionApplied.monto).toBe(0);
    expect(cajaDevolucionCash.monto).toBe(100);

    // gananciaDeducciones' DEVOLUCION entry is montoReembolso - costoTotal regardless of
    // the debt split — same invariant as totalGananciaFinal above, checked on the
    // per-line panel data instead of the aggregate.
    const gananciaDevolucionApplied = appliedToDebt.gananciaDeducciones.find(
      (d) => d.tipo === "DEVOLUCION",
    )!;
    const gananciaDevolucionCash = refundedInCash.gananciaDeducciones.find(
      (d) => d.tipo === "DEVOLUCION",
    )!;
    expect(gananciaDevolucionApplied.monto).toBe(60);
    expect(gananciaDevolucionCash.monto).toBe(60);
  });

  it("the reconciliation equation holds with an initial fund, a cash sale, a credit sale, an abono, an expense and a cash purchase (criterion 12)", () => {
    const { totals, resumenMonedas } = computeCierreTotals(
      creditBaseInput({
        initialFundAmounts: { CUP: 500 },
        ventas: [
          sale({
            id: "cash",
            productos: [line({ precio: 200, costo: 80 })],
            pagosDetalle: [
              { tipo: "cash", moneda: "CUP", monto: 200, equivalenteBase: 200 },
            ],
          }),
          sale({
            id: "credit",
            creditoBase: 400,
            productos: [line({ precio: 400, costo: 150 })],
            pagosDetalle: [],
            vueltoDetalle: null,
          }),
        ],
        abonos: [
          abono({
            pagosDetalle: [
              { tipo: "cash", moneda: "CUP", monto: 150, equivalenteBase: 150 },
            ],
          }),
        ],
        gastos: [
          {
            id: "g1",
            nombre: "Gasto",
            tipoCalculo: "FIJO",
            montoCalculado: 50,
            monedaCode: "CUP",
            naturaleza: "OPERATIVO",
            esAdHoc: true,
          },
        ],
        movimientos: [
          {
            id: "m1",
            tipo: "COMPRA",
            formaPago: "EFECTIVO_CAJA",
            costoTotal: 80,
            monedaOriginal: "CUP",
            montoOriginal: 80,
            productoNombre: "Compra",
          },
        ],
      }),
    );

    expect(totals.totalVentas).toBe(600);
    expect(totals.totalCreditoOtorgado).toBe(400);
    expect(totals.totalCobrosCredito).toBe(150);
    expect(totals.totalTips).toBe(0);
    // Only one OPERATIVO gasto and no refund in this fixture, deliberately: it keeps
    // "totalGastos(caja)" and "reembolsosEnEfectivo" from the ADR 0105 equation equal to
    // totalGastos and 0 respectively, sidestepping the two precisions the contract
    // documents for a GET-shaped verification (a non-OPERATIVO gasto, or a partial
    // refund) — which is qa's job, not a pure unit test's.
    expect(totals.totalGastos).toBe(50);
    expect(totals.totalComprasCaja).toBe(80);

    const cajaTotal = resumenMonedas.reduce(
      (sum, r) => sum + r.equivalenteBase,
      0,
    );
    const reconciliation =
      500 +
      (totals.totalVentas - totals.totalCreditoOtorgado) +
      totals.totalCobrosCredito +
      totals.totalTips -
      totals.totalGastos -
      totals.totalComprasCaja -
      0; // no refund in this fixture
    expect(reconciliation).toBe(720);
    expect(cajaTotal).toBeCloseTo(reconciliation, 6);
  });

  it("an abono registered after the period's fechaFin does not move totalVentas — the invariant hasTotalsDrift (criterion 8) relies on", () => {
    const ventas = [
      sale({
        id: "cash",
        productos: [line({ precio: 500, costo: 200 })],
        pagosDetalle: [
          { tipo: "cash", moneda: "CUP", monto: 500, equivalenteBase: 500 },
        ],
      }),
    ];
    const before = computeCierreTotals(creditBaseInput({ ventas }));
    const after = computeCierreTotals(
      creditBaseInput({
        ventas,
        abonos: [
          abono({
            fecha: new Date("2026-09-10T00:00:00Z"), // after the closing instant
            pagosDetalle: [
              { tipo: "cash", moneda: "CUP", monto: 300, equivalenteBase: 300 },
            ],
          }),
        ],
      }),
    );
    expect(after.totals.totalVentas).toBe(before.totals.totalVentas);
    expect(hasTotalsDrift(before.totals.totalVentas, after.totals.totalVentas)).toBe(
      false,
    );
  });

  it("totalPorCobrarAlCierre is wired to buildCuentasPorCobrarSnapshot — a settled account does not count, an open one does (wiring check; the settledAt cutoff trap itself is in loadCierreInput.test.ts)", () => {
    const { totals } = computeCierreTotals(
      creditBaseInput({
        cuentasPorCobrar: [
          {
            id: "cxc-open",
            clienteId: "cli-1",
            clienteNombre: "Cliente 1",
            fechaVenta: new Date("2026-08-01T00:00:00Z"),
            montoOriginal: 1000,
            movimientos: [{ tipo: "ABONO", monto: 300 }],
          },
          {
            id: "cxc-settled",
            clienteId: "cli-2",
            clienteNombre: "Cliente 2",
            fechaVenta: new Date("2026-08-01T00:00:00Z"),
            montoOriginal: 1000,
            movimientos: [{ tipo: "ABONO", monto: 1000 }],
          },
        ],
      }),
    );
    // Only the open account's 700 counts; the fully settled one contributes 0.
    expect(totals.totalPorCobrarAlCierre).toBe(700);
  });
});

/**
 * F-030 § 3.2 — valueAbonos, dynamically imported: `computeCierreTotals.ts` does not
 * import Prisma, but valueAbonos itself may not exist yet while the implementer is
 * still writing it in parallel (E-019) — a static `import { valueAbonos } from "..."`
 * would crash the whole file's collection the moment that named export is missing.
 */
const computeCierreTotalsModule = await import(
  "@/lib/cierre/computeCierreTotals"
);
const valueAbonosFn = (
  computeCierreTotalsModule as {
    valueAbonos?: (
      abonos: unknown[],
      monedaBase: string,
      historialTasas: unknown[],
    ) => Array<{
      totalBase: number;
      transferBaseByDestination: Record<string, number>;
    }>;
  }
).valueAbonos;

describe("valueAbonos (F-030)", () => {
  it.skipIf(typeof valueAbonosFn !== "function")(
    "values an abono's cash line with convertToBase, ignoring whatever equivalenteBase the line carries (criterion 4/5 support)",
    () => {
      const [valued] = valueAbonosFn!(
        [
          abono({
            tasaSnapshot: { USD: 500 },
            pagosDetalle: [
              {
                tipo: "cash",
                moneda: "USD",
                monto: 10,
                // Deliberately wrong sentinel: if valueAbonos read this instead of
                // recomputing with convertToBase, totalBase would come out 999999.
                equivalenteBase: 999999,
              },
            ],
          }),
        ],
        "CUP",
        [],
      );
      expect(valued.totalBase).toBe(5000);
    },
  );

  it.skipIf(typeof valueAbonosFn !== "function")(
    "returns zero and no destinations for an abono with null/empty pagosDetalle",
    () => {
      const [nullDetail] = valueAbonosFn!([abono({ pagosDetalle: null })], "CUP", []);
      const [emptyDetail] = valueAbonosFn!([abono({ pagosDetalle: [] })], "CUP", []);
      expect(nullDetail.totalBase).toBe(0);
      expect(nullDetail.transferBaseByDestination).toEqual({});
      expect(emptyDetail.totalBase).toBe(0);
      expect(emptyDetail.transferBaseByDestination).toEqual({});
    },
  );

  it.skipIf(typeof valueAbonosFn !== "function")(
    "accumulates a transfer line under its destination, and a transfer line WITHOUT a destination still counts in totalBase but under no destination",
    () => {
      const [valued] = valueAbonosFn!(
        [
          abono({
            pagosDetalle: [
              {
                tipo: "transfer",
                moneda: "CUP",
                monto: 100,
                equivalenteBase: 100,
                transferDestinationId: "dest-1",
              },
              {
                tipo: "transfer",
                moneda: "CUP",
                monto: 40,
                equivalenteBase: 40,
              },
            ],
          }),
        ],
        "CUP",
        [],
      );
      expect(valued.totalBase).toBe(140);
      expect(valued.transferBaseByDestination).toEqual({ "dest-1": 100 });
    },
  );

  it.skipIf(typeof valueAbonosFn !== "function")(
    "skips a line of unknown tipo without contributing to totalBase, and does not warn itself (buildResumenMonedas already owns that warning)",
    () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const unknownLine = {
        tipo: "xxx",
        moneda: "CUP",
        monto: 500,
        equivalenteBase: 500,
      } as unknown as IPagoLinea;
      const [valued] = valueAbonosFn!(
        [abono({ pagosDetalle: [unknownLine] })],
        "CUP",
        [],
      );
      expect(valued.totalBase).toBe(0);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    },
  );
});
