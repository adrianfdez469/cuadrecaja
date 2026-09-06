import { NextRequest, NextResponse } from "next/server";
import { fetchDiscountRulesForTienda } from "@/lib/discounts";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";
import { assertTiendaTenant } from "@/lib/tenantScope";

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

    const tiendaId = req.nextUrl.searchParams.get("tiendaId");

    // F-021: `fetchDiscountRulesForTienda` derives the business from the store row, so an
    // unchecked `tiendaId` returned the discount rules of another business. Same permission it
    // already demanded (ADR 0078); the handler no longer emits its own 401 either.
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: "configuracion.descuentos.preview",
    });
    if (!scope) return response;

    const rules = await fetchDiscountRulesForTienda(scope);
    return NextResponse.json({ rules });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Error obteniendo descuentos activos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
