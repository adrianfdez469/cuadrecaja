import { describe, it, expect } from "vitest";
import {
  classifySyncFailure,
  describeInsufficientStock,
  getInsufficientStockItems,
  isPermanentSyncError,
  shouldRetrySyncFailure,
} from "@/app/pos/utils/syncErrors";
import { MAX_SYNC_ATTEMPTS } from "@/constants/pos";

/** What `createSell` rejects with: the mapped message, plus the response. */
function sellError(
  message: string,
  status?: number,
  serverError?: string,
): Error & { response?: unknown } {
  const error = new Error(message) as Error & { response?: unknown };
  if (status !== undefined) {
    error.response = { status, data: { error: serverError } };
  }
  return error;
}

describe("isPermanentSyncError", () => {
  it.each([400, 401, 403, 404, 409, 422])(
    "parks the sale on HTTP %s",
    (status) => {
      expect(isPermanentSyncError({ response: { status } })).toBe(true);
    },
  );

  it.each([408, 429])("keeps retrying on HTTP %s", (status) => {
    expect(isPermanentSyncError({ response: { status } })).toBe(false);
  });

  it.each([500, 502, 503, 504])(
    "keeps retrying on HTTP %s — that is what the offline queue is for",
    (status) => {
      expect(isPermanentSyncError({ response: { status } })).toBe(false);
    },
  );

  it("keeps retrying a network failure with no response at all", () => {
    expect(isPermanentSyncError(new Error("Network Error"))).toBe(false);
    expect(isPermanentSyncError({ response: undefined })).toBe(false);
  });

  it("does not throw on null or undefined", () => {
    expect(isPermanentSyncError(null)).toBe(false);
    expect(isPermanentSyncError(undefined)).toBe(false);
  });

  it("ignores a non-numeric status", () => {
    expect(isPermanentSyncError({ response: { status: "400" } })).toBe(false);
  });
});

describe("classifySyncFailure", () => {
  it("reads the stock refusal out of the 500 it arrives in", () => {
    expect(
      classifySyncFailure(
        sellError(
          "SERVER_ERROR: Existencia insuficiente para realizar la venta de productoTiendaId: pt-1",
          500,
        ),
      ),
    ).toBe("insufficient_stock");
  });

  it("also reads it from the server payload alone", () => {
    expect(
      classifySyncFailure(
        sellError("Request failed", 500, "Existencia insuficiente para X"),
      ),
    ).toBe("insufficient_stock");
  });

  it("recognizes a sale that no longer belongs to the open period", () => {
    expect(
      classifySyncFailure(
        sellError(
          "CLIENT_ERROR: La venta fue creada fuera del período actual.",
          400,
        ),
      ),
    ).toBe("wrong_period");
  });

  it.each([
    ["TIMEOUT_ERROR: La petición tardó demasiado", "timeout"],
    ["NETWORK_ERROR: Error de conexión de red", "network"],
    ["SERVER_ERROR: Error interno del servidor", "server"],
    ["CLIENT_ERROR: Error en los datos enviados", "client"],
  ])("maps %s", (message, expected) => {
    expect(classifySyncFailure(sellError(message))).toBe(expected);
  });

  it("falls back to unknown, and does not throw on nothing", () => {
    expect(classifySyncFailure(new Error("boom"))).toBe("unknown");
    expect(classifySyncFailure(null)).toBe("unknown");
    expect(classifySyncFailure(undefined)).toBe("unknown");
  });
});

describe("shouldRetrySyncFailure", () => {
  it("never retries a sale the store cannot cover, not even on the first try", () => {
    expect(
      shouldRetrySyncFailure(
        sellError("SERVER_ERROR: Existencia insuficiente para X", 500),
        1,
      ),
    ).toBe(false);
  });

  it("never retries a sale from another period", () => {
    expect(
      shouldRetrySyncFailure(
        sellError("CLIENT_ERROR: fuera del período actual", 400),
        1,
      ),
    ).toBe(false);
  });

  it("never retries any other 4xx", () => {
    expect(shouldRetrySyncFailure(sellError("CLIENT_ERROR: qué", 422), 1)).toBe(
      false,
    );
  });

  it("retries a transient failure while attempts are left", () => {
    const error = sellError("SERVER_ERROR: Error interno del servidor", 500);
    expect(shouldRetrySyncFailure(error, 1)).toBe(true);
    expect(shouldRetrySyncFailure(error, MAX_SYNC_ATTEMPTS - 1)).toBe(true);
  });

  it("parks it once the attempts run out — that is what makes it finite", () => {
    const error = sellError("NETWORK_ERROR: Error de conexión de red");
    expect(shouldRetrySyncFailure(error, MAX_SYNC_ATTEMPTS)).toBe(false);
    expect(shouldRetrySyncFailure(error, MAX_SYNC_ATTEMPTS + 3)).toBe(false);
  });

  it("keeps retrying the two 4xx that mean «later», not «never»", () => {
    expect(shouldRetrySyncFailure(sellError("CLIENT_ERROR", 408), 1)).toBe(
      true,
    );
    expect(shouldRetrySyncFailure(sellError("CLIENT_ERROR", 429), 1)).toBe(
      true,
    );
  });

  it("sends the sale exactly MAX_SYNC_ATTEMPTS times, no more", () => {
    const error = sellError("SERVER_ERROR: Error interno del servidor", 500);
    const enviadas = Array.from(
      { length: MAX_SYNC_ATTEMPTS + 2 },
      (_, i) => i + 1,
    ).filter(
      (intento) => intento === 1 || shouldRetrySyncFailure(error, intento - 1),
    );
    expect(enviadas).toHaveLength(MAX_SYNC_ATTEMPTS);
  });
});

describe("getInsufficientStockItems", () => {
  const faltantes = [
    {
      productoTiendaId: "pt-1",
      nombre: "Cerveza",
      solicitada: 5,
      disponible: 2,
    },
    { productoTiendaId: "pt-2", nombre: "Ron", solicitada: 3, disponible: 0 },
  ];

  it("returns what the server listed", () => {
    const error = sellError("CLIENT_ERROR: Existencia insuficiente", 409);
    error.response = {
      status: 409,
      data: { error: "Existencia insuficiente", faltantes },
    };
    expect(getInsufficientStockItems(error)).toEqual(faltantes);
  });

  it("is empty when the server said nothing — an older one, or another error", () => {
    expect(
      getInsufficientStockItems(
        sellError("SERVER_ERROR: Existencia insuficiente para pt-1", 500),
      ),
    ).toEqual([]);
    expect(getInsufficientStockItems(new Error("boom"))).toEqual([]);
    expect(getInsufficientStockItems(null)).toEqual([]);
  });

  it("rejects a malformed list rather than half-reading it", () => {
    const error = new Error("x") as Error & { response?: unknown };
    error.response = {
      status: 409,
      data: { faltantes: [{ nombre: "Cerveza" }] },
    };
    expect(getInsufficientStockItems(error)).toEqual([]);
  });
});

describe("describeInsufficientStock", () => {
  it("names every product with what was asked and what there was", () => {
    expect(
      describeInsufficientStock([
        {
          productoTiendaId: "pt-1",
          nombre: "Cerveza",
          solicitada: 5,
          disponible: 2,
        },
        {
          productoTiendaId: "pt-2",
          nombre: "Ron",
          solicitada: 3,
          disponible: 0,
        },
      ]),
    ).toBe("Cerveza: pide 5, hay 2 · Ron: pide 3, hay 0");
  });

  it("is empty with nothing to describe, so the caller can just append it", () => {
    expect(describeInsufficientStock([])).toBe("");
  });
});
