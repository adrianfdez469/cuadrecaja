import { NextRequest, NextResponse } from 'next/server';
import { migrarDatosHistoricosCPP } from '@/lib/reports/cpp-report';
import { getSession } from '@/utils/auth';
import { assertTiendaTenant } from '@/lib/tenantScope';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    const { tiendaId } = await params;
    const { dryRun } = await req.json();

    // F-021: no permission — this verb never demanded one (ADR 0078).
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    const reporte = await migrarDatosHistoricosCPP(tiendaId, dryRun);


    return NextResponse.json({
      success: true,
      reporte,
      mensaje: dryRun 
        ? 'Simulación completada - No se realizaron cambios'
        : 'Migración completada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en migración CPP:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Error interno del servidor',
        mensaje: 'Error al procesar la migración'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    const { tiendaId } = await params;

    // F-021: no permission — this verb never demanded one (ADR 0078).
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    // Siempre hacer un dry run para GET
    const reporte = await migrarDatosHistoricosCPP(tiendaId, true);

    return NextResponse.json({
      success: true,
      reporte,
      mensaje: 'Vista previa de migración - No se realizaron cambios'
    });

  } catch (error) {
    console.error('❌ Error en vista previa de migración:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Error interno del servidor'
      },
      { status: 500 }
    );
  }
} 