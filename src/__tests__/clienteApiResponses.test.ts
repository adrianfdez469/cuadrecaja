import { describe, it, expect } from "vitest";

/**
 * F-031, "Segunda enmienda" (dictamen A), § 11.1 "Ampliación tras la implementación" —
 * `src/lib/clientes/clienteApiResponses.ts`. Found while implementing, not part of the
 * original contract.
 *
 * This module imports `next/server` at its top; the dictamen confirms it is already
 * imported cleanly from this suite (same pattern `tenantScope.test.ts` uses for a
 * module with `next/server`), so no mock is required.
 *
 * Namespace import: keeps a future missing export local to the test that uses it,
 * rather than tumbling the whole file at collection (E-019).
 */
const mod = await import("@/lib/clientes/clienteApiResponses");
const { CLIENTES_EXTRA_COPY } = await import("@/constants/clientes");

describe("RECORD_NOT_FOUND_CODE", () => {
  it('is exactly "P2025" — a driver code written from memory is indistinguishable from a correct one until the branch runs', () => {
    expect(mod.RECORD_NOT_FOUND_CODE).toBe("P2025");
  });
});

describe("isRecordNotFound", () => {
  it("is true for an object carrying the RECORD_NOT_FOUND_CODE", () => {
    expect(mod.isRecordNotFound({ code: mod.RECORD_NOT_FOUND_CODE })).toBe(true);
  });

  it("is false for null and undefined", () => {
    expect(mod.isRecordNotFound(null)).toBe(false);
    expect(mod.isRecordNotFound(undefined)).toBe(false);
  });

  it("is false for a plain string", () => {
    expect(mod.isRecordNotFound("P2025")).toBe(false);
  });

  it("is false for an Error without a code", () => {
    expect(mod.isRecordNotFound(new Error("boom"))).toBe(false);
  });

  it("is false for an object carrying a DIFFERENT Prisma code — a wrong guard would not error, it would just silently misroute", () => {
    expect(mod.isRecordNotFound({ code: "P2002" })).toBe(false);
  });
});

describe("clienteInternalErrorResponse", () => {
  it("responds 500", () => {
    const res = mod.clienteInternalErrorResponse("test", new Error("boom"));
    expect(res.status).toBe(500);
  });

  it("the body is EXACTLY { error: CLIENTES_EXTRA_COPY.errorInterno }", async () => {
    const res = mod.clienteInternalErrorResponse("test", new Error("boom"));
    await expect(res.json()).resolves.toEqual({
      error: CLIENTES_EXTRA_COPY.errorInterno,
    });
  });

  it(
    "the body carries NOTHING of the exception's message, even when that message " +
      "quotes a recognizable piece of data (E-031) — this is the property that " +
      "regresses silently the day someone 'improves' a log line",
    async () => {
      const sensitiveMessage =
        "Unique constraint failed on cliente.nombre=SECRET-CLIENT-42, negocioId=abc123";
      const res = mod.clienteInternalErrorResponse(
        "clientes.POST",
        new Error(sensitiveMessage),
      );
      const body = await res.json();
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("SECRET-CLIENT-42");
      expect(serialized).not.toContain("abc123");
      expect(serialized).not.toContain("Unique constraint failed");
      expect(body).toEqual({ error: CLIENTES_EXTRA_COPY.errorInterno });
    },
  );

  it("the body is unaffected by an error that is not an Error instance at all (a string, a Prisma-shaped object)", async () => {
    const res = mod.clienteInternalErrorResponse("test", { code: "P2002", message: "secret detail" });
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("secret detail");
    expect(body).toEqual({ error: CLIENTES_EXTRA_COPY.errorInterno });
  });
});
