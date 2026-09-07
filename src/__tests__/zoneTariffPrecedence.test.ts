import { describe, it, expect } from "vitest";
import {
  resolveZoneTariff,
  resolveCoverage,
  type ZoneTariffRow,
  type ZoneCatalog,
} from "@/lib/tiendaOnline/zoneTariffPrecedence";

// DPA/ONEI: 03 is La Habana, 0301..0315 its municipalities. 02 is Artemisa.
const HABANA = "03";
const PLAYA = "0301";
const REGLA = "0302";
const BAUTA = "0202";
const ARTEMISA = "02";

const fee = (zoneCode: string, deliveryFee: number): ZoneTariffRow => ({
  zoneCode,
  rule: "FEE",
  deliveryFee,
});
const notServed = (zoneCode: string): ZoneTariffRow => ({
  zoneCode,
  rule: "NOT_SERVED",
});
const inherit = (zoneCode: string): ZoneTariffRow => ({
  zoneCode,
  rule: "INHERIT",
});

describe("resolveZoneTariff", () => {
  it("charges the municipality's own fee", () => {
    const result = resolveZoneTariff([fee(PLAYA, 300)], PLAYA);
    expect(result).toMatchObject({ served: true, deliveryFee: 300, decidedBy: PLAYA });
  });

  it("falls to the province when the municipality has no row", () => {
    const result = resolveZoneTariff([fee(HABANA, 400)], PLAYA);
    expect(result).toMatchObject({ served: true, deliveryFee: 400, decidedBy: HABANA });
  });

  it("lets the municipality beat the province", () => {
    const rows = [fee(HABANA, 400), fee(PLAYA, 300)];
    expect(resolveZoneTariff(rows, PLAYA).deliveryFee).toBe(300);
    expect(resolveZoneTariff(rows, REGLA).deliveryFee).toBe(400);
  });

  // ── The seven cases of the agreed vector ──

  it("1 · NOT_SERVED municipality under a FEE province is not served", () => {
    const rows = [fee(HABANA, 400), notServed(REGLA)];
    expect(resolveZoneTariff(rows, REGLA)).toMatchObject({
      served: false,
      decidedBy: REGLA,
    });
  });

  it("2 · INHERIT municipality under a FEE province takes the province fee", () => {
    const rows = [fee(HABANA, 400), inherit(PLAYA)];
    expect(resolveZoneTariff(rows, PLAYA)).toMatchObject({
      served: true,
      deliveryFee: 400,
      decidedBy: HABANA,
    });
  });

  it("3 · no municipality row under no province row is not served", () => {
    expect(resolveZoneTariff([fee(ARTEMISA, 500)], PLAYA)).toMatchObject({
      served: false,
      decidedBy: null,
    });
  });

  it("4 · a zone outside all coverage is not served", () => {
    expect(resolveZoneTariff([], PLAYA)).toMatchObject({
      served: false,
      decidedBy: null,
    });
  });

  it("5 · FEE municipality under a NOT_SERVED province takes the municipality fee", () => {
    const rows = [notServed(ARTEMISA), fee(BAUTA, 250)];
    expect(resolveZoneTariff(rows, BAUTA)).toMatchObject({
      served: true,
      deliveryFee: 250,
      decidedBy: BAUTA,
    });
  });

  it("6 · INHERIT province with a FEE municipality takes the municipality fee", () => {
    const rows = [inherit(HABANA), fee(PLAYA, 300)];
    expect(resolveZoneTariff(rows, PLAYA)).toMatchObject({
      served: true,
      deliveryFee: 300,
      decidedBy: PLAYA,
    });
  });

  it("7 · INHERIT province with no municipality row is not served", () => {
    expect(resolveZoneTariff([inherit(HABANA)], PLAYA)).toMatchObject({
      served: false,
      decidedBy: null,
    });
  });

  // ── Compositions and guards ──

  it("resolves an INHERIT municipality under an INHERIT province as not served", () => {
    const rows = [inherit(HABANA), inherit(PLAYA)];
    expect(resolveZoneTariff(rows, PLAYA).served).toBe(false);
  });

  it("resolves an INHERIT municipality under a NOT_SERVED province as not served", () => {
    const rows = [notServed(HABANA), inherit(PLAYA)];
    expect(resolveZoneTariff(rows, PLAYA)).toMatchObject({
      served: false,
      decidedBy: HABANA,
    });
  });

  it("never reads a FEE row without an amount as free delivery", () => {
    const malformed: ZoneTariffRow = { zoneCode: PLAYA, rule: "FEE" };
    const rows = [fee(HABANA, 400), malformed];
    // Falls through to the province instead of charging 0.
    expect(resolveZoneTariff(rows, PLAYA)).toMatchObject({
      served: true,
      deliveryFee: 400,
      decidedBy: HABANA,
    });
  });

  it("keeps a zero fee as free delivery and not as unserved", () => {
    expect(resolveZoneTariff([fee(PLAYA, 0)], PLAYA)).toMatchObject({
      served: true,
      deliveryFee: 0,
      decidedBy: PLAYA,
    });
  });

  it("resolves a province zone against its own row and never inherits upward", () => {
    expect(resolveZoneTariff([fee(HABANA, 400)], HABANA).deliveryFee).toBe(400);
    expect(resolveZoneTariff([fee(ARTEMISA, 500)], HABANA).served).toBe(false);
  });


  // ── El camino, que es lo que las pantallas renderizan ──

  it("distinguishes an own INHERIT row from no row at all, same deciding row", () => {
    const rows = [fee(HABANA, 400), inherit(PLAYA)];
    // 0301 tiene fila propia que declina; 0302 no tiene ninguna.
    expect(resolveZoneTariff(rows, PLAYA).path).toEqual([
      { zoneCode: PLAYA, rule: "INHERIT" },
      { zoneCode: HABANA, rule: "FEE" },
    ]);
    expect(resolveZoneTariff(rows, REGLA).path).toEqual([
      { zoneCode: REGLA, rule: null },
      { zoneCode: HABANA, rule: "FEE" },
    ]);
    expect(resolveZoneTariff(rows, PLAYA).decidedBy).toBe(HABANA);
    expect(resolveZoneTariff(rows, REGLA).decidedBy).toBe(HABANA);
  });

  it("distinguishes a province that declined from a zone nobody mentioned", () => {
    const declined = resolveZoneTariff([inherit(HABANA)], PLAYA);
    const unknown = resolveZoneTariff([], PLAYA);

    expect(declined.decidedBy).toBeNull();
    expect(unknown.decidedBy).toBeNull();
    expect(declined.path).toEqual([
      { zoneCode: PLAYA, rule: null },
      { zoneCode: HABANA, rule: "INHERIT" },
    ]);
    expect(unknown.path).toEqual([
      { zoneCode: PLAYA, rule: null },
      { zoneCode: HABANA, rule: null },
    ]);
  });

  it("falls to the province on a negative fee instead of paying the buyer", () => {
    const negative: ZoneTariffRow = { zoneCode: PLAYA, rule: "FEE", deliveryFee: -50 };
    expect(resolveZoneTariff([fee(HABANA, 400), negative], PLAYA)).toMatchObject({
      served: true,
      deliveryFee: 400,
      decidedBy: HABANA,
    });
  });


  // ── Zonas de primer nivel: la escalera tiene un solo peldaño ──

  it("8 · a first-level FEE resolves its own amount", () => {
    expect(resolveZoneTariff([fee(HABANA, 400)], HABANA)).toMatchObject({
      served: true,
      deliveryFee: 400,
      decidedBy: HABANA,
      path: [{ zoneCode: HABANA, rule: "FEE" }],
    });
  });

  it("9 · a first-level INHERIT has nothing above it, so it is not served", () => {
    expect(resolveZoneTariff([inherit(HABANA)], HABANA)).toMatchObject({
      served: false,
      decidedBy: null,
      path: [{ zoneCode: HABANA, rule: "INHERIT" }],
    });
  });

  // ── El nivel lo declara el catálogo, nunca la longitud del código ──

  it("never inherits for a first-level zone that happens to have a 4-digit code", () => {
    // Isla de la Juventud: municipio especial al nivel de una provincia. Si el
    // nivel se dedujera de la longitud, heredaría de "99" y cobraría su tarifa.
    const ISLA = "9901";
    const catalog: ZoneCatalog = new Map([[ISLA, { level: 1 as const }]]);
    const rows = [fee("99", 700), inherit(ISLA)];

    expect(resolveZoneTariff(rows, ISLA, catalog)).toMatchObject({
      served: false,
      decidedBy: null,
      path: [{ zoneCode: ISLA, rule: "INHERIT" }],
    });
    // Sin catálogo, la regla de arranque sí hereda — y esa es la diferencia.
    expect(resolveZoneTariff(rows, ISLA).deliveryFee).toBe(700);
  });

  it("takes the parent from the catalog and not from the code prefix", () => {
    const ODD = "0301";
    const catalog: ZoneCatalog = new Map([
      [ODD, { level: 2 as const, parentCode: ARTEMISA }],
    ]);
    const rows = [fee(HABANA, 400), fee(ARTEMISA, 500), inherit(ODD)];

    expect(resolveZoneTariff(rows, ODD, catalog).deliveryFee).toBe(500);
    expect(resolveZoneTariff(rows, ODD).deliveryFee).toBe(400);
  });

  it("does not let one province's rows reach another's municipalities", () => {
    const rows = [fee(HABANA, 400)];
    expect(resolveZoneTariff(rows, BAUTA).served).toBe(false);
  });
});

describe("resolveCoverage", () => {
  it("resolves what the buyer sees, not the rows the manager typed", () => {
    const rows = [fee(HABANA, 400), fee(PLAYA, 300), notServed(REGLA)];
    const coverage = resolveCoverage(rows, [PLAYA, REGLA, "0303"]);

    expect(coverage.get(PLAYA)).toMatchObject({
      served: true,
      deliveryFee: 300,
      decidedBy: PLAYA,
    });
    expect(coverage.get(REGLA).served).toBe(false);
    expect(coverage.get("0303")).toMatchObject({
      served: true,
      deliveryFee: 400,
      decidedBy: HABANA,
    });
  });
});
