import axios from "axios";

import axiosClient from "@/lib/axiosClient";
import {
  TIENDA_ONLINE_API_BASE,
  TIENDA_ONLINE_API_ERRORS,
} from "@/constants/tiendaOnline";
import type { IQabSlugUpstreamCode } from "@/lib/qab/qabSlugClient";
import { openingHoursIssueSchema } from "@/schemas/qabOpeningHours";
import type { IOpeningHoursIssue } from "@/schemas/qabOpeningHours";
import {
  tiendaOnlineBulkResultSchema,
  tiendaOnlineBulkTooLargeSchema,
  tiendaOnlineConfiguracionSchema,
  tiendaOnlineEstadoSchema,
  tiendaOnlineLocalUpdateResultSchema,
  tiendaOnlinePayloadRejectedSchema,
  tiendaOnlineProductoUpdateResultSchema,
  tiendaOnlineProductosPageSchema,
  tiendaOnlineSlugErrorSchema,
  tiendaOnlineSlugForecastSchema,
} from "@/schemas/tiendaOnline";
import type {
  ITiendaOnlineBulkResult,
  ITiendaOnlineConfiguracion,
  ITiendaOnlineEstado,
  ITiendaOnlineLocalUpdate,
  ITiendaOnlineLocalUpdateResult,
  ITiendaOnlineProductoUpdateResult,
  ITiendaOnlineProductosPage,
  ITiendaOnlineProductosQuery,
  ITiendaOnlinePublicacionUpdate,
  ITiendaOnlineSlugForecast,
} from "@/schemas/tiendaOnline";
import type { IQabCatalogEmissionError } from "@/lib/qab/qabCatalogEmission";
import { z } from "zod";

const CONFIGURACION_PATH = `${TIENDA_ONLINE_API_BASE}/configuracion`;
const SLUG_AVAILABILITY_PATH = `${TIENDA_ONLINE_API_BASE}/slug-availability`;
const PRODUCTOS_PATH = `${TIENDA_ONLINE_API_BASE}/productos`;

/** Normalised failures, so no screen ever reads `error.response.status`. */
export class TiendaOnlineForbiddenError extends Error {
  constructor() {
    super(TIENDA_ONLINE_API_ERRORS.forbidden);
    this.name = "TiendaOnlineForbiddenError";
  }
}

export class TiendaOnlineOpeningHoursRejected extends Error {
  readonly issues: IOpeningHoursIssue[];

  constructor(issues: IOpeningHoursIssue[]) {
    super(TIENDA_ONLINE_API_ERRORS.openingHoursInvalid);
    this.name = "TiendaOnlineOpeningHoursRejected";
    this.issues = issues;
  }
}

export class TiendaOnlineSlugUpstreamError extends Error {
  readonly qabError: IQabSlugUpstreamCode;
  readonly retryable: boolean;

  constructor(qabError: IQabSlugUpstreamCode, retryable: boolean) {
    super(TIENDA_ONLINE_API_ERRORS.slugUpstream);
    this.name = "TiendaOnlineSlugUpstreamError";
    this.qabError = qabError;
    this.retryable = retryable;
  }
}

const openingHoursRejectionSchema = z.object({
  error: z.literal(TIENDA_ONLINE_API_ERRORS.openingHoursInvalid),
  issues: z.array(openingHoursIssueSchema),
});

/**
 * `axiosClient` replaces the body of ANY 403 with a generic permissions error
 * (E-009), so a FORBIDDEN from these routes never arrives with a readable body.
 * A rejection that is NOT an AxiosError can only have come from that
 * substitution: the retry interceptor re-throws AxiosErrors, the 401 branch
 * re-throws the original one — and none of these routes ever answers 401.
 *
 * Same reasoning, same comment, as `toProvisioningError` in
 * `src/services/qabNegocioService.ts`.
 */
function isForbidden(error: unknown): boolean {
  return !axios.isAxiosError(error);
}

/** GET /api/tienda-online/estado */
export const getTiendaOnlineEstado = async (): Promise<ITiendaOnlineEstado> => {
  const response = await axiosClient.get(`${TIENDA_ONLINE_API_BASE}/estado`);
  return tiendaOnlineEstadoSchema.parse(response.data);
};

/** GET /api/tienda-online/configuracion */
export const getTiendaOnlineConfiguracion =
  async (): Promise<ITiendaOnlineConfiguracion> => {
    try {
      const response = await axiosClient.get(CONFIGURACION_PATH);
      return tiendaOnlineConfiguracionSchema.parse(response.data);
    } catch (error) {
      if (isForbidden(error)) throw new TiendaOnlineForbiddenError();
      throw error;
    }
  };

/**
 * PATCH /api/tienda-online/configuracion/[tiendaId]
 *
 * Throws `TiendaOnlineOpeningHoursRejected` when the server named the broken
 * calendar rules, so the screen can point at them one by one instead of showing
 * a generic message (acceptance criterion 8).
 */
