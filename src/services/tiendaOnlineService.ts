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
  tiendaOnlineConfiguracionSchema,
  tiendaOnlineEstadoSchema,
  tiendaOnlineLocalUpdateResultSchema,
  tiendaOnlineSlugErrorSchema,
  tiendaOnlineSlugForecastSchema,
} from "@/schemas/tiendaOnline";
import type {
  ITiendaOnlineConfiguracion,
  ITiendaOnlineEstado,
  ITiendaOnlineLocalUpdate,
  ITiendaOnlineLocalUpdateResult,
  ITiendaOnlineSlugForecast,
} from "@/schemas/tiendaOnline";
import { z } from "zod";

const CONFIGURACION_PATH = `${TIENDA_ONLINE_API_BASE}/configuracion`;
const SLUG_AVAILABILITY_PATH = `${TIENDA_ONLINE_API_BASE}/slug-availability`;

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
