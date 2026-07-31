import { ImportarExcelMovimiento } from "@/lib/movimiento/import";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  claimIdempotencyKey,
  findIdempotentResponse,
  storeIdempotentResponse,
  DuplicateRequestError,
} from "@/lib/idempotency";
import { IDEMPOTENCY_KEY_HEADER } from "@/constants/idempotency";

const IDEMPOTENCY_ENDPOINT = "POST /api/movimiento/import";

export async function POST(req: NextRequest) {
  let claim: { key: string; scopeId: string; endpoint: string } | undefined;

  try {
    const body = await req.json();
    const { data, items } = body;

    // Validación básica de la estructura de datos
    if (!data || !items) {
      return NextResponse.json(
        {
          success: false,
          message: "Datos requeridos faltantes",
          errorCause:
            "Se requieren 'data' e 'items' en el cuerpo de la petición",
        },
        { status: 400 },
      );
    }

    // Validar estructura de data
    if (!data.usuarioId || !data.negocioId || !data.localId) {
      return NextResponse.json(
        {
          success: false,
          message: "Datos de negocio incompletos",
          errorCause: "usuarioId, negocioId y localId son obligatorios",
        },
        { status: 400 },
      );
    }

    // Validar que items sea un array
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Items inválidos",
          errorCause: "items debe ser un array no vacío",
        },
        { status: 400 },
      );
    }

    const idempotencyKey = req.headers.get(IDEMPOTENCY_KEY_HEADER);
    if (!idempotencyKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Falta la clave de idempotencia",
          errorCause: `Se requiere la cabecera ${IDEMPOTENCY_KEY_HEADER}`,
        },
        { status: 400 },
      );
    }
    claim = {
      key: idempotencyKey,
      scopeId: data.negocioId,
      endpoint: IDEMPOTENCY_ENDPOINT,
    };

    const replayed = await findIdempotentResponse(claim);
    if (replayed) {
      return NextResponse.json(
        { ...replayed, duplicado: true },
        { status: 200 },
      );
    }

    // A diferencia del resto de endpoints, la clave NO se reserva dentro de la
    // transacción del trabajo: la importación procesa en chunks de 50, cada uno
    // con su propia transacción, y admite éxito parcial a propósito. Se reserva
    // antes, en su propia escritura.
    //
    // Y NO se libera si la importación falla, justamente por ese éxito parcial:
    // liberarla dejaría reimportar los chunks que sí entraron. Ante un fallo, el
    // usuario vuelve a lanzar la importación y el cliente genera una clave
    // nueva, que es una decisión deliberada suya y no un reintento ciego.
    await claimIdempotencyKey(prisma, claim);

    // Llamar a la función de importación
    const resultado = await ImportarExcelMovimiento(data, items);
    await storeIdempotentResponse(prisma, claim.key, resultado);

    // Retornar el resultado
    if (resultado.success) {
      return NextResponse.json(resultado, { status: 200 });
    } else {
      return NextResponse.json(resultado, { status: 400 });
    }
  } catch (error) {
    // Otra petición con la misma clave ya importó este archivo.
    if (error instanceof DuplicateRequestError && claim) {
      const stored = await findIdempotentResponse(claim);
      return stored
        ? NextResponse.json({ ...stored, duplicado: true }, { status: 200 })
        : NextResponse.json(
            {
              success: false,
              message: "La importación ya está en curso",
              errorCause: "Otra petición con la misma clave sigue procesando",
            },
            { status: 409 },
          );
    }

    console.error("💥 Error en endpoint de importación:", error);

    // Manejar errores específicos
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          message: "Error en formato de datos",
          errorCause: "El JSON enviado no es válido",
        },
        { status: 400 },
      );
    }

    // Error genérico
    return NextResponse.json(
      {
        success: false,
        message: "Error interno del servidor",
        errorCause:
          error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}

// Método OPTIONS para CORS (si es necesario)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
