import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.productos.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }
    const { id } = await params;


    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Verificar si el producto existe antes de eliminarlo
    const producto = await prisma.producto.findUnique({
      where: { id, negocioId: user.negocio.id, deletedAt: null },
    });

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Verificar que no tenga stock en ninguna tienda
    const conStock = await prisma.productoTienda.findFirst({
      where: { productoId: id, existencia: { gt: 0 } }
    });
    if (conStock) {
      return NextResponse.json(
        { error: "El producto tiene existencias en una o más tiendas. Ajusta el stock a 0 antes de eliminar." },
        { status: 400 }
      );
    }

    // Soft delete: marcar como eliminado y liberar el nombre único
    await prisma.producto.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        nombre: `${producto.nombre}_ELIMINADO_${Date.now()}`
      }
    });

    return NextResponse.json({ message: "Producto eliminado correctamente" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al eliminar el producto" }, { status: 500 });
  }
}

// Actualizar un producto existente
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.productos.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }
    const { id } = await params;

    const { nombre, categoriaId, descripcion, fraccion, codigosProducto, permiteDecimal } = await req.json();

    // Actualizar producto
    await prisma.producto.update({
      where: { id, negocioId: user.negocio.id },
      data: { 
        nombre, 
        descripcion, 
        categoriaId,
        permiteDecimal: Boolean(permiteDecimal), // Convertir a booleano
        ...(fraccion && {fraccionDeId: fraccion.fraccionDeId, unidadesPorFraccion: fraccion.unidadesPorFraccion}),
      },
      include: { codigosProducto: true }
    });

    // Sincronizar códigos: eliminar los que no están y agregar los nuevos
    if (Array.isArray(codigosProducto)) {
      // Eliminar los que ya no están
      await prisma.codigoProducto.deleteMany({
        where: {
          productoId: id,
          codigo: { notIn: codigosProducto }
        }
      });
      // Agregar los nuevos
      for (const codigo of codigosProducto) {
        await prisma.codigoProducto.upsert({
          where: { codigo },
          update: { productoId: id },
          create: { codigo, productoId: id },
        });
      }
    }

    // Obtener actualizado con los códigos
    const productoFinal = await prisma.producto.findUnique({
      where: { id },
      include: { codigosProducto: true }
    });

    return NextResponse.json(productoFinal);
  } catch (error) {
    console.error(error);
    
    return NextResponse.json({ error: "Error al actualizar el producto" }, { status: 500 });
  }
}