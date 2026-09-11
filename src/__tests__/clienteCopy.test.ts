import { describe, it, expect } from "vitest";

/**
 * F-033, contract § 4.7 (enmienda D3) — `src/lib/clientes/clienteCopy.ts`.
 * Signatures and expected literal outputs come from `.agents/designs/F-033.md`, § 5
 * ("Y el copy que interpola" table) and § 6 ("Qué debe fijar su test"); this contract
 * does not re-specify them (E-039) — cited by section, not paraphrased.
 *
 * Namespace imports: several modules here are new and may land partially implemented
 * while `implementer` works in parallel — referencing `mod.symbol` per test keeps a
 * missing export local instead of tumbling the file (E-019).
 */
const clienteCopy = await import("@/lib/clientes/clienteCopy");
const clienteSearch = await import("@/lib/clientes/clienteSearch");
const constants = await import("@/constants/clientes");

describe("clienteCreateActionLabel", () => {
  it('empty term -> the generic label "Crear un cliente nuevo"', () => {
    expect(clienteCopy.clienteCreateActionLabel("")).toBe("Crear un cliente nuevo");
  });

  it('a normalized name -> "Crear «<nombre normalizado>»" (the exact design example)', () => {
    expect(clienteCopy.clienteCreateActionLabel("  Ana   Pérez ")).toBe(
      "Crear «Ana Pérez»",
    );
  });

  it("a whitespace-only term normalizes to empty and also gets the generic label", () => {
    expect(clienteCopy.clienteCreateActionLabel("   ")).toBe("Crear un cliente nuevo");
  });

  it("truncates a name at CLIENTE_CREATE_LABEL_MAX_CHARS characters, with a trailing ellipsis", () => {
    const maxChars = constants.CLIENTE_CREATE_LABEL_MAX_CHARS;
    const longName = "A".repeat(maxChars + 20);
    const expected = `Crear «${longName.slice(0, maxChars)}…»`;
    expect(clienteCopy.clienteCreateActionLabel(longName)).toBe(expected);
  });

  it("cuts exactly at the boundary — one character short of the max does NOT get an ellipsis", () => {
    const maxChars = constants.CLIENTE_CREATE_LABEL_MAX_CHARS;
    const exactName = "B".repeat(maxChars);
    expect(clienteCopy.clienteCreateActionLabel(exactName)).toBe(`Crear «${exactName}»`);
  });
});

describe("clienteDeactivateQuestion", () => {
  it("returns the exact design string for the contract example", () => {
    expect(clienteCopy.clienteDeactivateQuestion("Ana Pérez")).toBe(
      "¿Desactivar a «Ana Pérez»? Dejará de aparecer en la lista y en el selector de clientes. Sus deudas anteriores se conservan y su nombre sigue apareciendo en ellas.",
    );
  });
});

describe("clienteListSubtitle", () => {
  it("singularizes at total: 1", () => {
    expect(
      clienteCopy.clienteListSubtitle({ total: 1, conSaldo: 0, withSaldo: false }),
    ).toBe("1 cliente");
  });

  it("pluralizes at total: 6, and omits the second half when withSaldo is true but conSaldo is 0", () => {
    expect(
      clienteCopy.clienteListSubtitle({ total: 6, conSaldo: 0, withSaldo: true }),
    ).toBe("6 clientes");
  });

  it("adds the second half only when withSaldo is true AND conSaldo > 0", () => {
    expect(
      clienteCopy.clienteListSubtitle({ total: 6, conSaldo: 2, withSaldo: true }),
    ).toBe("6 clientes · 2 con saldo pendiente");
  });

  it("omits the second half when withSaldo is false, even with conSaldo > 0", () => {
    expect(
      clienteCopy.clienteListSubtitle({ total: 6, conSaldo: 2, withSaldo: false }),
    ).toBe("6 clientes");
  });

  it(
    "pluralizes at total: 0 too, exactly '0 clientes' (edge case found by the " +
      "implementer: the empty list, not just the singular/plural boundary at 1/6)",
    () => {
      expect(
        clienteCopy.clienteListSubtitle({ total: 0, conSaldo: 0, withSaldo: true }),
      ).toBe("0 clientes");
    },
  );
});

describe("CLIENTE_CREATE_BLOCK_COPY", () => {
  it("has exactly one entry per value of CLIENTE_CREATE_BLOCK_REASONS, recorriendo el enum (E-035)", () => {
    for (const reason of clienteSearch.CLIENTE_CREATE_BLOCK_REASONS) {
      expect(typeof clienteCopy.CLIENTE_CREATE_BLOCK_COPY[reason]).toBe("string");
      expect(clienteCopy.CLIENTE_CREATE_BLOCK_COPY[reason].length).toBeGreaterThan(0);
    }
  });

  it('"sin-permiso" is verbatim CLIENTES_COPY.crearSinPermiso — the ONLY source of that text (contract § 3)', () => {
    expect(clienteCopy.CLIENTE_CREATE_BLOCK_COPY["sin-permiso"]).toBe(
      constants.CLIENTES_COPY.crearSinPermiso,
    );
  });

  it('"offline" is verbatim CLIENTES_COPY.crearSinConexion — the ONLY source of the criterion-10 visible reason', () => {
    expect(clienteCopy.CLIENTE_CREATE_BLOCK_COPY.offline).toBe(
      constants.CLIENTES_COPY.crearSinConexion,
    );
  });
});
