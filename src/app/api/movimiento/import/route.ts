import { ImportarExcelMovimiento } from "@/lib/movimiento";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, items } = body;

    // Validación básica de la estructura de datos
    if (!data || !items) {
      return NextResponse.json(
        { 
          success: false,
          message: "Datos requeridos faltantes",
          errorCause: "Se requieren 'data' e 'items' en el cuerpo de la petición"
        },
        { status: 400 }
      );
    }

    // Validar estructura de data
    if (!data.usuarioId || !data.negocioId || !data.localId) {
      return NextResponse.json(
        { 
          success: false,
          message: "Datos de negocio incompletos",
          errorCause: "usuarioId, negocioId y localId son obligatorios"
        },
        { status: 400 }
      );
    }

    // Validar que items sea un array
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          message: "Items inválidos",
          errorCause: "items debe ser un array no vacío"
        },
        { status: 400 }
      );
    }

    console.log(`📥 Endpoint de importación llamado con ${items.length} items`);

    // Llamar a la función de importación
    const resultado = await ImportarExcelMovimiento(data, items);

    // Retornar el resultado
    if (resultado.success) {
      return NextResponse.json(resultado, { status: 200 });
    } else {
      return NextResponse.json(resultado, { status: 400 });
    }

  } catch (error) {
    console.error('💥 Error en endpoint de importación:', error);
    
    // Manejar errores específicos
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { 
          success: false,
          message: "Error en formato de datos",
          errorCause: "El JSON enviado no es válido"
        },
        { status: 400 }
      );
    }

    // Error genérico
    return NextResponse.json(
      { 
        success: false,
        message: "Error interno del servidor",
        errorCause: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}

// Método OPTIONS para CORS (si es necesario)
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 