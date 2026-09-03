import { describe, it, expect } from "vitest";
import {
  encodeUserHeaderValue,
  stripIncomingUserHeaders,
  buildSanitizedHeaders,
} from "@/middleware/userHeaders";
import type { IUserHeaderClaims } from "@/schemas/userHeaders";

/**
 * F-018 — sanitizing the x-user-* headers.
 *
 * These are the functions that close criterion 4 (a real VENDEDOR forging
 * x-user-rol: SUPER_ADMIN gains nothing) and criterion 3 (an anonymous caller forging
 * x-user-* headers gets 401, and the forged headers never reach a handler).
 *
 * ADR 0018 is explicit about where the security lives: in the DELETION, not the writing. A test
 * that only checks the eight headers get written correctly would miss the actual vulnerability
 * this feature closes — that a forged header can SURVIVE. Every test below that matters is a
 * test of survival: does the client's value make it through, or not.
 */

const SUPER_ADMIN_BASE64 = Buffer.from("SUPER_ADMIN", "utf-8").toString("base64");

function headersWithForgedRol(): Headers {
  const headers = new Headers();
  headers.set("x-user-rol", SUPER_ADMIN_BASE64);
  return headers;
}

const fullClaims: IUserHeaderClaims = {
  id: "user-1",
  rol: "VENDEDOR",
  nombre: "Juan Perez",
  usuario: "jperez",
  negocio: "negocio-1",
  localActual: "local-1",
  locales: ["local-1", "local-2"],
  permisos: "pos.vender|inventario.ver",
};

describe("encodeUserHeaderValue", () => {
  it("should encode '' for null", () => {
    expect(encodeUserHeaderValue(null)).toBe("");
  });

  it("should encode '' for undefined", () => {
    expect(encodeUserHeaderValue(undefined)).toBe("");
  });

  it("should base64-encode a plain string", () => {
    expect(encodeUserHeaderValue("VENDEDOR")).toBe(
      Buffer.from("VENDEDOR", "utf-8").toString("base64"),
    );
  });

  it("should base64-encode a string with accents as UTF-8", () => {
    const value = "José Ñáñez";
    expect(encodeUserHeaderValue(value)).toBe(Buffer.from(value, "utf-8").toString("base64"));
    // Round-trip sanity: decoding back must recover the original accented string.
    expect(Buffer.from(encodeUserHeaderValue(value), "base64").toString("utf-8")).toBe(value);
  });

  it("should JSON.stringify an object before base64-encoding it", () => {
    const value = { locales: ["a", "b"] };
    expect(encodeUserHeaderValue(value)).toBe(
      Buffer.from(JSON.stringify(value), "utf-8").toString("base64"),
    );
  });

  it("should JSON.stringify an array before base64-encoding it", () => {
    const value = ["local-1", "local-2"];
    expect(encodeUserHeaderValue(value)).toBe(
      Buffer.from(JSON.stringify(value), "utf-8").toString("base64"),
    );
  });

  it("should never throw and never return the literal empty string for a non-empty string", () => {
    expect(encodeUserHeaderValue("x")).not.toBe("");
  });
});

describe("stripIncomingUserHeaders", () => {
  it("should remove a known x-user-* header", () => {
    const headers = headersWithForgedRol();
    stripIncomingUserHeaders(headers);
    expect(headers.has("x-user-rol")).toBe(false);
  });

  it("should remove ANY header under the x-user- prefix, not only the eight known ones", () => {
    // The ninth header someone adds next year must not be forgeable either (ADR 0018).
    const headers = new Headers();
    headers.set("x-user-cualquier-cosa", "x");
    stripIncomingUserHeaders(headers);
    expect(headers.has("x-user-cualquier-cosa")).toBe(false);
  });

  it("should remove an x-user-* header regardless of the case it was sent in", () => {
    // Headers already normalizes names to lowercase, so this also documents that reliance.
    const headers = new Headers();
    headers.set("X-User-Rol", "x");
    stripIncomingUserHeaders(headers);
    expect(headers.has("x-user-rol")).toBe(false);
    expect(headers.has("X-User-Rol")).toBe(false);
  });

  it("should leave unrelated headers completely intact", () => {
    const headers = new Headers();
    headers.set("cookie", "session=abc");
    headers.set("authorization", "Bearer xyz");
    headers.set("content-type", "application/json");
    headers.set("x-idempotency-key", "idem-1");
    stripIncomingUserHeaders(headers);
    expect(headers.get("cookie")).toBe("session=abc");
    expect(headers.get("authorization")).toBe("Bearer xyz");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-idempotency-key")).toBe("idem-1");
  });

  it("should mutate and return the same Headers instance", () => {
    const headers = headersWithForgedRol();
    const result = stripIncomingUserHeaders(headers);
    expect(result).toBe(headers);
  });
});

