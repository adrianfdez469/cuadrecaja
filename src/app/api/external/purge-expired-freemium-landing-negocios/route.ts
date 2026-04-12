import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { deleteNegocioCompleto } from '@/lib/negocio/deleteNegocioCompleto';
import { corsHeaders } from '@/middleware/cors';

const ENV_KEY = 'PURGE_LANDING_NEGOCIOS_API_KEY';

function timingSafeEqualString(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function withCors(body: unknown, status: number, origin: string | null): NextResponse {
  const headers = corsHeaders(origin);
  return NextResponse.json(body, { status, headers });
}

/**
 * POST /api/external/purge-expired-freemium-landing-negocios
 * Elimina negocios que cumplan TODAS las condiciones:
 * - creadoPorActivacionLanding = true
 * - plan con precio 0 o -1 (gratis / freemium; -1 alineado con planes “negociables” en el sistema)
 * - limitTime anterior a hace más de 3 días (suscripción vencida > 3 días)
 *
 * Autenticación: header x-api-key igual a process.env.PURGE_LANDING_NEGOCIOS_API_KEY
 * Pensado para cron / dominio externo (CORS según middleware/cors).
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  const expectedKey = process.env[ENV_KEY];
  if (!expectedKey) {
    console.error(`❌ ${ENV_KEY} no está configurada`);
    return withCors({ error: 'Servicio no configurado' }, 500, origin);
  }

  const provided =
    request.headers.get('x-api-key') ?? request.headers.get('X-API-Key') ?? '';

  if (!timingSafeEqualString(provided, expectedKey)) {
    return withCors({ error: 'No autorizado' }, 401, origin);
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  try {
    const candidatos = await prisma.negocio.findMany({
      where: {
        creadoPorActivacionLanding: true,
        planId: { not: null },
        plan: { precio: { lte: 0 } },
        limitTime: { lte: threeDaysAgo },
      },
      select: { id: true, nombre: true },
      orderBy: { limitTime: 'asc' },
    });

    const eliminados: { id: string; nombre: string }[] = [];
    const fallos: { id: string; nombre: string; error: string }[] = [];

    for (const n of candidatos) {
      try {
        await deleteNegocioCompleto(n.id);
        eliminados.push({ id: n.id, nombre: n.nombre });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`❌ Purga: error eliminando negocio ${n.id}:`, err);
        fallos.push({ id: n.id, nombre: n.nombre, error: message });
      }
    }

    return withCors(
      {
        ok: true,
        criterios: {
          creadoPorActivacionLanding: true,
          planPrecioLte: 0,
          limitTimeLte: threeDaysAgo.toISOString(),
        },
        candidatos: candidatos.length,
        eliminados: eliminados.length,
        detalleEliminados: eliminados,
        fallos,
      },
      200,
      origin
    );
  } catch (error) {
    console.error('❌ Purga freemium landing:', error);
    return withCors({ error: 'Error interno al listar o eliminar negocios' }, 500, origin);
  }
}
