import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { initialCashFundInputSchema } from "@/schemas/initialCashFund";

type Params = { tiendaId: string; cierreId: string };

// Devuelve el historial completo del fondo inicial de este período, ordenado
// del más reciente al más antiguo — el primer elemento es el vigente.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { tiendaId, cierreId } = await params;
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.cierre.acceder",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocio.id },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    const periodo = await prisma.cierrePeriodo.findFirst({
      where: { id: cierreId, tiendaId },
    });
    if (!periodo) {
      return NextResponse.json(
        { error: "Período no encontrado" },
        { status: 404 },
      );
    }

    const entries = await prisma.initialCashFund.findMany({
      where: { cierrePeriodoId: cierreId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { nombre: true } } },
    });

    return NextResponse.json(
      entries.map((e) => ({
        id: e.id,
        cierrePeriodoId: e.cierrePeriodoId,
        amounts: e.amounts,
        createdById: e.createdById,
        createdByName: e.createdBy.nombre,
        createdAt: e.createdAt,
      })),
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Error al obtener el fondo inicial" },
      { status: 500 },
    );
  }
}

// Registra una nueva edición del fondo inicial (INSERT append-only, nunca
// UPDATE) — el cliente manda el snapshot completo de todas las monedas.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { tiendaId, cierreId } = await params;
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.cierre.fondoinicial",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    const body = initialCashFundInputSchema.parse(await req.json());

    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocio.id },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    const periodo = await prisma.cierrePeriodo.findFirst({
      where: { id: cierreId, tiendaId },
    });
    if (!periodo) {
      return NextResponse.json(
        { error: "Período no encontrado" },
        { status: 404 },
      );
    }
    if (periodo.fechaFin) {
      return NextResponse.json(
        {
          error:
            "El período ya está cerrado, no se puede modificar el fondo inicial",
        },
        { status: 400 },
      );
    }

    const monedasActivas = await prisma.negocioMoneda.findMany({
      where: { negocioId: user.negocio.id, activo: true },
      select: { monedaCode: true },
    });
    const monedasActivasSet = new Set(monedasActivas.map((m) => m.monedaCode));
    const monedasInvalidas = Object.keys(body.amounts).filter(
      (monedaCode) => !monedasActivasSet.has(monedaCode),
    );
    if (monedasInvalidas.length > 0) {
      return NextResponse.json(
        {
          error: `Moneda(s) no válida(s) para este negocio: ${monedasInvalidas.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const entry = await prisma.initialCashFund.create({
      data: {
        cierrePeriodoId: cierreId,
        amounts: body.amounts,
        createdById: user.id,
      },
      include: { createdBy: { select: { nombre: true } } },
    });

    return NextResponse.json(
      {
        id: entry.id,
        cierrePeriodoId: entry.cierrePeriodoId,
        amounts: entry.amounts,
        createdById: entry.createdById,
        createdByName: entry.createdBy.nombre,
        createdAt: entry.createdAt,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Error al guardar el fondo inicial" },
      { status: 500 },
    );
  }
}
