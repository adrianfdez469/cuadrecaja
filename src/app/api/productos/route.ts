import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

// Obtener todos los productos (Accesible para todos). Acepta ?text= para
// búsqueda por nombre (tolerante a tildes/mayúsculas), usada como autocomplete
// al crear un producto para detectar coincidencias en otras tiendas del negocio.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const user = session.user;

    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text") || "";

    let textFilterIds: string[] | undefined;
    if (text) {
      const pattern = `%${text.trim().replace(/\s+/g, " ")}%`;
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Producto"
        WHERE "negocioId" = ${user.negocio.id}
          AND "deletedAt" IS NULL
          AND unaccent(lower(nombre)) LIKE unaccent(lower(${pattern}))
      `;
      textFilterIds = rows.map((r) => r.id);
    }

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
        codigosProducto: true,
      },
      orderBy: {
        nombre: "asc",
      },
      where: {
        negocioId: user.negocio.id,
        deletedAt: null,
        ...(textFilterIds && { id: { in: textFilterIds } }),
      },
      ...(text && { take: 20 }),
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 },
    );
  }
}

// Crear un nuevo producto (Solo Admin)
export async function POST(req: Request) {
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
    const [productosCounter, negocio] = await Promise.all([
      prisma.producto.count({
        where: { negocioId: user.negocio.id, deletedAt: null },
      }),
      prisma.negocio.findUnique({
        where: { id: user.negocio.id },
        include: { plan: { select: { limiteProductos: true } } },
      }),
    ]);

    const productlimit = negocio.plan?.limiteProductos ?? -1;
    if (productlimit !== -1 && productlimit <= productosCounter) {
      return NextResponse.json(
        { error: "Límite de productos excedido" },
        { status: 400 },
      );
    }

    const {
      nombre,
      descripcion,
      categoriaId,
      fraccion,
      codigosProducto,
      permiteDecimal,
    } = await req.json();

    const nuevoProducto = await prisma.producto.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoriaId,
        negocioId: user.negocio.id,
        permiteDecimal: Boolean(permiteDecimal),
        ...(fraccion && {
          fraccionDeId: fraccion.fraccionDeId,
          unidadesPorFraccion: fraccion.unidadesPorFraccion,
        }),
        codigosProducto: {
          create: (codigosProducto || []).map((codigo: string) => ({
            codigo,
            negocioId: user.negocio.id,
          })),
        },
      },
      include: {
        codigosProducto: true,
      },
    });

    return NextResponse.json(nuevoProducto, { status: 201 });
  } catch (error) {
    console.error(error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un producto o código duplicado en este negocio" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Error al crear el producto" },
      { status: 500 },
    );
  }
}
