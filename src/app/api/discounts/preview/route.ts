import { NextRequest, NextResponse } from "next/server";
import { applyDiscountsForSale } from "@/lib/discounts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tiendaId, products, discountCodes } = body || {};
    if (!tiendaId || !Array.isArray(products)) {
      return NextResponse.json({ error: "Faltan tiendaId o products" }, { status: 400 });
    }
    const result = await applyDiscountsForSale({
      tiendaId,
      products: products.map((p: any) => ({
        productoTiendaId: String(p.productoTiendaId),
        cantidad: Number(p.cantidad) || 0,
        precio: Number(p.precio) || 0,
      })),
      discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error calculando descuento" }, { status: 500 });
  }
}
