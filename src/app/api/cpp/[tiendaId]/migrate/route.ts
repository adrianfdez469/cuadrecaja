import { NextRequest, NextResponse } from 'next/server';
import { migrarDatosHistoricosCPP } from '@/lib/reports/cpp-report';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    const { tiendaId } = await params;
    const { dryRun } = await req.json();

    console.log(`🔄 Iniciando migración CPP para tienda ${tiendaId}, dryRun: ${dryRun}`);

    const reporte = await migrarDatosHistoricosCPP(tiendaId, dryRun);

    console.log(`✅ Migración completada:`, reporte);

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