import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { NextRequest, NextResponse } from "next/server";
import { tasaCambioCreateSchema } from "@/schemas/tasaCambio";
import { buildTasaSnapshot } from "@/lib/currency";
import {
  assertNegocioConfigAccess,
  assertNegocioConfigReadAccess,
} from "@/lib/negocioConfigAccess";
import { emitQabExchangeRateEvent } from "@/lib/qab/qabCatalogEmitters";
import { QabCurrencyPayloadError } from "@/lib/qab/qabCurrencyPayload";
import { QAB_CATALOG_EMISSION_ERRORS } from "@/constants/qab";

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

    const negocio = await prisma.negocio.findUnique({
      where: { id },
      select: { monedaBase: true },
    });
    if (!negocio)
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 },
      );

    const tasas = await prisma.tasaCambio.findMany({
      where: { negocioId: id },
      include: { creadoPor: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: "desc" },
    });

    const vigentes = buildTasaSnapshot(tasas);

    return NextResponse.json({
      tasas,
      vigentes,
      monedaBase: negocio.monedaBase,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al cargar tasas de cambio" },
      { status: 500 },
    );
  }
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
    const result = tasaCambioCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten() },
        { status: 400 },
      );
    }
    const negocio = await prisma.negocio.findUnique({
      where: { id },
      select: { monedaBase: true },
    });
    if (!negocio)
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 },
      );

    if (result.data.monedaCode === "CUP") {
      return NextResponse.json(
        {
          error: "No se puede registrar tasa para CUP (es el ancla universal)",
        },
        { status: 400 },
      );
    }

    const occurredAt = new Date();

    // The EXCHANGE_RATE event — preceded by its CURRENCY when this business
    // never synced that code — is enqueued in the SAME transaction that
    // persists the rate. A rollback takes both with it.
    const tasaCambio = await prisma.$transaction(async (tx) => {
      const created = await tx.tasaCambio.create({
        data: {
          negocioId: id,
          monedaCode: result.data.monedaCode,
          tasa: result.data.tasa,
          creadoPorId: session.user.id,
        },
        include: { creadoPor: { select: { id: true, nombre: true } } },
      });

      const moneda = await tx.moneda.findUnique({
        where: { code: created.monedaCode },
        select: { code: true, nombre: true, simbolo: true, activo: true },
      });

      await emitQabExchangeRateEvent(tx, {
        negocioId: id,
        moneda,
        tasa: { code: created.monedaCode, tasa: created.tasa },
        occurredAt,
      });

      return created;
    });

    return NextResponse.json(tasaCambio, { status: 201 });
  } catch (error) {
    // A rate that rounds to zero at six decimals cannot travel: the contract
    // requires `> 0`. Nothing was written — the throw happened inside the
    // transaction. Only reachable with the online store enabled; with it off
    // the emitter returns before building anything and this route behaves
    // exactly as it did before F-006.
    if (
      error instanceof QabCurrencyPayloadError &&
      error.code === QAB_CATALOG_EMISSION_ERRORS.exchangeRateTooSmall
    ) {
      return NextResponse.json(
        { error: QAB_CATALOG_EMISSION_ERRORS.exchangeRateTooSmall },
        { status: 400 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Error al registrar tasa de cambio" },
      { status: 500 },
    );
  }
}
