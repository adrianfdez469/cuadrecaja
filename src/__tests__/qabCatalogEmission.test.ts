import { describe, it, expect } from "vitest";
import {
  planQabProductPublishEvents,
  planQabCategoryCascade,
  planQabCurrencyFanout,
} from "@/lib/qab/qabCatalogEmission";
import type {
  IQabCatalogBootstrapState,
  IQabCategoryEmissionRow,
  IQabCurrencyEmissionRow,
  IQabExchangeRateEmissionRow,
  IQabProductEmissionRow,
} from "@/lib/qab/qabCatalogEmission";
import { QabProductPayloadError } from "@/lib/qab/qabProductPayload";
import { QAB_CATALOG_EMISSION_ORDER } from "@/constants/qab";
import type { IOutboxEventoCreate } from "@/schemas/qabOutbox";

/**
 * F-006 — `src/lib/qab/qabCatalogEmission.ts` (contract §5.1, ADR 0043). The single
 * most valuable thing to cover in this feature: the order in which events are
 * INSERTED is the only mechanism that keeps a PRODUCT from landing in QAB with an
 * unresolved category or a provisional currency (asymmetry 5), and BOTH failure
 * modes are SILENT on the other side (spec, contract §0.1). A wrong order here
 * produces a green suite and a broken feature (E-008), so every test below is
 * built so it would fail if the implementation interleaved events instead of
 * grouping them CURRENCY -> EXCHANGE_RATE -> CATEGORY -> PRODUCT.
 */

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const OCCURRED_AT = new Date("2026-09-04T10:00:00.000Z");

const CATEGORIA_BEBIDAS = "a3f1a1a1-1111-4111-8111-111111111111";
const CATEGORIA_SNACKS = "b4f2b2b2-2222-4222-8222-222222222222";

const PRODUCTO_TIENDA_1 = "c5f3c3c3-3333-4333-8333-333333333333";
const PRODUCTO_TIENDA_2 = "d6f4d4d4-4444-4444-8444-444444444444";
const TIENDA_1 = "e7f5e5e5-5555-4555-8555-555555555555";
const PRODUCTO_1 = "f8f6f6f6-6666-4666-8666-666666666666";
const PRODUCTO_2 = "09f7f7f7-7777-4777-8777-777777777777";

const NEGOCIO_B = "1af8f8f8-8888-4888-8888-888888888888";
const NEGOCIO_C = "2bf9f9f9-9999-4999-8999-999999999999";

function emptyBootstrap(): IQabCatalogBootstrapState {
  return {
    syncedCategoriaIds: new Set(),
    syncedCurrencyCodes: new Set(),
    syncedExchangeRateCodes: new Set(),
  };
}

function productRow(overrides: Partial<IQabProductEmissionRow> = {}): IQabProductEmissionRow {
  return {
    productoTiendaId: PRODUCTO_TIENDA_1,
    tiendaId: TIENDA_1,
    productoId: PRODUCTO_1,
    nombre: "Agua mineral 500 ml",
    barcodes: [],
    categoriaId: CATEGORIA_BEBIDAS,
    precio: 1.5,
    currencyCode: "CUP",
    productoCanonicoId: null,
    publicarEnTienda: true,
    ...overrides,
  };
}

const categoriaBebidas: IQabCategoryEmissionRow = {
  categoriaId: CATEGORIA_BEBIDAS,
  nombre: "Bebidas",
  color: "#1E88E5",
};
const categoriaSnacks: IQabCategoryEmissionRow = {
  categoriaId: CATEGORIA_SNACKS,
  nombre: "Snacks",
  color: null,
};

const monedaUsd: IQabCurrencyEmissionRow = {
  code: "USD",
  nombre: "US Dollar",
  simbolo: "$",
  activo: true,
};
const monedaCup: IQabCurrencyEmissionRow = {
  code: "CUP",
  nombre: "Peso Cubano",
  simbolo: "$",
  activo: true,
};

function entities(events: IOutboxEventoCreate[]): string[] {
  return events.map((event) => event.entidad);
}

