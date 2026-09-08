import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getUserFromRequest from "@/utils/getUserFromRequest";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { getSession } from "@/utils/auth";

// GET - Obtener todos los roles del negocio del usuario
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const user = session.user;

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener negocioId desde query params o usar el del usuario
    const { searchParams } = new URL(request.url);
    const negocioId = searchParams.get('negocioId') || user.negocio.id;

    // Solo SUPER_ADMIN puede ver roles de otros negocios
    if (negocioId !== user.negocio.id && user.rol !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if(!verificarPermisoUsuario(user.permisos, "configuracion.roles.acceder", user.rol)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const roles = await prisma.rol.findMany({
      where: {
        OR: [
          { isGlobal: true },
          { negocioId: negocioId },
        ]
      },
      orderBy: [
        { isGlobal: 'desc' },
        { nombre: 'asc' },
      ]
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Error al obtener roles:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST - Crear un nuevo rol
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if(!verificarPermisoUsuario(user.permisos, 'configuracion.roles.escribir', user.rol)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { nombre, descripcion, permisos, isGlobal } = body;

    // Validaciones básicas
    if (!nombre || !permisos) {
      return NextResponse.json(
        { error: "Nombre y permisos son requeridos" },
        { status: 400 }
      );
    }

    // Solo un SUPER_ADMIN puede crear roles globales
    const createGlobal = isGlobal === true;
    if (createGlobal && user.rol !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Solo un superadmin puede crear roles globales" },
        { status: 403 }
      );
    }

    // Verificar que el nombre no exista. Los roles globales viven con
    // negocioId null, fuera del unique compuesto, así que se buscan aparte.
    const existingRol = createGlobal
      ? await prisma.rol.findFirst({
          where: { nombre: nombre, negocioId: null }
        })
      : await prisma.rol.findUnique({
          where: {
            nombre_negocioId: {
              nombre: nombre,
              negocioId: user.negocio.id
            }
          }
        });

    if (existingRol) {
      return NextResponse.json(
        {
          error: createGlobal
            ? "Ya existe un rol global con ese nombre"
            : "Ya existe un rol con ese nombre en este negocio"
        },
        { status: 400 }
      );
    }

    const nuevoRol = await prisma.rol.create({
      data: {
        nombre,
        descripcion,
        permisos,
        isGlobal: createGlobal,
        negocioId: createGlobal ? null : user.negocio.id
      }
    });

    return NextResponse.json(nuevoRol, { status: 201 });
  } catch (error) {
    console.error("Error al crear rol:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 