import { describe, it, expect } from "vitest";

/**
 * F-033, contract § 4.1, § 11.1 — `src/lib/clientes/clienteNombre.ts`.
 * `toStoredClienteText` entered the testability list in the "Segunda enmienda"
 * (dictamen A, § 11.1 "Ampliación tras la implementación"), found while implementing.
 *
 * Dynamic top-level `await import`: kept even though both symbols exist today, so a
 * later symbol added to this same module cannot tumble the whole file (E-019, see
 * `.claude/agent-memory/dev-tester/testing_against_unimplemented_symbols.md`).
 */
const { normalizeClienteNombre, toStoredClienteText } = await import(
  "@/lib/clientes/clienteNombre"
);

describe("normalizeClienteNombre", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeClienteNombre("  Ana Pérez  ")).toBe("Ana Pérez");
  });

  it("collapses runs of internal whitespace (spaces, tabs, newlines) into a single space", () => {
    expect(normalizeClienteNombre("Ana   Pérez")).toBe("Ana Pérez");
    expect(normalizeClienteNombre("Ana\t\tPérez")).toBe("Ana Pérez");
    expect(normalizeClienteNombre("Ana\n\nPérez")).toBe("Ana Pérez");
  });

  it("combines trimming and collapsing in one pass, the exact contract example", () => {
    expect(normalizeClienteNombre("  Ana   Pérez ")).toBe("Ana Pérez");
  });

  it("does NOT fold case — this is what the composite unique index compares", () => {
    expect(normalizeClienteNombre("ANA PÉREZ")).toBe("ANA PÉREZ");
    expect(normalizeClienteNombre("ana pérez")).toBe("ana pérez");
    // The two case variants must remain DIFFERENT strings after normalizing —
    // an implementation that lowercases would collapse them into the same value.
    expect(normalizeClienteNombre("ANA")).not.toBe(normalizeClienteNombre("ana"));
  });

  it("does NOT strip accents — merging accented and unaccented names is out of scope", () => {
    expect(normalizeClienteNombre("José")).toBe("José");
    // "Jose" (no accent) and "José" (accent) must remain distinct.
    expect(normalizeClienteNombre("Jose")).not.toBe(normalizeClienteNombre("José"));
  });

  it("returns an empty string for a whitespace-only input", () => {
    expect(normalizeClienteNombre("   ")).toBe("");
  });
});

describe("toStoredClienteText", () => {
  it("trims a text with surrounding spaces", () => {
    expect(toStoredClienteText("  Calle Falsa 123  ")).toBe("Calle Falsa 123");
  });

  it(
    'an empty string and a whitespace-only string BOTH come out null, not "" — the ' +
      "one definition of \"empty is null\" for descripcion/direccion/telefono (E-008: " +
      "these two inputs must land on the SAME branch as null/undefined, distinct from " +
      "the trimming branch above)",
    () => {
      expect(toStoredClienteText("")).toBeNull();
      expect(toStoredClienteText("   ")).toBeNull();
    },
  );

  it("null and undefined both come out null", () => {
    expect(toStoredClienteText(null)).toBeNull();
    expect(toStoredClienteText(undefined)).toBeNull();
  });
});
