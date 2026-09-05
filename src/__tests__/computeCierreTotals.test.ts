import { describe, expect, it } from "vitest";
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
