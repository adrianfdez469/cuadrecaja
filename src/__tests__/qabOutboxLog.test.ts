import { describe, it, expect, vi, afterEach } from "vitest";
import { logQabPermanentFailure } from "@/lib/qab/qabOutboxLog";
import type { IQabPermanentFailure } from "@/schemas/qabSync";

/**
 * F-005 — `src/lib/qab/qabOutboxLog.ts` (contract §5.5). One console.error line per permanent
 * failure, carrying only ids and the error code — never the store name, never the payload,
 * following the same redaction rule as `logRouteError`.
 */

const failure: IQabPermanentFailure = {
  eventId: "42",
  negocioId: "negocio-1",
  entidad: "STORE",
  entidadId: "tienda-1",
  code: "STORE_OPENING_HOURS_INVALID",
};

describe("logQabPermanentFailure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should write exactly one line via console.error in the documented format", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQabPermanentFailure(failure);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "QAB_PERMANENT_FAILURE entidad=STORE entidadId=tienda-1 negocioId=negocio-1 code=STORE_OPENING_HOURS_INVALID eventId=42"
    );
  });

  it("should never call console.log or console.warn", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logQabPermanentFailure(failure);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should return undefined", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(logQabPermanentFailure(failure)).toBeUndefined();
  });

  it("should not leak a store name or a payload smuggled onto the arguments object", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const smuggled = {
      ...failure,
      storeName: "Bodega Secreta",
      payload: { phone: "+5350000000" },
    } as unknown as IQabPermanentFailure;

    logQabPermanentFailure(smuggled);

    const loggedArgs = errorSpy.mock.calls.flat();
    expect(loggedArgs.some((arg) => String(arg).includes("Bodega Secreta"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("+5350000000"))).toBe(false);
  });
});
