import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import {
  InvalidReportRangeError,
  previousRange,
  resolveBucketing,
  resolveDateRange,
} from "./period";
import type { IDateRange, IReportBucketing } from "@/schemas/reports/common";

/**
 * Everything a report needs to know about *what* it is reporting on, resolved
 * once per request: which store, in which currency, over which window.
 */
export type ReportScope = {
  tiendaId: string;
  tiendaNombre: string;
  negocioId: string | null;
  /** All monetary output is expressed in this currency. */
  baseCurrency: string;
  range: IDateRange;
  previous: IDateRange;
  bucketing: IReportBucketing;
};

/**
 * Single shape rather than a discriminated union: `strict` is off in this
 * project, so narrowing on a literal boolean does not work reliably. Callers
 * check `scope` for null.
 */
export type ReportScopeResult = {
  scope: ReportScope | null;
  status: number;
  error: string | null;
};

/**
 * Resolves auth, store access and the date range in one step.
 *
 * Kept free of HTTP types so it stays usable outside a route handler; callers
 * map `status`/`error` onto their own response.
 */
export async function resolveReportScope(
  searchParams: URLSearchParams,
  tiendaId: string,
  permission: string,
): Promise<ReportScopeResult> {
  const session = await getSession();
  const user = session?.user;

  if (!user || !verificarPermisoUsuario(user.permisos, permission, user.rol)) {
    return { scope: null, status: 401, error: "No autorizado" };
  }

  const tienda = await prisma.tienda.findFirst({
    where:
      user.rol === "SUPER_ADMIN"
        ? { id: tiendaId }
        : { id: tiendaId, usuario: { some: { id: user.id } } },
    select: {
      id: true,
      nombre: true,
      negocioId: true,
      negocio: { select: { monedaBase: true } },
    },
  });

  if (!tienda) {
    return {
      scope: null,
      status: 404,
      error: "Tienda no encontrada o sin acceso",
    };
  }

  let range: IDateRange;
  try {
    range = resolveDateRange(
      searchParams.get("periodo"),
      searchParams.get("fechaInicio"),
      searchParams.get("fechaFin"),
    );
  } catch (error) {
    if (error instanceof InvalidReportRangeError) {
      return { scope: null, status: 400, error: error.message };
    }
    throw error;
  }

  return {
    status: 200,
    error: null,
    scope: {
      tiendaId: tienda.id,
      tiendaNombre: tienda.nombre,
      negocioId: tienda.negocioId,
      baseCurrency: tienda.negocio?.monedaBase ?? "CUP",
      range,
      previous: previousRange(range),
      bucketing: resolveBucketing(range),
    },
  };
}

/** Reads the shared `detail` flag: false trims responses to summary blocks. */
export function wantsDetail(searchParams: URLSearchParams): boolean {
  return searchParams.get("detail") !== "false";
}

/** Reads a positive integer query param, falling back when absent or invalid. */
export function readIntParam(
  searchParams: URLSearchParams,
  name: string,
  fallback: number,
): number {
  const raw = searchParams.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
