import { prisma } from "@/lib/prisma";
import {
  ELTOQUE_CURRENCY_MAP,
  ELTOQUE_FORCE_MIN_MINUTES,
  ELTOQUE_FUENTE,
  ELTOQUE_RATE_LIMIT_RETRY_MS,
  ELTOQUE_TIMEOUT_MS,
  ELTOQUE_TIMEZONE,
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
 * El botón "Actualizar" de la UI llega aquí con `force`, que no salta la caché: solo baja
 * el TTL exigido a `ELTOQUE_FORCE_MIN_MINUTES`. Así el usuario puede pedir un dato más
 * nuevo (la TRMI se mueve en minutos) sin que aporrear el botón queme la cuota.
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

  // Un snapshot sin monedas útiles no debería existir (el normalizador lo evita), pero
  // si aparece hay que decir por qué: sin `motivo` la UI se quedaba en blanco sin avisar.
  if (tasas.length === 0) return noDisponible("ERROR_UPSTREAM");

  return {
    disponible: true,
    tasas,
    // `fetchedAt` y no `fechaDato`: lo que le interesa al usuario es cuándo se consultó,
    // y es un instante real (no una hora de pared que depende de la zona del servidor).
    actualizadoEn: snapshot.fetchedAt.toISOString(),
    stale,
    fuente: "elTOQUE",
  };
};

/**
 * Offset real de La Habana (CDT −04:00 / CST −05:00) en un instante dado, en ms.
 * Se calcula con Intl para no hardcodear el horario de verano.
 */
function offsetZonaMs(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ELTOQUE_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);

  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);

  const comoUtc = Date.UTC(
    valor("year"),
    valor("month") - 1,
    valor("day"),
    valor("hour") % 24, // algunos motores reportan "24" para la medianoche
    valor("minute"),
    valor("second"),
  );

  return comoUtc - instante.getTime();
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Interpreta la hora de pared que reporta elTOQUE como hora de La Habana y devuelve el
 * instante real. Sin esto `new Date("2026-07-29T18:55:03")` se leía en la zona del
 * servidor: en Vercel (UTC) el dato quedaba adelantado 4 h respecto al instante real y
 * el panel lo mostraba 4 h atrasado a los usuarios en Cuba.
 */
function instanteDesdeHoraHabana(
  date: string,
  hour: number,
  minutes: number,
  seconds: number,
): Date | null {
  const comoUtc = new Date(
    `${date}T${dosDigitos(hour)}:${dosDigitos(minutes)}:${dosDigitos(seconds)}Z`,
  );
  if (Number.isNaN(comoUtc.getTime())) return null;

  // Dos pasadas: la primera aproxima el instante y la segunda evalúa el offset ahí, para
  // acertar también en los días de cambio de horario.
  const aproximado = new Date(comoUtc.getTime() - offsetZonaMs(comoUtc));
  return new Date(comoUtc.getTime() - offsetZonaMs(aproximado));
}

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
    if (!monedaCode) continue;
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0)
      continue;
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
    ? instanteDesdeHoraHabana(date, hour ?? 0, minutes ?? 0, seconds ?? 0)
    : null;

  return { tasas, fechaDato: fechaDato ?? new Date() };
}

async function pedirTrmi(token: string) {
  // Sin date_from/date_to elTOQUE devuelve el valor vigente ahora, que es justo lo que
  // queremos. `no-store`: la caché es la BD, no queremos una segunda capa encima.
  return fetch(ELTOQUE_TRMI_URL, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(ELTOQUE_TIMEOUT_MS),
  });
}

async function consultarEltoque(token: string) {
  let res = await pedirTrmi(token);

  // elTOQUE corta a 1 petición/segundo. Con varios negocios (o varios renders) chocando
  // justo cuando vence el TTL, el que pierde recibía un 429 y la integración se veía
  // caída aunque el token estuviera perfecto. Un único reintento espaciado lo resuelve.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, ELTOQUE_RATE_LIMIT_RETRY_MS));
    res = await pedirTrmi(token);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 401/422 → token inválido · 429 → cuota o rate limit excedidos
    console.error(`[elTOQUE] HTTP ${res.status}: ${body.slice(0, 300)}`);
    return null;
  }

  return normalizarRespuestaEltoque(await res.json());
}

/**
 * Trae el dato fresco y lo persiste. Single-flight: si ya hay una consulta en curso en
 * esta instancia, las demás esperan su resultado en vez de sumar peticiones (y escrituras)
 * duplicadas contra el rate limit de 1/s.
 */
let refrescoEnCurso: Promise<SnapshotPersistido | null> | null = null;

function refrescar(token: string): Promise<SnapshotPersistido | null> {
  if (!refrescoEnCurso) {
    refrescoEnCurso = (async () => {
      try {
        const fresco = await consultarEltoque(token);
        if (!fresco) return null;

        const fila = await prisma.tasaReferenciaExterna.create({
          data: {
            fuente: ELTOQUE_FUENTE,
            tasas: fresco.tasas,
            fechaDato: fresco.fechaDato,
          },
          select: { tasas: true, fechaDato: true, fetchedAt: true },
        });
        return fila;
      } catch (error) {
        console.error("[elTOQUE] Error al consultar la API:", error);
        return null;
      } finally {
        refrescoEnCurso = null;
      }
    })();
  }

  return refrescoEnCurso;
}

interface OpcionesTasasReferencia {
  /**
   * Refresco manual del usuario (botón "Actualizar"): baja el TTL exigido a
   * `ELTOQUE_FORCE_MIN_MINUTES` para poder traer un dato más nuevo sin dejar la cuota
   * al descubierto.
   */
  force?: boolean;
}

export async function getTasasReferencia({
  force = false,
}: OpcionesTasasReferencia = {}): Promise<ITasasReferenciaResponse> {
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

  const ttlMinutos = force ? ELTOQUE_FORCE_MIN_MINUTES : ELTOQUE_TTL_MINUTES;

  // Camino normal: el snapshot sigue vigente → cero llamadas externas.
  if (ultimo) {
    const edadMinutos = (Date.now() - ultimo.fetchedAt.getTime()) / 60000;
    if (edadMinutos < ttlMinutos) {
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

  const fresco = await refrescar(token);
  if (fresco) return desdeSnapshot(fresco, false);

  return ultimo ? desdeSnapshot(ultimo, true) : noDisponible("ERROR_UPSTREAM");
}
