import {
  CreateMoviento,
  MOVIMIENTO_TX_OPTIONS,
  InsufficientStockError,
} from "@/lib/movimiento";
import {
  claimIdempotencyKey,
  findIdempotentResponse,
  storeIdempotentResponse,
  DuplicateRequestError,
} from "@/lib/idempotency";
import { IDEMPOTENCY_KEY_HEADER } from "@/constants/idempotency";
import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { NextResponse } from "next/server";
import { startOfNextDay } from "@/utils/date";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { movimientoBatchCreateSchema } from "@/schemas/movimiento";
import type {
  ITipoMovimiento,
  IAdvertenciaCajaInsuficiente,
} from "@/schemas/movimiento";

const IDEMPOTENCY_ENDPOINT = "POST /api/movimiento";

type MovimientoResponse = { advertenciasCaja: IAdvertenciaCajaInsuficiente[] };

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
  // Declared outside the try so the duplicate-request handler can look the
  // stored response up again.
  let claim: { key: string; scopeId: string; endpoint: string } | undefined;

  try {
    const session = await getSession();
    const user = session.user;

    // Required: without a key this POST is not replayable, and the axios
    // interceptor would refuse to retry it anyway.
    const idempotencyKey = req.headers.get(IDEMPOTENCY_KEY_HEADER);
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: `Falta la cabecera ${IDEMPOTENCY_KEY_HEADER}` },
        { status: 400 },
      );
    }

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

    claim = {
      key: idempotencyKey,
      scopeId: user.negocio.id,
      endpoint: IDEMPOTENCY_ENDPOINT,
    };

    // Fast path: this batch was already processed, so replay its response
    // instead of doing the work again. The overlapping case — a retry that
    // arrives while the first execution is still running — is caught by the
    // unique index inside the transaction below.
    const replayed = await findIdempotentResponse<MovimientoResponse>(claim);
    if (replayed) {
      return NextResponse.json(
        { ...replayed, duplicado: true },
        { status: 200 },
      );
    }

    const response = await prisma.$transaction(async (tx) => {
      await claimIdempotencyKey(tx, claim);

      // usuarioId nunca se toma del cliente: siempre el usuario autenticado.
      const { advertenciasCaja } = await CreateMoviento(
        { ...data, usuarioId: user.id, batchId: idempotencyKey },
        items,
        tx,
      );

      const payload = { advertenciasCaja };
      await storeIdempotentResponse(tx, idempotencyKey, payload);
      return payload;
    }, MOVIMIENTO_TX_OPTIONS);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // A concurrent request with the same key got there first. It only reaches
    // this point after that request committed — the unique index holds the
    // second one until then — so its response is already stored.
    if (error instanceof DuplicateRequestError && claim) {
      const stored = await findIdempotentResponse<MovimientoResponse>(claim);
      return stored
        ? NextResponse.json({ ...stored, duplicado: true }, { status: 200 })
        : NextResponse.json(
            { error: "La operación ya está en curso" },
            { status: 409 },
          );
    }

    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(error);

    return NextResponse.json(
      { error: "Error al crear movimiento" },
      { status: 500 },
    );
  }
}
