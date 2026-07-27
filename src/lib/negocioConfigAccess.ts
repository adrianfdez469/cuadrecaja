import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { assertNegocioAccess } from "@/lib/appNegocioAccess";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export const PERMISO_CONFIGURACION_NEGOCIO = "configuracion.administrador";

/**
 * Guarda para las rutas de configuración avanzada de un negocio (monedas habilitadas,
 * tasas de cambio y cambio de moneda base). Verifica, en orden:
 *
 *  1. Que haya sesión.
 *  2. Que el usuario pertenezca al negocio del path. Sin esto, cualquier usuario
 *     autenticado que conociera el UUID de otro negocio podía leer y ESCRIBIR su
 *     configuración: registrar tasas de cambio falsas, deshabilitar monedas o forzar
 *     un cambio de moneda base que reescribe todos los precios y costos.
 *  3. Que tenga el permiso de configuración avanzada — el mismo que ya controla la
 *     visibilidad de estas pantallas en el menú. SUPER_ADMIN lo salta.
 *
 * Retorna null si el acceso es válido, o la NextResponse de error a devolver.
 */
export function assertNegocioConfigAccess(
  session: Session | null,
  negocioId: string,
): NextResponse | null {
  const accessError = assertNegocioAccess(session, negocioId);
  if (accessError) return accessError;

  const autorizado = verificarPermisoUsuario(
    session.user.permisos,
    PERMISO_CONFIGURACION_NEGOCIO,
    session.user.rol,
  );
  if (!autorizado) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  return null;
}
