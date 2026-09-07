import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { NextRequest, NextResponse } from "next/server";
import { negocioMonedaUpdateSchema } from "@/schemas/moneda";
import { assertNegocioConfigAccess } from "@/lib/negocioConfigAccess";
import { emitQabBusinessDisplayCurrencies } from "@/lib/qab/qabCatalogEmitters";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; code: string }> },
) {
  try {
    const session = await getSessionFromRequest(req);
    const { id, code } = await params;

    const accessError = assertNegocioConfigAccess(session, id);
    if (accessError) return accessError;

    const body = await req.json();
    const result = negocioMonedaUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten() },
        { status: 400 },
      );
    }
    // The instant of the mutation, shared by the payload and by
    // `OutboxEvento.ocurridoAt`. Taken ONCE per request, before the transaction.
    const occurredAt = new Date();

    // Transactional so the event can never be written without its mutation, nor
    // the mutation without its event: the emitter runs INSIDE this transaction.
    const negocioMoneda = await prisma.$transaction(async (tx) => {
      // Pre-state read INSIDE the transaction, keyed by the
      // `@@unique([negocioId, monedaCode])`: a `code` of another business
      // resolves to no row at all.
      const previous = await tx.negocioMoneda.findUnique({
        where: { negocioId_monedaCode: { negocioId: id, monedaCode: code } },
        select: { activo: true },
      });

      const row = await tx.negocioMoneda.update({
        where: { negocioId_monedaCode: { negocioId: id, monedaCode: code } },
        data: result.data,
        include: { moneda: true },
      });

      // The storefront's currency list changed only when `activo` was actually
      // part of the body AND its value is not the one already persisted. It stays
      // OPTIONAL in `negocioMonedaUpdateSchema`, which this feature does not
      // touch.
      const activoChanged =
        result.data.activo !== undefined && result.data.activo !== previous?.activo;
      if (activoChanged) {
        await emitQabBusinessDisplayCurrencies(tx, { negocioId: id, occurredAt });
      }

      return row;
    });
    return NextResponse.json(negocioMoneda);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al actualizar moneda" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; code: string }> },
) {
  try {
    const session = await getSessionFromRequest(req);
    const { id, code } = await params;

    const accessError = assertNegocioConfigAccess(session, id);
    if (accessError) return accessError;

    const occurredAt = new Date();

    await prisma.$transaction(async (tx) => {
      const previous = await tx.negocioMoneda.findUnique({
        where: { negocioId_monedaCode: { negocioId: id, monedaCode: code } },
        select: { activo: true },
      });

      // Never a real row delete: disabling is `activo: false`. That is why no
      // BUSINESS event of this repository ever carries `operacion: "DELETE"`.
      await tx.negocioMoneda.update({
        where: { negocioId_monedaCode: { negocioId: id, monedaCode: code } },
        data: { activo: false },
      });

      // A repeated DELETE over an already disabled currency does not change the
      // set and owes nothing.
      if (previous?.activo === true) {
        await emitQabBusinessDisplayCurrencies(tx, { negocioId: id, occurredAt });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al deshabilitar moneda" },
      { status: 500 },
    );
  }
}
