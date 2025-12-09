import { NextRequest, NextResponse } from "next/server";
import { applyDiscountsForSale, DiscountApplicationInputProduct } from "@/lib/discounts";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const { tiendaId, products, discountCodes } = (body as {
      tiendaId?: string;
      products?: Array<Partial<DiscountApplicationInputProduct>>;
      discountCodes?: string[];
    }) || {};
    if (!tiendaId || !Array.isArray(products)) {
      return NextResponse.json({ error: "Faltan tiendaId o products" }, { status: 400 });
    }
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
