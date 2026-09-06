import { NextRequest, NextResponse } from 'next/server';
import { analizarCPPTienda, detectarDesviacionesCPP } from '@/lib/reports/cpp-report';
import { getSession } from '@/utils/auth';
import { assertTiendaTenant } from '@/lib/tenantScope';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo') || 'analisis';
    const umbral = parseInt(searchParams.get('umbral') || '10');

    // F-021: no permission — this verb never demanded one (ADR 0078).
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    switch (tipo) {
      case 'analisis':
        const analisis = await analizarCPPTienda(tiendaId);
        return NextResponse.json(analisis);
      
      case 'desviaciones':
        const desviaciones = await detectarDesviacionesCPP(tiendaId, umbral);
        return NextResponse.json(desviaciones);
      
      default:
        return NextResponse.json(
          { error: 'Tipo de consulta no válido. Use: analisis, desviaciones' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error en API CPP:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 