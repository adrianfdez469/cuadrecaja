import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Verifica que el usuario autenticado pertenece al negocio solicitado.
 * Retorna null si el acceso es válido, o una NextResponse de error.
 */
export function assertNegocioAccess(
  session: Session | null,
  negocioId: string,
): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (session.user.negocio?.id !== negocioId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return null;
}