describe("planQabProductPublishEvents — QAB_CATALOG_EMISSION_ORDER, criterion 11 and 13", () => {
  it("should emit CURRENCY, then CATEGORY, then PRODUCT, for a product whose category and currency have never synced", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [],
      bootstrap: emptyBootstrap(),
    });

    expect(entities(events)).toEqual(["CURRENCY", "CATEGORY", "PRODUCT"]);
  });

  it("should ALSO emit EXCHANGE_RATE, positioned between CURRENCY and CATEGORY, when a rate is available for the unsynced currency", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [{ code: "USD", tasa: 420.5 } satisfies IQabExchangeRateEmissionRow],
      bootstrap: emptyBootstrap(),
    });

    expect(entities(events)).toEqual(["CURRENCY", "EXCHANGE_RATE", "CATEGORY", "PRODUCT"]);
  });

  it("should follow QAB_CATALOG_EMISSION_ORDER's own declared sequence, read from the constant rather than hardcoded here", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [{ code: "USD", tasa: 420.5 }],
      bootstrap: emptyBootstrap(),
    });

    const seen = [...new Set(entities(events))];
    const expectedOrder = QAB_CATALOG_EMISSION_ORDER.filter((entity) => seen.includes(entity));
    expect(seen).toEqual(expectedOrder);
  });

  it("discriminating case: with TWO products of TWO DIFFERENT unsynced categories, every CATEGORY event lands before every PRODUCT event — no interleaving", () => {
    // Deliberately unordered input: product 2's category is listed FIRST in `categorias`, and
    // product 2 itself is listed FIRST in `productos`, so an implementation that emits
    // per-product (bootstrap-then-product, bootstrap-then-product) instead of grouping by
    // entity type would still pass a naive "categories exist" check but fail THIS one.
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [
        productRow({
          productoTiendaId: PRODUCTO_TIENDA_2,
          productoId: PRODUCTO_2,
          categoriaId: CATEGORIA_SNACKS,
          currencyCode: "CUP",
        }),
        productRow({ categoriaId: CATEGORIA_BEBIDAS, currencyCode: "CUP" }),
      ],
      categorias: [categoriaSnacks, categoriaBebidas],
      monedas: [monedaCup],
      tasas: [],
      bootstrap: emptyBootstrap(),
    });

    const categoryIndices = events
      .map((event, index) => (event.entidad === "CATEGORY" ? index : -1))
      .filter((index) => index >= 0);
    const productIndices = events
      .map((event, index) => (event.entidad === "PRODUCT" ? index : -1))
      .filter((index) => index >= 0);

    expect(categoryIndices.length).toBe(2);
    expect(productIndices.length).toBe(2);
    expect(Math.max(...categoryIndices)).toBeLessThan(Math.min(...productIndices));
  });

  it("should emit exactly ONE CATEGORY event for two products sharing the same unsynced category (dedup by categoriaId)", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [
        productRow({ currencyCode: "CUP" }),
        productRow({
          productoTiendaId: PRODUCTO_TIENDA_2,
          productoId: PRODUCTO_2,
          currencyCode: "CUP",
        }),
      ],
      categorias: [categoriaBebidas],
      monedas: [monedaCup],
      tasas: [],
      bootstrap: emptyBootstrap(),
    });

    expect(events.filter((event) => event.entidad === "CATEGORY")).toHaveLength(1);
    expect(events.filter((event) => event.entidad === "PRODUCT")).toHaveLength(2);
  });

  it("criterion 11, second half: should emit NO CATEGORY event when the category is already in bootstrap.syncedCategoriaIds", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "CUP" })],
      categorias: [categoriaBebidas],
      monedas: [monedaCup],
      tasas: [],
      bootstrap: {
        syncedCategoriaIds: new Set([CATEGORIA_BEBIDAS]),
        syncedCurrencyCodes: new Set(["CUP"]),
        syncedExchangeRateCodes: new Set(),
      },
    });

    expect(entities(events)).toEqual(["PRODUCT"]);
  });

  it("criterion 13, second half: should emit NO CURRENCY/EXCHANGE_RATE when the code is already synced", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [{ code: "USD", tasa: 420.5 }],
      bootstrap: {
        syncedCategoriaIds: new Set(),
        syncedCurrencyCodes: new Set(["USD"]),
        syncedExchangeRateCodes: new Set(["USD"]),
      },
    });

    expect(entities(events)).toEqual(["CATEGORY", "PRODUCT"]);
  });

  it("should NOT emit EXCHANGE_RATE for the anchor currency (CUP), even when unsynced and a rate row is supplied", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "CUP" })],
      categorias: [categoriaBebidas],
      monedas: [monedaCup],
      tasas: [{ code: "CUP", tasa: 1 }],
      bootstrap: emptyBootstrap(),
    });

    expect(entities(events)).not.toContain("EXCHANGE_RATE");
    // CURRENCY itself is NOT anchor-exempt: CUP still gets its own bootstrap CURRENCY row.
    expect(entities(events)).toContain("CURRENCY");
  });

  it("degradation: a category the planner cannot resolve (no matching row in `categorias`) emits no bootstrap event and does NOT stop the PRODUCT", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "CUP" })],
      categorias: [], // unresolved on purpose
      monedas: [monedaCup],
      tasas: [],
      bootstrap: emptyBootstrap(),
    });

    expect(entities(events)).not.toContain("CATEGORY");
    expect(entities(events)).toContain("PRODUCT");
  });

  it("degradation: an unresolved currency (no matching row in `monedas`) emits no CURRENCY/EXCHANGE_RATE and does NOT stop the PRODUCT", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "EUR" })],
      categorias: [categoriaBebidas],
      monedas: [], // unresolved on purpose
      tasas: [],
      bootstrap: emptyBootstrap(),
    });

    expect(entities(events)).not.toContain("CURRENCY");
    expect(entities(events)).not.toContain("EXCHANGE_RATE");
    expect(entities(events)).toContain("PRODUCT");
  });

  it("every event should carry negocioId === args.negocioId", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [{ code: "USD", tasa: 420.5 }],
      bootstrap: emptyBootstrap(),
    });

    expect(events.every((event) => event.negocioId === NEGOCIO_ID)).toBe(true);
  });

  it("entidadId mapping: PRODUCT -> productoTiendaId, CATEGORY -> categoriaId, CURRENCY -> code, EXCHANGE_RATE -> code", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [{ code: "USD", tasa: 420.5 }],
      bootstrap: emptyBootstrap(),
    });

    const byEntity = (entidad: string) => events.find((event) => event.entidad === entidad);

    expect(byEntity("PRODUCT")?.entidadId).toBe(PRODUCTO_TIENDA_1);
    expect(byEntity("CATEGORY")?.entidadId).toBe(CATEGORIA_BEBIDAS);
    expect(byEntity("CURRENCY")?.entidadId).toBe("USD");
    expect(byEntity("EXCHANGE_RATE")?.entidadId).toBe("USD");
  });

  it("PRODUCT's operacion is always UPDATE — a DELETE is never emitted by this feature", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "CUP", publicarEnTienda: false })],
      categorias: [categoriaBebidas],
      monedas: [monedaCup],
      tasas: [],
      bootstrap: {
        syncedCategoriaIds: new Set([CATEGORIA_BEBIDAS]),
        syncedCurrencyCodes: new Set(["CUP"]),
        syncedExchangeRateCodes: new Set(),
      },
    });

    const product = events.find((event) => event.entidad === "PRODUCT");
    expect(product?.operacion).toBe("UPDATE");
  });

  it("criterion 15: CURRENCY and EXCHANGE_RATE bootstrap events are never emitted with operacion DELETE", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [{ code: "USD", tasa: 420.5 }],
      bootstrap: emptyBootstrap(),
    });

    for (const event of events) {
      if (event.entidad === "CURRENCY" || event.entidad === "EXCHANGE_RATE") {
        expect(event.operacion).not.toBe("DELETE");
      }
    }
  });

  it("pinned (not itself required by the interface contract's prose): every lazy-bootstrap event — CURRENCY, EXCHANGE_RATE and CATEGORY alike — carries operacion CREATE, following the F-005 `emittedBefore ? UPDATE : CREATE` pattern; a bootstrap event is by definition the first one this business ever emits for that row", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [{ code: "USD", tasa: 420.5 }],
      bootstrap: emptyBootstrap(),
    });

    for (const event of events) {
      if (event.entidad !== "PRODUCT") {
        expect(event.operacion).toBe("CREATE");
      }
    }
  });

  it("discriminating case: EXCHANGE_RATE bootstrap ONLY fires for a code that ALSO gets a CURRENCY bootstrap event — an unresolved currency code (no row in `monedas`) suppresses EXCHANGE_RATE too, even though a rate row exists for it", () => {
    // Counterintuitive: the presence of a `tasas` row is not enough on its own. The planner
    // derives `currencyCodes` (the set that gets bootstrapped) filtering on `monedaByCode.has`,
    // and EXCHANGE_RATE is only built from THAT already-filtered set — matching the contract's
    // own asymmetry 5b/criterion 13 degradation (an EXCHANGE_RATE that lands without a prior
    // CURRENCY leaves the currency provisional, name === code, on the QAB side).
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "EUR" })],
      categorias: [categoriaBebidas],
      monedas: [], // EUR unresolved: no CURRENCY row supplied
      tasas: [{ code: "EUR", tasa: 415 }], // a rate row DOES exist
      bootstrap: emptyBootstrap(),
    });

    expect(entities(events)).not.toContain("CURRENCY");
    expect(entities(events)).not.toContain("EXCHANGE_RATE");
    expect(entities(events)).toContain("PRODUCT");
  });

  it("discriminating case: a currency ALREADY synced (in bootstrap.syncedCurrencyCodes) suppresses its EXCHANGE_RATE bootstrap too, even when that rate itself was never synced", () => {
    // The same coupling from the other direction: once CURRENCY bootstrapped for a code (in a
    // past call), this planner never re-derives an EXCHANGE_RATE for it through the lazy-bootstrap
    // path, regardless of `bootstrap.syncedExchangeRateCodes`.
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [productRow({ currencyCode: "USD" })],
      categorias: [categoriaBebidas],
      monedas: [monedaUsd],
      tasas: [{ code: "USD", tasa: 420.5 }],
      bootstrap: {
        syncedCategoriaIds: new Set([CATEGORIA_BEBIDAS]),
        syncedCurrencyCodes: new Set(["USD"]), // CURRENCY already bootstrapped before
        syncedExchangeRateCodes: new Set(), // but the rate itself was never synced
      },
    });

    expect(entities(events)).not.toContain("CURRENCY");
    expect(entities(events)).not.toContain("EXCHANGE_RATE");
    expect(entities(events)).toContain("PRODUCT");
  });

  it("should throw QabProductPayloadError (not return a partial array) when one product's precio is negative — the atomicity criterion 6 relies on this", () => {
    expect(() =>
      planQabProductPublishEvents({
        negocioId: NEGOCIO_ID,
        occurredAt: OCCURRED_AT,
        productos: [
          productRow({ currencyCode: "CUP" }),
          productRow({
            productoTiendaId: PRODUCTO_TIENDA_2,
            productoId: PRODUCTO_2,
            precio: -1,
            currencyCode: "CUP",
          }),
        ],
        categorias: [categoriaBebidas],
        monedas: [monedaCup],
        tasas: [],
        bootstrap: {
          syncedCategoriaIds: new Set([CATEGORIA_BEBIDAS]),
          syncedCurrencyCodes: new Set(["CUP"]),
          syncedExchangeRateCodes: new Set(),
        },
      })
    ).toThrow(QabProductPayloadError);
  });

  it("should return an empty array for an empty `productos` list, without throwing", () => {
    const events = planQabProductPublishEvents({
      negocioId: NEGOCIO_ID,
      occurredAt: OCCURRED_AT,
      productos: [],
      categorias: [],
      monedas: [],
      tasas: [],
      bootstrap: emptyBootstrap(),
    });

    expect(events).toEqual([]);
  });
});

