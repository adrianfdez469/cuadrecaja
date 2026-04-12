import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { deleteNegocioCompleto } from '@/lib/negocio/deleteNegocioCompleto';
import { corsHeaders } from '@/middleware/cors';

const ENV_KEY = 'PURGE_LANDING_NEGOCIOS_API_KEY';

const DEFAULT_DIAS_VENCIDO = 3;
const MAX_DIAS_VENCIDO = 3650;

type IAdministradorResumen = { nombre: string; correo: string };

type ICandidatoPurge = {
  id: string;
  nombre: string;
  administrador: IAdministradorResumen | null;
};

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
 * Body JSON opcional:
 * - diasVencido: número ≥ 0 (default 3, máx. 3650). Candidatos: limitTime ≤ ahora − diasVencido días.
 * - eliminar: boolean (default true). Si false, solo lista candidatos sin borrar.
 *
 * Negocios que cumplan TODAS las condiciones:
 * - creadoPorActivacionLanding = true
 * - plan con precio ≤ 0 (gratis / freemium; incluye -1)
 * - limitTime anterior al umbral calculado con diasVencido
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

  let diasVencido = DEFAULT_DIAS_VENCIDO;
  let eliminar = true;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as unknown;
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const b = body as Record<string, unknown>;
        if (
          typeof b.diasVencido === 'number' &&
          Number.isFinite(b.diasVencido) &&
          b.diasVencido >= 0
        ) {
          diasVencido = Math.min(Math.floor(b.diasVencido), MAX_DIAS_VENCIDO);
        }
        if (typeof b.eliminar === 'boolean') {
          eliminar = b.eliminar;
        }
      }
    } catch {
      // cuerpo vacío o JSON inválido: se usan los valores por defecto
    }
  }

  const umbralLimitTime = new Date(Date.now() - diasVencido * 24 * 60 * 60 * 1000);

  try {
    const rows = await prisma.negocio.findMany({
      where: {
        creadoPorActivacionLanding: true,
        planId: { not: null },
        plan: { precio: { lte: 0 } },
        limitTime: { lte: umbralLimitTime },
      },
      select: {
        id: true,
        nombre: true,
        usuarios: {
          where: {
            locales: {
              some: {
                rol: { nombre: 'Administrador' },
              },
            },
          },
          select: { nombre: true, usuario: true },
          orderBy: { usuario: 'asc' },
          take: 1,
        },
      },
      orderBy: { limitTime: 'asc' },
    });

    const candidatos: ICandidatoPurge[] = rows.map((r) => {
      const u = r.usuarios[0];
      return {
        id: r.id,
        nombre: r.nombre,
        administrador: u ? { nombre: u.nombre, correo: u.usuario } : null,
      };
    });

    const eliminados: ICandidatoPurge[] = [];
    const fallos: { id: string; nombre: string; administrador: IAdministradorResumen | null; error: string }[] =
      [];

    if (eliminar) {
      for (const n of candidatos) {
        try {
          await deleteNegocioCompleto(n.id);
          eliminados.push(n);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`❌ Purga: error eliminando negocio ${n.id}:`, err);
          fallos.push({
            id: n.id,
            nombre: n.nombre,
            administrador: n.administrador,
            error: message,
          });
        }
      }
    }

    return withCors(
      {
        ok: true,
        parametros: { diasVencido, eliminar },
        criterios: {
          creadoPorActivacionLanding: true,
          planPrecioLte: 0,
          limitTimeLte: umbralLimitTime.toISOString(),
        },
        candidatos: candidatos.length,
        detalleCandidatos: candidatos,
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
