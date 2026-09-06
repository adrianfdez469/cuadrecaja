import axios from "axios";

import axiosClient from "@/lib/axiosClient";
import {
  TIENDA_ONLINE_API_BASE,
  TIENDA_ONLINE_API_ERRORS,
} from "@/constants/tiendaOnline";
import type {
  IQabOrderStatusFailureCode,
  IQabOrderStatusReportable,
} from "@/lib/qab/qabOrderStatusClient";
import type { IQabSlugUpstreamCode } from "@/lib/qab/qabSlugClient";
import { openingHoursIssueSchema } from "@/schemas/qabOpeningHours";
import type { IOpeningHoursIssue } from "@/schemas/qabOpeningHours";
import {
  tiendaOnlineBulkResultSchema,
  tiendaOnlineBulkTooLargeSchema,
  tiendaOnlineConfiguracionSchema,
  tiendaOnlineEstadoSchema,
  tiendaOnlineLocalUpdateResultSchema,
  tiendaOnlineOrderDetailSchema,
  tiendaOnlineOrderNotLandableSchema,
  tiendaOnlineOrderStatusErrorSchema,
  tiendaOnlineOrderStatusResultSchema,
  tiendaOnlineOrdersPageSchema,
  tiendaOnlinePayloadRejectedSchema,
  tiendaOnlineProductoUpdateResultSchema,
  tiendaOnlineProductosPageSchema,
  tiendaOnlineSlugErrorSchema,
  tiendaOnlineSlugForecastSchema,
  tiendaOnlineSsoLinkSchema,
} from "@/schemas/tiendaOnline";
import type {
  ITiendaOnlineBulkResult,
  ITiendaOnlineConfiguracion,
  ITiendaOnlineEstado,
  ITiendaOnlineLocalUpdate,
  ITiendaOnlineLocalUpdateResult,
  IPedidoEntrantePago,
  ITiendaOnlineOrderDetail,
  ITiendaOnlineOrderNotLandable,
  ITiendaOnlineOrderStatusResult,
  ITiendaOnlineOrdersPage,
  ITiendaOnlineOrdersQuery,
  ITiendaOnlineProductoUpdateResult,
  ITiendaOnlineProductosPage,
  ITiendaOnlineProductosQuery,
  ITiendaOnlinePublicacionUpdate,
  ITiendaOnlineSlugForecast,
  ITiendaOnlineSsoLink,
} from "@/schemas/tiendaOnline";
import type { IQabCatalogEmissionError } from "@/lib/qab/qabCatalogEmission";
import { z } from "zod";

const CONFIGURACION_PATH = `${TIENDA_ONLINE_API_BASE}/configuracion`;
const SLUG_AVAILABILITY_PATH = `${TIENDA_ONLINE_API_BASE}/slug-availability`;
const PRODUCTOS_PATH = `${TIENDA_ONLINE_API_BASE}/productos`;
const PEDIDOS_PATH = `${TIENDA_ONLINE_API_BASE}/pedidos`;

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

/* -------------------------------------------------------------------------- */
/* F-011 — the orders inbox                                                    */
/* -------------------------------------------------------------------------- */

/** Normalised 404 of the two read routes, so no screen reads `error.response.status`. */
export class TiendaOnlineOrderNotFound extends Error {
  constructor() {
    super(TIENDA_ONLINE_API_ERRORS.pedidoNotFound);
    this.name = "TiendaOnlineOrderNotFound";
  }
}

/** GET /api/tienda-online/pedidos. Throws TiendaOnlineForbiddenError on 403. */
export const fetchTiendaOnlineOrders = async (
  query: ITiendaOnlineOrdersQuery,
): Promise<ITiendaOnlineOrdersPage> => {
  try {
    const response = await axiosClient.get(PEDIDOS_PATH, { params: query });
    return tiendaOnlineOrdersPageSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();
    throw error;
  }
};

/**
 * GET /api/tienda-online/pedidos/[pedidoId]. Throws TiendaOnlineOrderNotFound on
 * the 404 — which is the same answer for an order of another business, one of a
 * store you are not assigned to, and one that does not exist.
 */
export const fetchTiendaOnlineOrder = async (
  pedidoId: string,
): Promise<ITiendaOnlineOrderDetail> => {
  try {
    const response = await axiosClient.get(`${PEDIDOS_PATH}/${pedidoId}`);
    return tiendaOnlineOrderDetailSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new TiendaOnlineOrderNotFound();
    }
    throw error;
  }
};

/* -------------------------------------------------------------------------- */
/* F-012 — reporting an order's progress                                       */
/* -------------------------------------------------------------------------- */

/**
 * A QAB-side outcome of the status report. `qabError` is a closed code of ours,
 * never a string from the other side; `retryable` says whether the screen may
 * offer the button again, NOT that anything was retried.
 */
export class TiendaOnlineOrderStatusUpstreamError extends Error {
  readonly qabError: IQabOrderStatusFailureCode;
  readonly retryable: boolean;

  constructor(qabError: IQabOrderStatusFailureCode, retryable: boolean) {
    super(TIENDA_ONLINE_API_ERRORS.qabStatusUpstream);
    this.name = "TiendaOnlineOrderStatusUpstreamError";
    this.qabError = qabError;
    this.retryable = retryable;
  }
}

