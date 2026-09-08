import { describe, it, expect } from "vitest";
import { buildMonedaOptions, monedaSimbolo } from "@/utils/monedas";

/**
 * The bug these cover: `NegocioMoneda` holds only the EXTRA currencies of a
 * business, so a business with base CUP and USD enabled has exactly ONE row.
 * Every screen that showed `rows.length > 1` hid its currency selector.
 */
describe("buildMonedaOptions", () => {
  const usd = {
    monedaCode: "USD",
    admiteEfectivo: true,
    moneda: { nombre: "Dólar", simbolo: "$" },
  };

  it("adds the base currency, which has no NegocioMoneda row of its own", () => {
    const options = buildMonedaOptions([usd], "CUP");

    expect(options.map((m) => m.monedaCode)).toEqual(["CUP", "USD"]);
  });

  it("yields more than one option for base + one extra — the case that hid the selector", () => {
    expect(buildMonedaOptions([usd], "CUP").length).toBe(2);
  });

  it("puts the base first so it can be the default", () => {
    const eur = { monedaCode: "EUR", admiteEfectivo: true };
    expect(
      buildMonedaOptions([usd, eur], "EUR").map((m) => m.monedaCode),
    ).toEqual(["EUR", "USD"]);
  });

  it("does not duplicate the base when it does have a row", () => {
    const cup = {
      monedaCode: "CUP",
      admiteEfectivo: true,
      moneda: { nombre: "Peso cubano", simbolo: "$" },
    };
    const options = buildMonedaOptions([cup, usd], "CUP");

    expect(options.map((m) => m.monedaCode)).toEqual(["CUP", "USD"]);
    expect(options[0].moneda?.nombre).toBe("Peso cubano");
  });

  it("assumes the base takes cash — the drawer is counted in it", () => {
    expect(buildMonedaOptions([usd], "CUP")[0].admiteEfectivo).toBe(true);
  });

  it("returns a single option when the business has no extra currency", () => {
    expect(buildMonedaOptions([], "CUP").map((m) => m.monedaCode)).toEqual([
      "CUP",
    ]);
  });

  it("survives an empty context: no base yet, nothing to prepend", () => {
    expect(buildMonedaOptions(undefined, undefined)).toEqual([]);
    expect(buildMonedaOptions([usd], "")).toEqual([usd]);
  });
});

describe("monedaSimbolo", () => {
  const options = [
    { monedaCode: "CUP" },
    { monedaCode: "USD", moneda: { nombre: "Dólar", simbolo: "US$" } },
  ];

  it("uses the currency's own symbol", () => {
    expect(monedaSimbolo(options, "USD")).toBe("US$");
  });

  it("falls back to $ for a currency with no row — the base's normal state", () => {
    expect(monedaSimbolo(options, "CUP")).toBe("$");
    expect(monedaSimbolo(options, undefined)).toBe("$");
  });
});
