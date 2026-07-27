import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizarRespuestaEltoque } from "@/lib/eltoque";

/**
 * La spec OpenAPI de elTOQUE no documenta el cuerpo del 200, así que el normalizador
 * es la pieza que nos protege de cualquier cambio o sorpresa en su respuesta.
 * Estos tests fijan ese contrato defensivo.
 */
describe("normalizarRespuestaEltoque", () => {
  beforeEach(() => {
    // El normalizador loguea los casos de descarte; no ensuciar la salida de los tests.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("traduce ECU a EUR y conserva USD y MLC", () => {
    const res = normalizarRespuestaEltoque({
      tasas: { USD: 440, ECU: 500, MLC: 210 },
      date: "2026-07-27",
      hour: 10,
      minutes: 34,
      seconds: 15,
    });

    expect(res?.tasas).toEqual({ USD: 440, EUR: 500, MLC: 210 });
  });

  it("acepta EUR directamente por si elTOQUE migra a ISO 4217", () => {
    const res = normalizarRespuestaEltoque({ tasas: { EUR: 500 } });
    expect(res?.tasas).toEqual({ EUR: 500 });
  });

  it("descarta las criptomonedas, que no están en el catálogo del sistema", () => {
    const res = normalizarRespuestaEltoque({
      tasas: { USD: 440, BTC: 12000000, TRX: 130, USDT_TRC20: 435, BNB: 900 },
    });

    expect(res?.tasas).toEqual({ USD: 440 });
  });

  it("descarta valores no positivos", () => {
    const res = normalizarRespuestaEltoque({
      tasas: { USD: 440, MLC: 0, EUR: -5 },
    });
    expect(res?.tasas).toEqual({ USD: 440 });
  });

  it("compone fechaDato con la fecha y hora reportadas por la fuente", () => {
    const res = normalizarRespuestaEltoque({
      tasas: { USD: 440 },
      date: "2026-07-27",
      hour: 9,
      minutes: 5,
      seconds: 3,
    });

    expect(res?.fechaDato.getFullYear()).toBe(2026);
    expect(res?.fechaDato.getMonth()).toBe(6); // julio
    expect(res?.fechaDato.getDate()).toBe(27);
    expect(res?.fechaDato.getHours()).toBe(9);
    expect(res?.fechaDato.getMinutes()).toBe(5);
  });

  it("cae a la fecha actual si la fuente no reporta fecha", () => {
    const antes = Date.now();
    const res = normalizarRespuestaEltoque({ tasas: { USD: 440 } });

    expect(res).not.toBeNull();
    expect(res!.fechaDato.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("cae a la fecha actual si la fecha reportada es inválida", () => {
    const res = normalizarRespuestaEltoque({
      tasas: { USD: 440 },
      date: "no-es-fecha",
    });
    expect(res?.fechaDato.getTime()).not.toBeNaN();
  });

  it("devuelve null si la respuesta no tiene la forma esperada", () => {
    expect(normalizarRespuestaEltoque({ rates: { USD: 440 } })).toBeNull();
    expect(normalizarRespuestaEltoque(null)).toBeNull();
    expect(normalizarRespuestaEltoque({ tasas: { USD: "440" } })).toBeNull();
  });

  it("devuelve null si no queda ninguna moneda del catálogo, para no cachear un snapshot vacío", () => {
    // Cachear {} bloquearía los reintentos durante todo el TTL.
    expect(
      normalizarRespuestaEltoque({ tasas: { BTC: 12000000, TRX: 130 } }),
    ).toBeNull();
    expect(normalizarRespuestaEltoque({ tasas: {} })).toBeNull();
  });
});
