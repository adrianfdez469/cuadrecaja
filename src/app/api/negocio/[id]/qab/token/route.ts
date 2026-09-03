import { NextRequest, NextResponse } from "next/server";
import {
  QAB_PROVISIONING_API_ERRORS,
  QAB_SETTINGS_UNAVAILABLE,
} from "@/constants/qabProvisioning";
import { prisma } from "@/lib/prisma";
import {
  NEGOCIO_QAB_SELECT,
  toNegocioQabSettings,
} from "@/lib/negocio/qabSettings";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import {
  negocioQabSettingsItemSchema,
  qabTokenPasteSchema,
} from "@/schemas/qabNegocio";
import { hasSuperAdminPrivileges } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * The rescue path of criterion 13: the only way back when QAB rotates a
 * credential with `npm run mint:token`, because the provisioning route never
 * rotates.
 *
 * This is the ONE route of the feature through which a secret arrives in the
 * clear, and it has a logging rule of its own: `request.json()` lives in its own
 * try/catch that answers 400 without logging ANYTHING, because the SyntaxError
 * of a malformed JSON can carry a fragment of the text - and that text is the
 * credential that was just pasted. Nothing below logs the body or Zod's `issues`
 * either.
 */
export async function PUT(
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
      return NextResponse.json(
        { error: QAB_PROVISIONING_API_ERRORS.invalidBody },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const parsed = qabTokenPasteSchema.safeParse(rawBody);
    if (!parsed.success) {
      // No `issues`: a Zod issue can drag the value that caused it.
      return NextResponse.json(
        { error: QAB_PROVISIONING_API_ERRORS.invalidToken },
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
      data: {
        qabToken: parsed.data.token,
        qabTokenActualizadoAt: new Date(),
      },
      // The `select` does not name the token column: what was just written is
      // never read back (ADR 0024).
      select: NEGOCIO_QAB_SELECT,
    });

    return NextResponse.json(
      negocioQabSettingsItemSchema.parse(toNegocioQabSettings(row, true)),
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
