import { describe, it, expect } from "vitest";
import { clienteSchema } from "@/schemas/cliente";
import permisosJson from "@/constants/permisos/permisos.json";

/**
 * F-031, contract § 3, § 11.1 — `src/constants/clientes.ts`.
 * `CLIENTES_COPY` values come from `.agents/designs/F-031.md`, § 5 (cited, not
 * paraphrased — E-039). `CLIENTES_PERMISO_CONFIGURACION`, `CUENTAS_POR_COBRAR_PERMISO`
 * and `CLIENTES_EXTRA_COPY` entered the testability list in the "Segunda enmienda"
 * (dictamen A, § 11.1 "Ampliación tras la implementación"), found while implementing.
 *
 * Namespace import: the module is new and may land partially populated while
 * `implementer` works in parallel (E-019).
 */
const constants = await import("@/constants/clientes");
type IPermisosJson = Record<string, { descripcion?: string }>;

describe("CLIENTES_LIST_LIMIT vs CLIENTES_CACHE_SIZE — the relationship E-008 depends on", () => {
  it("CLIENTES_LIST_LIMIT is strictly greater than CLIENTES_CACHE_SIZE", () => {
    // If this relationship were reversed or equal, criterion 8's truncation-to-200
    // could never be exercised by seeding a full page of results (riesgo § 13.4).
    expect(constants.CLIENTES_LIST_LIMIT).toBeGreaterThan(constants.CLIENTES_CACHE_SIZE);
  });

  it("matches the exact values the contract fixes: CACHE_SIZE 200, LIST_LIMIT 500", () => {
    expect(constants.CLIENTES_CACHE_SIZE).toBe(200);
    expect(constants.CLIENTES_LIST_LIMIT).toBe(500);
  });
});

describe("CLIENTES_UPSERT_RETRIES", () => {
  it("is exactly 1 — a single retry resolves only a lost race (ADR 0107)", () => {
    expect(constants.CLIENTES_UPSERT_RETRIES).toBe(1);
  });
});

describe("CLIENTES_API_ERRORS.saldoPendiente", () => {
  it("names the amount with two decimals, using a dot separator (contract § 3, E-033)", () => {
    expect(constants.CLIENTES_API_ERRORS.saldoPendiente(1250)).toBe(
      "No se puede eliminar el cliente: tiene un saldo pendiente de 1250.00",
    );
  });

  it("formats a non-integer amount to exactly two decimals, not truncated", () => {
    expect(constants.CLIENTES_API_ERRORS.saldoPendiente(99.5)).toBe(
      "No se puede eliminar el cliente: tiene un saldo pendiente de 99.50",
    );
  });

  it('still says "eliminar", not "desactivar" — this literal is what criterion 3 searches for (design § 8.3)', () => {
    expect(constants.CLIENTES_API_ERRORS.saldoPendiente(1)).toContain(
      "No se puede eliminar el cliente",
    );
  });
});

describe("CLIENTES_COPY", () => {
  it("crearSinConexion and crearSinPermiso are non-empty — they no longer are the amended empty strings", () => {
    expect(constants.CLIENTES_COPY.crearSinConexion.length).toBeGreaterThan(0);
    expect(constants.CLIENTES_COPY.crearSinPermiso.length).toBeGreaterThan(0);
  });

  it("no value contains the forbidden substring \"por cobrar\" (design § 5 prohibitions)", () => {
    for (const [key, value] of Object.entries(constants.CLIENTES_COPY)) {
      expect(value, `CLIENTES_COPY.${key}`).not.toContain("por cobrar");
    }
  });

  it("carries the keys the screen and the selectors are documented to use", () => {
    const expectedKeys = [
      "pageTitle",
      "seccionEtiqueta",
      "vacioTitulo",
      "listaSinConexion",
      "selectorSinClientes",
      "selectorError",
      "selectorDesdeCache",
      "crearNuevo",
      "crearSinConexion",
      "crearSinPermiso",
    ];
    for (const key of expectedKeys) {
      expect(constants.CLIENTES_COPY, key).toHaveProperty(key);
    }
  });
});

describe("CLIENTE_CREATE_LABEL_MAX_CHARS", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(constants.CLIENTE_CREATE_LABEL_MAX_CHARS)).toBe(true);
    expect(constants.CLIENTE_CREATE_LABEL_MAX_CHARS).toBeGreaterThan(0);
  });

  it("is strictly less than clienteSchema's nombre length cap — a truncation above the cap never truncates", () => {
    // Derive the real cap from the F-029 schema instead of hardcoding 200 here.
    const cap = constants.CLIENTE_CREATE_LABEL_MAX_CHARS;
    const atCap = "a".repeat(200);
    const overCap = "a".repeat(201);
    expect(clienteSchema.shape.nombre.safeParse(atCap).success).toBe(true);
    expect(clienteSchema.shape.nombre.safeParse(overCap).success).toBe(false);
    expect(cap).toBeLessThan(200);
  });
});

