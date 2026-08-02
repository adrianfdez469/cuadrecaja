import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { NextRequest, NextResponse } from "next/server";

// Obtener todos los productos (Accesible para todos)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);
    const orderBy = searchParams.get("orderBy");

    let orderByClause: {
      producto?: {
        nombre?: "asc" | "desc";
      };
      precio?: "asc" | "desc";
    } = {
      producto: {
        nombre: "asc",
      },
    };

    if (orderBy === "precio") {
      orderByClause = {
        precio: "asc",
        ...orderByClause,
      };
    }

    const productosTienda = await prisma.productoTienda.findMany({
      where: {
        tiendaId: tiendaId,
        deletedAt: null,
        producto: { deletedAt: null },
      },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
          },
        },
        proveedor: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: orderByClause,
    });

    // Serializar fechaVencimiento a ISO string para el cliente
    const result = productosTienda.map((pt) => ({
      ...pt,
      fechaVencimiento: pt.fechaVencimiento
        ? pt.fechaVencimiento.toISOString()
        : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;
    const { productoId, precio, costo, monedaCostoCode, monedaPrecioCode } =
      await req.json();

    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.inventario.acceder",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    if ((precio != null && precio < 0) || (costo != null && costo < 0)) {
      return NextResponse.json(
        { error: "El precio y el costo no pueden ser negativos" },
        { status: 400 },
      );
    }

    if (
      costo &&
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.inventario.editarcosto",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "No tiene permiso para fijar el costo del producto" },
        { status: 403 },
      );
    }

    if (
      precio &&
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.inventario.editarprecio",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "No tiene permiso para fijar el precio del producto" },
        { status: 403 },
      );
    }

    const existente = await prisma.productoTienda.findFirst({
      where: { tiendaId, productoId, proveedorId: null, deletedAt: null },
    });
    if (existente) {
      return NextResponse.json(existente, { status: 200 });
    }

    const productoTienda = await prisma.productoTienda.create({
      data: {
        tiendaId,
        productoId,
        existencia: 0,
        precio: precio ?? 0,
        costo: costo ?? 0,
        monedaCostoCode: monedaCostoCode ?? null,
        monedaPrecioCode: monedaPrecioCode ?? null,
      },
    });

    return NextResponse.json(productoTienda, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al crear relación producto-tienda" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;
    const { productos } = await req.json();

    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.inventario.acceder",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    if (!tiendaId || !Array.isArray(productos)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    if (
      productos.some(
        (p) =>
          (p.precio != null && p.precio < 0) ||
          (p.costo != null && p.costo < 0),
      )
    ) {
      return NextResponse.json(
        { error: "El precio y el costo no pueden ser negativos" },
        { status: 400 },
      );
    }

    const puedeEditarCosto = verificarPermisoUsuario(
      user.permisos,
      "operaciones.inventario.editarcosto",
      user.rol,
    );
    const puedeEditarPrecio = verificarPermisoUsuario(
      user.permisos,
      "operaciones.inventario.editarprecio",
      user.rol,
    );

    if (!puedeEditarCosto || !puedeEditarPrecio) {
      const existentes = await prisma.productoTienda.findMany({
        where: { id: { in: productos.map((p) => p.id) }, tiendaId },
        select: {
          id: true,
          precio: true,
          costo: true,
          monedaPrecioCode: true,
          monedaCostoCode: true,
        },
      });
      const existentesPorId = new Map(existentes.map((e) => [e.id, e]));

      for (const producto of productos) {
        const actual = existentesPorId.get(producto.id);
        const intentaCambiarCosto =
          (producto.costo !== undefined && producto.costo !== actual?.costo) ||
          ("monedaCostoCode" in producto &&
            (producto.monedaCostoCode ?? null) !==
              (actual?.monedaCostoCode ?? null));
        const intentaCambiarPrecio =
          (producto.precio !== undefined &&
            producto.precio !== actual?.precio) ||
          ("monedaPrecioCode" in producto &&
            (producto.monedaPrecioCode ?? null) !==
              (actual?.monedaPrecioCode ?? null));

        if (intentaCambiarCosto && !puedeEditarCosto) {
          return NextResponse.json(
            { error: "No tiene permiso para editar el costo del producto" },
            { status: 403 },
          );
        }
        if (intentaCambiarPrecio && !puedeEditarPrecio) {
          return NextResponse.json(
            { error: "No tiene permiso para editar el precio del producto" },
            { status: 403 },
          );
        }
      }
    }

    const buildUpdate = (producto) => {
      const data: {
        precio?: number;
        costo?: number;
        fechaVencimiento?: Date | null;
        monedaCostoCode?: string | null;
        monedaPrecioCode?: string | null;
      } = {};
      if (producto.precio !== undefined) data.precio = producto.precio;
      if (producto.costo !== undefined) data.costo = producto.costo;
      if ("fechaVencimiento" in producto) {
        data.fechaVencimiento = producto.fechaVencimiento
          ? new Date(producto.fechaVencimiento)
          : null;
      }
      if ("monedaCostoCode" in producto)
        data.monedaCostoCode = producto.monedaCostoCode ?? null;
      if ("monedaPrecioCode" in producto)
        data.monedaPrecioCode = producto.monedaPrecioCode ?? null;
      return prisma.productoTienda.update({
        where: { id: producto.id },
        data,
      });
    };

    // El array de productos puede abarcar todo el catálogo de la tienda.
    // Ejecutar todos los updates en una sola transacción satura el transaction
    // pooler (pgbouncer, connection_limit=1) y agota el timeout. Lo dividimos en
    // lotes acotados que corren en transacciones secuenciales. Los updates fijan
    // valores absolutos (idempotentes), así que si un lote falla, reintentar la
    // petición completa converge sin efectos colaterales. La forma de array de
    // $transaction no admite { timeout, maxWait }; el tamaño acotado del lote es
    // lo que mantiene cada transacción rápida. Ver PERFORMANCE_ISSUES.md (P1.2).
    const CHUNK_SIZE = 100;
    for (let i = 0; i < productos.length; i += CHUNK_SIZE) {
      const lote = productos.slice(i, i + CHUNK_SIZE);
      await prisma.$transaction(lote.map(buildUpdate));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
