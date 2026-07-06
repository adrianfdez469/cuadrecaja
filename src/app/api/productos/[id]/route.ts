import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { CreateMoviento } from "@/lib/movimiento";

const MOTIVO_ELIMINACION = "Eliminación de producto";

// Monto pendiente de liquidar con el proveedor (consignatario) para este
// producto en esta tienda: suma de ProductoProveedorLiquidacion sin liquidar.
async function getMontoPendiente(
  proveedorId: string,
  productoId: string,
  tiendaId: string,
): Promise<number> {
  const pendiente = await prisma.productoProveedorLiquidacion.aggregate({
    _sum: { monto: true },
    where: {
      proveedorId,
      productoId,
      liquidatedAt: null,
      cierre: { tiendaId },
    },
  });
  return pendiente._sum.monto ?? 0;
}

// Info del producto para confirmación de eliminación (GET)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "configuracion.productos.acceder",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const currentTiendaId = searchParams.get("tiendaId");
    const productoTiendaId = searchParams.get("productoTiendaId");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const producto = await prisma.producto.findUnique({
      where: { id, negocioId: user.negocio.id, deletedAt: null },
    });

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 },
      );
    }

    const productosTienda = await prisma.productoTienda.findMany({
      where: { productoId: id, deletedAt: null },
      include: {
        tienda: { select: { nombre: true } },
        proveedor: { select: { nombre: true } },
      },
    });

    const stores = await Promise.all(
      productosTienda.map(async (pt) => ({
        tiendaId: pt.tiendaId,
        tiendaNombre: pt.tienda.nombre,
        existencia: pt.existencia,
        esConsignacion: !!pt.proveedorId,
        proveedorNombre: pt.proveedor?.nombre ?? null,
        isCurrentTienda: productoTiendaId
          ? pt.id === productoTiendaId
          : pt.tiendaId === currentTiendaId,
        montoPendiente: pt.proveedorId
          ? await getMontoPendiente(pt.proveedorId, id, pt.tiendaId)
          : null,
      })),
    );

    return NextResponse.json({
      id: producto.id,
      nombre: producto.nombre,
      stores,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener el producto" },
      { status: 500 },
    );
  }
}

// Elimina el producto solo de la tienda actual: registra el ajuste de salida
// si tenía existencia, y marca esa fila de ProductoTienda como eliminada. El
// Producto maestro y las demás tiendas no se ven afectados — salvo que esta
// fuera la última tienda activa, en cuyo caso también se libera el Producto.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "configuracion.productos.acceder",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const tiendaId = searchParams.get("tiendaId");
    const productoTiendaId = searchParams.get("productoTiendaId");

    if (!id || !tiendaId) {
      return NextResponse.json(
        { error: "ID y tiendaId requeridos" },
        { status: 400 },
      );
    }

    const producto = await prisma.producto.findUnique({
      where: { id, negocioId: user.negocio.id, deletedAt: null },
    });

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 },
      );
    }

    // Si se especifica la fila exacta (caso normal, viene de GestionInventario),
    // se usa para desambiguar entre la fila propia y las de consignación del
    // mismo producto/tienda. Sin ella (caller legacy) solo se permite tocar la
    // fila propia — nunca una consignación sin desambiguación explícita.
    const productoTienda = await prisma.productoTienda.findFirst({
      where: productoTiendaId
        ? { id: productoTiendaId, productoId: id, tiendaId, deletedAt: null }
        : { productoId: id, tiendaId, proveedorId: null, deletedAt: null },
    });

    if (!productoTienda) {
      return NextResponse.json(
        { error: "El producto no está presente en esta tienda" },
        { status: 404 },
      );
    }

    if (productoTienda.proveedorId) {
      const montoPendiente = await getMontoPendiente(
        productoTienda.proveedorId,
        id,
        tiendaId,
      );
      if (montoPendiente > 0) {
        return NextResponse.json(
          {
            error: `No se puede eliminar: hay ${montoPendiente.toFixed(2)} pendiente de liquidar con este proveedor para este producto.`,
          },
          { status: 409 },
        );
      }
    }

    if (productoTienda.existencia > 0) {
      await CreateMoviento(
        {
          tipo: productoTienda.proveedorId
            ? "CONSIGNACION_DEVOLUCION"
            : "AJUSTE_SALIDA",
          tiendaId,
          usuarioId: user.id,
          motivo: MOTIVO_ELIMINACION,
          ...(productoTienda.proveedorId && {
            proveedorId: productoTienda.proveedorId,
          }),
        },
        [{ productoId: id, cantidad: productoTienda.existencia }],
      );
    }

    await prisma.productoTienda.update({
      where: { id: productoTienda.id },
      data: { deletedAt: new Date() },
    });

    // Si ya no queda ninguna tienda activa para este producto, liberar
    // también el Producto maestro (mismo patrón de soft delete + renombrado
    // para liberar el nombre único por negocio).
    const tiendasActivasRestantes = await prisma.productoTienda.count({
      where: { productoId: id, deletedAt: null },
    });

    if (tiendasActivasRestantes === 0) {
      await prisma.producto.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          nombre: `${producto.nombre}_ELIMINADO_${Date.now()}`,
        },
      });
    }

    return NextResponse.json(
      { message: "Producto eliminado de esta tienda" },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al eliminar el producto" },
      { status: 500 },
    );
  }
}

// Actualizar un producto existente
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "configuracion.productos.acceder",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }
    const { id } = await params;

    const {
      nombre,
      categoriaId,
      descripcion,
      fraccion,
      codigosProducto,
      permiteDecimal,
    } = await req.json();

    // Actualizar producto
    await prisma.producto.update({
      where: { id, negocioId: user.negocio.id },
      data: {
        nombre,
        descripcion,
        categoriaId,
        permiteDecimal: Boolean(permiteDecimal), // Convertir a booleano
        ...(fraccion && {
          fraccionDeId: fraccion.fraccionDeId,
          unidadesPorFraccion: fraccion.unidadesPorFraccion,
        }),
      },
      include: { codigosProducto: true },
    });

    // Sincronizar códigos: eliminar los que no están y agregar los nuevos
    if (Array.isArray(codigosProducto)) {
      // Eliminar los que ya no están
      await prisma.codigoProducto.deleteMany({
        where: {
          productoId: id,
          codigo: { notIn: codigosProducto },
        },
      });
      // Agregar los nuevos
      for (const codigo of codigosProducto) {
        await prisma.codigoProducto.upsert({
          where: {
            codigo_negocioId: {
              codigo,
              negocioId: user.negocio.id,
            },
          },
          update: { productoId: id },
          create: { codigo, productoId: id, negocioId: user.negocio.id },
        });
      }
    }

    // Obtener actualizado con los códigos
    const productoFinal = await prisma.producto.findUnique({
      where: { id },
      include: { codigosProducto: true },
    });

    return NextResponse.json(productoFinal);
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un producto con ese nombre en este negocio" },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Producto no encontrado" },
          { status: 404 },
        );
      }
    }
    return NextResponse.json(
      { error: "Error al actualizar el producto" },
      { status: 500 },
    );
  }
}
