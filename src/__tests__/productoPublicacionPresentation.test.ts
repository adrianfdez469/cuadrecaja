import { describe, it, expect } from "vitest";
import {
  productoPublicacionPresentation,
  visibilidadParcialLine,
  precioLine,
  payloadRejectedMessage,
  productoPublicacionMessage,
  bulkPublicacionMessage,
  categoriaStripCount,
  bulkDialogTitle,
  PRECIO_SIN_LOCAL,
  PRECIO_MONEDAS_DISTINTAS,
} from "@/components/tiendaOnline/productoPublicacionPresentation";
import type { IPublicacionScope } from "@/components/tiendaOnline/productoPublicacionPresentation";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { QAB_CATALOG_EMISSION_ERRORS } from "@/constants/qab";
import type {
  ITiendaOnlineProducto,
  ITiendaOnlineProductoTienda,
} from "@/schemas/tiendaOnline";

/**
 * F-006 — `src/components/tiendaOnline/productoPublicacionPresentation.ts`.
 *
 * NOT listed in the arch-guardian "Contrato de interfaces" (§8.2 table of
 * testable symbols) — only described in prose, without exact signatures, in
 * `.agents/designs/F-006.md` §4/§5/§6/"Piezas nuevas". Written now that the
 * implementer's real module exists and its exact exported signatures can be
 * read directly (there is no other source for them), but the BEHAVIOUR
 * asserted below is taken from the design contract's own tables (the state
 * ladder of §4, the partial-visibility line, the price line, and the §6 error
 * translation table) — never from what the implementation happens to do.
 *
 * Acceptance criterion 7 (spec) is the one this file exists to protect:
 * "esperando al local" (`skipped_not_published` on the wire) is NOT an error,
 * and "falló el envío" IS one. Every ladder test below asserts both the
 * label AND the `hue`, because a test that only checked the label would stay
 * green if the two were collapsed onto the same tint (E-008).
 */

function tienda(
  overrides: Partial<ITiendaOnlineProductoTienda> = {},
): ITiendaOnlineProductoTienda {
  return {
    productoTiendaId: "aaaaaaaa-0000-4000-8000-000000000001",
    tiendaId: "bbbbbbbb-0000-4000-8000-000000000001",
    tiendaNombre: "Local Centro",
    precio: 1.5,
    monedaCode: "CUP",
    tiendaPublicada: true,
    ...overrides,
  };
}

function producto(
  overrides: Partial<ITiendaOnlineProducto> = {},
): ITiendaOnlineProducto {
  return {
    id: "cccccccc-0000-4000-8000-000000000001",
    nombre: "Agua mineral 500 ml",
    categoriaId: "dddddddd-0000-4000-8000-000000000001",
    categoriaNombre: "Bebidas",
    publicarEnTienda: true,
    barcodes: [],
    tiendas: [tienda()],
    syncState: { state: "SYNCED", code: null, attempts: 0, since: null },
    ...overrides,
  };
}

