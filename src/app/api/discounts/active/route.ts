import { NextRequest, NextResponse } from "next/server";
import { fetchDiscountRulesForTienda } from "@/lib/discounts";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

/**
 * The active discount rules of a store's business.
 *
 * The POS loads these once, alongside the catalog, and prices the basket
 * locally from then on. Before this, every change to the cart POSTed to
 * /api/discounts/preview — network traffic in the middle of a sale, on a
 * connection that is often the worst part of the setup.
 *
 * The server still recomputes discounts when the sale is confirmed, so this is
 * only what the cashier sees while deciding.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.negocio?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "configuracion.descuentos.preview",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    const tiendaId = req.nextUrl.searchParams.get("tiendaId");
    if (!tiendaId) {
      return NextResponse.json({ error: "Falta tiendaId" }, { status: 400 });
    }

    const rules = await fetchDiscountRulesForTienda(tiendaId);
    return NextResponse.json({ rules });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error obteniendo descuentos activos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