describe("planQabCategoryCascade — criterion 17: one event per carrier, businessId built INSIDE the loop", () => {
  it("should emit one CATEGORY event per carrier business, in OutboxEvento.negocioId", () => {
    const events = planQabCategoryCascade({
      occurredAt: OCCURRED_AT,
      categoria: categoriaBebidas,
      operacion: "UPDATE",
      carrierNegocioIds: [NEGOCIO_ID, NEGOCIO_B],
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.negocioId).sort()).toEqual(
      [NEGOCIO_ID, NEGOCIO_B].sort()
    );
  });

  it("discriminating case: each event's payload.businessId matches ITS OWN carrier, never a captured outer variable — the cross-tenant bug this exists to catch", () => {
    const events = planQabCategoryCascade({
      occurredAt: OCCURRED_AT,
      categoria: categoriaBebidas,
      operacion: "UPDATE",
      carrierNegocioIds: [NEGOCIO_ID, NEGOCIO_B, NEGOCIO_C],
    });

    for (const event of events) {
      const payload = event.payload as { businessId: string };
      expect(payload.businessId).toBe(event.negocioId);
    }

    // And the three businessIds are genuinely distinct — if the loop captured one variable
    // from outside, all three payloads would carry the SAME businessId.
    const businessIds = events.map((event) => (event.payload as { businessId: string }).businessId);
    expect(new Set(businessIds).size).toBe(3);
  });

  it("should emit NOTHING for zero carriers — creating a global category has no carrier yet (criterion 17, lazy bootstrap covers it later)", () => {
    const events = planQabCategoryCascade({
      occurredAt: OCCURRED_AT,
      categoria: categoriaBebidas,
      operacion: "CREATE",
      carrierNegocioIds: [],
    });

    expect(events).toEqual([]);
  });

  it("should forward the given operacion onto every event", () => {
    const events = planQabCategoryCascade({
      occurredAt: OCCURRED_AT,
      categoria: categoriaBebidas,
      operacion: "DELETE",
      carrierNegocioIds: [NEGOCIO_ID],
    });

    expect(events[0]?.operacion).toBe("DELETE");
  });

  it("entidadId should be Categoria.id for every carrier", () => {
    const events = planQabCategoryCascade({
      occurredAt: OCCURRED_AT,
      categoria: categoriaBebidas,
      operacion: "UPDATE",
      carrierNegocioIds: [NEGOCIO_ID, NEGOCIO_B],
    });

    expect(events.every((event) => event.entidadId === CATEGORIA_BEBIDAS)).toBe(true);
  });
});

