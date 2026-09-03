/** Root of the API surface the gate protects. */
export const API_PATH_PREFIX = "/api";

/**
 * Paths the authentication gate does NOT intercept, fixed by acceptance
 * criterion 5 of F-018. Every entry here already authenticates on its own:
 * this list says "the gate steps aside", never "this is public".
 * Matched on segment boundaries, never as a raw string prefix. See ADR 0017.
 */
export const API_AUTH_ALLOWLIST = [
  "/api/auth",
  "/api/app",
  "/api/crons",
  "/api/public",
  "/api/init-superadmin",
  "/api/activar-cuenta",
  "/api/contact-form",
  "/api/promoters",
  "/api/backup/generate",
] as const;

export type ApiAuthAllowlistEntry = (typeof API_AUTH_ALLOWLIST)[number];

/** Every incoming header starting with this prefix is dropped. See ADR 0018. */
export const USER_HEADER_PREFIX = "x-user-";

/** The eight headers the middleware writes from the session token. */
export const USER_HEADER_NAMES = {
  id: "x-user-id",
  rol: "x-user-rol",
  nombre: "x-user-nombre",
  usuario: "x-user-usuario",
  negocio: "x-user-negocio",
  localActual: "x-user-localActual",
  locales: "x-user-locales",
  permisos: "x-user-permisos",
} as const;

export type UserHeaderKey = keyof typeof USER_HEADER_NAMES;

/** Machine-readable body of the gate's 401. */
export const UNAUTHORIZED_ERROR_CODE = "UNAUTHORIZED";
