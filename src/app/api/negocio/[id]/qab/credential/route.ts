import { NextRequest, NextResponse } from "next/server";
import {
  QAB_PROVISIONING_API_ERRORS,
  QAB_PROVISIONING_ORPHAN_REASONS,
  QAB_PROVISIONING_RESULTS,
} from "@/constants/qabProvisioning";
import { prisma } from "@/lib/prisma";
import {
  NEGOCIO_QAB_SELECT,
  loadNegocioIdsWithQabToken,
  toNegocioQabSettings,
} from "@/lib/negocio/qabSettings";
import { QabConfigError, resolveQabBaseUrl } from "@/lib/qab/qabEnv";
import { recordQabOrphanedToken } from "@/lib/qab/qabProvisioningAudit";
import { mintQabBusinessCredential } from "@/lib/qab/qabProvisioningClient";
import type { IQabProvisioningUpstreamCode } from "@/lib/qab/qabProvisioningClient";
import {
  QabProvisioningConfigError,
  resolveQabProvisioningSecret,
} from "@/lib/qab/qabProvisioningEnv";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { negocioQabProvisioningResultSchema } from "@/schemas/qabProvisioning";
import { hasSuperAdminPrivileges } from "@/utils/auth";

export const dynamic = "force-dynamic";
/** The outbound fetch aborts at QAB_PROVISIONING_TIMEOUT_MS, well inside this. */
export const maxDuration = 30;

const [RESULT_MINTED, RESULT_ALREADY_MINTED, RESULT_CONFIRMED_ORPHANED] =
  QAB_PROVISIONING_RESULTS;

const [
  ORPHAN_PERSIST_FAILED,
  ORPHAN_RESPONSE_LOST,
  ORPHAN_EXTERNAL_ID_MISMATCH,
  ORPHAN_CONFIRMED,
] = QAB_PROVISIONING_ORPHAN_REASONS;

/**
 * The upstream codes that mean "the request went out and QAB may well have
 * minted": the token could exist on their side and never arrive here.
 */
const RESPONSE_LOST_CODES = new Set<IQabProvisioningUpstreamCode>([
  "TRANSPORT",
  "INVALID_RESPONSE_BODY",
  "UNEXPECTED_STATUS",
]);

function errorResponse(
  error: string,
  status: number,
  qabError: IQabProvisioningUpstreamCode | null = null,
  retryable = false,
) {
  return NextResponse.json(
    { error, qabError, retryable },
    { status, headers: NO_STORE_HEADERS },
  );
}

