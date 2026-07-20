import { CreateMoviento } from "@/lib/movimiento";
import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { NextResponse } from "next/server";
import { startOfNextDay } from "@/utils/date";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { movimientoBatchCreateSchema } from "@/schemas/movimiento";
import type { ITipoMovimiento } from "@/schemas/movimiento";

// Permiso requerido para crear cada tipo de movimiento manual. Mantener en
// sync con MovimientoTipoCreableEnum (src/schemas/movimiento.ts).
const PERMISO_POR_TIPO: Record<string, string> = {
  COMPRA: "operaciones.movimientos.crear.compra",
  AJUSTE_ENTRADA: "operaciones.movimientos.crear.ajuste_entradas",
  AJUSTE_SALIDA: "operaciones.movimientos.crear.ajuste_salidas",
  TRASPASO_ENTRADA: "operaciones.movimientos.crear.recepcion",
  TRASPASO_SALIDA: "operaciones.movimientos.crear.transferencia",
  CONSIGNACION_ENTRADA: "operaciones.movimientos.crear.consignacion_entrada",
  CONSIGNACION_DEVOLUCION:
    "operaciones.movimientos.crear.consignacion_devolucion",
  MERMA: "operaciones.movimientos.crear.merma",
};

export async function GET(req: Request) {
  try {
    const session = await getSession();
    const user = session.user;

    const { searchParams } = new URL(req.url);

    const take = Number.parseInt(searchParams.get("take") || "20");
    const skip = Number.parseInt(searchParams.get("skip") || "0");
    const tiendaId = searchParams.get("tiendaId");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");
    const tipoRaw = searchParams.get("tipo");
    const tipos: MovimientoTipo[] = tipoRaw
      ? (tipoRaw.split(",").filter(Boolean) as MovimientoTipo[])
      : [];
    const productoTiendaId = searchParams.get("productoTiendaId");
    const referenciaId = searchParams.get("referenciaId");
    const search = searchParams.get("search");

    if (!tiendaId) {
      return NextResponse.json(
        { error: "tiendaId es requerido" },
        { status: 400 },
      );
    }

    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocio.id },
      select: { id: true },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.movimientos.acceder",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    // Obtener IDs coincidentes con búsqueda tolerante a tildes/mayúsculas usando unaccent
    let searchIds: string[] | undefined;
    if (search) {
      const normalizedSearch = search.trim().replace(/\s+/g, " ");
      const pattern = `%${normalizedSearch}%`;
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT ms.id
        FROM "MovimientoStock" ms
        LEFT JOIN "ProductoTienda" pt ON ms."productoTiendaId" = pt.id
        LEFT JOIN "Producto" p ON pt."productoId" = p.id
        LEFT JOIN "Usuario" u ON ms."usuarioId" = u.id
        LEFT JOIN "Proveedor" prov ON ms."proveedorId" = prov.id
        WHERE ms."tiendaId" = ${tiendaId}
          AND (
            unaccent(lower(COALESCE(ms.motivo, '')))    LIKE unaccent(lower(${pattern}))
            OR unaccent(lower(COALESCE(p.nombre, '')))    LIKE unaccent(lower(${pattern}))
            OR unaccent(lower(COALESCE(u.nombre, '')))    LIKE unaccent(lower(${pattern}))
            OR unaccent(lower(COALESCE(prov.nombre, ''))) LIKE unaccent(lower(${pattern}))
          )
      `;
      searchIds = rows.map((r) => r.id);
    }

    const filtros = {
      ...(fechaInicio && {
        fecha: { gte: new Date(fechaInicio).toISOString() },
      }),
      ...(fechaFin && {
        fecha: { lte: startOfNextDay(new Date(fechaFin)).toISOString() },
      }),
      ...(tipos.length === 1 && { tipo: tipos[0] }),
      ...(tipos.length > 1 && { tipo: { in: tipos } }),
      ...(productoTiendaId && { productoTiendaId: productoTiendaId }),
      ...(referenciaId && { referenciaId: referenciaId }),
      ...(searchIds && { id: { in: searchIds } }),
    };

    // 🆕 Obtener el total de registros para paginación
    const total = await prisma.movimientoStock.count({
      where: {
        tiendaId: tiendaId,
        ...filtros,
      },
    });

    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        tiendaId: tiendaId,
        ...filtros,
      },
      include: {
        proveedor: true,
        productoTienda: {
          include: {
            producto: {
              select: {
                nombre: true,
              },
            },
            proveedor: true,
          },
        },
        usuario: {
          select: {
            nombre: true,
          },
        },
      },
      take: take,
      skip: skip,
      orderBy: {
        fecha: "desc",
      },
    });

    // 🆕 Retornar objeto con data y total
    return NextResponse.json(
      {
        data: movimientos,
        total: total,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Error al cargar movimiento" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const user = session.user;

    const body = await req.json();
    const parsed = movimientoBatchCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { data, items } = parsed.data;

    const permisoRequerido = PERMISO_POR_TIPO[data.tipo as ITipoMovimiento];
    if (
      !permisoRequerido ||
      !verificarPermisoUsuario(user.permisos, permisoRequerido, user.rol)
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    const tienda = await prisma.tienda.findFirst({
      where: { id: data.tiendaId, negocioId: user.negocio.id },
      select: { id: true },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    // usuarioId nunca se toma del cliente: siempre el usuario autenticado.
    const { advertenciasCaja } = await CreateMoviento(
      { ...data, usuarioId: user.id },
      items,
    );

    return NextResponse.json({ advertenciasCaja }, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Error al crear movimiento" },
      { status: 500 },
    );
  }
}
