"use client";

import { useAppContext } from "@/context/AppContext";
import { usePermisos } from "@/utils/permisos_front";

/** Three states, so a screen can tell "not yet" from "no". */
export type ITiendaOnlineAccessState = "loading" | "allowed" | "denied";

/**
 * The switch FIRST, exactly as on the server: with `tiendaOnlineHabilitada === false`
 * this returns "denied" for every role, SUPER_ADMIN included, because it never
 * reaches `verificarPermiso` — which would have said yes.
 *
 * This is a UI hint and NOT a security boundary: the server re-checks both gates.
 *
 * It issues no request of its own: `AppContext` resolves the switch once per
 * session and this reads that value.
 */
export function useTiendaOnlineAccess(
  permisoRequerido: string,
): ITiendaOnlineAccessState {
  const { loadingContext, tiendaOnlineHabilitada } = useAppContext();
  const { verificarPermiso } = usePermisos();

  if (loadingContext || tiendaOnlineHabilitada === null) return "loading";

  // Before anything that looks at rol or permisos. Removing this early return
  // would make the switch dead code for SUPER_ADMIN. See ADR 0028.
  if (tiendaOnlineHabilitada === false) return "denied";

  if (!verificarPermiso(permisoRequerido)) return "denied";

  return "allowed";
}
