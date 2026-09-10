import { describe, it, expect } from "vitest";

/**
 * F-031, contract § 4.6, § 11.1 — `src/lib/clientes/clienteCacheOwner.ts` (enmienda S2,
 * `.agents/F-031-seguridad.md` hallazgo 🔴-2).
 *
 * These two symbols close the read-side window the ADR 0108 left open: a shared
 * counter tablet where a different employee (or a different negocio) logs in must not
 * inherit the previous session's cached clientes.
 *
 * Dynamic top-level `await import`: the module does not exist until the `implementer`
 * creates it (E-019).
 */
const { buildClienteCacheOwner, shouldDiscardClienteCache } = await import(
  "@/lib/clientes/clienteCacheOwner"
);

describe("buildClienteCacheOwner", () => {
  it("returns null when usuarioId is missing", () => {
    expect(
      buildClienteCacheOwner({ usuarioId: null, negocioId: "negocio-1" }),
    ).toBeNull();
    expect(
      buildClienteCacheOwner({ usuarioId: undefined, negocioId: "negocio-1" }),
    ).toBeNull();
  });

  it("returns null when negocioId is missing", () => {
    expect(
      buildClienteCacheOwner({ usuarioId: "user-1", negocioId: null }),
    ).toBeNull();
    expect(
      buildClienteCacheOwner({ usuarioId: "user-1", negocioId: undefined }),
    ).toBeNull();
  });

  it("returns null when both halves are missing", () => {
    expect(
      buildClienteCacheOwner({ usuarioId: null, negocioId: null }),
    ).toBeNull();
  });

  it("is deterministic: the same pair always yields the same identity", () => {
    const a = buildClienteCacheOwner({ usuarioId: "user-1", negocioId: "negocio-1" });
    const b = buildClienteCacheOwner({ usuarioId: "user-1", negocioId: "negocio-1" });
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("two identities differing ONLY in usuarioId produce different strings", () => {
    const a = buildClienteCacheOwner({ usuarioId: "user-1", negocioId: "negocio-1" });
    const b = buildClienteCacheOwner({ usuarioId: "user-2", negocioId: "negocio-1" });
    expect(a).not.toBe(b);
  });

  it("two identities differing ONLY in negocioId produce different strings", () => {
    const a = buildClienteCacheOwner({ usuarioId: "user-1", negocioId: "negocio-1" });
    const b = buildClienteCacheOwner({ usuarioId: "user-1", negocioId: "negocio-2" });
    expect(a).not.toBe(b);
  });
});

describe("shouldDiscardClienteCache — the FULL truth table (E-008)", () => {
  it("keeps the cache in the ONE case: storedOwner present and equal to currentOwner", () => {
    expect(
      shouldDiscardClienteCache({ storedOwner: "owner-1", currentOwner: "owner-1" }),
    ).toBe(false);
  });

  it("discards when storedOwner and currentOwner are both present but differ", () => {
    expect(
      shouldDiscardClienteCache({ storedOwner: "owner-1", currentOwner: "owner-2" }),
    ).toBe(true);
  });

  it(
    "discards when storedOwner is null, even if currentOwner is ALSO null — a build " +
      "that predates this check has no recorded owner, so there is no way to tell " +
      "whose it is. A test that only checked distinct owners would pass even with " +
      "this branch inverted (E-008)",
    () => {
      expect(
        shouldDiscardClienteCache({ storedOwner: null, currentOwner: null }),
      ).toBe(true);
    },
  );

  it("discards when storedOwner is null and currentOwner is present", () => {
    expect(
      shouldDiscardClienteCache({ storedOwner: null, currentOwner: "owner-1" }),
    ).toBe(true);
  });

  it("discards when storedOwner is present and currentOwner is null", () => {
    expect(
      shouldDiscardClienteCache({ storedOwner: "owner-1", currentOwner: null }),
    ).toBe(true);
  });
});