describe("planQabCurrencyFanout — ADR 0044: identical payload, only OutboxEvento.negocioId varies", () => {
  it("should emit one CURRENCY event per carrier, with the SAME payload (no businessId to distinguish them)", () => {
    const events = planQabCurrencyFanout({
      occurredAt: OCCURRED_AT,
      moneda: monedaUsd,
      carrierNegocioIds: [NEGOCIO_ID, NEGOCIO_B],
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.payload).toEqual(events[1]?.payload);
    expect(events.map((event) => event.negocioId).sort()).toEqual(
      [NEGOCIO_ID, NEGOCIO_B].sort()
    );
  });

  it("payload should NOT declare a businessId key at all", () => {
    const events = planQabCurrencyFanout({
      occurredAt: OCCURRED_AT,
      moneda: monedaUsd,
      carrierNegocioIds: [NEGOCIO_ID],
    });

    expect(events[0]?.payload).not.toHaveProperty("businessId");
  });

  it("criterion 15: operacion is ALWAYS UPDATE, even when retiring a currency (moneda.activo === false)", () => {
    const events = planQabCurrencyFanout({
      occurredAt: OCCURRED_AT,
      moneda: { ...monedaUsd, activo: false },
      carrierNegocioIds: [NEGOCIO_ID],
    });

    expect(events[0]?.operacion).toBe("UPDATE");
  });

  it("should emit NOTHING for zero carriers", () => {
    const events = planQabCurrencyFanout({
      occurredAt: OCCURRED_AT,
      moneda: monedaUsd,
      carrierNegocioIds: [],
    });

    expect(events).toEqual([]);
  });

  it("entidadId should be Moneda.code for every carrier", () => {
    const events = planQabCurrencyFanout({
      occurredAt: OCCURRED_AT,
      moneda: monedaUsd,
      carrierNegocioIds: [NEGOCIO_ID, NEGOCIO_B],
    });

    expect(events.every((event) => event.entidadId === "USD")).toBe(true);
  });
});