describe("CLIENTE_SELECTOR_MAX_WIDTH", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(constants.CLIENTE_SELECTOR_MAX_WIDTH)).toBe(true);
    expect(constants.CLIENTE_SELECTOR_MAX_WIDTH).toBeGreaterThan(0);
  });
});

describe("CLIENTES_DOM — the eleven localization classes", () => {
  const expectedKeys = [
    "section",
    "selector",
    "autocomplete",
    "searchTrigger",
    "sheet",
    "sheetRow",
    "list",
    "row",
    "createAction",
    "createReason",
    "cacheNotice",
  ] as const;

  it("has exactly these eleven keys", () => {
    expect(Object.keys(constants.CLIENTES_DOM).sort()).toEqual(
      [...expectedKeys].sort(),
    );
  });

  it("every value is a non-empty string with no whitespace", () => {
    for (const key of expectedKeys) {
      const value = constants.CLIENTES_DOM[key];
      expect(typeof value, key).toBe("string");
      expect(value.length, key).toBeGreaterThan(0);
      expect(/^\S+$/.test(value), `${key}: "${value}"`).toBe(true);
    }
  });

  it("no two values are equal", () => {
    const values = expectedKeys.map((key) => constants.CLIENTES_DOM[key]);
    expect(new Set(values).size).toBe(values.length);
  });

  it(
    "cc-cliente-create IS a prefix of cc-cliente-create-reason — a documented, " +
      "ACCEPTED fact of this vocabulary (contract § 11.1), not a defect: it is exactly " +
      "why localization must compare with classList.contains and never startsWith. " +
      "(Correction: an earlier version of this suite asserted the opposite — 'no value " +
      "is a prefix of another' — which contradicted the contract outright and failed " +
      "against a correct implementation. The one real invariant here is uniqueness, " +
      "tested above.)",
    () => {
      expect(
        constants.CLIENTES_DOM.createReason.startsWith(
          constants.CLIENTES_DOM.createAction,
        ),
      ).toBe(true);
    },
  );
});

describe("CLIENTES_PERMISO_CONFIGURACION and CUENTAS_POR_COBRAR_PERMISO", () => {
  it("CLIENTES_PERMISO_CONFIGURACION is an EXISTING key of permisos.json, not a value typed from memory", () => {
    const entry = (permisosJson as IPermisosJson)[
      constants.CLIENTES_PERMISO_CONFIGURACION
    ];
    expect(entry).toBeDefined();
  });

  it('CLIENTES_PERMISO_CONFIGURACION is exactly "configuracion.clientes.acceder"', () => {
    expect(constants.CLIENTES_PERMISO_CONFIGURACION).toBe(
      "configuracion.clientes.acceder",
    );
  });

  it("CUENTAS_POR_COBRAR_PERMISO is an EXISTING key of permisos.json too", () => {
    const entry = (permisosJson as IPermisosJson)[
      constants.CUENTAS_POR_COBRAR_PERMISO
    ];
    expect(entry).toBeDefined();
  });

  it('CUENTAS_POR_COBRAR_PERMISO is exactly "recuperaciones.cuentasporcobrar.acceder" — no tilde, on purpose', () => {
    expect(constants.CUENTAS_POR_COBRAR_PERMISO).toBe(
      "recuperaciones.cuentasporcobrar.acceder",
    );
    expect(constants.CUENTAS_POR_COBRAR_PERMISO).not.toContain("ó");
  });
});

describe("CLIENTES_EXTRA_COPY — inherits CLIENTES_COPY's two design prohibitions", () => {
  it("no value is empty", () => {
    for (const [key, value] of Object.entries(constants.CLIENTES_EXTRA_COPY)) {
      expect(value.length, `CLIENTES_EXTRA_COPY.${key}`).toBeGreaterThan(0);
    }
  });

  it('no value contains the forbidden substring "por cobrar" — splitting the copy into two objects opened a gap in a prohibition written for one', () => {
    for (const [key, value] of Object.entries(constants.CLIENTES_EXTRA_COPY)) {
      expect(value, `CLIENTES_EXTRA_COPY.${key}`).not.toContain("por cobrar");
    }
  });
});
