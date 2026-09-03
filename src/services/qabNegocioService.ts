import axios from "axios";
import axiosClient from "@/lib/axiosClient";
import { QAB_PROVISIONING_API_ERRORS } from "@/constants/qabProvisioning";
import type { IQabProvisioningUpstreamCode } from "@/lib/qab/qabProvisioningClient";
import {
  negocioQabSettingsItemSchema,
  negociosQabSettingsListSchema,
} from "@/schemas/qabNegocio";
import type {
  INegociosQabSettingsList,
  INegocioQabSettingsItem,
} from "@/schemas/qabNegocio";
import {
  negocioQabProvisioningErrorSchema,
  negocioQabProvisioningResultSchema,
} from "@/schemas/qabProvisioning";
import type {
  INegocioQabProvisioningError,
  INegocioQabProvisioningResult,
} from "@/schemas/qabProvisioning";

const API_URL = "/api/negocio";
const QAB_SEGMENT = "qab";

/**
 * Axios and nothing else, like the rest of `src/services/`.
 *
 * NONE of these functions logs its argument or its response:
 * `saveQabTokenManually` takes a credential in the clear.
 */

/** Normalised provisioning failure, so the screen never has to look at HTTP statuses. */
export class QabProvisioningError extends Error {
  readonly code: INegocioQabProvisioningError["error"];
  readonly qabError: IQabProvisioningUpstreamCode | null;
  readonly retryable: boolean;

  constructor(body: INegocioQabProvisioningError) {
    super(body.error);
    this.name = "QabProvisioningError";
    this.code = body.error;
    this.qabError = body.qabError;
    this.retryable = body.retryable;
  }
}

function qabUrl(negocioId: string, ...segments: string[]): string {
  return [API_URL, negocioId, QAB_SEGMENT, ...segments].join("/");
}

/**
 * `axiosClient` replaces the body of ANY 403 with a generic permissions error
 * (see E-007's sibling clause in `src/lib/axiosClient.ts`), so a FORBIDDEN from
 * these routes never arrives with a readable body. A rejection that is not an
 * AxiosError can only have come from that substitution: the retry interceptor
 * re-throws AxiosErrors and the 401 branch re-throws the original one - and none
 * of these routes ever answers 401.
 */
function toProvisioningError(error: unknown): QabProvisioningError | null {
  if (!axios.isAxiosError(error)) {
    return new QabProvisioningError({
      error: QAB_PROVISIONING_API_ERRORS.forbidden,
      qabError: null,
      retryable: false,
    });
  }

  const parsed = negocioQabProvisioningErrorSchema.safeParse(error.response?.data);
  return parsed.success ? new QabProvisioningError(parsed.data) : null;
}

/** GET /api/negocio/qab */
export const getNegociosQabSettings = async (): Promise<INegociosQabSettingsList> => {
  const response = await axiosClient.get(`${API_URL}/${QAB_SEGMENT}`);
  return negociosQabSettingsListSchema.parse(response.data);
};

/** PATCH /api/negocio/[id]/qab */
export const setTiendaOnlineHabilitada = async (
  negocioId: string,
  tiendaOnlineHabilitada: boolean,
): Promise<INegocioQabSettingsItem> => {
  const response = await axiosClient.patch(qabUrl(negocioId), {
    tiendaOnlineHabilitada,
  });
  return negocioQabSettingsItemSchema.parse(response.data);
};

/**
 * POST /api/negocio/[id]/qab/credential
 * Throws `QabProvisioningError` when the error response satisfies
 * `negocioQabProvisioningErrorSchema`; in any other case it re-throws the
 * original error.
 */
export const provisionNegocioInQab = async (
  negocioId: string,
): Promise<INegocioQabProvisioningResult> => {
  try {
    const response = await axiosClient.post(qabUrl(negocioId, "credential"));
    return negocioQabProvisioningResultSchema.parse(response.data);
  } catch (error) {
    const provisioningError = toProvisioningError(error);
    if (provisioningError) throw provisioningError;
    throw error;
  }
};

/** PUT /api/negocio/[id]/qab/token - the rescue path. */
export const saveQabTokenManually = async (
  negocioId: string,
  token: string,
): Promise<INegocioQabSettingsItem> => {
  const response = await axiosClient.put(qabUrl(negocioId, "token"), { token });
  return negocioQabSettingsItemSchema.parse(response.data);
};

/**
 * `true` when the request never got an answer: no network, a timeout, a DNS
 * failure. It is not a fault of the system - this screen talks to another
 * organisation - and the design paints it as such.
 */
export const isQabNetworkFailure = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response === undefined;