/**
 * A DELIVERED this POS cannot land: a local condition is missing (F-014,
 * ADR 0073). It is NOT a failure of queandabuscando and carries no code of the
 * other side — nothing was called and nothing was written, which is what makes
 * it safe to declare the collection again once the condition exists.
 *
 * It has to reach the screen distinguishable from the 502, and it does: the
 * `axiosClient` interceptor only rewrites the body of a 401 and a 403 (E-009),
 * so a 409 body arrives intact.
 */
export class TiendaOnlineOrderNotLandableError extends Error {
  readonly reason: ITiendaOnlineOrderNotLandable["reason"];

  constructor(reason: ITiendaOnlineOrderNotLandable["reason"]) {
    super(TIENDA_ONLINE_API_ERRORS.pedidoNotLandable);
    this.name = "TiendaOnlineOrderNotLandableError";
    this.reason = reason;
  }
}

/**
 * PATCH /api/tienda-online/pedidos/[pedidoId]/status.
 *
 * Throws, in this order of checks:
 *   TiendaOnlineForbiddenError           on the 403 (via `isForbidden`, E-009)
 *   TiendaOnlineOrderNotFound            on the 404
 *   TiendaOnlineOrderNotLandableError    on the 409 whose body satisfies
 *                                        `tiendaOnlineOrderNotLandableSchema`
 *   TiendaOnlineOrderStatusUpstreamError on a 502 whose body satisfies
 *                                        `tiendaOnlineOrderStatusErrorSchema`
 * and re-throws anything else untouched.
 *
 * A resolved value with `persisted: false` is NOT an error: QAB accepted and
 * this POS did not write it. The screen says so; it does not retry by itself.
 * `landing` comes back if and only if `persisted` is true.
 *
 * `pago` travels only for the destination that needs it, and the body schema is
 * `.strict()`: sending it for any other destination is a 400.
 *
 * No idempotency header is added: a PATCH without one does not enter the retry
 * interceptor, and that is one of the two mechanisms behind criterion 4.
 */
export const patchTiendaOnlineOrderStatus = async (
  pedidoId: string,
  status: IQabOrderStatusReportable,
  pago?: IPedidoEntrantePago,
): Promise<ITiendaOnlineOrderStatusResult> => {
  try {
    const response = await axiosClient.patch(
      `${PEDIDOS_PATH}/${pedidoId}/status`,
      { status, ...(pago !== undefined && { pago }) },
    );
    return tiendaOnlineOrderStatusResultSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new TiendaOnlineOrderNotFound();
    }

    const body = axios.isAxiosError(error) ? error.response?.data : undefined;

    const notLandable = tiendaOnlineOrderNotLandableSchema.safeParse(body);
    if (notLandable.success) {
      throw new TiendaOnlineOrderNotLandableError(notLandable.data.reason);
    }

    const upstream = tiendaOnlineOrderStatusErrorSchema.safeParse(body);
    if (upstream.success) {
      throw new TiendaOnlineOrderStatusUpstreamError(
        upstream.data.qabError,
        upstream.data.retryable,
      );
    }
    throw error;
  }
};

/* -------------------------------------------------------------------------- */
/* F-009 — the one-time SSO link towards the QAB panel                         */
/* -------------------------------------------------------------------------- */

const SSO_PATH = `${TIENDA_ONLINE_API_BASE}/sso`;

/** HTTP status of the "the deployment is not wired up" answer. Never re-exposed. */
const SSO_NOT_CONFIGURED_STATUS = 503;

/** The deployment has not been wired up. Nothing the merchant can fix. */
export class TiendaOnlineSsoNotConfiguredError extends Error {
  constructor() {
    super(TIENDA_ONLINE_API_ERRORS.ssoNotConfigured);
    this.name = "TiendaOnlineSsoNotConfiguredError";
  }
}

const ssoNotConfiguredSchema = z.object({
  error: z.literal(TIENDA_ONLINE_API_ERRORS.ssoNotConfigured),
});

/**
 * POST /api/tienda-online/sso.
 *
 * Throws, in this order of checks:
 *   TiendaOnlineForbiddenError          on the 403 (via `isForbidden`, E-009)
 *   TiendaOnlineSsoNotConfiguredError   on a 503 whose body carries the module's
 *                                       ssoNotConfigured code
 * and re-throws anything else untouched.
 *
 * No body and no idempotency header: a POST without one does not enter the retry
 * interceptor of `axiosClient`, so a network hiccup does not silently mint a
 * second token.
 *
 * The resolved `url` is a live credential. It is not stored, not put in a
 * Zustand store and not written to localStorage: it is opened and dropped.
 */
export const postTiendaOnlineSsoLink = async (): Promise<ITiendaOnlineSsoLink> => {
  try {
    const response = await axiosClient.post(SSO_PATH);
    return tiendaOnlineSsoLinkSchema.parse(response.data);
  } catch (error) {
    if (isForbidden(error)) throw new TiendaOnlineForbiddenError();

    const notConfigured =
      axios.isAxiosError(error) &&
      error.response?.status === SSO_NOT_CONFIGURED_STATUS &&
      ssoNotConfiguredSchema.safeParse(error.response?.data).success;
    if (notConfigured) throw new TiendaOnlineSsoNotConfiguredError();

    throw error;
  }
};
