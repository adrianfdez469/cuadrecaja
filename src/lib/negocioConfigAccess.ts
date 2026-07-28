import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { assertNegocioAccess } from "@/lib/appNegocioAccess";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export const PERMISO_CONFIGURACION_NEGOCIO = "configuracion.administrador";

/**
 * Guarda de LECTURA para la configuración multimoneda del negocio (monedas habilitadas
 * y tasas vigentes). Solo exige sesión y pertenencia al negocio: estos datos los carga
 * el AppContext para TODOS los usuarios, porque el POS los necesita para cobrar en
 * moneda alternativa. Exigir aquí el permiso de configuración avanzada dejaba al
 * vendedor sin monedas ni tasas (403 silenciado en `loadMonedas`), y con ello sin la
 * opción de multimoneda en la pantalla de venta.
 *
 * Para cualquier mutación usar `assertNegocioConfigAccess`.
 */
export function assertNegocioConfigReadAccess(
  session: Session | null,
  negocioId: string,
): NextResponse | null {
  return assertNegocioAccess(session, negocioId);
}

/**
 * Guarda de ESCRITURA para las rutas de configuración avanzada de un negocio (monedas
 * habilitadas, tasas de cambio y cambio de moneda base). Verifica, en orden:
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
