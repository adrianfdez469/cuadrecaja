import { NextRequest, NextResponse } from 'next/server';
import { applyDiscountsForSale, DiscountApplicationInputProduct } from '@/lib/discounts';
import { getSessionFromRequest } from '@/utils/authFromRequest';

/**
 * POST /api/app/descuentos/preview
 * 
 * Previsualiza los descuentos que se aplicarían a una venta.
 * Requiere autenticación por token.
 * 
 * Body: {
 *   tiendaId: string,
 *   products: Array<{ productoTiendaId: string, cantidad: number, precio: number }>,
 *   discountCodes?: string[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tiendaId, products, discountCodes } = body as {
      tiendaId?: string;
      products?: Array<Partial<DiscountApplicationInputProduct>>;
      discountCodes?: string[];
    };

    if (!tiendaId) {
      return NextResponse.json(
        { error: 'tiendaId es requerido' },
        { status: 400 }
      );
    }

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'products es requerido y debe ser un array no vacío' },
        { status: 400 }
      );
    }

    // Calcular descuentos
    const result = await applyDiscountsForSale({
      tiendaId,
      products: products.map((p) => ({
        productoTiendaId: String(p?.productoTiendaId ?? ''),
        cantidad: Number(p?.cantidad ?? 0) || 0,
        precio: Number(p?.precio ?? 0) || 0,
      })),
      discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
    });

    return NextResponse.json({
      success: true,
      originalTotal: result.originalTotal,
      discountTotal: result.discountTotal,
      finalTotal: result.finalTotal,
      applied: result.applied.map((a) => ({
        discountRuleId: a.discountRuleId,
        ruleName: a.ruleName,
        amount: a.amount,
        type: a.type,
        productsAffected: a.productsAffected
      }))
    });

  } catch (error) {
    console.error('❌ [APP/DESCUENTOS/PREVIEW] Error:', error);
    const message = error instanceof Error ? error.message : 'Error calculando descuento';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
