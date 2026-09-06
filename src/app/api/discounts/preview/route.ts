import { NextRequest, NextResponse } from "next/server";
import { applyDiscountsForSale, DiscountApplicationInputProduct } from "@/lib/discounts";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";
import { assertTiendaTenant } from "@/lib/tenantScope";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body: unknown = await req.json();
    const { tiendaId, products, discountCodes } = (body as {
      tiendaId?: string;
      products?: Array<Partial<DiscountApplicationInputProduct>>;
      discountCodes?: string[];
    }) || {};
    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "Faltan tiendaId o products" }, { status: 400 });
    }

    // F-021: the store arrives in the BODY and used to reach `applyDiscountsForSale` unchecked,
    // which prices the basket against the `DiscountRule` rows of THAT store's business. Same
    // permission it already demanded (ADR 0078); the handler no longer emits its own 401 either.
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: "configuracion.descuentos.preview",
    });
    if (!scope) return response;

    const result = await applyDiscountsForSale({
      tiendaId,
      products: products.map((p) => ({
        productoTiendaId: String(p?.productoTiendaId ?? ""),
        cantidad: Number(p?.cantidad ?? 0) || 0,
        precio: Number(p?.precio ?? 0) || 0,
      })),
      discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error calculando descuento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
