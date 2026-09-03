import { USER_HEADER_NAMES, USER_HEADER_PREFIX } from "@/constants/apiAuth";
import type { IUserHeaderClaims } from "@/schemas/userHeaders";

/**
 * Sanitising of the x-user-* headers (F-018, ADR 0018).
 *
 * Only the global `Headers` is used here: no import from `next/*`, so the whole
 * behaviour is verifiable without HTTP.
 */

/** Base64 of the UTF-8 value; "" for null/undefined; JSON.stringify for objects. */
export function encodeUserHeaderValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue =
    typeof value === "string" ? value : (JSON.stringify(value) ?? "");
  return Buffer.from(stringValue, "utf8").toString("base64");
}

/**
 * Removes EVERY header whose (lowercased) name starts with USER_HEADER_PREFIX.
 * By prefix, never by the list of eight: the ninth header someone adds next
 * year must not be forgeable either. Mutates and returns the same instance.
 */
export function stripIncomingUserHeaders(headers: Headers): Headers {
  const forgedNames: string[] = [];

  headers.forEach((_value, name) => {
    if (name.toLowerCase().startsWith(USER_HEADER_PREFIX)) {
      // Collected first: deleting while iterating a Headers is not safe.
      forgedNames.push(name);
    }
  });

  for (const name of forgedNames) {
    headers.delete(name);
  }

  return headers;
}

/**
 * Clone of `source` with every incoming x-user-* dropped and, when `claims` is
 * not null, the eight headers written UNCONDITIONALLY — one set() per header,
 * never inside an if, "" when the claim is null/undefined. Criterion 4.
 */
export function buildSanitizedHeaders(
  source: Headers,
  claims: IUserHeaderClaims | null,
): Headers {
  const headers = stripIncomingUserHeaders(new Headers(source));

  if (!claims) return headers;

  headers.set(USER_HEADER_NAMES.id, encodeUserHeaderValue(claims.id));
  headers.set(USER_HEADER_NAMES.rol, encodeUserHeaderValue(claims.rol));
  headers.set(USER_HEADER_NAMES.nombre, encodeUserHeaderValue(claims.nombre));
  headers.set(USER_HEADER_NAMES.usuario, encodeUserHeaderValue(claims.usuario));
  headers.set(USER_HEADER_NAMES.negocio, encodeUserHeaderValue(claims.negocio));
  headers.set(
    USER_HEADER_NAMES.localActual,
    encodeUserHeaderValue(claims.localActual),
  );
  headers.set(USER_HEADER_NAMES.locales, encodeUserHeaderValue(claims.locales));
  headers.set(
    USER_HEADER_NAMES.permisos,
    encodeUserHeaderValue(claims.permisos),
  );

  return headers;
}
