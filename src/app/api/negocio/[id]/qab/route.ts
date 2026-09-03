import { NextRequest, NextResponse } from "next/server";
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
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import {
  negocioQabSettingsItemSchema,
  negocioTiendaOnlineToggleSchema,
} from "@/schemas/qabNegocio";
import { hasSuperAdminPrivileges } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * The online store switch of one business. SUPER_ADMIN only (criterion 2): a
 * business ADMIN with every permission of its own business gets a 403, because
 * what opens this is the role and not a permission.
 *
 * The business id always comes from the PATH, never from the body.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json(
        { error: QAB_PROVISIONING_API_ERRORS.forbidden },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    const { id } = await params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      // Nothing is logged: a SyntaxError can carry a fragment of the input.
      return NextResponse.json(
        { error: QAB_PROVISIONING_API_ERRORS.invalidBody },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    // `issues` is neither returned nor logged, here or in any of the four routes.
    const parsed = negocioTiendaOnlineToggleSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: QAB_PROVISIONING_API_ERRORS.invalidBody },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const existing = await prisma.negocio.findUnique({
      where: { id },
      select: NEGOCIO_QAB_SELECT,
    });
    if (!existing) {
      return NextResponse.json(
        { error: QAB_PROVISIONING_API_ERRORS.negocioNotFound },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const row = await prisma.negocio.update({
      where: { id },
      data: { tiendaOnlineHabilitada: parsed.data.tiendaOnlineHabilitada },
      select: NEGOCIO_QAB_SELECT,
    });

    const withToken = await loadNegocioIdsWithQabToken(prisma, [id]);

    return NextResponse.json(
      negocioQabSettingsItemSchema.parse(toNegocioQabSettings(row, withToken.has(id))),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: QAB_SETTINGS_UNAVAILABLE },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
