/**
 * Why the door stayed shut.
 *
 * NextAuth hands back a single string, and the four reasons the app can refuse
 * a login were previously carried inside it as prefixes and pulled apart again
 * at render time with `split(": ")[1]`. That lost everything after a second
 * colon in the server's message. Parsing once, into a type, keeps the message
 * whole and lets the alert decide what to show instead of re-reading prefixes.
 */
export type LoginError =
  | { kind: "expiredSubscription" }
  | { kind: "unconfiguredUser"; message: string }
  | { kind: "pendingVerification"; message: string }
  | { kind: "generic"; message: string };

const GENERIC_MESSAGE =
  "Credenciales inválidas. Verifica tu usuario y contraseña.";

/** Everything after the first `": "`, or the whole string if there is none. */
function detail(raw: string): string {
  const [, ...rest] = raw.split(": ");
  return rest.length ? rest.join(": ") : raw;
}

export function parseSignInError(raw: string): LoginError {
  if (raw.includes("SUBSCRIPTION_EXPIRED")) {
    return { kind: "expiredSubscription" };
  }
  if (raw.includes("USUARIO_SIN_CONFIGURAR")) {
    return { kind: "unconfiguredUser", message: detail(raw) };
  }
  if (raw.includes("USUARIO_PENDIENTE_VERIFICACION")) {
    return { kind: "pendingVerification", message: detail(raw) };
  }
  return { kind: "generic", message: GENERIC_MESSAGE };
}
