import { NextResponse } from "next/server";
import {
  QAB_PROVISIONING_API_ERRORS,
  QAB_SETTINGS_UNAVAILABLE,
} from "@/constants/qabProvisioning";
import { prisma } from "@/lib/prisma";
import {
  NEGOCIO_QAB_SELECT,
  loadNegocioIdsWithQabToken,
  toNegocioQabSettings,
} from "@/lib/negocio/qabSettings";
import { resolveAutoProvisioningAvailability } from "@/lib/qab/qabProvisioningEnv";
import { negociosQabSettingsListSchema } from "@/schemas/qabNegocio";
import { hasSuperAdminPrivileges } from "@/utils/auth";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";

export const dynamic = "force-dynamic";

/**
 * The QAB block of every business. Its own endpoint, deliberately: it does not
 * travel inside `GET /api/negocio` (ADR 0027).
 *
 * Never a 401: authorisation failure is a 403, because `src/lib/axiosClient.ts`
 * turns any 401 into a `signOut()` (E-007, ADR 0019).
 */
export async function GET() {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json(
        { error: QAB_PROVISIONING_API_ERRORS.forbidden },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    const availability = resolveAutoProvisioningAvailability();

    const [rows, withToken] = await Promise.all([
      prisma.negocio.findMany({ select: NEGOCIO_QAB_SELECT, orderBy: { id: "asc" } }),
      loadNegocioIdsWithQabToken(prisma),
    ]);

    const body = negociosQabSettingsListSchema.parse({
      autoProvisioningAvailable: availability.available,
      autoProvisioningUnavailableReason: availability.reason,
      negocios: rows.map((row) => toNegocioQabSettings(row, withToken.has(row.id))),
    });

    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    // Only name and message: a Prisma or Axios error object drags query
    // parameters, headers and bodies along with it.
    logRouteError(error);
    return NextResponse.json(
      { error: QAB_SETTINGS_UNAVAILABLE },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