describe("productoPublicacionPresentation — the seven-state ladder, contract §4", () => {
  it("state 1 — BLOCKED: «No se pudo enviar», hue negative, no icon, the retries-exhausted reason", () => {
    const result = productoPublicacionPresentation(
      producto({
        syncState: {
          state: "BLOCKED",
          code: "STORE_OPENING_HOURS_INVALID",
          attempts: 6,
          since: null,
        },
      }),
    );

    expect(result).toEqual({
      label: "No se pudo enviar",
      hue: "negative",
      icon: "none",
      reason: "Se agotaron los intentos de envío a la tienda online.",
    });
  });

  it("state 2 — FAILED: «Falló el envío», hue caution — NOT the same hue as BLOCKED (criterion 7 depends on this distinction)", () => {
    const result = productoPublicacionPresentation(
      producto({
        syncState: { state: "FAILED", code: "TRANSPORT", attempts: 2, since: null },
      }),
    );

    expect(result).toEqual({
      label: "Falló el envío",
      hue: "caution",
      icon: "none",
      reason: "El último envío no se pudo completar; se sigue reintentando.",
    });
    expect(result.hue).not.toBe("negative");
  });

  it("state 3 — PENDING: «Enviando», hue info, no reason", () => {
    const result = productoPublicacionPresentation(
      producto({ syncState: { state: "PENDING", code: null, attempts: 0, since: null } }),
    );

    expect(result).toEqual({
      label: "Enviando",
      hue: "info",
      icon: "none",
      reason: "",
    });
  });

  it("state 4 — publicarEnTienda false: «Sin publicar», hue neutral, no icon, no reason", () => {
    const result = productoPublicacionPresentation(producto({ publicarEnTienda: false }));

    expect(result).toEqual({
      label: "Sin publicar",
      hue: "neutral",
      icon: "none",
      reason: "",
    });
  });

  it("state 5 — Sin local: a product marked but with ZERO ProductoTienda rows gets its own label, icon and reason — never confused with «Esperando al local»", () => {
    const result = productoPublicacionPresentation(producto({ tiendas: [] }));

    expect(result).toEqual({
      label: "Sin local",
      hue: "neutral",
      icon: "linkOff",
      reason:
        "Está marcado, pero no existe en ningún local, así que no hay nada que enviar.",
    });
  });

  it("state 6 — Esperando al local: marked, has store rows, but NONE published — neutral, NOT caution (criterion 7)", () => {
    const result = productoPublicacionPresentation(
      producto({ tiendas: [tienda({ tiendaPublicada: false })] }),
    );

    expect(result).toEqual({
      label: "Esperando al local",
      hue: "neutral",
      icon: "storefront",
      reason:
        "Ya está marcado. Se va a ver cuando publiques el local en la tienda online.",
    });
  });

  it("state 5 vs state 6 discriminate from each other despite sharing hue neutral: different label AND different icon", () => {
    const sinLocal = productoPublicacionPresentation(producto({ tiendas: [] }));
    const esperando = productoPublicacionPresentation(
      producto({ tiendas: [tienda({ tiendaPublicada: false })] }),
    );

    expect(sinLocal.label).not.toBe(esperando.label);
    expect(sinLocal.icon).not.toBe(esperando.icon);
    expect(sinLocal.hue).toBe("neutral");
    expect(esperando.hue).toBe("neutral");
  });

  it("state 7 — Publicado: marked, at least one store row published — positive, no icon, no reason", () => {
    const result = productoPublicacionPresentation(
      producto({
        tiendas: [tienda({ tiendaPublicada: false }), tienda({ tiendaPublicada: true })],
      }),
    );

    expect(result).toEqual({
      label: "Publicado",
      hue: "positive",
      icon: "none",
      reason: "",
    });
  });

  it("every one of the six DISTINCT hue/label pairs is pairwise different — no two states collapse onto the same (label, hue)", () => {
    const scenarios: ITiendaOnlineProducto[] = [
      producto({ syncState: { state: "BLOCKED", code: null, attempts: 6, since: null } }),
      producto({ syncState: { state: "FAILED", code: null, attempts: 1, since: null } }),
      producto({ syncState: { state: "PENDING", code: null, attempts: 0, since: null } }),
      producto({ publicarEnTienda: false }),
      producto({ tiendas: [] }),
      producto({ tiendas: [tienda({ tiendaPublicada: false })] }),
      producto({ tiendas: [tienda({ tiendaPublicada: true })] }),
    ];

    const pairs = scenarios.map((p) => {
      const r = productoPublicacionPresentation(p);
      return `${r.label}::${r.hue}`;
    });

    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("precedence: BLOCKED wins even when publicarEnTienda is false and tiendas is empty — sync state is checked FIRST", () => {
    const result = productoPublicacionPresentation(
      producto({
        publicarEnTienda: false,
        tiendas: [],
        syncState: { state: "BLOCKED", code: null, attempts: 6, since: null },
      }),
    );

    expect(result.label).toBe("No se pudo enviar");
  });

  it("precedence: FAILED wins over an unmarked/no-store product", () => {
    const result = productoPublicacionPresentation(
      producto({
        publicarEnTienda: false,
        syncState: { state: "FAILED", code: null, attempts: 1, since: null },
      }),
    );

    expect(result.label).toBe("Falló el envío");
  });

  it("precedence: Sin publicar wins over Sin local — an unmarked product with no stores is «Sin publicar», not «Sin local»", () => {
    const result = productoPublicacionPresentation(
      producto({ publicarEnTienda: false, tiendas: [] }),
    );

    expect(result.label).toBe("Sin publicar");
  });
});

describe("visibilidadParcialLine — contract §4, «Se ve en {K} de {M} locales.»", () => {
  it("returns null when publicarEnTienda is false", () => {
    expect(
      visibilidadParcialLine(producto({ publicarEnTienda: false, tiendas: [] })),
    ).toBeNull();
  });

  it("returns null when there are no store rows at all", () => {
    expect(visibilidadParcialLine(producto({ tiendas: [] }))).toBeNull();
  });

  it("returns null when ALL store rows are published", () => {
    expect(
      visibilidadParcialLine(
        producto({
          tiendas: [tienda({ tiendaPublicada: true }), tienda({ tiendaPublicada: true })],
        }),
      ),
    ).toBeNull();
  });

  it("returns null when NONE of the store rows are published (that case reads as «Esperando al local», not partial visibility)", () => {
    expect(
      visibilidadParcialLine(
        producto({
          tiendas: [tienda({ tiendaPublicada: false }), tienda({ tiendaPublicada: false })],
        }),
      ),
    ).toBeNull();
  });

  it("returns «Se ve en 1 de 2 locales.» for one-of-two published — a SINGULAR count with a form that never itself goes singular", () => {
    const line = visibilidadParcialLine(
      producto({
        tiendas: [tienda({ tiendaPublicada: true }), tienda({ tiendaPublicada: false })],
      }),
    );

    expect(line).toBe("Se ve en 1 de 2 locales.");
  });

  it("returns «Se ve en 2 de 3 locales.» for two-of-three published", () => {
    const line = visibilidadParcialLine(
      producto({
        tiendas: [
          tienda({ tiendaPublicada: true }),
          tienda({ tiendaPublicada: true }),
          tienda({ tiendaPublicada: false }),
        ],
      }),
    );

    expect(line).toBe("Se ve en 2 de 3 locales.");
  });
});

describe("precioLine — contract §5, the price line", () => {
  it("returns PRECIO_SIN_LOCAL (em dash) for zero store rows", () => {
    expect(precioLine([])).toBe(PRECIO_SIN_LOCAL);
    expect(PRECIO_SIN_LOCAL).toBe("—");
  });

  it("returns the single formatted amount for one store row", () => {
    expect(precioLine([tienda({ precio: 1.5, monedaCode: "CUP" })])).toBe(
      formatMontoEnMoneda(1.5, "CUP"),
    );
  });

  it("discriminating case: SAME price, SAME currency, across two locals — collapses to ONE amount, not a range", () => {
    const line = precioLine([
      tienda({ precio: 2, monedaCode: "USD" }),
      tienda({ precio: 2, monedaCode: "USD" }),
    ]);

    expect(line).toBe(formatMontoEnMoneda(2, "USD"));
    expect(line).not.toContain("–");
  });

  it("DIFFERENT prices, same currency — a min–max range, joined with the en dash used by the module", () => {
    const line = precioLine([
      tienda({ precio: 2.75, monedaCode: "USD" }),
      tienda({ precio: 1.5, monedaCode: "USD" }),
    ]);

    expect(line).toBe(
      `${formatMontoEnMoneda(1.5, "USD")} – ${formatMontoEnMoneda(2.75, "USD")}`,
    );
  });

  it("different currencies across locals — PRECIO_MONEDAS_DISTINTAS, regardless of whether the prices happen to match", () => {
    const line = precioLine([
      tienda({ precio: 1.5, monedaCode: "CUP" }),
      tienda({ precio: 1.5, monedaCode: "USD" }),
    ]);

    expect(line).toBe(PRECIO_MONEDAS_DISTINTAS);
    expect(PRECIO_MONEDAS_DISTINTAS).toBe("Precios distintos por local");
  });
});

describe("payloadRejectedMessage — contract §6, the 409 QAB_PAYLOAD_INVALID translation table", () => {
  it("QAB_PRICE_INVALID + producto scope", () => {
    expect(
      payloadRejectedMessage(QAB_CATALOG_EMISSION_ERRORS.priceInvalid, "producto"),
    ).toBe("Hay un precio que la tienda online no acepta. El producto se quedó como estaba.");
  });

  it("QAB_CURRENCY_CODE_INVALID + categoria scope", () => {
    expect(
      payloadRejectedMessage(QAB_CATALOG_EMISSION_ERRORS.currencyCodeInvalid, "categoria"),
    ).toBe("Hay una moneda que la tienda online no reconoce. Ninguno de los productos cambió.");
  });

  it("QAB_EXCHANGE_RATE_TOO_SMALL + producto scope", () => {
    expect(
      payloadRejectedMessage(QAB_CATALOG_EMISSION_ERRORS.exchangeRateTooSmall, "producto"),
    ).toBe(
      "La tasa de cambio registrada es demasiado pequeña para la tienda online. El producto se quedó como estaba.",
    );
  });

  it("an unrecognized code falls into the fallback sentence, never showing the code itself", () => {
    const message = payloadRejectedMessage("SOME_UNKNOWN_CODE", "producto");

    expect(message).toBe("La tienda online no aceptó estos datos. El producto se quedó como estaba.");
    expect(message).not.toContain("SOME_UNKNOWN_CODE");
    expect(message).not.toContain("409");
  });

  it("discriminating case: the SAME code produces a DIFFERENT tail depending on scope", () => {
    const scopes: IPublicacionScope[] = ["producto", "categoria"];
    const messages = scopes.map((scope) =>
      payloadRejectedMessage(QAB_CATALOG_EMISSION_ERRORS.priceInvalid, scope),
    );

    expect(messages[0]).not.toBe(messages[1]);
    expect(messages[0]).toContain("El producto se quedó como estaba.");
    expect(messages[1]).toContain("Ninguno de los productos cambió.");
  });

  it("never leaks any raw code, including the ones it DOES recognize", () => {
    const codes = Object.values(QAB_CATALOG_EMISSION_ERRORS);
    for (const code of codes) {
      const message = payloadRejectedMessage(code, "producto");
      expect(message).not.toContain(code);
    }
  });
});

describe("productoPublicacionMessage — contract §5, the single-switch toast, three branches for «se marcó»", () => {
  it("unmarking a product", () => {
    expect(
      productoPublicacionMessage(producto({ nombre: "Ron", publicarEnTienda: false })),
    ).toBe("Se quitó «Ron» de la tienda online. El cambio llega en unos minutos.");
  });

  it("marking a product with no store rows at all", () => {
    expect(
      productoPublicacionMessage(producto({ nombre: "Ron", tiendas: [] })),
    ).toBe(
      "Se marcó «Ron». Todavía no está en ningún local, así que no se envió nada a la tienda online.",
    );
  });

  it("marking a product whose stores exist but none is published", () => {
    expect(
      productoPublicacionMessage(
        producto({ nombre: "Ron", tiendas: [tienda({ tiendaPublicada: false })] }),
      ),
    ).toBe("Se marcó «Ron». Se va a ver cuando publiques el local en la tienda online.");
  });

  it("marking a product with at least one published store", () => {
    expect(
      productoPublicacionMessage(
        producto({ nombre: "Ron", tiendas: [tienda({ tiendaPublicada: true })] }),
      ),
    ).toBe("Se marcó «Ron». Llega a tu tienda online en unos minutos.");
  });

  it("the three «se marcó» branches are pairwise distinct — collapsing any two would hide from the merchant which reality they are in", () => {
    const noStores = productoPublicacionMessage(producto({ nombre: "X", tiendas: [] }));
    const waiting = productoPublicacionMessage(
      producto({ nombre: "X", tiendas: [tienda({ tiendaPublicada: false })] }),
    );
    const live = productoPublicacionMessage(
      producto({ nombre: "X", tiendas: [tienda({ tiendaPublicada: true })] }),
    );

    expect(new Set([noStores, waiting, live]).size).toBe(3);
  });
});

describe("bulkPublicacionMessage — contract §head/middle/tail bulk toast", () => {
  it("zero changed products: the «nothing to change» sentence, no head/middle/tail joinery", () => {
    expect(
      bulkPublicacionMessage({
        productos: 0,
        total: 5,
        categoriaNombre: "Bebidas",
        publicar: true,
      }),
    ).toBe("No hubo nada que cambiar: los productos de «Bebidas» ya estaban así.");
  });

  it("singular, publicar true, productos === total: no middle sentence", () => {
    expect(
      bulkPublicacionMessage({ productos: 1, total: 1, categoriaNombre: "Bebidas", publicar: true }),
    ).toBe("Se marcó 1 producto. Los cambios llegan a tu tienda online en unos minutos.");
  });

  it("singular, publicar false", () => {
    expect(
      bulkPublicacionMessage({ productos: 1, total: 1, categoriaNombre: "Bebidas", publicar: false }),
    ).toBe("Se quitó 1 producto. Los cambios llegan a tu tienda online en unos minutos.");
  });

  it("plural, publicar true, productos === total: no middle sentence", () => {
    expect(
      bulkPublicacionMessage({ productos: 5, total: 5, categoriaNombre: "Bebidas", publicar: true }),
    ).toBe("Se marcaron 5 productos. Los cambios llegan a tu tienda online en unos minutos.");
  });

  it("plural, publicar false", () => {
    expect(
      bulkPublicacionMessage({ productos: 5, total: 5, categoriaNombre: "Bebidas", publicar: false }),
    ).toBe("Se quitaron 5 productos. Los cambios llegan a tu tienda online en unos minutos.");
  });

  it("productos < total: the middle sentence appears — this is the case a stale dialog `total` needs (§6, BULK_TOO_LARGE context)", () => {
    expect(
      bulkPublicacionMessage({ productos: 7, total: 12, categoriaNombre: "Bebidas", publicar: true }),
    ).toBe(
      "Se marcaron 7 productos. Los demás ya estaban así. Los cambios llegan a tu tienda online en unos minutos.",
    );
  });

  it("singular with productos < total also gets the middle sentence", () => {
    expect(
      bulkPublicacionMessage({ productos: 1, total: 3, categoriaNombre: "Bebidas", publicar: true }),
    ).toBe(
      "Se marcó 1 producto. Los demás ya estaban así. Los cambios llegan a tu tienda online en unos minutos.",
    );
  });
});

describe("categoriaStripCount — E-016: never «1 productos»", () => {
  it("singular", () => {
    expect(categoriaStripCount("Bebidas", 1)).toBe("«Bebidas» · 1 producto");
  });

  it("plural, including zero (which the strip never actually calls with, but the branch itself must not go singular)", () => {
    expect(categoriaStripCount("Bebidas", 2)).toBe("«Bebidas» · 2 productos");
    expect(categoriaStripCount("Bebidas", 0)).toBe("«Bebidas» · 0 productos");
  });
});

describe("bulkDialogTitle", () => {
  it("singular, publicar true", () => {
    expect(bulkDialogTitle(1, true)).toBe("Publicar 1 producto en la tienda online");
  });

  it("singular, publicar false", () => {
    expect(bulkDialogTitle(1, false)).toBe("Quitar 1 producto de la tienda online");
  });

  it("plural, publicar true", () => {
    expect(bulkDialogTitle(5, true)).toBe("Publicar 5 productos en la tienda online");
  });

  it("plural, publicar false", () => {
    expect(bulkDialogTitle(5, false)).toBe("Quitar 5 productos de la tienda online");
  });
});
