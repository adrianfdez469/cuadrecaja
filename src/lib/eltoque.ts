import { prisma } from "@/lib/prisma";
import {
  ELTOQUE_CURRENCY_MAP,
  ELTOQUE_FUENTE,
  ELTOQUE_TIMEOUT_MS,
  ELTOQUE_TRMI_URL,
  ELTOQUE_TTL_MINUTES,
} from "@/constants/eltoque";
import {
  eltoqueRawSchema,
  type ITasaReferencia,
  type ITasasReferenciaMotivo,
  type ITasasReferenciaResponse,
} from "@/schemas/tasaReferencia";

/**
 * Tasas de referencia de elTOQUE, cacheadas en BD y compartidas por TODA la plataforma.
 *
 * El dato es global (no depende del negocio), así que la caché tampoco lo es: el primer
 * negocio que consulta tras vencer el TTL sale a internet y guarda el snapshot; el resto
 * lee de `TasaReferenciaExterna` sin generar ni una petición a elTOQUE. Esto es lo que
 * mantiene el consumo dentro de la cuota del token (~5.000 peticiones/mes).
 *
 * Este es el único módulo que lee `ELTOQUE_API_TOKEN` y el único que escribe en
 * `TasaReferenciaExterna`. Nunca lanza: si la integración no está configurada o la
 * fuente falla, degrada devolviendo el último snapshot conocido o una respuesta vacía.
 */

type SnapshotPersistido = {
  tasas: unknown;
  fechaDato: Date;
  fetchedAt: Date;
};

const noDisponible = (
  motivo: ITasasReferenciaMotivo,
): ITasasReferenciaResponse => ({
  disponible: false,
  motivo,
  tasas: [],
  actualizadoEn: null,
  stale: false,
  fuente: "elTOQUE",
});

/** Convierte el JSON persistido en la respuesta que consume la UI. */
const desdeSnapshot = (
  snapshot: SnapshotPersistido,
  stale: boolean,
): ITasasReferenciaResponse => {
  const tasas: ITasaReferencia[] = Object.entries(
    (snapshot.tasas ?? {}) as Record<string, number>,
  )
    .filter(([, tasa]) => typeof tasa === "number" && tasa > 0)
    .map(([monedaCode, tasa]) => ({ monedaCode, tasa }));

  return {
    disponible: tasas.length > 0,
    tasas,
    actualizadoEn: snapshot.fechaDato.toISOString(),
    stale,
    fuente: "elTOQUE",
  };
};

/**
 * Normaliza la respuesta cruda de elTOQUE: traduce sus códigos a ISO 4217, descarta las
 * monedas fuera del catálogo (BTC, TRX, USDT…) y los valores no positivos.
 * Exportada para poder testearla sin red.
 */
export function normalizarRespuestaEltoque(
  raw: unknown,
): { tasas: Record<string, number>; fechaDato: Date } | null {
  const parsed = eltoqueRawSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[elTOQUE] Respuesta con forma inesperada:",
      parsed.error.message,
    );
    return null;
  }

  const tasas: Record<string, number> = {};
  for (const [codigoEltoque, valor] of Object.entries(parsed.data.tasas)) {
    const monedaCode = ELTOQUE_CURRENCY_MAP[codigoEltoque.toUpperCase()];
    if (!monedaCode || !Number.isFinite(valor) || valor <= 0) continue;
    tasas[monedaCode] = valor;
  }

  // Sin ninguna moneda útil no hay nada que cachear: se trata como fallo para no dejar
  // un snapshot vacío bloqueando los reintentos durante todo el TTL.
  if (Object.keys(tasas).length === 0) {
    console.error(
      "[elTOQUE] La respuesta no contiene ninguna moneda del catálogo",
    );
    return null;
  }

  const { date, hour, minutes, seconds } = parsed.data;
  const fechaDato = date
    ? new Date(
        `${date}T${String(hour ?? 0).padStart(2, "0")}:${String(minutes ?? 0).padStart(2, "0")}:${String(seconds ?? 0).padStart(2, "0")}`,
      )
    : new Date();

  return {
    tasas,
    fechaDato: Number.isNaN(fechaDato.getTime()) ? new Date() : fechaDato,
  };
}

async function consultarEltoque(token: string) {
  // Sin date_from/date_to elTOQUE devuelve la tasa de las últimas 24 h, que es justo lo
  // que queremos. `no-store`: la caché es la BD, no queremos una segunda capa encima.
  const res = await fetch(ELTOQUE_TRMI_URL, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(ELTOQUE_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 401/422 → token inválido · 429 → cuota o rate limit excedidos
    console.error(`[elTOQUE] HTTP ${res.status}: ${body.slice(0, 300)}`);
    return null;
  }

  return normalizarRespuestaEltoque(await res.json());
}

export async function getTasasReferencia(): Promise<ITasasReferenciaResponse> {
  let ultimo: SnapshotPersistido | null = null;

  try {
    ultimo = await prisma.tasaReferenciaExterna.findFirst({
      where: { fuente: ELTOQUE_FUENTE },
      orderBy: { fetchedAt: "desc" },
      select: { tasas: true, fechaDato: true, fetchedAt: true },
    });
  } catch (error) {
    console.error("[elTOQUE] Error al leer la caché en BD:", error);
  }

  // Camino normal: el snapshot sigue vigente → cero llamadas externas.
  if (ultimo) {
    const edadMinutos = (Date.now() - ultimo.fetchedAt.getTime()) / 60000;
    if (edadMinutos < ELTOQUE_TTL_MINUTES) {
      return desdeSnapshot(ultimo, false);
    }
  }

  const token = process.env.ELTOQUE_API_TOKEN?.trim();
  if (!token) {
    // Integración sin configurar: si hay un dato viejo es mejor mostrarlo que nada.
    return ultimo
      ? desdeSnapshot(ultimo, true)
      : noDisponible("NO_CONFIGURADO");
  }

  try {
    const fresco = await consultarEltoque(token);
    if (fresco) {
      await prisma.tasaReferenciaExterna.create({
        data: {
          fuente: ELTOQUE_FUENTE,
          tasas: fresco.tasas,
          fechaDato: fresco.fechaDato,
        },
      });
      return desdeSnapshot({ ...fresco, fetchedAt: new Date() }, false);
    }
  } catch (error) {
    console.error("[elTOQUE] Error al consultar la API:", error);
  }

  return ultimo ? desdeSnapshot(ultimo, true) : noDisponible("ERROR_UPSTREAM");
}
