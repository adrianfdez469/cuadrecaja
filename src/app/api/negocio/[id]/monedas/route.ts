import { prisma } from "@/lib/prisma";
import type { PrismaClientLike } from "@/lib/prisma";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { NextRequest, NextResponse } from "next/server";
import { negocioMonedaCreateSchema } from "@/schemas/moneda";
import {
  assertNegocioConfigAccess,
  assertNegocioConfigReadAccess,
} from "@/lib/negocioConfigAccess";
import { emitQabCurrencyForNegocio } from "@/lib/qab/qabCatalogEmitters";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(req);
    const { id } = await params;

    // Lectura: la necesita el POS de cualquier usuario del negocio, no solo el admin.
    const accessError = assertNegocioConfigReadAccess(session, id);
    if (accessError) return accessError;

    const monedas = await prisma.negocioMoneda.findMany({
      where: { negocioId: id },
      include: {
        moneda: {
          include: {
            denominaciones: {
              where: { activo: true },
              orderBy: { orden: "desc" },
            },
          },
        },
      },
      orderBy: { monedaCode: "asc" },
    });
    return NextResponse.json(monedas);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al cargar monedas del negocio" },
      { status: 500 },
    );
  }
}

/**
 * The CURRENCY event enabling a currency owes, enqueued in the SAME transaction
 * that persists the `NegocioMoneda` row. `name`/`symbol` are the INTERNATIONAL
 * ones of the global `Moneda` catalog, never a merchant's own wording. The
 * emitter is a no-op when this business has the online store switched off.
 */
async function emitQabCurrency(
  tx: PrismaClientLike,
  negocioId: string,
  moneda: { code: string; nombre: string; simbolo: string; activo: boolean },
  occurredAt: Date,
): Promise<void> {
  await emitQabCurrencyForNegocio(tx, {
    negocioId,
    moneda: {
      code: moneda.code,
      nombre: moneda.nombre,
      simbolo: moneda.simbolo,
      activo: moneda.activo,
    },
    occurredAt,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(req);
    const { id } = await params;

    const accessError = assertNegocioConfigAccess(session, id);
    if (accessError) return accessError;

    const body = await req.json();
    const result = negocioMonedaCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten() },
        { status: 400 },
      );
    }
    // The instant of the mutation, shared by the payload and by
    // `OutboxEvento.ocurridoAt`.
    const occurredAt = new Date();

    const exists = await prisma.negocioMoneda.findUnique({
      where: {
        negocioId_monedaCode: {
          negocioId: id,
          monedaCode: result.data.monedaCode,
        },
      },
    });
    if (exists) {
      if (exists.activo) {
        return NextResponse.json(
          { error: "Esa moneda ya está habilitada en este negocio" },
          { status: 409 },
        );
      }
      // Record exists but was disabled — reactivate it
      const reactivated = await prisma.$transaction(async (tx) => {
        const row = await tx.negocioMoneda.update({
          where: {
            negocioId_monedaCode: {
              negocioId: id,
              monedaCode: result.data.monedaCode,
            },
          },
          data: {
            activo: true,
            admiteEfectivo: result.data.admiteEfectivo,
            admiteTransferencia: result.data.admiteTransferencia,
          },
          include: { moneda: true },
        });
        await emitQabCurrency(tx, id, row.moneda, occurredAt);
        return row;
      });
      return NextResponse.json(reactivated, { status: 200 });
    }
    const negocioMoneda = await prisma.$transaction(async (tx) => {
      const row = await tx.negocioMoneda.create({
        data: { negocioId: id, ...result.data },
        include: { moneda: true },
      });
      await emitQabCurrency(tx, id, row.moneda, occurredAt);
      return row;
    });
    return NextResponse.json(negocioMoneda, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al habilitar moneda" },
      { status: 500 },
    );
  }
}
