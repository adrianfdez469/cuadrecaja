import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { getTasasReferencia } from "@/lib/eltoque";

// Sin negocioId a propósito: las tasas de referencia son de plataforma, iguales para
// todos los negocios. No hay nada de tenant que filtrar aquí.
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const autorizado = verificarPermisoUsuario(
      session.user.permisos,
      "configuracion.administrador",
      session.user.rol,
    );
    if (!autorizado) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    return NextResponse.json(await getTasasReferencia());
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener tasas de referencia" },
      { status: 500 },
    );
  }
}