describe("buildSanitizedHeaders", () => {
  it("should drop a forged x-user-rol when claims is null (anonymous request, criterion 3)", () => {
    const result = buildSanitizedHeaders(headersWithForgedRol(), null);
    expect(result.has("x-user-rol")).toBe(false);
  });

  it("should write the real claim, never the forged client value, when claims is present", () => {
    const result = buildSanitizedHeaders(headersWithForgedRol(), fullClaims);
    expect(result.get("x-user-rol")).toBe(encodeUserHeaderValue("VENDEDOR"));
    expect(result.get("x-user-rol")).not.toBe(SUPER_ADMIN_BASE64);
  });

  it("should write an empty string, NEVER the client's forged value, when the real claim is falsy (the actual hole, criterion 4)", () => {
    // This is the exact scenario ADR 0018 names: token.rol can legitimately be "" (only the
    // superadmin gets Usuario.rol populated). The forged x-user-rol must not survive that gap.
    const claimsWithEmptyRol: IUserHeaderClaims = { ...fullClaims, rol: "" };
    const result = buildSanitizedHeaders(headersWithForgedRol(), claimsWithEmptyRol);
    expect(result.get("x-user-rol")).toBe("");
    expect(result.get("x-user-rol")).not.toBe(SUPER_ADMIN_BASE64);
  });

  it("should write an empty string when a claim is null, without ever being skipped", () => {
    const claimsWithNullId: IUserHeaderClaims = { ...fullClaims, id: null };
    const result = buildSanitizedHeaders(new Headers(), claimsWithNullId);
    expect(result.has("x-user-id")).toBe(true);
    expect(result.get("x-user-id")).toBe("");
  });

  it("should write an empty string when a claim is undefined, without ever being skipped", () => {
    const claimsWithUndefinedNombre: IUserHeaderClaims = { ...fullClaims, nombre: undefined };
    const result = buildSanitizedHeaders(new Headers(), claimsWithUndefinedNombre);
    expect(result.has("x-user-nombre")).toBe(true);
    expect(result.get("x-user-nombre")).toBe("");
  });

  it("should drop an arbitrary x-user-* header regardless of claims", () => {
    const headers = new Headers();
    headers.set("x-user-cualquier-cosa", "x");
    const result = buildSanitizedHeaders(headers, fullClaims);
    expect(result.has("x-user-cualquier-cosa")).toBe(false);
  });

  it("should drop an incoming x-user-* header sent in uppercase, even with claims null", () => {
    const headers = new Headers();
    headers.set("X-User-Rol", "x");
    const result = buildSanitizedHeaders(headers, null);
    expect(result.has("x-user-rol")).toBe(false);
  });

  it("should leave cookie, authorization, content-type and x-idempotency-key untouched", () => {
    const headers = new Headers();
    headers.set("cookie", "session=abc");
    headers.set("authorization", "Bearer xyz");
    headers.set("content-type", "application/json");
    headers.set("x-idempotency-key", "idem-1");
    headers.set("x-user-rol", SUPER_ADMIN_BASE64);

    const withNullClaims = buildSanitizedHeaders(headers, null);
    expect(withNullClaims.get("cookie")).toBe("session=abc");
    expect(withNullClaims.get("authorization")).toBe("Bearer xyz");
    expect(withNullClaims.get("content-type")).toBe("application/json");
    expect(withNullClaims.get("x-idempotency-key")).toBe("idem-1");

    const withClaims = buildSanitizedHeaders(new Headers(headers), fullClaims);
    expect(withClaims.get("cookie")).toBe("session=abc");
    expect(withClaims.get("authorization")).toBe("Bearer xyz");
    expect(withClaims.get("content-type")).toBe("application/json");
    expect(withClaims.get("x-idempotency-key")).toBe("idem-1");
  });

  it("should write all eight headers unconditionally when claims is present", () => {
    const result = buildSanitizedHeaders(new Headers(), fullClaims);
    expect(result.get("x-user-id")).toBe(encodeUserHeaderValue(fullClaims.id));
    expect(result.get("x-user-rol")).toBe(encodeUserHeaderValue(fullClaims.rol));
    expect(result.get("x-user-nombre")).toBe(encodeUserHeaderValue(fullClaims.nombre));
    expect(result.get("x-user-usuario")).toBe(encodeUserHeaderValue(fullClaims.usuario));
    expect(result.get("x-user-negocio")).toBe(encodeUserHeaderValue(fullClaims.negocio));
    expect(result.get("x-user-localActual")).toBe(encodeUserHeaderValue(fullClaims.localActual));
    expect(result.get("x-user-locales")).toBe(encodeUserHeaderValue(fullClaims.locales));
    expect(result.get("x-user-permisos")).toBe(encodeUserHeaderValue(fullClaims.permisos));
  });

  it("should write none of the eight headers when claims is null", () => {
    const result = buildSanitizedHeaders(new Headers(), null);
    expect(result.has("x-user-id")).toBe(false);
    expect(result.has("x-user-rol")).toBe(false);
    expect(result.has("x-user-nombre")).toBe(false);
    expect(result.has("x-user-usuario")).toBe(false);
    expect(result.has("x-user-negocio")).toBe(false);
    expect(result.has("x-user-localActual")).toBe(false);
    expect(result.has("x-user-locales")).toBe(false);
    expect(result.has("x-user-permisos")).toBe(false);
  });

  it("should return a clone, never the same instance as the source", () => {
    const source = new Headers();
    const result = buildSanitizedHeaders(source, fullClaims);
    expect(result).not.toBe(source);
  });

  it("should not mutate the source Headers", () => {
    const source = headersWithForgedRol();
    buildSanitizedHeaders(source, null);
    // The source (the raw incoming request headers) must remain untouched — only the sanitized
    // clone reflects the deletion. Mutating the original could leak into code that still holds
    // a reference to req.headers directly.
    expect(source.get("x-user-rol")).toBe(SUPER_ADMIN_BASE64);
  });
});
