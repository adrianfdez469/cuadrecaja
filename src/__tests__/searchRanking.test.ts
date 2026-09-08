import { describe, expect, it } from "vitest";
import {
  SEARCH_RANK,
  rankBySearch,
  scoreBestMatch,
  scoreMatch,
} from "@/utils/searchRanking";

describe("scoreMatch", () => {
  it("ranks an exact field as the best match", () => {
    expect(scoreMatch("cola", "cola")).toBe(SEARCH_RANK.EXACT);
  });

  it("ranks a field starting with the term above a word prefix", () => {
    expect(scoreMatch("cola de res", "cola")).toBe(SEARCH_RANK.PREFIX);
    expect(scoreMatch("coca cola", "cola")).toBe(SEARCH_RANK.WORD_PREFIX);
    expect(SEARCH_RANK.PREFIX).toBeLessThan(SEARCH_RANK.WORD_PREFIX);
  });

  it("ranks a match inside a word last", () => {
    expect(scoreMatch("coca cola", "ola")).toBe(SEARCH_RANK.CONTAINS);
  });

  it("returns null when the term is absent", () => {
    expect(scoreMatch("coca cola", "pepsi")).toBeNull();
  });

  it("returns null for an empty term instead of matching everything", () => {
    expect(scoreMatch("coca cola", "")).toBeNull();
  });
});

describe("scoreBestMatch", () => {
  it("takes the strongest rank across fields", () => {
    expect(scoreBestMatch(["malta con cola", "7501055"], "cola")).toBe(
      SEARCH_RANK.WORD_PREFIX,
    );
  });

  it("matches a barcode field exactly", () => {
    expect(
      scoreBestMatch(["coca cola 1.5l", "7501055363057"], "7501055363057"),
    ).toBe(SEARCH_RANK.EXACT);
  });

  it("returns null when no field matches", () => {
    expect(scoreBestMatch(["coca cola", "7501055"], "jabon")).toBeNull();
  });
});

describe("rankBySearch", () => {
  const productos = [
    { nombre: "malta con cola", codigo: "111" },
    { nombre: "coca cola zero", codigo: "222" },
    { nombre: "cola de res", codigo: "333" },
    { nombre: "jabon", codigo: "444" },
    { nombre: "coca cola 1.5l", codigo: "555" },
  ];

  const fields = (p: (typeof productos)[number]) => [p.nombre, p.codigo];

  it("drops non-matching items and orders the rest by relevance", () => {
    const result = rankBySearch(productos, "cola", fields);

    expect(result.map((p) => p.nombre)).toEqual([
      "cola de res", // prefix
      "malta con cola", // word prefix, first in input order
      "coca cola zero",
      "coca cola 1.5l",
    ]);
  });

  it("keeps the input order between items of the same rank", () => {
    const result = rankBySearch(productos, "coca", fields);

    expect(result.map((p) => p.codigo)).toEqual(["222", "555"]);
  });

  it("finds an item by its barcode", () => {
    const result = rankBySearch(productos, "444", fields);

    expect(result.map((p) => p.nombre)).toEqual(["jabon"]);
  });

  it("returns nothing when the term matches no item", () => {
    expect(rankBySearch(productos, "pepsi", fields)).toEqual([]);
  });
});
