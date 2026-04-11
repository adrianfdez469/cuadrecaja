import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.pos-venta.asociar_codigo",
        user.rol
      )
    ) {
      return NextResponse.json(
        { error: "No tiene permiso para asociar códigos de barras" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { codigo } = await req.json();

    if (!codigo || typeof codigo !== "string" || !codigo.trim()) {
      return NextResponse.json(
        { error: "El código es requerido" },
        { status: 400 }
      );
    }

    const codigoNormalizado = codigo.trim();

    const producto = await prisma.producto.findUnique({
      where: { id, negocioId: user.negocio.id },
    });

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const codigoExistente = await prisma.codigoProducto.findUnique({
      where: { codigo: codigoNormalizado },
    });

    if (codigoExistente) {
      return NextResponse.json(
        { error: "Este código ya está asociado a otro producto" },
        { status: 409 }
      );
    }

    const nuevoCodigo = await prisma.codigoProducto.create({
      data: { codigo: codigoNormalizado, productoId: id },
    });

    return NextResponse.json(nuevoCodigo, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al agregar el código al producto" },
      { status: 500 }
    );
  }
}
