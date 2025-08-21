import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

// Obtener todos los productos (Accesible para todos)
export async function GET() {
  try {

    const session = await getSession();
    const user = session.user;

    const productos = await prisma.producto.findMany({
      include: {
        categoria: {
          select: {
            id: true,
            nombre: true,
            color: true,
          },
        },
        fraccionDe: {
          select: {
            id: true,
            nombre: true,
          },
        },
        codigosProducto: true
      },
      orderBy: {
        nombre: "asc",
      },
      where: {
        negocioId: user.negocio.id
      }
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}

// Crear un nuevo producto (Solo Admin)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.productos.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }
    // Validar límite de productos
    const productosCounter = await prisma.producto.count({
      where: {
        negocioId: user.negocio.id
      }
    });

    if (user.negocio.productlimit !== -1 && user.negocio.productlimit <= productosCounter) {
      return NextResponse.json(
        { error: "Límite de productos excedido" },
        { status: 400 }
      );
    }

    const { nombre, descripcion, categoriaId, fraccion, codigosProducto, permiteDecimal } = await req.json();
    console.log('insert product endpoint => fraccion', fraccion);

    const nuevoProducto = await prisma.producto.create({
      data: { 
        nombre: nombre.trim(), 
        descripcion: descripcion.trim(), 
        categoriaId, 
        negocioId: user.negocio.id, 
        permiteDecimal: Boolean(permiteDecimal),
        ...(fraccion && {fraccionDeId: fraccion.fraccionDeId, unidadesPorFraccion: fraccion.unidadesPorFraccion}),
        codigosProducto: {
          create: (codigosProducto || []).map((codigo: string) => ({ codigo }))
        }
      },
      include: {
        codigosProducto: true
      }
    });

    return NextResponse.json(nuevoProducto, { status: 201 });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      { error: "Error al crear el producto" },
      { status: 500 }
    );
  }
}