export const updateTiendaOnlineLocal = async (
  tiendaId: string,
  body: ITiendaOnlineLocalUpdate,
): Promise<ITiendaOnlineLocalUpdateResult> => {
  try {
    const response = await axiosClient.patch(
      `${CONFIGURACION_PATH}/${tiendaId}`,
      body,
    );
    return tiendaOnlineLocalUpdateResultSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();

    const rejection = openingHoursRejectionSchema.safeParse(
      axios.isAxiosError(error) ? error.response?.data : undefined,
    );
    if (rejection.success) {
      throw new TiendaOnlineOpeningHoursRejected(rejection.data.issues);
    }
    throw error;
  }
};

/**
 * GET /api/tienda-online/slug-availability
 *
 * NOT called on every keystroke: the screen asks on demand or with a debounce.
 * The route talks to a third party and the contract says outright that the
 * forecast reserves nothing.
 */
export const getTiendaOnlineSlugForecast = async (params: {
  slug?: string;
  name?: string;
  tiendaId?: string;
}): Promise<ITiendaOnlineSlugForecast> => {
  try {
    const response = await axiosClient.get(SLUG_AVAILABILITY_PATH, { params });
    return tiendaOnlineSlugForecastSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();

    const upstream = tiendaOnlineSlugErrorSchema.safeParse(
      axios.isAxiosError(error) ? error.response?.data : undefined,
    );
    if (upstream.success) {
      throw new TiendaOnlineSlugUpstreamError(
        upstream.data.qabError,
        upstream.data.retryable,
      );
    }
    throw error;
  }
};

/* -------------------------------------------------------------------------- */
/* F-006 — the publishing tab                                                  */
/* -------------------------------------------------------------------------- */

/** Normalised 409 of both PATCHes, so no screen reads `error.response.status`. */
export class TiendaOnlinePayloadRejected extends Error {
  readonly code: IQabCatalogEmissionError;
  readonly productoTiendaId: string | null;

  constructor(code: IQabCatalogEmissionError, productoTiendaId: string | null) {
    super(TIENDA_ONLINE_API_ERRORS.payloadInvalid);
    this.name = "TiendaOnlinePayloadRejected";
    this.code = code;
    this.productoTiendaId = productoTiendaId;
  }
}

/** Normalised 409 of the bulk action when the category is too large. */
export class TiendaOnlineBulkTooLarge extends Error {
  readonly productos: number;
  readonly max: number;

  constructor(productos: number, max: number) {
    super(TIENDA_ONLINE_API_ERRORS.bulkTooLarge);
    this.name = "TiendaOnlineBulkTooLarge";
    this.productos = productos;
    this.max = max;
  }
}

/**
 * Turns the two 409 bodies into their own errors. The `code` travels as an
 * opaque string and the screen maps it to a sentence: an unknown value falls
 * into the fallback sentence, never into its own name (ADR 0034).
 */
function throwIfRejected(error: unknown): void {
  const body = axios.isAxiosError(error) ? error.response?.data : undefined;

  const tooLarge = tiendaOnlineBulkTooLargeSchema.safeParse(body);
  if (tooLarge.success) {
    throw new TiendaOnlineBulkTooLarge(
      tooLarge.data.productos,
      tooLarge.data.max,
    );
  }

  const rejected = tiendaOnlinePayloadRejectedSchema.safeParse(body);
  if (rejected.success) {
    throw new TiendaOnlinePayloadRejected(
      rejected.data.code as IQabCatalogEmissionError,
      rejected.data.productoTiendaId,
    );
  }
}

/** GET /api/tienda-online/productos. Throws TiendaOnlineForbiddenError on 403. */
export const fetchTiendaOnlineProductos = async (
  query: ITiendaOnlineProductosQuery,
): Promise<ITiendaOnlineProductosPage> => {
  try {
    const response = await axiosClient.get(PRODUCTOS_PATH, { params: query });
    return tiendaOnlineProductosPageSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();
    throw error;
  }
};

/** PATCH /api/tienda-online/productos/[productoId]. */
export const updateProductoPublicacion = async (
  productoId: string,
  input: ITiendaOnlinePublicacionUpdate,
): Promise<ITiendaOnlineProductoUpdateResult> => {
  try {
    const response = await axiosClient.patch(
      `${PRODUCTOS_PATH}/${productoId}`,
      input,
    );
    return tiendaOnlineProductoUpdateResultSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();
    throwIfRejected(error);
    throw error;
  }
};

/** PATCH /api/tienda-online/productos/categoria/[categoriaId]. */
export const updateCategoriaPublicacionMasiva = async (
  categoriaId: string,
  input: ITiendaOnlinePublicacionUpdate,
): Promise<ITiendaOnlineBulkResult> => {
  try {
    const response = await axiosClient.patch(
      `${PRODUCTOS_PATH}/categoria/${categoriaId}`,
      input,
    );
    return tiendaOnlineBulkResultSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();
    throwIfRejected(error);
    throw error;
  }
};