/**
 * Registers this business in QAB and takes custody of the minted credential.
 *
 * The order of operations below is NOT negotiable (ADR 0023). The 201 carries
 * the credential the only time it is ever visible: if it is received and not
 * written, that business is left with a credential minted on QAB's side that
 * cuadrecaja does not know and cannot ask for again, and the only way out is a
 * rotation with downtime agreed between the two organisations.
 *
 * No status of QAB's is ever mirrored (ADR 0022): every upstream failure leaves
 * as a 502 carrying the code in the body. A 401 would sign the SUPER_ADMIN out
 * (E-007, criterion 18) and a 403 would be replaced by `axiosClient` with a
 * generic permissions error, destroying the body and sinking criterion 8.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Authorisation. Nothing else happens.
    if (!(await hasSuperAdminPrivileges())) {
      return errorResponse(QAB_PROVISIONING_API_ERRORS.forbidden, 403);
    }

    // 2. The integrator secret. Fail-closed, and WITHOUT any fetch (criterion 9).
    let secret: string | null;
    try {
      secret = resolveQabProvisioningSecret();
    } catch (error) {
      if (error instanceof QabProvisioningConfigError) {
        logRouteError(error);
        return errorResponse(QAB_PROVISIONING_API_ERRORS.configInvalid, 500);
      }
      throw error;
    }
    if (secret === null) {
      return errorResponse(QAB_PROVISIONING_API_ERRORS.secretNotSet, 503);
    }

    // 3. The QAB origin. Also WITHOUT any fetch.
    let baseUrl: string | null;
    try {
      baseUrl = resolveQabBaseUrl();
    } catch (error) {
      if (error instanceof QabConfigError) {
        logRouteError(error);
        return errorResponse(QAB_PROVISIONING_API_ERRORS.configInvalid, 500);
      }
      throw error;
    }
    if (baseUrl === null) {
      return errorResponse(QAB_PROVISIONING_API_ERRORS.baseUrlNotSet, 503);
    }

    // 4. The business. The id comes from the PATH, never from the body, and the
    // `externalId` that travels to QAB is this row's id and not a client value.
    const { id } = await params;
    const negocio = await prisma.negocio.findUnique({
      where: { id },
      select: { ...NEGOCIO_QAB_SELECT, nombre: true },
    });
    if (!negocio) {
      return errorResponse(QAB_PROVISIONING_API_ERRORS.negocioNotFound, 404);
    }

    const tokenPresenteAntes = (await loadNegocioIdsWithQabToken(prisma, [id])).has(id);

    // 5. The one outbound call. Made ALWAYS, also when cuadrecaja believes it
    // already has a token: it is the only way the idempotent 200 of criterion 7
    // is really exercised against QAB.
    const outcome = await mintQabBusinessCredential({
      baseUrl,
      secret,
      externalId: negocio.id,
      name: negocio.nombre,
    });

    // 6a. Minted: the write is the FIRST thing that happens, and the only thing
    // that stands between the 201 and the answer to the browser.
    if (outcome.kind === "minted") {
      try {
        await prisma.negocio.update({
          where: { id },
          data: {
            qabToken: outcome.token,
            qabTokenActualizadoAt: new Date(),
          },
          // Does not name the token column: what was just written is not read back.
          select: NEGOCIO_QAB_SELECT,
        });
      } catch (error) {
        recordQabOrphanedToken({
          negocioId: id,
          externalId: negocio.id,
          reason: ORPHAN_PERSIST_FAILED,
        });
        logRouteError(error);
        // No retry: QAB never hands that credential over again.
        return errorResponse(QAB_PROVISIONING_API_ERRORS.tokenOrphaned, 500);
      }
    }

    // 6b. Upstream failure. Two of these leave a record: RESPONSE_LOST, because
    // the request went out and QAB may well have minted; and
    // EXTERNAL_ID_MISMATCH, which does NOT claim anything was minted - it claims
    // the response cannot be attributed to this business, so its state is left
    // unestablished and nothing was written here.
    if (outcome.kind === "upstream_error") {
      if (RESPONSE_LOST_CODES.has(outcome.code)) {
        recordQabOrphanedToken({
          negocioId: id,
          externalId: negocio.id,
          reason: ORPHAN_RESPONSE_LOST,
        });
      } else if (outcome.code === ORPHAN_EXTERNAL_ID_MISMATCH) {
        recordQabOrphanedToken({
          negocioId: id,
          externalId: negocio.id,
          reason: ORPHAN_EXTERNAL_ID_MISMATCH,
        });
      }
      return errorResponse(
        QAB_PROVISIONING_API_ERRORS.upstream,
        502,
        outcome.code,
        outcome.retryable,
      );
    }

    // 7. Only now the answer is built, re-reading the boolean.
    const row = await prisma.negocio.findUnique({
      where: { id },
      select: NEGOCIO_QAB_SELECT,
    });
    if (!row) {
      return errorResponse(QAB_PROVISIONING_API_ERRORS.negocioNotFound, 404);
    }
    const tokenPresenteAhora = (await loadNegocioIdsWithQabToken(prisma, [id])).has(id);

    let result: (typeof QAB_PROVISIONING_RESULTS)[number] = RESULT_MINTED;
    let createdInQab = false;

    if (outcome.kind === "minted") {
      createdInQab = outcome.created;
    } else {
      // 6c. The idempotent 200: nothing was written, neither the token nor its
      // date (criterion 7). And here the confirmed orphan is classified - in the
      // route, never by crossing two fields on the screen. BOTH readings must
      // agree: if they disagree, another request wrote the token in between and
      // this is an ALREADY_MINTED, not an orphan.
      const orphaned = !tokenPresenteAntes && !tokenPresenteAhora;
      result = orphaned ? RESULT_CONFIRMED_ORPHANED : RESULT_ALREADY_MINTED;
      if (orphaned) {
        recordQabOrphanedToken({
          negocioId: id,
          externalId: negocio.id,
          reason: ORPHAN_CONFIRMED,
        });
      }
    }

    const body = negocioQabProvisioningResultSchema.parse({
      result,
      createdInQab,
      settings: toNegocioQabSettings(row, tokenPresenteAhora),
    });

    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    // Only name and message. Never the whole error object, never the body of the
    // request to QAB.
    logRouteError(error);
    return errorResponse(QAB_PROVISIONING_API_ERRORS.configInvalid, 500);
  }
}
